import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError, of } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';
import { ConflictData } from '../components/conflict-resolution/conflict-resolution.component';

export interface VersionMetadata {
  versionId: string;
  timestamp: string;
  userId: string;
  username?: string;
  message?: string;
  contentHash: string;
}

export interface SaveVersionRequest {
  content: string;
  baseVersion: string;
  message?: string;
  branch?: string;
}

export interface SaveVersionResponse {
  status: 'saved' | 'conflict' | 'auto_merged';
  newVersion?: string;
  conflicts?: any[];
  message: string;
}

export interface ResolveConflictRequest {
  content: string;
  baseVersion: string;
  currentVersion: string;
  message: string;
}

@Injectable({
  providedIn: 'root'
})
export class VersionControlService {
  private readonly API_URL = 'http://35.246.27.92:9090';

  constructor(private http: HttpClient) { }

  /**
   * Save a file with version control
   * @param fileId The ID of the file
   * @param content The content to save
   * @param baseVersion The version the content was based on
   * @param message Optional commit message
   */
  saveVersion(
    fileId: string,
    content: string,
    baseVersion: string,
    message?: string
  ): Observable<SaveVersionResponse> {
    const url = `${this.API_URL}/files/${fileId}/save`;
    const data: SaveVersionRequest = {
      content,
      baseVersion,
      message
    };

    return this.http.post<SaveVersionResponse>(url, data).pipe(
      tap(response => {
        console.log(`✅ Save response:`, response);
      }),
      catchError(this.handleVersionControlError)
    );
  }

  /**
   * Get file version history
   * @param fileId The ID of the file
   */
  getVersionHistory(fileId: string): Observable<VersionMetadata[]> {
    const url = `${this.API_URL}/files/${fileId}/history`;

    return this.http.get<any>(url).pipe(
      map(response => response.versions || []),
      catchError(this.handleVersionControlError)
    );
  }

  /**
   * Get specific version content
   * @param fileId The ID of the file
   * @param versionId The version ID to retrieve
   */
  getVersionContent(fileId: string, versionId: string): Observable<string> {
    const url = `${this.API_URL}/files/${fileId}/versions/${versionId}`;

    return this.http.get(url, { responseType: 'text' }).pipe(
      catchError(this.handleVersionControlError)
    );
  }

  /**
   * Register as an active editor of a file
   * This will create a lock and register in version control
   * @param fileId The ID of the file
   */
  startEditing(fileId: string): Observable<any> {
    const url = `${this.API_URL}/files/${fileId}/edit`;

    return this.http.post(url, {}).pipe(
      catchError(this.handleVersionControlError)
    );
  }

  /**
   * Stop editing a file
   * This will release the lock
   * @param fileId The ID of the file
   */
  stopEditing(fileId: string): Observable<any> {
    const url = `${this.API_URL}/files/${fileId}/release`;

    return this.http.post(url, {}).pipe(
      catchError(this.handleVersionControlError)
    );
  }

  /**
   * Resolve conflicts in a file
   * @param fileId The ID of the file
   * @param resolvedContent The resolved content
   * @param baseVersion The base version
   * @param currentVersion The current (server) version
   */
  resolveConflicts(
    fileId: string,
    resolvedContent: string,
    baseVersion: string,
    currentVersion: string
  ): Observable<SaveVersionResponse> {
    const url = `${this.API_URL}/files/${fileId}/resolve-conflicts`;
    const data: ResolveConflictRequest = {
      content: resolvedContent,
      baseVersion,
      currentVersion,
      message: 'Manually resolved conflict'
    };

    return this.http.post<SaveVersionResponse>(url, data).pipe(
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
          console.warn('File is locked by another user:', error.error);
          return null;
        }
      } catch (e) {
        console.error('Error parsing conflict data:', e);
      }
    }
    return null;
  }

  private handleVersionControlError(error: HttpErrorResponse): Observable<never> {
    let errorMessage = 'An error occurred';

    if (error.error instanceof ErrorEvent) {
      // Client-side error
      errorMessage = `Error: ${error.error.message}`;
    } else {
      // Server-side error
      errorMessage = `Error Code: ${error.status}, Message: ${error.error?.message || error.statusText}`;
    }

    console.error(errorMessage);
    return throwError(() => error);
  }
}
