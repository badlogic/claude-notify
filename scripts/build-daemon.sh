#!/bin/bash

# Claude Notify macOS Daemon Build Script
# Uses Swift Package Manager to build, then creates app bundle

set -e  # Exit on any error

# Configuration
DAEMON_NAME="ClaudeNotifyDaemon"

# Certificates
DEVELOPMENT_CERT="Apple Development: Mario Zechner (JT5J533538)"
DISTRIBUTION_CERT="Developer ID Application: Mario Zechner (7F5Y92G2Z4)"

# Check if certificates exist, fall back to ad-hoc signing
function get_signing_identity() {
    local cert_name=$1
    if security find-identity -v -p codesigning | grep -q "$cert_name"; then
        echo "$cert_name"
    else
        echo "-"  # Ad-hoc signing
    fi
}

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m' # No Color

function log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

function log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

function build_and_sign() {
    local config=$1
    local cert_name=$2
    local entitlements=$3
    
    # Get actual signing identity (certificate or ad-hoc)
    local cert=$(get_signing_identity "$cert_name")
    
    log_info "Building daemon for $config configuration..."
    if [ "$cert" = "-" ]; then
        log_info "Certificate not found, using ad-hoc signing"
    else
        log_info "Using certificate: $cert"
    fi
    
    # Build with Swift Package Manager
    if [ "$config" = "release" ]; then
        swift build -c release
        BINARY_PATH=".build/release/${DAEMON_NAME}"
    else
        swift build
        BINARY_PATH=".build/debug/${DAEMON_NAME}"
    fi
    
    # Remove existing app bundle
    rm -rf "dist/${DAEMON_NAME}.app"
    
    # Create app bundle structure
    mkdir -p "dist/${DAEMON_NAME}.app/Contents/MacOS"
    mkdir -p "dist/${DAEMON_NAME}.app/Contents/Resources"
    
    # Copy the built binary
    cp "$BINARY_PATH" "dist/${DAEMON_NAME}.app/Contents/MacOS/${DAEMON_NAME}"
    
    # Copy Info.plist
    cp src/mac/Info.plist "dist/${DAEMON_NAME}.app/Contents/Info.plist"
    
    # Code sign the app
    if [ "$cert" = "-" ]; then
        log_info "Ad-hoc signing the app"
        codesign --force --sign "-" \
            --entitlements "$entitlements" \
            "dist/${DAEMON_NAME}.app"
    else
        log_info "Code signing with: $cert"
        if [ "$config" = "release" ]; then
            codesign --force --sign "$cert" \
                --options runtime \
                --entitlements "$entitlements" \
                "dist/${DAEMON_NAME}.app"
        else
            codesign --force --sign "$cert" \
                --entitlements "$entitlements" \
                "dist/${DAEMON_NAME}.app"
        fi
    fi
    
    if [ $? -ne 0 ]; then
        log_error "Code signing failed"
        exit 1
    fi
    
    # Verify signing
    log_info "Verifying code signature..."
    codesign -dv --verbose=4 "dist/${DAEMON_NAME}.app" 2>&1 | head -10
    
    log_info "$config build completed successfully"
    log_info "Daemon app bundle created at: dist/${DAEMON_NAME}.app"
}

# Main script logic
case "$1" in
    "debug")
        build_and_sign "debug" "$DEVELOPMENT_CERT" "src/mac/daemon-debug.entitlements"
        # Kill the daemon after successful build so it restarts with new code
        log_info "Killing existing daemon to reload changes..."
        pkill -f ClaudeNotifyDaemon || true
        ;;
    "release")
        build_and_sign "release" "$DISTRIBUTION_CERT" "src/mac/daemon-release.entitlements"
        # Kill the daemon after successful build so it restarts with new code
        log_info "Killing existing daemon to reload changes..."
        pkill -f ClaudeNotifyDaemon || true
        ;;
    *)
        echo "Usage: $0 [debug|release]"
        echo ""
        echo "Commands:"
        echo "  debug   - Build debug version with Apple Development certificate"
        echo "  release - Build release version with Developer ID certificate"
        exit 1
        ;;
esac