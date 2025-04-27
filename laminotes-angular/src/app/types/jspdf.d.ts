/**
 * Type declarations for jspdf
 */
declare module 'jspdf' {
  export interface jsPDFOptions {
    orientation?: 'portrait' | 'landscape';
    unit?: 'mm' | 'cm' | 'in' | 'px' | 'pt';
    format?: string;
    compress?: boolean;
    precision?: number;
    filters?: string[];
    [key: string]: any;
  }

  export class jsPDF {
    constructor(options?: jsPDFOptions);
    
    addPage(format?: any, orientation?: string): jsPDF;
    text(text: string, x: number, y: number, options?: any): jsPDF;
    addImage(imageData: any, format: string, x: number, y: number, width: number, height: number, alias?: string, compression?: string, rotation?: number): jsPDF;
    output(type?: string, options?: any): any;
    save(filename: string): void;
    
    internal: any;
    
    [key: string]: any;
  }
}