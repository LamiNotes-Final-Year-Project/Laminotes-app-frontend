import { Injectable } from '@angular/core';
import { from, Observable, of, throwError } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class ElectronService {
  private ipcRenderer: any;
  private electronAPI: any;
  private apiService: any;

  constructor() {
    if (this.isElectron()) {
      if ((window as any).require) {
        this.ipcRenderer = (window as any).require('electron').ipcRenderer;
      }
      if ((window as any).electronAPI) {
        this.electronAPI = (window as any).electronAPI;
      }
    }
  }

  isElectron(): boolean {
    // More reliable way to detect Electron
    return !!(
      window && 
      ((window as any).process && (window as any).process.type) || 
      (window as any).electronAPI
    );
  }

  saveFile(content: string, filePath?: string, saveAs = false): Observable<void> {
    console.log('ElectronService.saveFile called with:', {
      contentLength: content ? content.length : 0, 
      filePath, 
      saveAs
    });
    
    if (!this.isElectron()) {
      console.log('Not running in Electron environment');
      return throwError(() => new Error('Not running in Electron'));
    }
    
    // First check if electronAPI is available
    if (this.electronAPI) {
      console.log('Using electronAPI.saveFile');
      const options = { content, filePath, saveAs };
      console.log('Calling with options:', { 
        contentProvided: !!content,
        filePath, 
        saveAs 
      });
      
      return from(this.electronAPI.saveFile(options))
        .pipe(
          tap((result: any) => console.log('saveFile result:', result)),
          map((result: any) => {
            if (result && result.success) {
              return undefined; // Return void on success
            } else {
              throw new Error(result?.message || 'Failed to save file');
            }
          }),
          catchError(error => {
            console.error('Error in saveFile:', error);
            return throwError(() => error);
          })
        );
    }

    // Fall back to direct IPC for older Electron apps
    console.log('Using IPC invoke for save-file');
    return from(this.ipcRenderer.invoke('save-file', { content, filePath, saveAs }))
      .pipe(
        tap((result: any) => console.log('IPC save-file result:', result)),
        map((result: any) => {
          if (result && result.success) {
            return undefined; // Return void on success
          } else {
            throw new Error(result?.message || 'Failed to save file');
          }
        }),
        catchError(error => {
          console.error('Error in saveFile IPC:', error);
          return throwError(() => error);
        })
      );
  }

  deleteFile(filePath: string): Observable<any> {
    console.log('ElectronService: deleteFile', filePath);

    if (!this.isElectron()) {
      return of({ success: false, message: 'Not running in Electron' });
    }

    if (!window.electronAPI) {
      console.error('Electron API not available');
      return of({ success: false, message: 'Electron API not available' });
    }

    return from(window.electronAPI.deleteFile(filePath)).pipe(
      map(result => {
        console.log('Delete file result:', result);
        return result;
      }),
      catchError(error => {
        console.error('Error deleting file:', error);
        return of({
          success: false,
          message: error instanceof Error ? error.message : 'Unknown error'
        });
      })
    );
  }

  renameFile(oldPath: string, newPath: string): Observable<any> {
    console.log('ElectronService: renameFile', oldPath, 'to', newPath);

    if (!this.isElectron()) {
      return of({ success: false, message: 'Not running in Electron' });
    }

    if (!window.electronAPI) {
      console.error('Electron API not available');
      return of({ success: false, message: 'Electron API not available' });
    }

    return from(window.electronAPI.renameFile(oldPath, newPath)).pipe(
      map(result => {
        console.log('Rename file result:', result);
        return result;
      }),
      catchError(error => {
        console.error('Error renaming file:', error);
        return of({
          success: false,
          message: error instanceof Error ? error.message : 'Unknown error'
        });
      })
    );
  }

  createDirectory(dirPath: string): Observable<any> {
    if (!this.isElectron()) {
      return of({ success: false, message: 'Not running in Electron' });
    }

    if (!window.electronAPI) {
      console.error('Electron API not available');
      return of({ success: false, message: 'Electron API not available' });
    }

    return from(window.electronAPI.createDirectory(dirPath)).pipe(
      map(result => {
        console.log('Create directory result:', result);
        return result;
      }),
      catchError(error => {
        console.error('Error creating directory:', error);
        return of({
          success: false,
          message: error instanceof Error ? error.message : 'Unknown error'
        });
      })
    );
  }

  selectDirectory(initialPath?: string | null): Observable<any> {
    if (!this.isElectron()) {
      return of({ success: false, message: 'Not running in Electron' });
    }

    if (!window.electronAPI) {
      console.error('Electron API not available');
      return of({ success: false, message: 'Electron API not available' });
    }

    // If an initial path is provided, it will be used as the starting directory
    // Handle null/undefined safely and ensure it's passed correctly to the API
    return from(window.electronAPI.selectDirectory(initialPath || undefined)).pipe(
      map(result => {
        console.log('Select directory result:', result);
        return result;
      }),
      catchError(error => {
        console.error('Error selecting directory:', error);
        return of({
          success: false,
          message: error instanceof Error ? error.message : 'Unknown error'
        });
      })
    );
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

  showPrompt(title: string, label: string, defaultValue: string = ''): Observable<string | null> {
    console.log('ElectronService: showPrompt', title, label, defaultValue);

    if (!this.isElectron()) {
      // Fallback to browser prompt in non-Electron environments
      const result = prompt(label, defaultValue);
      return of(result);
    }

    if (!window.electronAPI) {
      console.error('Electron API not available');
      return of(null);
    }

    return from(window.electronAPI.showPromptDialog({
      title,
      label,
      value: defaultValue,
      placeholder: 'Enter value'
    })).pipe(
      map(result => result.success ? result.value : null),
      catchError(error => {
        console.error('Error showing prompt dialog:', error);
        return of(null);
      })
    );
  }


  openFile(): Observable<any> {
    if (!this.isElectron()) {
      return of({ success: false, message: 'Not running in Electron' });
    }

    if (this.electronAPI) {
      return from(this.electronAPI.openFile());
    }

    return from(this.ipcRenderer.invoke('open-file'))
      .pipe(
        catchError(error => {
          console.error('Error in openFile:', error);
          return of({
            success: false,
            message: error instanceof Error ? error.message : 'Unknown error'
          });
        })
      );
  }

  checkFileExists(filePath: string): Observable<boolean> {
    if (!this.isElectron()) {
      return of(false);
    }

    if (this.electronAPI) {
      return from(this.electronAPI.checkFile(filePath)).pipe(
        map(result => !!result)
      );
    }

    return from(this.ipcRenderer.invoke('check-file', filePath)).pipe(
      map(result => !!result)
    );
  }
}
