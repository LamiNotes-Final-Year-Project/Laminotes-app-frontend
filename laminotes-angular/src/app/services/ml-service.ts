import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, of, throwError } from 'rxjs';
import { catchError, map, switchMap } from 'rxjs/operators';
import { AuthService } from './auth.service';
import { ApiService } from './api.service';
import { environment } from '../../environments/environment';

/**
 * ML Service that provides text transformation capabilities
 * including reformatting, code generation, and mermaid chart creation
 * using the Claude API through the backend proxy.
 */
@Injectable({
  providedIn: 'root'
})
export class MlService {
  private onlineStatus = navigator.onLine;

  constructor(
    private http: HttpClient,
    private authService: AuthService,
    private apiService: ApiService
  ) {
    window.addEventListener('online', () => this.onlineStatus = true);
    window.addEventListener('offline', () => this.onlineStatus = false);
  }

  /**
   * Checks if the ML service is available
   * @returns True if the service is available
   */
  isAvailable(): boolean {
    return this.onlineStatus;
  }

  /**
   * Reformats the selected text to improve its structure and readability
   * @param text The text to reformat
   * @returns Observable with the reformatted text
   */
  reformatText(text: string): Observable<string> {
    if (!this.isAvailable()) {
      return throwError(() => new Error('ML service is not available offline'));
    }

    const prompt = `Reformat the following text to improve its structure and readability. Preserve markdown formatting if present. Just return the reformatted text without explanations:

${text}`;

    return this.callClaudeApi(prompt).pipe(
      map(response => this.extractTextFromResponse(response))
    );
  }

  /**
   * Generates code based on the selected text description
   * @param text The text description of code to generate
   * @param language Optional language specification, will be inferred if not provided
   * @returns Observable with the generated code in a markdown code block
   */
  generateCode(text: string, language?: string): Observable<string> {
    if (!this.isAvailable()) {
      return throwError(() => new Error('ML service is not available offline'));
    }

    const langSpec = language ? ` in ${language}` : '';
    const prompt = `Generate code${langSpec} based on this description. Return only the code in a markdown code block with appropriate syntax highlighting. Don't include explanations or additional text:

${text}`;

    return this.callClaudeApi(prompt).pipe(
      map(response => this.extractTextFromResponse(response))
    );
  }

  /**
   * Creates a mermaid diagram based on the selected text description
   * @param text The text description of the diagram to create
   * @returns Observable with the generated mermaid diagram in a markdown code block
   */
  createMermaidDiagram(text: string): Observable<string> {
    if (!this.isAvailable()) {
      return throwError(() => new Error('ML service is not available offline'));
    }

    const prompt = `Create a mermaid.js diagram based on this description. Return only the diagram code in a markdown mermaid code block. Follow these strict rules:

1. Begin your response with exactly \`\`\`mermaid
2. Use ONLY valid mermaid.js syntax (version 10.x)
3. Choose an appropriate chart type: flowchart, sequenceDiagram, classDiagram, stateDiagram, gantt, pie, or erDiagram
4. Start with the chart type keyword on the first line (e.g., "flowchart TD" or "pie" or "gantt")
5. Do NOT use any invalid keywords or chart types
6. End your response with exactly \`\`\`
7. Don't include any explanations outside the code block

Create a diagram for:
${text}`;

    return this.callClaudeApi(prompt).pipe(
      map(response => {
        // First extract text from the response
        const mermaidContent = this.extractTextFromResponse(response);
        let validatedContent = mermaidContent;

        if (mermaidContent.includes('```mermaid')) {
          const mermaidCodeStart = mermaidContent.indexOf('```mermaid') + '```mermaid'.length;
          const mermaidCodeEnd = mermaidContent.indexOf('```', mermaidCodeStart);

          if (mermaidCodeEnd > mermaidCodeStart) {
            let mermaidCode = mermaidContent.substring(mermaidCodeStart, mermaidCodeEnd).trim();
            const firstLine = mermaidCode.split('\n')[0].trim();

            // Check if the first line contains a valid chart type
            const validTypes = ['flowchart', 'sequenceDiagram', 'classDiagram',
                                'stateDiagram', 'gantt', 'pie', 'erDiagram',
                                'graph', 'journey', 'gitGraph', 'timeline'];

            const hasValidType = validTypes.some(type => firstLine.includes(type));

            if (!hasValidType) {
              // If invalid, default to a bar chart
              mermaidCode = 'pie\n' + mermaidCode;
              validatedContent = mermaidContent.substring(0, mermaidCodeStart) +
                                 '\n' + mermaidCode +
                                 mermaidContent.substring(mermaidCodeEnd);
            }
          }
        }

        return validatedContent;
      })
    );
  }

  /**
   * Makes the API call to Claude through the backend proxy
   * @param prompt The prompt to send to the API
   * @returns Observable with the text response
   */
  private callClaudeApi(prompt: string): Observable<any> {
    console.log('Making Claude API request...');

    const url = environment.apiUrl + environment.claudeApiPath;
    console.log(`Using Claude API endpoint: ${url}`);

    const headers = new HttpHeaders({
      'Content-Type': 'application/json'
    });

    const payload = {
      prompt: prompt,
      model: 'claude-3-haiku-20240307', // Using the latest available model
      max_tokens: 2048,
      temperature: 0.2,
      system: 'You are a helpful assistant that formats text, generates code, and creates diagrams.',
      debug: true // Add debug flag to see more detail in backend logs
    };

    return this.authService.getToken().pipe(
      map(token => {
        if (token) {
          console.log('🔑 Adding auth token to request:', url);
          return headers.set('Authorization', `Bearer ${token}`);
        }
        return headers;
      }),
      switchMap(headersWithAuth => {
        console.log('Sending request to Claude API with payload:', JSON.stringify(payload));
        return this.http.post(url, payload, {
          headers: headersWithAuth,
          observe: 'response'
        }).pipe(
          map(response => {
            console.log('Received successful response from Claude API:', response.status);
            return response.body;
          })
        );
      }),
      catchError(error => {
        console.error('Claude API error:', error);

        // Try to extract more detailed error information
        let errorMessage = 'Failed to process request';

        if (error.error && typeof error.error === 'object') {
          // If there's a structured error object
          errorMessage = error.error.message || error.error.error || errorMessage;
          console.error('Backend error details:', JSON.stringify(error.error));
        } else if (typeof error.error === 'string') {
          // If there's a string error
          try {
            // Try to parse error if it's JSON
            const errorObj = JSON.parse(error.error);
            errorMessage = errorObj.message || errorObj.error || errorMessage;
          } catch (e) {
            // If not JSON, use the string directly
            errorMessage = error.error;
          }
        } else if (error.message) {
          // Use error message if available
          errorMessage = error.message;
        } else if (error.statusText) {
          // Use status text as fallback
          errorMessage = error.statusText;
        }

        // Add status code if available
        if (error.status) {
          errorMessage = `${errorMessage} (Status: ${error.status})`;
        }

        return throwError(() => new Error(errorMessage));
      })
    );
  }

  /**
   * Extracts text content from Claude API response
   * Handles multiple response formats for compatibility
   * @param response The response from the Claude API
   * @returns The extracted text content
   */
  private extractTextFromResponse(response: any): string {
    console.log('Extracting text from response:', response);

    // If response is null or undefined, return empty string
    if (!response) {
      console.warn('Empty response from Claude API');
      return '';
    }

    // If response already has a text property, use it directly
    if (response.text) {
      console.log('Found text property in response');
      return response.text;
    }

    // If response has a content array (Claude-3 format)
    if (response.content && Array.isArray(response.content)) {
      console.log('Found content array in response (Claude-3 format)');
      // Find the first text content
      const textContent = response.content.find((c: any) => c.type === 'text');
      if (textContent && textContent.text) {
        return textContent.text;
      }
    }

    // If response has a completion property (Claude-2 format)
    if (response.completion) {
      console.log('Found completion property in response (Claude-2 format)');
      return response.completion;
    }

    // If simple string was returned
    if (typeof response === 'string') {
      console.log('Response is a string');
      return response;
    }

    // For any other format, try to extract a string representation
    console.warn('Unknown response format from Claude API:', response);
    try {
      return JSON.stringify(response);
    } catch (e) {
      return 'Failed to parse Claude API response';
    }
  }
}
