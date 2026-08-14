import { Component, input } from '@angular/core';
import { MissionOverviewDto } from '../../../core/api/mission.client';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';

/** Intent/Requirements/Topology/Solution cards (doc 44 F2/F3). Shared by the Wizard recap and the mission detail Command Center. */
@Component({
  selector: 'app-mission-overview-cards',
  imports: [TranslatePipe],
  templateUrl: './mission-overview-cards.html',
  styleUrl: './mission-overview-cards.scss',
})
export class MissionOverviewCardsComponent {
  readonly overview = input.required<MissionOverviewDto>();
}
