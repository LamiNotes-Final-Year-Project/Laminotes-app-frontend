import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AuthTabsComponent } from './auth-tabs.component';

describe('AuthTabsComponent', () => {
  let component: AuthTabsComponent;
  let fixture: ComponentFixture<AuthTabsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AuthTabsComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AuthTabsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
