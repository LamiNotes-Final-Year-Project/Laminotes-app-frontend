# Capacitor Integration for iPadOS

We've integrated Capacitor to support iPadOS in the Laminotes application. Here's a summary of what we've implemented:

## Key Components

1. **CapacitorService** - Acts as a bridge between our app and Capacitor's native iOS functionality, particularly file system operations. Enhanced with full team directory support and offline capabilities.

2. **Platform Detection** - The app now intelligently detects which platform it's running on (web, desktop via Electron, or mobile via Capacitor).

3. **iOS File System Integration** - We've implemented secure file access that works within Apple's strict sandbox security model, with improved organization for team files.

4. **Team Directory Support** - Team-specific directories work on iOS using a simplified directory structure with automatic team folder creation.

5. **iOS Configuration** - Added Info.plist settings for proper iOS/iPadOS permissions and behavior.

6. **Version Control Integration** - Enhanced version control with offline support and platform-specific optimizations for iOS/iPadOS.

## File Structure

- `/Documents/Laminotes/` - Default user file directory
- `/Documents/Teams/{TeamName}/` - Team-specific directories

## Enhanced Features

1. **Team Management**
   - Automatic team directory creation and validation
   - Team-specific file organization
   - Move files between personal and team contexts

2. **Mobile-Optimized File Operations**
   - Improved file saving with team context awareness
   - Simplified directory selection appropriate for iOS
   - File path sanitization for iOS compatibility

3. **Offline Support**
   - Local version caching for offline history viewing
   - Offline saving with sync-later capability
   - Graceful degradation when network is unavailable

4. **Cross-Platform Consistency**
   - Common API between Electron and Capacitor services
   - Platform-aware interface adjustments
   - Unified error handling across platforms

## iPadOS Limitations Addressed

1. **No System Directory Picker** - iOS doesn't allow apps to freely browse the file system like desktop OS. We've implemented a solution that creates structured directories within the app's sandbox.

2. **Sandboxed File Access** - All file operations must occur within the app's designated storage areas. Our implementation ensures files are stored in allowed locations.

3. **Document Sharing** - We've configured the app to support iOS document sharing features to allow import/export of files.

4. **Network Connectivity** - Mobile devices often have variable connectivity. We've added resilience to network issues with local caching and offline support.

## Using the Integration

### Development

1. Run `npm run cap:build` to build the Angular app and sync with Capacitor
2. Run `npm run cap:open:ios` to open in Xcode
3. Select iPad from device dropdown and run

### Deployment

1. Configure code signing in Xcode
2. Build and archive for App Store or Ad Hoc distribution

See the CAPACITOR_README.md file for detailed instructions on setting up your development environment and deploying to iOS devices.