import { Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { GeneratorClient } from '../../core/api/generator.client';
import { MissionClient, MissionOverviewDto } from '../../core/api/mission.client';
import { AppError } from '../../core/errors/error-mapper';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { ButtonComponent } from '../../shared/ui/button/button';
import { MissionOverviewCardsComponent } from '../../shared/ui/mission-overview-cards/mission-overview-cards';

const DELIVERY_TARGETS = ['BACKEND', 'FRONTEND', 'MOBILE', 'DATA', 'AI', 'EXTERNAL_INTEGRATION'] as const;

/**
 * F2 - Mission Wizard, "review" flavor (see plan): the backend has no per-stage approval gate,
 * generate() is atomic (core/src/generator.ts). So this collects input in one step, calls
 * start(), then shows the result organized by the doc 44 sections (Intent/Requirements/
 * Topology/Solution) as a recap — it never pretends a gate exists that the backend doesn't have.
 */
@Component({
  selector: 'app-wizard',
  imports: [ReactiveFormsModule, TranslatePipe, ButtonComponent, MissionOverviewCardsComponent],
  templateUrl: './wizard.html',
  styleUrl: './wizard.scss',
})
export class WizardComponent {
  private readonly formBuilder = inject(NonNullableFormBuilder);
  private readonly generatorClient = inject(GeneratorClient);
  private readonly missionClient = inject(MissionClient);
  private readonly router = inject(Router);

  protected readonly deliveryTargets = DELIVERY_TARGETS;
  protected readonly step = signal<'form' | 'recap'>('form');
  protected readonly submitting = signal(false);
  protected readonly error = signal<AppError | null>(null);
  protected readonly advancedOpen = signal(false);
  protected readonly forbiddenTargets = signal<ReadonlySet<string>>(new Set());
  protected readonly overview = signal<MissionOverviewDto | null>(null);

  protected readonly form = this.formBuilder.group({
    rawUserIdea: this.formBuilder.control('', [Validators.required]),
    technologyPreferences: this.formBuilder.control(''),
    constraints: this.formBuilder.control(''),
  });

  toggleAdvanced(): void {
    this.advancedOpen.update((open) => !open);
  }

  toggleTarget(target: string): void {
    this.forbiddenTargets.update((current) => {
      const next = new Set(current);
      if (next.has(target)) next.delete(target);
      else next.add(target);
      return next;
    });
  }

  submit(): void {
    if (this.form.invalid || this.submitting()) return;
    this.submitting.set(true);
    this.error.set(null);
    const missionId = crypto.randomUUID();
    const raw = this.form.getRawValue();

    this.generatorClient
      .start(missionId, {
        rawUserIdea: raw.rawUserIdea,
        technologyPreferences: this.splitList(raw.technologyPreferences),
        constraints: this.splitList(raw.constraints),
        forbiddenDeliveryTargets: [...this.forbiddenTargets()],
      })
      .subscribe({
        next: () => this.loadRecap(missionId),
        error: (error: AppError) => {
          this.submitting.set(false);
          this.error.set(error);
        },
      });
  }

  goToWorkspace(): void {
    void this.router.navigateByUrl('/');
  }

  private loadRecap(missionId: string): void {
    this.missionClient.getOverview(missionId).subscribe({
      next: (overview) => {
        this.submitting.set(false);
        this.overview.set(overview);
        this.step.set('recap');
      },
      error: (error: AppError) => {
        this.submitting.set(false);
        this.error.set(error);
      },
    });
  }

  private splitList(value: string): string[] | undefined {
    const items = value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
    return items.length ? items : undefined;
  }
}
