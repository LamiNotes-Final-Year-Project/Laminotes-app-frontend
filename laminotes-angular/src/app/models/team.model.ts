// src/app/models/team.model.ts
export enum TeamRole {
  Viewer = 0,
  Contributor = 1,
  Owner = 2
}

export interface Team {
  id: string;
  name: string;
  owner_id: string;
  created_at: string;
}

export interface TeamMember {
  user_id: string;
  team_id: string;
  role: TeamRole;
  access_expires?: string;
}
