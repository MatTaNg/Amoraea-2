import { useRef } from 'react';
import type { ReactElement } from 'react';

import { useAuth } from '@features/authentication/hooks/useAuth';
import { buildAriaInterviewScreenInterviewSessionBindings } from '@features/aria/ariaInterviewScreenInterviewSessionBindings';
import * as preamble from '@features/aria/ariaInterviewScreenPreambleBindings';
import { buildAriaInterviewScreenSessionStateParamsFromScreen } from '@features/aria/buildAriaInterviewScreenSessionStateParamsFromScreen';
import { useAriaInterviewSession } from '@features/aria/hooks/useAriaInterviewSession';
import { useAriaInterviewScreenSessionState } from '@features/aria/hooks/useAriaInterviewScreenSessionState';
import { useAriaInterviewScreenWiring } from '@features/aria/hooks/useAriaInterviewScreenWiring';
import { useValidationTrackInterviewHandoff } from '@features/aria/hooks/useInterviewScreenBootEffects';
import { resolveAriaInterviewScreenRoutePreamble } from '@features/aria/resolveAriaInterviewScreenRoutePreamble';
import type { AriaInterviewScreenSetupInput } from '@features/aria/ariaInterviewScreenTypes';
import { renderAriaInterviewScreen } from '@features/aria/renderAriaInterviewScreen';
import type { AriaInterviewScreenRenderScope } from '@features/aria/renderAriaInterviewScreen';

export type UseAriaInterviewScreenSetupParams = AriaInterviewScreenSetupInput;

/** Session setup + dep-sync wiring + render scope assembly for AriaScreen. */
export function useAriaInterviewScreenSetup(
  params: UseAriaInterviewScreenSetupParams,
): AriaInterviewScreenRenderScope {
  const { navigation, route } = params;
  const { user, signOut } = useAuth();
  const { userId, fromValidationTrack } = resolveAriaInterviewScreenRoutePreamble(route, user?.id);
  useValidationTrackInterviewHandoff(fromValidationTrack);
  const userIdRef = useRef(userId);
  userIdRef.current = userId;
  const interview = useAriaInterviewSession(userId, { whisperProxyUrl: preamble.OPENAI_WHISPER_PROXY_URL });
  const interviewBindings = buildAriaInterviewScreenInterviewSessionBindings(interview);
  const session = useAriaInterviewScreenSessionState(
    buildAriaInterviewScreenSessionStateParamsFromScreen({
      userId,
      routeName: route?.name,
      fromValidationTrack,
      interview,
    }),
  );

  return useAriaInterviewScreenWiring({
    navigation,
    route,
    user,
    signOut,
    userId,
    userIdRef,
    fromValidationTrack,
    interview,
    interviewBindings,
    session,
  });
}

/** Session setup + wiring + `renderAriaInterviewScreen` element for AriaScreen. */
export function useAriaInterviewScreenElement(
  params: UseAriaInterviewScreenSetupParams,
): ReactElement {
  return renderAriaInterviewScreen(useAriaInterviewScreenSetup(params));
}
