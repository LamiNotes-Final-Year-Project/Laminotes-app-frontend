import { Component, EventEmitter, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-auth-tabs',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './auth-tabs.component.html',
  styleUrls: ['./auth-tabs.component.scss']
})
export class AuthTabsComponent {
  @Output() success = new EventEmitter<void>();
  @Output() close = new EventEmitter<void>();

  activeTab: 'login' | 'register' = 'login';
  email: string = '';
  password: string = '';
  isLoading: boolean = false;
  errorMessage: string | null = null;

  constructor(private authService: AuthService) {}

  login(): void {
    if (!this.email || !this.password) {
      this.errorMessage = 'Please enter both email and password';
      return;
    }

    this.isLoading = true;
    this.errorMessage = null;

    this.authService.login(this.email, this.password).subscribe({
      next: () => {
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
        this.activeTab = 'login';
        this.errorMessage = 'Account created! Please login.';
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
