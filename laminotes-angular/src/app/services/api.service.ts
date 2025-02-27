import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { FileMetadata } from '../models/file-metadata';

@Injectable({
  providedIn: 'root'
})
export class ApiService {
  private readonly BASE_URL = 'http://127.0.0.1:9090'; // TODO: Move to environment config

  constructor(private http: HttpClient) { }

  /**
   * Uploads a file to the server
   * @param filename The name of the file
   * @param content The content of the file
   * @param metadata Optional metadata for the file
   */
  uploadFile(filename: string, content: string, metadata?: FileMetadata): Observable<void> {
    const url = `${this.BASE_URL}/upload/${filename}`;
    const body = {
      file_content: content,
      metadata: metadata
    };

    return this.http.post<void>(url, body, {
      headers: new HttpHeaders({ 'Content-Type': 'application/json' })
    }).pipe(
      catchError(error => {
        console.error('Upload failed:', error);
        return throwError(() => new Error(`Failed to upload file: ${error.message}`));
      })
    );
  }

  /**
   * Fetches a file's content from the server by filename
   * @param filename The name of the file to retrieve
   */
  getFile(filename: string): Observable<string> {
    const url = `${this.BASE_URL}/files/${filename}`;
    return this.http.get(url, { responseType: 'text' }).pipe(
      catchError(error => {
        console.error('Get file failed:', error);
        return throwError(() => new Error(`Failed to get file: ${error.message}`));
      })
    );
  }

  /**
   * Lists all files available on the backend
   */
  listFiles(): Observable<string[]> {
    const url = `${this.BASE_URL}/list-files`;
    return this.http.get<string[]>(url).pipe(
      catchError(error => {
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
    const url = `${this.BASE_URL}/auth/register`;
    const body = { email, password };

    return this.http.post<void>(url, body, {
      headers: new HttpHeaders({ 'Content-Type': 'application/json' })
    }).pipe(
      catchError(error => {
        console.error('Registration failed:', error);
        return throwError(() => new Error(`Failed to register user: ${error.message}`));
      })
    );
  }

  /**
   * Logs in a user and returns the JWT token
   * @param email The user's email
   * @param password The user's password
   */
  loginUser(email: string, password: string): Observable<string> {
    const url = `${this.BASE_URL}/auth/login`;
    const body = { email, password };

    return this.http.post(url, body, {
      headers: new HttpHeaders({ 'Content-Type': 'application/json' }),
      observe: 'response'
    }).pipe(
      map(response => {
        const authHeader = response.headers.get('authorization');
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
          throw new Error('Token not found in response headers');
        }
        return authHeader.substring(7); // Remove 'Bearer ' prefix
      }),
      catchError(error => {
        if (error.status === 401) {
          return throwError(() => new Error('Invalid credentials. Please check your email and password.'));
        }
        console.error('Login failed:', error);
        return throwError(() => new Error(`Failed to login: ${error.message}`));
      })
    );
  }

  /**
   * Gets metadata for a file
   * @param filename The name of the file
   */
  getFileMetadata(filename: string): Observable<FileMetadata | null> {
    const url = `${this.BASE_URL}/metadata/${filename}`;
    return this.http.get<FileMetadata>(url).pipe(
      catchError(error => {
        console.error('Get metadata failed:', error);
        return throwError(() => new Error(`Failed to get metadata: ${error.message}`));
      })
    );
  }
}
