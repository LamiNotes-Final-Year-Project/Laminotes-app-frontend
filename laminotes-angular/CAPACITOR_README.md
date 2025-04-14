# Laminotes Capacitor Integration Guide

This guide explains how to develop, build, and deploy Laminotes for iOS/iPadOS using Capacitor.

## Overview

Laminotes now supports three environments:
- Web browser (default Angular web app)
- Desktop (via Electron)
- Mobile (via Capacitor for iOS/iPadOS)

## Prerequisites

- macOS environment (required for iOS development)
- Xcode 14+ installed
- iOS 14+ device or simulator
- Node.js 16+ and npm
- CocoaPods (`sudo gem install cocoapods`)

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Initialize iOS project if not already done:
   ```bash
   npm run cap:init:ios
   ```

3. Copy iOS configuration:
   ```bash
   cp ios-plist-additions.xml ios/App/App/Info.plist.additions
   ```

## Development Workflow

1. Build the Angular app:
   ```bash
   npm run build
   ```

2. Sync the build with Capacitor:
   ```bash
   npm run cap:sync
   ```

3. Open the project in Xcode:
   ```bash
   npm run cap:open:ios
   ```

4. From Xcode, you can run the app on a simulator or physical device

## File System Structure

On iOS/iPadOS, Laminotes uses a sandbox-friendly file structure:

- `/Documents/Laminotes/` - Default directory for user files
- `/Documents/Teams/{team-name}/` - Team-specific directories

## Key Implementation Details

### Platform Detection

The application detects the current platform using:
- `capacitorService.isCapacitor()` - True if running in Capacitor
- `capacitorService.isIOS()` - True if running on iOS/iPadOS
- `electronService.isElectron()` - True if running in Electron

### File System Access

iOS uses a different file system approach than Electron:

- Files are accessed via the Capacitor `Filesystem` plugin
- Files are stored in the app's Documents directory
- Team files are organized in subdirectories
- User cannot freely browse the entire file system (iOS limitation)

### Directory Selection

Due to iOS sandbox restrictions:
- No system directory picker is available
- App creates predefined directories instead
- Team directories follow a consistent naming pattern

## Testing

To test the app on an iPad simulator:

1. After opening in Xcode, select iPad from the device dropdown
2. Run the application
3. Test file creation, team management, and file synchronization

Or on a physical iPad:

1. Connect your iPad to your Mac
2. Select it from the device dropdown in Xcode
3. Run the application (you may need to adjust signing settings)

## Build for Distribution

1. Configure code signing in Xcode
2. Set the deployment target to iOS 14.0+
3. Archive the build from Xcode
4. Use App Store Connect to distribute

## Troubleshooting

- **File System Permissions**: If files aren't saving, check Info.plist entries
- **Team Directory Issues**: Verify team directory creation in console logs
- **Plugin Errors**: Run `npx cap doctor` to check for plugin configuration issues

## References

- [Capacitor Documentation](https://capacitorjs.com/docs)
- [Capacitor Filesystem Plugin](https://capacitorjs.com/docs/apis/filesystem)
- [Angular-Capacitor Integration](https://capacitorjs.com/docs/getting-started/with-angular)