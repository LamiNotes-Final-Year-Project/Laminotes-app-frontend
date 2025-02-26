import { Routes } from '@angular/router';
import { NoteAppLayoutComponent } from './layouts/note-app-layout/note-app-layout.component';

export const routes: Routes = [
  {
    path: '',
    component: NoteAppLayoutComponent
  },
  {
    path: '**',
    redirectTo: ''
  }
];
