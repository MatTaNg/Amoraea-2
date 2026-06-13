import { enableInterviewRetake } from '@features/interview/interviewRetake';

/** Signup invite code that unlocks post-interview retake for QA (scores stay on the server). */
export const QA_RETAKE_SIGNUP_CODE = 'ABC-QA';

export function isQaRetakeSignupCode(raw: string | null | undefined): boolean {
  if (raw == null || typeof raw !== 'string') return false;
  return raw.trim().toUpperCase() === QA_RETAKE_SIGNUP_CODE.toUpperCase();
}

/** @deprecated Use {@link enableInterviewRetake} */
export async function resetInterviewForQaRetake(userId: string): Promise<void> {
  await enableInterviewRetake(userId);
}
