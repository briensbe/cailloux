import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TOAST_DURATION_MS, ToastService } from './toast.service';

describe('ToastService', () => {
  let service: ToastService;

  beforeEach(() => {
    vi.useFakeTimers();
    TestBed.configureTestingModule({});
    service = TestBed.inject(ToastService);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('décompte les secondes puis ferme le toast avec action', () => {
    service.show('Projet retiré.', { label: 'Annuler', run: () => {} });

    expect(service.toasts()).toHaveLength(1);
    expect(service.toasts()[0].remainingSec).toBe(5);
    expect(service.toasts()[0].durationMs).toBe(TOAST_DURATION_MS);

    vi.advanceTimersByTime(1000);
    expect(service.toasts()[0].remainingSec).toBe(4);

    vi.advanceTimersByTime(2000);
    expect(service.toasts()[0].remainingSec).toBe(2);

    vi.advanceTimersByTime(2000);
    expect(service.toasts()).toHaveLength(0);
  });

  it('ferme immédiatement lors de dismiss()', () => {
    service.show('Projet retiré.', { label: 'Annuler', run: () => {} });
    const id = service.toasts()[0].id;

    service.dismiss(id);
    expect(service.toasts()).toHaveLength(0);
  });

  it('garde au maximum 3 toasts visibles', () => {
    service.show('Un');
    service.show('Deux');
    service.show('Trois');
    service.show('Quatre');

    expect(service.toasts().map((t) => t.message)).toEqual(['Deux', 'Trois', 'Quatre']);
  });
});
