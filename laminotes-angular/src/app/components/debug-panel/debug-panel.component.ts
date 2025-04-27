import { Component, OnInit, EventEmitter, Output } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { FileService } from '../../services/file.service';
import { NotificationService } from '../../services/notification.service';
import { AuthService } from '../../services/auth.service';
import { ApiService } from '../../services/api.service';
import { BehaviorSubject, of } from 'rxjs';
import { catchError, finalize, switchMap, tap } from 'rxjs/operators';
import { User } from '../../models/user.model';
import { InvitationService } from '../../services/invitation.service';
import { TeamService } from '../../services/team.service';
import {Team, TeamRole} from '../../models/team.model'

@Component({
  selector: 'app-debug-panel',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="debug-panel">
      <div class="debug-header">
        <h3>Debug Panel</h3>
        <button class="close-button" (click)="closePanel()">×</button>
      </div>

      <div class="debug-body">
        <div class="section">
          <h4>Connection Status</h4>
          <div class="status-indicator" [class.connected]="isConnected" [class.disconnected]="!isConnected">
            {{ isConnected ? 'Connected to server' : 'Not connected' }}
          </div>
          <button class="debug-btn" (click)="testConnection()">Test Connection</button>
        </div>

        <div class="section">
          <h4>Auth Status</h4>
          <div class="status-indicator" [class.connected]="isAuthenticated" [class.disconnected]="!isAuthenticated">
            {{ isAuthenticated ? 'Authenticated' : 'Not authenticated' }}
          </div>
          <div *ngIf="isAuthenticated">
            <p>Login status: Logged in</p>
          </div>
          <div class="btn-group">
            <button class="debug-btn" (click)="logAuthStatus()" [disabled]="operationInProgress">
              Check Auth Token
            </button>
            <button class="debug-btn" (click)="checkFilePaths()" [disabled]="operationInProgress">
              Check File Paths
            </button>
          </div>
        </div>

        <div class="section">
          <h4>File Operations</h4>
          <input #fileNameInput placeholder="Enter filename (e.g., test.md)" class="text-input">
          <div class="btn-group">
            <button class="debug-btn" (click)="uploadSingleFile()" [disabled]="operationInProgress">
              Debug Upload Selected File
            </button>
            <button class="debug-btn" (click)="downloadSingleFile(fileNameInput.value)" [disabled]="operationInProgress">
              Debug Download File
            </button>
          </div>
        </div>

        <div class="section">
          <h4>Local Files</h4>
          <div class="file-list">
            <div *ngFor="let file of fileService.filesInDirectory" class="file-item">
              <span>{{ file.name }}</span>
              <button class="debug-btn small" (click)="uploadSingleFileByName(file)" [disabled]="operationInProgress">Upload</button>
            </div>
            <div *ngIf="fileService.filesInDirectory.length === 0" class="empty-message">
              No local files
            </div>
          </div>
          <button class="debug-btn" (click)="createTestInvitation()">Create Test Invitation</button>
        </div>

        <div class="section">
          <h4>Log</h4>
          <div class="log">
            <div *ngFor="let entry of logEntries" class="log-entry" [class]="entry.level">
              {{ entry.timestamp | date:'HH:mm:ss' }} - {{ entry.message }}
            </div>
            <div *ngIf="logEntries.length === 0" class="empty-message">
              No log entries
            </div>
          </div>
          <button class="debug-btn small" (click)="clearLog()">Clear Log</button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .debug-panel {
      position: fixed;
      top: 0;
      right: 0;
      bottom: 0;
      width: 420px;
      background-color: #161820;
      border-left: 1px solid rgba(255, 95, 31, 0.3);
      box-shadow: -4px 0 20px rgba(0, 0, 0, 0.25);
      z-index: 1000;
      display: flex;
      flex-direction: column;
      color: #F3F3F7;
      font-family: 'Space Grotesk', monospace;
      animation: slideIn 0.3s ease;
    }

    @keyframes slideIn {
      from { transform: translateX(100%); }
      to { transform: translateX(0); }
    }

    .debug-header {
      padding: 16px;
      background-color: #22242E;
      border-bottom: 2px solid #FF5F1F;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .debug-header h3 {
      margin: 0;
      color: #FF5F1F;
      font-weight: 600;
    }

    .close-button {
      background: none;
      border: none;
      color: #A0A3B1;
      font-size: 20px;
      cursor: pointer;
    }

    .close-button:hover {
      color: #F3F3F7;
    }

    .debug-body {
      flex: 1;
      overflow-y: auto;
      padding: 16px;
    }

    .section {
      margin-bottom: 24px;
      background-color: #1A1C25;
      border-radius: 6px;
      padding: 12px;
      border: 1px solid rgba(255, 95, 31, 0.1);
    }

    .section h4 {
      margin: 0 0 12px 0;
      color: #38B6FF;
      font-size: 14px;
      border-bottom: 1px solid rgba(56, 182, 255, 0.2);
      padding-bottom: 8px;
    }

    .status-indicator {
      padding: 8px;
      border-radius: 4px;
      font-size: 14px;
      margin-bottom: 12px;
      text-align: center;
      font-weight: 500;
    }

    .connected {
      background-color: rgba(46, 204, 113, 0.2);
      color: #2ecc71;
      border: 1px solid rgba(46, 204, 113, 0.3);
    }

    .disconnected {
      background-color: rgba(231, 76, 60, 0.2);
      color: #e74c3c;
      border: 1px solid rgba(231, 76, 60, 0.3);
    }

    .debug-btn {
      background-color: #22242E;
      border: 1px solid rgba(255, 95, 31, 0.3);
      color: #F3F3F7;
      padding: 8px 16px;
      border-radius: 4px;
      cursor: pointer;
      font-family: 'Space Grotesk', monospace;
      font-size: 14px;
      margin-top: 8px;
      transition: all 0.2s;
      width: 100%;
    }

    .debug-btn:hover:not(:disabled) {
      background-color: rgba(255, 95, 31, 0.2);
      border-color: #FF5F1F;
    }

    .debug-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .debug-btn.small {
      padding: 4px 8px;
      font-size: 12px;
    }

    .btn-group {
      display: flex;
      gap: 8px;
      margin-top: 8px;
    }

    .text-input {
      width: 100%;
      padding: 8px;
      background-color: #161820;
      border: 1px solid rgba(255, 95, 31, 0.2);
      border-radius: 4px;
      color: #F3F3F7;
      font-family: 'Space Grotesk', monospace;
    }

    .log {
      background-color: #161820;
      border-radius: 4px;
      padding: 8px;
      height: 200px;
      overflow-y: auto;
      font-family: 'Space Grotesk', monospace;
      font-size: 12px;
      line-height: 1.5;
      margin-bottom: 8px;
      border: 1px solid rgba(255, 95, 31, 0.1);
    }

    .log-entry {
      padding: 4px 8px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.05);
    }

    .log-entry.info {
      color: #38B6FF;
    }

    .log-entry.success {
      color: #2ecc71;
    }

    .log-entry.error {
      color: #e74c3c;
    }

    .log-entry.warning {
      color: #f39c12;
    }

    .file-list {
      max-height: 150px;
      overflow-y: auto;
      background-color: #161820;
      border-radius: 4px;
      margin-bottom: 8px;
      border: 1px solid rgba(255, 95, 31, 0.1);
    }

    .file-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 8px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.05);
    }

    .empty-message {
      padding: 12px;
      color: #A0A3B1;
      font-style: italic;
      text-align: center;
    }
  `]
})
export class DebugPanelComponent implements OnInit {
  @Output() close = new EventEmitter<void>();

  isConnected = false;
  isAuthenticated = false;
  operationInProgress = false;

  logEntries: Array<{level: string, message: string, timestamp: Date}> = [];

  private authStatusSubject = new BehaviorSubject<boolean>(false);

  constructor(
    public fileService: FileService,
    private notificationService: NotificationService,
    private authService: AuthService,
    private apiService: ApiService,
    private invitationService: InvitationService,
    private teamService: TeamService,
    private http: HttpClient

  ) {}

  ngOnInit(): void {
    this.authService.isAuthenticated().subscribe(status => {
      this.isAuthenticated = status;
      this.authStatusSubject.next(status);
      this.addLog('info', `Auth status: ${status ? 'Authenticated' : 'Not authenticated'}`);
    });

    this.testConnection();
  }

  closePanel(): void {
    this.close.emit();
  }

  testConnection(): void {
    this.addLog('info', 'Testing connection to server...');
    this.operationInProgress = true;

    this.fileService.testConnection().pipe(
      finalize(() => this.operationInProgress = false)
    ).subscribe(connected => {
      this.isConnected = connected;
      if (connected) {
        this.addLog('success', 'Successfully connected to server');
        this.notificationService.success('Connected to server successfully');
      } else {
        this.addLog('error', 'Failed to connect to server');
        this.notificationService.error('Failed to connect to server');
      }
    });
  }

  uploadSingleFile(): void {
    if (this.fileService.currentFile) {
      this.uploadSingleFileByName(this.fileService.currentFile);
    } else if (this.fileService.filesInDirectory.length > 0) {
      this.uploadSingleFileByName(this.fileService.filesInDirectory[0]);
    } else {
      this.addLog('error', 'No files available to upload');
      this.notificationService.error('No files available to upload');
    }
  }

  uploadSingleFileByName(file: any): void {
    this.addLog('info', `Preparing to upload file: ${file.name}`);
    this.operationInProgress = true;

    this.fileService.debugUploadFileWithToken(file).pipe(
      finalize(() => this.operationInProgress = false)
    ).subscribe({
      next: () => {
        this.addLog('success', `Successfully uploaded file: ${file.name}`);
        this.notificationService.success(`File ${file.name} uploaded successfully`);
      },
      error: (error) => {
        this.addLog('error', `Error uploading file ${file.name}: ${error.message}`);
        this.notificationService.error(`Failed to upload file: ${error.message}`);
      }
    });
  }

  downloadSingleFile(filename: string): void {
    if (!filename) {
      this.addLog('error', 'No filename provided for download');
      this.notificationService.error('Please enter a filename to download');
      return;
    }

    this.addLog('info', `Preparing to download file: ${filename}`);
    this.operationInProgress = true;

    this.fileService.debugDownloadFile(filename).pipe(
      finalize(() => this.operationInProgress = false)
    ).subscribe({
      next: (file) => {
        this.addLog('success', `Successfully downloaded file: ${filename}`);
        this.notificationService.success(`File ${filename} downloaded successfully`);
      },
      error: (error) => {
        this.addLog('error', `Error downloading file ${filename}: ${error.message}`);
        this.notificationService.error(`Failed to download file: ${error.message}`);
      }
    });
  }

  logAuthStatus(): void {
    this.authService.getToken().subscribe(token => {
      if (token) {
        this.addLog('info', `Current auth token: ${token.substring(0, 10)}...`);

        // Test if the token is working by getting user info
        this.apiService.getCurrentUser().subscribe({
          next: (user) => {
            this.addLog('success', `Authenticated as: ${user.email}`);
            this.isAuthenticated = true;
          },
          error: (error) => {
            this.addLog('error', `Auth token exists but verification failed: ${error.message}`);
            this.isAuthenticated = false;
          }
        });
      } else {
        this.addLog('warning', 'No authentication token found');
        this.isAuthenticated = false;
      }
    });
  }

  // Add a method to test file path resolution
  checkFilePaths(): void {
    this.addLog('info', 'Checking file paths...');
    this.operationInProgress = true;

    this.authService.isAuthenticated().pipe(
      switchMap(isAuthenticated => {
        if (isAuthenticated) {
          return this.apiService.getCurrentUser().pipe(
            tap(user => {
              this.addLog('info', `Authenticated user: ${user.email}`);
              this.addLog('info', `User ID: ${user.user_id}`);
              this.addLog('info', `Files should be stored in: /storage/${user.user_id}/`);
            }),
            catchError(error => {
              this.addLog('error', `Error getting user info: ${error.message}`);
              return of(null);
            })
          );
        } else {
          this.addLog('info', 'Not authenticated, files will use public folder');
          this.addLog('info', 'Files should be stored in: /storage/public/');
          return of(null);
        }
      }),
      finalize(() => this.operationInProgress = false)
    ).subscribe();
  }

  addLog(level: 'info' | 'success' | 'error' | 'warning', message: string): void {
    this.logEntries.unshift({ level, message, timestamp: new Date() });

    // Limit to 50 entries to prevent memory issues
    if (this.logEntries.length > 50) {
      this.logEntries.pop();
    }

    // Log to console as well
    switch (level) {
      case 'info':
        console.log(`🔵 ${message}`);
        break;
      case 'success':
        console.log(`🟢 ${message}`);
        break;
      case 'error':
        console.error(`🔴 ${message}`);
        break;
      case 'warning':
        console.warn(`🟠 ${message}`);
        break;
    }
  }

  createTestInvitation(): void {
    // First check if we have an active team
    const activeTeam = this.teamService.activeTeam;

    if (!activeTeam) {
      this.addLog('error', 'No active team. Please select a team first.');
      this.notificationService.error('Please select a team first to create a test invitation');
      return;
    }

    // First check the user's role in this team
    this.teamService.getUserRoleInTeam(activeTeam.id).subscribe({
      next: (role) => {
        this.addLog('info', `Current user's role in team: ${role} (${this.getRoleString(role)})`);

        if (role < TeamRole.Contributor) {
          this.addLog('error', `You don't have permission to create invitations. Minimum role required: Contributor`);
          this.notificationService.error('You need to be at least a Contributor to invite others');
          return;
        }

        // Proceed with creating the invitation since user has sufficient permissions
        this.proceedWithInvitation(activeTeam);
      },
      error: (error) => {
        this.addLog('error', `Error checking user role: ${error.message}`);
        this.notificationService.error('Could not verify your permissions in this team');
      }
    });
  }

// Helper method to create the invitation after permission check
  private proceedWithInvitation(activeTeam: Team): void {
    // Generate a random test email
    const randomEmail = `test-user-${Math.floor(Math.random() * 10000)}@example.com`;

    // Log detailed debugging information
    this.addLog('info', `Creating test invitation with the following details:`);
    this.addLog('info', `Team ID: ${activeTeam.id}`);
    this.addLog('info', `Team Name: ${activeTeam.name}`);
    this.addLog('info', `Email: ${randomEmail}`);

    // Convert TeamRole enum to string representation
    const roleString = this.getRoleString(TeamRole.Contributor);
    this.addLog('info', `Role: ${TeamRole.Contributor} (${roleString})`);

    // Check if we're authenticated
    this.authService.getToken().subscribe(token => {
      if (!token) {
        this.addLog('error', 'Not authenticated! Please log in first.');
        this.notificationService.error('You must be logged in to create invitations');
        return;
      }

      this.addLog('info', `User is authenticated with token: ${token.substring(0, 10)}...`);

      // Create a direct HTTP request
      const url = `${this.apiService.baseUrl}/teams/${activeTeam.id}/invitations`;
      
      // Use the string name for the role as expected by the backend
      const payload = {
        email: randomEmail,
        role: "Viewer"  // String name as expected by backend
      };

      this.addLog('info', `Sending HTTP POST to: ${url}`);
      this.addLog('info', `Payload: ${JSON.stringify(payload)}`);

      // Create the invitation with detailed error handling
      this.http.post(url, payload, {
        headers: new HttpHeaders({
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }),
        observe: 'response'
      }).subscribe({
        next: (response) => {
          this.addLog('success', `Invitation created successfully! Status: ${response.status}`);
          this.addLog('success', `Response: ${JSON.stringify(response.body)}`);
          this.notificationService.success('Test invitation created successfully');
        },
        error: (error) => {
          this.addLog('error', `HTTP Error: ${error.status} ${error.statusText}`);

          // Try to extract the error message from the response
          let errorMessage = 'Unknown error';
          if (error.error) {
            if (typeof error.error === 'string') {
              errorMessage = error.error;
            } else if (error.error.message) {
              errorMessage = error.error.message;
            } else {
              errorMessage = JSON.stringify(error.error);
            }
          }

          this.addLog('error', `Error details: ${errorMessage}`);
          this.notificationService.error(`Failed to create invitation: ${errorMessage}`);
        }
      });
    });
  }

// Helper function to convert TeamRole enum to string
  private getRoleString(role: TeamRole): string {
    switch(role) {
      case TeamRole.Viewer:
        return "Viewer";
      case TeamRole.Contributor:
        return "Contributor";
      case TeamRole.Owner:
        return "Owner";
      default:
        return "Viewer";
    }
  }

  clearLog(): void {
    this.logEntries = [];
  }
}
