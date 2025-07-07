#!/usr/bin/env swift

import Cocoa
import Foundation
import SwiftUI
import UserNotifications
import Combine

// MARK: - Data Models

struct SessionInfo: Codable, Identifiable {
    let id: String // session_id
    let pid: Int32
    let cwd: String
    var message: String
    var status: SessionStatus
    let timestamp: Date
    let startTimestamp: Date
    var totalWorkingTime: TimeInterval
    var currentWorkingStartTimestamp: Date?
    var muted: Bool = false

    enum SessionStatus: String, Codable {
        case working = "working"
        case idle = "idle"
        case exited = "exited"
    }
}

struct HookMessage: Codable {
    let type: String
    let hookType: String
    let sessionId: String
    let pid: Int32
    let cwd: String
    let message: String
    let timestamp: Int64 // Unix timestamp in milliseconds
}

// MARK: - Session Manager

class SessionManager: ObservableObject {
    @Published var sessions: [SessionInfo] = []
    private let lock = NSLock()
    private var pidMonitorTimer: Timer?
    var logger: Logger?

    init() {
        startPIDMonitoring()
    }

    func updateSession(from hookMessage: HookMessage) {
        lock.lock()
        defer { lock.unlock() }

        if let index = sessions.firstIndex(where: { $0.id == hookMessage.sessionId }) {
            // Update existing session
            let oldStatus = sessions[index].status
            let newStatus = determineStatus(from: hookMessage.hookType)
            
            // Handle working time tracking
            if oldStatus == .working && newStatus != .working {
                // Transitioning from working to idle/exited
                if let workingStart = sessions[index].currentWorkingStartTimestamp {
                    sessions[index].totalWorkingTime += Date().timeIntervalSince(workingStart)
                    sessions[index].currentWorkingStartTimestamp = nil
                }
            } else if oldStatus != .working && newStatus == .working {
                // Transitioning to working
                sessions[index].currentWorkingStartTimestamp = Date()
            }
            
            sessions[index].message = hookMessage.message
            sessions[index].status = newStatus
            logger?.log("Updated existing session: \(hookMessage.sessionId)")
        } else {
            // Create new session
            let status = determineStatus(from: hookMessage.hookType)
            let session = SessionInfo(
                id: hookMessage.sessionId,
                pid: hookMessage.pid,
                cwd: hookMessage.cwd,
                message: hookMessage.message,
                status: status,
                timestamp: Date(timeIntervalSince1970: Double(hookMessage.timestamp) / 1000.0),
                startTimestamp: Date(),
                totalWorkingTime: 0,
                currentWorkingStartTimestamp: status == .working ? Date() : nil,
                muted: false
            )
            sessions.append(session)
            logger?.log("Created new session: \(hookMessage.sessionId) with pid: \(hookMessage.pid)")
        }

        sortSessions()
        logger?.log("Total sessions: \(sessions.count)")
    }

    private func sortSessions() {
        // Sort sessions: idle first, then working, then exited, newest first within each group
        sessions.sort { 
            if $0.status == $1.status {
                return $0.timestamp > $1.timestamp
            }
            let order: [SessionInfo.SessionStatus: Int] = [.idle: 0, .working: 1, .exited: 2]
            return order[$0.status]! < order[$1.status]!
        }
    }

    private func determineStatus(from hookType: String) -> SessionInfo.SessionStatus {
        switch hookType {
        case "Stop", "Notification", "SubagentStop":
            return .idle
        default:
            return .working
        }
    }

    private func startPIDMonitoring() {
        pidMonitorTimer = Timer.scheduledTimer(withTimeInterval: 5.0, repeats: true) { _ in
            self.removeDeadSessions()
        }
    }

    private func removeDeadSessions() {
        lock.lock()
        defer { lock.unlock() }

        var hasChanges = false
        for index in sessions.indices {
            // Check if process is still alive
            let result = kill(sessions[index].pid, 0)
            let isDead = result != 0 && errno == ESRCH
            if isDead && sessions[index].status != .exited {
                logger?.log("Marking session as exited: \(sessions[index].id) with pid: \(sessions[index].pid)")
                sessions[index].status = .exited
                hasChanges = true
            }
        }
        
        // Resort sessions if any were marked as exited
        if hasChanges {
            sortSessions()
        }
    }

    var waitingSessionCount: Int {
        sessions.filter { $0.status == .idle && !$0.muted }.count
    }
    
    func removeExitedSessions() {
        lock.lock()
        defer { lock.unlock() }
        
        sessions.removeAll { $0.status == .exited }
        sortSessions()
    }
    
    func toggleMute(sessionId: String) {
        lock.lock()
        defer { lock.unlock() }
        
        if let index = sessions.firstIndex(where: { $0.id == sessionId }) {
            sessions[index].muted.toggle()
            logger?.log("Toggled mute for session \(sessionId): muted=\(sessions[index].muted)")
        }
    }

    deinit {
        pidMonitorTimer?.invalidate()
    }
}

// MARK: - Unix Socket Server

class UnixSocketServer {
    private var socketFD: Int32 = -1
    private let socketPath: String
    private let sessionManager: SessionManager
    private let logger: Logger
    private var acceptQueue: DispatchQueue
    private var clientQueues: [DispatchQueue] = []

    init(sessionManager: SessionManager, logger: Logger) {
        self.sessionManager = sessionManager
        self.logger = logger

        // Use ~/.claude-notify/notifications.sock
        let homeDir = FileManager.default.homeDirectoryForCurrentUser
        let claudeNotifyDir = homeDir.appendingPathComponent(".claude-notify")
        try? FileManager.default.createDirectory(at: claudeNotifyDir, withIntermediateDirectories: true)

        self.socketPath = claudeNotifyDir.appendingPathComponent("notifications.sock").path
        self.acceptQueue = DispatchQueue(label: "com.claude-notify.accept")
    }

    func start() throws {
        // Remove existing socket file
        unlink(socketPath)

        // Create socket
        socketFD = socket(AF_UNIX, SOCK_STREAM, 0)
        guard socketFD >= 0 else {
            throw NSError(domain: "SocketError", code: Int(errno), userInfo: [NSLocalizedDescriptionKey: "Failed to create socket"])
        }

        // Bind socket
        var addr = sockaddr_un()
        addr.sun_family = sa_family_t(AF_UNIX)

        _ = withUnsafeMutablePointer(to: &addr.sun_path.0) { ptr in
            socketPath.withCString { cstr in
                strcpy(ptr, cstr)
            }
        }

        let bindResult = withUnsafePointer(to: &addr) {
            $0.withMemoryRebound(to: sockaddr.self, capacity: 1) { addr in
                bind(socketFD, addr, socklen_t(MemoryLayout<sockaddr_un>.size))
            }
        }

        guard bindResult == 0 else {
            close(socketFD)
            throw NSError(domain: "SocketError", code: Int(errno), userInfo: [NSLocalizedDescriptionKey: "Failed to bind socket"])
        }

        // Listen
        guard listen(socketFD, 5) == 0 else {
            close(socketFD)
            throw NSError(domain: "SocketError", code: Int(errno), userInfo: [NSLocalizedDescriptionKey: "Failed to listen on socket"])
        }

        logger.log("Unix socket server started at \(socketPath)")

        // Accept connections
        acceptQueue.async {
            self.acceptConnections()
        }
    }

    private func acceptConnections() {
        while true {
            var clientAddr = sockaddr_un()
            var clientAddrLen = socklen_t(MemoryLayout<sockaddr_un>.size)

            let clientFD = withUnsafeMutablePointer(to: &clientAddr) {
                $0.withMemoryRebound(to: sockaddr.self, capacity: 1) { addr in
                    accept(socketFD, addr, &clientAddrLen)
                }
            }

            if clientFD < 0 {
                if errno != EINTR {
                    logger.log("Accept error: \(errno)")
                }
                continue
            }

            // Handle client on a separate queue
            let clientQueue = DispatchQueue(label: "com.claude-notify.client.\(clientFD)")
            clientQueues.append(clientQueue)

            clientQueue.async {
                self.handleClient(clientFD)
            }
        }
    }

    private func handleClient(_ clientFD: Int32) {
        defer {
            close(clientFD)
        }

        let bufferSize = 4096
        let buffer = UnsafeMutablePointer<CChar>.allocate(capacity: bufferSize)
        defer { buffer.deallocate() }

        var messageBuffer = ""

        while true {
            let bytesRead = read(clientFD, buffer, bufferSize - 1)

            if bytesRead <= 0 {
                break
            }

            buffer[bytesRead] = 0
            let chunk = String(cString: buffer)
            messageBuffer += chunk

            // Process complete messages (newline-delimited)
            while let newlineRange = messageBuffer.range(of: "\n") {
                let message = String(messageBuffer[..<newlineRange.lowerBound])
                messageBuffer.removeSubrange(messageBuffer.startIndex...newlineRange.lowerBound)

                processMessage(message)
            }
        }
    }

    private func processMessage(_ message: String) {
        logger.log("Received message: \(message)")
        guard let data = message.data(using: .utf8) else {
            logger.log("Failed to convert message to data")
            return
        }

        do {
            let decoder = JSONDecoder()
            let hookMessage = try decoder.decode(HookMessage.self, from: data)
            logger.log("Decoded hook: type=\(hookMessage.hookType), sessionId=\(hookMessage.sessionId), pid=\(hookMessage.pid)")

            DispatchQueue.main.async {
                self.sessionManager.updateSession(from: hookMessage)

                // Show notification for idle status (unless muted)
                if hookMessage.hookType == "Stop" || hookMessage.hookType == "Notification" {
                    if let session = self.sessionManager.sessions.first(where: { $0.id == hookMessage.sessionId }), 
                       !session.muted {
                        self.showNotification(for: hookMessage)
                    }
                }
            }
        } catch {
            logger.log("Failed to decode message: \(error)")
        }
    }

    private func showNotification(for hookMessage: HookMessage) {
        let content = UNMutableNotificationContent()
        content.title = "Claude Code"
        content.subtitle = hookMessage.cwd.replacingOccurrences(of: NSHomeDirectory(), with: "~")
        content.body = hookMessage.message.count > 200 ? String(hookMessage.message.prefix(197)) + "..." : hookMessage.message
        content.sound = .default

        let request = UNNotificationRequest(
            identifier: hookMessage.sessionId,
            content: content,
            trigger: nil
        )

        UNUserNotificationCenter.current().add(request)
    }

    func stop() {
        if socketFD >= 0 {
            close(socketFD)
            unlink(socketPath)
        }
    }

    deinit {
        stop()
    }
}

// MARK: - Logger

class Logger {
    private let logFile: URL
    private let fileHandle: FileHandle?

    init() {
        let homeDir = FileManager.default.homeDirectoryForCurrentUser
        let claudeNotifyDir = homeDir.appendingPathComponent(".claude-notify")
        try? FileManager.default.createDirectory(at: claudeNotifyDir, withIntermediateDirectories: true)

        logFile = claudeNotifyDir.appendingPathComponent("daemon.log")

        // Delete existing log file on startup
        if FileManager.default.fileExists(atPath: logFile.path) {
            try? FileManager.default.removeItem(at: logFile)
        }

        // Create new log file
        FileManager.default.createFile(atPath: logFile.path, contents: nil)

        fileHandle = try? FileHandle(forWritingTo: logFile)
        fileHandle?.seekToEndOfFile()
    }

    func log(_ message: String) {
        let timestamp = ISO8601DateFormatter().string(from: Date())
        let logMessage = "[\(timestamp)] \(message)\n"

        if let data = logMessage.data(using: .utf8) {
            fileHandle?.write(data)
            fileHandle?.synchronizeFile()
        }

        #if DEBUG
        print(logMessage, terminator: "")
        #endif
    }

    deinit {
        try? fileHandle?.close()
    }
}

// MARK: - SwiftUI Views

// Modifier to disable focus effect on macOS 14+
struct FocusEffectModifier: ViewModifier {
    func body(content: Content) -> some View {
        if #available(macOS 14.0, *) {
            content.focusEffectDisabled(true)
        } else {
            content
        }
    }
}

// Custom colors and theme constants
extension Color {
    static let darkBackground = Color(red: 0.11, green: 0.11, blue: 0.118)  // Solid dark background
    static let darkSurface = Color(red: 0.15, green: 0.15, blue: 0.16)
    static let dividerColor = Color(white: 0.3, opacity: 0.3)
    static let textPrimary = Color.white
    static let textSecondary = Color(white: 0.7)
    static let statusWorking = Color(red: 0.3, green: 0.85, blue: 0.4)
    static let statusIdle = Color(red: 1.0, green: 0.6, blue: 0.2)
    static let statusExited = Color(red: 0.9, green: 0.3, blue: 0.3)
}

// Custom status dot view
struct StatusDotView: View {
    let status: SessionInfo.SessionStatus
    
    var color: Color {
        switch status {
        case .working: return .statusWorking
        case .idle: return .statusIdle
        case .exited: return .statusExited
        }
    }
    
    var body: some View {
        Circle()
            .fill(color)
            .frame(width: 8, height: 8)
            .overlay(
                Circle()
                    .fill(color.opacity(0.3))
                    .frame(width: 12, height: 12)
                    .blur(radius: 2)
            )
    }
}

struct ControlCenterView: View {
    @ObservedObject var sessionManager: SessionManager
    @State private var currentTime = Date()
    let timer = Timer.publish(every: 1, on: .main, in: .common).autoconnect()

    var body: some View {
        VStack(spacing: 0) {
            // Header
            VStack(spacing: 12) {
                HStack(alignment: .center) {
                    Text("Active")
                        .font(.system(size: 16, weight: .semibold))
                        .foregroundColor(.textPrimary)
                    
                    Text("(\(sessionManager.sessions.count))")
                        .font(.system(size: 14, weight: .regular))
                        .foregroundColor(.textSecondary)
                    
                    Spacer()
                }
                .padding(.horizontal, 20)
                .padding(.top, 8)
                
                Rectangle()
                    .fill(Color.dividerColor)
                    .frame(height: 1)
            }

            // Session list
            if sessionManager.sessions.isEmpty {
                VStack {
                    Spacer()
                    Text("No active sessions")
                        .font(.system(size: 14))
                        .foregroundColor(.textSecondary)
                    Spacer()
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else {
                ScrollView {
                    VStack(spacing: 1) {
                        ForEach(sessionManager.sessions) { session in
                            SessionRow(session: session, currentTime: currentTime, sessionManager: sessionManager)
                                .padding(.horizontal, 1)
                            
                            if session.id != sessionManager.sessions.last?.id {
                                Rectangle()
                                    .fill(Color.dividerColor)
                                    .frame(height: 1)
                                    .padding(.horizontal, 20)
                            }
                        }
                    }
                    .padding(.vertical, 1)
                }
            }
            
            // Bottom toolbar
            VStack(spacing: 0) {
                Rectangle()
                    .fill(Color.dividerColor)
                    .frame(height: 1)
                
                HStack(spacing: 16) {
                    Button(action: {
                        sessionManager.removeExitedSessions()
                    }) {
                        Text("Clear Exited")
                            .font(.system(size: 13, weight: .medium))
                            .foregroundColor(.textPrimary)
                            .padding(.horizontal, 16)
                            .padding(.vertical, 6)
                            .background(Color.darkSurface)
                            .cornerRadius(6)
                    }
                    .buttonStyle(.plain)
                    
                    Spacer()
                    
                    Button(action: {
                        if let appDelegate = NSApplication.shared.delegate as? AppDelegate {
                            appDelegate.performSelector(onMainThread: #selector(AppDelegate.quit), with: nil, waitUntilDone: false)
                        }
                    }) {
                        Text("Shutdown")
                            .font(.system(size: 13, weight: .medium))
                            .foregroundColor(.white)
                            .padding(.horizontal, 16)
                            .padding(.vertical, 6)
                            .background(Color.red.opacity(0.8))
                            .cornerRadius(6)
                    }
                    .buttonStyle(.plain)
                }
                .padding(16)
            }
        }
        .frame(width: 420)
        .frame(maxHeight: 600)
        .background(Color.darkBackground)
        .cornerRadius(12)
        .onReceive(timer) { _ in
            currentTime = Date()
        }
        .focusable()
        .modifier(FocusEffectModifier())
        .onExitCommand {
            if let appDelegate = NSApplication.shared.delegate as? AppDelegate {
                appDelegate.closeControlWindow()
            }
        }
    }
}

struct SessionRow: View {
    let session: SessionInfo
    let currentTime: Date
    let sessionManager: SessionManager

    var displayCwd: String {
        session.cwd.replacingOccurrences(of: NSHomeDirectory(), with: "~")
    }
    
    var statusText: String {
        switch session.status {
        case .idle: return "Idle"
        case .working: return "Working"
        case .exited: return "Exited"
        }
    }
    
    func formatDuration(_ interval: TimeInterval) -> String {
        let hours = Int(interval) / 3600
        let minutes = (Int(interval) % 3600) / 60
        let seconds = Int(interval) % 60
        
        if hours > 0 {
            return "\(hours)h \(minutes)m"
        } else if minutes > 0 {
            return "\(minutes)m \(seconds)s"
        } else {
            return "\(seconds)s"
        }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            // First row: Path and status info
            HStack(spacing: 16) {
                HStack(spacing: 8) {
                    StatusDotView(status: session.status)
                    
                    HStack(spacing: 6) {
                        Image(systemName: "folder.fill")
                            .font(.system(size: 11))
                            .foregroundColor(.textSecondary)
                        
                        Text(displayCwd)
                            .font(.system(size: 12))
                            .foregroundColor(.textSecondary)
                    }
                }
                
                Spacer()
                
                // Status and time info
                HStack(spacing: 12) {
                    if session.status == .working, let workingStart = session.currentWorkingStartTimestamp {
                        Text("\(statusText) • \(formatDuration(Date().timeIntervalSince(workingStart)))")
                            .font(.system(size: 11))
                            .foregroundColor(.statusWorking)
                    } else {
                        Text(statusText)
                            .font(.system(size: 11))
                            .foregroundColor(session.status == .idle ? .statusIdle : .statusExited)
                    }
                    
                    Text("PID \(session.pid)")
                        .font(.system(size: 11))
                        .foregroundColor(.textSecondary.opacity(0.7))
                }
                
                Button(action: {
                    sessionManager.toggleMute(sessionId: session.id)
                }) {
                    Image(systemName: session.muted ? "bell.slash.fill" : "bell.fill")
                        .font(.system(size: 12))
                        .foregroundColor(session.muted ? .textSecondary : .textPrimary)
                        .frame(width: 24, height: 24)
                        .background(
                            RoundedRectangle(cornerRadius: 6)
                                .fill(session.muted ? Color.red.opacity(0.2) : Color.clear)
                        )
                }
                .buttonStyle(.plain)
                .help(session.muted ? "Unmute notifications" : "Mute notifications")
            }
            
            // Second row: Full message
            Text(session.message)
                .font(.system(size: 12))
                .foregroundColor(.textPrimary.opacity(0.9))
                .lineLimit(nil)
                .multilineTextAlignment(.leading)
                .frame(maxWidth: .infinity, alignment: .leading)
                .fixedSize(horizontal: false, vertical: true)
        }
        .padding(16)
        .background(
            RoundedRectangle(cornerRadius: 8)
                .fill(session.status == .exited ? Color.darkSurface.opacity(0.6) : Color.darkSurface)
        )
        .opacity(session.muted ? 0.7 : 1.0)
    }
}

// MARK: - App Delegate

class AppDelegate: NSObject, NSApplicationDelegate {
    var statusItem: NSStatusItem?
    var sessionManager = SessionManager()
    var socketServer: UnixSocketServer?
    var logger = Logger()
    var controlWindow: NSWindow?

    func applicationDidFinishLaunching(_ notification: Notification) {
        logger.log("Claude Notify daemon starting...")

        // Set logger for session manager
        sessionManager.logger = logger

        // Request notification permissions
        UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound]) { granted, error in
            if granted {
                self.logger.log("Notification permissions granted")
            } else {
                self.logger.log("Notification permissions denied: \(error?.localizedDescription ?? "Unknown error")")
            }
        }

        // Set up menu bar
        setupMenuBar()

        // Start socket server
        socketServer = UnixSocketServer(sessionManager: sessionManager, logger: logger)
        do {
            try socketServer?.start()
        } catch {
            logger.log("Failed to start socket server: \(error)")
            NSApplication.shared.terminate(nil)
        }

        // Observe session changes to update badge
        sessionManager.$sessions.sink { [weak self] _ in
            self?.updateBadge()
        }.store(in: &cancellables)
    }

    private var cancellables = Set<AnyCancellable>()

    private func setupMenuBar() {
        statusItem = NSStatusBar.system.statusItem(withLength: NSStatusItem.variableLength)

        if let button = statusItem?.button {
            // Set initial bold "CC" text
            let attributes: [NSAttributedString.Key: Any] = [
                .font: NSFont.boldSystemFont(ofSize: NSFont.systemFontSize)
            ]
            button.attributedTitle = NSAttributedString(string: "CC", attributes: attributes)
            button.action = #selector(toggleControlCenter)
            button.target = self
        }
    }

    private func updateBadge() {
        let count = sessionManager.waitingSessionCount

        if let button = statusItem?.button {
            let text = count > 0 ? "CC(\(count))" : "CC"
            let attributes: [NSAttributedString.Key: Any] = [
                .font: NSFont.boldSystemFont(ofSize: NSFont.systemFontSize)
            ]
            button.attributedTitle = NSAttributedString(string: text, attributes: attributes)
        }
    }

    @objc private func toggleControlCenter() {
        if let window = controlWindow, window.isVisible {
            logger.log("Closing control center window")
            closeControlWindow()
        } else {
            logger.log("Opening control center window")
            showControlCenter()
        }
    }

    private func showControlCenter() {
        let contentView = ControlCenterView(sessionManager: sessionManager)
            .cornerRadius(12)
            .shadow(color: Color.black.opacity(0.3), radius: 20, x: 0, y: 10)

        controlWindow = NSWindow(
            contentRect: NSRect(x: 0, y: 0, width: 420, height: 600),
            styleMask: [.titled, .closable, .fullSizeContentView],
            backing: .buffered,
            defer: false
        )

        controlWindow?.contentView = NSHostingView(rootView: contentView)
        controlWindow?.titlebarAppearsTransparent = true
        controlWindow?.titleVisibility = .hidden
        controlWindow?.isMovableByWindowBackground = true
        controlWindow?.level = .floating
        controlWindow?.isReleasedWhenClosed = false
        controlWindow?.backgroundColor = NSColor(red: 0.11, green: 0.11, blue: 0.118, alpha: 1.0)
        controlWindow?.isOpaque = true
        controlWindow?.hasShadow = true
        controlWindow?.standardWindowButton(.closeButton)?.isHidden = true
        controlWindow?.standardWindowButton(.miniaturizeButton)?.isHidden = true
        controlWindow?.standardWindowButton(.zoomButton)?.isHidden = true

        // Position below menu bar icon
        if let button = statusItem?.button,
           let buttonWindow = button.window {
            let buttonFrame = buttonWindow.convertToScreen(button.frame)
            controlWindow?.setFrameTopLeftPoint(NSPoint(
                x: buttonFrame.midX - 210,
                y: buttonFrame.minY - 5
            ))
        }
        
        // Make the app active and window key
        NSApp.activate(ignoringOtherApps: true)
        controlWindow?.makeKeyAndOrderFront(nil)

        // Close on click outside
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(windowDidResignKey),
            name: NSWindow.didResignKeyNotification,
            object: controlWindow
        )
    }

    @objc private func windowDidResignKey(_ notification: Notification) {
        if notification.object as? NSWindow == controlWindow {
            closeControlWindow()
        }
    }
    
    func closeControlWindow() {
        // Remove notification observer
        NotificationCenter.default.removeObserver(
            self,
            name: NSWindow.didResignKeyNotification,
            object: controlWindow
        )
        
        // Clear delegate if we set one
        controlWindow?.delegate = nil
        
        // Close and nil out the window
        controlWindow?.close()
        controlWindow = nil
    }

    @objc private func clearExited() {
        sessionManager.removeExitedSessions()
    }

    @objc func quit() {
        logger.log("Claude Notify daemon shutting down...")
        socketServer?.stop()
        NSApplication.shared.terminate(nil)
    }

    func applicationWillTerminate(_ notification: Notification) {
        socketServer?.stop()
    }

    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool {
        // Don't terminate when windows close - we're a menu bar app
        logger.log("applicationShouldTerminateAfterLastWindowClosed called - returning false")
        return false
    }

    private func isAnotherInstanceRunning() -> Bool {
        // Check if the socket already exists and is in use
        let homeDir = FileManager.default.homeDirectoryForCurrentUser
        let socketPath = homeDir.appendingPathComponent(".claude-notify/notifications.sock").path

        // Try to connect to the socket
        let socketFD = socket(AF_UNIX, SOCK_STREAM, 0)
        guard socketFD >= 0 else { return false }
        defer { close(socketFD) }

        var addr = sockaddr_un()
        addr.sun_family = sa_family_t(AF_UNIX)

        _ = withUnsafeMutablePointer(to: &addr.sun_path.0) { ptr in
            socketPath.withCString { cstr in
                strcpy(ptr, cstr)
            }
        }

        let connectResult = withUnsafePointer(to: &addr) {
            $0.withMemoryRebound(to: sockaddr.self, capacity: 1) { addr in
                connect(socketFD, addr, socklen_t(MemoryLayout<sockaddr_un>.size))
            }
        }

        // If we can connect, another instance is running
        return connectResult == 0
    }
}

// MARK: - Combine Extensions

import Combine

// MARK: - Main

let app = NSApplication.shared
let delegate = AppDelegate()
app.delegate = delegate
app.setActivationPolicy(.accessory)
app.run()