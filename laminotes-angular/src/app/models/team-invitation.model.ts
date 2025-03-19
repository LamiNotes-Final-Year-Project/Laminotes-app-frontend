// src/app/models/team-invitation.model.ts
import { TeamRole } from './team.model';

export interface TeamInvitation {
  id: string;
  team_id: string;
  team_name?: string;
  invited_email: string;
  invited_by: string;
  invited_by_name?: string;
  role: TeamRole;
  created_at: string;
  expires_at: string;
  status: InvitationStatus;
}

export enum InvitationStatus {
  Pending = 'pending',
  Accepted = 'accepted',
  Declined = 'declined',
  Expired = 'expired'
}
