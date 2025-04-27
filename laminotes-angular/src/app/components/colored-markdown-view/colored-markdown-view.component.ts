import { Component, Input, OnChanges, SimpleChanges, AfterViewChecked, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MarkdownModule, MarkdownService } from 'ngx-markdown';
import { ColoredSectionsOverlayComponent } from '../colored-sections-overlay/colored-sections-overlay.component';

declare global {
  interface Window {
    Prism: any;
    mermaid: any;
  }
}

@Component({
  selector: 'app-colored-markdown-view',
  standalone: true,
  imports: [CommonModule, MarkdownModule, ColoredSectionsOverlayComponent],
  template: `
    <div class="markdown-container">
      <div #markdownScrollable class="markdown-scrollable">
        <markdown
          class="markdown-content"
          [data]="content"
          [disableSanitizer]="true"
        ></markdown>

        <app-colored-sections-overlay
          *ngIf="hasUserColors"
          [content]="content"
          [userColors]="userColors">
        </app-colored-sections-overlay>
      </div>
    </div>
  `,
  styles: [`
    .markdown-container {
      position: relative;
      height: 100%;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }

    .markdown-scrollable {
      position: relative;
      height: 100%;
      overflow-y: auto;
      overflow-x: auto;
      display: block;
      max-height: 100%;
    }

    .markdown-content {
      position: relative;
      z-index: 1;
      padding: 1rem;
      width: 100%;
      background-color: transparent;
      font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
    }

    :host ::ng-deep pre {
      background-color: #161b22;
      border-radius: 6px;
      padding: 16px;
      overflow-x: auto;
      margin: 1em 0;
    }

    :host ::ng-deep code {
      font-family: Menlo, Monaco, Consolas, "Courier New", monospace;
    }

    :host ::ng-deep .mermaid {
      background-color: #1e1e1e;
      border-radius: 6px;
      padding: 16px;
      margin: 1em 0;
      text-align: center;
    }

    :host ::ng-deep .mermaid-error {
      background-color: rgba(255, 50, 50, 0.1);
      border: 1px solid rgba(255, 50, 50, 0.3);
      border-radius: 6px;
      padding: 16px;
      color: #ff5f5f;
      text-align: left;
    }

    :host ::ng-deep .mermaid-error pre {
      background-color: rgba(0, 0, 0, 0.2);
      padding: 10px;
      border-radius: 4px;
      overflow-x: auto;
      font-family: monospace;
      font-size: 12px;
      color: #f1f1f1;
    }

    :host ::ng-deep h1, ::ng-deep h2, ::ng-deep h3, ::ng-deep h4, ::ng-deep h5, ::ng-deep h6 {
      margin-top: 24px;
      margin-bottom: 16px;
      font-weight: 600;
      line-height: 1.25;
    }

    :host ::ng-deep table {
      border-collapse: collapse;
      width: 100%;
      margin: 1em 0;
    }

    :host ::ng-deep table th, ::ng-deep table td {
      border: 1px solid #30363d;
      padding: 6px 13px;
    }

    :host ::ng-deep table tr {
      background-color: #161b22;
      border-top: 1px solid #30363d;
    }

    :host ::ng-deep blockquote {
      border-left: 3px solid #30363d;
      padding-left: 16px;
      color: #8b949e;
      margin: 1em 0;
    }

    :host ::ng-deep .image-placeholder {
      display: flex;
      align-items: center;
      background-color: rgba(255, 95, 31, 0.1);
      border: 1px dashed rgba(255, 95, 31, 0.3);
      border-radius: 6px;
      padding: 12px;
      margin: 16px auto; /* Center placeholders like images */
      max-width: 100%; /* Full width on small screens */
      width: 500px; /* Target width */
      break-inside: avoid; /* Avoid breaking across pages */
    }

    /* Responsive sizes for different screen widths */
    @media (max-width: 768px) {
      :host ::ng-deep .image-placeholder {
        width: 100%;
      }
    }

    @media print {
      :host ::ng-deep .image-placeholder {
        background-color: #f8f8f8; /* Lighter background for print */
        border: 1px solid #ddd;
        color: #333;
      }
    }

    :host ::ng-deep .image-icon {
      width: 40px;
      height: 40px;
      border-radius: 6px;
      background-color: rgba(255, 95, 31, 0.2);
      display: flex;
      align-items: center;
      justify-content: center;
      margin-right: 12px;
    }

    :host ::ng-deep .image-icon i {
      color: #FF5F1F;
      font-size: 24px;
    }

    :host ::ng-deep .image-info {
      display: flex;
      flex-direction: column;
    }

    :host ::ng-deep .image-name {
      font-weight: 500;
      margin-bottom: 4px;
    }

    :host ::ng-deep .image-size {
      font-size: 12px;
      color: #a0a3b1;
    }

    :host ::ng-deep .markdown-image {
      max-width: 100%;
      max-height: 500px; /* Limit height for PDF output */
      border-radius: 6px;
      display: block;
      margin: 16px auto; /* Center images */
      object-fit: contain; /* Maintain aspect ratio */
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2); /* Add subtle shadow for depth */
    }

    :host ::ng-deep .image-preview-placeholder {
      display: flex;
      align-items: center;
      background-color: rgba(255, 95, 31, 0.15);
      border: 2px solid rgba(255, 95, 31, 0.3);
      border-radius: 6px;
      padding: 24px;
      margin: 16px auto;
      width: 80%;
      max-width: 500px;
      text-align: center;
      color: #FF5F1F;
    }

    @media print {
      :host ::ng-deep .markdown-image {
        max-height: 400px; /* Further limit height when printing to PDF */
        break-inside: avoid; /* Avoid breaking images across pages */
        page-break-inside: avoid; /* Legacy property for older browsers */
      }

      :host ::ng-deep .image-preview-placeholder {
        background-color: #f8f8f8; /* Lighter background for print */
        border: 1px solid #ddd;
        color: #333;
      }
    }
  `]
})
export class ColoredMarkdownViewComponent implements OnChanges, AfterViewChecked {
  @Input() content: string = '';
  @Input() userColors: Record<string, string> = {};
  @ViewChild('markdownScrollable') markdownScrollable!: ElementRef;

  hasUserColors: boolean = false;
  private contentChanged = false;

  /**
   * Sets up the component and configures the markdown renderer
   * @param markdownService The injected MarkdownService
   */
  constructor(private markdownService: MarkdownService) {
    // Define a custom renderer function that matches the expected interface
    // The renderer expects a function that takes an object with href, title, and text properties
    this.markdownService.renderer.image = (image: { href: string; title: string | null; text: string }) => {
      // Delegate to implementation method
      return this.customImageRenderer(image.href, image.title, image.text);
    };
  }

  /**
   * Custom renderer for markdown images that enhances the display of
   * placeholder images and controls the size of actual images.
   * @param href The URL or data URL of the image
   * @param title The title attribute (optional)
   * @param text The alt text for the image
   * @returns HTML markup for the image
   */
  private customImageRenderer(href: string, title: string | null, text: string): string {
    // Check if this is our special image placeholder format: IMAGE:size:filename
    if (href && href.startsWith('IMAGE:')) {
      const parts = href.split(':');
      if (parts.length >= 3) {
        const size = parts[1];
        const filename = parts.slice(2).join(':'); // In case filename contains colons

        // Create a placeholder with preview styling
        return `
          <div class="image-placeholder">
            <div class="image-icon"><i class="fas fa-image"></i></div>
            <div class="image-info">
              <span class="image-name">${filename}</span>
              <span class="image-size">${size}</span>
            </div>
          </div>
        `;
      }
    }

    // For preview-placeholder, render a simple image icon instead of the message
    if (href === 'preview-placeholder') {
      return `<img src="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgdmlld0JveD0iMCAwIDEwMCAxMDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CiAgPHJlY3Qgd2lkdGg9IjEwMCIgaGVpZ2h0PSIxMDAiIGZpbGw9IiMzMzMiIHJ4PSI1IiAvPgogIDxjaXJjbGUgY3g9IjM1IiBjeT0iMzUiIHI9IjEwIiBmaWxsPSIjZmY1ZjFmIiAvPgogIDxwYXRoIGQ9Ik0zMCA4MEw3MCAzMEw5MCA3MEwzMCA4MHoiIGZpbGw9IiNmZjVmMWYiIC8+Cjwvc3ZnPgo=" alt="Image Preview" class="markdown-image" style="max-width: 150px; height: auto; margin: 10px auto; display: block;" />`;
    }

    // Default image rendering for normal images or data URLs with size limits for PDF output
    const titleAttr = title ? ` title="${title}"` : '';
    return `<img src="${href}" alt="${text}"${titleAttr} class="markdown-image">`;
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['userColors']) {
      this.hasUserColors = Object.keys(this.userColors || {}).length > 0;
    }

    if (changes['content']) {
      this.contentChanged = true;
    }
  }

  ngAfterViewChecked(): void {
    if (this.contentChanged) {
      this.processContent();
      this.contentChanged = false;
    }
  }

  private processContent(): void {
    // Use a timeout to allow Angular to finish rendering the markdown content
    setTimeout(() => {
      this.processMermaidDiagrams();
      this.highlightCodeBlocks();
    }, 300);
  }

  private processMermaidDiagrams(): void {
    try {
      console.log('Processing Mermaid diagrams...');

      // Find all code blocks with mermaid language
      const mermaidCodeBlocks = document.querySelectorAll('code.language-mermaid');
      console.log(`Found ${mermaidCodeBlocks.length} Mermaid code blocks`);

      mermaidCodeBlocks.forEach((codeBlock, index) => {
        const preElement = codeBlock.parentElement;
        if (!preElement) return;

        // Get the mermaid syntax
        let mermaidSyntax = codeBlock.textContent?.trim() || '';
        if (!mermaidSyntax) return;

        console.log(`Processing Mermaid block ${index + 1}:`, mermaidSyntax.substring(0, 50) + '...');

        // Try to fix common Mermaid syntax issues
        mermaidSyntax = this.fixMermaidSyntax(mermaidSyntax);

        // Create a dedicated mermaid div
        const mermaidDiv = document.createElement('div');
        mermaidDiv.className = 'mermaid';
        mermaidDiv.id = `mermaid-diagram-${index}`;
        mermaidDiv.textContent = mermaidSyntax;

        // Insert the mermaid div before the pre element
        const parentElement = preElement.parentElement;
        if (parentElement) {
          parentElement.insertBefore(mermaidDiv, preElement);

          // Hide the original code block
          preElement.style.display = 'none';
        }
      });

      // Initialize mermaid with proper configuration
      if (window.mermaid) {
        console.log('Initializing mermaid with proper configuration');
        try {
          window.mermaid.initialize({
            startOnLoad: false,
            theme: 'dark',
            securityLevel: 'loose',
            fontFamily: 'Space Grotesk'
          });
        } catch (e) {
          console.error('Error initializing mermaid:', e);
        }

        console.log('Rendering diagrams with mermaid.contentLoaded()');
        try {
          // This triggers rendering of all mermaid diagrams
          window.mermaid.contentLoaded();
        } catch (e) {
          console.error('Error during mermaid.contentLoaded():', e);

          // Try an alternative rendering approach
          try {
            console.log('Trying alternative rendering method');
            const diagrams = document.querySelectorAll('.mermaid');
            diagrams.forEach((diagram, i) => {
              try {
                const id = `mermaid-diagram-rendered-${i}`;
                const content = diagram.textContent || '';
                window.mermaid.render(id, content).then((result: { svg: string }) => {
                  diagram.innerHTML = result.svg;
                }).catch((err: { message?: string }) => {
                  console.error(`Error rendering diagram ${i}:`, err);
                  // Show the error in the diagram div
                  diagram.innerHTML = `<div class="mermaid-error">
                    <p>Mermaid syntax error:</p>
                    <pre>${err.message || 'Unknown error'}</pre>
                    <p>Original code:</p>
                    <pre>${content}</pre>
                  </div>`;
                });
              } catch (renderErr) {
                console.error(`Error in render attempt for diagram ${i}:`, renderErr);
              }
            });
          } catch (alternativeErr) {
            console.error('Alternative rendering also failed:', alternativeErr);
          }
        }
      } else {
        console.warn('Global mermaid object not available');
      }
    } catch (e) {
      console.error('Error processing Mermaid diagrams:', e);
    }
  }

  /**
   * Attempts to fix common issues with Mermaid syntax
   */
  private fixMermaidSyntax(syntax: string): string {
    // Check if it has a valid chart type at the beginning
    const validChartTypes = [
      'flowchart', 'graph', 'sequenceDiagram', 'classDiagram',
      'stateDiagram', 'gantt', 'pie', 'erDiagram', 'journey',
      'gitGraph', 'timeline'
    ];

    const lines = syntax.trim().split('\n');
    const firstLine = lines[0].trim();

    // Check if the first line contains a valid chart type
    const hasValidType = validChartTypes.some(type => firstLine.startsWith(type));

    if (!hasValidType) {
      console.log('Fixing invalid Mermaid chart type');

      // Try to determine appropriate chart type based on content
      if (syntax.includes('title Days of the Week') &&
          (syntax.match(/\w+\s+\d+/g) || []).length > 0) {
        // Looks like a bar or pie chart with days and numbers
        return 'pie\n' + syntax;
      } else if (syntax.includes('->')) {
        // Looks like a flowchart
        return 'flowchart TD\n' + syntax;
      } else if (syntax.includes(':') && syntax.includes('--')) {
        // Might be a class diagram
        return 'classDiagram\n' + syntax;
      } else if (syntax.includes('section') && syntax.includes(':')) {
        // Might be a gantt chart
        return 'gantt\n' + syntax;
      } else {
        // Default to pie chart which is simple and forgiving
        return 'pie\n' + syntax;
      }
    }

    return syntax;
  }

  private highlightCodeBlocks(): void {
    try {
      // Find all code blocks except mermaid
      const codeBlocks = document.querySelectorAll('pre code:not(.language-mermaid)');
      console.log(`Found ${codeBlocks.length} code blocks for syntax highlighting`);

      // Use global Prism object for highlighting
      if (window.Prism) {
        codeBlocks.forEach((block, index) => {
          console.log(`Highlighting code block ${index + 1}`);

          // Make sure the block has a language class if it doesn't already
          if (!block.className.includes('language-')) {
            // Auto-detect language based on content
            let content = block.textContent || '';
            let language = 'language-javascript'; // Default

            if (content.includes('def ') || content.includes('import ') && content.includes('as ')) {
              language = 'language-python';
            } else if (content.includes('fn ') || content.includes('impl ') || content.includes('struct ')) {
              language = 'language-rust';
            } else if (content.includes('function ') || content.includes('const ') || content.includes('let ')) {
              language = 'language-javascript';
            } else if (content.includes('interface ') || content.includes('class ') || content.includes('export ')) {
              language = 'language-typescript';
            }

            // Add the language class
            block.className += ' ' + language;
          }

          // Apply Prism highlighting
          window.Prism.highlightElement(block);
        });
      } else {
        console.warn('Global Prism object not available');
      }
    } catch (e) {
      console.error('Error highlighting code blocks:', e);
    }
  }
}
