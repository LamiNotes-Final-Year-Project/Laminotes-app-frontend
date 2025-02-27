import { Component, EventEmitter, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth.service';
import { NotificationService } from '../../services/notification.service';

@Component({
  selector: 'app-auth-tabs',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="auth-modal">
      <div class="auth-container">
        <div class="auth-header">
          <h2>{{ activeTab === 'login' ? 'Login' : 'Register' }}</h2>
          <button class="close-button" (click)="onCloseClick()">×</button>
        </div>

        <div class="tabs">
          <button
            [class.active]="activeTab === 'login'"
            (click)="changeTab('login')">Login</button>
          <button
            [class.active]="activeTab === 'register'"
            (click)="changeTab('register')">Register</button>
        </div>

        <div class="auth-content">
          <div *ngIf="errorMessage" class="error-message">
            {{ errorMessage }}
          </div>

          <div class="form-group">
            <label for="email">Email</label>
            <input
              type="email"
              id="email"
              [(ngModel)]="email"
              placeholder="Enter your email">
          </div>

          <div class="form-group">
            <label for="password">Password</label>
            <input
              type="password"
              id="password"
              [(ngModel)]="password"
              placeholder="Enter your password">
          </div>

          <div class="form-actions">
            <button
              *ngIf="activeTab === 'login'"
              class="primary-button"
              [disabled]="isLoading"
              (click)="login()">
              {{ isLoading ? 'Logging in...' : 'Login' }}
            </button>
            <button
              *ngIf="activeTab === 'register'"
              class="primary-button"
              [disabled]="isLoading"
              (click)="register()">
              {{ isLoading ? 'Creating account...' : 'Create Account' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .auth-modal {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background-color: rgba(15, 17, 26, 0.7);
      backdrop-filter: blur(3px);
      display: flex;
      justify-content: center;
      align-items: center;
      z-index: 1000;
    }

    .auth-container {
      background-color: #1A1C25;
      border-radius: 8px;
      width: 90%;
      max-width: 400px;
      max-height: 90vh;
      overflow-y: auto;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.25);
      border: 1px solid rgba(255, 95, 31, 0.2);
    }

    .auth-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 1.25rem 1.5rem;
      border-bottom: 1px solid rgba(255, 95, 31, 0.15);

      h2 {
        margin: 0;
        font-size: 1.5rem;
        font-weight: 600;
        color: #FF5F1F;
      }

      .close-button {
        background: none;
        border: none;
        font-size: 1.5rem;
        cursor: pointer;
        line-height: 1;
        opacity: 0.7;
        color: #A0A3B1;

        &:hover {
          opacity: 1;
          color: #F3F3F7;
        }
      }
    }

    .tabs {
      display: flex;
      border-bottom: 1px solid rgba(255, 95, 31, 0.1);

      button {
        flex: 1;
        padding: 1rem;
        background: none;
        border: none;
        border-bottom: 2px solid transparent;
        cursor: pointer;
        font-weight: 500;
        color: #A0A3B1;
        transition: all 0.15s ease;

        &.active {
          border-bottom-color: #FF5F1F;
          color: #F3F3F7;
        }

        &:hover {
          color: #F3F3F7;
          background-color: rgba(255, 95, 31, 0.05);
        }
      }
    }

    .auth-content {
      padding: 1.5rem;

      .error-message {
        background-color: rgba(231, 76, 60, 0.2);
        color: #e74c3c;
        padding: 0.75rem;
        border-radius: 4px;
        margin-bottom: 1rem;
        border-left: 3px solid #e74c3c;
      }

      .form-group {
        margin-bottom: 1.25rem;

        label {
          display: block;
          margin-bottom: 0.5rem;
          font-weight: 500;
          color: #A0A3B1;
        }

        input {
          width: 100%;
          padding: 0.75rem;
          background-color: #161820;
          border: 1px solid rgba(255, 95, 31, 0.15);
          border-radius: 4px;
          font-size: 1rem;
          color: #F3F3F7;
          box-shadow: inset 0 1px 4px rgba(0, 0, 0, 0.1);

          &:focus {
            outline: none;
            border-color: #FF5F1F;
            box-shadow: 0 0 0 2px rgba(255, 95, 31, 0.2);
          }

          &::placeholder {
            color: rgba(160, 163, 177, 0.5);
          }
        }
      }

      .form-actions {
        margin-top: 1.5rem;

        .primary-button {
          width: 100%;
          padding: 0.75rem;
          background-color: #FF5F1F;
          color: white;
          border: none;
          border-radius: 4px;
          font-size: 1rem;
          font-weight: 500;
          cursor: pointer;
          transition: background-color 0.2s;

          &:hover:not(:disabled) {
            background-color: #FF7A45;
          }

          &:disabled {
            opacity: 0.7;
            cursor: not-allowed;
          }
        }
      }
    }
  `]
})
export class AuthTabsComponent {
  @Output() success = new EventEmitter<void>();
  @Output() close = new EventEmitter<void>();

  activeTab: 'login' | 'register' = 'login';
  email: string = '';
  password: string = '';
  isLoading: boolean = false;
  errorMessage: string | null = null;

  constructor(
    private authService: AuthService,
    private notificationService: NotificationService
  ) {}

  login(): void {
    if (!this.email || !this.password) {
      this.errorMessage = 'Please enter both email and password';
      return;
    }

    this.isLoading = true;
    this.errorMessage = null;

    this.authService.login(this.email, this.password).subscribe({
      next: () => {
        this.notificationService.success('Login successful!');
        this.success.emit();
        this.close.emit();
      },
      error: (error) => {
        this.errorMessage = `Login failed: ${error.message}`;
        this.isLoading = false;
      }
    });
  }

  register(): void {
    if (!this.email || !this.password) {
      this.errorMessage = 'Please enter both email and password';
      return;
    }

    this.isLoading = true;
    this.errorMessage = null;

    this.authService.register(this.email, this.password).subscribe({
      next: () => {
        this.notificationService.success('Account created successfully! Please log in.');
        this.activeTab = 'login';
        this.isLoading = false;
      },
      error: (error) => {
        this.errorMessage = `Registration failed: ${error.message}`;
        this.isLoading = false;
      }
    });
  }

  changeTab(tab: 'login' | 'register'): void {
    this.activeTab = tab;
    this.errorMessage = null;
  }

  onCloseClick(): void {
    this.close.emit();
  }
}
