import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { footprint, weeksFor, withCharge, withPersons, withWeeks } from '../../domain/capacity';
import { LoadMode, MAX_TEAM_SIZE, StoneColor, STONE_COLORS, STONES, stoneKind } from '../../domain/model';
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
  /** Borne des personnes : l'effectif de l'équipe, ou l'effectif maximal pour un projet du bac commun. */
  protected readonly maxPersons = computed(() => this.team()?.size ?? MAX_TEAM_SIZE);
  protected readonly kind = computed(() => stoneKind(this.project()?.charge ?? 0));
  protected readonly air = computed(() => {
    const p = this.project();
    return p ? footprint(p) - p.charge : 0;
  });

  /** En charge fixe, la durée est bornée par « toute l'équipe » et « une seule personne ». */
  protected readonly weeksRange = computed(() => {
    const p = this.project()!;
    if (p.mode === 'free') return { min: 1, max: this.store.window().weeks };
    return { min: weeksFor(p.charge, this.maxPersons()), max: weeksFor(p.charge, 1) };
  });

  protected readonly period = computed(() => {
    const p = this.project();
    if (!p || p.start === null) return null;
    const start = parseIsoDate(p.start);
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
    this.store.reshapeProject(p.id, withPersons(p, persons, this.maxPersons()));
  }

  protected setWeeks(weeks: number): void {
    const p = this.project()!;
    this.store.reshapeProject(p.id, withWeeks(p, weeks, this.maxPersons()));
  }

  protected setMode(mode: LoadMode): void {
    this.store.updateProject(this.project()!.id, { mode });
  }

  protected setColor(color: StoneColor): void {
    this.store.updateProject(this.project()!.id, { color });
  }

  protected moveTo(event: Event): void {
    // L'option vide est « Aucune (bac commun) ».
    this.store.moveToTeam(this.project()!.id, (event.target as HTMLSelectElement).value || null);
  }
}
