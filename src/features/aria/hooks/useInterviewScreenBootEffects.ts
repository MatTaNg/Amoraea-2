import { useEffect } from 'react';

import { checkMicPermission } from '@features/aria/interviewMicAndRecordingHelpers';
import { setInterviewTtsSessionEmail } from '@features/aria/utils/interviewTtsDevAccount';
import { setStorageFallbackListener } from '@utilities/storage/InterviewStorage';
import { setValidationTrackInterviewHandoffActive } from '@features/relationshipValidation/validationPostInterviewRouting';
import type { AriaScreenBootEffectsDeps } from '@features/aria/interviewClosingQuestionTypes';
import {
  runBumpAriaScreenMountGeneration,
  runLogAriaScreenDevEnvCheck,
  runLogAriaScreenMounted,
  runSyncValidationTrackInterviewHandoff,
} from '@features/aria/runInterviewScreenBootEffects';

export function useValidationTrackInterviewHandoff(fromValidationTrack: boolean): void {
  useEffect(() => {
    return runSyncValidationTrackInterviewHandoff(
      setValidationTrackInterviewHandoffActive,
      fromValidationTrack,
    );
  }, [fromValidationTrack]);
}

export function useAriaScreenDevEnvCheck(deps: {
  alphaMode: boolean;
  anthropicApiKey: string | undefined;
  anthropicProxyUrl: string | undefined;
  getResolvedSupabaseUrl: () => string | null | undefined;
}): void {
  useEffect(() => {
    runLogAriaScreenDevEnvCheck(deps);
  }, [deps.alphaMode, deps.anthropicApiKey, deps.anthropicProxyUrl, deps.getResolvedSupabaseUrl]);
}

export function useAriaScreenMountedLog(
  depsRef: React.MutableRefObject<Pick<AriaScreenBootEffectsDeps, 'remoteLog'>>,
  trigger: { userId: string | undefined; isAdmin: boolean },
): void {
  useEffect(() => {
    runLogAriaScreenMounted(depsRef.current, trigger);
  }, [depsRef, trigger.userId, trigger.isAdmin]);
}

export function useAriaScreenMountGenerationBump(
  bumpAriaScreenMountGeneration: AriaScreenBootEffectsDeps['bumpAriaScreenMountGeneration'],
): void {
  useEffect(() => {
    runBumpAriaScreenMountGeneration(bumpAriaScreenMountGeneration);
  }, [bumpAriaScreenMountGeneration]);
}

export function useStorageFallbackListener(setUsingMemoryFallback: (value: boolean) => void): void {
  useEffect(() => {
    setStorageFallbackListener(() => setUsingMemoryFallback(true));
    return () => setStorageFallbackListener(null);
  }, [setUsingMemoryFallback]);
}

export function useMicPermissionOnMount(
  setMicPermission: (value: 'granted' | 'denied' | 'prompt' | 'unavailable') => void,
): void {
  useEffect(() => {
    void checkMicPermission().then(setMicPermission);
  }, [setMicPermission]);
}

export function useInterviewTtsSessionEmail(userEmail: string | null | undefined): void {
  useEffect(() => {
    setInterviewTtsSessionEmail(userEmail);
    return () => setInterviewTtsSessionEmail(null);
  }, [userEmail]);
}

export function useAdminEmailFromSession(
  supabase: {
    auth: {
      getSession: () => Promise<{ data: { session: { user?: { email?: string | null } } | null } }>;
      onAuthStateChange: (
        callback: (
          event: string,
          session: { user?: { email?: string | null } } | null,
        ) => void,
      ) => { data: { subscription: { unsubscribe: () => void } } };
    };
  },
  setIsAdmin: (value: boolean) => void,
  setUserEmail: (value: string | null) => void,
  isAmoraeaAdminConsoleEmail: (email: string | null | undefined) => boolean,
): void {
  useEffect(() => {
    const applySessionEmail = (email: string | null | undefined) => {
      setIsAdmin(isAmoraeaAdminConsoleEmail(email));
      setUserEmail(email ?? null);
      setInterviewTtsSessionEmail(email);
    };

    void supabase.auth.getSession().then(({ data: { session } }) => {
      applySessionEmail(session?.user?.email ?? null);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      applySessionEmail(session?.user?.email ?? null);
    });

    return () => {
      subscription.unsubscribe();
      setInterviewTtsSessionEmail(null);
    };
  }, [supabase, setIsAdmin, setUserEmail, isAmoraeaAdminConsoleEmail]);
}
