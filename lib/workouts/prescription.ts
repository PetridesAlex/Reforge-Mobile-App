import type { ProgramExercise } from '@/types';

export type ExercisePrescription = {
  sets: number;
  reps: string;
  restSeconds: number;
  rounds: number;
  workSeconds: number;
  tempo: string;
  notes: string;
  targetWeightKg: number | null;
  progressionIncrementKg: number | null;
  repRangeMin: number | null;
  repRangeMax: number | null;
};

export type PrescriptionPreset = {
  id: string;
  label: string;
  prescription: Partial<ExercisePrescription>;
};

const META_PREFIX = '@rx:';
const META_SUFFIX = '@';

function parseMeta(raw: string | null | undefined): Pick<ExercisePrescription, 'rounds' | 'workSeconds' | 'tempo' | 'notes'> {
  if (!raw?.trim()) {
    return { rounds: 1, workSeconds: 0, tempo: '', notes: '' };
  }

  const match = raw.match(/^@rx:([^@]+)@(?:\n([\s\S]*))?$/);
  if (!match) {
    return { rounds: 1, workSeconds: 0, tempo: '', notes: raw.trim() };
  }

  const meta: Pick<ExercisePrescription, 'rounds' | 'workSeconds' | 'tempo'> = {
    rounds: 1,
    workSeconds: 0,
    tempo: '',
  };

  for (const part of match[1].split('|')) {
    const [key, value] = part.split('=');
    if (key === 'rounds') meta.rounds = Math.max(1, Number(value) || 1);
    if (key === 'work') meta.workSeconds = Math.max(0, Number(value) || 0);
    if (key === 'tempo') meta.tempo = value ?? '';
  }

  return { ...meta, notes: (match[2] ?? '').trim() };
}

export function parsePrescription(
  pe: Pick<
    ProgramExercise,
    | 'sets'
    | 'reps'
    | 'rest_seconds'
    | 'coach_notes'
    | 'target_weight_kg'
    | 'progression_increment_kg'
    | 'rep_range_min'
    | 'rep_range_max'
  >,
): ExercisePrescription {
  const meta = parseMeta(pe.coach_notes);
  return {
    sets: Math.max(1, pe.sets),
    reps: pe.reps?.trim() || '8',
    restSeconds: Math.max(0, pe.rest_seconds ?? 0),
    rounds: meta.rounds,
    workSeconds: meta.workSeconds,
    tempo: meta.tempo,
    notes: meta.notes,
    targetWeightKg: pe.target_weight_kg ?? null,
    progressionIncrementKg: pe.progression_increment_kg ?? null,
    repRangeMin: pe.rep_range_min ?? null,
    repRangeMax: pe.rep_range_max ?? null,
  };
}

export function encodeCoachNotes(p: Pick<ExercisePrescription, 'rounds' | 'workSeconds' | 'tempo' | 'notes'>): string | null {
  const parts: string[] = [];
  if (p.rounds > 1) parts.push(`rounds=${p.rounds}`);
  if (p.workSeconds > 0) parts.push(`work=${p.workSeconds}`);
  if (p.tempo.trim()) parts.push(`tempo=${p.tempo.trim()}`);

  const meta = parts.length ? `${META_PREFIX}${parts.join('|')}${META_SUFFIX}` : '';
  const notes = p.notes.trim();
  if (!meta && !notes) return null;
  return notes ? `${meta}${meta ? '\n' : ''}${notes}` : meta;
}

export function formatPrescription(
  p: Pick<ExercisePrescription, 'sets' | 'reps' | 'restSeconds' | 'rounds' | 'workSeconds' | 'tempo'>,
): string {
  const chunks: string[] = [];

  if (p.rounds > 1) {
    chunks.push(`${p.rounds} rounds`);
    chunks.push(`${p.sets}×${p.reps}`);
  } else {
    chunks.push(`${p.sets}×${p.reps}`);
  }

  if (p.workSeconds > 0) chunks.push(`${p.workSeconds}s work`);
  if (p.restSeconds > 0) chunks.push(`rest ${p.restSeconds}s`);
  if (p.tempo.trim()) chunks.push(`tempo ${p.tempo.trim()}`);

  return chunks.join(' · ');
}

export function displayCoachNotes(raw: string | null | undefined): string | null {
  const { notes } = parseMeta(raw);
  return notes || null;
}

export const PRESCRIPTION_PRESETS: PrescriptionPreset[] = [
  { id: 'strength', label: '5×5', prescription: { sets: 5, reps: '5', restSeconds: 180, rounds: 1 } },
  { id: 'hypertrophy', label: '3×10', prescription: { sets: 3, reps: '10', restSeconds: 90, rounds: 1 } },
  { id: 'classic', label: '4×8', prescription: { sets: 4, reps: '8', restSeconds: 90, rounds: 1 } },
  { id: 'volume', label: '3×12', prescription: { sets: 3, reps: '12', restSeconds: 60, rounds: 1 } },
  { id: 'circuit', label: '3 rounds', prescription: { sets: 1, reps: '12', restSeconds: 30, rounds: 3 } },
  { id: 'emom', label: 'EMOM', prescription: { sets: 1, reps: '10', restSeconds: 0, workSeconds: 60, rounds: 10 } },
  { id: 'amrap', label: 'AMRAP', prescription: { sets: 1, reps: 'AMRAP', restSeconds: 0, workSeconds: 300, rounds: 1 } },
  { id: 'timed', label: '45s work', prescription: { sets: 3, reps: 'Max', restSeconds: 15, workSeconds: 45, rounds: 1 } },
];

export const REP_PRESETS = ['6', '8', '10', '12', '15', '8-10', 'AMRAP', 'Max'];
export const REST_PRESETS = [0, 30, 60, 90, 120, 180];

export function defaultPrescription(): ExercisePrescription {
  return {
    sets: 3,
    reps: '8-10',
    restSeconds: 90,
    rounds: 1,
    workSeconds: 0,
    tempo: '',
    notes: '',
    targetWeightKg: null,
    progressionIncrementKg: null,
    repRangeMin: null,
    repRangeMax: null,
  };
}

export function toProgramExercisePatch(p: ExercisePrescription) {
  return {
    sets: Math.max(1, p.sets),
    reps: p.reps.trim() || '8',
    restSeconds: Math.max(0, p.restSeconds),
    coachNotes: encodeCoachNotes(p),
    targetWeightKg: p.targetWeightKg,
    progressionIncrementKg: p.progressionIncrementKg,
    repRangeMin: p.repRangeMin,
    repRangeMax: p.repRangeMax,
  };
}
