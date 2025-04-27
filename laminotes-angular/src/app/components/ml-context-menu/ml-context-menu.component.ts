import { Component, OnInit, Input, Output, EventEmitter, ViewChild, ElementRef, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MlService } from '../../services/ml-service';
import { NotificationService } from '../../services/notification.service';

export interface MlAction {
  type: 'reformat' | 'code' | 'mermaid';
  text: string;
  language?: string; // For code generation
}

@Component({
  selector: 'app-ml-context-menu',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div #contextMenu class="context-menu" [ngStyle]="menuPosition">
      <div class="menu-header">
        <span>AI Actions</span>
        <button class="close-btn" (click)="close()">×</button>
      </div>
      <div class="menu-options">
        <button class="menu-option" [disabled]="!isServiceAvailable" (click)="selectAction('reformat')">
          <i class="fas fa-paragraph"></i> Reformat Text
        </button>
        <button class="menu-option" [disabled]="!isServiceAvailable" (click)="selectAction('code')">
          <i class="fas fa-code"></i> Generate Code
        </button>
        <button class="menu-option" [disabled]="!isServiceAvailable" (click)="selectAction('mermaid')">
          <i class="fas fa-project-diagram"></i> Create Diagram
        </button>
      </div>
      <div class="offline-indicator" *ngIf="!isServiceAvailable">
        <i class="fas fa-wifi-slash"></i> AI features unavailable offline
      </div>
    </div>
  `,
  styles: [`
    .context-menu {
      position: fixed;
      background-color: #1A1C25;
      border: 1px solid rgba(255, 95, 31, 0.3);
      border-radius: 6px;
      min-width: 200px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
      z-index: 1000;
      overflow: hidden;
      display: none;
    }

    .menu-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 10px 12px;
      background-color: rgba(255, 95, 31, 0.1);
      border-bottom: 1px solid rgba(255, 95, 31, 0.2);
    }

    .menu-header span {
      font-weight: 500;
      color: #FF5F1F;
    }

    .close-btn {
      background: none;
      border: none;
      font-size: 18px;
      color: #F3F3F7;
      cursor: pointer;
    }

    .menu-options {
      padding: 6px 0;
    }

    .menu-option {
      display: flex;
      align-items: center;
      width: 100%;
      text-align: left;
      padding: 10px 14px;
      border: none;
      background: none;
      color: #F3F3F7;
      cursor: pointer;
      transition: background-color 0.15s;
    }

    .menu-option:hover:not(:disabled) {
      background-color: #22242E;
    }

    .menu-option:active:not(:disabled) {
      background-color: rgba(255, 95, 31, 0.1);
    }

    .menu-option:disabled {
      color: #555;
      cursor: not-allowed;
    }

    .menu-option i {
      margin-right: 10px;
      width: 16px;
      text-align: center;
      color: #FF5F1F;
    }

    .menu-option:disabled i {
      color: #555;
    }

    .offline-indicator {
      padding: 8px 12px;
      font-size: 12px;
      color: #A0A3B1;
      background-color: rgba(0, 0, 0, 0.2);
      display: flex;
      align-items: center;
    }

    .offline-indicator i {
      margin-right: 8px;
      color: #FF5F1F;
    }

    /* Mobile optimizations */
    @media (max-width: 768px) {
      .menu-option {
        padding: 12px 14px; /* Larger touch targets */
      }
    }
  `]
})
export class MlContextMenuComponent implements OnInit {
  @ViewChild('contextMenu') contextMenuRef!: ElementRef;
  @Output() actionSelected = new EventEmitter<MlAction>();
  @Output() closed = new EventEmitter<void>();

  menuPosition = { top: '0px', left: '0px', display: 'none' };
  selectedText = '';
  isServiceAvailable = true;

  constructor(
    private mlService: MlService,
    private notificationService: NotificationService
  ) {}

  ngOnInit(): void {
    this.isServiceAvailable = this.mlService.isAvailable();
  }

  /**
   * Shows the context menu at the specified position
   * @param x X position for the menu
   * @param y Y position for the menu
   * @param text Selected text to process
   */
  show(x: number, y: number, text: string): void {
    // Verify we have valid input
    if (!text || text.trim().length === 0) {
      return;
    }

    this.selectedText = text;
    this.isServiceAvailable = this.mlService.isAvailable();

    // Position the menu
    const menu = this.contextMenuRef.nativeElement;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    // Ensure the menu is visible for measurement
    this.menuPosition = { 
      top: '0px', 
      left: '0px', 
      display: 'block' 
    };

    // Allow render cycle to complete
    setTimeout(() => {
      const menuWidth = menu.offsetWidth;
      const menuHeight = menu.offsetHeight;

      // Adjust position to ensure menu stays within viewport
      let adjustedX = x;
      let adjustedY = y;

      if (x + menuWidth > viewportWidth) {
        adjustedX = viewportWidth - menuWidth - 10;
      }

      if (y + menuHeight > viewportHeight) {
        adjustedY = viewportHeight - menuHeight - 10;
      }

      // Update position
      this.menuPosition = {
        top: `${adjustedY}px`,
        left: `${adjustedX}px`,
        display: 'block'
      };
    }, 0);
  }

  /**
   * Closes the context menu
   */
  close(): void {
    this.menuPosition = { top: '0px', left: '0px', display: 'none' };
    this.closed.emit();
  }

  /**
   * Handles selection of an ML action
   * @param actionType The type of action to perform
   */
  selectAction(actionType: 'reformat' | 'code' | 'mermaid'): void {
    if (!this.isServiceAvailable) {
      this.notificationService.warning('AI features are not available offline');
      return;
    }

    // Emit the selected action
    this.actionSelected.emit({
      type: actionType,
      text: this.selectedText
    });

    // Close the menu
    this.close();
  }

  /**
   * Close the menu when clicking outside
   */
  @HostListener('document:click', ['$event'])
  handleDocumentClick(event: MouseEvent): void {
    if (this.menuPosition.display === 'none') return;
    
    const clickedElement = event.target as HTMLElement;
    const menu = this.contextMenuRef.nativeElement;
    
    if (!menu.contains(clickedElement)) {
      this.close();
    }
  }
}