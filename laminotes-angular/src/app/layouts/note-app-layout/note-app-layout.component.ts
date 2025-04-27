import {Component, OnDestroy, OnInit, ViewChild, ElementRef } from '@angular/core';
import {CommonModule} from '@angular/common';
import {FormsModule} from '@angular/forms';
import {Observable, Subscription, Subject, of} from 'rxjs';
import {debounceTime, distinctUntilChanged} from 'rxjs/operators';

import {FileInfo, FileService} from '../../services/file.service';
import {AuthService} from '../../services/auth.service';
import {MetadataService} from '../../services/metadata.service';
import {NotificationService} from '../../services/notification.service';
import {InvitationService} from '../../services/invitation.service';
import { ElectronService } from '../../services/electron.service';
import { MlService } from '../../services/ml-service';

import {ColoredMarkdownViewComponent} from '../../components/colored-markdown-view/colored-markdown-view.component';
import {AuthTabsComponent} from '../../components/auth-tabs/auth-tabs.component';
import {
  AppStatusNotificationComponent
} from '../../components/app-status-notification/app-status-notification.component';
import {DebugPanelComponent} from '../../components/debug-panel/debug-panel.component';
import {TeamSelectorComponent} from '../../components/team-selector/team-selector.component';
import {TeamRoleComponent} from '../../components/team-role/team-role.component';
import {TeamInvitationsComponent} from '../../components/team-invitations/team-invitations.component';
import {
  ConflictData,
  ConflictResolutionComponent
} from '../../components/conflict-resolution/conflict-resolution.component';
import {Team, TeamRole} from '../../models/team.model';
import {InvitationStatus} from '../../models/team-invitation.model';
import {VersionControlService} from '../../services/version-control.service';
import {TeamService} from '../../services/team.service';
import {UserInvitationsComponent} from '../../components/user-invitations/user-invitations.component';
import {MlContextMenuComponent, MlAction} from '../../components/ml-context-menu/ml-context-menu.component';
import {ImageUploaderComponent, ImageUploadResult} from '../../components/image-uploader/image-uploader.component';

@Component({
  selector: 'app-note-app-layout',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ColoredMarkdownViewComponent,
    AuthTabsComponent,
    AppStatusNotificationComponent,
    DebugPanelComponent,
    TeamSelectorComponent,
    TeamRoleComponent,
    TeamInvitationsComponent,
    ConflictResolutionComponent,
    UserInvitationsComponent,
    MlContextMenuComponent,
    ImageUploaderComponent,
  ],
  templateUrl: './note-app-layout.component.html',
  styleUrls: ['./note-app-layout.component.css']
})
export class NoteAppLayoutComponent implements OnInit, OnDestroy {
  @ViewChild(MlContextMenuComponent) mlContextMenu!: MlContextMenuComponent;
  @ViewChild('previewContainer') previewContainer!: ElementRef;

  markdownContent: string = '';
  isLeftSidebarOpen: boolean = true;
  isRightSidebarOpen: boolean = false;
  isAuthModalOpen: boolean = false;
  isDebugPanelOpen: boolean = false;
  activeTabIndex: number = 0;
  viewMode: 'split' | 'editor' | 'preview' = 'split';

  // Subject for debounced content change events
  private contentChangeSubject = new Subject<string>();
  // Separate content for preview that updates with debounce
  previewContent: string = '';

  /** Configuration for image uploads */
  imageUploaderConfig = {
    maxEmbeddedSize: 300 * 1024, // 300KB max for embedded images
    alwaysEmbed: true // Always embed to simplify implementation
  };

  /**
   * Map of image placeholders to their actual base64 content
   * Used to replace friendly placeholders with actual base64 data when saving
   */
  private imageReplacements: Record<string, string> = {};

  /**
   * Storage key prefix for large images
   * Used to store large base64 strings in localStorage to prevent memory issues
   */
  private readonly IMAGE_STORAGE_PREFIX = 'laminotes_img_';

  /**
   * Store image data in localStorage to avoid memory issues with large base64 strings
   * @param data The data to store (typically a base64 string)
   * @returns A storage reference in the format '@storage:key'
   */
  private storeImageInLocalStorage(data: string): string {
    // Generate a unique storage key
    const storageKey = `${this.IMAGE_STORAGE_PREFIX}${Date.now()}_${Math.floor(Math.random() * 10000)}`;

    try {
      // Store data in localStorage
      localStorage.setItem(storageKey, data);
      console.log(`Stored image in localStorage: ${storageKey.substring(0, 30)}... (${Math.round(data.length / 1024)}KB)`);

      // Return a reference to the stored data
      return `@storage:${storageKey}`;
    } catch (error) {
      console.error('Failed to store image in localStorage:', error);
      // If storage fails, return the original data
      return data;
    }
  }

  /**
   * Retrieve image data from localStorage
   * @param reference Storage reference in the format '@storage:key'
   * @returns The stored data, or a placeholder if retrieval fails
   */
  private retrieveImageFromLocalStorage(reference: string): string {
    if (!reference.startsWith('@storage:')) {
      return reference; // Not a storage reference
    }

    const storageKey = reference.substring(9); // Remove '@storage:' prefix

    try {
      const data = localStorage.getItem(storageKey);
      if (!data) {
        console.warn(`Image storage key not found: ${storageKey}`);
        return `![Image not found](preview-placeholder)`;
      }
      return data;
    } catch (error: any) {
      console.error('Failed to retrieve image from localStorage:', error);
      const errorMessage = error?.message || 'Unknown error';
      console.warn(`Error retrieving image from localStorage: ${errorMessage}`);
      return `![Error loading image](preview-placeholder)`;
    }
  }

  // ML and context menu related properties
  private editorElement!: HTMLTextAreaElement;
  private touchStartTime: number = 0;
  private longPressTimeout: any = null;
  private isTouchMoved: boolean = false;

  // Team-related properties
  currentTeam: Team | null = null;
  currentTeamRole: TeamRole = TeamRole.Contributor; // default to viewer
  showTeamManagement: boolean = false;
  isTeamOwner: boolean = false;
  showUserInvitations: boolean = false;
  hasPendingInvitations: boolean = false;

  // Conflict resolution
  conflictData: ConflictData | null = null;

  // Tab-specific properties
  currentTabView: 'recents' | 'notes' | 'shared' = 'notes';
  recentFiles: FileInfo[] = [];
  allFiles: FileInfo[] = [];
  sharedFiles: FileInfo[] = [];

  // Teams data for UI
  teams: Team[] = [];
  teamRoles: Record<string, TeamRole> = {};
  pendingInvitationsPreview: any[] = [];

  // User colors for collaborative editing visualization
  userColors: Record<string, string> = {
    'user1': '#3498db',
    'user2': '#e74c3c',
    'user3': '#2ecc71'
  };

  // Status messages for operations
  statusMessage: string = '';
  isLoading: boolean = false;

  // Notification data
  notification: { message: string, type: 'success' | 'error' | 'info' | 'warning' } | null = null;
  private notificationSubscription: Subscription;

  constructor(
    public fileService: FileService,
    private authService: AuthService,
    private metadataService: MetadataService,
    private notificationService: NotificationService,
    private teamService: TeamService,
    private versionControl: VersionControlService,
    private invitationService: InvitationService,
    private electronService: ElectronService,
    private mlService: MlService
  ) {
    this.notificationSubscription = this.notificationService.notifications$.subscribe(
      notification => {
        this.notification = notification;
      }
    );

    // Set up debounced content changes to improve performance with images
    this.contentChangeSubject.pipe(
      debounceTime(800), // Wait 800ms after last input before updating (increased from 300ms)
      distinctUntilChanged() // Only process distinct changes
    ).subscribe(content => {
      // Process images for preview with debounce to avoid performance issues
      this.previewContent = this.processImagesForPreview(content);
    });
  }

  /**
   * Clear old storage items to prevent quota issues
   */
  private cleanupLocalStorage(): void {
    try {
      // Get all keys in localStorage
      const allKeys = Object.keys(localStorage);

      // Find keys related to image storage and sort by creation time
      const imageKeys = allKeys.filter(key =>
        key.startsWith('laminotes_img_') ||
        key.startsWith('image_data_')
      ).sort();

      // If we have more than 10 image keys, remove the oldest ones
      if (imageKeys.length > 10) {
        console.log(`Cleaning up ${imageKeys.length - 10} old image storage items`);

        // Keep the 10 most recent keys (which will be at the end of the array)
        const keysToRemove = imageKeys.slice(0, imageKeys.length - 10);

        // Remove the oldest keys
        keysToRemove.forEach(key => {
          try {
            localStorage.removeItem(key);
          } catch (e) {
            console.error(`Failed to remove key ${key}:`, e);
          }
        });

        console.log(`Removed ${keysToRemove.length} old storage items`);
      }
    } catch (error) {
      console.error('Error cleaning up localStorage:', error);
    }
  }

  ngOnInit(): void {
    // Clean up old storage to prevent quota issues
    this.cleanupLocalStorage();

    // Try to restore active team first, which might set directories
    this.teamService.activeTeam$.subscribe(team => {
      this.currentTeam = team;
      if (team) {
        // First validate team directory if in Electron environment
        if (this.electronService.isElectron()) {
          const teamDir = this.teamService.getTeamDirectory(team.id);
          if (teamDir) {
            console.log(`Validating team directory on init: ${teamDir}`);
            this.electronService.checkFileExists(teamDir).subscribe(exists => {
              if (!exists) {
                console.warn(`Team directory ${teamDir} not found during initialization`);
                // Don't show notification yet, the file service will handle it when refreshing
              }
            });
          }
        }

        this.fetchTeamRole(team.id);

        // If team directory is set, this will use it
        this.fileService.refreshFileList();
      } else {
        // Reset role when no team is active
        this.currentTeamRole = TeamRole.Viewer;
        this.isTeamOwner = false;

        // Refresh files for personal context
        this.fileService.refreshFileList();
      }
    });

    // Check authentication state
    this.authService.isAuthenticated().subscribe(isAuthenticated => {
      if (isAuthenticated) {
        this.checkForPendingInvitations();
      }
    });

    // Check if a working directory has been set
    if (!this.fileService.currentDirectory && this.electronService.isElectron()) {
      // Prompt user to select a base directory if none is set
      this.promptForBaseDirectory();
    } else if (this.fileService.filesInDirectory.length > 0) {
      this.openFile(this.fileService.filesInDirectory[0]);
    }

    // Initialize the files for each tab view
    this.loadAllNotes(); // Load immediately since 'notes' is the default tab
  }

  // Add method to prompt for base directory
  promptForBaseDirectory(): void {
    // Show message to let user know they need to select a base directory
    this.notificationService.info('Please select a base directory for your notes');

    // Open directory selector
    setTimeout(() => this.selectDirectory(), 500);
  }

  toggleTeamManagement(): void {
    this.showTeamManagement = !this.showTeamManagement;
  }

  onConflictResolved(resolvedContent: string): void {
    if (!this.conflictData) return;

    this.isLoading = true;
    this.statusMessage = 'Saving resolved content...';

    this.saveResolvedContent(this.conflictData.fileId, resolvedContent);
  }

  onConflictCancelled(): void {
    this.conflictData = null;
    this.notificationService.info('Conflict resolution cancelled');
  }

  saveResolvedContent(fileId: string, content: string): void {
    // If using file service directly
    this.markdownContent = content;
    this.fileService.saveFile(content).subscribe({
      next: () => {
        this.conflictData = null;
        this.isLoading = false;
        this.statusMessage = '';
        this.notificationService.success('Conflicts resolved and file saved');
      },
      error: (error) => {
        this.isLoading = false;
        this.statusMessage = '';
        this.notificationService.error(`Error saving resolved file: ${error.message}`);
      }
    });
  }

  ngOnDestroy(): void {
    if (this.notificationSubscription) {
      this.notificationSubscription.unsubscribe();
    }

    // Clean up our content change subject
    this.contentChangeSubject.complete();
  }

  toggleLeftSidebar(): void {
    this.isLeftSidebarOpen = !this.isLeftSidebarOpen;
  }

  toggleRightSidebar(): void {
    this.isRightSidebarOpen = !this.isRightSidebarOpen;
  }

  openAuthModal(): void {
    this.isAuthModalOpen = true;
  }

  closeAuthModal(): void {
    this.isAuthModalOpen = false;
  }

  selectDirectory(): void {
    this.isLoading = true;
    this.statusMessage = 'Selecting directory...';

    this.fileService.selectDirectory().subscribe(dirPath => {
      this.isLoading = false;
      this.statusMessage = '';

      if (dirPath) {
        this.notificationService.success(`Directory selected: ${dirPath}`);
        // After selecting a directory, clear the current file list and show only files in the selected directory
        this.markdownContent = ''; // Clear current content
        this.fileService.currentFile = null; // Clear current file reference
        this.loadAllNotes(); // Refresh the file list from the new directory
      }
    });
  }

  openFile(file: FileInfo): void {
    this.isLoading = true;
    this.statusMessage = `Opening ${file.name}...`;

    this.fileService.openFile(file).subscribe({
      next: (content) => {
        // Process content to convert base64 images to friendly placeholders for editing
        this.markdownContent = this.processImagesForEditing(content);

        // Initialize preview content immediately for the newly opened file
        this.previewContent = this.processImagesForPreview(this.markdownContent);

        this.isLoading = false;
        this.statusMessage = '';
        this.notificationService.info(`Opened ${file.name}`);
      },
      error: (error) => {
        console.error('Error opening file:', error);
        this.isLoading = false;
        this.statusMessage = '';
        this.notificationService.error(`Error opening file: ${error.message}`);
      }
    });
  }

  saveCurrentFile(): void {
    if (!this.markdownContent) {
      this.notificationService.info('Nothing to save');
      return;
    }

    this.isLoading = true;
    this.statusMessage = 'Processing images...';

    // First, clean up storage to avoid quota issues
    this.fileService.cleanupStorage().subscribe(() => {
      // After cleanup, process the images for saving
      // For documents with just one image, we can optimize by doing direct replacement
      if (Object.keys(this.imageReplacements).length <= 1) {
        // Fast path for simple documents
        let contentToSave = this.markdownContent;

        // Simple direct substitution for single image
        for (const [placeholder, replacement] of Object.entries(this.imageReplacements)) {
          if (contentToSave.includes(placeholder)) {
            contentToSave = contentToSave.replace(placeholder, replacement);
          }
        }

        this.statusMessage = 'Saving file...';
        this.continueFileSave(contentToSave);
      } else {
        // For documents with multiple images, use the async processing approach
        this.processImagesForSavingAsync(this.markdownContent).subscribe({
          next: (contentToSave) => {
            this.statusMessage = 'Saving file...';
            this.continueFileSave(contentToSave);
          },
          error: (error) => {
            console.error('Error processing images for save:', error);
            this.isLoading = false;
            this.statusMessage = '';
            this.notificationService.error(`Error processing images: ${error.message || 'Unknown error'}`);
          }
        });
      }
    });
  }

  /**
   * Continue file save after image processing is complete
   * This is extracted to a separate method to support asynchronous image processing
   */
  private continueFileSave(contentToSave: string): void {

    // Check if we're running in Electron
    const isElectron = this.electronService.isElectron();
    console.log(`Saving file in ${isElectron ? 'Electron' : 'browser'} mode`);

    if (isElectron) {
      // Check if we're in a team context
      const activeTeam = this.teamService.activeTeam;
      const currentFile = this.fileService.currentFile;
      const hasUUIDPath = currentFile?.path && /^[0-9a-f]{8}-[0-9a-f]{4}/.test(currentFile.path);

      // In team context, always make sure we have a team directory
      if (activeTeam) {
        console.log(`Saving in team context: ${activeTeam.name}`);

        // Get team directory if set
        let teamDirectory = this.teamService.getTeamDirectory(activeTeam.id);

        // If team directory is not set, prompt user to select one
        if (!teamDirectory) {
          console.log('No team directory set for team, prompting for selection');
          this.notificationService.info(`Please select a local directory for team "${activeTeam.name}"`);

          // First select directory
          this.electronService.selectDirectory().subscribe({
            next: result => {
              if (result.success && result.dirPath) {
                console.log(`Selected team directory: ${result.dirPath}`);
                teamDirectory = result.dirPath;

                // Set it as the team directory
                this.teamService.setTeamDirectory(activeTeam, teamDirectory as string).subscribe(() => {
                  console.log(`Team directory set to: ${teamDirectory}`);

                  // Now try saving again with the new directory
                  setTimeout(() => this.saveCurrentFile(), 500);
                });
              } else {
                this.notificationService.warning('File save cancelled - no team directory selected');
                this.isLoading = false;
                this.statusMessage = '';
              }
            },
            error: err => {
              console.error('Error selecting directory:', err);
              this.notificationService.error('Failed to select team directory');
              this.isLoading = false;
              this.statusMessage = '';
            }
          });
          return;
        }

        // If team directory is set, use it
        if (teamDirectory && currentFile) {
          console.log(`Using team directory for save: ${teamDirectory}`);

          // Ensure file has proper path in team directory
          const fileName = currentFile.name || 'untitled.md';

          // Use path.join if available
          let savePath: string;
          try {
            // Try to use native path module if available
            const nodePath = (window as any).require('path');
            savePath = nodePath.join(teamDirectory, fileName);
          } catch (e) {
            // Fallback to simple concatenation
            savePath = `${teamDirectory}/${fileName}`;
          }

          console.log(`Saving to team path: ${savePath}`);

          // IMPORTANT: Always use proper file path with team directory
          this.fileService.saveFile(contentToSave, savePath, false).subscribe({
            next: () => {
              this.isLoading = false;
              this.statusMessage = '';
              this.notificationService.success('File saved successfully');
              // Refresh to make sure the file is visible in directory
              this.loadAllNotes();
            },
            error: (error) => {
              console.error('Error saving file:', error);
              this.isLoading = false;
              this.statusMessage = '';
              this.notificationService.error(`Error saving file: ${error.message}`);
            }
          });
          return;
        }
      }

      // If we have a current directory set and we're in a file (not team context), force save to that directory
      if (this.fileService.currentDirectory && currentFile) {
        console.log(`Using directory-based save to: ${this.fileService.currentDirectory}/${currentFile.name}`);

        // Construct proper path with current directory
        const savePath = this.fileService.currentDirectory + '/' + currentFile.name;

        this.fileService.saveFile(contentToSave, savePath, false).subscribe({
          next: () => {
            this.isLoading = false;
            this.statusMessage = '';
            this.notificationService.success('File saved successfully');
            // Refresh to make sure the file is visible in directory
            this.loadAllNotes();
          },
          error: (error) => {
            console.error('Error saving file:', error);
            this.isLoading = false;
            this.statusMessage = '';
            this.notificationService.error(`Error saving file: ${error.message}`);
          }
        });
        return;
      }

      // If we don't have a proper directory or file path is a UUID, use saveAs dialog
      const shouldUseSaveAs = !currentFile || !currentFile.path || hasUUIDPath;

      // Default filename from current file if available
      let defaultFilename = currentFile?.name || 'untitled.md';

      if (shouldUseSaveAs) {
        console.log('Using saveAs for first save or UUID-path file:',
          currentFile?.path || 'no current file');
      }

      // Use the Electron saveAs directly if needed
      if (shouldUseSaveAs) {
        this.electronService.saveFile(contentToSave, defaultFilename, true).subscribe({
          next: () => {
            // The save succeeded
            this.isLoading = false;
            this.statusMessage = '';
            this.notificationService.success('File saved successfully');
            this.loadAllNotes();
          },
          error: (error) => {
            console.error('Error in saveAs:', error);
            this.isLoading = false;
            this.statusMessage = '';
            this.notificationService.error(`Error saving file: ${error.message}`);
          }
        });
      } else {
        // Use normal save for subsequent saves of a file with a real path
        this.fileService.saveFile(contentToSave, currentFile.path, false).subscribe({
          next: () => {
            this.isLoading = false;
            this.statusMessage = '';
            this.notificationService.success('File saved successfully');
            // Refresh after save to ensure file list is updated
            this.loadAllNotes();
          },
          error: (error) => {
            console.error('Error saving file:', error);
            this.isLoading = false;
            this.statusMessage = '';
            this.notificationService.error(`Error saving file: ${error.message}`);
          }
        });
      }
    } else {
      // Browser mode - use normal save
      this.fileService.saveFile(contentToSave).subscribe({
        next: () => {
          this.isLoading = false;
          this.statusMessage = '';
          this.notificationService.success('File saved successfully');

          // Make sure the file list is refreshed if this was a new file
          this.loadAllNotes();
        },
        error: (error) => {
          console.error('Error saving file:', error);
          this.isLoading = false;
          this.statusMessage = '';
          this.notificationService.error(`Error saving file: ${error.message}`);
        }
      });
    }
  }

  addNewFile(): void {
    // First prompt for file name
    if (this.electronService.isElectron()) {
      this.electronService.showPrompt('New Note', 'Enter file name (without extension):', 'Untitled').subscribe(fileName => {
        if (fileName) {
          this.createNewFileWithName(fileName);
        }
      });
    } else {
      // Browser fallback
      const fileName = window.prompt('Enter file name (without extension):', 'Untitled');
      if (fileName) {
        this.createNewFileWithName(fileName);
      }
    }
  }

  // Helper method to create a file with a specified name
  private createNewFileWithName(fileName: string): void {
    this.isLoading = true;
    this.statusMessage = `Creating new file ${fileName}...`;

    // Add .md extension if it's not already there
    if (!fileName.endsWith('.md')) {
      fileName = `${fileName}.md`;
    }

    // Check if we're in a team context and need to verify team directory
    const activeTeam = this.teamService.activeTeam;

    if (activeTeam && this.electronService.isElectron()) {
      // Check if the team has a directory set
      const teamDirectory = this.teamService.getTeamDirectory(activeTeam.id);

      if (!teamDirectory) {
        this.notificationService.info(`Please select a local directory for team "${activeTeam.name}"`);

        this.electronService.selectDirectory().subscribe({
          next: result => {
            if (result.success && result.dirPath) {
              // Set the directory for the team
              this.teamService.setTeamDirectory(activeTeam, result.dirPath).subscribe(() => {
                // After setting directory, proceed with file creation
                this.notificationService.success(`Set local directory for team "${activeTeam.name}": ${result.dirPath}`);
                this.continueCreateFile(fileName);
              });
            } else {
              this.notificationService.warning('Team directory selection cancelled. File will be created in default location.');
              this.continueCreateFile(fileName);
            }
          },
          error: err => {
            console.error('Error selecting team directory:', err);
            this.notificationService.error('Failed to select team directory');
            this.isLoading = false;
            this.statusMessage = '';
          }
        });
        return;
      }
    }

    // If not in a team or team already has a directory, proceed with file creation
    this.continueCreateFile(fileName);
  }

  // Helper method to continue file creation after team directory checks
  private continueCreateFile(fileName: string): void {
    this.fileService.addNewFile(fileName, '').subscribe({
      next: () => {
        // Refresh list and open the new file
        this.fileService.refreshFileList();
        const newFile = this.fileService.filesInDirectory[this.fileService.filesInDirectory.length - 1];
        this.openFile(newFile);

        // Set the new file as the active tab
        this.activeTabIndex = this.fileService.filesInDirectory.length - 1;
        // Update allFiles for the Notes tab
        this.loadAllNotes();
        this.isLoading = false;
        this.statusMessage = '';

        // In Electron mode with a directory, immediately save to disk
        if (this.electronService.isElectron() && this.fileService.currentDirectory) {
          console.log('New file created - saving to disk immediately');
          this.saveCurrentFile();
        } else {
          this.notificationService.success(`File "${fileName}" created`);
        }
      },
      error: (error) => {
        console.error('Error creating new file:', error);
        this.isLoading = false;
        this.statusMessage = '';
        this.notificationService.error(`Error creating file: ${error.message}`);
      }
    });
  }

  renameFile(file: FileInfo): void {
    // Use Electron's showPrompt if available, otherwise use a simple approach
    if (this.electronService.isElectron()) {
      this.electronService.showPrompt('Rename File', 'Enter new file name:', file.name).subscribe(newName => {
        if (newName && newName !== file.name) {
          this.doRenameFile(file, newName);
        }
      });
    } else {
      // Fallback for browser (should never be used in Electron)
      const newName = window.prompt('Enter new file name:', file.name);
      if (newName && newName !== file.name) {
        this.doRenameFile(file, newName);
      }
    }
  }

  private doRenameFile(file: FileInfo, newName: string): void {
    this.isLoading = true;
    this.statusMessage = `Renaming file to ${newName}...`;

    this.fileService.renameFile(file, newName).subscribe({
      next: () => {
        // If in Electron mode with a directory and file doesn't exist on disk yet,
        // save it after renaming to ensure it's on disk
        if (this.electronService.isElectron() && this.fileService.currentDirectory) {
          // Get the renamed file from the file list
          const renamedFile = this.fileService.filesInDirectory.find(f => f.name === newName);

          if (renamedFile) {
            console.log('Saving renamed file to disk:', renamedFile.path);
            // Set as current file and save it to disk
            this.fileService.currentFile = renamedFile;

            // Save the file to disk
            this.saveCurrentFile();
          }
        }

        this.fileService.refreshFileList();
        // Also update allFiles for the Notes tab
        this.loadAllNotes();

        this.isLoading = false;
        this.statusMessage = '';
        this.notificationService.success(`File renamed to ${newName}`);
      },
      error: (error) => {
        console.error('Error renaming file:', error);
        this.isLoading = false;
        this.statusMessage = '';
        this.notificationService.error(`Error renaming file: ${error.message}`);
      }
    });
  }

  onEditorChange(event: Event): void {
    const newContent = (event.target as HTMLTextAreaElement).value;
    this.markdownContent = newContent;

    // Feed the content to our debounced subject instead of processing immediately
    this.contentChangeSubject.next(newContent);
  }

  /**
   * Handles right-click context menu in the editor
   * @param event The mouse event
   */
  onEditorContextMenu(event: MouseEvent): void {
    // Store reference to editor element
    this.editorElement = event.target as HTMLTextAreaElement;

    // Get selected text
    const selectedText = this.getSelectedText();

    if (selectedText) {
      // Prevent default context menu
      event.preventDefault();
      event.stopPropagation();

      // Show ML context menu
      this.mlContextMenu.show(event.clientX, event.clientY, selectedText);
    }
  }

  /**
   * Handles touchstart event (for mobile long-press context menu)
   * @param event The touch event
   */
  onEditorTouchStart(event: TouchEvent): void {
    // Store reference to editor element
    this.editorElement = event.target as HTMLTextAreaElement;

    this.touchStartTime = Date.now();
    this.isTouchMoved = false;

    // Set up long-press detection
    this.longPressTimeout = setTimeout(() => {
      if (!this.isTouchMoved) {
        const selectedText = this.getSelectedText();

        if (selectedText) {
          // Get touch position
          const touch = event.touches[0];

          // Show ML context menu at touch position
          this.mlContextMenu.show(touch.clientX, touch.clientY, selectedText);
        }
      }
    }, 700); // 700ms for long press
  }

  /**
   * Handles touch move events (to cancel long-press detection if moved)
   * @param event The touch event
   */
  onEditorTouchMove(): void {
    this.isTouchMoved = true;
  }

  /**
   * Handles touch end events (to clear long-press timeout)
   * @param event The touch event
   */
  onEditorTouchEnd(event: TouchEvent): void {
    clearTimeout(this.longPressTimeout);
  }

  /**
   * Handles mouseup events (to detect selected text on desktop)
   */
  onEditorMouseUp(event: MouseEvent): void {
    // Store reference to editor element
    this.editorElement = event.target as HTMLTextAreaElement;
  }

  /**
   * Gets selected text from the editor
   * @returns The selected text or empty string
   */
  private getSelectedText(): string {
    if (!this.editorElement) return '';

    const start = this.editorElement.selectionStart;
    const end = this.editorElement.selectionEnd;

    if (start !== end) {
      return this.editorElement.value.substring(start, end);
    }

    return '';
  }

  /**
   * Handles selected ML actions from the context menu
   * @param action The ML action to perform
   */
  onMlActionSelected(action: MlAction): void {
    this.notificationService.info(`Processing ${action.type} request...`);

    switch (action.type) {
      case 'reformat':
        this.processReformatAction(action.text);
        break;
      case 'code':
        this.processCodeAction(action.text);
        break;
      case 'mermaid':
        this.processMermaidAction(action.text);
        break;
    }
  }

  /**
   * Handles reformatting text
   * @param text The text to reformat
   */
  private processReformatAction(text: string): void {
    this.mlService.reformatText(text).subscribe({
      next: (reformattedText) => {
        // Replace the selected text with the reformatted text
        this.replaceSelectedTextWith(reformattedText);
        this.notificationService.success('Text reformatted');
      },
      error: (error) => {
        console.error('Error reformatting text:', error);
        this.notificationService.error('Failed to reformat text: ' + error.message);
      }
    });
  }

  /**
   * Handles code generation
   * @param text The text description for code generation
   */
  private processCodeAction(text: string): void {
    this.mlService.generateCode(text).subscribe({
      next: (codeBlock) => {
        // Insert code block after the selected text
        this.insertAfterSelectedText('\n\n' + codeBlock + '\n');
        this.notificationService.success('Code generated');
      },
      error: (error) => {
        console.error('Error generating code:', error);
        this.notificationService.error('Failed to generate code: ' + error.message);
      }
    });
  }

  /**
   * Handles mermaid diagram creation
   * @param text The text description for diagram creation
   */
  private processMermaidAction(text: string): void {
    this.mlService.createMermaidDiagram(text).subscribe({
      next: (mermaidBlock) => {
        // Insert mermaid diagram after the selected text
        this.insertAfterSelectedText('\n\n' + mermaidBlock + '\n');
        this.notificationService.success('Diagram created');
      },
      error: (error) => {
        console.error('Error creating diagram:', error);
        this.notificationService.error('Failed to create diagram: ' + error.message);
      }
    });
  }

  /**
   * Replaces the selected text in the editor
   * @param newText The new text to replace the selection
   */
  private replaceSelectedTextWith(newText: string): void {
    if (!this.editorElement) return;

    const start = this.editorElement.selectionStart;
    const end = this.editorElement.selectionEnd;
    const currentText = this.editorElement.value;

    // Replace the selected text
    const updatedText = currentText.substring(0, start) + newText + currentText.substring(end);
    this.markdownContent = updatedText;

    // Update cursor position
    setTimeout(() => {
      this.editorElement.focus();
      this.editorElement.setSelectionRange(start + newText.length, start + newText.length);
    }, 0);
  }

  /**
   * Inserts text after the selected text in the editor
   * @param textToInsert The text to insert
   */
  private insertAfterSelectedText(textToInsert: string): void {
    if (!this.editorElement) return;

    const end = this.editorElement.selectionEnd;
    const currentText = this.editorElement.value;

    // Insert after the selected text
    const updatedText = currentText.substring(0, end) + textToInsert + currentText.substring(end);
    this.markdownContent = updatedText;

    // Update cursor position
    setTimeout(() => {
      this.editorElement.focus();
      this.editorElement.setSelectionRange(end + textToInsert.length, end + textToInsert.length);
    }, 0);
  }

  /**
   * Handles context menu close events
   */
  onMlContextMenuClosed(): void {
    // Optional: handle any cleanup needed after menu closes
  }

  /**
   * Handles image upload results from the ImageUploader component.
   * Inserts a user-friendly placeholder in the editor, while storing the actual
   * base64 image data for saving and rendering.
   *
   * @param result - The image upload result containing the markdown text to insert
   */
  handleImageUpload(result: ImageUploadResult): void {
    if (!this.editorElement) {
      console.error('Editor element not found');
      return;
    }

    // Get current cursor position
    const cursorPosition = this.editorElement.selectionStart;
    const currentText = this.markdownContent;

    // Insert the friendly placeholder in the editor
    this.markdownContent =
      currentText.substring(0, cursorPosition) +
      '\n\n' + result.markdownText + '\n\n' +
      currentText.substring(cursorPosition);

    // Store the actual content with base64 data
    if (result.actualContent) {
      // Simply store the mapping between placeholder and actual content
      this.imageReplacements[result.markdownText] = result.actualContent;

      // Trigger a debounced preview update to show the image
      this.contentChangeSubject.next(this.markdownContent);

      console.log(`Image placeholder created for ${Math.round(result.file.size / 1024)}KB image`);
    }

    // Update cursor position after the inserted image
    setTimeout(() => {
      this.editorElement.focus();
      const newPosition = cursorPosition + result.markdownText.length + 4; // Account for newlines
      this.editorElement.setSelectionRange(newPosition, newPosition);
    }, 0);

    this.notificationService.success(
      `Image added (${Math.round(result.file.size / 1024)}KB)`
    );
  }

  isAuthenticated(): Observable<boolean> {
    return this.authService.isAuthenticated();
  }

  // Methods to handle tab interactions
  closeTab(index: number): void {
    // Logic to close a tab
    if (this.fileService.filesInDirectory.length > 1) {
      const fileToClose = this.fileService.filesInDirectory[index];

      // Implement logic to close the file
      console.log('Closing tab:', fileToClose.name);

      // If the closed tab is the active one, switch to another tab
      if (index === this.activeTabIndex) {
        // Switch to the previous tab if available, otherwise the next one
        const newIndex = index > 0 ? index - 1 : 0;
        this.switchTab(newIndex);
      } else if (index < this.activeTabIndex) {
        // If we're closing a tab before the active one, adjust the active index
        this.activeTabIndex--;
      }

      // TODO: implement file saving and deleting
    }
  }

  switchTab(index: number): void {
    if (index >= 0 && index < this.fileService.filesInDirectory.length) {
      this.activeTabIndex = index;
      this.openFile(this.fileService.filesInDirectory[index]);
    }
  }

  changeViewMode(mode: 'split' | 'editor' | 'preview'): void {
    this.viewMode = mode;
  }

  // Tab navigation
  switchTabView(view: 'recents' | 'notes' | 'shared'): void {
    this.currentTabView = view;

    // Implement tab view logic based on the selected tab
    switch (view) {
      case 'recents':
        this.loadRecentFiles();
        break;
      case 'notes':
        this.loadAllNotes();
        break;
      case 'shared':
        this.loadSharedNotes();
        break;
    }
  }

  // Methods for loading different types of notes
  private loadRecentFiles(): void {
    this.fileService.loadRecentFiles().subscribe({
      next: (files) => {
        this.recentFiles = files;
      },
      error: (error) => {
        console.error('Error loading recent files:', error);
        this.notificationService.error(`Error loading recent files: ${error.message}`);
      }
    });
  }

  // Permission check methods
  canEditTeamFiles(): boolean {
    if (!this.currentTeam) return true; // Personal files can always be edited
    return this.currentTeamRole >= TeamRole.Contributor;
  }

  canManageTeam(): boolean {
    return this.isTeamOwner;
  }

  canInviteMembers(): boolean {
    return this.currentTeamRole >= TeamRole.Contributor;
  }

  openInviteDialog(): void {
    if (!this.canInviteMembers()) {
      this.notificationService.error('You need contributor or owner permissions to invite team members');
      return;
    }

    // Implementation depends on your app's structure
    this.notificationService.info('Opening invite dialog...');
    // Your invite dialog logic here
  }

  private loadAllNotes(): void {
    this.fileService.refreshFileList();
    this.allFiles = this.fileService.filesInDirectory;
  }

  createNewFolder(): void {
    // Use Electron's showPrompt if available
    if (this.electronService.isElectron()) {
      this.electronService.showPrompt('New Folder', 'Enter folder name:').subscribe(folderName => {
        if (folderName) {
          this.doCreateFolder(folderName);
        }
      });
    } else {
      // Fallback for browser
      const folderName = window.prompt('Enter folder name:');
      if (folderName) {
        this.doCreateFolder(folderName);
      }
    }
  }

  private doCreateFolder(folderName: string): void {
    this.isLoading = true;
    this.statusMessage = `Creating folder ${folderName}...`;

    // Check if we're in a team context and need to verify team directory
    const activeTeam = this.teamService.activeTeam;

    if (activeTeam && this.electronService.isElectron()) {
      // Check if the team has a directory set
      const teamDirectory = this.teamService.getTeamDirectory(activeTeam.id);

      if (!teamDirectory) {
        // We need to prompt the user to select a directory for the team first
        this.notificationService.info(`Please select a local directory for team "${activeTeam.name}" before creating folders`);

        this.electronService.selectDirectory().subscribe({
          next: result => {
            if (result.success && result.dirPath) {
              // Set the directory for the team
              this.teamService.setTeamDirectory(activeTeam, result.dirPath).subscribe(() => {
                // After setting directory, proceed with folder creation
                this.notificationService.success(`Set local directory for team "${activeTeam.name}": ${result.dirPath}`);
                this.continueCreateFolder(folderName);
              });
            } else {
              this.notificationService.warning('Team directory selection cancelled. Folder creation aborted.');
              this.isLoading = false;
              this.statusMessage = '';
            }
          },
          error: err => {
            console.error('Error selecting team directory:', err);
            this.notificationService.error('Failed to select team directory');
            this.isLoading = false;
            this.statusMessage = '';
          }
        });
        return;
      }
    }

    // If not in a team or team already has a directory, proceed with folder creation
    this.continueCreateFolder(folderName);
  }

  // Helper method to continue folder creation after team directory checks
  private continueCreateFolder(folderName: string): void {
    this.fileService.addDirectory(folderName).subscribe({
      next: () => {
        this.isLoading = false;
        this.statusMessage = '';
        this.notificationService.success(`Folder "${folderName}" created`);

        // Clear the file content since we're in a new empty directory
        this.markdownContent = '';
        this.loadAllNotes(); // Refresh the file list to show empty directory
      },
      error: (error) => {
        console.error('Error creating folder:', error);
        this.isLoading = false;
        this.statusMessage = '';
        this.notificationService.error(`Error creating folder: ${error.message}`);
      }
    });
  }


  private loadSharedNotes(): void {
    // Load teams
    this.teamService.getUserTeams().subscribe({
      next: (teams) => {
        this.teams = teams;

        // Get role for each team
        teams.forEach(team => {
          this.teamService.getUserRoleInTeam(team.id).subscribe(role => {
            this.teamRoles[team.id] = role;
          });
        });
      },
      error: (error) => {
        console.error('Error loading teams:', error);
        this.notificationService.error(`Error loading teams: ${error.message}`);
      }
    });

    // Load shared files (mock data for now, TODO: implement sharing API)
    const mockSharedFiles = [
      {
        name: 'Project Plan.md',
        owner: 'Jane Smith',
        lastModified: Date.now() - 86400000, // 1 day ago
        path: 'shared/project-plan.md',
        content: '# Project Plan\n\nThis is a shared document...'
      },
      {
        name: 'Meeting Notes.md',
        owner: 'John Doe',
        lastModified: Date.now() - 172800000, // 2 days ago
        path: 'shared/meeting-notes.md',
        content: '# Meeting Notes\n\nAttendees: John, Jane, Bob...'
      }
    ];

    this.sharedFiles = mockSharedFiles;

    // Load invitation previews (mock data for now, TODO: implement invitation API)
    if (this.authService.isAuthenticated()) {
      // Mock invitations for UI testing
      const mockInvitations = [
        {
          id: '1',
          team_id: 'team1',
          team_name: 'Design Team',
          invited_email: 'currentuser@example.com',
          invited_by_email: 'john@example.com',
          role: TeamRole.Contributor,
          status: InvitationStatus.Pending,
          created_at: new Date().toISOString()
        }
      ];

      this.pendingInvitationsPreview = mockInvitations;
      this.hasPendingInvitations = mockInvitations.length > 0;
    }
  }

  checkForPendingInvitations(): void {
    if (this.authService.isAuthenticated()) {
      this.invitationService.getMyInvitations().subscribe({
        next: (invitations) => {
          // Check if there are any pending invitations
          this.hasPendingInvitations = invitations.some(
            inv => inv.status === InvitationStatus.Pending
          );
        },
        error: (error) => {
          console.error('Error checking invitations:', error);
        }
      });
    }
  }

  toggleUserInvitations(): void {
    this.showUserInvitations = !this.showUserInvitations;
    if (this.showUserInvitations) {
      // Close other panels when opening invitations
      this.isRightSidebarOpen = false;
      this.isDebugPanelOpen = false;
    }
  }

  onInvitationAccepted(): void {
    this.showUserInvitations = false;
    this.hasPendingInvitations = false;
  }

  // Helper methods
  // Team management methods
  getInitials(name: string): string {
    return name.split(' ').map(word => word[0]).join('').substring(0, 2).toUpperCase();
  }

  teamAvatarColor(team: Team): string {
    // Generate a consistent color based on team ID
    const hash = team.id.split('').reduce((acc, char) => {
      return ((acc << 5) - acc) + char.charCodeAt(0);
    }, 0);

    // Use the hash to generate a hue value (0-360)
    const hue = Math.abs(hash % 360);

    // Return HSL color with fixed saturation and lightness
    return `hsl(${hue}, 70%, 50%)`;
  }

  getTeamRoleClass(team: Team): string {
    const role = this.teamRoles[team.id] || TeamRole.Viewer;
    switch (role) {
      case TeamRole.Owner:
        return 'role-owner';
      case TeamRole.Contributor:
        return 'role-contributor';
      case TeamRole.Viewer:
        return 'role-viewer';
      default:
        return '';
    }
  }

  getTeamRoleName(team: Team): string {
    const role = this.teamRoles[team.id] || TeamRole.Viewer;
    switch (role) {
      case TeamRole.Owner:
        return 'Owner';
      case TeamRole.Contributor:
        return 'Contributor';
      case TeamRole.Viewer:
        return 'Viewer';
      default:
        return 'Unknown';
    }
  }

  isOwner(team: Team): boolean {
    return this.teamRoles[team.id] === TeamRole.Owner;
  }

  canInvite(team: Team): boolean {
    return this.teamRoles[team.id] >= TeamRole.Contributor;
  }

  openCreateTeam(): void {
    // To be implemented with a dialog service
    this.notificationService.info('Opening team creation dialog...');
  }

  manageTeam(team: Team): void {
    // To be implemented with a dialog service
    this.notificationService.info(`Managing team: ${team.name}`);
  }

  inviteToTeam(team: Team): void {
    // To be implemented with a dialog service
    this.notificationService.info(`Inviting to team: ${team.name}`);
  }

  switchToTeam(team: Team): void {
    this.teamService.setActiveTeam(team).subscribe(success => {
      if (success) {
        this.notificationService.success(`Switched to team: ${team.name}`);
        this.switchTabView('notes');
      }
    });
  }

  // This method is now handled by the user-invitations component directly
  // Keeping this stub for compatibility
  processInvitation(invitation: any, accept: boolean): void {
    console.log('Delegating invitation processing to user-invitations component');

    // The actual processing is now handled by the user-invitations component
    // which ensures consistent invitation handling throughout the app
  }

  // Helper for working with roles in invitations
  getInvitationRoleName(role: TeamRole): string {
    switch (role) {
      case TeamRole.Owner:
        return 'Owner';
      case TeamRole.Contributor:
        return 'Contributor';
      case TeamRole.Viewer:
        return 'Viewer';
      default:
        return 'Unknown';
    }
  }

  getRelativeTime(timestamp: number | undefined): string {
    if (!timestamp) return 'Just now';

    const now = Date.now();
    const diff = now - timestamp;

    // Convert to appropriate time unit
    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days > 0) {
      return `${days} day${days > 1 ? 's' : ''} ago`;
    } else if (hours > 0) {
      return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    } else if (minutes > 0) {
      return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    } else {
      return 'Just now';
    }
  }

  openFileAndSwitchToNotes(file: FileInfo): void {
    this.openFile(file);
    this.switchTabView('notes');
  }

  // Operations for the Options panel
  uploadAllFiles(): void {
    // First check if we're in a team context and have appropriate permissions
    const activeTeam = this.teamService.activeTeam;

    if (activeTeam) {
      this.isLoading = true;
      this.statusMessage = 'Checking team permissions...';

      this.teamService.getUserRoleInTeam(activeTeam.id).subscribe({
        next: (role) => {
          if (role < TeamRole.Contributor) {
            this.isLoading = false;
            this.statusMessage = '';
            this.notificationService.error(`You need Contributor or Owner permissions to upload files to the ${activeTeam.name} team.`);
            return;
          }

          // If we have sufficient permissions, proceed with upload
          this.performUpload();
        },
        error: (error) => {
          this.isLoading = false;
          this.statusMessage = '';
          this.notificationService.error(`Error checking team permissions: ${error.message}`);
        }
      });
    } else {
      // For personal files, no permission check needed
      this.performUpload();
    }
  }

  // Helper method to perform the actual upload
  private performUpload(): void {
    this.isLoading = true;
    this.statusMessage = 'Uploading all files...';

    this.fileService.uploadAllFiles().subscribe({
      next: () => {
        this.isLoading = false;
        this.statusMessage = '';
        this.notificationService.success('All files uploaded successfully');
      },
      error: (error) => {
        console.error('Error uploading files:', error);
        this.isLoading = false;
        this.statusMessage = '';
        this.notificationService.error(`Error uploading files: ${error.message}`);
      }
    });
  }

  downloadAllFiles(): void {
    this.isLoading = true;
    this.statusMessage = 'Downloading all files...';

    // Check in a team context
    const activeTeam = this.teamService.activeTeam;

    if (activeTeam && this.electronService.isElectron()) {
      console.log(`Downloading files for team: ${activeTeam.name}`);
      this.statusMessage = `Downloading files for team: ${activeTeam.name}...`;
    }

    this.fileService.downloadAllFiles().subscribe({
      next: () => {
        this.isLoading = false;
        this.statusMessage = '';
        this.loadAllNotes(); // Refresh the files list

        // Show team-specific success message if relevant
        if (activeTeam) {
          const teamDir = this.teamService.getTeamDirectory(activeTeam.id);
          if (teamDir) {
            this.notificationService.success(`Files downloaded to team directory: ${teamDir}`);
          } else {
            this.notificationService.success('All files downloaded successfully');
          }
        } else {
          this.notificationService.success('All files downloaded successfully');
        }
      },
      error: (error) => {
        console.error('Error downloading files:', error);
        this.isLoading = false;
        this.statusMessage = '';

        // Special handling for team directory selection cancellation
        if (error.message === 'Team directory selection cancelled') {
          this.notificationService.warning('Download cancelled - No team directory selected');
        } else {
          this.notificationService.error(`Error downloading files: ${error.message}`);
        }
      }
    });
  }

  /**
   * Processes markdown content for saving, replacing image placeholders
   * with actual base64 data.
   *
   * @param content - The markdown content with image placeholders
   * @returns Processed content with actual image data
   */
  /**
   * Process images for saving asynchronously to avoid stack overflow
   * with large base64 strings
   *
   * @param content - The markdown content with image placeholders
   * @returns Observable that emits the processed content
   */
  private processImagesForSavingAsync(content: string): Observable<string> {
    if (!content || Object.keys(this.imageReplacements).length === 0) {
      return of(content); // No replacements needed
    }

    // Handle each image replacement one at a time
    return new Observable<string>(observer => {
      try {
        console.log(`Processing ${Object.keys(this.imageReplacements).length} image replacements`);

        // Find all placeholders and their indices
        const placeholders: {text: string, index: number}[] = [];

        // Pattern to match our image placeholders
        const placeholderPattern = /!\[.*?\]\(IMAGE:[^)]+\)/g;
        let match;
        let searchContent = content;

        // Find all placeholders in the content
        while ((match = placeholderPattern.exec(searchContent)) !== null) {
          const placeholder = match[0];

          // Only include placeholders that have replacements
          if (this.imageReplacements[placeholder]) {
            placeholders.push({
              text: placeholder,
              index: match.index
            });
          }
        }

        // If no valid placeholders found, return original content
        if (placeholders.length === 0) {
          observer.next(content);
          observer.complete();
          return;
        }

        // Sort placeholders in reverse order by index to maintain indices when replacing
        placeholders.sort((a, b) => b.index - a.index);

        // Process one placeholder at a time
        let currentIndex = 0;
        let processedContent = content;

        // Function to process each placeholder
        const processNextPlaceholder = () => {
          // If we're done, emit the result
          if (currentIndex >= placeholders.length) {
            observer.next(processedContent);
            observer.complete();
            return;
          }

          // Get the current placeholder
          const placeholder = placeholders[currentIndex];
          this.statusMessage = `Processing image ${currentIndex + 1}/${placeholders.length}...`;

          // Get the replacement
          const replacement = this.imageReplacements[placeholder.text];

          try {
            // Replace the placeholder with actual content using substring operations
            // This is much safer than regex for large strings
            const beforePlaceholder = processedContent.substring(0, placeholder.index);
            const afterPlaceholder = processedContent.substring(placeholder.index + placeholder.text.length);
            processedContent = beforePlaceholder + replacement + afterPlaceholder;

            // Move to next placeholder in the next tick
            currentIndex++;
            setTimeout(processNextPlaceholder, 0);
          } catch (err) {
            console.error('Error replacing placeholder:', err);
            // Continue with next placeholder even if this one fails
            currentIndex++;
            setTimeout(processNextPlaceholder, 0);
          }
        };

        // Start processing
        setTimeout(processNextPlaceholder, 0);
      } catch (error) {
        console.error('Error setting up image processing:', error);
        observer.error(error);
      }
    });
  }

  /**
   * Legacy synchronous version - kept for fallback
   * @deprecated Use processImagesForSavingAsync instead
   */
  private processImagesForSaving(content: string): string {
    if (!content || Object.keys(this.imageReplacements).length === 0) {
      return content; // No replacements needed
    }

    let processedContent = content;

    // Replace all placeholders with their actual base64 content
    for (const [placeholder, actualContent] of Object.entries(this.imageReplacements)) {
      processedContent = processedContent.replace(placeholder, actualContent);
    }

    return processedContent;
  }

  /**
   * Processes markdown content for editing, replacing base64 images
   * with user-friendly placeholders.
   *
   * @param content - The markdown content with base64 images
   * @returns Processed content with user-friendly placeholders
   */
  private processImagesForEditing(content: string): string {
    if (!content) {
      return content;
    }

    // Clear existing replacements to avoid memory leaks when opening a new file
    this.imageReplacements = {};

    // Define a maximum size for base64 processing (helps prevent stack overflow)
    const MAX_SAFE_LENGTH = 500000; // ~500KB of text

    // For very large content, use a different approach
    if (content.length > MAX_SAFE_LENGTH) {
      console.log('Using safe chunked approach for content:', content.length);

      // Process in chunks - find all image markdown patterns first
      const imgMatches = [];
      // Simplified pattern first to identify image tags
      const imgPattern = /!\[.*?\]\(data:image\//g;

      let match;
      let searchStartPos = 0;

      // First pass: find all potential image matches
      while ((match = imgPattern.exec(content.substring(searchStartPos))) !== null) {
        const matchStart = searchStartPos + match.index;

        // Find the closing parenthesis for this image tag
        const startPos = matchStart;
        const closingParenPos = this.findClosingParen(content, startPos);

        if (closingParenPos !== -1) {
          // Extract the full match
          const fullMatch = content.substring(startPos, closingParenPos + 1);

          // Extract alt text and data URL more carefully
          const altTextMatch = /!\[(.*?)\]\(/.exec(fullMatch);
          const altText = altTextMatch ? altTextMatch[1] : '';

          // Only process if it looks like a base64 image
          if (fullMatch.includes('data:image/') && fullMatch.includes('base64,')) {
            imgMatches.push({
              fullMatch,
              index: startPos,
              length: closingParenPos - startPos + 1,
              altText,
              startPos,
              endPos: closingParenPos
            });
          }
        }

        // Move search position forward
        searchStartPos = matchStart + 5; // Move past '![alt'
      }

      console.log(`Found ${imgMatches.length} image matches to process`);

      // Process matches in reverse order (to maintain index positions)
      let processedContent = content;
      for (let i = imgMatches.length - 1; i >= 0; i--) {
        const item = imgMatches[i];

        // Extract the data from the full match (safer approach)
        const fullImageTag = item.fullMatch;

        try {
          // Simple size estimation - works even with very large images
          // Just extract a portion of the data URL to estimate size
          const dataUrlSample = fullImageTag.substring(
            fullImageTag.indexOf('data:image/'),
            Math.min(fullImageTag.length - 1, fullImageTag.indexOf('data:image/') + 2000)
          );

          // Make a rough size estimation
          const isLargeImage = fullImageTag.length > 50000;
          const fileSizeKB = isLargeImage ?
            Math.round(fullImageTag.length / 1000) : // approximation for large images
            Math.round(fullImageTag.length * 0.75 / 1000); // more accurate for smaller images

          const fileName = item.altText || 'image.png';

          // Create placeholder text
          const placeholder = `![${item.altText}](IMAGE:${fileSizeKB}KB:${fileName})`;

          // Store the replacement for later use when saving
          this.imageReplacements[placeholder] = fullImageTag;

          // Replace in the content
          processedContent =
            processedContent.substring(0, item.index) +
            placeholder +
            processedContent.substring(item.index + item.length);

        } catch (e) {
          console.error('Error processing image at index', item.index, e);
          // Skip this image if there's an error
        }
      }

      return processedContent;
    }

    // For smaller content, use the original regex approach (with safety check)
    let processedContent;
    try {
      // Use the original regex replacement method for smaller content
      processedContent = content.replace(/!\[(.*?)\]\((data:image\/[^;]+;base64,[^)]+)\)/g, (fullMatch, altText, dataUrl) => {
        // Calculate approximate size from data URL (accounting for encoding overhead)
        const fileSize = Math.round((dataUrl.length * 3) / 4);
        const fileSizeKB = Math.round(fileSize / 1024);
        const fileName = altText || 'image.png';

        // Create placeholder text
        const placeholder = `![${altText}](IMAGE:${fileSizeKB}KB:${fileName})`;

        // Store the replacement for later use when saving
        this.imageReplacements[placeholder] = `![${altText}](${dataUrl})`;

        return placeholder;
      });
    } catch (e) {
      console.error('Error in regex processing, falling back to simple approach', e);
      // Fallback to no processing if regex throws
      return content;
    }

    return processedContent;
  }

  // Helper method to find a closing parenthesis, handling nested parentheses correctly
  private findClosingParen(str: string, startPos: number): number {
    let depth = 0;
    let parenStart = str.indexOf('(', startPos);
    if (parenStart === -1) return -1;

    for (let i = parenStart; i < str.length; i++) {
      if (str[i] === '(') {
        depth++;
      } else if (str[i] === ')') {
        if (--depth === 0) {
          return i;
        }
      }
    }
    return -1; // No matching closing parenthesis
  }

  /**
   * Processes markdown content for preview, replacing user-friendly placeholders
   * with the actual base64 images for rendering.
   *
   * @param content - The markdown content with image placeholders
   * @returns Processed content with real image data for preview
   */
  /**
   * Add cleanup method to avoid memory leaks from old image references
   */
  private cleanupImageReplacements(): void {
    // If we have too many stored replacements, check which ones are still used
    if (Object.keys(this.imageReplacements).length > 20) { // Reasonable threshold
      const usedPlaceholders = new Set<string>();

      // Find all placeholders in current content
      const placeholderPattern = /!\[.*?\]\(IMAGE:[^)]+\)/g;
      let match;

      while ((match = placeholderPattern.exec(this.markdownContent)) !== null) {
        usedPlaceholders.add(match[0]);
      }

      // Create new map with only the placeholders still in use
      const newReplacements: Record<string, string> = {};
      for (const placeholder of usedPlaceholders) {
        if (this.imageReplacements[placeholder]) {
          newReplacements[placeholder] = this.imageReplacements[placeholder];
        }
      }

      // Replace the map with cleaned version
      this.imageReplacements = newReplacements;
      console.log(`Cleaned up image replacements: ${Object.keys(this.imageReplacements).length} remaining`);
    }
  }

  /**
   * Processes markdown content for preview, replacing user-friendly placeholders
   * with the actual base64 images for rendering.
   *
   * @param content - The markdown content with image placeholders
   * @returns Processed content with real image data for preview
   */
  processImagesForPreview(content: string): string {
    if (!content) {
      return content;
    }

    // Add a simple check to avoid processing if no replacements needed
    if (Object.keys(this.imageReplacements).length === 0 && !content.includes('IMAGE:')) {
      return content;
    }

    let processedContent = content;

    // Only process a limited number of images to prevent performance issues
    const replacementEntries = Object.entries(this.imageReplacements);
    const MAX_PREVIEW_IMAGES = 3; // Limit to just a few images for maximum performance

    // Process only a subset of images for preview
    const imagesToProcess = replacementEntries.slice(0, MAX_PREVIEW_IMAGES);

    for (const [placeholder, replacement] of imagesToProcess) {
      if (processedContent.includes(placeholder)) {
        // Regular replacement for all content
        processedContent = processedContent.replace(placeholder, replacement);
      }
    }

    // Then handle any remaining placeholders
    processedContent = processedContent.replace(/!\[(.*?)\]\(IMAGE:(\d+)KB:(.*?)\)/g, (match, altText, size, fileName) => {
      // Check if we have a replacement that we've already processed
      if (imagesToProcess.some(([p]) => p === match)) {
        return match; // Already processed above
      }

      // For any remaining placeholders, use a simple placeholder
      return `![${fileName}](preview-placeholder)`;
    });

    return processedContent;
  }

  /**
   * Old method - kept for reference
   * @deprecated
   */
  private oldProcessImagesForPreview(content: string): string {
    if (!content) {
      return content;
    }

    // Add a simple check to avoid processing if no replacements needed
    if (Object.keys(this.imageReplacements).length === 0 && !content.includes('IMAGE:')) {
      return content;
    }

    // Special handling for Electron environment
    const isElectron = this.electronService.isElectron();

    // Periodically clean up unused replacements to reduce memory usage
    this.cleanupImageReplacements();

    let processedContent = content;

    // Handle exceedingly large content more carefully
    const MAX_SAFE_LENGTH = 500000; // ~500KB threshold - same as in editing
    if (processedContent.length > MAX_SAFE_LENGTH) {
      console.log('Using safe preview approach for very large content:', processedContent.length);

      // For very large content, use a simplified approach for previews
      // Convert all image placeholders to simple preview placeholders
      return processedContent.replace(/!\[(.*?)\]\(IMAGE:(\d+)KB:(.*?)\)/g,
        (match, altText, size, fileName) => `![${fileName}](preview-placeholder)`);
    }

    // Process replacements with a limit if there are many
    const replacementEntries = Object.entries(this.imageReplacements);
    // Fewer images for Electron preview to maintain performance
    const MAX_PREVIEW_IMAGES = isElectron ? 5 : 10;

    if (replacementEntries.length > MAX_PREVIEW_IMAGES) {
      console.log(`Limiting preview to ${MAX_PREVIEW_IMAGES} images for performance (Electron: ${isElectron})`);
      // Process only a subset of images for preview to maintain performance
      const importantReplacements = replacementEntries.slice(0, MAX_PREVIEW_IMAGES);

      for (const [placeholder, actualContent] of importantReplacements) {
        if (processedContent.includes(placeholder)) {
          // Handle potential Electron large image indirection
          if (isElectron && actualContent.includes(')') && !actualContent.includes('data:image/')) {
            // Check if this is a reference to localStorage
            const imageIdMatch = /!\[.*?\]\((img_\d+_\d+)\)/.exec(actualContent);
            if (imageIdMatch && imageIdMatch[1]) {
              const imageId = imageIdMatch[1];
              try {
                // Try to retrieve from localStorage
                const storedImage = localStorage.getItem(`image_data_${imageId}`);
                if (storedImage) {
                  // Use localStorage content
                  console.log(`Retrieved large image ${imageId} from localStorage for preview`);
                  processedContent = processedContent.replace(placeholder, storedImage);
                } else {
                  // Fall back to placeholder if not in localStorage
                  processedContent = processedContent.replace(placeholder, `![${placeholder}](preview-placeholder)`);
                }
              } catch (e) {
                console.warn(`Error retrieving image from localStorage: ${(e as any)?.message || 'Unknown error'}`);
                processedContent = processedContent.replace(placeholder, `![${placeholder}](preview-placeholder)`);
              }
            } else {
              // Regular replacement
              processedContent = processedContent.replace(placeholder, actualContent);
            }
          } else {
            // Regular replacement for normal content
            processedContent = processedContent.replace(placeholder, actualContent);
          }
        }
      }

      // Convert all remaining placeholders to simple preview placeholders
      processedContent = processedContent.replace(/!\[(.*?)\]\(IMAGE:(\d+)KB:(.*?)\)/g, (match, altText, size, fileName) => {
        // Skip if already processed
        if (!match.includes('IMAGE:')) return match;

        // Check if we've already processed this one
        const foundMatch = this.imageReplacements[match];
        if (foundMatch && importantReplacements.some(([p]) => p === match)) {
          return foundMatch;
        }

        // Use preview placeholder for the rest
        return `![${fileName}](preview-placeholder)`;
      });
    } else {
      // For fewer images, we can process them all more carefully

      // First replace known placeholders
      for (const [placeholder, replacement] of replacementEntries) {
        if (processedContent.includes(placeholder)) {
          // Handle storage indirection if needed
          let actualContent = replacement;

          if (replacement && replacement.startsWith('@storage:')) {
            // Use our utility method to retrieve from localStorage
            actualContent = this.retrieveImageFromLocalStorage(replacement);
          }

          // Special handling for Electron large image indirection
          if (isElectron && actualContent.includes(')') && !actualContent.includes('data:image/')) {
            // Check if this is a reference to localStorage
            const imageIdMatch = /!\[.*?\]\((img_\d+_\d+)\)/.exec(actualContent);
            if (imageIdMatch && imageIdMatch[1]) {
              const imageId = imageIdMatch[1];
              try {
                // Try to retrieve from localStorage
                const storedImage = localStorage.getItem(`image_data_${imageId}`);
                if (storedImage) {
                  // Use localStorage content
                  console.log(`Retrieved large image ${imageId} from localStorage for preview`);
                  processedContent = processedContent.replace(placeholder, storedImage);
                } else {
                  // Fall back to placeholder
                  processedContent = processedContent.replace(
                    placeholder,
                    `![${placeholder.split('(')[0].substring(2)}](preview-placeholder)`
                  );
                }
              } catch (e) {
                console.warn(`Error retrieving image from localStorage: ${(e as any)?.message || 'Unknown error'}`);
                processedContent = processedContent.replace(
                  placeholder,
                  `![${placeholder.split('(')[0].substring(2)}](preview-placeholder)`
                );
              }
            } else {
              // Regular replacement
              processedContent = processedContent.replace(placeholder, actualContent);
            }
          } else {
            // Regular replacement
            processedContent = processedContent.replace(placeholder, actualContent);
          }
        }
      }

      // Then handle any remaining placeholders
      processedContent = processedContent.replace(/!\[(.*?)\]\(IMAGE:(\d+)KB:(.*?)\)/g, (match, altText, size, fileName) => {
        // Check if we have a replacement
        const replacement = this.imageReplacements[match];

        // Handle storage indirection for newly added images
        if (replacement && replacement.startsWith('@storage:')) {
          // Use our utility method to retrieve from localStorage
          return this.retrieveImageFromLocalStorage(replacement);
        }

        if (replacement) {
          // Same special handling for Electron large images
          if (isElectron && replacement.includes(')') && !replacement.includes('data:image/')) {
            const imageIdMatch = /!\[.*?\]\((img_\d+_\d+)\)/.exec(replacement);
            if (imageIdMatch && imageIdMatch[1]) {
              const imageId = imageIdMatch[1];
              try {
                const storedImage = localStorage.getItem(`image_data_${imageId}`);
                if (storedImage) return storedImage;
              } catch (e) {
                console.warn(`Error retrieving image from localStorage: ${(e as any)?.message || 'Unknown error'}`);
              }
              return `![${fileName}](preview-placeholder)`;
            }
          }
          return replacement;
        }

        // If not, use a placeholder
        return `![${fileName}](preview-placeholder)`;
      });
    }

    return processedContent;
  }

  private fetchTeamRole(teamId: string): void {
    if (!teamId) return;

    this.isLoading = true;
    this.statusMessage = 'Checking permissions...';

    this.teamService.getUserRoleInTeam(teamId).subscribe({
      next: (role) => {
        this.currentTeamRole = role;
        this.isTeamOwner = role === TeamRole.Owner;
        console.log(`Current role in team: ${TeamRole[role]}`);
        this.isLoading = false;
        this.statusMessage = '';
      },
      error: (error) => {
        console.error('Error fetching team role:', error);
        // Default to contributor on error to avoid blocking users
        this.currentTeamRole = TeamRole.Contributor;
        this.isTeamOwner = false;
        this.isLoading = false;
        this.statusMessage = '';
        this.notificationService.warning('Could not verify your team permissions');
      }
    });
  }


  toggleDebugPanel(): void {
    this.isDebugPanelOpen = !this.isDebugPanelOpen;
  }

  logout(): void {
    this.authService.logout().subscribe({
      next: () => {
        this.notificationService.info('Logged out successfully');
      }
    });
  }


  deleteFile(file: FileInfo): void {
    if (confirm(`Are you sure you want to delete ${file.name}?`)) {
      this.isLoading = true;
      this.statusMessage = `Deleting ${file.name}...`;

      this.fileService.deleteFile(file).subscribe({
        next: () => {
          // Refresh the file list display immediately after deletion
          this.allFiles = this.fileService.filesInDirectory;

          // If deleted file was current file, open another one
          if (this.fileService.currentFile && this.fileService.currentFile.path === file.path) {
            if (this.fileService.filesInDirectory.length > 0) {
              this.openFile(this.fileService.filesInDirectory[0]);
            } else {
              this.markdownContent = '';
              this.fileService.currentFile = null;
            }
          }

          this.isLoading = false;
          this.statusMessage = '';
          this.notificationService.success(`File ${file.name} deleted`);
        },
        error: (error) => {
          console.error('Error deleting file:', error);
          this.isLoading = false;
          this.statusMessage = '';
          this.notificationService.error(`Error deleting file: ${error.message}`);
        }
      });
    }};
}
