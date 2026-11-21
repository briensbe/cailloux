import { Injectable, signal } from '@angular/core';

export interface Toast {
  id: number;
  message: string;
  action?: { label: string; run: () => void };
  durationMs: number;
  remainingSec: number;
}

export const TOAST_DURATION_MS = 5000;

interface ToastTimers {
  timeout: ReturnType<typeof setTimeout>;
  interval?: ReturnType<typeof setInterval>;
}

/** Petits messages éphémères en bas de l'écran, avec une action optionnelle (ex. « Annuler »). */
@Injectable({ providedIn: 'root' })
export class ToastService {
  readonly toasts = signal<Toast[]>([]);
  private seq = 0;
  private readonly timers = new Map<number, ToastTimers>();

  show(message: string, action?: Toast['action'], durationMs = TOAST_DURATION_MS): void {
    const id = ++this.seq;
    const toast: Toast = {
      id,
      message,
      action,
      durationMs,
      remainingSec: Math.ceil(durationMs / 1000),
    };

    const current = this.toasts();
    const evicted = current.length >= 3 ? current.slice(0, current.length - 2) : [];
    for (const old of evicted) this.clearTimers(old.id);

    this.toasts.set([...current.slice(-2), toast]);

    const timeout = setTimeout(() => this.dismiss(id), durationMs);
    const interval = action
      ? setInterval(() => {
          this.toasts.update((list) =>
            list.map((t) => (t.id === id ? { ...t, remainingSec: Math.max(1, t.remainingSec - 1) } : t)),
          );
        }, 1000)
      : undefined;

    this.timers.set(id, { timeout, interval });
  }

  dismiss(id: number): void {
    this.clearTimers(id);
    this.toasts.update((list) => list.filter((t) => t.id !== id));
  }

  private clearTimers(id: number): void {
    const entry = this.timers.get(id);
    if (!entry) return;
    clearTimeout(entry.timeout);
    if (entry.interval !== undefined) clearInterval(entry.interval);
    this.timers.delete(id);
  }
}
