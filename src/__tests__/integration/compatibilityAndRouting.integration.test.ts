/**
 * Integration: onboarding route selection + final compatibility score math
 * (no Supabase — uses pure modules only).
 */
import { getOnboardingInitialRoute } from '@app/navigation/onboardingInitialRoute';
import { computeFinalCompatibilityScore } from '@features/compatibility/styleCompatibilityScore';
import { evaluateGate1 } from '@features/onboarding/evaluateGate1';
import { INTERVIEW_MARKER_IDS } from '@features/aria/interviewMarkers';

const strongInterview = () =>
  Object.fromEntries(INTERVIEW_MARKER_IDS.map((id) => [id, 7])) as Record<string, number>;

describe('compatibility + routing pipeline', () => {
  it('Gate1 pass feeds into a bounded final compatibility score when pillars are strong', () => {
    const pillarScores = strongInterview();
    const gate1 = evaluateGate1({ pillarScores });
    expect(gate1.passed).toBe(true);
    const final = computeFinalCompatibilityScore({
      attachmentScore: 0.9,
      valuesScore: 0.9,
      semanticScore: 0.9,
      styleScore: 0.85,
      styleConfidence: 0.9,
      dealbreakerMultiplier: 1,
    });
    expect(final).toBeGreaterThan(0);
    expect(final).toBeLessThanOrEqual(1);
  });

  it('interview stage without framing ack stays on InterviewFraming', () => {
    expect(
      getOnboardingInitialRoute({ onboardingStage: 'interview' }, { hasAcknowledgedInterviewFraming: false })
    ).toBe('InterviewFraming');
  });
});
