import {
  applyMoment4UnassessableNullRules,
  moment4HasAssessableInnerStateContent,
  moment4InnerStateMarkersShouldBeNull,
  M4_UNASSESSABLE_INNER_STATE_EVIDENCE,
} from '../moment4UnassessableNullRules';

const GAMING_MISUNDERSTANDING_M4 =
  "I'm generally too nice and don't take offense to many things. So in my life, I've never really had anyone that has ever tried to get under my skin. But there was one time where this one guy who thought I had a crush on his girlfriend tried to get back to me, get back on me in a game and we just talked afterwards and figured out that it was just a misunderstanding and we parted ways amicably after that.";

const DREADING_PARTNER_THRESHOLD =
  'when I switch from looking forward to meeting my partner every day to dreading the next time that I would have to see them';

const SUBSTANTIVE_INNER_STATE_M4 =
  'My ex Sarah kept canceling on me and I felt hurt and wondered if she just did not care about my feelings. I realized I might have been too needy, but she also never explained why she bailed.';

describe('moment4HasAssessableInnerStateContent', () => {
  it('returns false for thin gaming-misunderstanding disclosure', () => {
    expect(moment4HasAssessableInnerStateContent(GAMING_MISUNDERSTANDING_M4)).toBe(false);
  });

  it('returns false for single internal threshold marker without relational depth', () => {
    expect(moment4HasAssessableInnerStateContent(DREADING_PARTNER_THRESHOLD)).toBe(false);
  });

  it('returns true when named person and emotional inner-state narrative are present', () => {
    expect(moment4HasAssessableInnerStateContent(SUBSTANTIVE_INNER_STATE_M4)).toBe(true);
  });
});

describe('moment4InnerStateMarkersShouldBeNull', () => {
  it('returns false for valid_non_applicable even without inner-state cues', () => {
    expect(
      moment4InnerStateMarkersShouldBeNull({
        response_concreteness: 'valid_non_applicable',
        userText: 'I do not hold grudges because I choose forgiveness and energy management.',
      }),
    ).toBe(false);
  });

  it('returns true for low concreteness thin gaming disclosure', () => {
    expect(
      moment4InnerStateMarkersShouldBeNull({
        response_concreteness: 'low',
        userText: GAMING_MISUNDERSTANDING_M4,
      }),
    ).toBe(true);
  });
});

describe('applyMoment4UnassessableNullRules', () => {
  it('nulls mentalizing and accountability for thin M4 disclosure instead of floor scores', () => {
    const pillarScores: Record<string, number | null> = {
      mentalizing: 4,
      accountability: 5,
      contempt_expression: 9,
      commitment_threshold: 6,
    };
    const keyEvidence: Record<string, string> = {
      mentalizing: 'moderate',
      accountability: 'moderate',
      contempt_expression: 'No ongoing bitterness.',
      commitment_threshold: 'Thin threshold.',
    };

    const changed = applyMoment4UnassessableNullRules({
      pillarScores,
      keyEvidence,
      pillarConfidence: { mentalizing: 'moderate', accountability: 'moderate' },
      response_concreteness: 'low',
      userText: GAMING_MISUNDERSTANDING_M4,
    });

    expect(changed).toBe(true);
    expect(pillarScores.mentalizing).toBeNull();
    expect(pillarScores.accountability).toBeNull();
    expect(pillarScores.contempt_expression).toBe(9);
    expect(pillarScores.commitment_threshold).toBe(6);
    expect(keyEvidence.mentalizing).toBe(M4_UNASSESSABLE_INNER_STATE_EVIDENCE);
    expect(keyEvidence.accountability).toBe(M4_UNASSESSABLE_INNER_STATE_EVIDENCE);
  });

  it('does not null substantive inner-state scores on moderate concreteness', () => {
    const pillarScores: Record<string, number | null> = {
      mentalizing: 7,
      accountability: 6,
    };
    const keyEvidence: Record<string, string> = {
      mentalizing: 'Perspective on Sarah.',
      accountability: 'Owns neediness.',
    };

    applyMoment4UnassessableNullRules({
      pillarScores,
      keyEvidence,
      response_concreteness: 'moderate',
      userText: SUBSTANTIVE_INNER_STATE_M4,
    });

    expect(pillarScores.mentalizing).toBe(7);
    expect(pillarScores.accountability).toBe(6);
  });
});
