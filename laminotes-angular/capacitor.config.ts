/**
 * Capacitor configuration file.
 * 
 * Defines settings for iOS/iPad deployment including app information,
 * permissions, and platform-specific configurations.
 */
import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.laminotes.app',
  appName: 'Laminotes',
  webDir: 'dist/laminotes-angular/browser',
  bundledWebRuntime: false,
  plugins: {
    SplashScreen: {
      launchShowDuration: 0
    },
    // Configure specific permissions for iOS
    // These are required for file system access on iPad OS
    Filesystem: {
      ios: {
        useLegacyStorage: false // Use the new storage system
      }
    }
  },
  ios: {
    // iOS specific configuration
    contentInset: 'always',
    allowsLinkPreview: true,
    scrollEnabled: true,
    // Handle keyboard behavior properly on iPad
    preferredContentMode: 'mobile',
    // Handle storage location settings
    scheme: 'laminotes',
    backgroundColor: '#ffffff'
  },
  server: {
    // For development only
    hostname: '35.246.27.92',
    cleartext: true,
    allowNavigation: ['35.246.27.92', '*.35.246.27.92']
  }
};

export default config;
