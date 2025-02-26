import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly AUTH_TOKEN_KEY = 'auth_token';

  constructor() {}

  getToken(): Observable<string | null> {
    return of(localStorage.getItem(this.AUTH_TOKEN_KEY));
  }

  saveToken(token: string): Observable<void> {
    localStorage.setItem(this.AUTH_TOKEN_KEY, token);
    return of(undefined);
  }

  deleteToken(): Observable<void> {
    localStorage.removeItem(this.AUTH_TOKEN_KEY);
    return of(undefined);
  }

  login(email: string, password: string): Observable<string> {
    // For browser-only demo, just create a mock token
    const token = `mock_token_${Date.now()}`;
    this.saveToken(token);
    return of(token);
  }

  register(email: string, password: string): Observable<void> {
    // For browser-only demo, just log the registration
    console.log(`Registered user: ${email}`);
    return of(undefined);
  }

  isAuthenticated(): Observable<boolean> {
    return of(localStorage.getItem(this.AUTH_TOKEN_KEY) !== null);
  }

  logout(): Observable<void> {
    return this.deleteToken();
  }
}
