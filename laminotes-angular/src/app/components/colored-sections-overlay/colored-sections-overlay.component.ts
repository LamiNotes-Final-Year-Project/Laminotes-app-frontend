import { Component, Input, ElementRef, ViewChild, AfterViewInit, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-colored-sections-overlay',
  standalone: true,
  imports: [CommonModule],
  template: `<canvas #canvas class="overlay-canvas"></canvas>`,
  styles: [`
    .overlay-canvas {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      z-index: 0;
    }
  `]
})
export class ColoredSectionsOverlayComponent implements AfterViewInit, OnChanges {
  @Input() content: string = '';
  @Input() userColors: Record<string, string> = {};

  @ViewChild('canvas', { static: false }) canvasRef!: ElementRef<HTMLCanvasElement>;

  ngAfterViewInit(): void {
    this.drawOverlay();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if ((changes['content'] || changes['userColors']) && this.canvasRef) {
      setTimeout(() => this.drawOverlay(), 0);
    }
  }

  private drawOverlay(): void {
    if (!this.canvasRef || !this.content) return;

    const canvas = this.canvasRef.nativeElement;
    const parent = canvas.parentElement;
    if (!parent) return;

    // Set canvas size to match parent
    canvas.width = parent.clientWidth;
    canvas.height = parent.clientHeight;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear the canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Split content into paragraphs
    const paragraphs = this.content.split('\n\n');
    if (paragraphs.length === 0) return;

    // Calculate the height of each paragraph section
    const height = canvas.height / paragraphs.length;

    // Draw colored backgrounds for each paragraph
    let y = 0;
    Object.keys(this.userColors).forEach((userId, index) => {
      // Use modulo to cycle through users if there are more paragraphs than users
      const paragraphIndex = index % paragraphs.length;

      // Get the color for this user
      const color = this.userColors[userId];

      // Calculate paragraph position
      y = paragraphIndex * height;

      // Draw colored rectangle with transparency
      ctx.fillStyle = this.hexToRGBA(color, 0.1);
      ctx.fillRect(0, y, canvas.width, height);
    });
  }

  // Helper function to convert hex color to rgba
  private hexToRGBA(hex: string, alpha: number): string {
    // Remove # if present
    hex = hex.replace('#', '');

    // Parse the hex values to RGB
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);

    // Return rgba color
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
}
