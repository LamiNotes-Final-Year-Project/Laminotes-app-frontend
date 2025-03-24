import {Component, OnDestroy, OnInit} from '@angular/core';
import {CommonModule} from '@angular/common';
import {FormsModule} from '@angular/forms';
import {Observable, Subscription} from 'rxjs';

import {FileInfo, FileService} from '../../services/file.service';
import {AuthService} from '../../services/auth.service';
import {MetadataService} from '../../services/metadata.service';
import {NotificationService} from '../../services/notification.service';

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
import {VersionControlService} from '../../services/version-control.service';
import {TeamService} from '../../services/team.service';


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

  // Conflict resolution
  conflictData: ConflictData | null = null;


  // Tab-specific properties
  currentTabView: 'recents' | 'notes' | 'shared' = 'notes';
  recentFiles: FileInfo[] = [];
  allFiles: FileInfo[] = [];
  sharedFiles: FileInfo[] = [];

  // Mock organizations TODO: implement full organisation sync
  organizations: any[] = [
    { name: 'Design Team', memberCount: 8, color: '#3498db' },
    { name: 'Marketing', memberCount: 12, color: '#e74c3c' },
    { name: 'Development', memberCount: 15, color: '#2ecc71' }
  ];

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
  ) {
    this.notificationSubscription = this.notificationService.notifications$.subscribe(
      notification => {
        this.notification = notification;
      }
    );
  }

  ngOnInit(): void {
    // Checks if there are any files already
    this.fileService.refreshFileList();

    if (this.fileService.filesInDirectory.length > 0) {
      this.openFile(this.fileService.filesInDirectory[0]);
    }

    // Initialize the files for each tab view
    this.loadAllNotes(); // Load immediately since 'notes' is the default tab

    this.teamService.activeTeam$.subscribe(team => {
      this.currentTeam = team;
      if (team) {
        this.teamService.getUserRoleInTeam(team.id).subscribe(role => {
          this.currentTeamRole = role;
          this.isTeamOwner = role === TeamRole.Owner;
        });
      }
    });
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
    this.fileService.selectDirectory().subscribe(() => {
      this.fileService.refreshFileList();
      this.allFiles = this.fileService.filesInDirectory;
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

    this.fileService.saveFile(this.markdownContent).subscribe({
      next: () => {
        this.isLoading = false;
        this.statusMessage = '';
        this.notificationService.success('File saved successfully');
      },
      error: (error) => {
        console.error('Error saving file:', error);
        this.isLoading = false;
        this.statusMessage = '';
        this.notificationService.error(`Error saving file: ${error.message}`);
      }
    });
  }

  addNewFile(): void {
    this.isLoading = true;
    this.statusMessage = 'Creating new file...';

    this.fileService.addNewFile('Untitled.md', '').subscribe({
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
        this.notificationService.success('New file created');
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
    const newName = prompt('Enter new file name:', file.name);

    if (newName && newName !== file.name) {
      this.isLoading = true;
      this.statusMessage = `Renaming file to ${newName}...`;

      this.fileService.renameFile(file, newName).subscribe({
        next: () => {
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

  private loadAllNotes(): void {
    this.fileService.refreshFileList();
    this.allFiles = this.fileService.filesInDirectory;
  }

  private loadSharedNotes(): void {
    this.fileService.loadSharedFiles().subscribe({
      next: (files) => {
        this.sharedFiles = files;
      },
      error: (error) => {
        console.error('Error loading shared files:', error);
        this.notificationService.error(`Error loading shared files: ${error.message}`);
      }
    });
  }

  // Helper methods
  getOrgInitials(name: string): string {
    return name.split(' ').map(word => word[0]).join('').substring(0, 2).toUpperCase();
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

    this.fileService.downloadAllFiles().subscribe({
      next: () => {
        this.isLoading = false;
        this.statusMessage = '';
        this.loadAllNotes(); // Refresh the files list
        this.notificationService.success('All files downloaded successfully');
      },
      error: (error) => {
        console.error('Error downloading files:', error);
        this.isLoading = false;
        this.statusMessage = '';
        this.notificationService.error(`Error downloading files: ${error.message}`);
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
}
