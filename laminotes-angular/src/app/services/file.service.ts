import { Injectable } from '@angular/core';
import { Observable, of, from, throwError, forkJoin } from 'rxjs';
import { map, catchError, switchMap, tap } from 'rxjs/operators';
import { v4 as uuidv4 } from 'uuid';

import { ApiService } from './api.service';
import { MetadataService } from './metadata.service';
import { TeamService } from './team.service';

export interface FileInfo {
  path: string;
  name: string;
  data?: string;
  lastModified?: number;
  owner?: string;
  team_id?: string;
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
    private metadataService: MetadataService,
    private teamService: TeamService
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
              name: fileName,
              team_id: this.teamService.activeTeam?.id // Add team ID if active
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

      // Get active team if any
      const activeTeam = this.teamService.activeTeam;
      const teamId = activeTeam ? activeTeam.id : this.currentFile.team_id;

      // Update metadata
      return this.metadataService.addCommit(this.currentFile, content).pipe(
        switchMap(metadata => {
          return this.apiService.uploadFile(
            this.currentFile!.name,
            content,
            metadata,
            teamId // The API service accepts the teamId parameter
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
        name: fileName,
        team_id: this.teamService.activeTeam?.id
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
    const activeTeam = this.teamService.activeTeam;
    const teamId = activeTeam?.id;

    // Save content locally
    localStorage.setItem(`${this.FILE_CONTENT_PREFIX}${newFilePath}`, initialContent);

    // Add to files list
    const newFile: FileInfo = {
      path: newFilePath,
      name: fileName,
      team_id: teamId
    };

    this.filesInDirectory.push(newFile);
    this.saveFilesToLocalStorage();

    // Create metadata
    return this.metadataService.createMetadata(newFile).pipe(
      switchMap(metadata => {
        return this.apiService.uploadFile(
          fileName,
          initialContent,
          metadata,
          teamId // The API service accepts the teamId parameter
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
      const newFile: FileInfo = {
        path: newFilePath,
        name: newFileName,
        team_id: file.team_id || this.teamService.activeTeam?.id
      };

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
          // FIX: Remove the teamId parameter that was causing the error
          return this.apiService.uploadFile(
            newFileName,
            content,
            metadata,
            newFile.team_id // The API service accepts the teamId parameter
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

  testConnection(): Observable<boolean> {
    console.log('🔄 Testing connection to backend server at:', this.apiService.baseUrl);

    return this.apiService.listFiles().pipe(
      map(files => {
        console.log('✅ Connection successful! Files on server:', files);
        return true;
      }),
      catchError(error => {
        console.error('❌ Connection failed:', error);
        return of(false);
      })
    );
  }

  debugUploadFileWithToken(file: FileInfo): Observable<void> {
    if (!file) {
      console.error('❌ No file provided for upload');
      return throwError(() => new Error('No file provided for upload'));
    }

    // Get the file content
    const content = localStorage.getItem(`${this.FILE_CONTENT_PREFIX}${file.path}`);
    if (!content) {
      console.error('❌ No content found for file:', file.path);
      return throwError(() => new Error('No content found for file'));
    }

    console.log(`📤 Starting upload of file "${file.name}" with ${content.length} bytes of content`);

    // Get active team if any
    const activeTeam = this.teamService.activeTeam;
    const teamId = activeTeam ? activeTeam.id : file.team_id;

    if (teamId) {
      console.log(`📂 Using team context: ${activeTeam ? activeTeam.name : 'Unknown Team'} (${teamId})`);
    } else {
      console.log(`📂 Using personal storage`);
    }

    // Get or create metadata
    return this.metadataService.loadMetadata(file).pipe(
      switchMap(metadata => {
        if (!metadata) {
          console.log('ℹ️ No existing metadata found, creating new metadata');
          return this.metadataService.createMetadata(file);
        }
        console.log('ℹ️ Using existing metadata:', metadata);
        return of(metadata);
      }),
      switchMap(metadata => {
        console.log(`📤 Uploading file "${file.name}" to server with metadata:`, metadata);

        // The auth interceptor will automatically add the token
        return this.apiService.uploadFile(file.name, content, metadata, teamId).pipe(
          tap(response => {
            console.log(`✅ File "${file.name}" uploaded successfully:`, response);
          }),
          catchError(error => {
            console.error(`❌ Error uploading file "${file.name}":`, error);
            return throwError(() => error);
          })
        );
      })
    );
  }

  debugDownloadFile(filename: string): Observable<FileInfo> {
    console.log(`📥 Starting download of file "${filename}" from server`);

    return this.apiService.getFile(filename).pipe(
      switchMap(content => {
        console.log(`✅ Downloaded content for "${filename}", length: ${content.length} bytes`);

        // Create a new file in local storage
        const id = uuidv4();
        const filePath = `${id}/${filename}`;
        const activeTeam = this.teamService.activeTeam;
        const teamId = activeTeam?.id;

        console.log(`💾 Saving downloaded file to local storage at path: ${filePath}`);
        localStorage.setItem(`${this.FILE_CONTENT_PREFIX}${filePath}`, content);

        const newFile: FileInfo = {
          path: filePath,
          name: filename,
          lastModified: Date.now(),
          team_id: teamId
        };

        // Add to files list if not already there
        const existingIndex = this.filesInDirectory.findIndex(f => f.name === filename);
        if (existingIndex >= 0) {
          console.log(`🔄 Updating existing file entry at index ${existingIndex}`);
          this.filesInDirectory[existingIndex] = newFile;
        } else {
          console.log('➕ Adding new file to filesInDirectory list');
          this.filesInDirectory.push(newFile);
        }

        this.saveFilesToLocalStorage();
        this.refreshFileList();

        return of(newFile);
      }),
      catchError(error => {
        console.error(`❌ Error downloading file "${filename}":`, error);
        return throwError(() => error);
      })
    );
  }

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

  loadSharedFiles(): Observable<FileInfo[]> {
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
    const activeTeam = this.teamService.activeTeam;
    if (activeTeam) {
      return `Team: ${activeTeam.name}`;
    }
    return this.currentDirectory || 'My Documents';
  }

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
              const activeTeam = this.teamService.activeTeam;
              const teamId = activeTeam?.id;

              // Save content locally
              localStorage.setItem(`${this.FILE_CONTENT_PREFIX}${newFilePath}`, content);

              // Add to files list if not already there
              const existingIndex = this.filesInDirectory.findIndex(f => f.name === fileName);
              if (existingIndex >= 0) {
                // Update existing entry
                this.filesInDirectory[existingIndex] = {
                  path: newFilePath,
                  name: fileName,
                  team_id: teamId
                };
              } else {
                // Add new entry
                this.filesInDirectory.push({
                  path: newFilePath,
                  name: fileName,
                  team_id: teamId
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

  uploadAllFiles(): Observable<void> {
    if (this.filesInDirectory.length === 0) {
      return of(undefined);
    }

    const activeTeam = this.teamService.activeTeam;

    // Create observables for each file to upload
    const uploadObservables = this.filesInDirectory.map(file => {
      const content = localStorage.getItem(`${this.FILE_CONTENT_PREFIX}${file.path}`) || '';
      const teamId = file.team_id || activeTeam?.id;

      return this.metadataService.loadMetadata(file).pipe(
        switchMap(metadata => {
          if (!metadata) {
            return this.metadataService.createMetadata(file);
          }
          return of(metadata);
        }),
        switchMap(metadata => {
          return this.apiService.uploadFile(
            file.name,
            content,
            metadata,
            teamId // The API service accepts the teamId parameter
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
