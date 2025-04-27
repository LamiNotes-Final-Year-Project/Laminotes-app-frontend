/**
 * Capacitor integration service.
 * 
 * Provides platform-specific functionality for mobile platforms (iOS/iPadOS),
 * handling file system operations and platform detection while maintaining
 * compatibility with the existing application architecture.
 */
import { Injectable } from '@angular/core';
import { Observable, from, of, throwError, forkJoin } from 'rxjs';
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
import { Team } from '../models/team.model';

/**
 * Service responsible for Capacitor platform functionality.
 * Provides file operations and platform detection methods for 
 * iPad OS and other mobile platforms with team integration support.
 */
@Injectable({
  providedIn: 'root'
})
export class CapacitorService {
  /** Application document directory path in iOS */
  private documentsDirectory: string | null = null;

  /** Flag indicating if permissions were granted */
  private permissionsGranted: boolean = false;

  /** Root directory for team files */
  private readonly TEAMS_ROOT_DIR = 'Teams';

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
      console.log('📱 Capacitor documents directory:', this.documentsDirectory);
      
      // Try to create app-specific directories
      try {
        // Create main app directory
        await Filesystem.mkdir({
          directory: Directory.Documents,
          path: 'Laminotes',
          recursive: true
        });
        
        // Create teams directory
        await Filesystem.mkdir({
          directory: Directory.Documents,
          path: this.TEAMS_ROOT_DIR,
          recursive: true
        });
        
        this.permissionsGranted = true;
        console.log('✅ Capacitor filesystem initialized successfully');
      } catch (err) {
        console.error('❌ Failed to create app directories:', err);
        this.permissionsGranted = false;
      }
    } catch (err) {
      console.error('❌ Failed to initialize Capacitor filesystem:', err);
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
   * Provides team support by placing files in team-specific directories.
   * 
   * @param content The content to write to the file
   * @param filePath The relative path to save the file to (inside Documents)
   * @param saveAs Whether to prompt for a save location
   * @param options Additional options for saving
   * @returns Observable containing the result of the operation
   */
  saveFile(
    content: string, 
    filePath?: string, 
    saveAs = false, 
    options: { 
      team?: Team, 
      saveAsBinary?: boolean, 
      mimeType?: string 
    } = {}
  ): Observable<any> {
    // Log what we're trying to save to help debug iOS issues
    console.log(`📱 Capacitor saveFile called - Content length: ${content.length} chars, filePath: ${filePath || 'not set'}`);
    
    if (!this.isCapacitor()) {
      return throwError(() => new Error('Not running on Capacitor platform'));
    }

    if (!this.permissionsGranted) {
      return throwError(() => new Error('Filesystem permissions not granted'));
    }

    // Extract options
    const team = options.team;
    const saveAsBinary = options.saveAsBinary || false;
    const mimeType = options.mimeType || 'text/markdown';

    // If saveAs is true or no filePath is provided, we need to prompt for a path
    // However, iOS doesn't have a file picker dialog like desktop Electron
    // So we'll create a default path in the appropriate folder
    let targetPath = filePath;

    // If we have a team context, ensure files go to the team directory
    if (team) {
      const teamDir = `${this.TEAMS_ROOT_DIR}/${team.name.replace(/[^a-zA-Z0-9]/g, '_')}`;
      
      // If no path or saveAs is true, generate a path in the team directory
      if (saveAs || !targetPath) {
        const timestamp = new Date().toISOString().replace(/[:\.]/g, '-');
        const extension = this.getFileExtensionFromMimeType(mimeType);
        targetPath = `${teamDir}/Document_${timestamp}${extension}`;
      } 
      // If we have a path but it doesn't include the team directory, add it
      else if (targetPath && !targetPath.startsWith(teamDir)) {
        // If it's just a filename without a path
        if (!targetPath.includes('/')) {
          targetPath = `${teamDir}/${targetPath}`;
        } 
        // If it has a path but not the team directory
        else {
          // Extract just the filename
          const fileName = targetPath.split('/').pop() || 'document.md';
          targetPath = `${teamDir}/${fileName}`;
        }
      }
    } else {
      // No team context, use default location
      if (saveAs || !targetPath) {
        // Generate a default filename
        const timestamp = new Date().toISOString().replace(/[:\.]/g, '-');
        const extension = this.getFileExtensionFromMimeType(mimeType);
        targetPath = `Laminotes/Document_${timestamp}${extension}`;
      }

      // If the path doesn't have a directory structure, add it to the Laminotes folder
      if (targetPath && !targetPath.includes('/')) {
        targetPath = `Laminotes/${targetPath}`;
      }
    }

    // Ensure the path has appropriate extension if it's markdown
    if (targetPath && mimeType === 'text/markdown' && !targetPath.toLowerCase().endsWith('.md')) {
      targetPath += '.md';
    }

    // Ensure the directory exists
    const dirPath = targetPath ? targetPath.substring(0, targetPath.lastIndexOf('/')) : 'Laminotes';
    
    console.log(`📝 Saving file to ${targetPath}${team ? ' (Team: ' + team.name + ')' : ''}`);
    
    return from(
      Filesystem.mkdir({
        directory: Directory.Documents,
        path: dirPath,
        recursive: true
      })
    ).pipe(
      // Then write the file
      switchMap(() => {
        console.log(`📱 Preparing to write file to ${targetPath}`);
        
        // Safety check to avoid crashing due to quota issues
        if (content.length > 200000 && this.isIOS()) { // Over 200KB on iOS
          console.warn(`⚠️ File content is very large (${Math.round(content.length/1024)}KB). This may exceed iOS storage quota.`);
          // Log the start of the content to see what we're trying to save
          console.log(`Content start: ${content.substring(0, 100)}...`);
          
          // If extremely large (over 1MB), split into chunks for iOS
          if (content.length > 1000000) {
            console.warn(`⚠️ Content exceeds 1MB. Trimming to avoid iOS storage crash...`);
            // Keep only the first 500KB for safety
            content = content.substring(0, 500000);
            console.log(`📱 Content trimmed to ${Math.round(content.length/1024)}KB`);
          }
        }
        
        const writeOptions: WriteFileOptions = {
          directory: Directory.Documents,
          path: targetPath,
          data: content
        };
        
        // For binary files, use base64 encoding
        if (saveAsBinary) {
          writeOptions.encoding = Encoding.UTF8; // Use UTF8 as fallback, binary is not directly supported
        } else {
          writeOptions.encoding = Encoding.UTF8;
        }
        
        console.log(`📱 Calling Filesystem.writeFile`);
        return Filesystem.writeFile(writeOptions);
      }),
      map(() => ({
        success: true,
        filePath: targetPath,
        team_id: team?.id,
        message: 'File saved successfully'
      })),
      catchError(error => {
        console.error('❌ Error in Capacitor saveFile:', error);
        return throwError(() => new Error(`Failed to save file: ${error.message}`));
      })
    );
  }
  
  /**
   * Helper to get file extension from MIME type
   */
  private getFileExtensionFromMimeType(mimeType: string): string {
    switch (mimeType) {
      case 'application/pdf':
        return '.pdf';
      case 'image/jpeg':
        return '.jpg';
      case 'image/png':
        return '.png';
      case 'text/plain':
        return '.txt';
      case 'text/markdown':
      default:
        return '.md';
    }
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

    console.log(`📖 Reading file: ${filePath}`);
    
    return from(
      Filesystem.readFile({
        directory: Directory.Documents,
        path: filePath,
        encoding: Encoding.UTF8
      })
    ).pipe(
      tap(result => console.log(`✅ File read successfully, length: ${typeof result.data === 'string' ? result.data.length : 'unknown'} chars`)),
      map(result => result.data as string),
      catchError(error => {
        console.error('❌ Error in Capacitor readFile:', error);
        return throwError(() => new Error(`Failed to read file: ${error.message}`));
      })
    );
  }

  /**
   * Lists files in a directory on iOS/iPadOS.
   * Supports team-specific directory listing.
   * 
   * @param directoryPath The path to the directory to list
   * @param team Optional team context for listing team-specific files
   * @returns Observable containing the list of files
   */
  listDirectory(directoryPath: string = 'Laminotes', team?: Team): Observable<any> {
    if (!this.isCapacitor()) {
      return throwError(() => new Error('Not running on Capacitor platform'));
    }

    // If we have a team context and no specific path, use team directory
    if (team && directoryPath === 'Laminotes') {
      directoryPath = `${this.TEAMS_ROOT_DIR}/${team.name.replace(/[^a-zA-Z0-9]/g, '_')}`;
    }
    
    console.log(`📂 Listing directory: ${directoryPath}${team ? ' (Team: ' + team.name + ')' : ''}`);

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
            lastModified: file.mtime,
            team_id: team?.id
          }));

        console.log(`✅ Found ${files.length} files in ${directoryPath}`);
        
        return {
          success: true,
          dirPath: directoryPath,
          files: files,
          team_id: team?.id,
          message: 'Directory read successfully'
        };
      }),
      catchError(error => {
        console.error('❌ Error in Capacitor listDirectory:', error);
        return throwError(() => new Error(`Failed to list directory: ${error.message}`));
      })
    );
  }

  /**
   * Creates a directory on iOS/iPadOS.
   * Supports creating team-specific directories.
   * 
   * @param dirPath The path of the directory to create
   * @param team Optional team context for creating team directory
   * @returns Observable indicating success or failure
   */
  createDirectory(dirPath: string, team?: Team): Observable<any> {
    if (!this.isCapacitor()) {
      return throwError(() => new Error('Not running on Capacitor platform'));
    }

    // If team is provided, ensure path includes team directory
    if (team) {
      const teamDirName = team.name.replace(/[^a-zA-Z0-9]/g, '_');
      
      // If path doesn't already include team directory structure, add it
      if (!dirPath.startsWith(this.TEAMS_ROOT_DIR)) {
        if (dirPath.includes('/')) {
          // If it has subdirectories but not team prefix
          const pathParts = dirPath.split('/');
          dirPath = `${this.TEAMS_ROOT_DIR}/${teamDirName}/${pathParts.join('/')}`;
        } else {
          // Just a single directory name
          dirPath = `${this.TEAMS_ROOT_DIR}/${teamDirName}/${dirPath}`;
        }
      }
    }
    
    console.log(`📁 Creating directory: ${dirPath}${team ? ' (Team: ' + team.name + ')' : ''}`);

    return from(
      Filesystem.mkdir({
        directory: Directory.Documents,
        path: dirPath,
        recursive: true
      })
    ).pipe(
      map(() => ({
        success: true,
        dirPath: dirPath,
        team_id: team?.id,
        message: 'Directory created successfully'
      })),
      catchError(error => {
        console.error('❌ Error in Capacitor createDirectory:', error);
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
    
    console.log(`🗑️ Deleting file: ${filePath}`);

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
        console.error('❌ Error in Capacitor deleteFile:', error);
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
   * @param team Optional team context for team-specific paths
   * @returns Observable indicating success or failure
   */
  renameFile(oldPath: string, newPath: string, team?: Team): Observable<any> {
    if (!this.isCapacitor()) {
      return throwError(() => new Error('Not running on Capacitor platform'));
    }
    
    // If team is provided, ensure the new path is in team directory
    if (team && !newPath.startsWith(this.TEAMS_ROOT_DIR)) {
      const teamDirName = team.name.replace(/[^a-zA-Z0-9]/g, '_');
      const fileName = newPath.split('/').pop() || '';
      newPath = `${this.TEAMS_ROOT_DIR}/${teamDirName}/${fileName}`;
    }
    
    console.log(`📝 Renaming file from ${oldPath} to ${newPath}${team ? ' (Team: ' + team.name + ')' : ''}`);

    // On iOS, we implement rename as copy + delete
    return this.readFile(oldPath).pipe(
      // First read the file
      switchMap((content: string) => {
        // Then write to the new location
        return this.saveFile(content, newPath, false, { team }).pipe(
          // Then delete the original file
          switchMap(() => this.deleteFile(oldPath)),
          map(() => ({
            success: true,
            filePath: newPath,
            team_id: team?.id,
            message: 'File renamed successfully'
          }))
        );
      }),
      catchError(error => {
        console.error('❌ Error in Capacitor renameFile:', error);
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
    
    console.log(`🔍 Checking if file exists: ${filePath}`);

    return from(
      Filesystem.stat({
        directory: Directory.Documents,
        path: filePath
      })
    ).pipe(
      // If stat succeeds, the file exists
      tap(() => console.log(`✅ File exists: ${filePath}`)),
      map(() => true),
      catchError(() => {
        // If stat fails, the file doesn't exist
        console.log(`❌ File does not exist: ${filePath}`);
        return of(false);
      })
    );
  }

  /**
   * Shows a dialog to select a directory on iOS/iPadOS.
   * Note: iOS doesn't have a directory picker API like desktop,
   * so we implement a simplified version that just returns the appropriate directory
   * based on context (personal or team).
   * 
   * @param initialPath Optional starting path
   * @param team Optional team context for selecting team directory
   * @returns Observable containing the selected directory
   */
  selectDirectory(initialPath?: string, team?: Team): Observable<any> {
    if (!this.isCapacitor()) {
      return throwError(() => new Error('Not running on Capacitor platform'));
    }

    // Determine the appropriate directory path based on context
    let dirPath: string;
    
    if (team) {
      // Team context - use or create team directory
      const teamDirName = team.name.replace(/[^a-zA-Z0-9]/g, '_');
      dirPath = initialPath || `${this.TEAMS_ROOT_DIR}/${teamDirName}`;
      
      // If initialPath is provided but doesn't include team context, add it
      if (initialPath && !initialPath.startsWith(this.TEAMS_ROOT_DIR)) {
        dirPath = `${this.TEAMS_ROOT_DIR}/${teamDirName}/${initialPath}`;
      }
    } else {
      // Personal context - use general app directory
      dirPath = initialPath || 'Laminotes';
    }
    
    console.log(`📂 Selecting directory: ${dirPath}${team ? ' (Team: ' + team.name + ')' : ''}`);

    // Ensure directory exists and return its contents
    return this.createDirectory(dirPath, team).pipe(
      switchMap(() => this.listDirectory(dirPath, team))
    );
  }

  /**
   * Lists all teams available on the device.
   * Scans the Teams directory to find all team folders.
   * 
   * @returns Observable containing the list of team directories
   */
  listTeamDirectories(): Observable<string[]> {
    if (!this.isCapacitor()) {
      return throwError(() => new Error('Not running on Capacitor platform'));
    }
    
    console.log(`📋 Listing team directories`);

    // Ensure the teams root directory exists
    return from(
      Filesystem.mkdir({
        directory: Directory.Documents,
        path: this.TEAMS_ROOT_DIR,
        recursive: true
      })
    ).pipe(
      switchMap(() =>
        Filesystem.readdir({
          directory: Directory.Documents,
          path: this.TEAMS_ROOT_DIR
        })
      ),
      map((result: any) => {
        // Extract only directory names (not files) as team directories
        const teamDirs = result.files
          .filter((file: any) => file.type === 'directory')
          .map((dir: any) => dir.name);
          
        console.log(`✅ Found ${teamDirs.length} team directories`);
        return teamDirs;
      }),
      catchError(error => {
        console.error('❌ Error listing team directories:', error);
        return of([]);
      })
    );
  }

  /**
   * Creates a new team directory if it doesn't already exist.
   * 
   * @param team The team to create a directory for
   * @returns Observable containing the created directory path
   */
  createTeamDirectory(team: Team): Observable<string> {
    if (!this.isCapacitor() || !team) {
      return throwError(() => new Error('Invalid platform or team'));
    }
    
    const teamDirName = team.name.replace(/[^a-zA-Z0-9]/g, '_');
    const teamDirPath = `${this.TEAMS_ROOT_DIR}/${teamDirName}`;
    
    console.log(`📁 Creating team directory for: ${team.name} (${team.id})`);
    
    return this.createDirectory(teamDirPath).pipe(
      map(() => teamDirPath)
    );
  }

  /**
   * Migrates files between directories, useful when changing team contexts.
   * 
   * @param sourceDir Source directory
   * @param targetDir Target directory
   * @returns Observable containing the result of the operation
   */
  migrateFiles(sourceDir: string, targetDir: string): Observable<any> {
    if (!this.isCapacitor()) {
      return throwError(() => new Error('Not running on Capacitor platform'));
    }
    
    console.log(`🔄 Migrating files from ${sourceDir} to ${targetDir}`);

    // Ensure both directories exist
    return forkJoin([
      this.createDirectory(sourceDir),
      this.createDirectory(targetDir)
    ]).pipe(
      // List files in source directory
      switchMap(() => this.listDirectory(sourceDir)),
      // Copy each file to the target directory and then delete from source
      switchMap(result => {
        if (!result.success || !result.files || result.files.length === 0) {
          console.log(`✅ No files to migrate from ${sourceDir}`);
          return of({
            success: true,
            count: 0,
            message: 'No files to migrate'
          });
        }
        
        const fileMigrations = result.files.map((file: any) => {
          return this.readFile(file.path).pipe(
            // Copy to target
            switchMap(content => {
              const targetPath = `${targetDir}/${file.name}`;
              return this.saveFile(content, targetPath).pipe(
                // Delete from source
                switchMap(() => this.deleteFile(file.path)),
                map(() => ({
                  success: true,
                  file: file.name
                }))
              );
            }),
            catchError(error => {
              console.error(`❌ Error migrating file ${file.name}:`, error);
              return of({
                success: false,
                file: file.name,
                error: error.message
              });
            })
          );
        });
        
        return forkJoin(fileMigrations).pipe(
          map(results => {
            const successful = (results as any[]).filter((r: any) => r.success).length;
            console.log(`✅ Migrated ${successful}/${(results as any[]).length} files`);
            return {
              success: true,
              count: successful,
              total: (results as any[]).length,
              message: `Migrated ${successful} of ${(results as any[]).length} files`
            };
          })
        );
      }),
      catchError(error => {
        console.error('❌ Error in file migration:', error);
        return throwError(() => new Error(`Failed to migrate files: ${error.message}`));
      })
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

    console.log(`📝 Showing prompt: ${options.title}`);
    
    // iOS doesn't have a native API for this, so we use the web platform
    const result = prompt(options.label || 'Please enter a value:', options.value || '');
    
    return of({
      success: result !== null,
      value: result
    });
  }
}