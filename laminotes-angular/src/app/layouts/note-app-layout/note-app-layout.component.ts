import {Component, OnDestroy, OnInit} from '@angular/core';
import {CommonModule} from '@angular/common';
import {FormsModule} from '@angular/forms';
import {Observable, Subscription} from 'rxjs';

import {FileInfo, FileService} from '../../services/file.service';
import {AuthService} from '../../services/auth.service';
import {MetadataService} from '../../services/metadata.service';
import {NotificationService} from '../../services/notification.service';
import {InvitationService} from '../../services/invitation.service';
import { ElectronService } from '../../services/electron.service';

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
  ],
  templateUrl: './note-app-layout.component.html',
  styleUrls: ['./note-app-layout.component.css']
})
export class NoteAppLayoutComponent implements OnInit, OnDestroy {
  markdownContent: string = '';
  isLeftSidebarOpen: boolean = true;
  isRightSidebarOpen: boolean = false;
  isAuthModalOpen: boolean = false;
  isDebugPanelOpen: boolean = false;
  activeTabIndex: number = 0;
  viewMode: 'split' | 'editor' | 'preview' = 'split';

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
    private electronService: ElectronService
  ) {
    this.notificationSubscription = this.notificationService.notifications$.subscribe(
      notification => {
        this.notification = notification;
      }
    );
  }

  ngOnInit(): void {
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
        this.markdownContent = content;
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
    this.statusMessage = 'Saving file...';

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
          this.fileService.saveFile(this.markdownContent, savePath, false).subscribe({
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
        
        this.fileService.saveFile(this.markdownContent, savePath, false).subscribe({
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
        this.electronService.saveFile(this.markdownContent, defaultFilename, true).subscribe({
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
        this.fileService.saveFile(this.markdownContent, currentFile.path, false).subscribe({
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
      this.fileService.saveFile(this.markdownContent).subscribe({
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
        // We need to prompt the user to select a directory for the team
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
    this.markdownContent = (event.target as HTMLTextAreaElement).value;
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
  
  processInvitation(invitation: any, accept: boolean): void {
    if (accept) {
      this.invitationService.acceptInvitation(invitation.id).subscribe({
        next: () => {
          this.notificationService.success(`Accepted invitation to ${invitation.team_name}`);
          // Refresh the invitations and teams
          this.loadSharedNotes();
        },
        error: (error) => {
          this.notificationService.error(`Error accepting invitation: ${error.message}`);
        }
      });
    } else {
      this.invitationService.declineInvitation(invitation.id).subscribe({
        next: () => {
          this.notificationService.info(`Declined invitation to ${invitation.team_name}`);
          // Refresh the invitations list
          this.loadSharedNotes();
        },
        error: (error) => {
          this.notificationService.error(`Error declining invitation: ${error.message}`);
        }
      });
    }
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
    
    // Check if we're in a team context
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
