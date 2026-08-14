import { Component, input } from '@angular/core';

/**
 * doc 44 F0/F10 ("route skeletons", "premium loading states"). Purely visual — `aria-hidden`
 * because the actual "Loading..." announcement for screen readers lives in the surrounding
 * `aria-live` region as visually-hidden text, not here. Animation respects
 * prefers-reduced-motion automatically via the global rule in styles.scss.
 */
@Component({
  selector: 'app-skeleton',
  templateUrl: './skeleton.html',
  styleUrl: './skeleton.scss',
})
export class SkeletonComponent {
  readonly width = input('100%');
  readonly height = input('1rem');
}
