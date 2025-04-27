# Laminotes - Collaborative Markdown Editor

Laminotes is a modern, cross-platform collaborative Markdown editor that supports real-time collaboration, version control, and conflict resolution. It's designed to work seamlessly across web browsers, desktop (via Electron), and iOS/iPadOS (via Capacitor).

## Key Features

- **Cross-Platform Support**: Works on web browsers, desktop (Windows/macOS/Linux) via Electron, and iOS/iPadOS via Capacitor
- **Real-Time Collaboration**: Edit documents simultaneously with team members
- **Version Control**: Track document history with detailed version information
- **Conflict Resolution**: Sophisticated conflict detection and resolution system
- **Team Management**: Create teams, invite members, and manage permissions
- **Offline Support**: Continue working without an internet connection
- **Markdown Enhancements**: Support for images, code blocks, and more
- **AI Assistance**: Claude AI integration for content suggestions and improvements

## Technical Stack

- **Frontend**: Angular 19 
- **Backend**: Rust-based Forseti Service
- **Desktop**: Electron integration
- **Mobile**: iOS/iPadOS via Capacitor
- **AI**: Claude API integration for intelligent assistance
- **Storage**: Files stored locally with cloud synchronization

## Installation

### Prerequisites

- Node.js 18+ and npm
- Angular CLI 19+
- Rust (for backend)

### Frontend Setup

```bash
# Clone the repository
git clone [repository-url]

# Navigate to the Angular project
cd laminotes-angular

# Install dependencies
npm install

# Start development server
npm start
```

### Running on Desktop (Electron)

```bash
# Build and run the Electron app
npm run electron:start
```

### Building for iOS (Capacitor)

```bash
# Add iOS platform
npm run cap:add:ios

# Build and sync
npm run cap:build:ios

# Open in Xcode
npm run cap:open:ios
```

## Development

### Development Server

```bash
ng serve
```

Navigate to `http://localhost:4200/`. The application automatically reloads when you change source files.

### Building

```bash
ng build
```

This will compile your project and store the build artifacts in the `dist/` directory with production optimizations.

## Architecture

- **Component-Based Structure**: Modular design with reusable components
- **Services Layer**: Handles data management, authentication, and API communication
- **Cross-Platform Adapters**: Platform-specific code separated for maintainability
- **Version Control System**: Tracks document history and manages conflicts

## Integration with Forseti Service

Laminotes connects to the Forseti Service backend for:
- User authentication
- Document storage and synchronization
- Version control
- Team management
- Conflict resolution

Make sure to have the Forseti Service running according to its documentation before using Laminotes with full functionality.

## Team Collaboration Features

- Create and manage teams
- Invite members with different permission levels (Viewer, Contributor, Owner)
- Team-specific file storage and sharing
- Role-based access control for documents

## AI Assistance Features

Laminotes includes Claude AI integration for:
- Reformatting text
- Generating code examples
- Creating diagrams from text descriptions
- Analyzing document content
- Providing writing suggestions

## Offline Capabilities

Laminotes can function offline with:
- Local file storage
- Pending changes queue
- Automatic synchronization when back online
- Conflict resolution for changes made while offline

## Dependencies

- Angular core libraries
- ngx-markdown for Markdown rendering
- Electron for desktop support
- Capacitor for iOS/iPadOS support
- Various utility libraries (listed in package.json)