import { ComponentFixture, TestBed } from '@angular/core/testing';

import { UserInvitationsComponent } from './user-invitations.component';

describe('UserInvitationsComponent', () => {
  let component: UserInvitationsComponent;
  let fixture: ComponentFixture<UserInvitationsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [UserInvitationsComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(UserInvitationsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
