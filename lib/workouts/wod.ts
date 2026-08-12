import { newId } from '@/services/mock/data';

export type WodMovement = {
  id: string;
  name: string;
  sets: number | null;
  reps: string | null;
  rounds: number | null;
  weight_kg: number | null;
  weight_note: string | null;
  rest_seconds: number | null;
  notes: string | null;
};

export type WodMovementDraft = Omit<WodMovement, 'id'> & { id?: string };

export function createEmptyMovement(partial?: Partial<WodMovementDraft>): WodMovement {
  return {
    id: partial?.id ?? newId('wod-move'),
    name: partial?.name ?? '',
    sets: partial?.sets ?? null,
    reps: partial?.reps ?? null,
    rounds: partial?.rounds ?? null,
    weight_kg: partial?.weight_kg ?? null,
    weight_note: partial?.weight_note ?? null,
    rest_seconds: partial?.rest_seconds ?? null,
    notes: partial?.notes ?? null,
  };
}

export function defaultWodMovements(): WodMovement[] {
  return [
    createEmptyMovement({
      name: 'Barbell thrusters',
      sets: 4,
      reps: '8',
      weight_kg: 40,
      rest_seconds: 90,
    }),
    createEmptyMovement({
      name: 'Pull-ups / ring rows',
      sets: 3,
      reps: '10-12',
      rest_seconds: 60,
      notes: 'Scale to ability',
    }),
    createEmptyMovement({
      name: 'Kettlebell swings',
      rounds: 3,
      reps: '15',
      weight_kg: 24,
      rest_seconds: 45,
    }),
    createEmptyMovement({
      name: 'Row intervals',
      rounds: 4,
      reps: '250m',
      rest_seconds: 60,
      weight_note: 'Hard pace',
    }),
  ];
}

export function legacyMovesToMovements(moves: string[]): WodMovement[] {
  return moves.map((name) => createEmptyMovement({ name: name.trim() })).filter((m) => m.name);
}

export function normalizeMovements(
  movements?: WodMovement[] | null,
  legacyMoves?: string[] | null,
): WodMovement[] {
  if (movements?.length) {
    return movements.map((m) => createEmptyMovement(m));
  }
  if (legacyMoves?.length) return legacyMovesToMovements(legacyMoves);
  return [];
}

export function movementSummary(move: WodMovement): string {
  const parts: string[] = [];
  if (move.rounds != null && move.rounds > 0) {
    parts.push(`${move.rounds} rounds`);
  }
  if (move.sets != null && move.sets > 0) {
    parts.push(`${move.sets} sets`);
  }
  if (move.reps?.trim()) {
    parts.push(`× ${move.reps.trim()}`);
  }
  if (move.weight_kg != null && move.weight_kg > 0) {
    parts.push(`@ ${move.weight_kg}kg`);
  } else if (move.weight_note?.trim()) {
    parts.push(`@ ${move.weight_note.trim()}`);
  }
  return parts.join(' · ') || 'Coach prescription';
}

export function movementLine(move: WodMovement): string {
  const summary = movementSummary(move);
  return summary === 'Coach prescription' ? move.name : `${move.name} — ${summary}`;
}

export function movementsToLegacyMoves(movements: WodMovement[]): string[] {
  return movements.filter((m) => m.name.trim()).map(movementLine);
}

export function parseStoredMovements(raw: unknown, legacyMoves: string[] = []): WodMovement[] {
  if (Array.isArray(raw) && raw.length > 0) {
    return raw
      .map((item) => {
        if (!item || typeof item !== 'object') return null;
        const row = item as Record<string, unknown>;
        const name = typeof row.name === 'string' ? row.name.trim() : '';
        if (!name) return null;
        return createEmptyMovement({
          id: typeof row.id === 'string' ? row.id : undefined,
          name,
          sets: typeof row.sets === 'number' ? row.sets : null,
          reps: typeof row.reps === 'string' ? row.reps : null,
          rounds: typeof row.rounds === 'number' ? row.rounds : null,
          weight_kg: typeof row.weight_kg === 'number' ? row.weight_kg : null,
          weight_note: typeof row.weight_note === 'string' ? row.weight_note : null,
          rest_seconds: typeof row.rest_seconds === 'number' ? row.rest_seconds : null,
          notes: typeof row.notes === 'string' ? row.notes : null,
        });
      })
      .filter((m): m is WodMovement => m != null);
  }
  return legacyMovesToMovements(legacyMoves);
}

export function serializeMovements(movements: WodMovement[]) {
  return movements
    .filter((m) => m.name.trim())
    .map(({ id, name, sets, reps, rounds, weight_kg, weight_note, rest_seconds, notes }) => ({
      id,
      name: name.trim(),
      sets,
      reps,
      rounds,
      weight_kg,
      weight_note,
      rest_seconds,
      notes,
    }));
}
