import type { NewsAudience } from '@/lib/news/audience';
import { defaultWodMovements, movementsToLegacyMoves } from '@/lib/workouts/wod';
import type { WodMovement } from '@/lib/workouts/wod';
import type {
  BodyMeasurement,
  Booking,
  ChatMessage,
  ChatThread,
  ClassEnrollment,
  ClientProgram,
  CoachAvailability,
  CoachClient,
  CoachNote,
  Exercise,
  GymClass,
  MemberAbsence,
  Program,
  ProgramDay,
  ProgramExercise,
  Profile,
  WorkoutSession,
  WorkoutSet,
} from '@/types';

export type StudioSettings = {
  name: string;
  location: string;
  membershipLabel: string;
  allowMemberBooking: boolean;
  groupChatEnabled: boolean;
  /** Working / open days — 0=Sun … 6=Sat */
  workingDays: number[];
  openTime: string;
  closeTime: string;
};

export type StudioNews = {
  id: string;
  title: string;
  body: string;
  created_at: string;
  author_id: string;
  published: boolean;
  audience: NewsAudience;
};

import type { AppNotification } from '@/types';

export type { AppNotification };

export type WorkoutOfTheDay = {
  id: string;
  date: string;
  title: string;
  focus: string;
  description: string;
  duration_min: number;
  level: string;
  location: string;
  start_time: string;
  moves: string[];
  movements: WodMovement[];
  created_by: string;
  created_at: string;
  active: boolean;
};

export type WodRsvpStatus = 'joined' | 'skipped';

export type WodRsvp = {
  id: string;
  wod_id: string;
  member_id: string;
  status: WodRsvpStatus;
  updated_at: string;
};

export type MembershipStatus = 'paid' | 'unpaid' | 'overdue' | 'trial' | 'paused';

export type MembershipPlan = 'monthly' | 'quarterly' | 'annual' | 'drop-in';

export type MemberMembership = {
  id: string;
  member_id: string;
  plan: MembershipPlan;
  plan_label: string;
  status: MembershipStatus;
  amount_eur: number;
  period_start: string;
  period_end: string;
  last_paid_at: string | null;
  notes: string | null;
  updated_at: string;
};

export type MembershipPayment = {
  id: string;
  member_id: string;
  membership_id: string;
  amount_eur: number;
  kind: 'payment' | 'invoice' | 'refund';
  status: 'paid' | 'pending' | 'failed';
  period_label: string;
  notes: string | null;
  created_at: string;
};

export const IDS = {
  member: '11111111-1111-1111-1111-111111111111', // Alex Petrides (demo login)
  coach: '22222222-2222-2222-2222-222222222222', // Andreas Petrides (trainer)
  admin: '33333333-3333-3333-3333-333333333333',
  member2: '44444444-4444-4444-4444-444444444444', // Marcel
  member3: '55555555-5555-5555-5555-555555555555', // Andreas K
  member4: '66666666-6666-6666-6666-666666666666', // Constantinos Kyriakou
  tina: '77777777-7777-7777-7777-777777777777',
  marianna: '88888888-8888-8888-8888-888888888888',
  michael: '99999999-9999-9999-9999-999999999999',
  kostas: 'aaaaaaaa-1111-1111-1111-aaaaaaaaaaaa',
  dimitris: 'bbbbbbbb-1111-1111-1111-bbbbbbbbbbbb',
  sk: 'cccccccc-1111-1111-1111-cccccccccccc',
  phoneMember: 'dddddddd-1111-1111-1111-dddddddddddd',
  panos: 'eeeeeeee-1111-1111-1111-eeeeeeeeeeee',
  program: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  dayMon: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1',
  dayTue: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb2',
  dayThu: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb3',
  daySat: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb4',
  clientProgram: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
  classAfternoon: 'class-afternoon-530',
  classEvening: 'class-afternoon-630',
};

/** All studio members from WhatsApp class groups. */
export const MEMBER_IDS = [
  IDS.member,
  IDS.member2,
  IDS.member3,
  IDS.member4,
  IDS.tina,
  IDS.marianna,
  IDS.michael,
  IDS.kostas,
  IDS.dimitris,
  IDS.sk,
  IDS.phoneMember,
  IDS.panos,
] as const;

/** Afternoon Class 5:30–6:30 (excl. coach Andreas Petrides). */
export const AFTERNOON_530_MEMBER_IDS = [
  IDS.member, // Alex Petrides
  IDS.member2, // Marcel
  IDS.tina,
  IDS.member3, // Andreas K
  IDS.member4, // Constantinos Kyriakou
  IDS.marianna,
  IDS.michael,
] as const;

/** Afternoon Group 6:30–7:30 (excl. coach Andreas Petrides). */
export const AFTERNOON_630_MEMBER_IDS = [
  IDS.tina,
  IDS.kostas,
  IDS.member2, // Marcel
  IDS.panos,
  IDS.dimitris,
  IDS.sk,
  IDS.phoneMember,
] as const;

export const mockProfiles: Profile[] = [
  {
    id: IDS.member,
    email: 'member@reforge.cy',
    full_name: 'Alex Petrides',
    phone: null,
    avatar_url: null,
    role: 'member',
    gender: 'male',
    created_at: '2026-01-10T10:00:00.000Z',
  },
  {
    id: IDS.coach,
    email: 'coach@reforge.cy',
    full_name: 'Andreas Petrides',
    phone: null,
    avatar_url: null,
    role: 'coach',
    created_at: '2025-11-01T10:00:00.000Z',
  },
  {
    id: IDS.admin,
    email: 'admin@reforge.cy',
    full_name: 'Andreas Petrides',
    phone: null,
    avatar_url: null,
    role: 'admin',
    created_at: '2025-10-01T10:00:00.000Z',
  },
  {
    id: IDS.member2,
    email: 'marcel@reforge.cy',
    full_name: 'Marcel',
    phone: null,
    avatar_url: null,
    role: 'member',
    gender: 'male',
    created_at: '2026-02-01T10:00:00.000Z',
  },
  {
    id: IDS.member3,
    email: 'andreas.k@reforge.cy',
    full_name: 'Andreas K',
    phone: '+357 99 008805',
    avatar_url: null,
    role: 'member',
    gender: 'male',
    created_at: '2026-02-15T10:00:00.000Z',
  },
  {
    id: IDS.member4,
    email: 'constantinos@reforge.cy',
    full_name: 'Constantinos Kyriakou',
    phone: '+357 97 901705',
    avatar_url: null,
    role: 'member',
    gender: 'male',
    created_at: '2026-03-01T10:00:00.000Z',
  },
  {
    id: IDS.tina,
    email: 'christina@reforge.cy',
    full_name: 'Christina',
    phone: null,
    avatar_url: null,
    role: 'member',
    gender: 'female',
    created_at: '2026-03-05T10:00:00.000Z',
  },
  {
    id: IDS.marianna,
    email: 'marianna@reforge.cy',
    full_name: 'Marianna Savva',
    phone: '+357 95 353659',
    avatar_url: null,
    role: 'member',
    gender: 'female',
    created_at: '2026-03-10T10:00:00.000Z',
  },
  {
    id: IDS.michael,
    email: 'michael@reforge.cy',
    full_name: 'Michael Maghella',
    phone: '+34 613 04 84 60',
    avatar_url: null,
    role: 'member',
    gender: 'male',
    created_at: '2026-03-12T10:00:00.000Z',
  },
  {
    id: IDS.kostas,
    email: 'kostas@reforge.cy',
    full_name: 'Kostas Kalafatis',
    phone: null,
    avatar_url: null,
    role: 'member',
    gender: 'male',
    created_at: '2026-03-15T10:00:00.000Z',
  },
  {
    id: IDS.dimitris,
    email: 'dimitris@reforge.cy',
    full_name: 'Dimitris',
    phone: '+44 7548 846726',
    avatar_url: null,
    role: 'member',
    gender: 'male',
    created_at: '2026-03-18T10:00:00.000Z',
  },
  {
    id: IDS.sk,
    email: 'stavriana@reforge.cy',
    full_name: 'Stavriana',
    phone: '+357 96 207250',
    avatar_url: null,
    role: 'member',
    gender: 'female',
    created_at: '2026-03-20T10:00:00.000Z',
  },
  {
    id: IDS.phoneMember,
    email: 'member.395616@reforge.cy',
    full_name: '+357 99 395616',
    phone: '+357 99 395616',
    avatar_url: null,
    role: 'member',
    gender: null,
    created_at: '2026-03-22T10:00:00.000Z',
  },
  {
    id: IDS.panos,
    email: 'panos@reforge.cy',
    full_name: 'Panos Reforge',
    phone: null,
    avatar_url: null,
    role: 'member',
    gender: 'male',
    created_at: '2026-03-25T10:00:00.000Z',
  },
];

export const mockPasswords: Record<string, string> = {
  'member@reforge.cy': 'password123',
  'coach@reforge.cy': 'password123',
  'admin@reforge.cy': 'password123',
};

export const mockExercises: Exercise[] = [
  {
    id: 'ex-bench',
    name: 'Bench Press',
    muscle_group: 'Chest',
    equipment: 'Barbell',
    description: 'Flat barbell press',
    instructions: 'Retract scapula, lower to mid-chest, press up.',
    image_url: null,
    video_url: null,
    created_by: IDS.coach,
    created_at: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'ex-row',
    name: 'Barbell Row',
    muscle_group: 'Back',
    equipment: 'Barbell',
    description: 'Bent-over row',
    instructions: 'Hinge at hips, pull to lower ribs.',
    image_url: null,
    video_url: null,
    created_by: IDS.coach,
    created_at: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'ex-ohp',
    name: 'Overhead Press',
    muscle_group: 'Shoulders',
    equipment: 'Barbell',
    description: 'Standing press',
    instructions: 'Brace core, press bar overhead.',
    image_url: null,
    video_url: null,
    created_by: IDS.coach,
    created_at: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'ex-pullup',
    name: 'Pull-Ups',
    muscle_group: 'Back',
    equipment: 'Bodyweight',
    description: 'Strict pull-ups',
    instructions: 'Full hang to chin over bar.',
    image_url: null,
    video_url: null,
    created_by: IDS.coach,
    created_at: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'ex-squat',
    name: 'Back Squat',
    muscle_group: 'Legs',
    equipment: 'Barbell',
    description: 'High-bar squat',
    instructions: 'Break at hips and knees, depth below parallel.',
    image_url: null,
    video_url: null,
    created_by: IDS.coach,
    created_at: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'ex-rdl',
    name: 'Romanian Deadlift',
    muscle_group: 'Legs',
    equipment: 'Barbell',
    description: 'Hip hinge RDL',
    instructions: 'Soft knees, push hips back, feel hamstrings.',
    image_url: null,
    video_url: null,
    created_by: IDS.coach,
    created_at: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'ex-lunges',
    name: 'Walking Lunges',
    muscle_group: 'Legs',
    equipment: 'Dumbbells',
    description: 'Alternating lunges',
    instructions: 'Long stride, knee tracks over toes.',
    image_url: null,
    video_url: null,
    created_by: IDS.coach,
    created_at: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'ex-curl',
    name: 'Dumbbell Curl',
    muscle_group: 'Arms',
    equipment: 'Dumbbells',
    description: 'Biceps curl',
    instructions: 'Control the eccentric, no swinging.',
    image_url: null,
    video_url: null,
    created_by: IDS.coach,
    created_at: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'ex-plank',
    name: 'Plank',
    muscle_group: 'Core',
    equipment: 'Bodyweight',
    description: 'Front plank',
    instructions: 'Neutral spine, squeeze glutes.',
    image_url: null,
    video_url: null,
    created_by: IDS.coach,
    created_at: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'ex-fly',
    name: 'Cable Fly',
    muscle_group: 'Chest',
    equipment: 'Cable',
    description: 'Standing cable fly',
    instructions: 'Slight bend in elbows, squeeze at midline.',
    image_url: null,
    video_url: null,
    created_by: IDS.coach,
    created_at: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'ex-rower',
    name: 'Row Intervals',
    muscle_group: 'Cardio',
    equipment: 'Rower',
    description: '500m repeats with rest',
    instructions: 'Drive with legs first, maintain steady stroke rate.',
    image_url: null,
    video_url: null,
    created_by: IDS.coach,
    created_at: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'ex-bike',
    name: 'Assault Bike Sprints',
    muscle_group: 'Cardio',
    equipment: 'Assault bike',
    description: 'Short max-effort intervals',
    instructions: '30 sec on / 30 sec off for 8 rounds.',
    image_url: null,
    video_url: null,
    created_by: IDS.coach,
    created_at: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'ex-worlds',
    name: "World's Greatest Stretch",
    muscle_group: 'Mobility',
    equipment: 'Bodyweight',
    description: 'Hip flexor and thoracic opener',
    instructions: 'Hold each position 2–3 sec, 5 reps per side.',
    image_url: null,
    video_url: null,
    created_by: IDS.coach,
    created_at: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'ex-band',
    name: 'Band Pull-Aparts',
    muscle_group: 'Mobility',
    equipment: 'Band',
    description: 'Shoulder prehab',
    instructions: 'Slow and controlled, squeeze shoulder blades.',
    image_url: null,
    video_url: null,
    created_by: IDS.coach,
    created_at: '2026-01-01T00:00:00.000Z',
  },
];

export const mockPrograms: Program[] = [
  {
    id: IDS.program,
    name: 'REFORGE STRENGTH',
    description: '8-week strength and hypertrophy block for Limassol athletes.',
    duration_weeks: 8,
    coach_id: IDS.coach,
    is_template: true,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-03-01T00:00:00.000Z',
  },
];

export const mockProgramDays: ProgramDay[] = [
  { id: IDS.dayMon, program_id: IDS.program, name: 'Upper Strength', day_of_week: 1, order_index: 0 },
  { id: IDS.dayTue, program_id: IDS.program, name: 'Lower Strength', day_of_week: 2, order_index: 1 },
  { id: IDS.dayThu, program_id: IDS.program, name: 'Upper Hypertrophy', day_of_week: 4, order_index: 2 },
  { id: IDS.daySat, program_id: IDS.program, name: 'Lower Hypertrophy', day_of_week: 6, order_index: 3 },
];

export const mockProgramExercises: ProgramExercise[] = [
  {
    id: 'pe-1',
    program_day_id: IDS.dayMon,
    exercise_id: 'ex-bench',
    sets: 4,
    reps: '8',
    rest_seconds: 90,
    coach_notes: 'Pause 1 sec on chest. Leave 1–2 reps in reserve.',
    order_index: 0,
  },
  {
    id: 'pe-2',
    program_day_id: IDS.dayMon,
    exercise_id: 'ex-row',
    sets: 4,
    reps: '8',
    rest_seconds: 90,
    coach_notes: 'Control the eccentric.',
    order_index: 1,
  },
  {
    id: 'pe-3',
    program_day_id: IDS.dayMon,
    exercise_id: 'ex-ohp',
    sets: 3,
    reps: '8',
    rest_seconds: 90,
    coach_notes: null,
    order_index: 2,
  },
  {
    id: 'pe-4',
    program_day_id: IDS.dayMon,
    exercise_id: 'ex-pullup',
    sets: 3,
    reps: '8',
    rest_seconds: 75,
    coach_notes: 'Use band if needed.',
    order_index: 3,
  },
  {
    id: 'pe-5',
    program_day_id: IDS.dayTue,
    exercise_id: 'ex-squat',
    sets: 4,
    reps: '6',
    rest_seconds: 120,
    coach_notes: 'Depth first, then load.',
    order_index: 0,
  },
  {
    id: 'pe-6',
    program_day_id: IDS.dayTue,
    exercise_id: 'ex-rdl',
    sets: 3,
    reps: '8',
    rest_seconds: 90,
    coach_notes: null,
    order_index: 1,
  },
  {
    id: 'pe-7',
    program_day_id: IDS.dayTue,
    exercise_id: 'ex-lunges',
    sets: 3,
    reps: '10/leg',
    rest_seconds: 75,
    coach_notes: null,
    order_index: 2,
  },
  {
    id: 'pe-8',
    program_day_id: IDS.dayThu,
    exercise_id: 'ex-bench',
    sets: 3,
    reps: '10',
    rest_seconds: 75,
    coach_notes: 'Slightly lighter than Monday.',
    order_index: 0,
  },
  {
    id: 'pe-9',
    program_day_id: IDS.dayThu,
    exercise_id: 'ex-fly',
    sets: 3,
    reps: '12',
    rest_seconds: 60,
    coach_notes: null,
    order_index: 1,
  },
  {
    id: 'pe-10',
    program_day_id: IDS.dayThu,
    exercise_id: 'ex-curl',
    sets: 3,
    reps: '12',
    rest_seconds: 60,
    coach_notes: null,
    order_index: 2,
  },
  {
    id: 'pe-11',
    program_day_id: IDS.daySat,
    exercise_id: 'ex-squat',
    sets: 3,
    reps: '10',
    rest_seconds: 90,
    coach_notes: null,
    order_index: 0,
  },
  {
    id: 'pe-12',
    program_day_id: IDS.daySat,
    exercise_id: 'ex-rdl',
    sets: 3,
    reps: '10',
    rest_seconds: 75,
    coach_notes: null,
    order_index: 1,
  },
  {
    id: 'pe-13',
    program_day_id: IDS.daySat,
    exercise_id: 'ex-plank',
    sets: 3,
    reps: '45s',
    rest_seconds: 45,
    coach_notes: null,
    order_index: 2,
  },
];

export const mockClientPrograms: ClientProgram[] = [
  {
    id: IDS.clientProgram,
    client_id: IDS.member,
    program_id: IDS.program,
    start_date: '2026-07-20',
    current_week: 3,
    is_active: true,
  },
  {
    id: 'cp-2',
    client_id: IDS.member2,
    program_id: IDS.program,
    start_date: '2026-07-27',
    current_week: 2,
    is_active: true,
  },
];

/** Coach ↔ member assignments (admin can reassign). */
export let mockCoachClients: CoachClient[] = MEMBER_IDS.map((memberId, i) => ({
  id: `cc-${i + 1}`,
  coach_id: IDS.coach,
  member_id: memberId,
  assigned_at: `2026-0${Math.min(3, Math.floor(i / 4) + 1)}-${String((i % 28) + 1).padStart(2, '0')}T10:00:00.000Z`,
}));

/** Soft-deactivated members (still in profiles, hidden from active lists). */
export const mockInactiveMemberIds = new Set<string>();

export let mockStudioSettings: StudioSettings = {
  name: 'REFORGE Limassol',
  location: 'City Box Gym · Augoustas Theodoras 9, Limassol',
  membershipLabel: 'REFORGE Strength',
  allowMemberBooking: true,
  groupChatEnabled: true,
  workingDays: [1, 2, 3, 4, 5, 6],
  openTime: '07:00',
  closeTime: '21:00',
};

export let mockStudioNews: StudioNews[] = [
  {
    id: 'news-1',
    title: 'Welcome to REFORGE',
    body: 'Your weekly training plan is live. Check Workouts for today’s session and recover hard on rest days.',
    created_at: new Date().toISOString(),
    author_id: IDS.admin,
    published: true,
    audience: 'all',
  },
  {
    id: 'news-2',
    title: 'Studio hours',
    body: 'We are open Mon–Sat, 07:00–21:00. Book PT sessions from the app or ask your coach on the floor.',
    created_at: new Date(Date.now() - 86400000 * 2).toISOString(),
    author_id: IDS.admin,
    published: true,
    audience: 'all',
  },
];

export let mockNotifications: AppNotification[] = [];

/** userId → threadId → ISO timestamp of last read message */
export let mockChatReadCursors: Record<string, Record<string, string>> = {};

export let mockWorkoutsOfTheDay: WorkoutOfTheDay[] = [
  {
    id: 'wod-today',
    date: new Date().toISOString().slice(0, 10),
    title: 'Engine & Iron',
    focus: 'Full body · Conditioning',
    description:
      'Studio session for everyone — mix of strength complexes and short conditioning finishers. Coach-led on the floor.',
    duration_min: 45,
    level: 'All levels',
    location: 'Studio Floor',
    start_time: '18:00',
    movements: defaultWodMovements(),
    moves: movementsToLegacyMoves(defaultWodMovements()),
    created_by: IDS.admin,
    created_at: new Date().toISOString(),
    active: true,
  },
];

export let mockWodRsvps: WodRsvp[] = [
  {
    id: 'wod-rsvp-1',
    wod_id: 'wod-today',
    member_id: IDS.member2,
    status: 'joined',
    updated_at: new Date().toISOString(),
  },
];

export let mockMemberAbsences: MemberAbsence[] = [];

function addMonthsIso(months: number) {
  const d = new Date();
  d.setMonth(d.getMonth() + months);
  return d.toISOString().slice(0, 10);
}

function monthsAgoIso(months: number) {
  const d = new Date();
  d.setMonth(d.getMonth() - months);
  return d.toISOString().slice(0, 10);
}

const membershipDefaults: Record<
  string,
  Pick<MemberMembership, 'plan' | 'plan_label' | 'status' | 'amount_eur' | 'notes'>
> = {
  [IDS.member]: { plan: 'monthly', plan_label: 'REFORGE Strength', status: 'paid', amount_eur: 180, notes: null },
  [IDS.member2]: {
    plan: 'monthly',
    plan_label: 'REFORGE Strength',
    status: 'overdue',
    amount_eur: 180,
    notes: 'Follow up on payment',
  },
  [IDS.member3]: {
    plan: 'quarterly',
    plan_label: 'REFORGE Quarterly',
    status: 'paid',
    amount_eur: 480,
    notes: null,
  },
  [IDS.member4]: {
    plan: 'monthly',
    plan_label: 'REFORGE Strength',
    status: 'unpaid',
    amount_eur: 180,
    notes: 'New member — awaiting first payment',
  },
  [IDS.tina]: { plan: 'monthly', plan_label: 'REFORGE Strength', status: 'paid', amount_eur: 180, notes: null },
  [IDS.marianna]: { plan: 'monthly', plan_label: 'REFORGE Strength', status: 'paid', amount_eur: 180, notes: null },
  [IDS.michael]: { plan: 'monthly', plan_label: 'REFORGE Strength', status: 'paid', amount_eur: 180, notes: null },
  [IDS.kostas]: { plan: 'monthly', plan_label: 'REFORGE Strength', status: 'paid', amount_eur: 180, notes: null },
  [IDS.dimitris]: {
    plan: 'monthly',
    plan_label: 'REFORGE Strength',
    status: 'unpaid',
    amount_eur: 180,
    notes: null,
  },
  [IDS.sk]: { plan: 'monthly', plan_label: 'REFORGE Strength', status: 'paid', amount_eur: 180, notes: null },
  [IDS.phoneMember]: {
    plan: 'monthly',
    plan_label: 'REFORGE Strength',
    status: 'unpaid',
    amount_eur: 180,
    notes: 'Phone-only contact — confirm name',
  },
  [IDS.panos]: { plan: 'monthly', plan_label: 'REFORGE Strength', status: 'paid', amount_eur: 180, notes: null },
};

export let mockMemberships: MemberMembership[] = MEMBER_IDS.map((memberId, i) => {
  const def = membershipDefaults[memberId];
  const paid = def.status === 'paid';
  const overdue = def.status === 'overdue';
  return {
    id: `mem-${i + 1}`,
    member_id: memberId,
    plan: def.plan,
    plan_label: def.plan_label,
    status: def.status,
    amount_eur: def.amount_eur,
    period_start: overdue ? monthsAgoIso(1) : monthsAgoIso(0).slice(0, 8) + '01',
    period_end: overdue ? monthsAgoIso(0) : addMonthsIso(def.plan === 'quarterly' ? 2 : 1),
    last_paid_at: paid ? monthsAgoIso(0) : overdue ? monthsAgoIso(2) : null,
    notes: def.notes,
    updated_at: new Date().toISOString(),
  };
});

function monthLabel(monthsAgo: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() - monthsAgo);
  return d.toLocaleString('en-GB', { month: 'long', year: 'numeric' });
}

export let mockMembershipPayments: MembershipPayment[] = mockMemberships.flatMap((m, i) => {
  const paid = m.status === 'paid' || m.status === 'overdue';
  const rows: MembershipPayment[] = [];
  if (paid) {
    rows.push({
      id: `pay-${i + 1}-1`,
      member_id: m.member_id,
      membership_id: m.id,
      amount_eur: m.amount_eur,
      kind: 'payment',
      status: 'paid',
      period_label: monthLabel(1),
      notes: null,
      created_at: monthsAgoIso(1) + 'T10:00:00.000Z',
    });
  }
  if (m.status === 'paid') {
    rows.push({
      id: `pay-${i + 1}-2`,
      member_id: m.member_id,
      membership_id: m.id,
      amount_eur: m.amount_eur,
      kind: 'payment',
      status: 'paid',
      period_label: monthLabel(0),
      notes: 'Marked paid by admin',
      created_at: monthsAgoIso(0) + 'T10:00:00.000Z',
    });
  }
  if (m.status === 'unpaid' || m.status === 'overdue') {
    rows.push({
      id: `inv-${i + 1}`,
      member_id: m.member_id,
      membership_id: m.id,
      amount_eur: m.amount_eur,
      kind: 'invoice',
      status: 'pending',
      period_label: monthLabel(0),
      notes: `${m.plan_label} — ${monthLabel(0)}`,
      created_at: monthsAgoIso(0) + 'T08:00:00.000Z',
    });
  }
  return rows;
});

const today = new Date();
const todayIso = today.toISOString().slice(0, 10);

function atTime(hour: number, minute = 0, dayOffset = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + dayOffset);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}

export let mockBookings: Booking[] = [
  {
    id: 'bk-1',
    member_id: IDS.member,
    coach_id: IDS.coach,
    starts_at: atTime(18, 30, 1),
    ends_at: atTime(19, 30, 1),
    status: 'confirmed',
    location: 'Studio A',
    notes: 'Personal Training',
    attended: null,
    created_at: '2026-08-01T10:00:00.000Z',
  },
  {
    id: 'bk-2',
    member_id: IDS.member2,
    coach_id: IDS.coach,
    starts_at: atTime(9, 0),
    ends_at: atTime(10, 0),
    status: 'confirmed',
    location: 'Studio A',
    notes: 'Personal Training',
    attended: null,
    created_at: '2026-08-01T10:00:00.000Z',
  },
  {
    id: 'bk-3',
    member_id: IDS.member3,
    coach_id: IDS.coach,
    starts_at: atTime(10, 30),
    ends_at: atTime(11, 30),
    status: 'confirmed',
    location: 'Studio B',
    notes: 'Personal Training',
    attended: null,
    created_at: '2026-08-01T10:00:00.000Z',
  },
  {
    id: 'bk-4',
    member_id: IDS.member4,
    coach_id: IDS.coach,
    starts_at: atTime(17, 0),
    ends_at: atTime(18, 0),
    status: 'pending',
    location: 'Studio A',
    notes: 'Personal Training',
    attended: null,
    created_at: '2026-08-08T10:00:00.000Z',
  },
  {
    id: 'bk-past',
    member_id: IDS.member,
    coach_id: IDS.coach,
    starts_at: atTime(16, 0, -7),
    ends_at: atTime(17, 0, -7),
    status: 'completed',
    location: 'Studio A',
    notes: 'Personal Training',
    attended: true,
    created_at: '2026-07-20T10:00:00.000Z',
  },
  {
    id: 'bk-past-2',
    member_id: IDS.member,
    coach_id: IDS.coach,
    starts_at: atTime(17, 0, -14),
    ends_at: atTime(18, 0, -14),
    status: 'completed',
    location: 'Studio A',
    notes: 'Personal Training',
    attended: true,
    created_at: '2026-07-10T10:00:00.000Z',
  },
  {
    id: 'bk-past-3',
    member_id: IDS.member,
    coach_id: IDS.coach,
    starts_at: atTime(18, 0, -21),
    ends_at: atTime(19, 0, -21),
    status: 'completed',
    location: 'Studio B',
    notes: 'Personal Training',
    attended: false,
    created_at: '2026-07-01T10:00:00.000Z',
  },
];

export let mockClasses: GymClass[] = [
  {
    id: IDS.classAfternoon,
    coach_id: IDS.coach,
    title: 'Afternoon Class 5:30-6:30',
    description: 'Afternoon group training with Andreas Petrides.',
    starts_at: atTime(17, 30, 1),
    ends_at: atTime(18, 30, 1),
    location: 'Studio Floor',
    capacity: 12,
    level: 'All levels',
    created_at: '2026-08-01T10:00:00.000Z',
  },
  {
    id: IDS.classEvening,
    coach_id: IDS.coach,
    title: 'Afternoon Group 6:30-7:30',
    description: 'Evening group training with Andreas Petrides.',
    starts_at: atTime(18, 30, 1),
    ends_at: atTime(19, 30, 1),
    location: 'Studio Floor',
    capacity: 12,
    level: 'All levels',
    created_at: '2026-08-01T10:00:00.000Z',
  },
  {
    id: 'class-past',
    coach_id: IDS.coach,
    title: 'Afternoon Class 5:30-6:30',
    description: 'Past afternoon group session.',
    starts_at: atTime(17, 30, -2),
    ends_at: atTime(18, 30, -2),
    location: 'Studio Floor',
    capacity: 12,
    level: 'All levels',
    created_at: '2026-07-20T10:00:00.000Z',
  },
];

export let mockEnrollments: ClassEnrollment[] = [
  ...AFTERNOON_530_MEMBER_IDS.map((memberId, i) => ({
    id: `en-530-${i + 1}`,
    class_id: IDS.classAfternoon,
    member_id: memberId,
    attended: null,
    joined_at: '2026-08-01T10:00:00.000Z',
  })),
  ...AFTERNOON_630_MEMBER_IDS.map((memberId, i) => ({
    id: `en-630-${i + 1}`,
    class_id: IDS.classEvening,
    member_id: memberId,
    attended: null,
    joined_at: '2026-08-01T10:00:00.000Z',
  })),
  ...AFTERNOON_530_MEMBER_IDS.slice(0, 4).map((memberId, i) => ({
    id: `en-past-${i + 1}`,
    class_id: 'class-past',
    member_id: memberId,
    attended: true,
    joined_at: '2026-07-20T08:00:00.000Z',
  })),
];

export let mockChatThreads: ChatThread[] = [
  {
    id: 'thread-afternoon-530',
    kind: 'class',
    class_id: IDS.classAfternoon,
    name: 'Afternoon Class 5:30-6:30',
    coach_id: IDS.coach,
    description: 'WhatsApp class group · Andreas Petrides · 5:30–6:30',
    member_ids: [...AFTERNOON_530_MEMBER_IDS],
    created_at: '2026-06-01T10:00:00.000Z',
  },
  {
    id: 'thread-afternoon-630',
    kind: 'class',
    class_id: IDS.classEvening,
    name: 'Afternoon Group 6:30-7:30',
    coach_id: IDS.coach,
    description: 'WhatsApp class group · Andreas Petrides · 6:30–7:30',
    member_ids: [...AFTERNOON_630_MEMBER_IDS],
    created_at: '2026-06-01T10:00:00.000Z',
  },
];

export let mockChatMessages: ChatMessage[] = [
  // —— Afternoon Class 5:30–6:30 ——
  {
    id: 'msg-530-1',
    thread_id: 'thread-afternoon-530',
    sender_id: IDS.coach,
    type: 'text',
    body: 'Welcome to Afternoon Class 5:30–6:30. Be on the floor ready — we start on time.',
    meta: null,
    created_at: atTime(17, 0, -5),
  },
  {
    id: 'msg-530-2',
    thread_id: 'thread-afternoon-530',
    sender_id: IDS.coach,
    type: 'text',
    body: 'Tomorrow 5:30 sharp. Warm up when you arrive.',
    meta: null,
    created_at: atTime(17, 12, -5),
  },
  {
    id: 'msg-530-3',
    thread_id: 'thread-afternoon-530',
    sender_id: IDS.member2,
    type: 'text',
    body: 'See you there 💪',
    meta: null,
    created_at: atTime(17, 18, -5),
  },
  {
    id: 'msg-530-4',
    thread_id: 'thread-afternoon-530',
    sender_id: IDS.tina,
    type: 'text',
    body: 'Ok!',
    meta: null,
    created_at: atTime(17, 22, -5),
  },
  {
    id: 'msg-530-5',
    thread_id: 'thread-afternoon-530',
    sender_id: IDS.member3,
    type: 'text',
    body: 'Coming',
    meta: null,
    created_at: atTime(17, 25, -5),
  },
  {
    id: 'msg-530-6',
    thread_id: 'thread-afternoon-530',
    sender_id: IDS.marianna,
    type: 'text',
    body: 'Θα είμαι εκεί',
    meta: null,
    created_at: atTime(17, 28, -5),
  },
  {
    id: 'msg-530-7',
    thread_id: 'thread-afternoon-530',
    sender_id: IDS.michael,
    type: 'text',
    body: '👍',
    meta: null,
    created_at: atTime(17, 31, -5),
  },
  {
    id: 'msg-530-8',
    thread_id: 'thread-afternoon-530',
    sender_id: IDS.member4,
    type: 'text',
    body: 'Έρχομαι λίγο νωρίς',
    meta: null,
    created_at: atTime(16, 50, -2),
  },
  {
    id: 'msg-530-9',
    thread_id: 'thread-afternoon-530',
    sender_id: IDS.member,
    type: 'text',
    body: 'On my way',
    meta: null,
    created_at: atTime(17, 15, -2),
  },
  {
    id: 'msg-530-10',
    thread_id: 'thread-afternoon-530',
    sender_id: IDS.member2,
    type: 'workout',
    body: 'Solid session today.',
    meta: { workoutName: 'Afternoon Class 5:30' },
    created_at: atTime(18, 35, -2),
  },
  {
    id: 'msg-530-11',
    thread_id: 'thread-afternoon-530',
    sender_id: IDS.coach,
    type: 'text',
    body: 'Great work team. Recover well — same time next session.',
    meta: null,
    created_at: atTime(18, 40, -2),
  },
  {
    id: 'msg-530-12',
    thread_id: 'thread-afternoon-530',
    sender_id: IDS.member,
    type: 'progress',
    body: 'Feeling stronger this month.',
    meta: { weightKg: 78.5, bodyFatPct: 14.2 },
    created_at: atTime(20, 5, -1),
  },

  // —— Afternoon Group 6:30–7:30 ——
  {
    id: 'msg-630-1',
    thread_id: 'thread-afternoon-630',
    sender_id: IDS.coach,
    type: 'text',
    body: 'Ne jini p en sto 5:30 elate 5:30',
    meta: null,
    created_at: atTime(18, 10, -6),
  },
  {
    id: 'msg-630-2',
    thread_id: 'thread-afternoon-630',
    sender_id: IDS.coach,
    type: 'text',
    body: 'Na sas fio pu tto group ;)',
    meta: null,
    created_at: atTime(18, 11, -6),
  },
  {
    id: 'msg-630-3',
    thread_id: 'thread-afternoon-630',
    sender_id: IDS.panos,
    type: 'text',
    body: 'Thank you 🙏🙏',
    meta: null,
    created_at: atTime(18, 14, -6),
  },
  {
    id: 'msg-630-4',
    thread_id: 'thread-afternoon-630',
    sender_id: IDS.kostas,
    type: 'text',
    body: 'Ok coach',
    meta: null,
    created_at: atTime(18, 16, -6),
  },
  {
    id: 'msg-630-5',
    thread_id: 'thread-afternoon-630',
    sender_id: IDS.dimitris,
    type: 'text',
    body: 'What time tomorrow?',
    meta: null,
    created_at: atTime(19, 40, -3),
  },
  {
    id: 'msg-630-6',
    thread_id: 'thread-afternoon-630',
    sender_id: IDS.coach,
    type: 'text',
    body: '6:30–7:30 as usual. Floor ready.',
    meta: null,
    created_at: atTime(19, 45, -3),
  },
  {
    id: 'msg-630-7',
    thread_id: 'thread-afternoon-630',
    sender_id: IDS.sk,
    type: 'text',
    body: 'Έρχομαι',
    meta: null,
    created_at: atTime(19, 50, -3),
  },
  {
    id: 'msg-630-8',
    thread_id: 'thread-afternoon-630',
    sender_id: IDS.member2,
    type: 'text',
    body: "Let's go",
    meta: null,
    created_at: atTime(18, 5, -1),
  },
  {
    id: 'msg-630-9',
    thread_id: 'thread-afternoon-630',
    sender_id: IDS.tina,
    type: 'text',
    body: 'See you all',
    meta: null,
    created_at: atTime(18, 8, -1),
  },
  {
    id: 'msg-630-10',
    thread_id: 'thread-afternoon-630',
    sender_id: IDS.phoneMember,
    type: 'text',
    body: '👍',
    meta: null,
    created_at: atTime(18, 12, -1),
  },
  {
    id: 'msg-630-11',
    thread_id: 'thread-afternoon-630',
    sender_id: IDS.panos,
    type: 'workout',
    body: 'Finished strong tonight.',
    meta: { workoutName: 'Afternoon Group 6:30' },
    created_at: atTime(19, 35, -1),
  },
  {
    id: 'msg-630-12',
    thread_id: 'thread-afternoon-630',
    sender_id: IDS.coach,
    type: 'text',
    body: 'Good session everyone. Same group tomorrow.',
    meta: null,
    created_at: atTime(19, 38, -1),
  },
];

export const mockAvailability: CoachAvailability[] = [
  { id: 'av-1', coach_id: IDS.coach, day_of_week: 1, start_time: '08:00', end_time: '12:00', is_blocked: false },
  { id: 'av-2', coach_id: IDS.coach, day_of_week: 1, start_time: '16:00', end_time: '20:00', is_blocked: false },
  { id: 'av-3', coach_id: IDS.coach, day_of_week: 2, start_time: '09:00', end_time: '14:00', is_blocked: false },
  { id: 'av-4', coach_id: IDS.coach, day_of_week: 3, start_time: '08:00', end_time: '12:00', is_blocked: false },
  { id: 'av-5', coach_id: IDS.coach, day_of_week: 4, start_time: '16:00', end_time: '20:00', is_blocked: false },
  { id: 'av-6', coach_id: IDS.coach, day_of_week: 5, start_time: '09:00', end_time: '13:00', is_blocked: false },
];

export let mockMeasurements: BodyMeasurement[] = [
  {
    id: 'm-1',
    member_id: IDS.member,
    weight_kg: 80.2,
    body_fat_pct: 15.1,
    measured_at: '2026-06-01',
    notes: null,
    created_at: '2026-06-01T08:00:00.000Z',
  },
  {
    id: 'm-2',
    member_id: IDS.member,
    weight_kg: 79.4,
    body_fat_pct: 14.8,
    measured_at: '2026-07-01',
    notes: null,
    created_at: '2026-07-01T08:00:00.000Z',
  },
  {
    id: 'm-3',
    member_id: IDS.member,
    weight_kg: 78.5,
    body_fat_pct: 14.2,
    measured_at: todayIso,
    notes: 'Feeling leaner',
    created_at: new Date().toISOString(),
  },
];

export let mockSessions: WorkoutSession[] = [
  {
    id: 'ws-prev',
    member_id: IDS.member,
    program_day_id: IDS.dayMon,
    started_at: '2026-08-04T17:00:00.000Z',
    finished_at: '2026-08-04T17:48:00.000Z',
    status: 'completed',
    duration_seconds: 2880,
    estimated_calories: 310,
    notes: null,
  },
];

export let mockSets: WorkoutSet[] = [
  {
    id: 'set-1',
    session_id: 'ws-prev',
    exercise_id: 'ex-bench',
    set_number: 1,
    weight_kg: 77.5,
    reps: 8,
    completed: true,
    notes: null,
  },
  {
    id: 'set-2',
    session_id: 'ws-prev',
    exercise_id: 'ex-bench',
    set_number: 2,
    weight_kg: 77.5,
    reps: 8,
    completed: true,
    notes: null,
  },
  {
    id: 'set-3',
    session_id: 'ws-prev',
    exercise_id: 'ex-bench',
    set_number: 3,
    weight_kg: 75,
    reps: 8,
    completed: true,
    notes: null,
  },
];

export let mockCoachNotes: CoachNote[] = [
  {
    id: 'note-1',
    coach_id: IDS.coach,
    member_id: IDS.member,
    content: 'Focus on scapular control on bench. Ready to progress load next week.',
    created_at: '2026-08-05T10:00:00.000Z',
    updated_at: '2026-08-05T10:00:00.000Z',
  },
];

export function delay(ms = 250): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function newId(prefix = 'id'): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
