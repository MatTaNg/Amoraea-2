import type { AriaInterviewScreenParams } from '@features/aria/ariaInterviewScreenTypes';

export type AriaInterviewScreenRoutePreamble = {
  userId: string;
  fromValidationTrack: boolean;
};

/** Resolve interview user id and validation-track handoff flag from route + auth. */
export function resolveAriaInterviewScreenRoutePreamble(
  route: { params?: AriaInterviewScreenParams },
  authUserId?: string,
): AriaInterviewScreenRoutePreamble {
  const params = route.params;
  return {
    userId: params?.userId ?? authUserId ?? '',
    fromValidationTrack: params?.fromValidationTrack === true,
  };
}
