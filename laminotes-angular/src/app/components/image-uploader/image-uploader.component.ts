/**
 * Image uploader component.
 *
 * Provides UI for uploading and embedding images in markdown, supporting both
 * base64 embedding and file references depending on image size and settings.
 */
import { Component, ElementRef, EventEmitter, Input, Output, ViewChild, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NotificationService } from '../../services/notification.service';

/**
 * Event data emitted when an image is successfully processed
 */
export interface ImageUploadResult {
  /** Markdown text to insert into the editor (user-friendly placeholder) */
  markdownText: string;

  /** The original file object */
  file: File;

  /** Whether the image was embedded as base64 or stored as a reference */
  isEmbedded: boolean;

  /** The actual markdown content with data URL (for storage) */
  actualContent?: string;
}

/**
 * Configuration options for the image uploader
 */
export interface ImageUploaderConfig {
  /** Maximum file size in bytes for embedded images (default: 1MB) */
  maxEmbeddedSize?: number;

  /** Whether to always embed images regardless of size */
  alwaysEmbed?: boolean;
}

/**
 * Component for uploading and embedding images in markdown content
 */
@Component({
  selector: 'app-image-uploader',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="image-uploader">
      <button class="upload-button" (click)="openFilePicker()" [disabled]="isLoading">
        <i class="fas fa-image"></i>
        <span>Insert Image</span>
      </button>

      <input
        type="file"
        #filePicker
        hidden
        accept="image/*"
        (change)="onFileSelected($event)"
      >

      <div *ngIf="isLoading" class="upload-progress">
        <div class="spinner">
          <i class="fas fa-spinner fa-spin"></i>
        </div>
        <span>{{ progressMessage }}</span>
      </div>
    </div>
  `,
  styles: [`
    .image-uploader {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .upload-button {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 6px 12px;
      background-color: #2a2a2a;
      border: 1px solid #444;
      color: #eee;
      border-radius: 4px;
      cursor: pointer;
      font-size: 14px;
    }

    .upload-button:hover {
      background-color: #3a3a3a;
    }

    .upload-button:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .upload-progress {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 14px;
      color: #ccc;
    }
  `]
})
export class ImageUploaderComponent {
  /** Reference to the file input element */
  @ViewChild('filePicker') filePicker!: ElementRef<HTMLInputElement>;

  /** Configuration options for the image uploader */
  @Input() config: ImageUploaderConfig = {
    maxEmbeddedSize: 1024 * 1024, // 1MB default max for embedded images
    alwaysEmbed: false
  };

  /** Event emitted when an image is successfully processed */
  @Output() imageInserted = new EventEmitter<ImageUploadResult>();

  /** Indicates whether an image is currently being processed */
  isLoading = false;

  /** Message showing the current processing status */
  progressMessage = '';

  /** Maximum image size allowed after compression (500KB) */
  private readonly MAX_IMAGE_SIZE_ALLOWED = 500 * 1024;

  /** Store original size for compression ratio calculation */
  private originalSize: number | null = null;

  /** Service to show notifications to the user */
  private notificationService = inject(NotificationService);

  /**
   * Opens the file picker dialog
   */
  openFilePicker(): void {
    if (this.filePicker && !this.isLoading) {
      this.filePicker.nativeElement.click();
    }
  }

  /**
   * Handles file selection from the file input
   * @param event File input change event
   */
  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;

    if (!input.files || input.files.length === 0) {
      return;
    }

    const file = input.files[0];

    // Validate file is an image
    if (!file.type.startsWith('image/')) {
      this.resetFileInput();
      return;
    }

    this.processImage(file);
  }

  /**
   * Processes the selected image file
   * @param file The image file to process
   */
  private processImage(file: File): void {
    this.isLoading = true;
    this.progressMessage = 'Processing image...';

    // Determine if we should embed this image as base64 or store as a file
    const shouldEmbed = this.shouldEmbedImage(file);

    if (shouldEmbed) {
      this.embedImageAsBase64(file);
    } else {
      this.embedImageAsBase64(file);

      // TODO: For larger images, implement external file storage
    }
  }

  /**
   * Determines whether an image should be embedded as base64
   * @param file The image file to check
   * @returns True if the image should be embedded as base64
   */
  private shouldEmbedImage(file: File): boolean {
    // Always embed if configured to do so
    if (this.config.alwaysEmbed) {
      return true;
    }

    // Check file size against the configured maximum
    const maxSize = this.config.maxEmbeddedSize || 1024 * 1024; // Default 1MB
    return file.size <= maxSize;
  }

  /**
   * Embeds the image as a base64 data URL in markdown but
   * uses a placeholder in the editor for better readability
   * @param file The image file to embed
   */
  /**
   * Compresses an image to reduce its size
   * @param file The original image file
   * @param maxWidth Maximum width for the compressed image
   * @param quality Compression quality (0-1)
   * @returns Promise resolving to the compressed image as a Blob
   */
  private compressImage(file: File, maxWidth: number = 800, quality: number = 0.5): Promise<Blob> {
    return new Promise((resolve, reject) => {
      // Create image element to load the file
      const img = new Image();
      const reader = new FileReader();

      // Set up image load handler
      img.onload = () => {
        // Create canvas for resizing
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        // Calculate new dimensions if needed
        if (width > maxWidth) {
          const ratio = maxWidth / width;
          width = maxWidth;
          height = Math.round(height * ratio);
        }

        // Set canvas size and draw the image
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Could not get canvas context'));
          return;
        }

        // Draw the image on the canvas
        ctx.drawImage(img, 0, 0, width, height);

        // Get the file type from the original file
        const fileType = file.type || 'image/jpeg';

        // Convert canvas to blob
        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve(blob);
            } else {
              reject(new Error('Failed to compress image'));
            }
          },
          fileType,
          quality
        );
      };

      // Handle errors during image loading
      img.onerror = () => {
        reject(new Error('Failed to load image for compression'));
      };

      // Read the file to get a data URL
      reader.onload = (e) => {
        img.src = e.target?.result as string;
      };

      reader.onerror = () => {
        reject(new Error('Failed to read image file'));
      };

      reader.readAsDataURL(file);
    });
  }

  private embedImageAsBase64(file: File): void {
    this.progressMessage = 'Processing image...';

    // Save original size for compression ratio calculation
    this.originalSize = file.size;

    // Check image size
    const fileSizeKB = Math.round(file.size / 1024);
    const COMPRESSION_THRESHOLD_KB = 500;

    if (fileSizeKB > COMPRESSION_THRESHOLD_KB) {
      this.progressMessage = 'Image is too large, compressing...';

      // Compress the image - use much more aggressive settings
      this.compressImage(file, 800, 0.5) // 800px width, 50% quality
        .then(compressedBlob => {
          // If still too big, try even more aggressive compression
          if (compressedBlob.size > this.MAX_IMAGE_SIZE_ALLOWED) {
            this.progressMessage = 'Still too large, applying maximum compression...';
            return this.compressImage(file, 640, 0.3); // Extremely aggressive settings
          }
          return compressedBlob;
        })
        .then(compressedBlob => {
          const compressedFile = new File([compressedBlob], file.name, {
            type: file.type,
            lastModified: file.lastModified
          });

          // Log compression results
          const newSizeKB = Math.round(compressedBlob.size / 1024);
          console.log(`Compressed image from ${fileSizeKB}KB to ${newSizeKB}KB (${Math.round(newSizeKB / fileSizeKB * 100)}%)`);

          // Continue with the compressed file
          this.processCompressedImage(compressedFile);
        })
        .catch(error => {
          console.error('Error compressing image:', error);
          // Fall back to original file if compression fails
          this.processCompressedImage(file);
        });
    } else {
      // Image is already small enough, proceed normally
      this.processCompressedImage(file);
    }
  }

  private processCompressedImage(file: File): void {
    // Final size check - even after compression
    if (file.size > this.MAX_IMAGE_SIZE_ALLOWED) {
      this.notificationService.warning(
        `Image is still too large (${Math.round(file.size/1024)}KB). ` +
        `Maximum allowed size is ${Math.round(this.MAX_IMAGE_SIZE_ALLOWED/1024)}KB. ` +
        `Please use an external image editor to reduce the file size further.`
      );
      this.resetFileInput();
      this.isLoading = false;
      return;
    }

    const reader = new FileReader();

    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;

      // Check the size of the data URL
      if (dataUrl && dataUrl.length > (2 * this.MAX_IMAGE_SIZE_ALLOWED)) {
        this.notificationService.warning(
          `The image data is too large for embedding (${Math.round(dataUrl.length/1024)}KB). ` +
          `Please use a smaller image.`
        );
        this.resetFileInput();
        this.isLoading = false;
        return;
      }

      if (dataUrl) {
        // Get alt text from filename
        const altText = file.name.split('.')[0] || 'image';

        // Create a user-friendly placeholder that will be shown in the editor
        const fileSizeKB = Math.round(file.size / 1024);
        const editorPlaceholder = `![${altText}](IMAGE:${fileSizeKB}KB:${file.name})`;

        // The actual markdown with data URL for storage
        const actualMarkdownText = `![${altText}](${dataUrl})`;

        this.imageInserted.emit({
          markdownText: editorPlaceholder,
          file,
          isEmbedded: true,
          // Include the actual markdown with data URL as an additional property
          actualContent: actualMarkdownText
        });

        // Show success message with compression info if file was compressed
        if (this.originalSize && this.originalSize > file.size) {
          const savings = Math.round((1 - (file.size / this.originalSize)) * 100);
          this.notificationService.success(
            `Image added (${Math.round(file.size / 1024)}KB) - compressed by ${savings}%`
          );
        } else {
          this.notificationService.success(
            `Image added (${Math.round(file.size / 1024)}KB)`
          );
        }
      }

      this.resetFileInput();
      this.isLoading = false;
    };

    reader.onerror = () => {
      console.error('Error reading image file');
      this.resetFileInput();
      this.isLoading = false;
    };

    reader.readAsDataURL(file);
  }

  /**
   * Resets the file input after processing
   */
  private resetFileInput(): void {
    if (this.filePicker) {
      this.filePicker.nativeElement.value = '';
    }
  }
}
