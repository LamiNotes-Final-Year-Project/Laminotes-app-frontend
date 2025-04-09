/**
 * Models for team-related data structures.
 * Contains team information, member roles, and team-member associations.
 */

/**
 * Enumeration of possible roles a user can have in a team.
 * Each role has different permissions and capabilities within a team context.
 */
export enum TeamRole {
  /** Can view content but not make changes */
  Viewer = 0,
  
  /** Can view and edit content but cannot manage team settings */
  Contributor = 1,
  
  /** Full administrative rights - can manage team members and settings */
  Owner = 2
}

/**
 * Interface representing a team.
 * Teams group users and content for collaboration.
 */
export interface Team {
  /** Unique identifier for the team */
  id: string;
  
  /** Display name for the team */
  name: string;
  
  /** User ID of the team owner */
  owner_id: string;
  
  /** ISO timestamp of when the team was created */
  created_at: string;
  
  /** Optional path to local directory for team files */
  localDirectory?: string;
}

/**
 * Interface representing a team membership.
 * Defines the relationship between a user and a team.
 */
export interface TeamMember {
  /** User ID of the team member */
  user_id: string;
  
  /** ID of the team */
  team_id: string;
  
  /** The member's role/permissions in the team */
  role: TeamRole;
  
  /** Optional expiration timestamp for temporary access */
  access_expires?: string;
}
