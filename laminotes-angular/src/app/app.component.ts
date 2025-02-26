import {Component, ViewEncapsulation} from '@angular/core';
import { RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  standalone: true,
  template: '<router-outlet></router-outlet>',
  styleUrls: ['./layouts/note-app-layout/note-app-layout.component.css'],
  encapsulation: ViewEncapsulation.None
})
export class AppComponent {
  title = 'laminotes-angular';
}
