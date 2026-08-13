import { Component, effect, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { EventStreamService } from '../../core/sse/event-stream.service';
import { AuthService } from '../../core/auth/auth.service';
import { SidebarComponent } from '../sidebar/sidebar';
import { TopbarComponent } from '../topbar/topbar';

@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, SidebarComponent, TopbarComponent],
  templateUrl: './app-shell.html',
  styleUrl: './app-shell.scss',
})
export class AppShellComponent {
  private readonly stream = inject(EventStreamService);
  private readonly auth = inject(AuthService);

  constructor() {
    effect(() => {
      if (this.auth.isAuthenticated()) this.stream.connect();
      else this.stream.disconnect();
    });
  }
}
