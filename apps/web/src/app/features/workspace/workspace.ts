import { Component, inject, resource } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { Router, RouterLink } from '@angular/router';
import { MissionClient } from '../../core/api/mission.client';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { ButtonComponent } from '../../shared/ui/button/button';
import { EmptyStateComponent } from '../../shared/ui/empty-state/empty-state';
import { ErrorStateComponent } from '../../shared/ui/error-state/error-state';
import { SkeletonComponent } from '../../shared/ui/skeleton/skeleton';

@Component({
  selector: 'app-workspace',
  imports: [TranslatePipe, ButtonComponent, EmptyStateComponent, RouterLink, ErrorStateComponent, SkeletonComponent],
  templateUrl: './workspace.html',
  styleUrl: './workspace.scss',
})
export class WorkspaceComponent {
  private readonly missionClient = inject(MissionClient);
  private readonly router = inject(Router);

  protected readonly missionsResource = resource({
    loader: () => firstValueFrom(this.missionClient.list()),
  });

  createMission(): void {
    // Route change destroys/recreates this component, so missionsResource reloads naturally on return.
    void this.router.navigateByUrl('/wizard');
  }
}
