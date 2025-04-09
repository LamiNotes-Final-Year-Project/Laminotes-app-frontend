/**
 * File metadata management service.
 * 
 * Handles the creation, storage, retrieval, and synchronization of
 * file metadata between local storage and the backend server.
 * This service maintains file history and tracking information.
 */
import { Injectable } from '@angular/core';
import { Observable, of, from } from 'rxjs';
import { map, catchError, switchMap } from 'rxjs/operators';
import { v4 as uuidv4 } from 'uuid';

import { FileMetadata, FileMetadataImpl } from '../models/file-metadata';
import { ApiService } from './api.service';
import { FileInfo } from './file.service';

/**
 * Service responsible for managing file metadata.
 * Provides methods for creating, loading, saving, and synchronizing
 * metadata that tracks file properties and history.
 */
@Injectable({
  providedIn: 'root'
})
export class MetadataService {
  /** Prefix used for storing metadata keys in localStorage */
  private readonly METADATA_STORAGE_PREFIX = 'metadata_';

  /**
   * Creates a new MetadataService instance.
   * 
   * @param apiService Service for communicating with the backend API
   */
  constructor(private apiService: ApiService) { }

  /**
   * Loads metadata for a file from local storage or server.
   * First attempts to retrieve metadata from localStorage, and if not found,
   * falls back to retrieving it from the backend server.
   * 
   * @param file The file information object containing path and name
   * @returns Observable emitting the file metadata or null if not found/error
   */
  loadMetadata(file: FileInfo): Observable<FileMetadata | null> {
    const key = `${this.METADATA_STORAGE_PREFIX}${file.path}`;
    const storedMetadata = localStorage.getItem(key);

    if (storedMetadata) {
      try {
        return of(JSON.parse(storedMetadata) as FileMetadata);
      } catch (error) {
        console.error('Error parsing metadata:', error);
        return of(null);
      }
    }

    // If not in local storage, try to get from the server
    return this.downloadFileMetadata(file.name);
  }

  /**
   * Creates new metadata for a file and persists it to storage.
   * Generates a new UUID for the file and records creation timestamp.
   * 
   * @param file The file information object to create metadata for
   * @returns Observable emitting the newly created file metadata
   */
  createMetadata(file: FileInfo): Observable<FileMetadata> {
    const metadata = new FileMetadataImpl(
      uuidv4(),
      file.name,
      new Date()
    );

    return this.saveMetadata(file, metadata).pipe(
      map(() => metadata)
    );
  }

  /**
   * Persists file metadata to local storage.
   * Uses a consistent key pattern to store and retrieve metadata.
   * Handles potential storage errors gracefully.
   * 
   * @param file The file information object containing the file path
   * @param metadata The metadata object to save
   * @returns Observable that completes when the save operation is done
   */
  saveMetadata(file: FileInfo, metadata: FileMetadata): Observable<void> {
    const key = `${this.METADATA_STORAGE_PREFIX}${file.path}`;
    try {
      localStorage.setItem(key, JSON.stringify(metadata));
      return of(undefined);
    } catch (error) {
      console.error('Error saving metadata:', error);
      return of(undefined);
    }
  }

  /**
   * Updates file metadata to track changes (commits).
   * Retrieves or creates metadata as needed, updates the last modified timestamp,
   * and persists the updated metadata to storage.
   * 
   * @param file The file information object
   * @param content The current file content
   * @param existingMetadata Optional existing metadata to update (optimization)
   * @returns Observable emitting the updated file metadata
   */
  addCommit(file: FileInfo, content: string, existingMetadata?: FileMetadata): Observable<FileMetadata> {
    return (existingMetadata ? of(existingMetadata) : this.loadMetadata(file)).pipe(
      switchMap(metadata => {
        if (metadata) {
          return of(metadata);
        } else {
          return this.createMetadata(file);
        }
      }),
      map(metadata => {
        // Update the last modified timestamp
        const updatedMetadata = new FileMetadataImpl(
          metadata.fileId,
          metadata.fileName,
          new Date()
        );

        // Save the updated metadata
        this.saveMetadata(file, updatedMetadata).subscribe();
        return updatedMetadata;
      })
    );
  }

  /**
   * Uploads file content and its metadata to the backend server.
   * Delegates to the API service for actual network communication.
   * 
   * @param filename The name of the file to upload
   * @param content The content of the file
   * @param metadata The metadata associated with the file
   * @returns Observable that completes when the upload is successful
   */
  uploadFileMetadataToBackend(filename: string, content: string, metadata: FileMetadata): Observable<void> {
    return this.apiService.uploadFile(filename, content, metadata);
  }

  /**
   * Downloads file metadata from the backend server.
   * Used when local metadata is not available or may be outdated.
   * 
   * @param filename The name of the file to get metadata for
   * @returns Observable emitting the file metadata or null if not found
   */
  downloadFileMetadata(filename: string): Observable<FileMetadata | null> {
    return this.apiService.getFileMetadata(filename);
  }
}
