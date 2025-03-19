import { Component, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Team, TeamRole } from '../../models/team.model';
import { TeamService } from '../../services/team.service';
import { NotificationService } from '../../services/notification.service';

@Component({
  selector: 'app-team-role',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="team-role-card">
      <div class="role-header">
        <div class="team-avatar" [style.backgroundColor]="getTeamColor(team)">
          {{ getTeamInitials(team.name) }}
        </div>
        <div>
          <h3 class="team-name">{{ team.name }}</h3>
          <div class="role-badge" [ngClass]="roleClass">
            {{ getRoleName() }}
          </div>
        </div>
      </div>

      <div class="role-actions" *ngIf="canManageTeam()">
        <button class="action-button" (click)="openManageTeamDialog()">
          <i class="fas fa-users-cog"></i>
          Manage Team
        </button>
      </div>

      <div class="role-description">
        <h4>Your Access Level:</h4>
        <ul class="permission-list">
          <li *ngIf="role >= TeamRole.Viewer">
            <i class="fas fa-check"></i> View all team documents
          </li>
          <li *ngIf="role >= TeamRole.Contributor">
            <i class="fas fa-check"></i> Create and edit team documents
          </li>
          <li *ngIf="role >= TeamRole.Owner">
            <i class="fas fa-check"></i> Manage team members and permissions
          </li>
        </ul>
      </div>
    </div>
  `,
  styles: [`
    .team-role-card {
      background-color: #1A1C25;
      border-radius: 8px;
      padding: 16px;
      margin-bottom: 16px;
      border: 1px solid rgba(255, 95, 31, 0.2);
    }

    .role-header {
      display: flex;
      align-items: center;
      margin-bottom: 16px;
    }

    .team-avatar {
      width: 48px;
      height: 48px;
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 600;
      color: white;
      font-size: 20px;
      margin-right: 16px;
    }

    .team-name {
      margin: 0 0 6px 0;
      font-size: 18px;
      color: #F3F3F7;
    }

    .role-badge {
      display: inline-block;
      padding: 4px 10px;
      border-radius: 12px;
      font-size: 12px;
      font-weight: 500;
    }

    .owner {
      background-color: rgba(255, 95, 31, 0.2);
      color: #FF5F1F;
      border: 1px solid rgba(255, 95, 31, 0.3);
    }

    .contributor {
      background-color: rgba(56, 182, 255, 0.2);
      color: #38B6FF;
      border: 1px solid rgba(56, 182, 255, 0.3);
    }

    .viewer {
      background-color: rgba(0, 229, 160, 0.2);
      color: #00E5A0;
      border: 1px solid rgba(0, 229, 160, 0.3);
    }

    .role-actions {
      margin-bottom: 16px;
    }

    .action-button {
      background-color: #22242E;
      color: #F3F3F7;
      border: 1px solid rgba(255, 95, 31, 0.2);
      border-radius: 4px;
      padding: 8px 12px;
      font-size: 14px;
      cursor: pointer;
      transition: all 0.2s;
    }

    .action-button:hover {
      background-color: #FF5F1F;
      border-color: #FF5F1F;
    }

    .action-button i {
      margin-right: 8px;
    }

    .role-description h4 {
      margin: 0 0 8px 0;
      font-size: 14px;
      color: #A0A3B1;
    }

    .permission-list {
      list-style: none;
      padding: 0;
      margin: 0;
    }

    .permission-list li {
      display: flex;
      align-items: center;
      margin-bottom: 6px;
      color: #F3F3F7;
      font-size: 14px;
    }

    .permission-list li i {
      color: #00E5A0;
      margin-right: 8px;
      width: 16px;
    }
  `]
})
export class TeamRoleComponent implements OnInit {
  @Input() team!: Team;
  @Input() role: TeamRole = TeamRole.Viewer;

  TeamRole = TeamRole; // Expose enum to template

  roleClass: string = '';

  constructor(
    private teamService: TeamService,
    private notificationService: NotificationService
  ) {}

  ngOnInit(): void {
    this.updateRoleClass();
  }

  private updateRoleClass(): void {
    switch (this.role) {
      case TeamRole.Owner:
        this.roleClass = 'owner';
        break;
      case TeamRole.Contributor:
        this.roleClass = 'contributor';
        break;
      case TeamRole.Viewer:
        this.roleClass = 'viewer';
        break;
    }
  }

  getRoleName(): string {
    switch (this.role) {
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

  getTeamInitials(name: string): string {
    return name
      .split(' ')
      .map(word => word[0])
      .join('')
      .toUpperCase()
      .substring(0, 2);
  }

  getTeamColor(team: Team): string {
    // Generate a consistent color based on team ID
    const hash = team.id.split('').reduce((acc, char) => {
      return ((acc << 5) - acc) + char.charCodeAt(0);
    }, 0);

    // Use the hash to generate a hue value (0-360)
    const hue = Math.abs(hash % 360);

    // Return HSL color with fixed saturation and lightness
    return `hsl(${hue}, 70%, 50%)`;
  }

  canManageTeam(): boolean {
    return this.role === TeamRole.Owner;
  }

  openManageTeamDialog(): void {
    // This will be implemented later
    this.notificationService.info('Team management coming soon');
  }
}
