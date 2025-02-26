import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Observable, of } from 'rxjs';
import { delay } from 'rxjs/operators';

import { FileService, FileInfo } from '../../services/file.service';
import { AuthService } from '../../services/auth.service';

import { ColoredMarkdownViewComponent } from '../../components/colored-markdown-view/colored-markdown-view.component';
import { AuthTabsComponent } from '../../components/auth-tabs/auth-tabs.component';

@Component({
  selector: 'app-note-app-layout',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ColoredMarkdownViewComponent,
    AuthTabsComponent
  ],
  templateUrl: './note-app-layout.component.html',
  styleUrls: ['./note-app-layout.component.css']
})
export class NoteAppLayoutComponent implements OnInit {
  markdownContent: string = '';
  isLeftSidebarOpen: boolean = true;
  isRightSidebarOpen: boolean = false;
  isAuthModalOpen: boolean = false;
  activeTabIndex: number = 0;
  viewMode: 'split' | 'editor' | 'preview' = 'split';

  // Tab-specific properties
  currentTabView: 'recents' | 'notes' | 'shared' = 'notes';
  recentFiles: FileInfo[] = [];
  allFiles: FileInfo[] = [];
  sharedFiles: FileInfo[] = [];

  // Mock organizations
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

  constructor(
    public fileService: FileService,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    // Check if there are any files already, if not add a welcome file
    if (this.fileService.filesInDirectory.length > 0) {
      this.openFile(this.fileService.filesInDirectory[0]);
    }

    // Initialize the files for each tab view
    this.loadAllNotes(); // Load immediately since 'notes' is the default tab
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
    // For browser-only version, we'll just refresh the file list
    this.fileService.refreshFileList();
  }

  openFile(file: FileInfo): void {
    this.fileService.openFile(file).subscribe({
      next: (content) => {
        this.markdownContent = content;
      },
      error: (error) => console.error('Error opening file:', error)
    });
  }

  saveCurrentFile(): void {
    if (this.markdownContent) {
      this.fileService.saveFile(this.markdownContent).subscribe({
        next: () => {
          console.log('File saved successfully');
        },
        error: (error) => console.error('Error saving file:', error)
      });
    }
  }

  addNewFile(): void {
    this.fileService.addNewFile('Untitled.md', '').subscribe({
      next: () => {
        // Refresh list and open the new file
        this.fileService.refreshFileList();
        const newFile = this.fileService.filesInDirectory[this.fileService.filesInDirectory.length - 1];
        this.openFile(newFile);

        // Set the new file as the active tab
        this.activeTabIndex = this.fileService.filesInDirectory.length - 1;

        // Also update allFiles for the Notes tab
        this.loadAllNotes();
      },
      error: (error) => console.error('Error creating new file:', error)
    });
  }

  renameFile(file: FileInfo): void {
    // This would typically have a dialog to get the new name
    // For simplicity, we're using a prompt here
    const newName = prompt('Enter new file name:', file.name);

    if (newName && newName !== file.name) {
      this.fileService.renameFile(file, newName).subscribe({
        next: () => {
          this.fileService.refreshFileList();
          // Also update allFiles for the Notes tab
          this.loadAllNotes();
        },
        error: (error) => console.error('Error renaming file:', error)
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

      // Here you would also need to remove the file from filesInDirectory
      // and potentially save/delete it depending on your app requirements
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
    // Mock data for recent files - replace with actual implementation
    this.fileService.loadRecentFiles().subscribe({
      next: (files) => {
        this.recentFiles = files;
        // Add mock lastModified values for demo purposes
        this.recentFiles.forEach(file => {
          if (!file.lastModified) {
            file.lastModified = Date.now() - Math.floor(Math.random() * 7 * 24 * 60 * 60 * 1000);
          }
        });
      },
      error: (error) => console.error('Error loading recent files:', error)
    });
  }

  private loadAllNotes(): void {
    this.fileService.refreshFileList();
    this.allFiles = this.fileService.filesInDirectory;
  }

  private loadSharedNotes(): void {
    // Mock data for shared files - replace with actual implementation
    this.fileService.loadSharedFiles().subscribe({
      next: (files) => {
        this.sharedFiles = files;
        // Add mock owner info for demo purposes
        this.sharedFiles.forEach(file => {
          if (!file.owner) {
            const owners = ['John Doe', 'Jane Smith', 'Alex Johnson'];
            file.owner = owners[Math.floor(Math.random() * owners.length)];
          }
        });
      },
      error: (error) => console.error('Error loading shared files:', error)
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
}
