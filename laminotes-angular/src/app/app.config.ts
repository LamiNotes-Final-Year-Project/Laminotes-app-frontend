import { ApplicationConfig, SecurityContext } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideAnimations } from '@angular/platform-browser/animations';
import { MARKED_OPTIONS, MarkedOptions, provideMarkdown } from 'ngx-markdown';

import { routes } from './app.routes';
import { authInterceptor } from './interceptors/auth.interceptor';

// No need to import Prism components here since we're loading them via CDN in index.html

// @ts-ignore
export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),
    provideHttpClient(withInterceptors([authInterceptor])),
    provideAnimations(),
    provideMarkdown({
      markedOptions: {
        provide: MARKED_OPTIONS,
        useValue: {
          gfm: true,         // GitHub flavored markdown
          breaks: true,      // Add <br> on single line returns
          pedantic: false
        },
      },
      sanitize: SecurityContext.NONE  // Allow raw HTML for mermaid rendering
    }),
  ]
};
