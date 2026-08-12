export type UserRole = 'member' | 'coach' | 'admin';

export type MemberGender = 'male' | 'female' | 'other';

export type BookingStatus = 'pending' | 'confirmed' | 'cancelled' | 'completed';

export type SessionStatus = 'active' | 'completed' | 'abandoned';

export type MuscleGroup =
  | 'Chest'
  | 'Back'
  | 'Shoulders'
  | 'Arms'
  | 'Legs'
  | 'Core'
  | 'Cardio'
  | 'Mobility';

export type Profile = {
  id: string;
  email: string;
  full_name: string;
  phone: string | null;
  avatar_url: string | null;
  role: UserRole;
  gender?: MemberGender | null;
  created_at: string;
};

export type CoachClient = {
  id: string;
  coach_id: string;
  member_id: string;
  assigned_at: string;
};

export type Program = {
  id: string;
  name: string;
  description: string | null;
  duration_weeks: number;
  coach_id: string;
  is_template: boolean;
  created_at: string;
  updated_at: string;
};

export type ProgramDay = {
  id: string;
  program_id: string;
  name: string;
  day_of_week: number | null;
  order_index: number;
};

export type Exercise = {
  id: string;
  name: string;
  muscle_group: MuscleGroup;
  equipment: string | null;
  description: string | null;
  instructions: string | null;
  image_url: string | null;
  video_url: string | null;
  created_by: string | null;
  created_at: string;
};

export type ProgramExercise = {
  id: string;
  program_day_id: string;
  exercise_id: string;
  sets: number;
  reps: string;
  rest_seconds: number;
  coach_notes: string | null;
  order_index: number;
  exercise?: Exercise;
};

export type ClientProgram = {
  id: string;
  client_id: string;
  program_id: string;
  start_date: string;
  current_week: number;
  is_active: boolean;
  program?: Program;
};

export type WorkoutSession = {
  id: string;
  member_id: string;
  program_day_id: string | null;
  started_at: string;
  finished_at: string | null;
  status: SessionStatus;
  duration_seconds: number | null;
  estimated_calories: number | null;
  notes: string | null;
};

export type WorkoutSet = {
  id: string;
  session_id: string;
  exercise_id: string;
  set_number: number;
  weight_kg: number | null;
  reps: number | null;
  completed: boolean;
  notes: string | null;
};

export type Booking = {
  id: string;
  member_id: string;
  coach_id: string;
  starts_at: string;
  ends_at: string;
  status: BookingStatus;
  location: string | null;
  notes: string | null;
  attended: boolean | null;
  created_at: string;
  coach?: Profile;
  member?: Profile;
};

export type GymClass = {
  id: string;
  coach_id: string;
  title: string;
  description: string | null;
  starts_at: string;
  ends_at: string;
  location: string;
  capacity: number;
  level: string;
  created_at: string;
  coach?: Profile;
  enrolled_count?: number;
  joined?: boolean;
  classmates?: Array<Pick<Profile, 'id' | 'full_name' | 'avatar_url'>>;
};

export type ClassEnrollment = {
  id: string;
  class_id: string;
  member_id: string;
  attended: boolean | null;
  joined_at: string;
};

export type AttendanceSummary = {
  privateTotal: number;
  privateAttended: number;
  classTotal: number;
  classAttended: number;
  streak: number;
  records: Array<{
    id: string;
    kind: 'private' | 'class';
    title: string;
    starts_at: string;
    attended: boolean | null;
    status: string;
    classId?: string;
    enrolledCount?: number;
    capacity?: number;
    location?: string;
    coachName?: string;
    classmates?: Array<Pick<Profile, 'id' | 'full_name' | 'avatar_url'>>;
  }>;
};

export type AppNotificationType =
  | 'studio_news'
  | 'membership_invoice'
  | 'chat_request'
  | 'chat_message'
  | 'chat_invite';

export type AppNotification = {
  id: string;
  user_id: string;
  title: string;
  body: string;
  read: boolean;
  created_at: string;
  news_id?: string;
  thread_id?: string;
  type?: AppNotificationType;
};

export type ChatMessageType = 'text' | 'workout' | 'progress';

export type ChatThreadKind = 'class' | 'coach_dm' | 'private' | 'group';

export type ChatThread = {
  id: string;
  kind: ChatThreadKind;
  name: string;
  coach_id: string;
  description: string | null;
  member_ids: string[];
  class_id?: string | null;
  created_at: string;
};

export type ChatThreadPreview = ChatThread & {
  last_message?: string | null;
  last_message_at?: string | null;
  unread_count?: number;
};

export type ChatMessage = {
  id: string;
  thread_id: string;
  sender_id: string;
  type: ChatMessageType;
  body: string;
  meta?: {
    workoutName?: string;
    weightKg?: number;
    bodyFatPct?: number;
  } | null;
  created_at: string;
  sender?: Profile;
};

export type CoachAvailability = {
  id: string;
  coach_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  is_blocked: boolean;
};

export type BodyMeasurement = {
  id: string;
  member_id: string;
  weight_kg: number;
  body_fat_pct: number | null;
  measured_at: string;
  notes: string | null;
  created_at: string;
};

export type ProgressPhoto = {
  id: string;
  member_id: string;
  image_url: string;
  taken_at: string;
  notes: string | null;
  created_at: string;
};

export type CoachNote = {
  id: string;
  coach_id: string;
  member_id: string;
  content: string;
  created_at: string;
  updated_at: string;
};

export type Notification = {
  id: string;
  user_id: string;
  title: string;
  body: string;
  read: boolean;
  created_at: string;
};

export type AuthSession = {
  userId: string;
  email: string;
  accessToken: string;
  expiresAt: string;
};

export type MemberDashboard = {
  userName: string;
  fullName: string;
  programName: string | null;
  currentWeek: number | null;
  durationWeeks: number | null;
  todayWorkout: {
    dayId: string;
    title: string;
    duration: string;
    exercises: number;
    calories: number;
  } | null;
  nextWorkout: {
    dayId: string;
    title: string;
    dayLabel: string;
  } | null;
  weeklyProgress: {
    completed: number;
    goal: number;
    streak: number;
  };
  stats: {
    weightKg: number | null;
    bodyFatPct: number | null;
    weeklyWorkouts: number;
    monthlyWorkouts: number;
  };
  performance?: {
    onboardingComplete: boolean;
    profileCompletionPct: number;
    weeklyGoal: number;
    streak: number;
  };
  upcomingSession: {
    bookingId: string;
    trainer: string;
    type: string;
    date: string;
    time: string;
    location: string;
    status: BookingStatus;
  } | null;
  upcomingSessions: Array<{
    bookingId: string;
    trainer: string;
    type: string;
    date: string;
    time: string;
    location: string;
    status: BookingStatus;
  }>;
  studioNews: Array<{
    id: string;
    title: string;
    body: string;
    createdAt: string;
  }>;
  unreadNotifications: number;
  workoutOfTheDay: {
    id: string;
    date: string;
    title: string;
    focus: string;
    description: string;
    durationMin: number;
    level: string;
    location: string;
    startTime: string;
    moves: string[];
    movements: import('@/lib/workouts/wod').WodMovement[];
    joinedCount: number;
    myStatus: 'joined' | 'skipped' | null;
  } | null;
};

export type AssignedProgramView = {
  clientProgram: ClientProgram;
  program: Program;
  days: Array<ProgramDay & { exercises: ProgramExercise[]; status: 'completed' | 'upcoming' | 'today' }>;
};

export type WorkoutSummary = {
  sessionId: string;
  durationSeconds: number;
  exercisesCompleted: number;
  totalSets: number;
  estimatedVolumeKg: number;
  personalRecords: string[];
};

export type CoachDashboard = {
  todaySessions: Array<{
    id: string;
    kind: 'group' | 'private';
    time: string;
    title: string;
    clientName: string;
    coachName: string;
    status: BookingStatus | 'scheduled';
    enrolledCount?: number;
    capacity?: number;
  }>;
  activeClients: number;
  upcomingBookings: number;
  recentWorkouts: Array<{
    memberName: string;
    workoutName: string;
    finishedAt: string;
  }>;
  attentionClients: Array<{
    memberId: string;
    name: string;
    reason: string;
  }>;
};

export type ClientCard = {
  member: Profile;
  currentProgram: string | null;
  lastWorkout: string | null;
  upcomingSession: string | null;
  trainingPlacement?: import('@/lib/scheduling/placement').MemberPlacementSummary | null;
};

export type AvailableSlot = {
  startsAt: string;
  endsAt: string;
  label: string;
};

export type AbsenceScope = 'all' | 'wod' | 'class' | 'private';

export type MemberAbsence = {
  id: string;
  member_id: string;
  absence_date: string;
  scope: AbsenceScope;
  reason: string | null;
  created_at: string;
  updated_at: string;
};
