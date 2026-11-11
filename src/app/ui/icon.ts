import { ChangeDetectionStrategy, Component, input } from '@angular/core';

export type IconName =
  | 'plus'
  | 'minus'
  | 'x'
  | 'undo'
  | 'redo'
  | 'trash'
  | 'lock'
  | 'move'
  | 'users'
  | 'clock'
  | 'drop'
  | 'shake'
  | 'out'
  | 'in';

/** Jeu d'icônes au trait, dessinées à la main en SVG (pas de dépendance externe). */
@Component({
  selector: 'app-icon',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { 'aria-hidden': 'true' },
  template: `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      @switch (name()) {
        @case ('plus') { <path d="M12 5v14M5 12h14" /> }
        @case ('minus') { <path d="M5 12h14" /> }
        @case ('x') { <path d="M18 6 6 18M6 6l12 12" /> }
        @case ('undo') { <path d="M9 14 4 9l5-5" /><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" /> }
        @case ('redo') { <path d="m15 14 5-5-5-5" /><path d="M20 9H9.5a5.5 5.5 0 0 0 0 11H13" /> }
        @case ('trash') {
          <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
        }
        @case ('lock') { <rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /> }
        @case ('move') { <path d="m6 9-3 3 3 3M18 9l3 3-3 3M3 12h18M9 6l3-3 3 3M9 18l3 3 3-3M12 3v18" /> }
        @case ('users') {
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
          <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
        }
        @case ('clock') { <circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /> }
        @case ('drop') {
          <path d="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5S12.5 5.5 12 3c-.5 2.5-2 4.9-4 6.5S5 13 5 15a7 7 0 0 0 7 7z" />
        }
        @case ('shake') { <path d="m11 17-5-5 5-5M18 17l-5-5 5-5" /> }
        @case ('out') { <path d="M12 3v12M7 10l5 5 5-5M5 21h14" /> }
        @case ('in') { <path d="M12 21V9M7 14l5-5 5 5M5 3h14" /> }
      }
    </svg>
  `,
  styles: `
    :host {
      display: inline-flex;
      width: 1em;
      height: 1em;
      flex: none;
    }
    svg {
      width: 100%;
      height: 100%;
    }
  `,
})
export class Icon {
  readonly name = input.required<IconName>();
}
