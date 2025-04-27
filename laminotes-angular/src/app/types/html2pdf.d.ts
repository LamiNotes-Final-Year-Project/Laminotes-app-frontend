/**
 * Type declarations for html2pdf.js
 */
declare module 'html2pdf.js' {
  interface HTML2PDFOptions {
    /** Margin options [top, right, bottom, left] in millimeters */
    margin?: number[];
    /** Output filename */
    filename?: string;
    /** Image options */
    image?: {
      type?: string;
      quality?: number;
    };
    /** HTML to canvas options */
    html2canvas?: {
      scale?: number;
      useCORS?: boolean;
      logging?: boolean;
      [key: string]: any;
    };
    /** jsPDF options */
    jsPDF?: {
      unit?: string;
      format?: string;
      orientation?: 'portrait' | 'landscape';
      [key: string]: any;
    };
    /** Output type (save, blob, etc.) */
    output?: string;
    [key: string]: any;
  }

  interface HTML2PDFResult {
    then(callback: (pdf: any) => void): HTML2PDFResult;
    catch(callback: (error: any) => void): HTML2PDFResult;
    outputPdf(type: string): Promise<any>;
    save(): Promise<void>;
    [key: string]: any;
  }

  interface HTML2PDFInstance {
    from(element: HTMLElement): HTML2PDFInstance;
    set(options: HTML2PDFOptions): HTML2PDFInstance;
    outputPdf(type: string): Promise<any>;
    save(): Promise<void>;
    [key: string]: any;
  }

  function html2pdf(): HTML2PDFInstance;
  
  export default html2pdf;
}