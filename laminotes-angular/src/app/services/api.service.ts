import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpResponse } from '@angular/common/http';
import { Observable, throwError, of } from 'rxjs';
import { catchError, map, tap, switchMap } from 'rxjs/operators';
import { FileMetadata } from '../models/file-metadata';
import { v4 as uuidv4 } from 'uuid';
import { User } from '../models/user.model';
import {Team, TeamRole} from '../models/team.model';
import {InvitationStatus, TeamInvitation} from '../models/team-invitation.model';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class ApiService {
  public readonly baseUrl = environment.apiUrl; // Use from environment config
  
  // Helper method to get the base URL
  public getBaseUrl(): string {
    return this.baseUrl;
  }

  constructor(private http: HttpClient) { }

  /**
   * Gets team members for a specific team
   * @param teamId The ID of the team
   */
  getTeamMembers(teamId: string): Observable<any[]> {
    const url = `${this.baseUrl}/teams/${teamId}/members`;
    console.log(`👥 Fetching team members for team: ${teamId}`);

    return this.http.get<any[]>(url).pipe(
      tap(members => console.log(`✅ Fetched ${members.length} team members`)),
      catchError(error => {
        console.error('Failed to fetch team members:', error);
        // Return empty array instead of error for graceful degradation
        return of([]);
      })
    );
  }

  /**
   * Gets user details by user ID
   * @param userId The ID of the user
   */
  getUserById(userId: string): Observable<any> {
    const url = `${this.baseUrl}/users/${userId}`;
    console.log(`👤 Fetching user details for: ${userId}`);

    return this.http.get<any>(url).pipe(
      tap(user => console.log(`✅ User details fetched`)),
      catchError(error => {
        console.error('Failed to fetch user details:', error);
        // Return basic user object instead of error
        return of({
          user_id: userId,
          email: userId, // Use ID as email fallback
          display_name: 'Unknown User'
        });
      })
    );
  }

  /**
   * Updates a team member's role
   * @param teamId The ID of the team
   * @param userId The ID of the user to update
   * @param role The new role to assign
   */
  updateTeamMemberRole(teamId: string, userId: string, role: TeamRole): Observable<any> {
    const url = `${this.baseUrl}/teams/${teamId}/members/${userId}`;
    console.log(`🔄 Updating role for user ${userId} in team ${teamId} to ${role}`);

    return this.http.put(url, { role }, {
      headers: new HttpHeaders({ 'Content-Type': 'application/json' })
    }).pipe(
      tap(() => console.log(`✅ Team member role updated`)),
      catchError(error => {
        console.error('Failed to update team member role:', error);
        return throwError(() => new Error(`Failed to update role: ${error.message}`));
      })
    );
  }

  /**
   * Removes a member from a team
   * @param teamId The ID of the team
   * @param userId The ID of the user to remove
   */
  removeTeamMember(teamId: string, userId: string): Observable<any> {
    const url = `${this.baseUrl}/teams/${teamId}/members/${userId}`;
    console.log(`👋 Removing user ${userId} from team ${teamId}`);

    return this.http.delete(url).pipe(
      tap(() => console.log(`✅ Team member removed`)),
      catchError(error => {
        console.error('Failed to remove team member:', error);
        return throwError(() => new Error(`Failed to remove team member: ${error.message}`));
      })
    );
  }

  /**
   * Deletes a team completely
   * @param teamId The ID of the team to delete
   */
  deleteTeam(teamId: string): Observable<any> {
    const url = `${this.baseUrl}/teams/${teamId}`;
    console.log(`🗑️ Deleting team: ${teamId}`);

    return this.http.delete(url).pipe(
      tap(() => console.log(`✅ Team deleted`)),
      catchError(error => {
        console.error('Failed to delete team:', error);
        return throwError(() => new Error(`Failed to delete team: ${error.message}`));
      })
    );
  }

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
    console.log(`📊 Content size: ${Math.round(content.length/1024)}KB`);

    // Check for large content and trim if necessary for reliability
    if (content.length > 1000000) { // 1MB
      console.warn(`⚠️ File content exceeds 1MB (${Math.round(content.length/1024)}KB), which may cause reliability issues`);
      
      // Check if this is a base64 image-heavy file
      if (content.includes('data:image/')) {
        console.log(`🖼️ Image data detected in large file`);
      }
    }

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

    console.log(`📦 Upload payload metadata:`, fileMetadata);

    // Create headers with content type
    const headers = new HttpHeaders({
      'Content-Type': 'application/json',
      // Add team ID to headers if provided
      ...(teamId ? { 'X-Team-ID': teamId } : {})
    });

    console.log(`🔤 Request headers:`,
      teamId ? `Content-Type: application/json, X-Team-ID: ${teamId}` : 'Content-Type: application/json');

    return this.http.post(url, body, { headers }).pipe(
      tap((response: any) => console.log(`✅ Upload response:`, response)),
      catchError((error: any) => {
        console.error(`❌ Upload failed:`, error);
        // Add more detailed error information
        console.error('Status:', error.status);
        console.error('Error body:', error.error);

        if (error.status === 403) {
          console.error('⚠️ Permission error - you may need to activate the team context first!');
          console.error('Make sure to select the team in the team selector dropdown before uploading.');
          return throwError(() => new Error(`Permission denied. Make sure you've activated the team "${teamId}" first.`));
        }

        return throwError(() => new Error(`Failed to upload file: ${error.message}`));
      })
    );
  }

  /**
   * Fetches a file's content from the server by filename
   * @param filename The name of the file to retrieve
   */
  getFile(filename: string, teamId?: string): Observable<string> {
    const url = `${this.baseUrl}/files/${filename}`;
    console.log(`📥 Fetching file from: ${url}${teamId ? ' (Team: ' + teamId + ')' : ''}`);

    // Create headers with team ID if provided for team-specific file fetching
    const headers = new HttpHeaders({
      ...(teamId ? { 'X-Team-ID': teamId } : {})
    });

    const options = {
      responseType: 'text' as 'text',
      headers: headers
    };

    return this.http.get(url, options).pipe(
      tap((content: string) => console.log(`✅ File retrieved, length: ${content.length} bytes`)),
      catchError((error: any) => {
        console.error('Get file failed:', error);
        if (error.status === 404) {
          console.error(`⚠️ File not found: ${filename}`);
          return throwError(() => new Error(`File not found: ${filename}`));
        }
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
   * Creates a team invitation
   * @param teamId Team ID
   * @param email Email of the invitee
   * @param role Role to assign to the invitee
   */
  createTeamInvitation(teamId: string, email: string, role: TeamRole): Observable<TeamInvitation> {
    const url = `${this.baseUrl}/teams/${teamId}/invitations`;
    console.log(`📤 Creating team invitation: ${url}`);

    // Validate email format before sending to server
    if (!this.isValidEmail(email)) {
      return throwError(() => new Error('Invalid email format'));
    }

    // Get current user email to check if trying to invite self
    return this.getCurrentUser().pipe(
      switchMap((user: User) => {
        // Prevent self-invitation
        if (user.email.toLowerCase() === email.toLowerCase()) {
          return throwError(() => new Error('You cannot invite yourself to a team'));
        }

        // Convert the role enum to a number that matches the backend
        // In the TeamRole enum, Viewer = 0, Contributor = 1, Owner = 2
        // The backend expects a plain number value
        let roleValue: number;

        // Ensure we send the correct number representation
        if (typeof role === 'string') {
          // Handle string representation if somehow passed
          roleValue = parseInt(role as string);
        } else {
          // Handle enum value (should be a number)
          roleValue = role as number;
        }

        // Convert numeric role to the string name expected by backend
        let roleName: string;
        switch (roleValue) {
          case 0: roleName = "Viewer"; break;
          case 1: roleName = "Contributor"; break;
          case 2: roleName = "Owner"; break;
          default: roleName = "Viewer"; // Default fallback
        }

        // Log complete request payload for debugging
        const payload = {
          email,
          role: roleName  // Send as string name: "Viewer", "Contributor", or "Owner"
        };
        console.log('Sending invitation payload:', JSON.stringify(payload));

        return this.http.post<TeamInvitation>(url, payload, {
          headers: new HttpHeaders({ 'Content-Type': 'application/json' })
        }).pipe(
          tap(invitation => console.log(`✅ Invitation created: ${invitation.id}`)),
          catchError(error => {
            console.error('Failed to create invitation:', error);

            // Detailed error logging
            console.error('Error details:');
            console.error('- Status:', error.status);
            console.error('- Status text:', error.statusText);
            console.error('- Error object:', error.error);
            console.error('- Headers:', error.headers);
            console.error('- Message:', error.message);

            // Try to extract complete backend error response
            try {
              if (error.error && typeof error.error === 'object') {
                console.error('Backend error object:', JSON.stringify(error.error));
              } else if (typeof error.error === 'string') {
                console.error('Backend error string:', error.error);
              }
            } catch (e) {
              console.error('Error parsing backend error:', e);
            }

            // Parse backend error message for better user feedback
            let errorMsg = error.error?.message || error.message || 'Unknown error';

            if (errorMsg.includes('already a member')) {
              errorMsg = 'User is already a member of this team';
            } else if (errorMsg.includes('already exists') || errorMsg.includes('already invited')) {
              errorMsg = 'An invitation for this user already exists';
            } else if (errorMsg.includes('higher than your own')) {
              errorMsg = 'Cannot assign a role higher than your own';
            } else if (error.status === 400) {
              errorMsg = 'Invalid invitation request. Please check the email address format and ensure you have permission to invite users.';
            }

            return throwError(() => new Error(`Failed to create invitation: ${errorMsg}`));
          })
        );
      })
    );
  }

  /**
   * Helper method to validate email format
   */
  private isValidEmail(email: string): boolean {
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    return emailRegex.test(email);
  }

  /**
   * Gets all invitations for the current user
   */
  getUserInvitations(): Observable<TeamInvitation[]> {
    const url = `${this.baseUrl}/invitations`;
    console.log(`📥 Fetching user invitations: ${url}`);

    return this.http.get<TeamInvitation[]>(url).pipe(
      tap(invitations => console.log(`✅ Fetched ${invitations.length} invitations`)),
      catchError(error => {
        console.error('Failed to fetch invitations:', error);
        return throwError(() => new Error(`Failed to fetch invitations: ${error.message}`));
      })
    );
  }

  /**
   * Gets the current user's role in a specific team
   * @param teamId The ID of the team
   */
  getUserRoleInTeam(teamId: string): Observable<TeamRole> {
    const url = `${this.baseUrl}/teams/${teamId}/members/role`;
    console.log(`🔍 Fetching user role for team: ${teamId}`);

    return this.http.get<{role: number}>(url).pipe(
      map(response => {
        // Convert numeric role from backend to TypeScript enum
        const role: TeamRole = response.role;
        console.log(`✅ User role retrieved: ${role} (${TeamRole[role]})`);
        return role;
      }),
      catchError(error => {
        console.error('Failed to get user role:', error);
        return throwError(() => new Error(`Failed to get user role: ${error.message}`));
      })
    );
  }

  /**
   * Gets all invitations for a specific team
   * @param teamId Team ID
   */
  getTeamInvitations(teamId: string): Observable<TeamInvitation[]> {
    const url = `${this.baseUrl}/teams/${teamId}/invitations`;
    console.log(`📥 Fetching team invitations: ${url}`);

    return this.http.get<TeamInvitation[]>(url).pipe(
      tap(invitations => console.log(`✅ Fetched ${invitations.length} team invitations`)),
      catchError(error => {
        console.error('Failed to fetch team invitations:', error);
        return throwError(() => new Error(`Failed to fetch team invitations: ${error.message}`));
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
   * Responds to an invitation (accept/decline)
   * @param invitationId Invitation ID
   * @param status New status (accepted/declined)
   */
  respondToInvitation(invitationId: string, status: InvitationStatus): Observable<void> {
    const url = `${this.baseUrl}/invitations/${invitationId}`;
    console.log(`📤 Responding to invitation: ${url} with status: ${status}`);

    return this.http.put<void>(url, { status }, {
      headers: new HttpHeaders({ 'Content-Type': 'application/json' })
    }).pipe(
      tap(() => console.log(`✅ Invitation response sent: ${status}`)),
      catchError(error => {
        console.error('Failed to respond to invitation:', error);
        return throwError(() => new Error(`Failed to respond to invitation: ${error.message}`));
      })
    );
  }

  /**
   * Deletes (cancels) an invitation
   * @param invitationId Invitation ID
   */
  deleteInvitation(invitationId: string): Observable<void> {
    const url = `${this.baseUrl}/invitations/${invitationId}`;
    console.log(`🗑️ Deleting invitation: ${url}`);

    return this.http.delete<void>(url).pipe(
      tap(() => console.log(`✅ Invitation deleted`)),
      catchError(error => {
        console.error('Failed to delete invitation:', error);
        return throwError(() => new Error(`Failed to delete invitation: ${error.message}`));
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
