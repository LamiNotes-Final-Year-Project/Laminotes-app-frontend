import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MetadataManagerComponent } from './metadata-manager.component';

describe('MetadataManagerComponent', () => {
  let component: MetadataManagerComponent;
  let fixture: ComponentFixture<MetadataManagerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MetadataManagerComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(MetadataManagerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
