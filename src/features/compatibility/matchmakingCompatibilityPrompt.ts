import {
  MATCHMAKING_SUBSCORE_WEIGHTS,
  type MatchmakingPairPayload,
} from './matchmakingPairPayload';

export const MATCHMAKING_COMPATIBILITY_SYSTEM_PROMPT = `You are Amoraea's pairwise compatibility analyst. Given two member snapshots (JSON), produce a structured compatibility assessment for event matchmaking.

## Hard filters (check first — if any apply, set eligible=false and list hardBlockReasons; still compute soft scores for ranking transparency when useful)

1. Either user has eligibleForMatching === false.
2. Either user lacks interview.passed === true (standard members must pass the AI interview gate).
3. Mutual dealbreaker conflicts on non-negotiables: kids (want vs don't want), religion (partner requires same faith and religions incompatible), substance use (user marks partner comfort "no" / dealbreaker and other user's use exceeds that), relationship structure (monogamy vs ENM/poly mismatch when either requires exclusivity), pets (dealbreaker vs has pets).
4. Either user has preInterviewPsychometrics.psychometricFloorBreaches with any active floor code (RFQ, GASP, Dweck, SCS-SF, SD3 narcissism).
5. Either user's interview.gateFailReasons includes a hard fail that indicates they did not pass (not merely review flags).

When hard-blocked, compatibilityScore should still be computed but capped at 25 unless both passed interview and only soft dealbreakers apply.

## Subscore rubric (each 0.0–1.0)

**attachment (35% weight)**
- Primary: postInterviewTypology.attachment (ECR anxiety/avoidance, style label).
- Secondary: interview pillars attunement, regulation, repair, mentalizing.
- Secure + secure → 0.85–1.0; secure + anxious/avoidant → 0.55–0.75; anxious + avoidant → 0.25–0.45; disorganised pairs → cap at 0.5 unless interview pillars are strong.
- Large gaps on regulation or repair pillars (>2 points) reduce attachment subscore by 0.1–0.2.

**values (30% weight)**
- Primary: postInterviewTypology.values Schwartz centered scores and composites (self_transcendence, self_enhancement, openness_to_change, conservation).
- Secondary: profile.lifeDomains sliders, politics/religion/spirituality alignment, life domain Q&A themes.
- Compute axis alignment: similar self_transcendence vs self_enhancement polarity and openness vs conservation → higher score.
- Material lifestyle conflicts (future living location, financial structure expectations) reduce values subscore.

**style (20% weight)**
- Use communicationStyle dimensions (0–1 each): emotional_analytical, narrative_conceptual, certainty_ambiguity, relational_individual, warmth.
- Style compatibility ≈ 1 minus weighted absolute differences (weights: certainty 0.25, emotional 0.20, narrative 0.20, warmth 0.20, relational 0.15).
- If overallConfidence is low (<0.4), treat style as 0.5 neutral for subscore but lower overall confidence.

**semantic (15% weight)**
- Narrative/lifestyle fit: bio, hobbies, archetypes (2 Jungian archetypes each), optional typologies (MBTI, Enneagram, etc.), dating pace, space for relationship, sex interests overlap.
- Reward concrete overlap; penalize vague or contradictory self-presentation vs interview signals.

**sexualCommunicationAdjustment (soft, not a weighted pillar)**
- If both sexualCommunicationMean present: diff ≤ 0.5 → +0.03; diff > 1.5 → −0.05; else 0.

## Final score formula (must match exactly)

weightedStyle = style × styleConfidence + 0.5 × (1 − styleConfidence)
where styleConfidence = average of both users' communicationStyle.overallConfidence, or 0.5 if missing.

compatibilityScoreNormalized = clamp(
  attachment × 0.35 + values × 0.30 + weightedStyle × 0.20 + semantic × 0.15 + sexualCommunicationAdjustment,
  0, 1
) × dealbreakerMultiplier

compatibilityScore = round(compatibilityScoreNormalized × 100)

dealbreakerMultiplier: 1.0 if no dealbreakers; 0.0 for hard blocks; 0.5–0.85 for serious but non-fatal friction (e.g. moderate lifestyle mismatch).

## Output rules

- Return ONLY valid JSON matching MatchmakingCompatibilityResult schema (schemaVersion: 1).
- strengths, risks, growthEdges: specific to THIS pair; cite concrete data fields; no generic therapy speak.
- narrativeSummary: 3–5 sentences, honest, event-matchmaker tone.
- confidence: lower when typology, interview, or communication style data is missing.
- Do not invent data not present in the payload; when missing, note uncertainty and use neutral 0.5 subscores where appropriate.
- Never mention internal schema field names in user-facing strings.`;

export type MatchmakingCompatibilityPrompt = {
  system: string;
  user: string;
};

export function buildMatchmakingCompatibilityPrompt(
  payload: MatchmakingPairPayload,
): MatchmakingCompatibilityPrompt {
  const weightsLine = Object.entries(MATCHMAKING_SUBSCORE_WEIGHTS)
    .map(([k, w]) => `${k}=${w}`)
    .join(', ');

  const user = [
    'Assess compatibility for the following pair.',
    '',
    `Subscore weights (reference): ${weightsLine}`,
    '',
    '```json',
    JSON.stringify(payload, null, 2),
    '```',
    '',
    'Respond with a single JSON object only (no markdown fences).',
  ].join('\n');

  return {
    system: MATCHMAKING_COMPATIBILITY_SYSTEM_PROMPT,
    user,
  };
}

/** Example minimal payload for tests and prompt iteration. */
export function buildMatchmakingPairPayloadExample(): MatchmakingPairPayload {
  return {
    schemaVersion: 1,
    userA: {
      userId: 'user-a-example',
      eligibleForMatching: true,
      interview: {
        passed: true,
        weightedScore: 6.8,
        modifiedWeightedScore: 6.5,
        egoDevelopmentLevel: 3,
        pillarScores: {
          mentalizing: 7,
          accountability: 6.5,
          contempt: 6,
          repair: 7,
          regulation: 6.5,
          attunement: 7,
          appreciation: 6,
          commitment_threshold: 6,
        },
      },
      postInterviewTypology: {
        assessmentsCompleted: true,
        sexualCommunicationMean: 4.2,
        attachment: { anxiety: 2.8, avoidance: 2.5, style: 'secure' },
        values: {
          self_transcendence: 0.4,
          self_enhancement: -0.1,
          openness_to_change: 0.3,
          conservation: 0.1,
        },
        conflictStyle: { collaborating: 8, compromising: 6, avoiding: 2 },
      },
      communicationStyle: {
        emotionalAnalytical: 0.6,
        narrativeConceptual: 0.55,
        certaintyAmbiguity: 0.5,
        relationalIndividual: 0.65,
        warmth: 0.7,
        overallConfidence: 0.8,
      },
      profile: {
        displayName: 'Alex',
        age: 32,
        relationshipStyle: 'monogamy',
        wantKids: 'Yes',
        bio: 'Values depth, hiking, and slow-burn connection.',
        archetypes: ['explorer', 'lover'],
      },
      preferences: {
        relationshipType: 'monogamy',
        kidsWanted: '2',
        futureLivingLocation: ['city', 'suburban'],
      },
    },
    userB: {
      userId: 'user-b-example',
      eligibleForMatching: true,
      interview: {
        passed: true,
        weightedScore: 7.1,
        modifiedWeightedScore: 7.0,
        pillarScores: {
          mentalizing: 7.5,
          accountability: 7,
          contempt: 6.5,
          repair: 7.2,
          regulation: 7,
          attunement: 7.5,
          appreciation: 7,
          commitment_threshold: 6.5,
        },
      },
      postInterviewTypology: {
        assessmentsCompleted: true,
        sexualCommunicationMean: 4.0,
        attachment: { anxiety: 3.2, avoidance: 2.2, style: 'secure' },
        values: {
          self_transcendence: 0.35,
          self_enhancement: 0,
          openness_to_change: 0.25,
          conservation: 0.15,
        },
        conflictStyle: { collaborating: 7, compromising: 7, accommodating: 5 },
      },
      communicationStyle: {
        emotionalAnalytical: 0.55,
        narrativeConceptual: 0.6,
        certaintyAmbiguity: 0.45,
        relationalIndividual: 0.6,
        warmth: 0.75,
        overallConfidence: 0.75,
      },
      profile: {
        displayName: 'Jordan',
        age: 30,
        relationshipStyle: 'monogamy',
        wantKids: 'Yes',
        bio: 'Creative professional; wants a partner who shows up in conflict.',
        archetypes: ['caregiver', 'creator'],
      },
      preferences: {
        relationshipType: 'monogamy',
        kidsWanted: '2',
        futureLivingLocation: ['city'],
      },
    },
    context: { eventName: 'Example cohort' },
  };
}
