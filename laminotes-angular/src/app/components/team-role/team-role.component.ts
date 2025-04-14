import { Component, Input, OnInit, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Team, TeamRole, TeamMember } from '../../models/team.model';
import { TeamService } from '../../services/team.service';
import { NotificationService } from '../../services/notification.service';
import { ApiService } from '../../services/api.service';
import { map } from 'rxjs/operators';
import { forkJoin } from 'rxjs';

// Interface representing an extended team member with display name
interface TeamMemberDisplay {
  userId: string;
  email: string;
  displayName?: string;
  role: TeamRole;
}

@Component({
  selector: 'app-team-role',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './team-role.component.html',
  styleUrls: ['./team-role.component.css']
})
export class TeamRoleComponent implements OnInit, OnChanges {
  @Input() team!: Team;
  @Input() role: TeamRole = TeamRole.Viewer;

  TeamRole = TeamRole; // Expose enum to template
  teamMembers: TeamMemberDisplay[] = [];
  isLoadingMembers: boolean = false;
  currentUserId: string | null = null;
  roleClass: string = '';

  constructor(
    private teamService: TeamService,
    private notificationService: NotificationService,
    private apiService: ApiService
  ) {}

  ngOnInit(): void {
    this.updateRoleClass();
    this.getCurrentUserId();
    
    if (this.team) {
      this.loadTeamMembers();
    }
  }
  
  ngOnChanges(changes: SimpleChanges): void {
    if (changes['team'] && !changes['team'].firstChange) {
      this.loadTeamMembers();
    }
    
    if (changes['role']) {
      this.updateRoleClass();
    }
  }
  
  private getCurrentUserId(): void {
    this.apiService.getCurrentUser().subscribe({
      next: (user) => {
        this.currentUserId = user.user_id;
      },
      error: (error) => {
        console.error('Error getting current user ID:', error);
      }
    });
  }
  
  private loadTeamMembers(): void {
    if (!this.team) return;
    
    this.isLoadingMembers = true;
    
    this.apiService.getTeamMembers(this.team.id).subscribe({
      next: (members) => {
        // Add owner to list if not already included
        const hasOwner = members.some(m => m.user_id === this.team.owner_id);
        
        if (!hasOwner) {
          members.push({
            user_id: this.team.owner_id,
            team_id: this.team.id,
            role: TeamRole.Owner
          });
        }
        
        // Convert to display format with user info
        this.fetchMemberDetails(members);
      },
      error: (error) => {
        console.error('Error loading team members:', error);
        this.notificationService.error('Failed to load team members');
        this.isLoadingMembers = false;
        
        // Show mock data for demonstration if API fails
        this.teamMembers = this.getMockTeamMembers();
      }
    });
  }
  
  private fetchMemberDetails(members: TeamMember[]): void {
    // For each member, fetch user details like display name
    const memberPromises = members.map(member => 
      this.apiService.getUserById(member.user_id).pipe(
        map(user => ({
          userId: member.user_id,
          email: user.email,
          displayName: user.display_name, 
          role: member.role
        }))
      )
    );
    
    forkJoin(memberPromises).subscribe({
      next: (memberDetails) => {
        this.teamMembers = memberDetails;
        this.isLoadingMembers = false;
      },
      error: (error) => {
        console.error('Error fetching member details:', error);
        this.isLoadingMembers = false;
        
        // Fallback to basic info without display names
        this.teamMembers = members.map(m => ({
          userId: m.user_id,
          email: 'user@example.com', // Placeholder
          role: m.role
        }));
      }
    });
  }
  
  private getMockTeamMembers(): TeamMemberDisplay[] {
    return [
      {
        userId: this.team.owner_id,
        email: 'owner@example.com',
        displayName: 'Team Owner',
        role: TeamRole.Owner
      },
      {
        userId: 'member1',
        email: 'contributor@example.com',
        displayName: 'Team Contributor',
        role: TeamRole.Contributor
      },
      {
        userId: 'member2',
        email: 'viewer@example.com',
        displayName: 'Team Viewer',
        role: TeamRole.Viewer
      }
    ];
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

  // Get display name for a team member
  getInitials(name: string): string {
    return name
      .split(' ')
      .map(word => word[0])
      .join('')
      .toUpperCase()
      .substring(0, 2);
  }
  
  // Team color generator based on team ID
  getTeamColor(team: Team): string {
    if (!team || !team.id) return 'hsl(0, 70%, 50%)';
    
    // Generate a consistent color based on team ID
    const hash = team.id.split('').reduce((acc, char) => {
      return ((acc << 5) - acc) + char.charCodeAt(0);
    }, 0);

    // Use the hash to generate a hue value (0-360)
    const hue = Math.abs(hash % 360);

    // Return HSL color with fixed saturation and lightness
    return `hsl(${hue}, 70%, 50%)`;
  }
  
  // Role helper methods
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
  
  getRoleNameFor(role: TeamRole): string {
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
  
  getRoleClassFor(role: TeamRole): string {
    switch (role) {
      case TeamRole.Owner:
        return 'owner';
      case TeamRole.Contributor:
        return 'contributor';
      case TeamRole.Viewer:
        return 'viewer';
      default:
        return '';
    }
  }

  canManageTeam(): boolean {
    return this.role === TeamRole.Owner;
  }
  
  // Team member management
  changeRole(member: TeamMemberDisplay): void {
    if (!this.canManageTeam()) {
      this.notificationService.error('Only team owners can change member roles');
      return;
    }
    
    // For a real implementation, this would open a dialog to select a new role
    const newRole = this.getNextRole(member.role);
    
    this.apiService.updateTeamMemberRole(this.team.id, member.userId, newRole).subscribe({
      next: () => {
        // Update the local member list
        const updatedMember = this.teamMembers.find(m => m.userId === member.userId);
        if (updatedMember) {
          updatedMember.role = newRole;
        }
        
        this.notificationService.success(`Changed role for ${member.displayName || member.email} to ${this.getRoleNameFor(newRole)}`);
      },
      error: (error) => {
        console.error('Error updating member role:', error);
        this.notificationService.error('Failed to update team member role');
      }
    });
  }
  
  // Get the next role in the cycle Viewer -> Contributor -> Owner -> Viewer
  private getNextRole(currentRole: TeamRole): TeamRole {
    switch (currentRole) {
      case TeamRole.Viewer:
        return TeamRole.Contributor;
      case TeamRole.Contributor:
        return TeamRole.Owner;
      case TeamRole.Owner:
        return TeamRole.Viewer;
      default:
        return TeamRole.Viewer;
    }
  }
  
  removeMember(member: TeamMemberDisplay): void {
    if (!this.canManageTeam()) {
      this.notificationService.error('Only team owners can remove members');
      return;
    }
    
    if (member.userId === this.team.owner_id) {
      this.notificationService.error('Cannot remove the team owner');
      return;
    }
    
    if (confirm(`Are you sure you want to remove ${member.displayName || member.email} from the team?`)) {
      this.apiService.removeTeamMember(this.team.id, member.userId).subscribe({
        next: () => {
          // Remove from the local team members list
          this.teamMembers = this.teamMembers.filter(m => m.userId !== member.userId);
          this.notificationService.success(`Removed ${member.displayName || member.email} from the team`);
        },
        error: (error) => {
          console.error('Error removing team member:', error);
          this.notificationService.error('Failed to remove team member');
        }
      });
    }
  }
  
  deleteTeam(): void {
    if (!this.canManageTeam()) {
      this.notificationService.error('Only team owners can delete the team');
      return;
    }
    
    if (confirm(`Are you sure you want to delete the team "${this.team.name}"? This action cannot be undone.`)) {
      this.apiService.deleteTeam(this.team.id).subscribe({
        next: () => {
          this.notificationService.success(`Team "${this.team.name}" has been deleted`);
          
          // Switch to personal context
          this.teamService.setActiveTeam(null).subscribe();
        },
        error: (error) => {
          console.error('Error deleting team:', error);
          this.notificationService.error(`Failed to delete team: ${error.message}`);
        }
      });
    }
  }
}
