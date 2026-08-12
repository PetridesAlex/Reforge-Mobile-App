export type AthleteBuildArchetype = 'foundation' | 'grinder' | 'peak' | 'power' | 'hybrid';

export type PerformanceBuildInput = {
  weeklyWorkouts: number;
  monthlyWorkouts: number;
  weeklyGoal: number;
  streak: number;
  weightKg: number | null;
  bodyFatPct: number | null;
  onboardingComplete: boolean;
  profileCompletionPct: number;
};

export type AthleteBuildProfile = {
  archetype: AthleteBuildArchetype;
  archetypeLabel: string;
  tagline: string;
  readinessScore: number;
  weeklyPct: number;
  momentum: 'rising' | 'steady' | 'recover' | 'building';
  momentumLabel: string;
  focusAreas: string[];
  coachInsight: string;
};

const ARCHETYPE_COPY: Record<
  AthleteBuildArchetype,
  { label: string; tagline: string }
> = {
  foundation: {
    label: 'Foundation Build',
    tagline: 'Set your baseline to unlock live analytics',
  },
  grinder: {
    label: 'Consistency Build',
    tagline: 'Momentum is your edge — keep stacking sessions',
  },
  peak: {
    label: 'Peak Performer',
    tagline: 'Hitting weekly targets with room to push PRs',
  },
  power: {
    label: 'Strength Build',
    tagline: 'High output athlete — volume is trending up',
  },
  hybrid: {
    label: 'Hybrid Athlete',
    tagline: 'Balanced training across strength & conditioning',
  },
};

export function deriveAthleteBuildProfile(input: PerformanceBuildInput): AthleteBuildProfile {
  const weeklyGoal = Math.max(input.weeklyGoal, 1);
  const weeklyPct = Math.min(100, Math.round((input.weeklyWorkouts / weeklyGoal) * 100));

  let archetype: AthleteBuildArchetype = 'hybrid';
  if (!input.onboardingComplete || input.profileCompletionPct < 45) {
    archetype = 'foundation';
  } else if (weeklyPct >= 100) {
    archetype = 'peak';
  } else if (input.streak >= 5) {
    archetype = 'grinder';
  } else if (input.monthlyWorkouts >= 10 && input.weeklyWorkouts >= Math.ceil(weeklyGoal * 0.75)) {
    archetype = 'power';
  }

  const streakScore = Math.min(100, Math.round((input.streak / 7) * 100));
  const profileScore = input.profileCompletionPct;
  const metricsScore =
    input.weightKg != null ? 100 : input.bodyFatPct != null ? 60 : 0;
  const readinessScore = Math.round(
    weeklyPct * 0.4 + streakScore * 0.25 + profileScore * 0.2 + metricsScore * 0.15,
  );

  let momentum: AthleteBuildProfile['momentum'] = 'steady';
  if (!input.onboardingComplete) momentum = 'building';
  else if (weeklyPct >= 85 && input.streak >= 3) momentum = 'rising';
  else if (weeklyPct < 40 && input.streak === 0) momentum = 'recover';
  else momentum = 'steady';

  const momentumLabel =
    momentum === 'rising'
      ? 'Momentum rising'
      : momentum === 'recover'
        ? 'Rebuild week'
        : momentum === 'building'
          ? 'Profile building'
          : 'Steady output';

  const focusAreas: string[] = [];
  if (!input.onboardingComplete || input.profileCompletionPct < 80) {
    focusAreas.push('Complete profile');
  }
  if (input.weightKg == null) focusAreas.push('Log weight');
  if (input.bodyFatPct == null) focusAreas.push('Track body comp');
  if (weeklyPct < 100) focusAreas.push('Close weekly goal');
  if (input.streak >= 3) focusAreas.push(`${input.streak}-day streak`);
  if (input.monthlyWorkouts >= 8) focusAreas.push('Volume leader');
  if (focusAreas.length === 0) focusAreas.push('Maintain phase', 'Review PRs');

  let coachInsight = 'Athlete is on track — review program phase and recovery.';
  if (!input.onboardingComplete) {
    coachInsight = 'Profile incomplete — athlete should finish baseline setup for accurate analytics.';
  } else if (weeklyPct >= 100) {
    coachInsight = 'Weekly target hit — good window for progressive overload or skill work.';
  } else if (input.streak >= 5) {
    coachInsight = 'Strong consistency — consider adding a deload if fatigue shows up in sessions.';
  } else if (weeklyPct < 50) {
    coachInsight = 'Below weekly target — check attendance, recovery, or program fit.';
  } else if (input.bodyFatPct != null && input.weightKg != null) {
    coachInsight = 'Body metrics logged — use composition trends alongside session volume.';
  }

  const copy = ARCHETYPE_COPY[archetype];

  return {
    archetype,
    archetypeLabel: copy.label,
    tagline: copy.tagline,
    readinessScore,
    weeklyPct,
    momentum,
    momentumLabel,
    focusAreas: focusAreas.slice(0, 3),
    coachInsight,
  };
}
