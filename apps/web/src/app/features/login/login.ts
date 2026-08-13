import { Component, inject } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { ButtonComponent } from '../../shared/ui/button/button';

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule, TranslatePipe, ButtonComponent],
  templateUrl: './login.html',
  styleUrl: './login.scss',
})
export class LoginComponent {
  private readonly formBuilder = inject(NonNullableFormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly form = this.formBuilder.group({
    apiKey: this.formBuilder.control('', [Validators.required]),
  });

  submit(): void {
    if (this.form.invalid) return;
    this.auth.signIn(this.form.getRawValue().apiKey);
    void this.router.navigateByUrl('/');
  }
}
