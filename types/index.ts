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
  /** First-run app guide (Home, Workouts, Messages, etc.) */
  app_onboarding_complete?: boolean;
  share_activity?: boolean;
  /** Soft roster flag — false hides member from active studio lists */
  roster_active?: boolean;
  username?: string | null;
  community_bio?: string | null;
  /** Today's vibe — visible to other members while fresh */
  community_mood?: string | null;
  community_mood_updated_at?: string | null;
  community_visible?: boolean;
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
  target_weight_kg?: number | null;
  progression_increment_kg?: number | null;
  rep_range_min?: number | null;
  rep_range_max?: number | null;
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

export type WorkoutSessionState = {
  activeExerciseIndex?: number;
  restEndsAt?: string | null;
  restSeconds?: number;
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
  session_state?: WorkoutSessionState | null;
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
  rpe?: number | null;
  rir?: number | null;
  completed_at?: string | null;
  exercise_name?: string | null;
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
  | 'chat_invite'
  | 'training_reminder'
  | 'coach_feedback'
  | 'rest_complete'
  | 'class_reminder'
  | 'week_complete'
  | 'store_order_paid'
  | 'store_order_processing'
  | 'store_ready_pickup'
  | 'store_order_shipped'
  | 'store_order_delivered'
  | 'store_new_drop'
  | 'store_low_stock'
  | 'community_like'
  | 'community_comment'
  | 'general';

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
  latestPr?: {
    exerciseName: string;
    label: string;
  } | null;
  recentCoachMessage?: {
    title: string;
    body: string;
    threadId?: string | null;
  } | null;
  activeSessionId?: string | null;
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
  completionPct?: number;
  workoutName?: string | null;
  highlight?: {
    title: string;
    subtitle: string;
    kind: 'pr' | 'volume' | 'consistency';
  } | null;
};

export type PersonalRecordType = 'max_weight' | 'reps_at_weight' | 'estimated_1rm' | 'max_volume';

export type PersonalRecord = {
  id: string;
  member_id: string;
  exercise_id: string;
  record_type: PersonalRecordType;
  value: number;
  weight_kg: number | null;
  reps: number | null;
  session_id: string | null;
  set_id: string | null;
  previous_value: number | null;
  achieved_at: string;
  exercise_name?: string;
};

export type ReadinessCheckin = {
  id: string;
  member_id: string;
  session_id: string | null;
  energy: number;
  sleep_quality: number;
  soreness: number;
  motivation: number;
  score: number;
  created_at: string;
};

export type Achievement = {
  id: string;
  code: string;
  title: string;
  description: string;
  category: string;
  threshold: number | null;
};

export type MemberAchievement = {
  id: string;
  member_id: string;
  achievement_id: string;
  unlocked_at: string;
  achievement?: Achievement;
};

export type GymChallenge = {
  id: string;
  title: string;
  description: string | null;
  metric: 'workouts' | 'classes' | 'adherence';
  target: number;
  starts_on: string;
  ends_on: string;
  active: boolean;
  created_by: string;
};

export type ChallengeEnrollment = {
  id: string;
  challenge_id: string;
  member_id: string;
  progress: number;
  joined_at: string;
};

export type WorkoutFeedback = {
  id: string;
  coach_id: string;
  member_id: string;
  session_id: string;
  content: string;
  created_at: string;
  coach_name?: string;
  read?: boolean;
};

export type ActivityFeedEvent = {
  id: string;
  member_id: string;
  kind: 'pr' | 'milestone' | 'program_complete';
  title: string;
  body: string;
  visibility: 'gym' | 'private';
  created_at: string;
  member_name?: string;
  reaction_counts?: Record<string, number>;
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

// ---------------------------------------------------------------------------
// REFORGE Store
// ---------------------------------------------------------------------------

export type StoreProductStatus = 'draft' | 'active' | 'archived';

export type StoreInventoryReason =
  | 'restock'
  | 'adjustment'
  | 'order'
  | 'return'
  | 'correction';

export type StoreCategory = {
  id: string;
  slug: string;
  name: string;
  sort_order: number;
  active: boolean;
  created_at: string;
  updated_at: string;
};

export type StoreCollection = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  release_at: string | null;
  featured: boolean;
  active: boolean;
  created_at: string;
  updated_at: string;
};

export type StoreSizeGuide = {
  id: string;
  name: string;
  description: string | null;
  published: boolean;
  created_at: string;
  updated_at: string;
  rows?: StoreSizeGuideRow[];
};

export type StoreSizeGuideRow = {
  id: string;
  size_guide_id: string;
  size_label: string;
  chest_cm: number | null;
  length_cm: number | null;
  waist_cm: number | null;
  hip_cm: number | null;
  sort_order: number;
  created_at: string;
};

export type StoreProductImage = {
  id: string;
  product_id: string;
  storage_path: string;
  public_url: string;
  alt_text: string | null;
  sort_order: number;
  is_primary: boolean;
  created_at: string;
};

export type StoreProductVariant = {
  id: string;
  product_id: string;
  sku: string;
  size_label: string | null;
  color_label: string | null;
  color_hex: string | null;
  stock_qty: number;
  price_override_cents: number | null;
  image_url: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
};

export type StoreProduct = {
  id: string;
  slug: string;
  name: string;
  subtitle: string | null;
  description: string | null;
  category_id: string | null;
  collection_id: string | null;
  size_guide_id: string | null;
  status: StoreProductStatus;
  price_cents: number;
  compare_at_cents: number | null;
  currency: string;
  featured: boolean;
  is_new: boolean;
  is_limited: boolean;
  /** Merchandising flags (client/demo or future admin fields). */
  is_bestseller?: boolean;
  is_best_of_month?: boolean;
  details: string | null;
  materials: string | null;
  care_instructions: string | null;
  release_at: string | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
  category?: StoreCategory | null;
  collection?: StoreCollection | null;
  images?: StoreProductImage[];
  variants?: StoreProductVariant[];
  primary_image_url?: string | null;
  total_stock?: number;
};

export type StoreInventoryMovement = {
  id: string;
  variant_id: string;
  delta: number;
  reason: StoreInventoryReason;
  note: string | null;
  order_id: string | null;
  created_by: string | null;
  created_at: string;
};

export type StoreHomeHero = {
  kicker: string;
  title: string;
  headline: string;
  subtitle: string;
  cta: string;
};

export type StoreFulfillmentSettings = {
  pickup_label: string;
  pickup_location: string;
  standard_delivery_cents: number;
  currency: string;
};

export type StoreInventorySettings = {
  low_stock_threshold: number;
  show_exact_stock: boolean;
};

export type StoreDashboardStats = {
  activeProducts: number;
  draftProducts: number;
  archivedProducts: number;
  lowStockVariants: number;
  outOfStockVariants: number;
  totalUnits: number;
  openOrders: number;
  awaitingPaymentOrders: number;
  paidOrders: number;
  revenueCents: number;
};

/** Future payment provider contract — Stripe wires in Phase 5. Never put secrets in the client. */
export type StorePaymentProviderId = 'none' | 'mock' | 'stripe';

export type StorePaymentProvider = {
  readonly id: 'mock' | 'stripe';
  createCheckoutSession(input: {
    orderId: string;
    amountCents: number;
    currency: string;
  }): Promise<{ clientSecret?: string; checkoutUrl?: string; mockComplete?: boolean }>;
};

export type StoreFulfillmentMethod = 'delivery' | 'pickup';

export type StoreOrderStatus =
  | 'pending'
  | 'awaiting_payment'
  | 'paid'
  | 'processing'
  | 'ready_for_pickup'
  | 'shipped'
  | 'delivered'
  | 'cancelled'
  | 'refunded';

export type StorePaymentStatus = 'unpaid' | 'pending' | 'paid' | 'failed' | 'refunded';

export type StoreCartLine = {
  id: string;
  product_id: string;
  variant_id: string;
  product_name: string;
  size_label: string | null;
  color_label: string | null;
  sku: string | null;
  unit_price_cents: number;
  quantity: number;
  image_url: string | null;
};

export type StoreCartValidationIssue = {
  variant_id: string;
  code: string;
  message: string;
  previous_cents?: number;
  current_cents?: number;
  available?: number;
};

export type StoreOrderItem = {
  id: string;
  order_id: string;
  product_id: string | null;
  variant_id: string | null;
  product_name: string;
  sku: string | null;
  size_label: string | null;
  color_label: string | null;
  unit_price_cents: number;
  quantity: number;
  line_total_cents: number;
  created_at: string;
};

export type StoreOrderEvent = {
  id: string;
  order_id: string;
  status: string;
  note: string | null;
  created_by: string | null;
  created_at: string;
};

export type StoreOrder = {
  id: string;
  order_number: string;
  user_id: string;
  status: StoreOrderStatus;
  fulfillment_method: StoreFulfillmentMethod;
  currency: string;
  subtotal_cents: number;
  delivery_cents: number;
  discount_cents: number;
  total_cents: number;
  discount_code: string | null;
  contact_email: string;
  contact_phone: string | null;
  shipping_first_name: string | null;
  shipping_last_name: string | null;
  shipping_line1: string | null;
  shipping_line2: string | null;
  shipping_city: string | null;
  shipping_postal_code: string | null;
  shipping_country: string | null;
  pickup_location: string | null;
  payment_provider: StorePaymentProviderId;
  payment_status: StorePaymentStatus;
  paid_at: string | null;
  internal_notes: string | null;
  created_at: string;
  updated_at: string;
  items?: StoreOrderItem[];
  events?: StoreOrderEvent[];
  customer_name?: string;
};

export type StoreAddress = {
  id: string;
  user_id: string;
  label: string | null;
  first_name: string;
  last_name: string;
  line1: string;
  line2: string | null;
  city: string;
  postal_code: string;
  country: string;
  phone: string | null;
  is_default: boolean;
  created_at: string;
  updated_at: string;
};

export type StoreDiscountKind = 'percent' | 'fixed' | 'free_delivery';

export type StoreDiscount = {
  id: string;
  code: string;
  kind: StoreDiscountKind;
  value_bps: number | null;
  value_cents: number | null;
  min_subtotal_cents: number;
  member_only: boolean;
  active: boolean;
};

/** REFORGE Community Phase 1 */
export type CommunityPostVisibility = 'community' | 'private';
export type CommunityPostType =
  | 'status'
  | 'media'
  | 'workout'
  | 'pr'
  | 'achievement'
  | 'announcement';
export type CommunityMediaType = 'image' | 'video';

export type CommunityPostMedia = {
  id: string;
  post_id: string;
  storage_path: string;
  public_url: string | null;
  media_type: CommunityMediaType;
  width: number | null;
  height: number | null;
  duration_seconds: number | null;
  sort_order: number;
  created_at: string;
};

export type CommunityPost = {
  id: string;
  author_id: string;
  author_name: string;
  author_username: string | null;
  author_avatar_url: string | null;
  author_role: UserRole;
  body: string;
  visibility: CommunityPostVisibility;
  post_type: CommunityPostType;
  like_count: number;
  comment_count: number;
  is_pinned: boolean;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  media?: CommunityPostMedia[];
  liked_by_me?: boolean;
  saved_by_me?: boolean;
};

export type CommunityComment = {
  id: string;
  post_id: string;
  author_id: string;
  author_name: string;
  author_username: string | null;
  author_avatar_url: string | null;
  author_role: UserRole;
  parent_comment_id: string | null;
  body: string;
  like_count: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  liked_by_me?: boolean;
  replies?: CommunityComment[];
};

export type CommunityProfilePublic = {
  id: string;
  full_name: string;
  username: string | null;
  avatar_url: string | null;
  role: UserRole;
  community_bio: string | null;
  community_mood: string | null;
  community_mood_updated_at: string | null;
  created_at: string;
};

export type CommunityFeedCursor = {
  created_at: string;
  id: string;
};

export type CommunityFeedPage = {
  posts: CommunityPost[];
  nextCursor: CommunityFeedCursor | null;
};


