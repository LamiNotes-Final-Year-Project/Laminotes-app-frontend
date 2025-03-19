import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TeamRoleComponent } from './team-role.component';

describe('TeamRoleComponent', () => {
  let component: TeamRoleComponent;
  let fixture: ComponentFixture<TeamRoleComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TeamRoleComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(TeamRoleComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
