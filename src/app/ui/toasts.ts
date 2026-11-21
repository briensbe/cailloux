import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ToastService } from '../state/toast.service';

@Component({
  selector: 'app-toasts',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @for (t of toasts.toasts(); track t.id) {
      <div class="toast" role="status" [style.--toast-duration.ms]="t.durationMs">
        @if (t.action) {
          <span class="timer" aria-hidden="true">
            <svg viewBox="0 0 24 24">
              <circle class="track" cx="12" cy="12" r="9.5" />
              <circle class="progress" cx="12" cy="12" r="9.5" />
            </svg>
            <span class="seconds">{{ t.remainingSec }}</span>
          </span>
        }
        <span>{{ t.message }}</span>
        @if (t.action; as a) {
          <button type="button" (click)="a.run(); toasts.dismiss(t.id)">{{ a.label }}</button>
        }
      </div>
    }
  `,
  styles: `
    :host {
      position: fixed;
      z-index: 1100;
      left: 50%;
      bottom: calc(var(--dock-h, 0px) + 24px);
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
      transform: translateX(-50%);
      pointer-events: none;
    }
    .toast {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 10px 12px 10px 16px;
      border-radius: 999px;
      background: var(--ink);
      color: var(--paper);
      font-size: 14px;
      box-shadow: 0 18px 30px -16px rgb(0 0 0 / 0.6);
      pointer-events: auto;
      animation: toast-in 0.35s cubic-bezier(0.2, 1.3, 0.4, 1) both;
    }
    .timer {
      position: relative;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 24px;
      height: 24px;
      flex: none;
      svg {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        transform: rotate(-90deg);
      }
      circle {
        fill: none;
        stroke-width: 2.2;
      }
      .track {
        stroke: color-mix(in oklab, var(--paper) 20%, transparent);
      }
      .progress {
        stroke: var(--paper);
        stroke-linecap: round;
        stroke-dasharray: 59.69;
        stroke-dashoffset: 0;
        animation: toast-countdown var(--toast-duration, 5000ms) linear forwards;
      }
      .seconds {
        font-family: var(--font-mono);
        font-size: 11px;
        font-weight: 700;
        line-height: 1;
      }
    }
    @keyframes toast-countdown {
      from {
        stroke-dashoffset: 0;
      }
      to {
        stroke-dashoffset: 59.69;
      }
    }
    button {
      padding: 5px 12px;
      border: 0;
      border-radius: 999px;
      background: color-mix(in oklab, var(--paper) 18%, transparent);
      color: var(--paper);
      font: inherit;
      font-weight: 600;
      cursor: pointer;
      &:hover {
        background: color-mix(in oklab, var(--paper) 28%, transparent);
      }
    }
    @keyframes toast-in {
      from {
        opacity: 0;
        transform: translateY(12px) scale(0.95);
      }
    }
  `,
})
export class Toasts {
  protected readonly toasts = inject(ToastService);
}
