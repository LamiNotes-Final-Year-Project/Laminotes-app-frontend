# Capacitor Integration for iPadOS

We've integrated Capacitor to support iPadOS in the Laminotes application. Here's a summary of what we've implemented:

## Key Components

1. **CapacitorService** - Acts as a bridge between our app and Capacitor's native iOS functionality, particularly file system operations.

2. **Platform Detection** - The app now intelligently detects which platform it's running on (web, desktop via Electron, or mobile via Capacitor).

3. **iOS File System Integration** - We've implemented secure file access that works within Apple's strict sandbox security model.

4. **Team Directory Support** - Team-specific directories work on iOS using a simplified directory structure.

5. **iOS Configuration** - Added Info.plist settings for proper iOS/iPadOS permissions and behavior.

## File Structure

- `/Documents/Laminotes/` - Default user file directory
- `/Documents/Teams/{TeamName}/` - Team-specific directories

## iPadOS Limitations Addressed

1. **No System Directory Picker** - iOS doesn't allow apps to freely browse the file system like desktop OS. We've implemented a solution that creates structured directories within the app's sandbox.

2. **Sandboxed File Access** - All file operations must occur within the app's designated storage areas. Our implementation ensures files are stored in allowed locations.

3. **Document Sharing** - We've configured the app to support iOS document sharing features to allow import/export of files.

## Using the Integration

### Development

1. Run `npm run cap:build` to build the Angular app and sync with Capacitor
2. Run `npm run cap:open:ios` to open in Xcode
3. Select iPad from device dropdown and run

### Deployment

1. Configure code signing in Xcode
2. Build and archive for App Store or Ad Hoc distribution

See the CAPACITOR_README.md file for detailed instructions on setting up your development environment and deploying to iOS devices.
