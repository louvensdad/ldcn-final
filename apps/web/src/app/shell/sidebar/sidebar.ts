import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { TranslatePipe } from '../../core/i18n/translate.pipe';

interface NavItem {
  path: string;
  labelKey: string;
}

@Component({
  selector: 'app-sidebar',
  imports: [RouterLink, RouterLinkActive, TranslatePipe],
  templateUrl: './sidebar.html',
  styleUrl: './sidebar.scss',
})
export class SidebarComponent {
  // F1+ will add projects/wizard/missions here as those features land.
  protected readonly items: NavItem[] = [{ path: '/', labelKey: 'shell.home' }];
}
