/**
 * Team invitation management service.
 * 
 * Handles the creation, retrieval, acceptance, declining, and cancellation
 * of team invitations. This service provides the interface for managing
 * the team membership invitation workflow.
 */
import { Injectable } from '@angular/core';
import { Observable, of, throwError } from 'rxjs';
import { map, catchError, tap } from 'rxjs/operators';
import { ApiService } from './api.service';
import { NotificationService } from './notification.service';
import { TeamInvitation, InvitationStatus } from '../models/team-invitation.model';
import { TeamRole } from '../models/team.model';

/**
 * Service responsible for managing team invitations.
 * Handles sending, receiving, and responding to team membership invitations.
 */
@Injectable({
  providedIn: 'root'
})
export class InvitationService {

  constructor(
    private apiService: ApiService,
    private notificationService: NotificationService
  ) { }

  /**
   * Creates a new team invitation and sends it to the specified email address.
   * Invitations include the role that will be assigned to the user upon acceptance.
   * Provides user feedback through notification service.
   * 
   * @param teamId The ID of the team to invite the user to
   * @param email Email address of the user to invite
   * @param role Role to assign to the invited user upon acceptance
   * @returns Observable emitting the created invitation if successful
   * @throws Error if invitation creation fails
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
   * Retrieves all pending invitations for the currently authenticated user.
   * Used to display invitation notifications and allow users to respond to them.
   * 
   * @returns Observable emitting an array of pending team invitations
   * @throws Error if invitation retrieval fails
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
   * Retrieves all invitations sent for a specific team.
   * Used by team administrators to manage pending invitations.
   * 
   * @param teamId The ID of the team to get invitations for
   * @returns Observable emitting an array of team invitations
   * @throws Error if invitation retrieval fails
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
   * Accepts a team invitation, adding the current user to the team.
   * This updates the invitation status on the backend and notifies the user of success.
   * 
   * @param invitationId The ID of the invitation to accept
   * @returns Observable that completes when the invitation is accepted
   * @throws Error if accepting the invitation fails
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
   * Declines a team invitation, rejecting the team membership offer.
   * Updates the invitation status on the backend and notifies the user.
   * 
   * @param invitationId The ID of the invitation to decline
   * @returns Observable that completes when the invitation is declined
   * @throws Error if declining the invitation fails
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
   * Cancels a pending invitation that was previously sent.
   * This operation is restricted to team owners and administrators.
   * Removes the invitation from the system and notifies the user.
   * 
   * @param invitationId The ID of the invitation to cancel
   * @returns Observable that completes when the invitation is cancelled
   * @throws Error if cancelling the invitation fails
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
