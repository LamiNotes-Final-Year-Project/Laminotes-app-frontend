import { Injectable } from '@angular/core';
import { from, Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class ElectronService {
  private ipcRenderer: any;
  private electronAPI: any;

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
    return !!(window &&
      (window as any).process &&
      (window as any).process.type);
  }

  saveFile(content: string, filePath?: string, saveAs = false): Observable<any> {
    if (!this.isElectron()) {
      return of({success: false, message: 'Not running in Electron'});
    }
    if (this.electronAPI) {
      return from(this.electronAPI.saveFile({ content, filePath, saveAs }))
        .pipe(
          catchError(error => {
            console.error('Error in saveFile:', error);
            return of({
              success: false,
              message: error instanceof Error ? error.message : 'Unknown error'
            });
          })
        );
    }

    // Fall back to direct IPC for older Electron apps
    return from(this.ipcRenderer.invoke('save-file', { content, filePath, saveAs }))
      .pipe(
        catchError(error => {
          console.error('Error in saveFile:', error);
          return of({
            success: false,
            message: error instanceof Error ? error.message : 'Unknown error'
          });
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
