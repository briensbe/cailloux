import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ToastService } from '../state/toast.service';

@Component({
  selector: 'app-toasts',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @for (t of toasts.toasts(); track t.id) {
      <div class="toast" role="status">
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
      gap: 14px;
      padding: 10px 12px 10px 18px;
      border-radius: 999px;
      background: var(--ink);
      color: var(--paper);
      font-size: 14px;
      box-shadow: 0 18px 30px -16px rgb(0 0 0 / 0.6);
      pointer-events: auto;
      animation: toast-in 0.35s cubic-bezier(0.2, 1.3, 0.4, 1) both;
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
