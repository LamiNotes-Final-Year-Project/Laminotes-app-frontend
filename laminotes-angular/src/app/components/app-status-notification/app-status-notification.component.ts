import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-status-notification',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div *ngIf="message"
         class="notification"
         [ngClass]="{'success': type === 'success', 'error': type === 'error', 'info': type === 'info', 'warning': type === 'warning'}">
      <div class="notification-icon">
        <i class="fas"
           [ngClass]="{'fa-check-circle': type === 'success',
                      'fa-exclamation-circle': type === 'error',
                      'fa-info-circle': type === 'info',
                      'fa-exclamation-triangle': type === 'warning'}"></i>
      </div>
      <div class="notification-content">
        <div class="notification-message">{{ message }}</div>
      </div>
      <div class="notification-close" (click)="clear()">
        <i class="fas fa-times"></i>
      </div>
    </div>
  `,
  styles: [`
    .notification {
      position: fixed;
      top: 80px;
      right: 20px;
      display: flex;
      align-items: center;
      min-width: 300px;
      max-width: 450px;
      padding: 16px;
      border-radius: 6px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      z-index: 9999;
      animation: slideIn 0.3s ease, fadeOut 0.5s ease 4.5s forwards;
    }

    @keyframes slideIn {
      from { transform: translateX(100%); opacity: 0; }
      to { transform: translateX(0); opacity: 1; }
    }

    @keyframes fadeOut {
      from { opacity: 1; }
      to { opacity: 0; visibility: hidden; }
    }

    .success {
      background-color: rgba(46, 204, 113, 0.95);
      border-left: 4px solid #27ae60;
      color: white;
    }

    .error {
      background-color: rgba(231, 76, 60, 0.95);
      border-left: 4px solid #c0392b;
      color: white;
    }

    .info {
      background-color: rgba(52, 152, 219, 0.95);
      border-left: 4px solid #2980b9;
      color: white;
    }

    .warning {
      background-color: rgba(241, 196, 15, 0.95);
      border-left: 4px solid #f39c12;
      color: white;
    }

    .notification-icon {
      margin-right: 16px;
      font-size: 20px;
    }

    .notification-content {
      flex: 1;
    }

    .notification-message {
      font-size: 14px;
      font-weight: 500;
    }

    .notification-close {
      cursor: pointer;
      opacity: 0.7;
      font-size: 14px;
      transition: opacity 0.2s;
    }

    .notification-close:hover {
      opacity: 1;
    }
  `]
})
export class AppStatusNotificationComponent {
  @Input() message: string = '';
  @Input() type: 'success' | 'error' | 'info' | 'warning' = 'info';

  clear() {
    this.message = '';
  }
}
