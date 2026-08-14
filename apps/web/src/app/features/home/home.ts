import { Component, inject } from '@angular/core';
import { EventStreamService } from '../../core/sse/event-stream.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { WorkspaceComponent } from '../workspace/workspace';

@Component({
  selector: 'app-home',
  imports: [TranslatePipe, WorkspaceComponent],
  templateUrl: './home.html',
  styleUrl: './home.scss',
})
export class HomeComponent {
  protected readonly stream = inject(EventStreamService);
}
