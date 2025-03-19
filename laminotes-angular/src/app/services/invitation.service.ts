// src/app/services/invitation.service.ts
import { Injectable } from '@angular/core';
import { Observable, of, throwError } from 'rxjs';
import { map, catchError, tap } from 'rxjs/operators';
import { ApiService } from './api.service';
import { NotificationService } from './notification.service';
import { TeamInvitation, InvitationStatus } from '../models/team-invitation.model';
import { TeamRole } from '../models/team.model';

@Injectable({
  providedIn: 'root'
})
export class InvitationService {

  constructor(
    private apiService: ApiService,
    private notificationService: NotificationService
  ) { }

  /**
   * Create a new team invitation
   * @param teamId The ID of the team
   * @param email Email of the user to invite
   * @param role Role to assign to the invited user
   */
  createInvitation(teamId: string, email: string, role: TeamRole): Observable<TeamInvitation> {
    console.log(`🔄 Creating invitation for ${email} to team ${teamId} with role ${role}`);

    return this.apiService.createTeamInvitation(teamId, email, role).pipe(
      tap(invitation => {
        console.log(`✅ Invitation created: ${invitation.id}`);
        this.notificationService.success(`Invitation sent to ${email}`);
      }),
      catchError(error => {
        console.error(`❌ Error creating invitation: ${error.message}`);
        this.notificationService.error(`Failed to send invitation: ${error.message}`);
        return throwError(() => error);
      })
    );
  }

  /**
   * Get all pending invitations for the current user
   */
  getMyInvitations(): Observable<TeamInvitation[]> {
    console.log(`🔄 Fetching invitations for current user`);

    return this.apiService.getUserInvitations().pipe(
      tap(invitations => {
        console.log(`✅ Fetched ${invitations.length} invitations`);
      }),
      catchError(error => {
        console.error(`❌ Error fetching invitations: ${error.message}`);
        this.notificationService.error(`Failed to load invitations: ${error.message}`);
        return throwError(() => error);
      })
    );
  }

  /**
   * Get all invitations sent for a specific team
   * @param teamId The ID of the team
   */
  getTeamInvitations(teamId: string): Observable<TeamInvitation[]> {
    console.log(`🔄 Fetching invitations for team ${teamId}`);

    return this.apiService.getTeamInvitations(teamId).pipe(
      tap(invitations => {
        console.log(`✅ Fetched ${invitations.length} team invitations`);
      }),
      catchError(error => {
        console.error(`❌ Error fetching team invitations: ${error.message}`);
        this.notificationService.error(`Failed to load team invitations: ${error.message}`);
        return throwError(() => error);
      })
    );
  }

  /**
   * Accept an invitation
   * @param invitationId The ID of the invitation
   */
  acceptInvitation(invitationId: string): Observable<void> {
    console.log(`🔄 Accepting invitation ${invitationId}`);

    return this.apiService.respondToInvitation(invitationId, InvitationStatus.Accepted).pipe(
      tap(() => {
        console.log(`✅ Invitation accepted`);
        this.notificationService.success('Team invitation accepted');
      }),
      catchError(error => {
        console.error(`❌ Error accepting invitation: ${error.message}`);
        this.notificationService.error(`Failed to accept invitation: ${error.message}`);
        return throwError(() => error);
      })
    );
  }

  /**
   * Decline an invitation
   * @param invitationId The ID of the invitation
   */
  declineInvitation(invitationId: string): Observable<void> {
    console.log(`🔄 Declining invitation ${invitationId}`);

    return this.apiService.respondToInvitation(invitationId, InvitationStatus.Declined).pipe(
      tap(() => {
        console.log(`✅ Invitation declined`);
        this.notificationService.info('Team invitation declined');
      }),
      catchError(error => {
        console.error(`❌ Error declining invitation: ${error.message}`);
        this.notificationService.error(`Failed to decline invitation: ${error.message}`);
        return throwError(() => error);
      })
    );
  }

  /**
   * Cancel an invitation (for team owners/admins)
   * @param invitationId The ID of the invitation
   */
  cancelInvitation(invitationId: string): Observable<void> {
    console.log(`🔄 Cancelling invitation ${invitationId}`);

    return this.apiService.deleteInvitation(invitationId).pipe(
      tap(() => {
        console.log(`✅ Invitation cancelled`);
        this.notificationService.info('Invitation cancelled');
      }),
      catchError(error => {
        console.error(`❌ Error cancelling invitation: ${error.message}`);
        this.notificationService.error(`Failed to cancel invitation: ${error.message}`);
        return throwError(() => error);
      })
    );
  }
}
