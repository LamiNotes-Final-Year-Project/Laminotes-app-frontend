import { Injectable } from '@angular/core';
import { Observable, of, from } from 'rxjs';
import { map, catchError, switchMap } from 'rxjs/operators';
import { v4 as uuidv4 } from 'uuid';

import { FileMetadata, FileMetadataImpl } from '../models/file-metadata';
import { ApiService } from './api.service';
import { FileInfo } from './file.service';

@Injectable({
  providedIn: 'root'
})
export class MetadataService {
  private readonly METADATA_STORAGE_PREFIX = 'metadata_';

  constructor(private apiService: ApiService) { }

  /**
   * Load metadata for a file from local storage
   * @param file The file information
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
   * Create new metadata for a file
   * @param file The file information
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
   * Save metadata to local storage
   * @param file The file information
   * @param metadata The metadata to save
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
   * Add a commit to file metadata
   * @param file The file information
   * @param content The file content
   * @param existingMetadata Optional existing metadata
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
   * Upload file metadata to the backend
   * @param filename The file name
   * @param content The file content
   * @param metadata The file metadata
   */
  uploadFileMetadataToBackend(filename: string, content: string, metadata: FileMetadata): Observable<void> {
    return this.apiService.uploadFile(filename, content, metadata);
  }

  /**
   * Download file metadata from the backend
   * @param filename The file name
   */
  downloadFileMetadata(filename: string): Observable<FileMetadata | null> {
    return this.apiService.getFileMetadata(filename);
  }
}
