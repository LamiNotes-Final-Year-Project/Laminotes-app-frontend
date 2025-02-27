import { Injectable } from '@angular/core';
import { Observable, of, from, throwError, forkJoin } from 'rxjs';
import { map, catchError, switchMap, tap } from 'rxjs/operators';
import { v4 as uuidv4 } from 'uuid';

import { ApiService } from './api.service';
import { MetadataService } from './metadata.service';

export interface FileInfo {
  path: string;
  name: string;
  data?: string;
  lastModified?: number;
  owner?: string;
}

@Injectable({
  providedIn: 'root'
})
export class FileService {
  currentDirectory: string | null = 'My Documents';
  currentFile: FileInfo | null = null;
  filesInDirectory: FileInfo[] = [];

  private readonly STORAGE_KEY = 'laminotes_files';
  private readonly FILE_CONTENT_PREFIX = 'file_';

  constructor(
    private apiService: ApiService,
    private metadataService: MetadataService
  ) {
    this.loadFilesFromLocalStorage();
  }

  private loadFilesFromLocalStorage(): void {
    const storedFiles = localStorage.getItem(this.STORAGE_KEY);
    if (storedFiles) {
      try {
        this.filesInDirectory = JSON.parse(storedFiles);
      } catch (e) {
        console.error('Error loading files from localStorage', e);
      }
    }

    // Create some sample files if none exist
    if (this.filesInDirectory.length === 0) {
      this.addNewFile('Welcome.md', '# Welcome to Laminotes\n\nThis is a simple markdown editor.').subscribe();
      this.addNewFile('Sample.md', '# Sample Document\n\n## Features\n\n- Markdown editing\n- File management\n- Preview mode').subscribe();
    }
  }

  private saveFilesToLocalStorage(): void {
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.filesInDirectory));
  }

  /**
   * In a real app, this would open a directory selection dialog
   * For now, we'll just use a simulated directory
   */
  selectDirectory(): Observable<void> {
    // In browser mode, we'll just use a static directory
    return of(undefined);
  }

  refreshFileList(): void {
    // First load files from localStorage
    this.loadFilesFromLocalStorage();

    // Then try to fetch files from server
    this.apiService.listFiles().subscribe({
      next: (fileNames) => {
        // Check if we have these files already
        const existingFilePaths = new Set(this.filesInDirectory.map(f => f.name));

        // Add any new files from the server
        fileNames.forEach(fileName => {
          if (!existingFilePaths.has(fileName)) {
            const id = uuidv4();
            const newFilePath = `${id}/${fileName}`;
            this.filesInDirectory.push({
              path: newFilePath,
              name: fileName
            });
          }
        });

        this.saveFilesToLocalStorage();
      },
      error: (error) => console.error('Error refreshing file list:', error)
    });
  }

  openFile(file: FileInfo): Observable<string> {
    // First try to get from local storage
    const localContent = localStorage.getItem(`${this.FILE_CONTENT_PREFIX}${file.path}`);

    if (localContent) {
      this.currentFile = file;
      return of(localContent);
    }

    // If not in local storage, try to get from the server
    return this.apiService.getFile(file.name).pipe(
      tap(content => {
        // Save to local storage
        localStorage.setItem(`${this.FILE_CONTENT_PREFIX}${file.path}`, content);
        this.currentFile = file;
      }),
      catchError(error => {
        console.error('Error opening file:', error);
        return of(''); // Return empty string if file cannot be opened
      })
    );
  }

  saveFile(content: string, newFilePath?: string): Observable<void> {
    if (this.currentFile) {
      // Save locally
      localStorage.setItem(`${this.FILE_CONTENT_PREFIX}${this.currentFile.path}`, content);

      // Update metadata
      return this.metadataService.addCommit(this.currentFile, content).pipe(
        switchMap(metadata => {
          // Try to upload to server if possible
          return this.metadataService.uploadFileMetadataToBackend(
            this.currentFile!.name,
            content,
            metadata
          ).pipe(
            catchError(error => {
              console.error('Failed to upload to server:', error);
              return of(undefined); // Continue even if server upload fails
            })
          );
        })
      );
    }

    if (newFilePath) {
      localStorage.setItem(`${this.FILE_CONTENT_PREFIX}${newFilePath}`, content);
      const fileName = newFilePath.split('/').pop() || 'Untitled.md';
      this.currentFile = {
        path: newFilePath,
        name: fileName
      };
      return of(undefined);
    }

    // Create a new file if none exists
    const newFileName = 'Untitled.md';
    return this.addNewFile(newFileName, content);
  }

  addNewFile(fileName: string, initialContent: string = ''): Observable<void> {
    if (!fileName.includes('.')) {
      fileName = `${fileName}.md`;
    }

    const id = uuidv4();
    const newFilePath = `${id}/${fileName}`;

    // Save content locally
    localStorage.setItem(`${this.FILE_CONTENT_PREFIX}${newFilePath}`, initialContent);

    // Add to files list
    const newFile: FileInfo = { path: newFilePath, name: fileName };
    this.filesInDirectory.push(newFile);
    this.saveFilesToLocalStorage();

    // Create metadata
    return this.metadataService.createMetadata(newFile).pipe(
      switchMap(metadata => {
        // Try to upload to server
        return this.metadataService.uploadFileMetadataToBackend(
          fileName,
          initialContent,
          metadata
        ).pipe(
          catchError(error => {
            console.error('Failed to upload new file to server:', error);
            return of(undefined); // Continue even if server upload fails
          })
        );
      })
    );
  }

  renameFile(file: FileInfo, newFileName: string): Observable<void> {
    if (!newFileName) {
      return of(undefined);
    }

    if (!newFileName.includes('.')) {
      newFileName = `${newFileName}.md`;
    }

    // Get the content
    const content = localStorage.getItem(`${this.FILE_CONTENT_PREFIX}${file.path}`) || '';

    // Create a new file with the new name
    const id = file.path.split('/')[0];
    const newFilePath = `${id}/${newFileName}`;
    localStorage.setItem(`${this.FILE_CONTENT_PREFIX}${newFilePath}`, content);

    // Remove the old file
    localStorage.removeItem(`${this.FILE_CONTENT_PREFIX}${file.path}`);

    // Update the files list
    const index = this.filesInDirectory.findIndex(f => f.path === file.path);
    if (index !== -1) {
      const newFile: FileInfo = { path: newFilePath, name: newFileName };
      this.filesInDirectory[index] = newFile;
      this.saveFilesToLocalStorage();

      // Update current file reference if needed
      if (this.currentFile && this.currentFile.path === file.path) {
        this.currentFile = newFile;
      }

      // Create metadata for renamed file
      return this.metadataService.createMetadata(newFile).pipe(
        switchMap(metadata => {
          // Try to upload to server
          return this.metadataService.uploadFileMetadataToBackend(
            newFileName,
            content,
            metadata
          ).pipe(
            catchError(error => {
              console.error('Failed to upload renamed file to server:', error);
              return of(undefined);
            })
          );
        })
      );
    }

    return of(undefined);
  }

  /**
   * Load recently accessed files
   * @returns Observable with array of recently accessed FileInfo objects
   */
  loadRecentFiles(): Observable<FileInfo[]> {
    // Sort files by lastModified timestamp
    return of(this.filesInDirectory
      .filter(file => {
        // Try to get lastModified from metadata
        const metadataKey = `metadata_${file.path}`;
        const storedMetadata = localStorage.getItem(metadataKey);
        if (storedMetadata) {
          try {
            const metadata = JSON.parse(storedMetadata);
            file.lastModified = new Date(metadata.lastModified).getTime();
          } catch (e) {
            console.error('Error parsing metadata for recent files:', e);
          }
        }
        return file.lastModified !== undefined;
      })
      .sort((a, b) => {
        const aTime = a.lastModified || 0;
        const bTime = b.lastModified || 0;
        return bTime - aTime; // Descending order (newest first)
      })
      .slice(0, 6) // Limit to top 6 recent files
    );
  }

  /**
   * Load shared files
   * @returns Observable with array of shared FileInfo objects
   */
  loadSharedFiles(): Observable<FileInfo[]> {
    // In a real app, this would fetch shared files from the server
    // For now, let's return some mock data
    return of([
      {
        path: 'shared/Project-Overview.md',
        name: 'Project-Overview.md',
        owner: 'John Doe',
        lastModified: Date.now() - 2 * 24 * 60 * 60 * 1000 // 2 days ago
      },
      {
        path: 'shared/Team-Notes.md',
        name: 'Team-Notes.md',
        owner: 'Jane Smith',
        lastModified: Date.now() - 5 * 24 * 60 * 60 * 1000 // 5 days ago
      }
    ]);
  }

  getCurrentDirectoryName(): string {
    return this.currentDirectory || 'My Documents';
  }

  /**
   * Download all files from the server
   */
  downloadAllFiles(): Observable<void> {
    return this.apiService.listFiles().pipe(
      switchMap(fileNames => {
        if (fileNames.length === 0) {
          return of(undefined);
        }

        // Create observables for each file to download
        const downloadObservables = fileNames.map(fileName =>
          this.apiService.getFile(fileName).pipe(
            tap(content => {
              // Create a new file entry
              const id = uuidv4();
              const newFilePath = `${id}/${fileName}`;

              // Save content locally
              localStorage.setItem(`${this.FILE_CONTENT_PREFIX}${newFilePath}`, content);

              // Add to files list if not already there
              const existingIndex = this.filesInDirectory.findIndex(f => f.name === fileName);
              if (existingIndex >= 0) {
                // Update existing entry
                this.filesInDirectory[existingIndex] = {
                  path: newFilePath,
                  name: fileName
                };
              } else {
                // Add new entry
                this.filesInDirectory.push({
                  path: newFilePath,
                  name: fileName
                });
              }
            }),
            catchError(error => {
              console.error(`Error downloading file ${fileName}:`, error);
              return of(undefined); // Continue with other files
            })
          )
        );

        // Execute all downloads
        return forkJoin(downloadObservables).pipe(
          tap(() => {
            this.saveFilesToLocalStorage();
            this.refreshFileList();
          }),
          map(() => undefined)
        );
      })
    );
  }

  /**
   * Upload all files to the server
   */
  uploadAllFiles(): Observable<void> {
    if (this.filesInDirectory.length === 0) {
      return of(undefined);
    }

    // Create observables for each file to upload
    const uploadObservables = this.filesInDirectory.map(file => {
      const content = localStorage.getItem(`${this.FILE_CONTENT_PREFIX}${file.path}`) || '';

      return this.metadataService.loadMetadata(file).pipe(
        switchMap(metadata => {
          if (!metadata) {
            return this.metadataService.createMetadata(file);
          }
          return of(metadata);
        }),
        switchMap(metadata => {
          return this.metadataService.uploadFileMetadataToBackend(
            file.name,
            content,
            metadata
          ).pipe(
            catchError(error => {
              console.error(`Error uploading file ${file.name}:`, error);
              return of(undefined); // Continue with other files
            })
          );
        })
      );
    });

    // Execute all uploads
    return forkJoin(uploadObservables).pipe(
      map(() => undefined),
      catchError(error => {
        console.error('Error during batch upload:', error);
        return of(undefined);
      })
    );
  }
}
