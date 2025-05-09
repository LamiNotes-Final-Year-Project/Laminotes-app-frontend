/**
 * File management service.
 *
 * Handles all file operations including creating, reading, updating, and deleting files.
 * Provides cross-platform functionality supporting browser localStorage, Electron desktop,
 * and Capacitor mobile (iOS/iPadOS) filesystem access, with team-specific directory 
 * handling for collaborative workflows.
 */
import { Injectable } from '@angular/core';
import { Observable, of, from, throwError, forkJoin, lastValueFrom } from 'rxjs';
import { map, catchError, switchMap, tap } from 'rxjs/operators';
import { v4 as uuidv4 } from 'uuid';

import { ApiService } from './api.service';
import { MetadataService } from './metadata.service';
import { TeamService } from './team.service';
import { Team, TeamRole } from '../models/team.model';
import { ElectronService } from '../services/electron.service';
import { CapacitorService } from '../services/capacitor.service';
import { NotificationService } from './notification.service';

/**
 * Interface representing file information.
 * Contains metadata about a file and its location.
 */
export interface FileInfo {
  /** File path (either filesystem path or virtual path) */
  path: string;

  /** File name with extension */
  name: string;

  /** Optional file content data */
  data?: string;

  /** Optional timestamp of when the file was last modified */
  lastModified?: number;

  /** Optional user ID of the file owner */
  owner?: string;

  /** Optional team ID if the file belongs to a team */
  team_id?: string;
  
  /** Optional MIME type of the file */
  mimeType?: string;
  
  /** Indicates if this is a binary file (like an image) rather than text */
  isBinary?: boolean;
}

/**
 * Service responsible for file system operations.
 * Provides methods for creating, reading, updating, and deleting files,
 * with support for browser, desktop, and mobile environments.
 */
@Injectable({
  providedIn: 'root'
})
export class FileService {
  /** Current working directory path */
  currentDirectory: string | null = 'My Documents';

  /** Currently active file */
  currentFile: FileInfo | null = null;

  /** List of files in the current directory */
  filesInDirectory: FileInfo[] = [];

  /** Storage key for file list in localStorage */
  private readonly STORAGE_KEY = 'laminotes_files';

  /** Prefix for file content keys in localStorage */
  private readonly FILE_CONTENT_PREFIX = 'file_';
  
  /** Flag indicating we're running in a mobile environment */
  private isMobileEnvironment: boolean = false;

  /**
   * Gets a file path from the Electron save dialog.
   * Prompts user to select where to save a file.
   *
   * @param defaultName - Default file name to suggest
   * @param defaultDir - Optional default directory to start in
   * @returns Promise resolving to selected path or null if cancelled
   */
  private async getFilePathFromSaveDialog(defaultName: string, defaultDir?: string | null): Promise<string | null> {
    if (!this.electronService.isElectron()) {
      return null;
    }

    try {
      if ((window as any).electronAPI) {
        let filePath = defaultName;
        if (defaultDir) {
          // Use path.join to ensure path is created correctly
          if (this.path && typeof this.path.join === 'function') {
            filePath = this.path.join(defaultDir, defaultName);
          } else {
            filePath = `${defaultDir}/${defaultName}`;
          }
          console.log(`Using default directory for save dialog: ${defaultDir}, full path: ${filePath}`);
        }

        const result = await (window as any).electronAPI.saveFile({
          content: '', // No content, just getting path
          filePath: filePath,
          saveAs: true,
          getPathOnly: true, // Special flag just to get path
          defaultPath: defaultDir // Pass the default directory as well
        });

        if (result.success && result.filePath) {
          return result.filePath;
        }
      } else {
        // Fall back to direct IPC
        const electron = (window as any).require('electron');

        // If a default directory is provided, use it to create a full default path
        let filePath = defaultName;
        if (defaultDir) {
          // Try to use path module if available
          const nodePath = (window as any).require('path');
          if (nodePath) {
            filePath = nodePath.join(defaultDir, defaultName);
          } else {
            filePath = `${defaultDir}/${defaultName}`;
          }
          console.log(`Using default directory for save dialog: ${defaultDir}, full path: ${filePath}`);
        }

        const result = await electron.ipcRenderer.invoke('save-file', {
          content: '',
          filePath: filePath,
          saveAs: true,
          getPathOnly: true,
          defaultPath: defaultDir
        });

        if (result.success && result.filePath) {
          return result.filePath;
        }
      }
      return null;
    } catch (error) {
      console.error('Error getting save path:', error);
      return null;
    }
  }

  /**
   * Path utility for cross-platform file path handling.
   * Provides basic path operations that work in both browser and node environments.
   * Will be replaced with Node.js path module when running in Electron.
   */
  private path: any = {
    /**
     * Gets the directory name from a file path.
     *
     * @param filePath - Full file path
     * @returns The parent directory path
     */
    dirname: (filePath: string) => {
      const lastSlashIndex = filePath.lastIndexOf('/');
      return lastSlashIndex !== -1 ? filePath.substring(0, lastSlashIndex) : '.';
    },

    /**
     * Joins path segments into a single path.
     *
     * @param paths - Path segments to join
     * @returns Combined path
     */
    join: (...paths: string[]) => paths.join('/')
  };

  /**
   * Creates an instance of FileService.
   *
   * @param apiService - Service for API communication
   * @param metadataService - Service for file metadata management
   * @param teamService - Service for team-related operations
   * @param electronService - Service for Electron-specific functionality
   */
  /**
   * Creates an instance of FileService.
   *
   * @param apiService - Service for API communication
   * @param metadataService - Service for file metadata management
   * @param teamService - Service for team-related operations
   * @param electronService - Service for Electron-specific functionality
   * @param capacitorService - Service for Capacitor (iOS/iPadOS) functionality
   */
  constructor(
    private apiService: ApiService,
    private metadataService: MetadataService,
    private teamService: TeamService,
    private electronService: ElectronService,
    private capacitorService: CapacitorService,
    private notificationService: NotificationService
  ) {
    this.loadFilesFromLocalStorage();

    // Detect the environment we're running in
    this.isMobileEnvironment = this.capacitorService.isCapacitor();

    // For path operations in Electron environment, use Node.js path module
    if (this.electronService.isElectron()) {
      try {
        const nodePath = (window as any).require('path');
        if (nodePath) {
          console.log('Node.js path module loaded');
          this.path = nodePath;
        }
      } catch (e) {
        console.error('Error loading Node.js path module:', e);
      }
    }
    
    if (this.isMobileEnvironment) {
      console.log(`Running in mobile environment: ${this.capacitorService.getPlatformName()}`);
      // For iOS/iPadOS, set default directory to the app-specific location
      if (this.capacitorService.isIOS()) {
        this.currentDirectory = 'Laminotes';
      }
    }
  }

  /**
   * Loads file list from localStorage.
   * Used for browser mode or when no directory is set in Electron/Capacitor.
   */
  private loadFilesFromLocalStorage(): void {
    // Skip localStorage loading when using native filesystem
    if ((this.electronService.isElectron() || this.isMobileEnvironment) && this.currentDirectory) {
      console.log(`Using directory-based file list for ${this.currentDirectory}, skipping localStorage load`);
      return;
    }

    // Only load from localStorage when not using a directory
    const storedFiles = localStorage.getItem(this.STORAGE_KEY);
    if (storedFiles) {
      try {
        this.filesInDirectory = JSON.parse(storedFiles);
      } catch (e) {
        console.error('Error loading files from localStorage', e);
      }
    }

    // Create some sample files if none exist and no directory is set
    if (this.filesInDirectory.length === 0 && !this.currentDirectory) {
      this.addNewFile('Welcome.md', '# Welcome to Laminotes\n\nThis is a simple markdown editor.').subscribe();
      this.addNewFile('Sample.md', '# Sample Document\n\n## Features\n\n- Markdown editing\n- File management\n- Preview mode').subscribe();
    }
  }

  /**
   * Saves the current file list to localStorage.
   * Used for persistence in browser mode and as backup in Electron mode.
   */
  private saveFilesToLocalStorage(): void {
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.filesInDirectory));
  }


  /**
   * Refreshes the list of files in the current directory.
   *
   * Handles team directory synchronization, directory reading in Electron and Capacitor,
   * and fallback to localStorage in browser mode.
   */
  /**
   * Handles a team directory failure scenario by prompting for a new directory.
   * This helps recover from cases where a team directory becomes invalid or inaccessible.
   * 
   * @param team The team with the problematic directory
   */
  private handleDirectoryFailure(team: Team): void {
    console.warn(`🚨 Team directory validation failed for team: ${team.name}`);
    
    this.notificationService.warning(
      `The directory for team "${team.name}" is not accessible. Please select a new directory.`
    );
    
    // Prompt for directory selection
    this.electronService.selectDirectory().subscribe({
      next: result => {
        if (result.success && result.dirPath) {
          console.log(`🔄 Selected new directory for team ${team.name}: ${result.dirPath}`);
          
          // Update team directory
          this.teamService.setTeamDirectory(team, result.dirPath).subscribe(success => {
            if (success) {
              this.notificationService.success(`Updated team directory for "${team.name}"`);
              
              // Update current directory and refresh files
              this.currentDirectory = result.dirPath;
              this.filesInDirectory = result.files || [];
              this.saveFilesToLocalStorage();
            }
          });
        } else {
          console.warn('❌ Directory selection cancelled or failed');
          this.notificationService.error(
            `Please select a valid directory for team "${team.name}" to access team files.`
          );
        }
      },
      error: err => {
        console.error('Error selecting new team directory:', err);
        this.notificationService.error('Failed to select a new team directory');
      }
    });
  }
  
  refreshFileList(): void {
    // Check if we need to update currentDirectory based on active team
    const activeTeam = this.teamService.activeTeam;
    
    // Handle Electron-specific team directory logic
    if (activeTeam && this.electronService.isElectron()) {
      const teamDirectory = this.teamService.getTeamDirectory(activeTeam.id);

      // If team has a directory set, use it
      if (teamDirectory && this.currentDirectory !== teamDirectory) {
        console.log(`Setting current directory to team directory: ${teamDirectory}`);
        this.currentDirectory = teamDirectory as string;

        // Make sure team directory exists
        this.electronService.checkFileExists(teamDirectory).subscribe(exists => {
          if (!exists) {
            console.log(`Team directory ${teamDirectory} does not exist, creating it`);
            this.electronService.createDirectory(teamDirectory).subscribe(result => {
              if (result.success) {
                console.log(`Successfully created team directory: ${teamDirectory}`);
                // Re-read directory after creation to refresh file list
                this.electronService.selectDirectory(teamDirectory).subscribe(dirResult => {
                  if (dirResult && dirResult.success) {
                    console.log(`Refreshed file list for newly created directory: ${teamDirectory}`);
                    this.filesInDirectory = dirResult.files || [];
                    this.saveFilesToLocalStorage();
                  }
                });
              } else {
                console.warn(`Failed to create team directory: ${result.message}`);
                // Handle failure by displaying a notification
                this.handleDirectoryFailure(activeTeam);
              }
            });
          } else {
            // Directory exists, but ensure we have the latest file list
            this.electronService.selectDirectory(teamDirectory).subscribe(dirResult => {
              if (dirResult && dirResult.success) {
                console.log(`Refreshed existing team directory: ${teamDirectory}`);
                this.filesInDirectory = dirResult.files || [];
                this.saveFilesToLocalStorage();
              } else {
                console.warn(`Failed to read team directory: ${teamDirectory}`);
                this.handleDirectoryFailure(activeTeam);
              }
            });
          }
        });
      }
    }
    
    // Handle Capacitor-specific team directory logic for iOS/iPadOS
    if (activeTeam && this.isMobileEnvironment) {
      const teamDirectory = this.teamService.getTeamDirectory(activeTeam.id);
      
      // For mobile, use a simplified team directory structure
      const mobileTeamDir = teamDirectory || `Teams/${activeTeam.name}`;
      
      if (this.currentDirectory !== mobileTeamDir) {
        console.log(`Setting mobile directory to team directory: ${mobileTeamDir}`);
        this.currentDirectory = mobileTeamDir;
        
        // Make sure directory exists in iOS filesystem
        this.capacitorService.createDirectory(mobileTeamDir).subscribe(
          result => console.log('Created team directory for mobile:', result),
          error => console.error('Failed to create team directory for mobile:', error)
        );
      }
    }

    // If in Electron with a selected directory, scan that directory
    if (this.electronService.isElectron() && this.currentDirectory) {
      console.log(`Refreshing file list for Electron directory: ${this.currentDirectory}`);

      // Use the electron API to read directory contents
      this.electronService.checkFileExists(this.currentDirectory).pipe(
        switchMap(exists => {
          if (!exists) {
            console.warn(`Directory ${this.currentDirectory} does not exist or is not accessible`);

            // If this was a team directory, try to recreate it
            if (activeTeam && this.teamService.getTeamDirectory(activeTeam.id) === this.currentDirectory && this.currentDirectory) {
              console.log(`Creating missing team directory: ${this.currentDirectory}`);
              // We know currentDirectory is non-null here
              return this.electronService.createDirectory(this.currentDirectory).pipe(
                switchMap(result => {
                  if (result.success) {
                    console.log(`Successfully created team directory: ${this.currentDirectory}`);
                    return this.electronService.selectDirectory(this.currentDirectory as string);
                  } else {
                    console.warn(`Failed to create team directory: ${result.message}`);
                    // Reset to no directory
                    this.currentDirectory = null;
                    this.filesInDirectory = [];
                    this.saveFilesToLocalStorage();
                    return of(null);
                  }
                })
              );
            } else {
              this.currentDirectory = null;
              this.filesInDirectory = [];
              this.saveFilesToLocalStorage();
              return of(null);
            }
          }

          // Use selectDirectory to re-read the current directory
          console.log(`Reading contents of directory: ${this.currentDirectory}`);
          return this.electronService.selectDirectory(this.currentDirectory as string);
        })
      ).subscribe({
        next: (result) => {
          if (result && result.success && result.files) {
            console.log(`Found ${result.files.length} files in directory ${this.currentDirectory}`);
            // Add team_id to files if in team context
            if (activeTeam) {
              result.files.forEach((file: FileInfo) => {
                file.team_id = activeTeam.id;
              });
            }

            // Set the files list
            this.filesInDirectory = result.files;

            // Update localStorage
            this.saveFilesToLocalStorage();
          } else {
            console.log('No valid result from directory read, showing empty list');
            if (this.currentDirectory) {
              this.filesInDirectory = [];
              this.saveFilesToLocalStorage();
            }
          }
        },
        error: (error) => {
          console.error('Error refreshing directory file list:', error);
          // In case of error, fall back to localStorage
          this.loadFilesFromLocalStorage();
        }
      });

      return;
    }
    
    // If on iOS/iPadOS with Capacitor
    if (this.isMobileEnvironment && this.currentDirectory) {
      console.log(`Refreshing file list for iOS directory: ${this.currentDirectory}`);
      
      // Use Capacitor API to read directory contents
      this.capacitorService.listDirectory(this.currentDirectory).subscribe({
        next: (result) => {
          if (result && result.success && result.files) {
            console.log(`Found ${result.files.length} files in iOS directory ${this.currentDirectory}`);
            
            // Add team_id to files if in team context
            if (activeTeam) {
              result.files.forEach((file: FileInfo) => {
                file.team_id = activeTeam.id;
              });
            }
            
            // Set the files list
            this.filesInDirectory = result.files;
            
            // Update localStorage as backup
            this.saveFilesToLocalStorage();
          } else {
            console.log('No valid result from iOS directory read, showing empty list');
            this.filesInDirectory = [];
            this.saveFilesToLocalStorage();
          }
        },
        error: (error) => {
          console.error('Error refreshing iOS directory file list:', error);
          // In case of error, fall back to localStorage
          this.loadFilesFromLocalStorage();
        }
      });
      
      return;
    }

    // If no directory is set, load from localStorage
    this.loadFilesFromLocalStorage();

    this.apiService.listFiles().subscribe({
      next: (fileNames) => {
        const existingFilePaths = new Set(this.filesInDirectory.map(f => f.name));

        // Add any new files from the server
        fileNames.forEach(fileName => {
          if (!existingFilePaths.has(fileName)) {
            const id = uuidv4();
            const newFilePath = `${id}/${fileName}`;
            this.filesInDirectory.push({
              path: newFilePath,
              name: fileName,
              team_id: activeTeam?.id // Add team ID if active
            });
          }
        });

        this.saveFilesToLocalStorage();
      },
      error: (error) => console.error('Error refreshing file list:', error)
    });
  }

  /**
   * Opens a file and returns its content.
   * Tries localStorage first, then falls back to server fetch if needed.
   *
   * @param file - The file information object to open
   * @returns Observable of the file content as a string
   */
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

  /**
   * Saves file content to disk or localStorage.
   * Handles Electron desktop, Capacitor mobile, and browser environments 
   * with appropriate storage mechanisms.
   *
   * @param content - The file content to save
   * @param newFilePath - Optional path for a new file
   * @param forceSaveAs - Whether to force the use of the save dialog
   * @returns Observable completing when the save operation is finished
   */
  saveFile(content: string, newFilePath?: string, forceSaveAs: boolean = false): Observable<void> {
    const activeTeam = this.teamService.activeTeam;
    
    // ELECTRON ENVIRONMENT HANDLING
    if (this.electronService.isElectron()) {
      console.log('Running in Electron, using native save dialog');

      // Get current file path if available
      let filePath = this.currentFile ? this.currentFile.path : newFilePath;
      // Default to using saveAs for new files
      let saveAs = forceSaveAs;

      // Handle team context specially
      if (activeTeam) {
        console.log(`Saving file in Electron team context: ${activeTeam.name}`);

        // Check if team has a directory
        let teamDirectory = this.teamService.getTeamDirectory(activeTeam.id);

        // If no team directory is set, prompt user to select one
        if (!teamDirectory) {
          console.log('No team directory set, prompting user to select one');

          // prompt for directory first, then save
          return this.electronService.selectDirectory().pipe(
            switchMap(result => {
              console.log('Team directory selection result:', result);

              if (result.success && result.dirPath) {
                console.log(`Selected team directory: ${result.dirPath}`);
                teamDirectory = result.dirPath;
                return this.teamService.setTeamDirectory(activeTeam, teamDirectory as string).pipe(
                  switchMap(() => {
                    console.log(`Team directory set to: ${teamDirectory}`);
                    this.currentDirectory = teamDirectory as string;
                    const fileName = this.currentFile?.name ||
                      (newFilePath ? newFilePath.split('/').pop() : null) ||
                      'untitled.md';

                    // Create full path in team directory
                    filePath = this.path.join(teamDirectory as string, fileName);
                    console.log(`Using team file path: ${filePath}`);
                    if (this.currentFile && filePath) {
                      this.currentFile.path = filePath;
                      this.currentFile.team_id = activeTeam.id;
                    }
                    return this.electronService.saveFile(content, filePath, false);
                  })
                );
              } else {
                // User cancelled directory selection
                console.log('Team directory selection cancelled');
                return throwError(() => new Error('Team directory selection cancelled'));
              }
            })
          );
        }

        console.log(`Using existing team directory for saving: ${teamDirectory}`);

        // Always update current directory to team directory when in team context
        this.currentDirectory = teamDirectory as string;
        const fileName = this.currentFile?.name ||
          (newFilePath ? newFilePath.split('/').pop() : null) ||
          'untitled.md';

        if (this.path && typeof this.path.join === 'function') {
          filePath = this.path.join(teamDirectory as string, fileName);
        } else {
          filePath = `${teamDirectory as string}/${fileName}`;
        }

        console.log(`Using team file path: ${filePath}`);
        if (this.currentFile && filePath) {
          this.currentFile.path = filePath;
          this.currentFile.team_id = activeTeam.id;
        }
      }
      if (!filePath || !filePath.includes('/')) {
        saveAs = true;
        filePath = newFilePath || 'untitled.md'; // Default name if nothing provided
        console.log('No valid file path, forcing Save As dialog with default:', filePath);
      }

      console.log(`Saving with Electron: filePath=${filePath}, saveAs=${saveAs}`);

      /**
       * Need a different approach since we changed ElectronService.saveFile to return Observable<void>
       * which means we need to handle the filePath and success info before it returns
       */
      if (saveAs || !filePath || !filePath.includes('/')) {
        console.log('Using custom saveAs approach for first save');

        // Set default directory to team directory if available
        const defaultPath = this.currentDirectory || null;
        return from(this.getFilePathFromSaveDialog(filePath || 'untitled.md', defaultPath)).pipe(
          switchMap(selectedPath => {
            if (!selectedPath) {
              console.log('Save cancelled by user');
              return throwError(() => new Error('Save cancelled'));
            }

            console.log('Selected path:', selectedPath);

            const fileName = selectedPath.split(/[\\/]/).pop() || 'Untitled.md';

            // Set current directory to the parent directory of the selected file
            this.currentDirectory = this.path.dirname(selectedPath);
            console.log(`Setting current directory to: ${this.currentDirectory}`);

            this.currentFile = {
              path: selectedPath,
              name: fileName,
              team_id: activeTeam?.id,
              lastModified: Date.now()
            };

            // Add to file list if not already there
            const existingFileIndex = this.filesInDirectory.findIndex(f => f.path === selectedPath);
            if (existingFileIndex === -1) {
              this.filesInDirectory.push(this.currentFile);
            } else {
              // Update existing entry
              this.filesInDirectory[existingFileIndex] = this.currentFile;
            }
            this.saveFilesToLocalStorage();
            return this.electronService.saveFile(content, selectedPath, false);
          }),
          catchError(error => {
            console.error('Error in saveAs flow:', error);
            return throwError(() => error);
          })
        );
      }
      if (filePath.startsWith('/') && !filePath.startsWith('/Users')) {
        console.warn(`Fixing incorrect absolute path: ${filePath}. This may be trying to save to root.`);
        if (this.currentDirectory) {
          filePath = this.path.join(this.currentDirectory, filePath.substring(1));
          console.log(`Fixed path to: ${filePath}`);
        } else {

          // Set default directory to team directory if available
          const teamDirectory = activeTeam ? this.teamService.getTeamDirectory(activeTeam.id) : null;
          const defaultPath = teamDirectory || null;

          return from(this.getFilePathFromSaveDialog(filePath.split('/').pop() || 'untitled.md', defaultPath)).pipe(
            switchMap(selectedPath => {
              if (!selectedPath) {
                console.log('Save cancelled by user');
                return throwError(() => new Error('Save cancelled'));
              }

              console.log('Selected path:', selectedPath);
              return this.electronService.saveFile(content, selectedPath, false);
            })
          );
        }
      }

      return this.electronService.saveFile(content, filePath, false).pipe(
        tap(() => {
          // On success, update local storage as backup
          localStorage.setItem(`${this.FILE_CONTENT_PREFIX}${filePath}`, content);

          // Update lastModified
          if (this.currentFile) {
            this.currentFile.lastModified = Date.now();
            this.currentFile.team_id = activeTeam?.id; // Ensures team is set

            // Update in files list
            const index = this.filesInDirectory.findIndex(f => f.path === filePath);
            if (index !== -1) {
              this.filesInDirectory[index] = this.currentFile;
              this.saveFilesToLocalStorage();
            } else {
              this.filesInDirectory.push(this.currentFile);
              this.saveFilesToLocalStorage();
            }
          }
        }),
        catchError(error => {
          console.error('Error in direct save:', error);
          return throwError(() => error);
        })
      );
    } 
    // CAPACITOR (iOS/IPAD) ENVIRONMENT HANDLING
    else if (this.isMobileEnvironment) {
      console.log('Running in Capacitor (iOS/iPadOS), using mobile file system API');
      
      // Get file path or generate a new one
      let filePath = this.currentFile ? this.currentFile.path : newFilePath;
      const fileName = this.currentFile?.name || 
        (newFilePath ? newFilePath.split('/').pop() : '') || 
        'untitled.md';
      
      // Handle team context for iOS
      if (activeTeam) {
        console.log(`Saving file in iOS team context: ${activeTeam.name}`);
        
        // Check for team directory or use default structure
        let teamDirectory = this.teamService.getTeamDirectory(activeTeam.id);
        if (!teamDirectory) {
          // Create iOS-friendly team directory structure
          teamDirectory = `Teams/${activeTeam.name}`;
          console.log(`Creating iOS team directory: ${teamDirectory}`);
          
          // Update team settings with this directory
          this.teamService.setTeamDirectory(activeTeam, teamDirectory).subscribe();
        }
        
        // Set current directory and construct path
        this.currentDirectory = teamDirectory;
        filePath = `${teamDirectory}/${fileName}`;
        console.log(`Using iOS team file path: ${filePath}`);
      } else if (!filePath || !filePath.includes('/')) {
        // For non-team files without a path, create a standard location
        filePath = `Laminotes/${fileName}`;
        console.log(`Using default iOS path: ${filePath}`);
      }
      
      // Use Capacitor to save the file
      return this.capacitorService.saveFile(content, filePath, forceSaveAs).pipe(
        tap(result => {
          console.log('Capacitor save result:', result);
          
          // If path changed, update it
          if (result.filePath && result.filePath !== filePath) {
            filePath = result.filePath;
          }
          
          // Store a backup in localStorage
          localStorage.setItem(`${this.FILE_CONTENT_PREFIX}${filePath}`, content);
          
          // Update or create the current file record
          if (!this.currentFile) {
            // Make sure we have a valid filePath
            if (filePath) {
              this.currentFile = {
                path: filePath,
                name: filePath.split('/').pop() || fileName,
                team_id: activeTeam?.id,
                lastModified: Date.now()
              };
            } else {
              // Create with default path if filePath is undefined
              const defaultPath = `Laminotes/${fileName}`;
              this.currentFile = {
                path: defaultPath,
                name: fileName,
                team_id: activeTeam?.id,
                lastModified: Date.now()
              };
            }
          } else if (filePath) {
            // Only update if filePath is valid
            this.currentFile.path = filePath;
            this.currentFile.lastModified = Date.now();
            this.currentFile.team_id = activeTeam?.id;
          }
          
          // Update the file list (only if currentFile is set)
          if (this.currentFile) {
            const existingIndex = this.filesInDirectory.findIndex(f => 
              f.path === this.currentFile?.path);
            if (existingIndex !== -1) {
              this.filesInDirectory[existingIndex] = this.currentFile;
            } else {
              this.filesInDirectory.push(this.currentFile);
            }
          }
          
          this.saveFilesToLocalStorage();
        }),
        catchError(error => {
          console.error('Error in Capacitor save:', error);
          return throwError(() => error);
        }),
        map(() => undefined) // Normalize return type to void
      );
    }
    // BROWSER ENVIRONMENT HANDLING (fallback)
    else {
      console.log('Running in browser, using localStorage for file storage');
      if (this.currentFile) {
        localStorage.setItem(`${this.FILE_CONTENT_PREFIX}${this.currentFile.path}`, content);
        this.currentFile.lastModified = Date.now(); // Update timestamp
        this.saveFilesToLocalStorage();

        return this.metadataService.addCommit(this.currentFile, content).pipe(
          switchMap(metadata => {
            return this.apiService.uploadFile(
              this.currentFile!.name,
              content,
              metadata,
              this.currentFile!.team_id
            ).pipe(
              catchError(error => {
                console.error('Failed to upload to server:', error);
                return of(undefined);
              })
            );
          })
        );
      }

      return this.saveToLocalStorageOnly(content, newFilePath);
    }
  }

  /**
   * Creates a new directory.
   * Only supported in Electron mode.
   *
   * @param dirName - Name of the directory to create
   * @returns Observable completing when the directory is created
   */
  addDirectory(dirName: string): Observable<void> {
    console.log('Adding directory:', dirName);

    if (this.electronService.isElectron()) {
      // Get the current directory path if any
      const currentDir = this.currentDirectory || '.';
      const newDirPath = this.path.join(currentDir, dirName);

      return this.electronService.createDirectory(newDirPath).pipe(
        map(result => {
          if (result.success) {
            console.log('Directory created:', newDirPath);
            // Switch to the newly created directory
            this.currentDirectory = newDirPath;
            this.filesInDirectory = [];
            this.saveFilesToLocalStorage();
            return undefined;
          } else {
            throw new Error(result.message || 'Failed to create directory');
          }
        })
      );
    } else {
      console.log('Directories not supported in browser mode');
      return of(undefined);
    }
  }

  /**
   * Prompts user to select a directory for file storage.
   * Handles different approaches for Electron desktop and Capacitor mobile platforms.
   * 
   * @returns Observable containing the selected directory path or null if cancelled/unsupported
   */
  selectDirectory(): Observable<string | null> {
    console.log('Selecting directory');

    // ELECTRON DESKTOP ENVIRONMENT
    if (this.electronService.isElectron()) {
      return this.electronService.selectDirectory().pipe(
        map(result => {
          console.log('Directory selection result:', result);

          if (result.success && result.dirPath) {
            console.log('Directory selected:', result.dirPath);
            this.currentDirectory = result.dirPath;

            // Clear existing files when changing directory
            this.filesInDirectory = [];
            this.currentFile = null;
            if (result.files && Array.isArray(result.files)) {
              console.log('Found', result.files.length, 'files in directory');

              this.filesInDirectory = result.files;
              this.saveFilesToLocalStorage();
            } else {
              console.log('No files in result');
            }

            return result.dirPath;
          } else {
            console.log('Directory selection cancelled');
            return null;
          }
        }),
        catchError(error => {
          console.error('Error selecting directory:', error);
          return of(null);
        })
      );
    } 
    // CAPACITOR iOS/iPadOS ENVIRONMENT
    else if (this.isMobileEnvironment) {
      console.log('Selecting directory in Capacitor iOS/iPadOS');
      
      // iOS doesn't have a proper directory picker, so we'll use a simplified approach
      // We'll either use an existing team directory or create a default one
      const activeTeam = this.teamService.activeTeam;
      
      if (activeTeam) {
        // For team context, use/create team directory
        const teamDir = this.teamService.getTeamDirectory(activeTeam.id) || `Teams/${activeTeam.name}`;
        
        return this.capacitorService.createDirectory(teamDir).pipe(
          switchMap(() => this.capacitorService.listDirectory(teamDir)),
          map(result => {
            if (result.success) {
              console.log(`Using team directory for iOS: ${teamDir}`);
              this.currentDirectory = teamDir;
              
              // Update files list
              this.filesInDirectory = result.files || [];
              if (this.filesInDirectory.length > 0) {
                console.log(`Found ${this.filesInDirectory.length} files in iOS directory`);
                
                // Tag files with team ID
                this.filesInDirectory.forEach(file => {
                  file.team_id = activeTeam.id;
                });
              } else {
                console.log('No files found in iOS directory');
              }
              
              this.saveFilesToLocalStorage();
              return teamDir;
            } else {
              console.error('Error accessing iOS directory:', result.message);
              return null;
            }
          }),
          catchError(error => {
            console.error('Error with iOS directory operations:', error);
            return of(null);
          })
        );
      } else {
        // For personal context, use default directory
        const defaultDir = 'Laminotes';
        
        return this.capacitorService.createDirectory(defaultDir).pipe(
          switchMap(() => this.capacitorService.listDirectory(defaultDir)),
          map(result => {
            if (result.success) {
              console.log(`Using default iOS directory: ${defaultDir}`);
              this.currentDirectory = defaultDir;
              
              // Update files list
              this.filesInDirectory = result.files || [];
              if (this.filesInDirectory.length > 0) {
                console.log(`Found ${this.filesInDirectory.length} files in iOS directory`);
              } else {
                console.log('No files found in iOS directory');
              }
              
              this.saveFilesToLocalStorage();
              return defaultDir;
            } else {
              console.error('Error accessing iOS directory:', result.message);
              return null;
            }
          }),
          catchError(error => {
            console.error('Error with iOS directory operations:', error);
            return of(null);
          })
        );
      }
    } 
    // BROWSER ENVIRONMENT (Fallback)
    else {
      console.log('Directory selection not supported in browser mode');
      return of(null);
    }
  }

  // Helper method for local storage fallback
  private saveToLocalStorageOnly(content: string, newFilePath?: string): Observable<void> {
    if (this.electronService.isElectron() && this.currentDirectory && this.currentFile) {
      const fixedPath = this.path.join(this.currentDirectory, this.currentFile.name);

      console.log(`Saving with fixed path: ${fixedPath} (original was: ${this.currentFile.path})`);
      this.currentFile.path = fixedPath;
      this.currentFile.lastModified = Date.now();

      // Store in localStorage as backup
      localStorage.setItem(`${this.FILE_CONTENT_PREFIX}${fixedPath}`, content);

      // Update in files list if needed
      const index = this.filesInDirectory.findIndex(f => f.name === this.currentFile!.name);
      if (index !== -1) {
        this.filesInDirectory[index] = this.currentFile;
      } else {
        this.filesInDirectory.push(this.currentFile);
      }
      this.saveFilesToLocalStorage();

      return of(undefined);
    }

    // Standard localStorage saving for web mode
    if (newFilePath) {
      localStorage.setItem(`${this.FILE_CONTENT_PREFIX}${newFilePath}`, content);
      const fileName = newFilePath.split('/').pop() || 'Untitled.md';
      this.currentFile = {
        path: newFilePath,
        name: fileName,
        lastModified: Date.now()
      };
    } else if (this.currentFile) {
      // Update existing file in localStorage
      localStorage.setItem(`${this.FILE_CONTENT_PREFIX}${this.currentFile.path}`, content);
      this.currentFile.lastModified = Date.now();
    } else {
      // Create a new file with a UUID path
      const id = uuidv4();
      const newFileName = 'Untitled.md';
      const newPath = `${id}/${newFileName}`;

      localStorage.setItem(`${this.FILE_CONTENT_PREFIX}${newPath}`, content);

      this.currentFile = {
        path: newPath,
        name: newFileName,
        lastModified: Date.now()
      };

      this.filesInDirectory.push(this.currentFile);
      this.saveFilesToLocalStorage();
    }

    return of(undefined);
  }
  /**
   * Creates a new file with optional initial content.
   * Handles team directory placement across Electron, Capacitor iOS/iPadOS,
   * and browser environments.
   *
   * @param fileName - Name of the file to create (extension added if missing)
   * @param initialContent - Optional initial content for the file
   * @returns Observable completing when the file is created
   */
  addNewFile(fileName: string, initialContent: string = ''): Observable<void> {
    // Add .md extension if it's missing
    if (!fileName.includes('.')) {
      fileName = `${fileName}.md`;
    }
    
    const activeTeam = this.teamService.activeTeam;
    const teamId = activeTeam?.id;
    
    // ELECTRON ENVIRONMENT
    if (this.electronService.isElectron()) {
      console.log('Creating new file in Electron mode');
      const teamDirectory = activeTeam ? this.teamService.getTeamDirectory(activeTeam.id) : null;

      // Create a file path using the appropriate directory
      let filePath = fileName;

      // If in team context, always use team directory
      if (activeTeam && teamDirectory) {
        this.currentDirectory = teamDirectory as string; // Ensure current directory is set to team directory
        filePath = this.path.join(teamDirectory, fileName);
        console.log(`Creating new file in team directory: ${filePath}`);

        // Create a file object with team information
        const newFile: FileInfo = {
          path: filePath,
          name: fileName,
          team_id: activeTeam.id,
          lastModified: Date.now()
        };

        // Add to files list and set as current
        this.filesInDirectory.push(newFile);
        this.currentFile = newFile;
        this.saveFilesToLocalStorage();

        return of(undefined);
      }
      // Otherwise use current directory if set
      else if (this.currentDirectory) {
        filePath = this.path.join(this.currentDirectory, fileName);
        console.log(`Creating new file in current directory: ${filePath}`);
      }
      // If no current directory is set, prompt user to select one
      else {
        console.log('No current directory set, prompting user to select one');
        return this.selectDirectory().pipe(
          switchMap(dirPath => {
            if (!dirPath) {
              return throwError(() => new Error('No directory selected'));
            }
            filePath = this.path.join(dirPath, fileName);
            console.log(`Creating new file in selected directory: ${filePath}`);

            // Create a file object
            const newFile: FileInfo = {
              path: filePath,
              name: fileName,
              lastModified: Date.now()
            };

            // Add to files list and set as current
            this.filesInDirectory.push(newFile);
            this.currentFile = newFile;
            this.saveFilesToLocalStorage();

            return of(undefined);
          })
        );
      }

      // Create a temporary file object
      const newFile: FileInfo = {
        path: filePath,
        name: fileName,
        lastModified: Date.now()
      };

      // Add to files list and set as current
      this.filesInDirectory.push(newFile);
      this.currentFile = newFile;
      this.saveFilesToLocalStorage();

      return of(undefined);
    }
    // CAPACITOR iOS/iPadOS ENVIRONMENT
    else if (this.isMobileEnvironment) {
      console.log('Creating new file in Capacitor mode (iOS/iPadOS)');
      
      // Determine the appropriate directory for the file
      let dirPath = 'Laminotes';
      let filePath = '';
      
      // If in team context, use team directory
      if (activeTeam) {
        // Get team directory or create a default one
        const teamDirectory = this.teamService.getTeamDirectory(activeTeam.id) || `Teams/${activeTeam.name}`;
        
        // Update team directory if needed
        if (!this.teamService.getTeamDirectory(activeTeam.id)) {
          this.teamService.setTeamDirectory(activeTeam, teamDirectory).subscribe();
        }
        
        dirPath = teamDirectory;
        this.currentDirectory = dirPath;
      } else if (this.currentDirectory) {
        dirPath = this.currentDirectory;
      }
      
      // Build full file path
      filePath = `${dirPath}/${fileName}`;
      console.log(`Creating new file in Capacitor at path: ${filePath}`);
      
      // Create the directory if it doesn't exist
      return this.capacitorService.createDirectory(dirPath).pipe(
        // Then save the file with the initial content
        switchMap(() => this.capacitorService.saveFile(initialContent, filePath)),
        map(result => {
          console.log('New file creation result:', result);
          
          // Create and store the file object
          const newFile: FileInfo = {
            path: filePath,
            name: fileName,
            team_id: teamId,
            lastModified: Date.now()
          };
          
          // Add to files list and set as current
          this.filesInDirectory.push(newFile);
          this.currentFile = newFile;
          this.saveFilesToLocalStorage();
          
          return undefined;
        }),
        catchError(error => {
          console.error('Error creating new file in Capacitor:', error);
          return throwError(() => error);
        })
      );
    }
    // BROWSER ENVIRONMENT (Fallback)
    else {
      console.log('Creating new file in browser mode');
      // Browser mode - create virtual file with UUID-based path
      const id = uuidv4();
      const newFilePath = `${id}/${fileName}`;

      // Save content locally in localStorage
      localStorage.setItem(`${this.FILE_CONTENT_PREFIX}${newFilePath}`, initialContent);

      // Create file info object
      const newFile: FileInfo = {
        path: newFilePath,
        name: fileName,
        team_id: teamId,
        lastModified: Date.now()
      };

      // Add to files list and persist to localStorage
      this.filesInDirectory.push(newFile);
      this.saveFilesToLocalStorage();

      // Create metadata and upload to server if possible
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
  }

  private syncWithServer(file: FileInfo, content: string): Observable<void> {
    const activeTeam = this.teamService.activeTeam;
    const teamId = activeTeam ? activeTeam.id : file.team_id;

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
          teamId
        ).pipe(
          catchError(error => {
            console.error('Failed to sync with server:', error);
            return of(undefined);
          })
        );
      })
    );
  }
  
  /**
   * Handles image upload and processing.
   * Supports both base64 embedded images and file references.
   * 
   * @param imageFile - The image file to process
   * @param maxEmbeddedSize - Maximum size in bytes for embedded images (default: 1MB)
   * @param forceEmbed - Whether to force embedding regardless of size
   * @returns Observable containing the markdown text to insert
   */
  uploadImage(imageFile: File, maxEmbeddedSize: number = 1024 * 1024, forceEmbed: boolean = false): Observable<string> {
    console.log(`Processing image: ${imageFile.name} (${imageFile.size} bytes)`);
    
    // Determine the storage strategy based on file size and settings
    const storageStrategy = this.determineImageStorageStrategy(imageFile, maxEmbeddedSize, forceEmbed);
    
    if (storageStrategy === 'base64') {
      return this.embedImageAsBase64(imageFile);
    } else {
      // In this initial implementation, we're only supporting base64 embedded images
      // For external storage, we'd need server-side changes to handle binary files
      console.log('External file storage not yet implemented, using base64 embedding');
      return this.embedImageAsBase64(imageFile);
    }
  }
  
  /**
   * Determines whether an image should be embedded as base64 or stored as a file.
   * 
   * @param imageFile - The image file to check
   * @param maxEmbeddedSize - Maximum size in bytes for embedded images
   * @param forceEmbed - Whether to force embedding regardless of size
   * @returns The storage strategy to use ('base64' or 'external')
   */
  private determineImageStorageStrategy(
    imageFile: File, 
    maxEmbeddedSize: number, 
    forceEmbed: boolean
  ): 'base64' | 'external' {
    // Always embed if forced
    if (forceEmbed) {
      return 'base64';
    }
    
    // Use external storage for larger files
    if (imageFile.size > maxEmbeddedSize) {
      return 'external';
    }
    
    // Default to base64 for smaller files
    return 'base64';
  }
  
  /**
   * Embeds an image as base64 in markdown format.
   * 
   * @param imageFile - The image file to embed
   * @returns Observable containing the markdown text with the embedded image
   */
  private embedImageAsBase64(imageFile: File): Observable<string> {
    return new Observable<string>(observer => {
      const reader = new FileReader();
      
      reader.onload = (event) => {
        const dataUrl = event.target?.result as string;
        
        if (dataUrl) {
          // Generate alt text from the filename (without extension)
          const altText = imageFile.name.split('.')[0] || 'image';
          
          // Create markdown image syntax
          const markdownText = `![${altText}](${dataUrl})`;
          
          observer.next(markdownText);
          observer.complete();
        } else {
          observer.error(new Error('Failed to read image data'));
        }
      };
      
      reader.onerror = (error) => {
        console.error('Error reading image file:', error);
        observer.error(new Error('Failed to read image file'));
      };
      
      reader.readAsDataURL(imageFile);
    });
  }
  
  /**
   * Gets the MIME type of a file based on its extension.
   * 
   * @param filename - The filename to check
   * @returns The MIME type or undefined if unknown
   */
  getMimeType(filename: string): string | undefined {
    const extension = filename.split('.').pop()?.toLowerCase();
    
    if (!extension) {
      return undefined;
    }
    
    const mimeTypes: Record<string, string> = {
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'png': 'image/png',
      'gif': 'image/gif',
      'svg': 'image/svg+xml',
      'webp': 'image/webp',
      'md': 'text/markdown',
      'txt': 'text/plain',
      'html': 'text/html',
      'pdf': 'application/pdf',
    };
    
    return mimeTypes[extension];
  }
  
  /**
   * Checks if a file is an image based on its MIME type.
   * 
   * @param file - The file info to check
   * @returns True if the file is an image
   */
  isImageFile(file: FileInfo): boolean {
    const mimeType = file.mimeType || this.getMimeType(file.name);
    return mimeType ? mimeType.startsWith('image/') : false;
  }

  renameFile(file: FileInfo, newFileName: string): Observable<void> {
    console.log('Renaming file:', file, 'to', newFileName);

    if (!newFileName) {
      return of(undefined);
    }

    if (!newFileName.includes('.')) {
      newFileName = `${newFileName}.md`;
    }

    // Get the content
    const content = localStorage.getItem(`${this.FILE_CONTENT_PREFIX}${file.path}`) || '';

    // If running in Electron and this is a filesystem path
    if (this.electronService.isElectron() && file.path.includes('/')) {
      // Check if file exists on disk first
      return this.electronService.checkFileExists(file.path).pipe(
        switchMap(exists => {
          if (!exists) {
            console.log(`File ${file.path} does not exist on disk yet. Doing a memory rename only.`);
            return this.renameBrowserOnly(file, newFileName, content);
          }

          // Get directory path from the file path
          const dirPath = this.path.dirname(file.path);
          const newFilePath = this.path.join(dirPath, newFileName);

          console.log(`Renaming file from ${file.path} to ${newFilePath}`);

          // Use Electron to rename file
          return this.electronService.renameFile(file.path, newFilePath).pipe(
            map(result => {
              console.log('Electron rename result:', result);

              if (result.success) {
                // Update local references
                const newFile: FileInfo = {
                  path: newFilePath,
                  name: newFileName,
                  team_id: file.team_id,
                  lastModified: Date.now() // Update timestamp
                };

                // Update files list
                const index = this.filesInDirectory.findIndex(f => f.path === file.path);
                if (index !== -1) {
                  this.filesInDirectory[index] = newFile;
                  this.saveFilesToLocalStorage();
                }

                // Update current file reference if needed
                if (this.currentFile && this.currentFile.path === file.path) {
                  this.currentFile = newFile;
                }

                // Update local storage
                localStorage.setItem(`${this.FILE_CONTENT_PREFIX}${newFilePath}`, content);
                localStorage.removeItem(`${this.FILE_CONTENT_PREFIX}${file.path}`);

                return undefined;
              } else {
                throw new Error(result.message || 'Failed to rename file');
              }
            }),
            catchError(error => {
              console.error('Error in Electron rename:', error);

              // Fall back to browser-only rename
              return this.renameBrowserOnly(file, newFileName, content);
            })
          );
        })
      );
    }

    // Browser-only rename
    return this.renameBrowserOnly(file, newFileName, content);
  }

// Helper for browser-only rename
  private renameBrowserOnly(file: FileInfo, newFileName: string, content: string): Observable<void> {
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
        team_id: file.team_id
      };

      this.filesInDirectory[index] = newFile;
      this.saveFilesToLocalStorage();

      // Update current file reference if needed
      if (this.currentFile && this.currentFile.path === file.path) {
        this.currentFile = newFile;
      }
    }

    return of(undefined);
  }


  deleteFile(file: FileInfo): Observable<void> {
    console.log('Deleting file:', file);

    // First, remove from local storage
    localStorage.removeItem(`${this.FILE_CONTENT_PREFIX}${file.path}`);

    // Remove from files list
    const index = this.filesInDirectory.findIndex(f => f.path === file.path);
    if (index !== -1) {
      this.filesInDirectory.splice(index, 1);
      this.saveFilesToLocalStorage();
    }

    // If running in Electron and file has a real file system path
    if (this.electronService.isElectron() && file.path.includes('/')) {
      // First check if the file exists on disk
      return this.electronService.checkFileExists(file.path).pipe(
        switchMap(exists => {
          if (!exists) {
            console.log(`File ${file.path} does not exist on disk. No physical deletion needed.`);
            return of(undefined);
          }

          // Try to delete from filesystem
          console.log(`File exists on disk, attempting to delete: ${file.path}`);
          return this.electronService.deleteFile(file.path).pipe(
            map(result => {
              console.log('Electron delete result:', result);
              if (!result.success) {
                console.warn('Electron delete warning:', result.message);
              }
              return undefined;
            }),
            catchError(error => {
              console.error('Error deleting file from filesystem:', error);
              return of(undefined); // Continue even if system delete fails
            })
          );
        })
      );
    }

    // In non-Electron or if path doesn't seem like a filesystem path
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

    // Get active team ID if available
    const activeTeam = this.teamService.activeTeam;
    const teamId = activeTeam?.id;
    
    // Pass team ID to the API call if we have one
    return this.apiService.getFile(filename, teamId).pipe(
      switchMap(content => {
        console.log(`✅ Downloaded content for "${filename}", length: ${content.length} bytes`);

        // Create a new file in local storage
        const id = uuidv4();
        const filePath = `${id}/${filename}`;
        
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

  /**
   * Downloads all files from the server.
   * If in a team context, ensures the files are saved to the team directory.
   *
   * @returns Observable completing when all files are downloaded
   */
  downloadAllFiles(): Observable<void> {
    const activeTeam = this.teamService.activeTeam;
    if (activeTeam && this.electronService.isElectron()) {
      let teamDirectory = this.teamService.getTeamDirectory(activeTeam.id);

      // If no team directory is set, prompt for one
      if (!teamDirectory) {
        console.log('No team directory set, prompting for selection before download');
        return this.electronService.selectDirectory().pipe(
          switchMap(result => {
            if (result.success && result.dirPath) {
              console.log(`Selected team directory: ${result.dirPath}`);
              teamDirectory = result.dirPath;

              // Set this as the team's directory
              return this.teamService.setTeamDirectory(activeTeam, teamDirectory as string).pipe(
                switchMap(() => {
                  console.log(`Team directory set to: ${teamDirectory}`);
                  this.currentDirectory = teamDirectory as string;
                  return this.performDownloadAllFiles(teamDirectory as string);
                })
              );
            } else {
              console.log('Team directory selection cancelled');
              return throwError(() => new Error('Team directory selection cancelled'));
            }
          })
        );
      } else {
        // If team directory is already set, use it
        console.log(`Using existing team directory for downloads: ${teamDirectory}`);
        this.currentDirectory = teamDirectory as string;
        return this.performDownloadAllFiles(teamDirectory as string);
      }
    } else if (this.isMobileEnvironment && activeTeam) {
      // Handle iOS/iPadOS team download specifically
      console.log(`📱 Downloading team files on iOS for team: ${activeTeam.name}`);
      
      // Ensure there's a team directory structure for iOS
      const teamPath = `Teams/${activeTeam.name.replace(/[^a-zA-Z0-9]/g, '_')}`;
      this.currentDirectory = teamPath;
      
      return this.capacitorService.createDirectory(teamPath).pipe(
        switchMap(() => {
          console.log(`📱 Team directory created/verified on iOS: ${teamPath}`);
          return this.performDownloadAllFiles(teamPath);
        })
      );
    }

    // For non-team contexts or non-Electron, use standard download
    return this.performDownloadAllFiles();
  }

  /**
   * Helper method to perform the actual file downloads.
   *
   * @param targetDirectory - Optional directory to save files to
   * @returns Observable completing when all files are downloaded
   */
  private performDownloadAllFiles(targetDirectory?: string): Observable<void> {
    console.log(`Downloading all files${targetDirectory ? ` to directory: ${targetDirectory}` : ''}`);
    
    // Get the active team ID
    const activeTeam = this.teamService.activeTeam;
    const activeTeamId = activeTeam?.id;
    
    console.log(`Using team context for download: ${activeTeam ? activeTeam.name : 'none'}`);

    return this.apiService.listFiles().pipe(
      switchMap(fileNames => {
        if (fileNames.length === 0) {
          return of(undefined);
        }

        // Create observables for each file to download
        const downloadObservables = fileNames.map(fileName =>
          this.apiService.getFile(fileName, activeTeamId).pipe(
            switchMap(content => {
              // In Electron with a target directory, save directly to that directory
              if (this.electronService.isElectron() && targetDirectory) {
                console.log(`Saving downloaded file "${fileName}" to directory: ${targetDirectory}`);

                // Create a proper file path in the target directory
                let filePath: string;
                if (this.path && typeof this.path.join === 'function') {
                  filePath = this.path.join(targetDirectory, fileName);
                } else {
                  filePath = `${targetDirectory}/${fileName}`;
                }

                // Create a FileInfo object with the correct path
                const fileInfo: FileInfo = {
                  path: filePath,
                  name: fileName,
                  team_id: activeTeamId,
                  lastModified: Date.now()
                };

                // Save the file directly to disk
                return this.electronService.saveFile(content, filePath, false).pipe(
                  map(() => {
                    console.log(`File "${fileName}" saved to ${filePath}`);

                    // Add to files list if not already there
                    const existingIndex = this.filesInDirectory.findIndex(f => f.path === filePath);
                    if (existingIndex >= 0) {
                      this.filesInDirectory[existingIndex] = fileInfo;
                    } else {
                      this.filesInDirectory.push(fileInfo);
                    }

                    // Also store content in localStorage as backup
                    localStorage.setItem(`${this.FILE_CONTENT_PREFIX}${filePath}`, content);

                    return undefined;
                  })
                );
              } else {
                // Standard localStorage approach for non-Electron or no directory
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
                    name: fileName,
                    team_id: activeTeamId
                  };
                } else {
                  // Add new entry
                  this.filesInDirectory.push({
                    path: newFilePath,
                    name: fileName,
                    team_id: activeTeamId
                  });
                }

                return of(undefined);
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
    if (activeTeam) {
      // Get current user's role in the team
      return this.teamService.getUserRoleInTeam(activeTeam.id).pipe(
        switchMap(role => {
          // Check if user has at least Contributor role
          if (role < TeamRole.Contributor) {
            console.error(`❌ Insufficient permissions for team uploads. Your role: ${role}`);
            return throwError(() => new Error('You need Contributor or Owner permissions to upload files to this team.'));
          }

          // If user has permissions, proceed with upload
          return this.performUploadAll(activeTeam.id);
        })
      );
    }

    // For personal files, no permission check needed
    return this.performUploadAll();
  }

// Helper method to perform the actual uploads
  private performUploadAll(teamId?: string): Observable<void> {
    // If we have a team ID, ensure the team context is activated before uploading
    if (teamId && this.teamService.activeTeam) {
      console.log(`🔄 Ensuring team context is activated for team ID: ${teamId}`);
      
      // First activate the team context to ensure we have the right token
      return this.teamService.setActiveTeam(this.teamService.activeTeam).pipe(
        switchMap(success => {
          if (success) {
            console.log(`✅ Team context activated successfully, proceeding with upload`);
            return this.performBatchUpload(teamId);
          } else {
            console.error(`❌ Failed to activate team context for team ID: ${teamId}`);
            return throwError(() => new Error(`Failed to activate team context for uploads. Try switching teams and back again.`));
          }
        })
      );
    }
    
    // For non-team uploads, proceed directly
    return this.performBatchUpload(teamId);
  }
  
  // Helper method to perform batch upload of all files
  private performBatchUpload(teamId?: string): Observable<void> {
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
          console.log(`🔼 Uploading file: ${file.name} to ${teamId ? 'team: ' + teamId : 'personal storage'}`);
          
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
  
  /**
   * Utility method to check and clean up localStorage when needed.
   * This helps avoid quota errors by removing old content.
   * 
   * @returns Observable indicating whether cleanup was performed
   */
  cleanupStorage(): Observable<boolean> {
    console.log('🧹 Checking if localStorage cleanup is needed');
    
    try {
      // Calculate total localStorage usage
      let totalSize = 0;
      let imageContentSize = 0;
      let largestItem = { key: '', size: 0 };
      const imagePrefixes = [this.FILE_CONTENT_PREFIX, 'image_data_', 'laminotes_img_'];
      
      // Count all items to see what's using space
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!key) continue;
        
        const value = localStorage.getItem(key) || '';
        const itemSize = key.length + value.length;
        totalSize += itemSize;
        
        // Track largest item for potential cleanup
        if (itemSize > largestItem.size) {
          largestItem = { key, size: itemSize };
        }
        
        // Check if this is image content
        if (imagePrefixes.some(prefix => key.startsWith(prefix))) {
          imageContentSize += value.length;
          console.log(`📊 Image item: ${key.substring(0, 20)}... size: ${Math.round(value.length/1024)}KB`);
        }
      }
      
      if (largestItem.size > 500000) { // 500KB
        console.warn(`⚠️ Found very large item in localStorage: ${largestItem.key.substring(0, 20)}... (${Math.round(largestItem.size/1024)}KB)`);
      }
      
      console.log(`📊 Total localStorage usage: ${Math.round(totalSize/1024)}KB, Images: ${Math.round(imageContentSize/1024)}KB`);
      
      // If close to quota limit, clean up image data
      // iPad/Safari quota is typically around 5-10MB
      const QUOTA_WARNING_KB = 4000; // 4MB
      
      if (totalSize/1024 > QUOTA_WARNING_KB) {
        console.warn(`⚠️ LocalStorage near quota limit, performing cleanup`);
        
        // Find all image-related keys
        const imageKeys: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (!key) continue;
          
          if (imagePrefixes.some(prefix => key.startsWith(prefix))) {
            imageKeys.push(key);
          }
        }
        
        // Sort by key (which includes timestamp for our format)
        // This ensures we remove oldest items first
        imageKeys.sort();
        
        // Remove the oldest half of image items
        const keysToRemove = imageKeys.slice(0, Math.ceil(imageKeys.length/2));
        console.log(`🧹 Removing ${keysToRemove.length} old image items from localStorage`);
        
        keysToRemove.forEach(key => {
          localStorage.removeItem(key);
        });
        
        console.log('✅ Cleanup complete');
        return of(true);
      }
      
      return of(false);
    } catch (error) {
      console.error('❌ Error during storage cleanup:', error);
      return of(false);
    }
  }
}
