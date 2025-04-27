import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { AppComponent } from './app/app.component';

// We're now initializing Mermaid in index.html directly for a more reliable approach
// that doesn't have issues with module imports vs global objects

bootstrapApplication(AppComponent, appConfig)
  .catch((err) => console.error(err));
