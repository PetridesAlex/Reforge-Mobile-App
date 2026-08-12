import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { AppState } from 'react-native';

import { useAuth } from '@/hooks/useAuth';
import { useSupabaseWorkouts } from '@/lib/workouts/config';
import { flushSetQueue } from '@/lib/training/offlineQueue';
import { storageGet, storageRemove, storageSet } from '@/lib/utils/storage';
import * as workoutsSupabase from '@/services/workouts.supabase';
import * as memberService from '@/services/member';
import type { WorkoutSession } from '@/types';

const ACTIVE_KEY = 'reforge.active_session.v1';

type ActiveWorkoutContextValue = {
  activeSession: WorkoutSession | null;
  activeSessionId: string | null;
  setActiveSession: (session: WorkoutSession | null) => Promise<void>;
  refreshActiveSession: () => Promise<void>;
  clearActiveSession: () => Promise<void>;
};

const ActiveWorkoutContext = createContext<ActiveWorkoutContextValue | null>(null);

export function ActiveWorkoutProvider({ children }: { children: ReactNode }) {
  const { profile } = useAuth();
  const [activeSession, setActiveSessionState] = useState<WorkoutSession | null>(null);

  const persist = useCallback(async (session: WorkoutSession | null) => {
    setActiveSessionState(session);
    if (session) {
      await storageSet(ACTIVE_KEY, JSON.stringify(session));
    } else {
      await storageRemove(ACTIVE_KEY);
    }
  }, []);

  const refreshActiveSession = useCallback(async () => {
    if (!profile) {
      await persist(null);
      return;
    }

    if (useSupabaseWorkouts()) {
      try {
        const session = await workoutsSupabase.findActiveSession(profile.id);
        await persist(session);
        return;
      } catch {
        // fall through to local
      }
    }

    const raw = await storageGet(ACTIVE_KEY);
    if (!raw) {
      await persist(null);
      return;
    }
    try {
      const local = JSON.parse(raw) as WorkoutSession;
      if (local.member_id === profile.id && local.status === 'active') {
        setActiveSessionState(local);
      } else {
        await persist(null);
      }
    } catch {
      await persist(null);
    }
  }, [profile, persist]);

  useEffect(() => {
    void refreshActiveSession();
  }, [refreshActiveSession]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        void refreshActiveSession();
        if (useSupabaseWorkouts()) {
          void flushSetQueue(async (item) => {
            await memberService.updateSet(item.setId, item.patch);
          });
        }
      }
    });
    return () => sub.remove();
  }, [refreshActiveSession]);

  const value = useMemo<ActiveWorkoutContextValue>(
    () => ({
      activeSession,
      activeSessionId: activeSession?.id ?? null,
      setActiveSession: persist,
      refreshActiveSession,
      clearActiveSession: async () => persist(null),
    }),
    [activeSession, persist, refreshActiveSession],
  );

  return (
    <ActiveWorkoutContext.Provider value={value}>{children}</ActiveWorkoutContext.Provider>
  );
}

export function useActiveWorkout(): ActiveWorkoutContextValue {
  const ctx = useContext(ActiveWorkoutContext);
  if (!ctx) {
    return {
      activeSession: null,
      activeSessionId: null,
      setActiveSession: async () => undefined,
      refreshActiveSession: async () => undefined,
      clearActiveSession: async () => undefined,
    };
  }
  return ctx;
}
