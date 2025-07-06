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
    var lastMessage: String
    var status: SessionStatus
    let timestamp: Date
    let startTimestamp: Date
    var totalWorkingTime: TimeInterval
    var currentWorkingStartTimestamp: Date?

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
            
            sessions[index].lastMessage = hookMessage.message
            sessions[index].status = newStatus
            logger?.log("Updated existing session: \(hookMessage.sessionId)")
        } else {
            // Create new session
            let status = determineStatus(from: hookMessage.hookType)
            let session = SessionInfo(
                id: hookMessage.sessionId,
                pid: hookMessage.pid,
                cwd: hookMessage.cwd,
                lastMessage: hookMessage.message,
                status: status,
                timestamp: Date(timeIntervalSince1970: Double(hookMessage.timestamp) / 1000.0),
                startTimestamp: Date(),
                totalWorkingTime: 0,
                currentWorkingStartTimestamp: status == .working ? Date() : nil
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
        sessions.filter { $0.status == .idle }.count
    }
    
    func removeExitedSessions() {
        lock.lock()
        defer { lock.unlock() }
        
        sessions.removeAll { $0.status == .exited }
        sortSessions()
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

                // Show notification for idle status
                if hookMessage.hookType == "Stop" || hookMessage.hookType == "Notification" {
                    self.showNotification(for: hookMessage)
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
        content.body = String(hookMessage.message.prefix(200))
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

struct ControlCenterView: View {
    @ObservedObject var sessionManager: SessionManager
    @State private var currentTime = Date()
    let timer = Timer.publish(every: 1, on: .main, in: .common).autoconnect()

    var body: some View {
        VStack(spacing: 0) {
            // Header
            HStack {
                Text("Claude Code Sessions")
                    .font(.headline)
                Spacer()
                Button("Clear Exited") {
                    sessionManager.removeExitedSessions()
                }
                .buttonStyle(.plain)
                .font(.caption)
                
                Button("Shutdown") {
                    if let appDelegate = NSApplication.shared.delegate as? AppDelegate {
                        appDelegate.performSelector(onMainThread: #selector(AppDelegate.quit), with: nil, waitUntilDone: false)
                    }
                }
                .buttonStyle(.plain)
                .font(.caption)
                .foregroundColor(.red)
            }
            .padding()
            .background(Color(NSColor.controlBackgroundColor))

            Divider()

            // Session list
            if sessionManager.sessions.isEmpty {
                VStack {
                    Spacer()
                    Text("No active sessions")
                        .foregroundColor(.secondary)
                    Spacer()
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else {
                ScrollView {
                    VStack(spacing: 0) {
                        ForEach(sessionManager.sessions) { session in
                            SessionRow(session: session, currentTime: currentTime)
                            Divider()
                        }
                    }
                }
            }
        }
        .frame(width: 400)
        .frame(maxHeight: 600)
        .background(Color(NSColor.windowBackgroundColor))
        .onReceive(timer) { _ in
            currentTime = Date()
        }
    }
}

struct SessionRow: View {
    let session: SessionInfo
    let currentTime: Date

    var statusIcon: String {
        switch session.status {
        case .idle: return "🟡"
        case .working: return "🟢"
        case .exited: return "🔴"
        }
    }

    var displayCwd: String {
        session.cwd.replacingOccurrences(of: NSHomeDirectory(), with: "~")
    }
    
    func formatDuration(_ interval: TimeInterval) -> String {
        let hours = Int(interval) / 3600
        let minutes = (Int(interval) % 3600) / 60
        let seconds = Int(interval) % 60
        
        if hours > 0 {
            return "\(hours)h \(minutes)m \(seconds)s"
        } else if minutes > 0 {
            return "\(minutes)m \(seconds)s"
        } else {
            return "\(seconds)s"
        }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack {
                Text(statusIcon)
                    .font(.caption)
                Text(displayCwd)
                    .font(.caption)
                    .foregroundColor(.secondary)
                Spacer()
                Text("PID: \(String(session.pid))")
                    .font(.caption2)
                    .foregroundColor(.secondary)
            }
            
            // Duration display
            HStack(spacing: 12) {
                Text("Session: \(formatDuration(Date().timeIntervalSince(session.startTimestamp)))")
                    .font(.caption2)
                    .foregroundColor(.secondary)
                
                let totalWorking = session.totalWorkingTime + 
                    (session.currentWorkingStartTimestamp != nil ? Date().timeIntervalSince(session.currentWorkingStartTimestamp!) : 0)
                Text("Working: \(formatDuration(totalWorking))")
                    .font(.caption2)
                    .foregroundColor(.secondary)
                
                if session.status == .working, let workingStart = session.currentWorkingStartTimestamp {
                    Text("Current: \(formatDuration(Date().timeIntervalSince(workingStart)))")
                        .font(.caption2)
                        .foregroundColor(.secondary)
                }
            }

            Text(session.lastMessage)
                .font(.system(size: 11))
                .lineLimit(5)
                .multilineTextAlignment(.leading)
                .frame(maxWidth: .infinity, alignment: .leading)
        }
        .padding()
        .background(Color(NSColor.controlBackgroundColor).opacity(0.5))
        .opacity(session.status == .exited ? 0.6 : 1.0)
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
            button.image = NSImage(systemSymbolName: "message.fill", accessibilityDescription: "Claude Notify")
            button.action = #selector(toggleControlCenter)
            button.target = self
        }
    }

    private func updateBadge() {
        let count = sessionManager.waitingSessionCount

        if let button = statusItem?.button {
            if count > 0 {
                button.title = " \(count)"
            } else {
                button.title = ""
            }
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

        controlWindow = NSWindow(
            contentRect: NSRect(x: 0, y: 0, width: 400, height: 600),
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

        // Position below menu bar icon
        if let button = statusItem?.button,
           let buttonWindow = button.window {
            let buttonFrame = buttonWindow.convertToScreen(button.frame)
            controlWindow?.setFrameTopLeftPoint(NSPoint(
                x: buttonFrame.midX - 200,
                y: buttonFrame.minY - 5
            ))
        }
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
    
    private func closeControlWindow() {
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