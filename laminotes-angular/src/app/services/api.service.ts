import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpResponse } from '@angular/common/http';
import { Observable, throwError, of } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';
import { FileMetadata } from '../models/file-metadata';
import { v4 as uuidv4 } from 'uuid';
import { User } from '../models/user.model';
import { Team } from '../models/team.model';

@Injectable({
  providedIn: 'root'
})
export class ApiService {
  public readonly baseUrl = 'http://127.0.0.1:9090';
  private readonly BASE_URL = 'http://127.0.0.1:9090'; // TODO: Move to environment config

  constructor(private http: HttpClient) { }

  /**
   * Uploads a file to the server
   * @param filename The name of the file
   * @param content The content of the file
   * @param metadata Optional metadata for the file
   * @param teamId Optional team ID for team storage
   */
  uploadFile(
    filename: string,
    content: string,
    metadata?: FileMetadata,
    teamId?: string
  ): Observable<any> {
    const url = `${this.baseUrl}/upload/${filename}`;
    console.log(`📤 Uploading file to: ${url}${teamId ? ' (Team: ' + teamId + ')' : ''}`);

    // Makes sure metadata is present if not, creates
    const fileMetadata = metadata || {
      fileId: uuidv4(),
      fileName: filename,
      lastModified: new Date().toISOString()
    };

    // Add team ID to metadata if provided
    if (teamId && fileMetadata) {
      fileMetadata.team_id = teamId;
    }

    const body = {
      file_content: content,
      metadata: fileMetadata,
      team_id: teamId // Include team ID in the request body
    };

    console.log(`📦 Upload payload:`, body);

    return this.http.post(url, body, {
      headers: new HttpHeaders({ 'Content-Type': 'application/json' })
    }).pipe(
      tap((response: any) => console.log(`✅ Upload response:`, response)),
      catchError((error: any) => {
        console.error(`❌ Upload failed:`, error);
        return throwError(() => new Error(`Failed to upload file: ${error.message}`));
      })
    );
  }

  /**
   * Fetches a file's content from the server by filename
   * @param filename The name of the file to retrieve
   */
  getFile(filename: string): Observable<string> {
    const url = `${this.baseUrl}/files/${filename}`;
    console.log(`📥 Fetching file from: ${url}`);

    return this.http.get(url, { responseType: 'text' }).pipe(
      tap((content: string) => console.log(`✅ File retrieved, length: ${content.length} bytes`)),
      catchError((error: any) => {
        console.error('Get file failed:', error);
        return throwError(() => new Error(`Failed to get file: ${error.message}`));
      })
    );
  }

  /**
   * Lists all files available on the backend
   */
  listFiles(): Observable<string[]> {
    const url = `${this.baseUrl}/list-files`;
    console.log(`📋 Listing files from: ${url}`);

    return this.http.get<string[]>(url).pipe(
      tap((files: string[]) => console.log(`✅ Files list retrieved: ${files.length} files`)),
      catchError((error: any) => {
        console.error('List files failed:', error);
        return throwError(() => new Error(`Failed to list files: ${error.message}`));
      })
    );
  }

  /**
   * Registers a new user
   * @param email The user's email
   * @param password The user's password
   */
  registerUser(email: string, password: string): Observable<void> {
    const url = `${this.baseUrl}/auth/register`;
    console.log(`📝 Registering user: ${email}`);

    const body = { email, password };

    return this.http.post<void>(url, body, {
      headers: new HttpHeaders({ 'Content-Type': 'application/json' })
    }).pipe(
      tap(() => console.log(`✅ User registered: ${email}`)),
      catchError((error: any) => {
        console.error('Registration failed:', error);
        return throwError(() => new Error(`Failed to register user: ${error.message}`));
      })
    );
  }

  /**
   * Deletes a file from the server
   * @param filename The name of the file to delete
   */
  deleteFile(filename: string): Observable<any> {
    const url = `${this.baseUrl}/files/${filename}`;
    console.log(`🗑️ Deleting file: ${filename}`);

    return this.http.delete(url).pipe(
      tap((response: any) => console.log(`✅ File deleted: ${filename}`)),
      catchError((error: any) => {
        console.error(`Failed to delete file: ${filename}`, error);
        return throwError(() => new Error(`Failed to delete file: ${error.message}`));
      })
    );
  }

  /**
   * Logs in a user and returns the JWT token
   * @param email The user's email
   * @param password The user's password
   */
  loginUser(email: string, password: string): Observable<string> {
    const url = `${this.baseUrl}/auth/login`;
    console.log(`🔑 Logging in user: ${email}`);

    const body = { email, password };

    return this.http.post(url, body, {
      headers: new HttpHeaders({ 'Content-Type': 'application/json' }),
      observe: 'response'
    }).pipe(
      map((response: HttpResponse<any>) => {
        const authHeader = response.headers.get('authorization');
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
          throw new Error('Token not found in response headers');
        }
        console.log(`✅ Login successful, token received`);
        return authHeader.substring(7); // Remove 'Bearer ' prefix
      }),
      catchError((error: any) => {
        if (error.status === 401) {
          console.error(`❌ Login failed: Invalid credentials`);
          return throwError(() => new Error('Invalid credentials. Please check your email and password.'));
        }
        console.error('Login failed:', error);
        return throwError(() => new Error(`Failed to login: ${error.message}`));
      })
    );
  }

  /**
   * Gets information about the currently authenticated user
   */
  getCurrentUser(): Observable<User> {
    const url = `${this.baseUrl}/auth/me`;
    console.log(`👤 Fetching current user from: ${url}`);

    return this.http.get<User>(url).pipe(
      tap((user) => console.log(`✅ User info received:`, user)),
      catchError((error) => {
        console.error(`❌ Failed to get user info:`, error);
        return throwError(() => new Error(`Failed to get user info: ${error.message}`));
      })
    );
  }

  /**
   * Gets metadata for a file
   * @param filename The name of the file
   */
  getFileMetadata(filename: string): Observable<FileMetadata | null> {
    const url = `${this.baseUrl}/metadata/${filename}`;
    console.log(`🔍 Fetching metadata from: ${url}`);

    return this.http.get<FileMetadata>(url).pipe(
      tap((metadata: FileMetadata) => console.log(`✅ Metadata received:`, metadata)),
      catchError((error: any) => {
        console.warn(`⚠️ No metadata found for file ${filename}, creating default metadata`, error);

        // Create default metadata if server doesn't return any
        const defaultMetadata: FileMetadata = {
          fileId: uuidv4(), // Generate a new UUID
          fileName: filename,
          lastModified: new Date().toISOString()
        };

        return of(defaultMetadata);
      })
    );
  }

  /**
   * Creates a new team
   * @param name The name of the team
   */
  createTeam(name: string): Observable<Team> {
    const url = `${this.baseUrl}/teams`;
    console.log(`🏢 Creating team: ${name}`);

    return this.http.post<Team>(url, { name }, {
      headers: new HttpHeaders({ 'Content-Type': 'application/json' })
    }).pipe(
      tap(team => console.log(`✅ Team created: ${team.name} (${team.id})`)),
      catchError(error => {
        console.error('Failed to create team:', error);
        return throwError(() => new Error(`Failed to create team: ${error.message}`));
      })
    );
  }

  /**
   * Gets all teams for the current user
   */
  getUserTeams(): Observable<Team[]> {
    const url = `${this.baseUrl}/teams`;
    console.log(`📋 Fetching user teams`);

    return this.http.get<Team[]>(url).pipe(
      tap(teams => console.log(`✅ Fetched ${teams.length} teams`)),
      catchError(error => {
        console.error('Failed to fetch teams:', error);
        return throwError(() => new Error(`Failed to fetch teams: ${error.message}`));
      })
    );
  }

  /**
   * Activates a team for the current session
   * @param teamId The ID of the team to activate
   */
  activateTeam(teamId: string): Observable<{ token: string, team_id: string }> {
    const url = `${this.baseUrl}/teams/${teamId}/activate`;
    console.log(`🔄 Activating team: ${teamId}`);

    return this.http.post<{ token: string, team_id: string }>(url, {}, {
      observe: 'response'
    }).pipe(
      map(response => {
        const authHeader = response.headers.get('authorization');
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
          throw new Error('Token not found in response headers');
        }

        const token = authHeader.substring(7); // Remove 'Bearer ' prefix
        console.log(`✅ Team activated, new token received`);

        return {
          token,
          team_id: teamId
        };
      }),
      catchError(error => {
        console.error('Failed to activate team:', error);
        return throwError(() => new Error(`Failed to activate team: ${error.message}`));
      })
    );
  }

  /**
   * Deactivates the current team and switches to personal files
   */
  deactivateTeam(): Observable<{ token: string }> {
    const url = `${this.baseUrl}/teams/deactivate`;
    console.log(`🔄 Deactivating team`);

    return this.http.post<{ token: string }>(url, {}, {
      observe: 'response'
    }).pipe(
      map(response => {
        const authHeader = response.headers.get('authorization');
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
          throw new Error('Token not found in response headers');
        }

        const token = authHeader.substring(7); // Remove 'Bearer ' prefix
        console.log(`✅ Team deactivated, new token received`);

        return { token };
      }),
      catchError(error => {
        console.error('Failed to deactivate team:', error);
        return throwError(() => new Error(`Failed to deactivate team: ${error.message}`));
      })
    );
  }
}
