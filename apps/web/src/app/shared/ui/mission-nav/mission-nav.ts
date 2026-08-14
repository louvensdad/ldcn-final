import { Component, input } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';

/** Sub-navigation shared by every missions/:missionId/* page (doc 40 §7 router). More tabs (Pipeline, Tasks, Executions, ...) land here as their slices arrive. */
@Component({
  selector: 'app-mission-nav',
  imports: [RouterLink, RouterLinkActive, TranslatePipe],
  templateUrl: './mission-nav.html',
  styleUrl: './mission-nav.scss',
})
export class MissionNavComponent {
  readonly missionId = input.required<string>();
}
