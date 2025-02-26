import { ComponentFixture, TestBed } from '@angular/core/testing';

import { NoteAppLayoutComponent } from './note-app-layout.component';

describe('NoteAppLayoutComponent', () => {
  let component: NoteAppLayoutComponent;
  let fixture: ComponentFixture<NoteAppLayoutComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NoteAppLayoutComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(NoteAppLayoutComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
