/**
 * Models for team invitations.
 * Handles invitation data structures and invitation status tracking.
 */
import { TeamRole } from './team.model';

/**
 * Interface representing a team invitation.
 * Contains all details about an invitation sent to a user to join a team.
 */
export interface TeamInvitation {
  /** Unique identifier for the invitation */
  id: string;
  
  /** ID of the team the invitation is for */
  team_id: string;
  
  /** Optional name of the team for display purposes */
  team_name?: string;
  
  /** Email address of the invited user */
  invited_email: string;
  
  /** User ID of the person who sent the invitation */
  invited_by: string;
  
  /** Optional display name of the person who sent the invitation */
  invited_by_name?: string;
  
  /** Role that will be assigned to the user if they accept */
  role: TeamRole;
  
  /** ISO timestamp of when the invitation was created */
  created_at: string;
  
  /** ISO timestamp of when the invitation expires */
  expires_at: string;
  
  /** Current status of the invitation */
  status: InvitationStatus;
}

/**
 * Enumeration of possible invitation statuses.
 * Tracks the lifecycle state of an invitation.
 */
export enum InvitationStatus {
  /** Invitation has been sent but not yet acted upon */
  Pending = 'pending',
  
  /** Invitation has been accepted by the recipient */
  Accepted = 'accepted',
  
  /** Invitation has been declined by the recipient */
  Declined = 'declined',
  
  /** Invitation has passed its expiration date without being accepted */
  Expired = 'expired'
}
