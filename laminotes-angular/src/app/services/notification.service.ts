/**
 * User notification system.
 * 
 * Provides application-wide notification capabilities for displaying
 * feedback messages to users. Supports different notification types
 * and automatic timeout-based dismissal.
 */
import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

/**
 * Interface representing a notification message.
 * Defines the structure of notifications shown to users.
 */
export interface Notification {
  /** The text content of the notification */
  message: string;
  
  /** The type/severity of the notification, affecting its appearance */
  type: 'success' | 'error' | 'info' | 'warning';
  
  /** Optional timeout in milliseconds after which the notification will auto-dismiss */
  timeout?: number;
}

/**
 * Service responsible for managing application notifications.
 * Provides methods for displaying different types of notifications
 * and manages their lifecycle including automatic dismissal.
 */
@Injectable({
  providedIn: 'root'
})
export class NotificationService {
  /** Subject that maintains the current notification state */
  private notificationSubject = new BehaviorSubject<Notification | null>(null);

  constructor() { }

  /**
   * Observable stream of notification events.
   * Components can subscribe to this to display notifications in the UI.
   * 
   * @returns Observable emitting the current notification or null when cleared
   */
  get notifications$(): Observable<Notification | null> {
    return this.notificationSubject.asObservable();
  }

  /**
   * Displays a success notification.
   * Used to indicate successful completion of operations.
   * 
   * @param message The notification message to display
   * @param timeout Time in milliseconds before auto-dismissal (default: 5000ms)
   */
  success(message: string, timeout: number = 5000): void {
    this.show({ message, type: 'success', timeout });
  }

  /**
   * Displays an error notification.
   * Used to indicate failed operations or error conditions.
   * 
   * @param message The error message to display
   * @param timeout Time in milliseconds before auto-dismissal (default: 5000ms)
   */
  error(message: string, timeout: number = 5000): void {
    this.show({ message, type: 'error', timeout });
  }

  /**
   * Displays an informational notification.
   * Used for neutral information messages.
   * 
   * @param message The info message to display
   * @param timeout Time in milliseconds before auto-dismissal (default: 5000ms)
   */
  info(message: string, timeout: number = 5000): void {
    this.show({ message, type: 'info', timeout });
  }

  /**
   * Displays a warning notification.
   * Used for alerting users about potential issues that don't prevent operation.
   * 
   * @param message The warning message to display
   * @param timeout Time in milliseconds before auto-dismissal (default: 5000ms)
   */
  warning(message: string, timeout: number = 5000): void {
    this.show({ message, type: 'warning', timeout });
  }

  /**
   * Internal method to display a notification and set up its auto-dismissal.
   * 
   * @param notification The notification object to display
   */
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

  /**
   * Clears the current notification.
   * Can be called manually to dismiss notifications before their timeout expires.
   */
  clear(): void {
    this.notificationSubject.next(null);
  }
}
