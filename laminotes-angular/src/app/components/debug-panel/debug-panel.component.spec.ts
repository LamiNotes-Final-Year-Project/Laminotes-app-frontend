import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DebugPanelComponent } from './debug-panel.component';

describe('DebugPanelComponent', () => {
  let component: DebugPanelComponent;
  let fixture: ComponentFixture<DebugPanelComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DebugPanelComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(DebugPanelComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
