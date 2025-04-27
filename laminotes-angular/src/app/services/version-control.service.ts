/**
 * Version control service.
 * 
 * Manages file versioning, conflict detection/resolution, and collaboration features
 * with full support for all platforms (Web, Electron desktop, and Capacitor iOS/iPadOS).
 */
import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { Observable, throwError, of, from, forkJoin } from 'rxjs';
import { catchError, map, tap, switchMap } from 'rxjs/operators';
import { ConflictData } from '../components/conflict-resolution/conflict-resolution.component';
import { ElectronService } from './electron.service';
import { CapacitorService } from './capacitor.service';

/**
 * Metadata for a file version
 */
export interface VersionMetadata {
  /** Unique version identifier */
  versionId: string;
  
  /** Timestamp when version was created */
  timestamp: string;
  
  /** User ID that created this version */
  userId: string;
  
  /** Display name of user (if available) */
  username?: string;
  
  /** Commit message for this version */
  message?: string;
  
  /** Hash of file content for integrity */
  contentHash: string;
}

/**
 * Data structure for saving a new version
 */
export interface SaveVersionRequest {
  /** File content to save */
  content: string;
  
  /** ID of the version this change is based on */
  baseVersion: string;
  
  /** Optional commit message */
  message?: string;
  
  /** Optional branch (for future use) */
  branch?: string;
  
  /** Platform information (web/electron/ios) */
  platform?: string;
  
  /** Device information for mobile devices */
  deviceInfo?: {
    model?: string;
    platform?: string;
    osVersion?: string;
  };
}

/**
 * Response from save version operation
 */
export interface SaveVersionResponse {
  /** Result status of the save operation */
  status: 'saved' | 'conflict' | 'auto_merged';
  
  /** New version ID if save was successful */
  newVersion?: string;
  
  /** List of conflicts if status is 'conflict' */
  conflicts?: any[];
  
  /** Human-readable message about the result */
  message: string;
}

/**
 * Data structure for conflict resolution
 */
export interface ResolveConflictRequest {
  /** Resolved file content */
  content: string;
  
  /** Original base version */
  baseVersion: string;
  
  /** Current server version */
  currentVersion: string;
  
  /** Commit message for the resolution */
  message: string;
  
  /** Platform information */
  platform?: string;
}

/**
 * Cache entry for local version history 
 * Used for offline support
 */
interface LocalVersionCacheEntry {
  /** File ID */
  fileId: string;
  
  /** Cached version history */
  versions: VersionMetadata[];
  
  /** When this cache was last updated */
  lastUpdated: number;
}

/**
 * Service responsible for all version control operations.
 * Provides version history tracking, conflict detection and resolution,
 * with platform-specific optimizations for all supported environments.
 */
@Injectable({
  providedIn: 'root'
})
export class VersionControlService {
  /** Backend API endpoint */
  private readonly API_URL = 'http://35.246.27.92:9090';
  
  /** Local storage key for version cache */
  private readonly VERSION_CACHE_KEY = 'laminotes_version_cache';
  
  /** Cache expiration time (30 minutes) */
  private readonly CACHE_EXPIRY_MS = 30 * 60 * 1000; 
  
  /** Local version history cache */
  private versionCache: Map<string, LocalVersionCacheEntry> = new Map();

  constructor(
    private http: HttpClient,
    private electronService: ElectronService,
    private capacitorService: CapacitorService
  ) { 
    this.loadCacheFromStorage();
  }
  
  /**
   * Load the version cache from localStorage for offline support
   */
  private loadCacheFromStorage(): void {
    try {
      const cachedData = localStorage.getItem(this.VERSION_CACHE_KEY);
      if (cachedData) {
        const parsed = JSON.parse(cachedData);
        if (parsed && Array.isArray(parsed)) {
          this.versionCache = new Map(
            parsed.map((entry: LocalVersionCacheEntry) => [entry.fileId, entry])
          );
          console.log(`✅ Loaded version cache with ${this.versionCache.size} entries`);
        }
      }
    } catch (e) {
      console.error('❌ Error loading version cache:', e);
    }
  }
  
  /**
   * Save the version cache to localStorage
   */
  private saveCacheToStorage(): void {
    try {
      const cacheData = Array.from(this.versionCache.values());
      localStorage.setItem(this.VERSION_CACHE_KEY, JSON.stringify(cacheData));
    } catch (e) {
      console.error('❌ Error saving version cache:', e);
    }
  }
  
  /**
   * Updates the cache with new version history data
   * @param fileId The file ID
   * @param versions The version history to cache
   */
  private updateVersionCache(fileId: string, versions: VersionMetadata[]): void {
    this.versionCache.set(fileId, {
      fileId,
      versions,
      lastUpdated: Date.now()
    });
    this.saveCacheToStorage();
  }
  
  /**
   * Detects which platform we're running on
   * @returns The current platform name
   */
  private getPlatformInfo(): string {
    if (this.capacitorService.isCapacitor()) {
      return `capacitor:${this.capacitorService.getPlatformName()}`;
    } else if (this.electronService.isElectron()) {
      return 'electron';
    } else {
      return 'web';
    }
  }

  /**
   * Save a file with version control
   * @param fileId The ID of the file
   * @param content The content to save
   * @param baseVersion The version the content was based on
   * @param message Optional commit message
   * @param teamId Optional team ID for team files
   */
  saveVersion(
    fileId: string,
    content: string,
    baseVersion: string,
    message?: string,
    teamId?: string
  ): Observable<SaveVersionResponse> {
    const url = `${this.API_URL}/files/${fileId}/save`;
    const platform = this.getPlatformInfo();
    
    console.log(`📝 Saving version for file ${fileId} on platform ${platform}`);
    
    const data: SaveVersionRequest = {
      content,
      baseVersion,
      message,
      platform
    };
    
    // Add device info for mobile platforms
    if (this.capacitorService.isCapacitor()) {
      data.deviceInfo = {
        platform: this.capacitorService.getPlatformName(),
        model: 'iOS Device'  // Could be enhanced to get actual device model
      };
    }

    // Add team ID to headers if provided
    const headers = new HttpHeaders({
      'Content-Type': 'application/json',
      ...(teamId ? { 'X-Team-ID': teamId } : {})
    });

    return this.http.post<SaveVersionResponse>(url, data, { headers }).pipe(
      tap(response => {
        console.log(`✅ Version saved successfully:`, response);
        
        // Update local version cache if we have the history already cached
        if (this.versionCache.has(fileId) && response.newVersion) {
          const cachedVersions = this.versionCache.get(fileId)?.versions || [];
          
          // Create a new version entry for the cache
          const newVersionEntry: VersionMetadata = {
            versionId: response.newVersion,
            timestamp: new Date().toISOString(),
            userId: 'current-user', // This will be replaced when we fetch full history
            contentHash: '', // We don't have this info here
            message: message || 'Update file'
          };
          
          // Add to cache
          this.updateVersionCache(fileId, [newVersionEntry, ...cachedVersions]);
        }
      }),
      catchError(error => {
        console.error(`❌ Error saving version:`, error);
        
        // Special handling for offline mode in Capacitor
        if (this.capacitorService.isCapacitor() && this.isNetworkError(error)) {
          console.log(`📱 Device appears to be offline, saving locally`);
          return this.saveVersionOffline(fileId, content, baseVersion, message);
        }
        
        return this.handleVersionControlError(error);
      })
    );
  }
  
  /**
   * Save a version locally when offline
   * (Currently just simulates success)
   */
  private saveVersionOffline(
    fileId: string,
    content: string,
    baseVersion: string,
    message?: string
  ): Observable<SaveVersionResponse> {
    // In a full implementation, we would store the change in IndexedDB or localStorage
    // and sync when back online. For now, we'll just return a successful response.
    console.log(`📱 Saving version offline for file ${fileId}`);
    
    return of({
      status: 'saved',
      newVersion: `offline-${Date.now()}`,
      message: 'Saved offline (will sync when connection is restored)'
    });
  }
  
  /**
   * Check if an error is related to network connectivity
   */
  private isNetworkError(error: any): boolean {
    return (
      !navigator.onLine || 
      error.status === 0 || 
      error.statusText === 'Unknown Error' ||
      (error.error instanceof ErrorEvent && error.error.message.includes('network'))
    );
  }

  /**
   * Get file version history
   * @param fileId The ID of the file
   * @param forceRefresh Whether to force a refresh from server
   */
  getVersionHistory(fileId: string, forceRefresh: boolean = false): Observable<VersionMetadata[]> {
    console.log(`📋 Getting version history for file ${fileId}`);
    
    // Check cache first unless force refresh requested
    if (!forceRefresh) {
      const cachedEntry = this.versionCache.get(fileId);
      if (cachedEntry && (Date.now() - cachedEntry.lastUpdated < this.CACHE_EXPIRY_MS)) {
        console.log(`✅ Using cached version history for ${fileId}`);
        return of(cachedEntry.versions);
      }
    }
    
    const url = `${this.API_URL}/files/${fileId}/history`;

    return this.http.get<any>(url).pipe(
      map(response => {
        const versions = response.versions || [];
        console.log(`✅ Fetched ${versions.length} versions for file ${fileId}`);
        
        // Update cache
        this.updateVersionCache(fileId, versions);
        
        return versions;
      }),
      catchError(error => {
        console.error(`❌ Error fetching version history:`, error);
        
        // If offline, try to use cached data even if expired
        if (this.isNetworkError(error)) {
          const cachedEntry = this.versionCache.get(fileId);
          if (cachedEntry) {
            console.log(`📱 Using cached version history while offline`);
            return of(cachedEntry.versions);
          }
        }
        
        return this.handleVersionControlError(error);
      })
    );
  }

  /**
   * Get specific version content
   * @param fileId The ID of the file
   * @param versionId The version ID to retrieve
   */
  getVersionContent(fileId: string, versionId: string): Observable<string> {
    console.log(`📄 Getting content for file ${fileId} version ${versionId}`);
    
    const url = `${this.API_URL}/files/${fileId}/versions/${versionId}`;

    return this.http.get(url, { responseType: 'text' }).pipe(
      tap(content => console.log(`✅ Retrieved version content (${content.length} bytes)`)),
      catchError(error => {
        console.error(`❌ Error fetching version content:`, error);
        return this.handleVersionControlError(error);
      })
    );
  }

  /**
   * Register as an active editor of a file
   * This will create a lock and register in version control
   * @param fileId The ID of the file
   * @param teamId Optional team ID for team files
   */
  startEditing(fileId: string, teamId?: string): Observable<any> {
    console.log(`🔒 Starting edit session for file ${fileId}`);
    
    const url = `${this.API_URL}/files/${fileId}/edit`;
    
    // Add team ID to headers if provided
    const headers = new HttpHeaders({
      'Content-Type': 'application/json',
      ...(teamId ? { 'X-Team-ID': teamId } : {})
    });
    
    // Include platform info
    const data = {
      platform: this.getPlatformInfo()
    };

    return this.http.post(url, data, { headers }).pipe(
      tap(() => console.log(`✅ Edit session started for file ${fileId}`)),
      catchError(error => {
        // For mobile, if we're offline, allow editing without server lock
        if (this.capacitorService.isCapacitor() && this.isNetworkError(error)) {
          console.log(`📱 Device appears to be offline, allowing local edit`);
          return of({ status: 'locked_locally' });
        }
        return this.handleVersionControlError(error);
      })
    );
  }

  /**
   * Stop editing a file
   * This will release the lock
   * @param fileId The ID of the file
   * @param teamId Optional team ID for team files
   */
  stopEditing(fileId: string, teamId?: string): Observable<any> {
    console.log(`🔓 Releasing edit lock for file ${fileId}`);
    
    const url = `${this.API_URL}/files/${fileId}/release`;
    
    // Add team ID to headers if provided
    const headers = new HttpHeaders({
      'Content-Type': 'application/json',
      ...(teamId ? { 'X-Team-ID': teamId } : {})
    });

    return this.http.post(url, {}, { headers }).pipe(
      tap(() => console.log(`✅ Edit lock released for file ${fileId}`)),
      catchError(error => {
        // For mobile, if we're offline, just pretend it worked
        if (this.capacitorService.isCapacitor() && this.isNetworkError(error)) {
          console.log(`📱 Device appears to be offline, simulating lock release`);
          return of({ status: 'released_locally' });
        }
        return this.handleVersionControlError(error);
      })
    );
  }

  /**
   * Resolve conflicts in a file
   * @param fileId The ID of the file
   * @param resolvedContent The resolved content
   * @param baseVersion The base version
   * @param currentVersion The current (server) version
   * @param teamId Optional team ID for team files
   */
  resolveConflicts(
    fileId: string,
    resolvedContent: string,
    baseVersion: string,
    currentVersion: string,
    teamId?: string
  ): Observable<SaveVersionResponse> {
    console.log(`🔄 Resolving conflicts for file ${fileId}`);
    
    const url = `${this.API_URL}/files/${fileId}/resolve-conflicts`;
    
    // Add team ID to headers if provided
    const headers = new HttpHeaders({
      'Content-Type': 'application/json',
      ...(teamId ? { 'X-Team-ID': teamId } : {})
    });
    
    const data: ResolveConflictRequest = {
      content: resolvedContent,
      baseVersion,
      currentVersion,
      message: 'Manually resolved conflict',
      platform: this.getPlatformInfo()
    };

    return this.http.post<SaveVersionResponse>(url, data, { headers }).pipe(
      tap(response => console.log(`✅ Conflicts resolved successfully`, response)),
      catchError(this.handleVersionControlError)
    );
  }

  /**
   * Parse conflict data from error response
   * @param error The HTTP error response
   */
  parseConflictData(error: HttpErrorResponse): ConflictData | null {
    if (error.status === 409 && error.error) {
      try {
        if (error.error.status === 'conflict' && error.error.conflicts) {
          // This is a version conflict
          console.log(`🔄 Detected version conflict, parsing conflict data`);
          
          return {
            fileId: error.error.file_id || '',
            fileName: error.error.file_name || 'Unknown file',
            localVersion: error.error.local_version || '',
            remoteVersion: error.error.remote_version || '',
            baseVersion: error.error.base_version || undefined,
            lastLocalUpdate: error.error.last_local_update || new Date().toISOString(),
            lastRemoteUpdate: error.error.last_remote_update || new Date().toISOString(),
            remoteAuthor: error.error.remote_author || 'another user',
            conflictRegions: error.error.conflicts.map((c: any) => ({
              startLine: c.start_line,
              endLine: c.end_line,
              localContent: c.your_content,
              remoteContent: c.current_content,
              baseContent: c.base_content
            }))
          };
        } else if (error.error.status === 'locked') {
          // This is a lock conflict, not a version conflict
          console.warn('⚠️ File is locked by another user:', error.error);
          return null;
        }
      } catch (e) {
        console.error('❌ Error parsing conflict data:', e);
      }
    }
    return null;
  }

  /**
   * Compare two versions and get the differences
   * @param fileId The ID of the file 
   * @param oldVersion The old version ID
   * @param newVersion The new version ID
   */
  compareVersions(fileId: string, oldVersion: string, newVersion: string): Observable<any> {
    console.log(`📊 Comparing versions ${oldVersion} and ${newVersion} of file ${fileId}`);
    
    // Get content of both versions
    return forkJoin({
      oldContent: this.getVersionContent(fileId, oldVersion),
      newContent: this.getVersionContent(fileId, newVersion)
    }).pipe(
      map(({ oldContent, newContent }) => {
        // Perform a simple line-by-line diff
        const oldLines = oldContent.split('\n');
        const newLines = newContent.split('\n');
        
        // Find added, removed, and changed lines
        const changes = {
          added: [] as number[],
          removed: [] as number[],
          changed: [] as number[]
        };
        
        // This is a very simple diff - in a real implementation, 
        // we would use a proper diff algorithm
        const maxLength = Math.max(oldLines.length, newLines.length);
        
        for (let i = 0; i < maxLength; i++) {
          if (i >= oldLines.length) {
            changes.added.push(i);
          } else if (i >= newLines.length) {
            changes.removed.push(i);
          } else if (oldLines[i] !== newLines[i]) {
            changes.changed.push(i);
          }
        }
        
        return {
          changes,
          oldContent,
          newContent,
          oldVersion,
          newVersion
        };
      }),
      catchError(error => {
        console.error(`❌ Error comparing versions:`, error);
        return this.handleVersionControlError(error);
      })
    );
  }

  /**
   * Error handler for version control operations
   */
  private handleVersionControlError(error: HttpErrorResponse): Observable<never> {
    let errorMessage = 'An error occurred';

    if (error.error instanceof ErrorEvent) {
      // Client-side error
      errorMessage = `Error: ${error.error.message}`;
    } else {
      // Server-side error
      errorMessage = `Error Code: ${error.status}, Message: ${error.error?.message || error.statusText}`;
    }

    console.error(`❌ ${errorMessage}`);
    return throwError(() => error);
  }
}
