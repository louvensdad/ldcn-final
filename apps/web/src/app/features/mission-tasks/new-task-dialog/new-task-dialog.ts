import { Component, ElementRef, inject, input, output, signal, viewChild } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { TaskClient } from '../../../core/api/task.client';
import { AppError } from '../../../core/errors/error-mapper';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { ButtonComponent } from '../../../shared/ui/button/button';

@Component({
  selector: 'app-new-task-dialog',
  imports: [ReactiveFormsModule, TranslatePipe, ButtonComponent],
  templateUrl: './new-task-dialog.html',
  styleUrl: './new-task-dialog.scss',
})
export class NewTaskDialogComponent {
  readonly missionId = input.required<string>();

  private readonly formBuilder = inject(NonNullableFormBuilder);
  private readonly taskClient = inject(TaskClient);

  /** taskId when a task was created, undefined when cancelled — the caller navigates to the task detail on success. */
  readonly closed = output<string | undefined>();

  private readonly dialogRef = viewChild.required<ElementRef<HTMLElement>>('dialogRef');

  protected readonly submitting = signal(false);
  protected readonly error = signal<AppError | null>(null);
  protected readonly form = this.formBuilder.group({
    description: this.formBuilder.control('', [Validators.required]),
  });

  submit(): void {
    if (this.form.invalid || this.submitting()) return;
    this.submitting.set(true);
    this.error.set(null);
    const taskId = crypto.randomUUID();
    this.taskClient.classify(this.missionId(), taskId, this.form.getRawValue().description).subscribe({
      next: () => {
        this.submitting.set(false);
        this.closed.emit(taskId);
      },
      error: (error: AppError) => {
        this.submitting.set(false);
        this.error.set(error);
      },
    });
  }

  cancel(): void {
    this.closed.emit(undefined);
  }

  /** Manual focus trap: Tab/Shift+Tab never leave the dialog while it's open. */
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
