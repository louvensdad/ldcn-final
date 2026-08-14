import { Component, input, output } from '@angular/core';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { ButtonComponent } from '../button/button';
import { AppError } from '../../../core/errors/error-mapper';

/**
 * doc 44 F10 (error UX). `resource().error()` is typed `unknown` by Angular, but every resource
 * loader in this app goes through HttpClient + errorInterceptor (core/errors/error.interceptor.ts),
 * which already maps every HTTP failure to an AppError with a category-specific translationKey
 * before it ever reaches a resource — so this is the one place that does the (defensive) cast,
 * instead of repeating it at each of the ~10 call sites that were previously hardcoding the
 * generic 'common.error' message regardless of whether the real cause was 401/409/429/5xx.
 */
@Component({
  selector: 'app-error-state',
  imports: [TranslatePipe, ButtonComponent],
  templateUrl: './error-state.html',
  styleUrl: './error-state.scss',
})
export class ErrorStateComponent {
  readonly error = input.required<unknown>();
  readonly retry = output<void>();

  protected translationKey(): string {
    const err = this.error();
    return err && typeof err === 'object' && 'translationKey' in err ? String((err as AppError).translationKey) : 'common.error';
  }
}
