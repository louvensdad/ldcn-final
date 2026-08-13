import { Component, inject } from '@angular/core';
import { EventStreamService } from '../../core/sse/event-stream.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { EmptyStateComponent } from '../../shared/ui/empty-state/empty-state';

@Component({
  selector: 'app-home',
  imports: [TranslatePipe, EmptyStateComponent],
  templateUrl: './home.html',
  styleUrl: './home.scss',
})
export class HomeComponent {
  protected readonly stream = inject(EventStreamService);
}
