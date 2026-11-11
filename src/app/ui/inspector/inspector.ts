import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { footprint, weeksFor, withCharge, withPersons, withWeeks } from '../../domain/capacity';
import { LoadMode, StoneColor, STONE_COLORS, STONES, stoneKind } from '../../domain/model';
import { addDays, formatShort, isoWeek, parseIsoDate } from '../../domain/weeks';
import { PlanningStore } from '../../state/planning.store';
import { Icon } from '../icon';
import { Stepper } from '../stepper';

/** Panneau latéral : tout ce qu'on peut régler sur la brique sélectionnée. */
@Component({
  selector: 'app-inspector',
  imports: [Icon, Stepper, DecimalPipe],
  templateUrl: './inspector.html',
  styleUrl: './inspector.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Inspector {
  protected readonly store = inject(PlanningStore);
  protected readonly project = this.store.selected;
  protected readonly colors = STONE_COLORS;
  protected readonly stones = STONES;

  protected readonly team = computed(() => {
    const p = this.project();
    return p ? (this.store.team(p.teamId) ?? null) : null;
  });
  protected readonly kind = computed(() => stoneKind(this.project()?.charge ?? 0));
  protected readonly air = computed(() => {
    const p = this.project();
    return p ? footprint(p) - p.charge : 0;
  });

  /** En charge fixe, la durée est bornée par « toute l'équipe » et « une seule personne ». */
  protected readonly weeksRange = computed(() => {
    const p = this.project()!;
    const t = this.team()!;
    if (p.mode === 'free') return { min: 1, max: t.horizon };
    return { min: weeksFor(p.charge, t.size), max: Math.min(52, weeksFor(p.charge, 1)) };
  });

  protected readonly period = computed(() => {
    const p = this.project();
    if (!p || p.col === null) return null;
    const start = addDays(parseIsoDate(this.store.startDate()), p.col * 7);
    // Le vendredi de la dernière semaine.
    const end = addDays(start, p.weeks * 7 - 3);
    return {
      from: { week: isoWeek(start), date: formatShort(start) },
      to: { week: isoWeek(end), date: formatShort(end) },
    };
  });

  protected rename(event: Event): void {
    const name = (event.target as HTMLInputElement).value.trim();
    if (name) this.store.updateProject(this.project()!.id, { name });
  }

  protected setCharge(event: Event): void {
    const input = event.target as HTMLInputElement;
    const value = parseFloat(input.value.replace(',', '.'));
    const p = this.project()!;
    if (!(value > 0)) {
      input.value = String(p.charge);
      return;
    }
    this.store.reshapeProject(p.id, withCharge(p, value));
  }

  protected setPersons(persons: number): void {
    const p = this.project()!;
    this.store.reshapeProject(p.id, withPersons(p, persons, this.team()!.size));
  }

  protected setWeeks(weeks: number): void {
    const p = this.project()!;
    this.store.reshapeProject(p.id, withWeeks(p, weeks, this.team()!.size));
  }

  protected setMode(mode: LoadMode): void {
    this.store.updateProject(this.project()!.id, { mode });
  }

  protected setColor(color: StoneColor): void {
    this.store.updateProject(this.project()!.id, { color });
  }

  protected moveTo(event: Event): void {
    this.store.moveToTeam(this.project()!.id, (event.target as HTMLSelectElement).value);
  }
}
