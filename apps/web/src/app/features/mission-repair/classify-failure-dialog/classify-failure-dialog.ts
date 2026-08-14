import { Component, ElementRef, inject, input, output, signal, viewChild } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RepairClient } from '../../../core/api/repair.client';
import { AppError } from '../../../core/errors/error-mapper';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { ButtonComponent } from '../../../shared/ui/button/button';

/** doc 44 F7 follow-up (real repair approval). Same dialog shape as new-task-dialog.ts (backdrop, tab trap, autofocus). */
@Component({
  selector: 'app-classify-failure-dialog',
  imports: [ReactiveFormsModule, TranslatePipe, ButtonComponent],
  templateUrl: './classify-failure-dialog.html',
  styleUrl: './classify-failure-dialog.scss',
})
export class ClassifyFailureDialogComponent {
  readonly missionId = input.required<string>();

  private readonly formBuilder = inject(NonNullableFormBuilder);
  private readonly repairClient = inject(RepairClient);

  /** true when a failure was classified, false when cancelled — the caller reloads either way (closing on cancel needs no reload, but treating it uniformly keeps the caller simple). */
  readonly closed = output<boolean>();

  private readonly dialogRef = viewChild.required<ElementRef<HTMLElement>>('dialogRef');

  protected readonly submitting = signal(false);
  protected readonly error = signal<AppError | null>(null);
  protected readonly form = this.formBuilder.group({
    taskId: this.formBuilder.control('', [Validators.required]),
    summary: this.formBuilder.control('', [Validators.required]),
  });

  submit(): void {
    if (this.form.invalid || this.submitting()) return;
    this.submitting.set(true);
    this.error.set(null);
    const { taskId, summary } = this.form.getRawValue();
    const executionId = crypto.randomUUID();
    this.repairClient.classify(this.missionId(), taskId, { executionId, summary }).subscribe({
      next: () => {
        this.submitting.set(false);
        this.closed.emit(true);
      },
      error: (error: AppError) => {
        this.submitting.set(false);
        this.error.set(error);
      },
    });
  }

  cancel(): void {
    this.closed.emit(false);
  }

  /** Manual focus trap: Tab/Shift+Tab never leave the dialog while it's open — same technique as new-task-dialog.ts. */
  onKeydown(event: KeyboardEvent): void {
    if (event.key !== 'Tab') return;
    const focusable = this.dialogRef().nativeElement.querySelectorAll<HTMLElement>(
      'button:not([disabled]), textarea:not([disabled]), input:not([disabled]), [href], select:not([disabled]), [tabindex]:not([tabindex="-1"])'
    );
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }
}
