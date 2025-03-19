import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TeamInvitationsComponent } from './team-invitations.component';

describe('TeamInvitationsComponent', () => {
  let component: TeamInvitationsComponent;
  let fixture: ComponentFixture<TeamInvitationsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TeamInvitationsComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(TeamInvitationsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
