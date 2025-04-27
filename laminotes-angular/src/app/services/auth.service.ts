import { Injectable } from '@angular/core';
import { Observable, of, throwError, BehaviorSubject } from 'rxjs';
import { catchError, tap, map } from 'rxjs/operators';
import { ApiService } from './api.service';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly AUTH_TOKEN_KEY = 'auth_token';
  private authState = new BehaviorSubject<boolean>(this.hasToken());

  constructor(private apiService: ApiService) {
    // Initialize the auth state based on existing token
    this.authState.next(this.hasToken());
  }

  private hasToken(): boolean {
    return localStorage.getItem(this.AUTH_TOKEN_KEY) !== null;
  }

  getToken(): Observable<string | null> {
    return of(localStorage.getItem(this.AUTH_TOKEN_KEY));
  }

  saveToken(token: string): Observable<void> {
    localStorage.setItem(this.AUTH_TOKEN_KEY, token);
    this.authState.next(true);
    return of(undefined);
  }

  deleteToken(): Observable<void> {
    localStorage.removeItem(this.AUTH_TOKEN_KEY);
    this.authState.next(false);
    return of(undefined);
  }

  login(email: string, password: string): Observable<string> {
    return this.apiService.loginUser(email, password).pipe(
      tap(token => this.saveToken(token)),
      catchError(error => {
        console.error('Login error:', error);
        return throwError(() => error);
      })
    );
  }

  register(email: string, password: string): Observable<void> {
    return this.apiService.registerUser(email, password);
  }

  isAuthenticated(): Observable<boolean> {
    return this.authState.asObservable();
  }

  logout(): Observable<void> {
    // First clear all team-related data from localStorage
    const teamKeys = Object.keys(localStorage).filter(key => 
      key === 'active_team' || key.startsWith('team_dir_'));
    
    teamKeys.forEach(key => localStorage.removeItem(key));
    
    // Then delete the auth token
    return this.deleteToken();
  }

  // Get the current auth state value without subscribing
  get isLoggedIn(): boolean {
    return this.authState.value;
  }
}
