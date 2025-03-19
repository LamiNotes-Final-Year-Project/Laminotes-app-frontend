import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TeamInvitation, InvitationStatus } from '../../models/team-invitation.model';
import { TeamRole } from '../../models/team.model';
import { InvitationService } from '../../services/invitation.service';
import { NotificationService } from '../../services/notification.service';

@Component({
  selector: 'app-user-invitations',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="user-invitations">
      <h3 class="invitations-title">
        <i class="fas fa-bell"></i> Team Invitations
        <span class="badge" *ngIf="pendingInvitations.length > 0">
          {{ pendingInvitations.length }}
        </span>
      </h3>

      <div class="loading-indicator" *ngIf="isLoading">
        <i class="fas fa-spinner fa-spin"></i> Loading invitations...
      </div>

      <div class="empty-state" *ngIf="!isLoading && pendingInvitations.length === 0">
        <i class="fas fa-inbox"></i>
        <p>You don't have any pending invitations</p>
      </div>

      <div class="invitations-list">
        <div class="invitation-card" *ngFor="let invitation of pendingInvitations">
          <div class="invitation-header">
            <div class="team-avatar" [style.backgroundColor]="getRandomTeamColor(invitation.team_id)">
              {{ getTeamInitials(invitation.team_name || 'Team') }}
            </div>
            <div class="invitation-details">
              <h4 class="team-name">{{ invitation.team_name || 'Team' }}</h4>
              <p class="invitation-info">
                <span class="invited-by">Invited by {{ invitation.invited_by_name || 'Team Member' }}</span>
                <span class="invitation-date">{{ getRelativeTime(invitation.created_at) }}</span>
              </p>
            </div>
          </div>

          <div class="invitation-body">
            <div class="role-info">
              <div class="role-badge" [ngClass]="getRoleClass(invitation.role)">
                {{ getRoleName(invitation.role) }}
              </div>
              <p class="role-description">
                {{ getRoleDescription(invitation.role) }}
              </p>
            </div>
          </div>

          <div class="invitation-actions">
            <button class="action-button decline" (click)="declineInvitation(invitation)">
              Decline
            </button>
            <button class="action-button accept" (click)="acceptInvitation(invitation)">
              <i class="fas fa-check"></i> Accept
            </button>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .user-invitations {
      background-color: #1A1C25;
      border-radius: 8px;
      overflow: hidden;
      border: 1px solid rgba(255, 95, 31, 0.15);
      margin-bottom: 20px;
    }

    .invitations-title {
      padding: 16px;
      margin: 0;
      color: #F3F3F7;
      font-size: 16px;
      border-bottom: 1px solid rgba(255, 95, 31, 0.15);
      display: flex;
      align-items: center;
    }

    .invitations-title i {
      margin-right: 8px;
      color: #FF5F1F;
    }

    .badge {
      margin-left: 8px;
      padding: 2px 8px;
      background-color: #FF5F1F;
      border-radius: 12px;
      font-size: 12px;
      color: white;
    }

    .invitations-list {
      padding: 16px;
    }

    .invitation-card {
      background-color: #22242E;
      border-radius: 8px;
      overflow: hidden;
      border: 1px solid rgba(255, 95, 31, 0.1);
      margin-bottom: 16px;
    }

    .invitation-card:last-child {
      margin-bottom: 0;
    }

    .invitation-header {
      padding: 16px;
      display: flex;
      align-items: center;
      border-bottom: 1px solid rgba(255, 95, 31, 0.1);
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

    .invitation-details {
      flex: 1;
    }

    .team-name {
      margin: 0 0 4px 0;
      font-size: 18px;
      color: #F3F3F7;
    }

    .invitation-info {
      display: flex;
      margin: 0;
      font-size: 12px;
      color: #A0A3B1;
    }

    .invited-by {
      margin-right: 12px;
    }

    .invitation-body {
      padding: 16px;
    }

    .role-info {
      display: flex;
      align-items: flex-start;
    }

    .role-badge {
      padding: 4px 10px;
      border-radius: 12px;
      font-size: 12px;
      font-weight: 500;
      margin-right: 12px;
      white-space: nowrap;
    }

    .role-owner {
      background-color: rgba(255, 95, 31, 0.2);
      color: #FF5F1F;
      border: 1px solid rgba(255, 95, 31, 0.3);
    }

    .role-contributor {
      background-color: rgba(56, 182, 255, 0.2);
      color: #38B6FF;
      border: 1px solid rgba(56, 182, 255, 0.3);
    }

    .role-viewer {
      background-color: rgba(0, 229, 160, 0.2);
      color: #00E5A0;
      border: 1px solid rgba(0, 229, 160, 0.3);
    }

    .role-description {
      margin: 0;
      font-size: 14px;
      color: #F3F3F7;
      flex: 1;
    }

    .invitation-actions {
      padding: 12px 16px;
      display: flex;
      justify-content: flex-end;
      gap: 12px;
      background-color: rgba(0, 0, 0, 0.1);
    }

    .action-button {
      padding: 8px 16px;
      border-radius: 4px;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      border: none;
      display: flex;
      align-items: center;
    }

    .action-button i {
      margin-right: 6px;
    }

    .action-button.decline {
      background-color: transparent;
      color: #A0A3B1;
      border: 1px solid rgba(255, 255, 255, 0.1);
    }

    .action-button.decline:hover {
      background-color: rgba(255, 255, 255, 0.05);
      color: #F3F3F7;
    }

    .action-button.accept {
      background-color: #FF5F1F;
      color: white;
    }

    .action-button.accept:hover {
      background-color: #FF7A45;
    }

    .loading-indicator {
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
      color: #A0A3B1;
    }

    .loading-indicator i {
      margin-right: 8px;
      color: #FF5F1F;
    }

    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 32px 16px;
      color: #A0A3B1;
      text-align: center;
    }

    .empty-state i {
      font-size: 32px;
      margin-bottom: 12px;
      color: rgba(255, 95, 31, 0.3);
    }
  `]
})
export class UserInvitationsComponent implements OnInit {
  pendingInvitations: TeamInvitation[] = [];
  isLoading: boolean = false;
  colorCache: Record<string, string> = {};

  constructor(
    private invitationService: InvitationService,
    private notificationService: NotificationService
  ) {}

  ngOnInit(): void {
    this.loadInvitations();
  }

  loadInvitations(): void {
    this.isLoading = true;

    this.invitationService.getMyInvitations().subscribe({
      next: (invitations) => {
        this.pendingInvitations = invitations.filter(
          inv => inv.status === InvitationStatus.Pending
        );
        this.isLoading = false;
      },
      error: () => {
        this.isLoading = false;
      }
    });
  }

  acceptInvitation(invitation: TeamInvitation): void {
    this.invitationService.acceptInvitation(invitation.id).subscribe({
      next: () => {
        this.pendingInvitations = this.pendingInvitations.filter(
          inv => inv.id !== invitation.id
        );

        // Reload page to refresh teams list
        setTimeout(() => {
          window.location.reload();
        }, 1000);
      }
    });
  }

  declineInvitation(invitation: TeamInvitation): void {
    this.invitationService.declineInvitation(invitation.id).subscribe({
      next: () => {
        this.pendingInvitations = this.pendingInvitations.filter(
          inv => inv.id !== invitation.id
        );
      }
    });
  }

  getTeamInitials(name: string): string {
    return name
      .split(' ')
      .map(word => word[0])
      .join('')
      .toUpperCase()
      .substring(0, 2);
  }

  getRandomTeamColor(teamId: string): string {
    // Return cached color if exists
    if (this.colorCache[teamId]) {
      return this.colorCache[teamId];
    }

    // Generate a consistent color based on team ID
    const hash = teamId.split('').reduce((acc, char) => {
      return ((acc << 5) - acc) + char.charCodeAt(0);
    }, 0);

    // Use the hash to generate a hue value (0-360)
    const hue = Math.abs(hash % 360);

    // Return HSL color with fixed saturation and lightness
    const color = `hsl(${hue}, 70%, 50%)`;
    this.colorCache[teamId] = color;
    return color;
  }

  getRoleName(role: TeamRole): string {
    switch (role) {
      case TeamRole.Owner:
        return 'Team Owner';
      case TeamRole.Contributor:
        return 'Contributor';
      case TeamRole.Viewer:
        return 'Viewer';
      default:
        return 'Unknown';
    }
  }

  getRoleClass(role: TeamRole): string {
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

  getRoleDescription(role: TeamRole): string {
    switch (role) {
      case TeamRole.Owner:
        return 'Full access to manage team settings, members, and files.';
      case TeamRole.Contributor:
        return 'Can create, edit, and delete team files.';
      case TeamRole.Viewer:
        return 'Can only view team files, without edit permissions.';
      default:
        return '';
    }
  }

  getRelativeTime(timestamp: string): string {
    const now = new Date();
    const date = new Date(timestamp);
    const diff = now.getTime() - date.getTime();

    // Time constants
    const minute = 60 * 1000;
    const hour = minute * 60;
    const day = hour * 24;
    const week = day * 7;
    const month = day * 30;

    if (diff < minute) {
      return 'just now';
    } else if (diff < hour) {
      const minutes = Math.floor(diff / minute);
      return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    } else if (diff < day) {
      const hours = Math.floor(diff / hour);
      return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    } else if (diff < week) {
      const days = Math.floor(diff / day);
      return `${days} day${days > 1 ? 's' : ''} ago`;
    } else if (diff < month) {
      const weeks = Math.floor(diff / week);
      return `${weeks} week${weeks > 1 ? 's' : ''} ago`;
    } else {
      return date.toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    }
  }
}
