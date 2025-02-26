import { Injectable } from '@angular/core';
import {delay, Observable, of} from 'rxjs';
import { v4 as uuidv4 } from 'uuid';

export interface FileInfo {
  path: string;
  name: string;
  data?: string;
  lastModified?: number;
  owner?: string;
}

@Injectable({
  providedIn: 'root'
})
export class FileService {
  currentDirectory: string | null = 'My Documents';
  currentFile: FileInfo | null = null;
  filesInDirectory: FileInfo[] = [];

  private readonly STORAGE_KEY = 'laminotes_files';

  constructor() {
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

  selectDirectory(): Observable<void> {
    // In browser mode, we'll just use a static directory
    return of(undefined);
  }

  refreshFileList(): Observable<void> {
    this.loadFilesFromLocalStorage();
    return of(undefined);
  }

  openFile(file: FileInfo): Observable<string> {
    const storedContent = localStorage.getItem(`file_${file.path}`);
    this.currentFile = file;
    return of(storedContent || '');
  }

  saveFile(content: string, newFilePath?: string): Observable<void> {
    if (this.currentFile) {
      localStorage.setItem(`file_${this.currentFile.path}`, content);
      return of(undefined);
    }

    if (newFilePath) {
      localStorage.setItem(`file_${newFilePath}`, content);
      const fileName = newFilePath.split('/').pop() || 'Untitled.md';
      this.currentFile = {
        path: newFilePath,
        name: fileName
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

    localStorage.setItem(`file_${newFilePath}`, initialContent);

    const newFile = { path: newFilePath, name: fileName };
    this.filesInDirectory.push(newFile);
    this.saveFilesToLocalStorage();

    return of(undefined);
  }

  renameFile(file: FileInfo, newFileName: string): Observable<void> {
    if (!newFileName) {
      return of(undefined);
    }

    if (!newFileName.includes('.')) {
      newFileName = `${newFileName}.md`;
    }

    // Get the content
    const content = localStorage.getItem(`file_${file.path}`) || '';

    // Create a new file with the new name
    const id = file.path.split('/')[0];
    const newFilePath = `${id}/${newFileName}`;
    localStorage.setItem(`file_${newFilePath}`, content);

    // Remove the old file
    localStorage.removeItem(`file_${file.path}`);

    // Update the files list
    const index = this.filesInDirectory.findIndex(f => f.path === file.path);
    if (index !== -1) {
      this.filesInDirectory[index] = { path: newFilePath, name: newFileName };
      this.saveFilesToLocalStorage();
    }

    // Update current file reference if needed
    if (this.currentFile && this.currentFile.path === file.path) {
      this.currentFile = { path: newFilePath, name: newFileName };
    }

    return of(undefined);
  }

  /**
   * Load recently accessed files
   * @returns Observable with array of recently accessed FileInfo objects
   */
  loadRecentFiles(): Observable<FileInfo[]> {
    // This is a mock implementation - you'll need to replace with actual logic
    // The actual implementation would depend on how you track file access history
    return of(this.filesInDirectory.slice(0, 5)).pipe(
      delay(300) // Simulate network delay
    );
  }

  /**
   * Load shared files
   * @returns Observable with array of shared FileInfo objects
   */
  loadSharedFiles(): Observable<FileInfo[]> {
    // This is a mock implementation - you'll need to replace with actual logic
    // The actual implementation would depend on your sharing functionality
    return of([]).pipe(
      delay(300) // Simulate network delay
    );
  }

  getCurrentDirectoryName(): string {
    return this.currentDirectory || 'My Documents';
  }
}
