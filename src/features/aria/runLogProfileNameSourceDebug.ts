import type { InterviewFirstNameProfile } from '@features/aria/interviewerFrameworkPrompt';
import type { ProfileNameSourceDebugDeps } from '@features/aria/referenceCardFromAssistantSpeechTypes';

export function runLogProfileNameSourceDebug(
  deps: ProfileNameSourceDebugDeps,
  trigger: { userId: string | undefined; profile: InterviewFirstNameProfile },
): void {
  if (!trigger.userId) return;
  const profile = trigger.profile;
  const resolvedFirstName = deps.getInterviewUserFirstNameForPrompt(profile);
  const rtd = deps.getSessionLogRuntime();
  deps.writeSessionLog({
    userId: trigger.userId,
    attemptId: rtd.attemptId,
    eventType: 'name_source_debug',
    eventData: {
      stage: 'profile_effect',
      has_profile: !!profile,
      has_basic_info_first_name: !!profile?.basicInfo?.firstName,
      has_profile_name: !!profile?.name,
      resolved_first_name_present: !!resolvedFirstName,
      resolved_first_name_length: resolvedFirstName.length,
    },
    platform: rtd.platform,
  });
}
