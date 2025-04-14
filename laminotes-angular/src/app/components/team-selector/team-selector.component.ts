// src/app/components/team-selector/team-selector.component.ts
import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TeamService } from '../../services/team.service';
import { Team } from '../../models/team.model';
import { NotificationService } from '../../services/notification.service';
import { ElectronService } from '../../services/electron.service';

@Component({
  selector: 'app-team-selector',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="team-selector">
      <div class="current-team" (click)="toggleDropdown()">
        <div class="team-badge" *ngIf="activeTeam">
          {{ getTeamInitials(activeTeam.name) }}
        </div>
        <div class="team-badge personal" *ngIf="!activeTeam">
          <i class="fas fa-user"></i>
        </div>
        <div class="team-info">
          <div class="team-name">{{ activeTeam ? activeTeam.name : 'My Files' }}</div>
          <div class="team-type">{{ activeTeam ? 'Team' : 'Personal' }}</div>
        </div>
        <i class="fas fa-chevron-down"></i>
      </div>

      <div class="teams-dropdown" *ngIf="isDropdownOpen">
        <div class="dropdown-header">
          <h4>Switch Workspace</h4>
        </div>

        <div class="team-option personal" [class.active]="!activeTeam" (click)="selectTeam(null)">
          <div class="team-badge personal">
            <i class="fas fa-user"></i>
          </div>
          <div class="team-name">My Files</div>
        </div>

        <div *ngFor="let team of teams"
             class="team-option"
             [class.active]="activeTeam?.id === team.id"
             (click)="selectTeam(team)">
          <div class="team-badge">
            {{ getTeamInitials(team.name) }}
          </div>
          <div class="team-name">{{ team.name }}</div>
        </div>

        <div class="dropdown-footer">
          <button class="create-team-btn" (click)="openCreateTeamModal()">
            <i class="fas fa-plus"></i> Create Team
          </button>
        </div>
      </div>
    </div>

    <!-- Create Team Modal -->
    <div class="modal-overlay" *ngIf="isCreateTeamModalOpen" (click)="closeModals()">
      <div class="modal-content" (click)="$event.stopPropagation()">
        <div class="modal-header">
          <h3>Create Team</h3>
          <button class="close-btn" (click)="closeModals()">×</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label for="teamName">Team Name</label>
            <input type="text" id="teamName" [(ngModel)]="newTeamName" placeholder="Enter team name">
          </div>
        </div>
        <div class="modal-footer">
          <button class="cancel-btn" (click)="closeModals()">Cancel</button>
          <button class="create-btn" [disabled]="!newTeamName" (click)="createTeam()">
            Create Team
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .team-selector {
      position: relative;
      display: inline-block;
    }

    .current-team {
      display: flex;
      align-items: center;
      background-color: #1A1C25;
      border: 1px solid rgba(255, 95, 31, 0.2);
      border-radius: 4px;
      padding: 8px 12px;
      cursor: pointer;
      transition: all 0.2s;
    }

    .current-team:hover {
      border-color: #FF5F1F;
    }

    .team-badge {
      width: 32px;
      height: 32px;
      border-radius: 6px;
      background-color: #FF5F1F;
      color: white;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 600;
      margin-right: 12px;
    }

    .team-badge.personal {
      background-color: #38B6FF;
    }

    .team-info {
      flex: 1;
    }

    .team-name {
      font-weight: 500;
      color: #F3F3F7;
    }

    .team-type {
      font-size: 12px;
      color: #A0A3B1;
    }

    .teams-dropdown {
      position: absolute;
      top: 100%;
      left: 0;
      width: 260px;
      background-color: #1A1C25;
      border: 1px solid rgba(255, 95, 31, 0.2);
      border-radius: 6px;
      box-shadow: 0 6px 16px rgba(0, 0, 0, 0.3);
      margin-top: 8px;
      z-index: 1000;
    }

    .dropdown-header {
      padding: 12px 16px;
      border-bottom: 1px solid rgba(255, 95, 31, 0.1);
    }

    .dropdown-header h4 {
      margin: 0;
      color: #A0A3B1;
      font-size: 14px;
      font-weight: 500;
    }

    .team-option {
      display: flex;
      align-items: center;
      padding: 12px 16px;
      cursor: pointer;
      transition: all 0.15s;
    }

    .team-option:hover {
      background-color: #22242E;
    }

    .team-option.active {
      background-color: rgba(255, 95, 31, 0.1);
      border-left: 3px solid #FF5F1F;
    }

    .dropdown-footer {
      padding: 12px 16px;
      border-top: 1px solid rgba(255, 95, 31, 0.1);
    }

    .create-team-btn {
      width: 100%;
      padding: 8px 12px;
      background-color: #FF5F1F;
      color: white;
      border: none;
      border-radius: 4px;
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
      transition: background-color 0.2s;
    }

    .create-team-btn:hover {
      background-color: #FF7A45;
    }

    .modal-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background-color: rgba(15, 17, 26, 0.7);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 2000;
    }

    .modal-content {
      width: 100%;
      max-width: 400px;
      background-color: #1A1C25;
      border-radius: 8px;
      border: 1px solid rgba(255, 95, 31, 0.2);
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.25);
    }

    .modal-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 16px;
      border-bottom: 1px solid rgba(255, 95, 31, 0.1);
    }

    .modal-header h3 {
      margin: 0;
      color: #F3F3F7;
      font-size: 18px;
    }

    .close-btn {
      background: none;
      border: none;
      color: #A0A3B1;
      font-size: 20px;
      cursor: pointer;
    }

    .modal-body {
      padding: 16px;
    }

    .form-group {
      margin-bottom: 16px;
    }

    .form-group label {
      display: block;
      margin-bottom: 8px;
      color: #A0A3B1;
    }

    .form-group input {
      width: 100%;
      padding: 10px;
      background-color: #161820;
      border: 1px solid rgba(255, 95, 31, 0.2);
      border-radius: 4px;
      color: #F3F3F7;
    }

    .modal-footer {
      display: flex;
      justify-content: flex-end;
      gap: 12px;
      padding: 16px;
      border-top: 1px solid rgba(255, 95, 31, 0.1);
    }

    .cancel-btn {
      padding: 8px 16px;
      background-color: transparent;
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 4px;
      color: #A0A3B1;
      cursor: pointer;
    }

    .create-btn {
      padding: 8px 16px;
      background-color: #FF5F1F;
      border: none;
      border-radius: 4px;
      color: white;
      cursor: pointer;
    }

    .create-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
  `]
})
export class TeamSelectorComponent implements OnInit {
  activeTeam: Team | null = null;
  teams: Team[] = [];
  isDropdownOpen = false;
  isCreateTeamModalOpen = false;
  newTeamName = '';

  constructor(
    private teamService: TeamService,
    private notificationService: NotificationService,
    private electronService: ElectronService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    // Subscribe to active team changes
    this.teamService.activeTeam$.subscribe(team => {
      this.activeTeam = team;
    });

    // Load user teams
    this.loadTeams();
  }

  loadTeams(): void {
    this.teamService.getUserTeams().subscribe(teams => {
      this.teams = teams;
    });
  }

  toggleDropdown(): void {
    this.isDropdownOpen = !this.isDropdownOpen;
    if (this.isDropdownOpen) {
      // Refresh teams list when opening dropdown
      this.loadTeams();
    }
  }

  selectTeam(team: Team | null): void {
    this.isDropdownOpen = false;
    
    // For switching to personal files, no directory needed
    if (!team) {
      this.teamService.setActiveTeam(null).subscribe(success => {
        if (success) {
          this.cdr.detectChanges();
        }
      });
      return;
    }
    
    // Always check if directory exists for teams in Electron mode
    if (this.electronService.isElectron()) {
      const existingDir = this.teamService.getTeamDirectory(team.id);
      
      // If no directory set, or we want to force directory selection
      if (!existingDir) {
        this.notificationService.info(`Please select a local directory for team "${team.name}"`);
        console.log('Prompting for team directory selection');
        
        // Clear current directory selection logic 
        this.electronService.selectDirectory().subscribe({
          next: result => {
            console.log('Directory selection result:', result);
            
            if (result.success && result.dirPath) {
              console.log(`Selected directory: ${result.dirPath}`);
              
              // Set the directory for the team
              this.teamService.setTeamDirectory(team, result.dirPath).subscribe(() => {
                console.log(`Team directory set to: ${result.dirPath}`);
                
                // After setting directory, activate the team
                this.teamService.setActiveTeam(team).subscribe(success => {
                  if (success) {
                    this.notificationService.success(`Switched to team "${team.name}" with directory: ${result.dirPath}`);
                    this.cdr.detectChanges();
                  }
                });
              });
            } else {
              this.notificationService.warning('You need to select a directory for team files');
            }
          },
          error: err => {
            console.error('Error selecting directory:', err);
            this.notificationService.error('Failed to select directory');
          }
        });
        return;
      }
      
      // If directory is already set, validate it before switching
      console.log(`Team "${team.name}" has directory: ${existingDir}, validating...`);
      
      this.electronService.checkFileExists(existingDir).subscribe(exists => {
        if (!exists) {
          console.warn(`Team directory ${existingDir} does not exist or is not accessible`);
          this.notificationService.warning(`The directory for team "${team.name}" cannot be found. Please select a new directory.`);
          
          // Prompt for a new directory
          this.electronService.selectDirectory().subscribe({
            next: result => {
              if (result.success && result.dirPath) {
                console.log(`Selected new directory: ${result.dirPath}`);
                
                // Update the team directory
                this.teamService.setTeamDirectory(team, result.dirPath).subscribe(() => {
                  console.log(`Team directory updated to: ${result.dirPath}`);
                  
                  // After setting directory, activate the team
                  this.teamService.setActiveTeam(team).subscribe(success => {
                    if (success) {
                      this.notificationService.success(`Switched to team "${team.name}" with new directory: ${result.dirPath}`);
                      this.cdr.detectChanges();
                    }
                  });
                });
              } else {
                this.notificationService.error('You need to select a valid directory for team files');
              }
            },
            error: err => {
              console.error('Error selecting directory:', err);
              this.notificationService.error('Failed to select directory');
            }
          });
          return;
        }
        
        // Directory exists, proceed with team switching
        console.log(`Team directory validated: ${existingDir}`);
        this.notificationService.info(`Using directory for team "${team.name}": ${existingDir}`);
        
        // Continue with normal team switching
        this.teamService.setActiveTeam(team).subscribe(success => {
          if (success) {
            this.cdr.detectChanges();
          }
        });
      });
      return;
    }
    
    // For non-Electron platforms, just switch the team
    this.teamService.setActiveTeam(team).subscribe(success => {
      if (success) {
        this.cdr.detectChanges();
      }
    });
  }

  openCreateTeamModal(): void {
    this.isCreateTeamModalOpen = true;
    this.isDropdownOpen = false;
  }

  closeModals(): void {
    this.isCreateTeamModalOpen = false;
    this.isDropdownOpen = false;
    this.newTeamName = '';
  }

  createTeam(): void {
    if (this.newTeamName.trim()) {
      this.teamService.createTeam(this.newTeamName).subscribe(team => {
        if (team) {
          this.teams.push(team);
          this.closeModals();
          
          // For Electron, prompt to select a directory for the team
          if (this.electronService.isElectron()) {
            this.notificationService.info('Please select a local directory for this team');
            
            // Prompt to select directory
            this.electronService.selectDirectory().subscribe({
              next: result => {
                if (result.success && result.dirPath) {
                  // Set the directory for the team
                  this.teamService.setTeamDirectory(team, result.dirPath).subscribe(() => {
                    // After setting directory, activate the team
                    this.teamService.setActiveTeam(team).subscribe(success => {
                      if (success) {
                        this.notificationService.success(`Created team "${team.name}" with directory: ${result.dirPath}`);
                        this.cdr.detectChanges();
                      }
                    });
                  });
                } else {
                  this.notificationService.warning('Team created but no directory was selected. You can set it later.');
                  this.teamService.setActiveTeam(team).subscribe();
                }
              },
              error: err => {
                console.error('Error selecting directory:', err);
                this.notificationService.error('Failed to select directory, but team was created');
                this.teamService.setActiveTeam(team).subscribe();
              }
            });
          } else {
            // In browser mode, just activate the team
            this.teamService.setActiveTeam(team).subscribe();
          }
        }
      });
    }
  }

  getTeamInitials(name: string): string {
    return name
      .split(' ')
      .map(word => word[0])
      .join('')
      .toUpperCase()
      .substring(0, 2);
  }
}
