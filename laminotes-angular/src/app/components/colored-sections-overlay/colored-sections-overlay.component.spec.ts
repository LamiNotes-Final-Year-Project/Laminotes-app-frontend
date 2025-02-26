import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ColoredSectionsOverlayComponent } from './colored-sections-overlay.component';

describe('ColoredSectionsOverlayComponent', () => {
  let component: ColoredSectionsOverlayComponent;
  let fixture: ComponentFixture<ColoredSectionsOverlayComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ColoredSectionsOverlayComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ColoredSectionsOverlayComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
