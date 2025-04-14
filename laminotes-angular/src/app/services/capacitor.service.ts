/**
 * Capacitor integration service.
 * 
 * Provides platform-specific functionality for mobile platforms (iOS/iPadOS),
 * handling file system operations and platform detection while maintaining
 * compatibility with the existing application architecture.
 */
import { Injectable } from '@angular/core';
import { Observable, from, of, throwError } from 'rxjs';
import { map, catchError, tap, switchMap } from 'rxjs/operators';
import { Capacitor, CapacitorException } from '@capacitor/core';
import { 
  Filesystem, 
  Directory, 
  Encoding, 
  ReaddirOptions, 
  ReaddirResult,
  ReadFileOptions,
  WriteFileOptions,
  MkdirOptions,
  RmdirOptions,
  DeleteFileOptions
} from '@capacitor/filesystem';

/**
 * Service responsible for Capacitor platform functionality.
 * Provides file operations and platform detection methods for 
 * iPad OS and other mobile platforms.
 */
@Injectable({
  providedIn: 'root'
})
export class CapacitorService {
  /** Application document directory path in iOS */
  private documentsDirectory: string | null = null;

  /** Flag indicating if permissions were granted */
  private permissionsGranted: boolean = false;

  constructor() {
    if (this.isCapacitor()) {
      this.initializeFilesystem();
    }
  }

  /**
   * Initialize filesystem access for Capacitor platforms.
   * Sets up the documents directory and attempts to get permissions.
   */
  private async initializeFilesystem(): Promise<void> {
    try {
      // On iOS, we need to use the Documents directory
      const { uri } = await Filesystem.getUri({
        directory: Directory.Documents,
        path: ''
      });
      
      this.documentsDirectory = uri;
      console.log('Capacitor documents directory:', this.documentsDirectory);
      
      // Try to create an app-specific directory to check permissions
      try {
        await Filesystem.mkdir({
          directory: Directory.Documents,
          path: 'Laminotes',
          recursive: true
        });
        this.permissionsGranted = true;
      } catch (err) {
        console.error('Failed to create app directory:', err);
        this.permissionsGranted = false;
      }
    } catch (err) {
      console.error('Failed to initialize Capacitor filesystem:', err);
      this.documentsDirectory = null;
    }
  }

  /**
   * Determines if running on a Capacitor platform (iOS/iPad OS).
   * 
   * @returns True if running on a Capacitor platform
   */
  isCapacitor(): boolean {
    return Capacitor.isNativePlatform();
  }

  /**
   * Checks if running specifically on iOS/iPadOS.
   * 
   * @returns True if running on iOS/iPadOS
   */
  isIOS(): boolean {
    return this.isCapacitor() && Capacitor.getPlatform() === 'ios';
  }

  /**
   * Gets the platform name for display purposes.
   * 
   * @returns The current platform name
   */
  getPlatformName(): string {
    if (!this.isCapacitor()) {
      return 'web';
    }
    return Capacitor.getPlatform();
  }

  /**
   * Saves a file to the filesystem on iOS/iPadOS.
   * 
   * @param content The content to write to the file
   * @param filePath The relative path to save the file to (inside Documents)
   * @param saveAs Whether to prompt for a save location
   * @returns Observable containing the result of the operation
   */
  saveFile(content: string, filePath?: string, saveAs = false): Observable<any> {
    if (!this.isCapacitor()) {
      return throwError(() => new Error('Not running on Capacitor platform'));
    }

    if (!this.permissionsGranted) {
      return throwError(() => new Error('Filesystem permissions not granted'));
    }

    // If saveAs is true or no filePath is provided, we need to prompt for a path
    // However, iOS doesn't have a file picker dialog like desktop Electron
    // So we'll create a default path in the Documents folder
    let targetPath = filePath;

    if (saveAs || !targetPath) {
      // Generate a default filename
      const timestamp = new Date().toISOString().replace(/[:\.]/g, '-');
      targetPath = `Laminotes/Document_${timestamp}.md`;
    }

    // If the path doesn't have a directory structure, add it to the Laminotes folder
    if (targetPath && !targetPath.includes('/')) {
      targetPath = `Laminotes/${targetPath}`;
    }

    // Make sure the path has .md extension
    if (targetPath && !targetPath.toLowerCase().endsWith('.md')) {
      targetPath += '.md';
    }

    // Ensure the directory exists
    const dirPath = targetPath ? targetPath.substring(0, targetPath.lastIndexOf('/')) : 'Laminotes';
    
    return from(
      Filesystem.mkdir({
        directory: Directory.Documents,
        path: dirPath,
        recursive: true
      })
    ).pipe(
      // Then write the file
      switchMap(() => 
        Filesystem.writeFile({
          directory: Directory.Documents,
          path: targetPath,
          data: content,
          encoding: Encoding.UTF8
        })
      ),
      map(() => ({
        success: true,
        filePath: targetPath,
        message: 'File saved successfully'
      })),
      catchError(error => {
        console.error('Error in Capacitor saveFile:', error);
        return throwError(() => new Error(`Failed to save file: ${error.message}`));
      })
    );
  }

  /**
   * Reads a file from the filesystem on iOS/iPadOS.
   * 
   * @param filePath The path to the file to read
   * @returns Observable containing the file content
   */
  readFile(filePath: string): Observable<string> {
    if (!this.isCapacitor()) {
      return throwError(() => new Error('Not running on Capacitor platform'));
    }

    return from(
      Filesystem.readFile({
        directory: Directory.Documents,
        path: filePath,
        encoding: Encoding.UTF8
      })
    ).pipe(
      map(result => result.data as string),
      catchError(error => {
        console.error('Error in Capacitor readFile:', error);
        return throwError(() => new Error(`Failed to read file: ${error.message}`));
      })
    );
  }

  /**
   * Lists files in a directory on iOS/iPadOS.
   * 
   * @param directoryPath The path to the directory to list
   * @returns Observable containing the list of files
   */
  listDirectory(directoryPath: string = 'Laminotes'): Observable<any> {
    if (!this.isCapacitor()) {
      return throwError(() => new Error('Not running on Capacitor platform'));
    }

    // Ensure directory exists
    return from(
      Filesystem.mkdir({
        directory: Directory.Documents,
        path: directoryPath,
        recursive: true
      })
    ).pipe(
      switchMap(() =>
        Filesystem.readdir({
          directory: Directory.Documents,
          path: directoryPath
        })
      ),
      map((result: any) => {
        // Filter for markdown files and map to FileInfo format
        const files = result.files
          .filter((file: any) => file.name.endsWith('.md'))
          .map((file: any) => ({
            path: `${directoryPath}/${file.name}`,
            name: file.name,
            type: file.type,
            size: file.size,
            lastModified: file.mtime
          }));

        return {
          success: true,
          dirPath: directoryPath,
          files: files,
          message: 'Directory read successfully'
        };
      }),
      catchError(error => {
        console.error('Error in Capacitor listDirectory:', error);
        return throwError(() => new Error(`Failed to list directory: ${error.message}`));
      })
    );
  }

  /**
   * Creates a directory on iOS/iPadOS.
   * 
   * @param dirPath The path of the directory to create
   * @returns Observable indicating success or failure
   */
  createDirectory(dirPath: string): Observable<any> {
    if (!this.isCapacitor()) {
      return throwError(() => new Error('Not running on Capacitor platform'));
    }

    return from(
      Filesystem.mkdir({
        directory: Directory.Documents,
        path: dirPath,
        recursive: true
      })
    ).pipe(
      map(() => ({
        success: true,
        message: 'Directory created successfully'
      })),
      catchError(error => {
        console.error('Error in Capacitor createDirectory:', error);
        return throwError(() => new Error(`Failed to create directory: ${error.message}`));
      })
    );
  }

  /**
   * Deletes a file on iOS/iPadOS.
   * 
   * @param filePath The path of the file to delete
   * @returns Observable indicating success or failure
   */
  deleteFile(filePath: string): Observable<any> {
    if (!this.isCapacitor()) {
      return throwError(() => new Error('Not running on Capacitor platform'));
    }

    return from(
      Filesystem.deleteFile({
        directory: Directory.Documents,
        path: filePath
      })
    ).pipe(
      map(() => ({
        success: true,
        message: 'File deleted successfully'
      })),
      catchError(error => {
        console.error('Error in Capacitor deleteFile:', error);
        return throwError(() => new Error(`Failed to delete file: ${error.message}`));
      })
    );
  }

  /**
   * Renames a file on iOS/iPadOS.
   * On iOS, this is done by copying the file and then deleting the original.
   * 
   * @param oldPath The original file path
   * @param newPath The new file path
   * @returns Observable indicating success or failure
   */
  renameFile(oldPath: string, newPath: string): Observable<any> {
    if (!this.isCapacitor()) {
      return throwError(() => new Error('Not running on Capacitor platform'));
    }

    // On iOS, we implement rename as copy + delete
    return this.readFile(oldPath).pipe(
      // First read the file
      switchMap((content: string) => {
        // Then write to the new location
        return this.saveFile(content, newPath, false).pipe(
          // Then delete the original file
          switchMap(() => this.deleteFile(oldPath)),
          map(() => ({
            success: true,
            message: 'File renamed successfully'
          }))
        );
      }),
      catchError(error => {
        console.error('Error in Capacitor renameFile:', error);
        return throwError(() => new Error(`Failed to rename file: ${error.message}`));
      })
    );
  }

  /**
   * Checks if a file exists on iOS/iPadOS.
   * 
   * @param filePath The path of the file to check
   * @returns Observable containing true if the file exists, false otherwise
   */
  checkFileExists(filePath: string): Observable<boolean> {
    if (!this.isCapacitor()) {
      return of(false);
    }

    return from(
      Filesystem.stat({
        directory: Directory.Documents,
        path: filePath
      })
    ).pipe(
      // If stat succeeds, the file exists
      map(() => true),
      catchError(() => {
        // If stat fails, the file doesn't exist
        return of(false);
      })
    );
  }

  /**
   * Shows a dialog to select a directory on iOS/iPadOS.
   * Note: iOS doesn't have a directory picker API like desktop,
   * so we implement a simplified version that just returns the default directory.
   * 
   * @param initialPath Optional starting path
   * @returns Observable containing the selected directory
   */
  selectDirectory(initialPath?: string): Observable<any> {
    if (!this.isCapacitor()) {
      return throwError(() => new Error('Not running on Capacitor platform'));
    }

    // On iOS, we don't have a directory picker
    // Instead, we'll use a predefined location
    const dirPath = initialPath || 'Laminotes';

    // Ensure directory exists and return its contents
    return this.createDirectory(dirPath).pipe(
      switchMap(() => this.listDirectory(dirPath))
    );
  }

  /**
   * Shows a prompt dialog on iOS/iPadOS.
   * Simplified version that just uses the web platform's prompt function.
   * 
   * @param options Prompt options (title, label, value)
   * @returns Observable containing the user input
   */
  showPromptDialog(options: { title: string, label: string, value: string }): Observable<any> {
    if (!this.isCapacitor()) {
      return throwError(() => new Error('Not running on Capacitor platform'));
    }

    // iOS doesn't have a native API for this, so we use the web platform
    const result = prompt(options.label || 'Please enter a value:', options.value || '');
    
    return of({
      success: result !== null,
      value: result
    });
  }
}