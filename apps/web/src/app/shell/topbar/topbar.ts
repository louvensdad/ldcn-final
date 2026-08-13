import { Component, inject } from '@angular/core';
import { ThemeService } from '../../core/theme/theme.service';
import { TranslationService, SUPPORTED_LOCALES, Locale } from '../../core/i18n/translation.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { AuthService } from '../../core/auth/auth.service';
import { ButtonComponent } from '../../shared/ui/button/button';

@Component({
  selector: 'app-topbar',
  imports: [TranslatePipe, ButtonComponent],
  templateUrl: './topbar.html',
  styleUrl: './topbar.scss',
})
export class TopbarComponent {
  private readonly theme = inject(ThemeService);
  private readonly translation = inject(TranslationService);
  private readonly auth = inject(AuthService);

  protected readonly locales = SUPPORTED_LOCALES;
  protected readonly currentLocale = this.translation.locale;

  toggleTheme(): void {
    this.theme.toggle();
  }

  setLocale(locale: Locale): void {
    this.translation.setLocale(locale);
  }

  signOut(): void {
    this.auth.signOut();
  }
}
