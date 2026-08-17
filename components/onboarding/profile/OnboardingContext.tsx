import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { useAuth } from '@/hooks/useAuth';
import type { OnboardingDraft } from '@/lib/onboarding/types';
import * as memberOnboarding from '@/services/memberOnboarding';
import type { Profile } from '@/types';

type OnboardingContextValue = {
  ready: boolean;
  draft: OnboardingDraft;
  patchDraft: (partial: OnboardingDraft) => void;
  saveStep: (step: number, partial?: OnboardingDraft) => Promise<Profile>;
  complete: () => Promise<Profile>;
  saving: boolean;
  error: string | null;
  setError: (msg: string | null) => void;
};

const OnboardingContext = createContext<OnboardingContextValue | null>(null);

export function OnboardingProvider({
  profileId,
  children,
}: {
  profileId: string;
  children: ReactNode;
}) {
  const { refreshProfile } = useAuth();
  const [ready, setReady] = useState(false);
  const [draft, setDraft] = useState<OnboardingDraft>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const state = await memberOnboarding.getOnboardingState(profileId);
        if (!mounted) return;
        const p = state.profile;
        setDraft({
          first_name: p.first_name ?? null,
          last_name: p.last_name ?? null,
          username: p.username ?? null,
          date_of_birth: p.date_of_birth ?? null,
          gender: p.gender ?? null,
          avatar_url: p.avatar_url ?? null,
          height_cm: state.height_cm,
          weight_kg: state.weight_kg,
          primary_goal: p.primary_goal ?? null,
          training_level: p.training_level ?? null,
          training_days_per_week: p.training_days_per_week ?? null,
          training_interests: p.training_interests ?? [],
          preferred_workout_time: p.preferred_workout_time ?? null,
          preferred_workout_duration: p.preferred_workout_duration ?? null,
          motivation_type: p.motivation_type ?? null,
        });
      } catch (e) {
        if (mounted) {
          setError(e instanceof Error ? e.message : 'Failed to load onboarding');
        }
      } finally {
        if (mounted) setReady(true);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [profileId]);

  const patchDraft = useCallback((partial: OnboardingDraft) => {
    setDraft((prev) => ({ ...prev, ...partial }));
  }, []);

  const saveStep = useCallback(
    async (step: number, partial: OnboardingDraft = {}) => {
      setSaving(true);
      setError(null);
      const merged = { ...draft, ...partial };
      setDraft(merged);
      try {
        const profile = await memberOnboarding.saveOnboardingStep(profileId, step, merged);
        await refreshProfile();
        return profile;
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Could not save progress';
        setError(msg);
        throw e;
      } finally {
        setSaving(false);
      }
    },
    [draft, profileId, refreshProfile],
  );

  const complete = useCallback(async () => {
    setSaving(true);
    setError(null);
    try {
      const profile = await memberOnboarding.completeOnboarding(profileId, draft);
      await refreshProfile();
      return profile;
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Could not finish onboarding';
      setError(msg);
      throw e;
    } finally {
      setSaving(false);
    }
  }, [draft, profileId, refreshProfile]);

  const value = useMemo(
    () => ({
      ready,
      draft,
      patchDraft,
      saveStep,
      complete,
      saving,
      error,
      setError,
    }),
    [ready, draft, patchDraft, saveStep, complete, saving, error],
  );

  return <OnboardingContext.Provider value={value}>{children}</OnboardingContext.Provider>;
}

export function useOnboarding() {
  const ctx = useContext(OnboardingContext);
  if (!ctx) throw new Error('useOnboarding must be used within OnboardingProvider');
  return ctx;
}
