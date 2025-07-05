// swift-tools-version: 5.9
// The swift-tools-version declares the minimum version of Swift required to build this package.

import PackageDescription

let package = Package(
    name: "ClaudeNotify",
    platforms: [
        .macOS(.v12)
    ],
    products: [
        .executable(
            name: "ClaudeNotifyDaemon",
            targets: ["ClaudeNotifyDaemon"]
        )
    ],
    dependencies: [],
    targets: [
        .executableTarget(
            name: "ClaudeNotifyDaemon",
            dependencies: [],
            path: "src/mac",
            exclude: ["Info.plist", "daemon-debug.entitlements", "daemon-release.entitlements", "BridgingHeader.h"],
            sources: ["daemon.swift"],
            swiftSettings: [
                .unsafeFlags(["-import-objc-header", "src/mac/BridgingHeader.h"])
            ]
        )
    ]
)