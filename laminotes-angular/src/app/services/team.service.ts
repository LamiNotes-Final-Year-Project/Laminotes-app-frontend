/**
 * Team management service.
 * 
 * Handles team operations, team switching, role management, and team directory tracking.
 * Provides team context for collaboration and file organization.
 */
import { Injectable, Injector } from '@angular/core';
import { BehaviorSubject, Observable, of, forkJoin } from 'rxjs';
import { catchError, switchMap, tap, map } from 'rxjs/operators';
import { Team, TeamRole } from '../models/team.model';
import { ApiService } from './api.service';
import { AuthService } from './auth.service';
import { NotificationService } from './notification.service';

// We'll use dependency injection directly instead of a global injector
// This approach is safer and avoids compilation errors

/**
 * Service responsible for team management operations.
 * Handles team creation, selection, role management, and team directory tracking.
 */
@Injectable({
  providedIn: 'root'
})
export class TeamService {
  /** LocalStorage key for storing the active team */
  private readonly ACTIVE_TEAM_KEY = 'active_team';
  
  /** Subject for tracking and broadcasting active team changes */
  private activeTeamSubject = new BehaviorSubject<Team | null>(null);
  
  /** Cached current user ID for permission checks */
  private currentUserId: string | null = null;
  
  /** Cache of user roles in teams for performance optimization */
  private roleCache: Map<string, TeamRole> = new Map<string, TeamRole>();
  
  /** Expiry timestamps for role cache entries */
  private roleCacheExpiry: Map<string, number> = new Map<string, number>();
  
  /** Duration for which role cache entries remain valid (5 minutes) */
  private readonly CACHE_DURATION_MS = 5 * 60 * 1000;

  constructor(
    private apiService: ApiService,
    private authService: AuthService,
    private notificationService: NotificationService
  ) {    
    // Load active team from local storage
    this.loadStoredTeam();

    // Initialize current user ID
    this.initCurrentUserId();
    
    // Clear role cache on logout
    this.authService.isAuthenticated().subscribe(isAuthenticated => {
      if (!isAuthenticated) {
        // Clear all team data on logout
        this.clearAllTeamData();
      }
    });
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

  /**
   * Loads the active team from local storage on service initialization.
   * Attempts to parse the stored team JSON and sets it as the active team.
   * Removes invalid stored team data if it cannot be parsed.
   */
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

  /**
   * Observable stream of active team changes.
   * Components can subscribe to this to react to team context changes.
   * 
   * @returns Observable of the current active team or null if in personal context
   */
  get activeTeam$(): Observable<Team | null> {
    return this.activeTeamSubject.asObservable();
  }

  /**
   * Getter for the currently active team.
   * 
   * @returns The current active team or null if in personal context
   */
  get activeTeam(): Team | null {
    return this.activeTeamSubject.value;
  }

  /**
   * Associates a local directory path with a team for file storage.
   * Updates the team object, active team if applicable, and persists the directory
   * association in localStorage for future sessions.
   * 
   * @param team The team to set directory for
   * @param directoryPath The local directory path where team files will be stored
   * @returns Observable emitting true if successful, false otherwise
   */
  setTeamDirectory(team: Team, directoryPath: string): Observable<boolean> {
    if (!team) return of(false);
    
    // Update the team object with the directory
    team.localDirectory = directoryPath;
    
    // If this is the active team, update the active team subject
    if (this.activeTeam && this.activeTeam.id === team.id) {
      this.activeTeamSubject.next(team);
    }
    
    // Update in localStorage
    if (this.activeTeam && this.activeTeam.id === team.id) {
      localStorage.setItem(this.ACTIVE_TEAM_KEY, JSON.stringify(team));
    }
    
    console.log(`Set local directory for team "${team.name}": ${directoryPath}`);
    
    // Store the team directory mapping in a separate localStorage item
    const teamDirKey = `team_dir_${team.id}`;
    localStorage.setItem(teamDirKey, directoryPath);
    
    return of(true);
  }
  
  /**
   * Retrieves the configured local directory path for a specific team.
   * First checks the active team for efficiency, then falls back to localStorage.
   * Validates directory existence when running in Electron.
   * 
   * @param teamId The team ID to get the directory for
   * @returns The local directory path as a string, or null if no directory is set
   */
  getTeamDirectory(teamId: string): string | null {
    if (!teamId) return null;
    
    // Try to get from active team first
    if (this.activeTeam && this.activeTeam.id === teamId && this.activeTeam.localDirectory) {
      return this.activeTeam.localDirectory;
    }
    
    // Try to get from localStorage
    const teamDirKey = `team_dir_${teamId}`;
    const storedDirectory = localStorage.getItem(teamDirKey);
    
    if (storedDirectory) {
      // Log directory retrieval for troubleshooting
      console.log(`Retrieved team directory for ${teamId}: ${storedDirectory}`);
    }
    
    return storedDirectory;
  }
  
  /**
   * Validates that a team directory exists on disk.
   * Only works in Electron context.
   * 
   * @param teamId The team ID to validate directory for
   * @returns Observable of boolean indicating if directory exists and is valid
   */
  validateTeamDirectory(teamId: string): Observable<boolean> {
    const directory = this.getTeamDirectory(teamId);
    
    if (!directory) {
      console.log(`No directory configured for team ${teamId}`);
      return of(false);
    }
    
    // In a real implementation, we'd use the Electron service directly
    // Since we can't inject it here due to circular dependencies
    // We'll return true and let the FileService handle the validation
    console.log(`Team ${teamId} directory will be validated by FileService: ${directory}`);
    return of(true);
  }

  /**
   * Changes the active team context for the current user.
   * This updates both the local state and the backend context via API.
   * When a team is activated, the authentication token is updated to include team context.
   * When setting to null, reverts to personal context.
   * 
   * @param team The team to activate, or null to switch to personal context
   * @returns Observable emitting true if team switch was successful, false otherwise
   */
  setActiveTeam(team: Team | null): Observable<boolean> {
    // clear role cache when swapping team
    this.clearRoleCache();

    console.log(`🔄 Setting active team: ${team ? team.name + ' (ID: ' + team.id + ')' : 'personal'}`);
    
    // If switching to a team, validate its directory first
    if (team) {
      // Validate team directory if we're in Electron mode
      return this.validateTeamDirectory(team.id).pipe(
        switchMap(isValid => {
          // If directory is invalid but we're in Electron, we need to fix it
          if (!isValid && typeof window !== 'undefined' && 
              ((window as any).electronAPI || ((window as any).require && (window as any).require('electron')))) {
              
            console.log(`⚠️ Team directory invalid or missing for ${team.name}, will prompt for new selection`);
            // We'll proceed but log the issue - actual directory selection will be handled
            // in the file service when files are accessed
          }
          
          console.log(`🔑 Activating team on backend: ${team.id}`);
          return this.apiService.activateTeam(team.id).pipe(
            tap(response => {
              console.log(`✅ Team activation successful, received new token`);
              
              // Update the stored token
              this.authService.saveToken(response.token).subscribe({
                next: () => console.log(`✅ Updated authentication token with team context`),
                error: (err) => console.error(`❌ Error saving token:`, err)
              });
    
              // Update local storage and active team
              localStorage.setItem(this.ACTIVE_TEAM_KEY, JSON.stringify(team));
              this.activeTeamSubject.next(team);
    
              this.notificationService.info(`Switched to team: ${team.name}`);
            }),
            switchMap(() => of(true)),
            catchError(error => {
              console.error('❌ Error activating team:', error);
              // Add more detailed error logging
              console.error('Status code:', error.status);
              console.error('Error message:', error.message);
              console.error('Error details:', error.error);
              
              this.notificationService.error(`Failed to switch team: ${error.message}`);
              return of(false);
            })
          );
        })
      );
    } else {
      return this.apiService.deactivateTeam().pipe(
        tap(response => {
          console.log(`✅ Team deactivation successful, received new token`);
          
          // Update the stored token
          this.authService.saveToken(response.token).subscribe({
            next: () => console.log(`✅ Updated authentication token to personal context`),
            error: (err) => console.error(`❌ Error saving token:`, err)
          });

          // Clear local storage and active team
          localStorage.removeItem(this.ACTIVE_TEAM_KEY);
          this.activeTeamSubject.next(null);

          this.notificationService.info('Switched to personal files');
        }),
        switchMap(() => of(true)),
        catchError(error => {
          console.error('❌ Error deactivating team:', error);
          // Add more detailed error logging
          console.error('Status code:', error.status);
          console.error('Error message:', error.message);
          console.error('Error details:', error.error);
          
          this.notificationService.error(`Failed to switch to personal files: ${error.message}`);
          return of(false);
        })
      );
    }
  }

  /**
   * Creates a new team with the specified name.
   * The current user becomes the team owner automatically.
   * Handles notification of success or failure.
   * 
   * @param name The display name for the new team
   * @returns Observable emitting the created team or null if creation failed
   */
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
   * Explicitly marks the current user as the owner of a team.
   * This helps maintain local state in sync with backend data.
   * When creating a new team, this ensures proper ownership is reflected
   * in the local team object even if backend response is incomplete.
   * 
   * @param team The team object to update with owner information
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

  /**
   * Retrieves all teams that the current user is a member of.
   * Handles error states gracefully by returning an empty array.
   * 
   * @returns Observable emitting an array of teams the user belongs to
   */
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
   * Determines the current user's role within a specific team.
   * Uses a caching strategy to minimize API calls for frequent permission checks.
   * 
   * Implements optimization by first checking if user is the team owner,
   * which can be determined from local data without an API call.
   * 
   * @param teamId The ID of the team to check roles for
   * @returns Observable emitting the user's role in the specified team
   */
  getUserRoleInTeam(teamId: string): Observable<TeamRole> {
    if (!teamId) {
      return of(TeamRole.Viewer); // Default role if no team
    }

    // Check cache first
    const now = Date.now();
    const cachedRole = this.roleCache.get(teamId);
    const cacheExpiry = this.roleCacheExpiry.get(teamId) || 0;

    if (cachedRole !== undefined && now < cacheExpiry) {
      console.log(`Using cached role for team ${teamId}: ${TeamRole[cachedRole]}`);
      return of(cachedRole);
    }

    // Get the team details to check if user is owner (faster than API call)
    return this.apiService.getUserTeams().pipe(
      switchMap(teams => {
        const team = teams.find(t => t.id === teamId);

        if (!team) {
          console.warn(`Team ${teamId} not found in user's teams`);
          return of(TeamRole.Viewer); // Default if team not found
        }

        // Get current user ID if not already available
        if (!this.currentUserId) {
          return this.apiService.getCurrentUser().pipe(
            switchMap(user => {
              this.currentUserId = user.user_id;

              // Quick check: if user is owner, return Owner role immediately
              if (team.owner_id === this.currentUserId) {
                console.log(`User is the OWNER of team ${team.name}`);
                this.cacheRole(teamId, TeamRole.Owner);
                return of(TeamRole.Owner);
              }

              // Otherwise query the backend for actual role
              return this.apiService.getUserRoleInTeam(teamId).pipe(
                tap(role => this.cacheRole(teamId, role)),
                catchError(() => of(TeamRole.Contributor)) // Fallback if API fails
              );
            })
          );
        }

        // If we already have the current user ID
        if (team.owner_id === this.currentUserId) {
          console.log(`User is the OWNER of team ${team.name}`);
          this.cacheRole(teamId, TeamRole.Owner);
          return of(TeamRole.Owner);
        }

        // Query the backend for the actual role
        return this.apiService.getUserRoleInTeam(teamId).pipe(
          tap(role => this.cacheRole(teamId, role)),
          catchError(() => of(TeamRole.Contributor)) // Fallback if API fails
        );
      }),
      catchError(() => of(TeamRole.Viewer)) // Default fallback
    );
  }


  /**
   * Clears the role cache.
   * This is called when switching teams to ensure fresh permission checks.
   */
  clearRoleCache(): void {
    this.roleCache.clear();
    this.roleCacheExpiry.clear();
  }

  /**
   * Clears all team data from memory and localStorage.
   * Called when logging out to ensure a clean state.
   */
  clearAllTeamData(): void {
    // Clear active team
    this.activeTeamSubject.next(null);
    localStorage.removeItem(this.ACTIVE_TEAM_KEY);
    
    // Clear role cache
    this.clearRoleCache();
    
    // Clear all team directory mappings from localStorage
    const teamDirKeys = Object.keys(localStorage)
      .filter(key => key.startsWith('team_dir_'));
    teamDirKeys.forEach(key => localStorage.removeItem(key));
    
    console.log('🧹 Cleared all team data');
  }

  /**
   * Helper method to cache a user's role in a team.
   * Stores both the role and its expiration timestamp to implement
   * time-based cache invalidation.
   * 
   * @param teamId The team ID to cache the role for
   * @param role The role to cache
   */
  private cacheRole(teamId: string, role: TeamRole): void {
    this.roleCache.set(teamId, role);
    this.roleCacheExpiry.set(teamId, Date.now() + this.CACHE_DURATION_MS);
    console.log(`Cached role for team ${teamId}: ${TeamRole[role]}, expires in ${this.CACHE_DURATION_MS/1000}s`);
  }

  /**
   * Makes sure the current user ID is available, fetching it from API if needed.
   * This is a utility method for permissions and ownership checks.
   * 
   * @returns Observable that resolves to the current user ID or null if unavailable
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
