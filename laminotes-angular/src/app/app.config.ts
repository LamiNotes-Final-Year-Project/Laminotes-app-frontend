import { ApplicationConfig } from '@angular/core';
import { provideRouter } from '@angular/router';
import {provideHttpClient, withInterceptors} from '@angular/common/http';
import { provideAnimations } from '@angular/platform-browser/animations';
import { MARKED_OPTIONS, provideMarkdown } from 'ngx-markdown';

import { routes } from './app.routes';
import {authInterceptor} from './interceptors/auth.interceptor';

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
          gfm: true,      // GitHub flavored markdown
          breaks: true,   // Add <br> on single line returns
          pedantic: false,
          // smartLists: true,
          // smartypants: true,
        },
      },
    }),
  ]
};
