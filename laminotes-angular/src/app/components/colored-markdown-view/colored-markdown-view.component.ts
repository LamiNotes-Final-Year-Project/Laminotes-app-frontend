import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MarkdownModule } from 'ngx-markdown';
import { ColoredSectionsOverlayComponent } from '../colored-sections-overlay/colored-sections-overlay.component';

@Component({
  selector: 'app-colored-markdown-view',
  standalone: true,
  imports: [CommonModule, MarkdownModule, ColoredSectionsOverlayComponent],
  template: `
    <div class="markdown-container">
      <markdown class="markdown-content" [data]="content"></markdown>

      <app-colored-sections-overlay
        *ngIf="hasUserColors"
        [content]="content"
        [userColors]="userColors">
      </app-colored-sections-overlay>
    </div>
  `,
  styles: [`
    .markdown-container {
      position: relative;
      height: 100%;
      display: flex;
      flex-direction: column;
      overflow: auto;
    }

    .markdown-content {
      position: relative;
      z-index: 1;
      padding: 1rem;
      min-height: 100%;
      flex: 1;
      background-color: transparent;
    }
  `]
})
export class ColoredMarkdownViewComponent implements OnChanges {
  @Input() content: string = '';
  @Input() userColors: Record<string, string> = {};

  hasUserColors: boolean = false;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['userColors']) {
      this.hasUserColors = Object.keys(this.userColors || {}).length > 0;
    }
  }
}
