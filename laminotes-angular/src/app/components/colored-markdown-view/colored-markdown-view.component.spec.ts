import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ColoredMarkdownViewComponent } from './colored-markdown-view.component';

describe('ColoredMarkdownViewComponent', () => {
  let component: ColoredMarkdownViewComponent;
  let fixture: ComponentFixture<ColoredMarkdownViewComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ColoredMarkdownViewComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ColoredMarkdownViewComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
