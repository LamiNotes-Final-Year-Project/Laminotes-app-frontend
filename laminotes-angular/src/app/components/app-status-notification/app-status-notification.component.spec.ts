import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AppStatusNotificationComponent } from './app-status-notification.component';

describe('AppStatusNotificationComponent', () => {
  let component: AppStatusNotificationComponent;
  let fixture: ComponentFixture<AppStatusNotificationComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AppStatusNotificationComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AppStatusNotificationComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
