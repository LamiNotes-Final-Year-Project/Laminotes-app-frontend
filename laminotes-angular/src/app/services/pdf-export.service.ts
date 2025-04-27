import { Injectable } from '@angular/core';
import { ElectronService } from './electron.service';
import { CapacitorService } from './capacitor.service';
import { NotificationService } from './notification.service';
import { Observable, from, of } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class PdfExportService {
  constructor(
    private electronService: ElectronService,
    private capacitorService: CapacitorService,
    private notificationService: NotificationService
  ) {}

  /**
   * Exports content to PDF, handling different platforms appropriately
   * @param contentElement The HTML element to export
   * @param filename Default filename for the PDF
   * @returns Observable that resolves when export is complete
   */
  exportToPdf(contentElement: HTMLElement, filename: string = 'document.pdf'): Observable<boolean> {
    // Simple text-based export - gets just the text content
    return new Observable(observer => {
      try {
        // Extract text content
        const textContent = contentElement.innerText || contentElement.textContent || '';
        
        // Format as plain text
        const formattedContent = `# ${filename.replace('.pdf', '')}\n\n${textContent}`;
        
        // Handle according to platform
        if (this.electronService.isElectron()) {
          // For Electron, use saveFile dialog
          this.electronService.saveFile(
            formattedContent,
            filename.replace('.pdf', '.txt'),
            true // Always use save dialog
          ).subscribe({
            next: () => {
              this.notificationService.success('Document exported successfully as text');
              observer.next(true);
              observer.complete();
            },
            error: (error) => {
              console.error('Error exporting document:', error);
              this.notificationService.error('Failed to export document');
              observer.next(false);
              observer.complete();
            }
          });
        } 
        else if (this.capacitorService.isCapacitor()) {
          // For Capacitor, save to a documents directory
          const dirPath = 'Documents';
          const filePath = `${dirPath}/${filename.replace('.pdf', '.txt')}`;
          
          this.capacitorService.createDirectory(dirPath).pipe(
            tap(() => console.log(`Created Documents directory: ${dirPath}`)),
            map(() => {
              return this.capacitorService.saveFile(
                formattedContent,
                filePath,
                false
              );
            }),
            catchError(error => {
              console.error('Error creating Documents directory:', error);
              this.notificationService.error('Failed to create Documents directory');
              observer.next(false);
              observer.complete();
              return of(null);
            })
          ).subscribe({
            next: (result) => {
              if (result) {
                this.notificationService.success(`Document exported to ${filePath}`);
                observer.next(true);
                observer.complete();
              }
            },
            error: (error) => {
              console.error('Error saving document:', error);
              this.notificationService.error('Failed to save document');
              observer.next(false);
              observer.complete();
            }
          });
        }
        else {
          // For browser, create a download link
          const element = document.createElement('a');
          const file = new Blob([formattedContent], {type: 'text/plain'});
          element.href = URL.createObjectURL(file);
          element.download = filename.replace('.pdf', '.txt');
          document.body.appendChild(element);
          element.click();
          document.body.removeChild(element);
          
          this.notificationService.success('Document exported successfully');
          observer.next(true);
          observer.complete();
        }
      } catch (error) {
        console.error('Error exporting document:', error);
        this.notificationService.error('Failed to export document');
        observer.next(false);
        observer.complete();
      }
    });
  }
}