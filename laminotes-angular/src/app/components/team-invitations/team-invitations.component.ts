import { Component, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Team, TeamRole } from '../../models/team.model';
import { TeamInvitation, InvitationStatus } from '../../models/team-invitation.model';
import { InvitationService } from '../../services/invitation.service';
import { NotificationService } from '../../services/notification.service';

@Component({
  selector: 'app-team-invitations',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="invitations-panel">
      <div class="panel-section">
        <h3 class="section-title">
          <i class="fas fa-paper-plane"></i> Send Invitation
        </h3>

        <div class="invite-form">
          <div class="form-group">
            <label for="inviteEmail">Email Address</label>
            <input
              type="email"
              id="inviteEmail"
              [(ngModel)]="newInvitation.email"
              placeholder="colleague@example.com"
              class="form-input">
          </div>

          <div class="form-group">
            <label for="inviteRole">Role</label>
            <select
              id="inviteRole"
              [(ngModel)]="newInvitation.role"
              class="form-select">
              <option [ngValue]="TeamRole.Viewer">Viewer (Read only)</option>
              <option [ngValue]="TeamRole.Contributor">Contributor (Can edit)</option>
              <option [ngValue]="TeamRole.Owner" *ngIf="isOwner">Owner (Full control)</option>
            </select>
          </div>

          <button
            class="invite-button"
            [disabled]="!isValidEmail(newInvitation.email) || isInviting"
            (click)="sendInvitation()">
            <i class="fas fa-user-plus" *ngIf="!isInviting"></i>
            <i class="fas fa-spinner fa-spin" *ngIf="isInviting"></i>
            {{ isInviting ? 'Sending...' : 'Send Invitation' }}
          </button>
        </div>
      </div>

      <div class="panel-section">
        <h3 class="section-title">
          <i class="fas fa-clock"></i> Pending Invitations
        </h3>

        <div class="loading-indicator" *ngIf="isLoading">
          <i class="fas fa-spinner fa-spin"></i> Loading invitations...
        </div>

        <div class="empty-state" *ngIf="!isLoading && pendingInvitations.length === 0">
          <i class="fas fa-inbox"></i>
          <p>No pending invitations</p>
        </div>

        <div class="invitation-list">
          <div class="invitation-item" *ngFor="let invitation of pendingInvitations">
            <div class="invitation-content">
              <div class="invitation-icon">
                <i class="fas fa-envelope"></i>
              </div>
              <div class="invitation-details">
                <div class="invitation-email">{{ invitation.invited_email }}</div>
                <div class="invitation-meta">
                  <span class="invitation-role" [ngClass]="getRoleClass(invitation.role)">
                    {{ getRoleName(invitation.role) }}
                  </span>
                  <span class="invitation-date">
                    {{ getFormattedDate(invitation.created_at) }}
                  </span>
                </div>
              </div>
            </div>
            <div class="invitation-actions">
              <button class="action-button cancel" (click)="cancelInvitation(invitation)">
                <i class="fas fa-times"></i> Cancel
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .invitations-panel {
      background-color: #1A1C25;
      border-radius: 8px;
      overflow: hidden;
      border: 1px solid rgba(255, 95, 31, 0.15);
    }

    .panel-section {
      padding: 16px;
      border-bottom: 1px solid rgba(255, 95, 31, 0.15);
    }

    .panel-section:last-child {
      border-bottom: none;
    }

    .section-title {
      margin: 0 0 16px 0;
      font-size: 16px;
      color: #F3F3F7;
      display: flex;
      align-items: center;
    }

    .section-title i {
      margin-right: 8px;
      color: #FF5F1F;
    }

    .invite-form {
      display: flex;
      flex-direction: column;
    }

    .form-group {
      margin-bottom: 12px;
    }

    .form-group label {
      display: block;
      margin-bottom: 6px;
      font-size: 14px;
      color: #A0A3B1;
    }

    .form-input, .form-select {
      width: 100%;
      padding: 10px;
      background-color: #161820;
      border: 1px solid rgba(255, 95, 31, 0.2);
      border-radius: 4px;
      color: #F3F3F7;
      font-size: 14px;
    }

    .form-input:focus, .form-select:focus {
      outline: none;
      border-color: #FF5F1F;
    }

    .invite-button {
      padding: 12px;
      background-color: #FF5F1F;
      color: white;
      border: none;
      border-radius: 4px;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      transition: background-color 0.2s;
      margin-top: 8px;
    }

    .invite-button:hover:not(:disabled) {
      background-color: #FF7A45;
    }

    .invite-button:disabled {
      background-color: rgba(255, 95, 31, 0.5);
      cursor: not-allowed;
    }

    .invite-button i {
      margin-right: 8px;
    }

    .invitation-list {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .invitation-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px;
      background-color: #22242E;
      border-radius: 6px;
      border-left: 3px solid #38B6FF;
    }

    .invitation-content {
      display: flex;
      align-items: center;
      flex: 1;
    }

    .invitation-icon {
      width: 36px;
      height: 36px;
      background-color: rgba(56, 182, 255, 0.1);
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #38B6FF;
      margin-right: 12px;
    }

    .invitation-details {
      flex: 1;
    }

    .invitation-email {
      font-weight: 500;
      color: #F3F3F7;
      margin-bottom: 4px;
    }

    .invitation-meta {
      display: flex;
      align-items: center;
      font-size: 12px;
    }

    .invitation-role {
      padding: 2px 8px;
      border-radius: 10px;
      margin-right: 8px;
    }

    .role-owner {
      background-color: rgba(255, 95, 31, 0.2);
      color: #FF5F1F;
    }

    .role-contributor {
      background-color: rgba(56, 182, 255, 0.2);
      color: #38B6FF;
    }

    .role-viewer {
      background-color: rgba(0, 229, 160, 0.2);
      color: #00E5A0;
    }

    .invitation-date {
      color: #A0A3B1;
    }

    .invitation-actions {
      display: flex;
      gap: 8px;
    }

    .action-button {
      padding: 6px 12px;
      border-radius: 4px;
      font-size: 12px;
      display: flex;
      align-items: center;
      cursor: pointer;
      border: none;
    }

    .action-button i {
      margin-right: 4px;
    }

    .action-button.cancel {
      background-color: rgba(231, 76, 60, 0.2);
      color: #e74c3c;
      border: 1px solid rgba(231, 76, 60, 0.3);
    }

    .action-button.cancel:hover {
      background-color: rgba(231, 76, 60, 0.3);
    }

    .loading-indicator {
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 16px;
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
      padding: 24px;
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
export class TeamInvitationsComponent implements OnInit {
  @Input() team!: Team;
  @Input() isOwner: boolean = false;

  TeamRole = TeamRole; // Expose enum to template

  pendingInvitations: TeamInvitation[] = [];
  isLoading: boolean = false;
  isInviting: boolean = false;

  newInvitation = {
    email: '',
    role: TeamRole.Viewer
  };

  constructor(
    private invitationService: InvitationService,
    private notificationService: NotificationService
  ) {}

  ngOnInit(): void {
    this.loadInvitations();
  }

  loadInvitations(): void {
    this.isLoading = true;

    this.invitationService.getTeamInvitations(this.team.id).subscribe({
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

  sendInvitation(): void {
    if (!this.isValidEmail(this.newInvitation.email)) {
      this.notificationService.error('Please enter a valid email address');
      return;
    }

    this.isInviting = true;

    this.invitationService.createInvitation(
      this.team.id,
      this.newInvitation.email,
      this.newInvitation.role
    ).subscribe({
      next: (invitation) => {
        this.pendingInvitations.push(invitation);
        this.newInvitation.email = '';
        this.newInvitation.role = TeamRole.Viewer;
        this.isInviting = false;
      },
      error: () => {
        this.isInviting = false;
      }
    });
  }

  cancelInvitation(invitation: TeamInvitation): void {
    this.invitationService.cancelInvitation(invitation.id).subscribe({
      next: () => {
        this.pendingInvitations = this.pendingInvitations.filter(
          inv => inv.id !== invitation.id
        );
      }
    });
  }

  isValidEmail(email: string): boolean {
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    return emailRegex.test(email);
  }

  getRoleName(role: TeamRole): string {
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

  getFormattedDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }
}
