import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

// Define interfaces for conflict data
export interface ConflictRegion {
  startLine: number;
  endLine: number;
  localContent: string;
  remoteContent: string;
  baseContent?: string;
}

export interface ConflictData {
  fileId: string;
  fileName: string;
  localVersion: string;
  remoteVersion: string;
  baseVersion?: string;
  lastLocalUpdate: string;
  lastRemoteUpdate: string;
  remoteAuthor: string;
  conflictRegions: ConflictRegion[];
}

export interface ResolutionChoice {
  regionIndex: number;
  choice: 'local' | 'remote' | 'custom';
  customContent?: string;
}

@Component({
  selector: 'app-conflict-resolution',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="conflict-resolver" *ngIf="conflictData">
      <div class="conflict-header">
        <h2>Merge Conflict Detected</h2>
        <p>
          <strong>File:</strong> {{ conflictData.fileName }} has been modified by {{ conflictData.remoteAuthor }}
          since you last opened it.
        </p>
        <p class="conflict-description">
          Please resolve the conflicts below by choosing which version to keep for each conflicting section,
          or by manually editing the content.
        </p>
      </div>

      <div class="conflict-regions">
        <!-- For each conflicting region -->
        <div *ngFor="let region of conflictData.conflictRegions; let i = index" class="conflict-region">
          <div class="region-header">
            <span class="region-label">Conflict {{ i + 1 }} (lines {{ region.startLine }}-{{ region.endLine }})</span>

            <div class="resolution-options">
              <button
                [class.active]="getResolutionChoice(i) === 'local'"
                (click)="selectResolution(i, 'local')"
                class="option-button your-version">
                Use Your Version
              </button>
              <button
                [class.active]="getResolutionChoice(i) === 'remote'"
                (click)="selectResolution(i, 'remote')"
                class="option-button their-version">
                Use Their Version
              </button>
              <button
                [class.active]="getResolutionChoice(i) === 'custom'"
                (click)="selectResolution(i, 'custom')"
                class="option-button custom-edit">
                Edit Manually
              </button>
            </div>
          </div>

          <div class="diff-view">
            <div class="version yours">
              <div class="version-header">Your Changes</div>
              <pre class="content">{{ region.localContent }}</pre>
            </div>
            <div class="version theirs">
              <div class="version-header">Their Changes</div>
              <pre class="content">{{ region.remoteContent }}</pre>
            </div>
            <div class="version base" *ngIf="region.baseContent">
              <div class="version-header">Original Version</div>
              <pre class="content">{{ region.baseContent }}</pre>
            </div>
          </div>

          <div class="manual-edit" *ngIf="getResolutionChoice(i) === 'custom'">
            <textarea
              class="custom-editor"
              [(ngModel)]="customContents[i]"
              rows="10">
            </textarea>
          </div>
        </div>
      </div>

      <div class="conflict-actions">
        <button (click)="cancel()" class="cancel-btn">Cancel</button>
        <button
          (click)="resolveConflicts()"
          [disabled]="!allConflictsResolved()"
          class="resolve-btn">
          Resolve Conflicts
        </button>
      </div>
    </div>
  `,
  styles: [`
    .conflict-resolver {
      background-color: #1A1C25;
      border: 1px solid rgba(255, 95, 31, 0.3);
      border-radius: 6px;
      padding: 20px;
      margin-bottom: 20px;
      max-height: 90vh;
      overflow-y: auto;
    }

    .conflict-header {
      margin-bottom: 20px;
    }

    .conflict-header h2 {
      color: #FF5F1F;
      margin-top: 0;
      margin-bottom: 10px;
    }

    .conflict-description {
      color: #A0A3B1;
      margin-top: 10px;
    }

    .conflict-region {
      background-color: #161820;
      border: 1px solid rgba(255, 95, 31, 0.2);
      border-radius: 4px;
      margin-bottom: 20px;
      padding: 15px;
    }

    .region-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 15px;
      flex-wrap: wrap;
    }

    .region-label {
      font-weight: 500;
      color: #F3F3F7;
    }

    .resolution-options {
      display: flex;
      gap: 10px;
    }

    .option-button {
      padding: 6px 10px;
      background-color: #22242E;
      border: 1px solid rgba(255, 95, 31, 0.2);
      border-radius: 3px;
      color: #A0A3B1;
      font-size: 12px;
      cursor: pointer;
      transition: all 0.15s ease;
    }

    .option-button:hover {
      background-color: #161820;
      color: #F3F3F7;
    }

    .option-button.active {
      background-color: rgba(255, 95, 31, 0.1);
      border-color: #FF5F1F;
      color: #FF5F1F;
    }

    .option-button.your-version.active {
      background-color: rgba(0, 229, 160, 0.1);
      border-color: #00E5A0;
      color: #00E5A0;
    }

    .option-button.their-version.active {
      background-color: rgba(56, 182, 255, 0.1);
      border-color: #38B6FF;
      color: #38B6FF;
    }

    .diff-view {
      display: flex;
      gap: 15px;
      margin-bottom: 15px;
      overflow-x: auto;
    }

    .version {
      flex: 1;
      min-width: 200px;
      border: 1px solid #22242E;
      border-radius: 3px;
    }

    .version-header {
      background-color: #22242E;
      padding: 8px 12px;
      color: #F3F3F7;
      font-size: 12px;
      font-weight: 500;
    }

    .yours .version-header {
      color: #00E5A0;
    }

    .theirs .version-header {
      color: #38B6FF;
    }

    .content {
      padding: 10px;
      margin: 0;
      max-height: 200px;
      overflow: auto;
      font-family: 'Space Grotesk', monospace;
      font-size: 14px;
      background-color: #161820;
      color: #F3F3F7;
      white-space: pre-wrap;
    }

    .manual-edit {
      margin-top: 15px;
    }

    .custom-editor {
      width: 100%;
      padding: 10px;
      background-color: #161820;
      border: 1px solid rgba(255, 95, 31, 0.2);
      border-radius: 3px;
      color: #F3F3F7;
      font-family: 'Space Grotesk', monospace;
      font-size: 14px;
      resize: vertical;
    }

    .conflict-actions {
      display: flex;
      justify-content: flex-end;
      gap: 10px;
      margin-top: 20px;
    }

    .cancel-btn {
      padding: 8px 16px;
      background-color: transparent;
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 4px;
      color: #A0A3B1;
      cursor: pointer;
    }

    .resolve-btn {
      padding: 8px 16px;
      background-color: #FF5F1F;
      border: none;
      border-radius: 4px;
      color: white;
      cursor: pointer;
    }

    .resolve-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    @media (max-width: 768px) {
      .diff-view {
        flex-direction: column;
      }

      .region-header {
        flex-direction: column;
        align-items: flex-start;
      }

      .resolution-options {
        margin-top: 10px;
        width: 100%;
        justify-content: space-between;
      }
    }
  `]
})
export class ConflictResolutionComponent implements OnInit {
  @Input() conflictData: ConflictData | null = null;
  @Output() resolved = new EventEmitter<string>();
  @Output() cancelled = new EventEmitter<void>();

  resolutions: ResolutionChoice[] = [];
  customContents: string[] = [];

  ngOnInit() {
    if (this.conflictData) {
      // Initialize customContents array with empty strings
      this.customContents = this.conflictData.conflictRegions.map(() => '');

      // Pre-fill custom content with remote version (easier to edit from there)
      this.conflictData.conflictRegions.forEach((region, index) => {
        this.customContents[index] = region.remoteContent;
      });
    }
  }

  getResolutionChoice(index: number): 'local' | 'remote' | 'custom' | null {
    const resolution = this.resolutions.find(r => r.regionIndex === index);
    return resolution ? resolution.choice : null;
  }

  selectResolution(index: number, choice: 'local' | 'remote' | 'custom') {
    // Remove any existing resolution for this region
    this.resolutions = this.resolutions.filter(r => r.regionIndex !== index);

    // Add the new resolution
    this.resolutions.push({
      regionIndex: index,
      choice
    });
  }

  resolveConflicts() {
    if (!this.conflictData || !this.allConflictsResolved()) return;

    // Start with the remote version as the base
    let resolvedContent = this.conflictData.remoteVersion;

    // Apply resolutions for each conflict region, from last to first
    // (to avoid changing line numbers as we go)
    const sortedRegions = [...this.conflictData.conflictRegions]
      .sort((a, b) => b.startLine - a.startLine);

    for (const region of sortedRegions) {
      const index = this.conflictData.conflictRegions.indexOf(region);
      const resolution = this.resolutions.find(r => r.regionIndex === index);

      if (!resolution) continue;

      // Get the content to insert based on resolution choice
      let contentToInsert = '';
      switch (resolution.choice) {
        case 'local':
          contentToInsert = region.localContent;
          break;
        case 'remote':
          contentToInsert = region.remoteContent;
          break;
        case 'custom':
          contentToInsert = this.customContents[index];
          break;
      }

      // Split the content into lines
      const lines = resolvedContent.split('\n');

      // Replace the conflict region with the resolved content
      const beforeConflict = lines.slice(0, region.startLine);
      const afterConflict = lines.slice(region.endLine);
      const resolvedLines = contentToInsert.split('\n');

      // Reassemble the content
      resolvedContent = [
        ...beforeConflict,
        ...resolvedLines,
        ...afterConflict
      ].join('\n');
    }

    this.resolved.emit(resolvedContent);
  }

  allConflictsResolved(): boolean {
    if (!this.conflictData) return false;

    // Check if we have a resolution for each conflict region
    return this.conflictData.conflictRegions.every((_, index) =>
      this.resolutions.some(r => r.regionIndex === index)
    );
  }

  cancel() {
    this.cancelled.emit();
  }
}
