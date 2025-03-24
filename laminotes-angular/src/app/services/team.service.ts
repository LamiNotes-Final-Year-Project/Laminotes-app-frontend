// Improved TeamService with better owner recognition
import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, of, forkJoin } from 'rxjs';
import { catchError, switchMap, tap, map } from 'rxjs/operators';
import { Team, TeamRole } from '../models/team.model';
import { ApiService } from './api.service';
import { AuthService } from './auth.service';
import { NotificationService } from './notification.service';

@Injectable({
  providedIn: 'root'
})
export class TeamService {
  private readonly ACTIVE_TEAM_KEY = 'active_team';
  private activeTeamSubject = new BehaviorSubject<Team | null>(null);
  private currentUserId: string | null = null;

  constructor(
    private apiService: ApiService,
    private authService: AuthService,
    private notificationService: NotificationService
  ) {
    // Load active team from local storage
    this.loadStoredTeam();

    // Initialize current user ID
    this.initCurrentUserId();
  }

  /**
   * Initialize the current user ID from the auth service
   */
  private initCurrentUserId(): void {
    this.authService.getToken().subscribe(token => {
      if (token) {
        // If authenticated, get current user info
        this.apiService.getCurrentUser().subscribe({
          next: (user) => {
            this.currentUserId = user.user_id;
            console.log('✅ Current user ID initialized:', this.currentUserId);
          },
          error: (error) => {
            console.error('❌ Error getting current user:', error);
          }
        });
      }
    });
  }

  private loadStoredTeam(): void {
    const storedTeam = localStorage.getItem(this.ACTIVE_TEAM_KEY);
    if (storedTeam) {
      try {
        this.activeTeamSubject.next(JSON.parse(storedTeam));
        console.log('🔄 Loaded active team from storage:', this.activeTeam);
      } catch (e) {
        console.error('❌ Error parsing stored team:', e);
        localStorage.removeItem(this.ACTIVE_TEAM_KEY);
      }
    }
  }

  get activeTeam$(): Observable<Team | null> {
    return this.activeTeamSubject.asObservable();
  }

  get activeTeam(): Team | null {
    return this.activeTeamSubject.value;
  }

  setActiveTeam(team: Team | null): Observable<boolean> {
    console.log(`🔄 Setting active team: ${team ? team.name : 'personal'}`);

    if (team) {
      return this.apiService.activateTeam(team.id).pipe(
        tap(response => {
          // Update the stored token
          this.authService.saveToken(response.token).subscribe();

          // Update local storage and active team
          localStorage.setItem(this.ACTIVE_TEAM_KEY, JSON.stringify(team));
          this.activeTeamSubject.next(team);

          this.notificationService.info(`Switched to team: ${team.name}`);
        }),
        switchMap(() => of(true)),
        catchError(error => {
          console.error('❌ Error activating team:', error);
          this.notificationService.error(`Failed to switch team: ${error.message}`);
          return of(false);
        })
      );
    } else {
      return this.apiService.deactivateTeam().pipe(
        tap(response => {
          // Update the stored token
          this.authService.saveToken(response.token).subscribe();

          // Clear local storage and active team
          localStorage.removeItem(this.ACTIVE_TEAM_KEY);
          this.activeTeamSubject.next(null);

          this.notificationService.info('Switched to personal files');
        }),
        switchMap(() => of(true)),
        catchError(error => {
          console.error('❌ Error deactivating team:', error);
          this.notificationService.error(`Failed to switch to personal files: ${error.message}`);
          return of(false);
        })
      );
    }
  }

  createTeam(name: string): Observable<Team | null> {
    console.log(`🏢 Creating new team: ${name}`);
    return this.apiService.createTeam(name).pipe(
      tap(team => {
        console.log(`✅ Team created: ${team.name} (${team.id})`);
        this.notificationService.success(`Team "${team.name}" created successfully`);

        // Store the fact that the current user is the owner
        this.setCurrentUserAsOwner(team);
      }),
      catchError(error => {
        console.error('❌ Error creating team:', error);
        this.notificationService.error(`Failed to create team: ${error.message}`);
        return of(null);
      })
    );
  }

  /**
   * Explicitly mark the current user as the owner of a team
   * This helps maintain local state in sync with backend
   */
  private setCurrentUserAsOwner(team: Team): void {
    // Get current user ID if not already available
    if (!this.currentUserId) {
      this.apiService.getCurrentUser().subscribe(user => {
        this.currentUserId = user.user_id;
        // Update team owner_id locally if needed
        if (team.owner_id !== this.currentUserId) {
          team.owner_id = this.currentUserId;
        }
      });
    } else {
      // Update team owner_id locally if needed
      if (team.owner_id !== this.currentUserId) {
        team.owner_id = this.currentUserId;
      }
    }
  }

  getUserTeams(): Observable<Team[]> {
    console.log('📋 Fetching user teams');
    return this.apiService.getUserTeams().pipe(
      tap(teams => {
        console.log(`✅ Fetched ${teams.length} teams:`, teams);
      }),
      catchError(error => {
        console.error('❌ Error fetching teams:', error);
        this.notificationService.error(`Failed to fetch teams: ${error.message}`);
        return of([]);
      })
    );
  }

  /**
   * Get the user's role in a specific team
   * @param teamId The ID of the team
   */
  getUserRoleInTeam(teamId: string): Observable<TeamRole> {
    if (!teamId) {
      return of(TeamRole.Viewer); // Default role if no team
    }

    // First check if we need to get the current user
    return this.ensureCurrentUserId().pipe(
      switchMap(() => {
        // Get the team details
        return this.apiService.getUserTeams().pipe(
          map(teams => {
            const team = teams.find(t => t.id === teamId);

            if (!team) {
              console.warn(`Team ${teamId} not found in user's teams`);
              return TeamRole.Viewer; // Default if team not found
            }

            // Check if user is owner
            if (team.owner_id === this.currentUserId) {
              console.log(`User is the OWNER of team ${team.name}`);
              return TeamRole.Owner;
            }

            // For now, assume Contributor for team members
            // In a full implementation, you'd query team member roles from the backend
            console.log(`User is a CONTRIBUTOR to team ${team.name}`);
            return TeamRole.Contributor;
          }),
          catchError(error => {
            console.error('Error fetching team role:', error);
            return of(TeamRole.Viewer); // Default on error
          })
        );
      })
    );
  }

  /**
   * Makes sure we have the current user ID
   * Returns an observable that completes when user ID is available
   */
  private ensureCurrentUserId(): Observable<string | null> {
    if (this.currentUserId) {
      return of(this.currentUserId);
    }

    return this.apiService.getCurrentUser().pipe(
      map(user => {
        this.currentUserId = user.user_id;
        return this.currentUserId;
      }),
      catchError(error => {
        console.error('Error getting user ID:', error);
        return of(null);
      })
    );
  }
}
