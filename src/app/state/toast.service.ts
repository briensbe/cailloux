import { Injectable, signal } from '@angular/core';

export interface Toast {
  id: number;
  message: string;
  action?: { label: string; run: () => void };
}

const TOAST_DURATION_MS = 4500;

/** Petits messages éphémères en bas de l'écran, avec une action optionnelle (ex. « Annuler »). */
@Injectable({ providedIn: 'root' })
export class ToastService {
  readonly toasts = signal<Toast[]>([]);
  private seq = 0;

  show(message: string, action?: Toast['action']): void {
    const toast = { id: ++this.seq, message, action };
    this.toasts.update((list) => [...list.slice(-2), toast]);
    setTimeout(() => this.dismiss(toast.id), TOAST_DURATION_MS);
  }

  dismiss(id: number): void {
    this.toasts.update((list) => list.filter((t) => t.id !== id));
  }
}
