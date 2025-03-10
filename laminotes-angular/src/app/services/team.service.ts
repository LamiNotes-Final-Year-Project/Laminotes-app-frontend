// src/app/services/team.service.ts
import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { catchError, switchMap, tap } from 'rxjs/operators';
import { Team } from '../models/team.model';
import { ApiService } from './api.service';
import { AuthService } from './auth.service';
import { NotificationService } from './notification.service';

@Injectable({
  providedIn: 'root'
})
export class TeamService {
  private readonly ACTIVE_TEAM_KEY = 'active_team';
  private activeTeamSubject = new BehaviorSubject<Team | null>(null);

  constructor(
    private apiService: ApiService,
    private authService: AuthService,
    private notificationService: NotificationService
  ) {
    // Load active team from local storage
    this.loadStoredTeam();
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
      }),
      catchError(error => {
        console.error('❌ Error creating team:', error);
        this.notificationService.error(`Failed to create team: ${error.message}`);
        return of(null);
      })
    );
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
}
