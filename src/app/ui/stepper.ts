import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { Icon, IconName } from './icon';

/** Compteur « − 5 personnes + », utilisé pour la taille des équipes, l'horizon et les briques. */
@Component({
  selector: 'app-stepper',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (icon(); as i) {
      <app-icon class="lead" [name]="i" />
    }
    <button type="button" (click)="set(value() - 1)" [disabled]="value() <= min()" [attr.aria-label]="'Moins de ' + unit()">
      <app-icon name="minus" />
    </button>
    <span class="value">
      <strong>{{ value() }}</strong>
      <small>{{ unit() }}</small>
    </span>
    <button type="button" (click)="set(value() + 1)" [disabled]="value() >= max()" [attr.aria-label]="'Plus de ' + unit()">
      <app-icon name="plus" />
    </button>
  `,
  styles: `
    :host {
      display: inline-flex;
      align-items: center;
      gap: 2px;
      padding: 3px;
      border-radius: 999px;
      background: var(--chip);
      box-shadow: inset 0 0 0 1px var(--line);
      font-size: 13px;
    }
    .lead {
      margin: 0 2px 0 8px;
      color: var(--ink-soft);
    }
    button {
      display: grid;
      place-items: center;
      width: 26px;
      height: 26px;
      border: 0;
      border-radius: 50%;
      background: transparent;
      color: var(--ink);
      cursor: pointer;
      font-size: 13px;
      transition: background 0.15s;
      &:hover:not(:disabled) {
        background: var(--chip-hover);
      }
      &:disabled {
        opacity: 0.3;
        cursor: default;
      }
    }
    .value {
      min-width: 74px;
      text-align: center;
      white-space: nowrap;
      strong {
        font-family: var(--font-mono);
        font-weight: 600;
      }
      small {
        margin-left: 4px;
        color: var(--ink-soft);
        font-size: 12px;
      }
    }
  `,
})
export class Stepper {
  readonly value = input.required<number>();
  readonly min = input(1);
  readonly max = input(99);
  readonly unit = input('');
  readonly icon = input<IconName | null>(null);
  readonly changed = output<number>();

  protected set(v: number): void {
    const clamped = Math.min(this.max(), Math.max(this.min(), v));
    if (clamped !== this.value()) this.changed.emit(clamped);
  }
}
