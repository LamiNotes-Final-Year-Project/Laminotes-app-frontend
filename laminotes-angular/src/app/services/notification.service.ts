import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

export interface Notification {
  message: string;
  type: 'success' | 'error' | 'info' | 'warning';
  timeout?: number;
}

@Injectable({
  providedIn: 'root'
})
export class NotificationService {
  private notificationSubject = new BehaviorSubject<Notification | null>(null);

  constructor() { }

  // Get notifications as an observable
  get notifications$(): Observable<Notification | null> {
    return this.notificationSubject.asObservable();
  }

  // Show a success notification
  success(message: string, timeout: number = 5000): void {
    this.show({ message, type: 'success', timeout });
  }

  // Show an error notification
  error(message: string, timeout: number = 5000): void {
    this.show({ message, type: 'error', timeout });
  }

  // Show an info notification
  info(message: string, timeout: number = 5000): void {
    this.show({ message, type: 'info', timeout });
  }

  // Show a warning notification
  warning(message: string, timeout: number = 5000): void {
    this.show({ message, type: 'warning', timeout });
  }

  // Show a notification
  private show(notification: Notification): void {
    this.notificationSubject.next(notification);

    if (notification.timeout) {
      setTimeout(() => {
        // Only clear if this notification is still active
        if (this.notificationSubject.value === notification) {
          this.clear();
        }
      }, notification.timeout);
    }
  }

  // Clear the current notification
  clear(): void {
    this.notificationSubject.next(null);
  }
}
