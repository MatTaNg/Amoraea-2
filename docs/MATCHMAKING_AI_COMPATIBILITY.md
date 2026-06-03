# AI matchmaking compatibility — payload & prompt

Structured pairwise compatibility for event matchmaking: TypeScript types, JSON Schema, and an LLM prompt aligned with `computeFinalCompatibilityScore`.

## Files

| File | Purpose |
|------|---------|
| `src/features/compatibility/matchmakingPairPayload.ts` | TypeScript types for user snapshots and model output |
| `src/features/compatibility/matchmakingPairPayload.schema.json` | Input JSON Schema (pair payload) |
| `src/features/compatibility/matchmakingCompatibilityResult.schema.json` | Output JSON Schema (model response) |
| `src/features/compatibility/matchmakingCompatibilityPrompt.ts` | System prompt + `buildMatchmakingCompatibilityPrompt()` |

## Quick start

```typescript
import {
  buildMatchmakingCompatibilityPrompt,
  buildMatchmakingPairPayloadExample,
} from '@features/compatibility/matchmakingCompatibilityPrompt';
import type { MatchmakingPairPayload } from '@features/compatibility/matchmakingPairPayload';

const payload: MatchmakingPairPayload = {
  ...buildMatchmakingPairPayloadExample(),
  userA: { ...buildMatchmakingPairPayloadExample().userA, userId: realUserAId },
  userB: { ...buildMatchmakingPairPayloadExample().userB, userId: realUserBId },
};

const { system, user } = buildMatchmakingCompatibilityPrompt(payload);

// Send to your LLM (Anthropic, OpenAI, etc.) with JSON mode / structured output
// Validate response against matchmakingCompatibilityResult.schema.json
```

## Populating snapshots from Supabase

| Snapshot section | Primary sources |
|------------------|-----------------|
| `interview` | `interview_attempts` (latest passed): `pillar_scores`, `weighted_score`, `modified_weighted_score`, `scenario_composites`, `review_flags`, `gate_fail_reasons`, `defense_patterns` |
| `preInterviewPsychometrics` | `users.psychometrics_*` columns |
| `postInterviewTypology` | `user_assessments` + `test_results` for ECR, PVQ, conflict, sexual communication |
| `communicationStyle` | `communication_style_profiles` |
| `profile` | `profiles` / `profile_json`, onboarding draft |
| `preferences` | `compatibility.compatibility_data`, `matchPreferences` |

Set `eligibleForMatching: false` when `profiles.onboarding_completed` is false or latest interview did not pass.

## Scoring formula (must match code)

Subscores are **0–1**. Final normalized score:

```
weightedStyle = style × confidence + 0.5 × (1 − confidence)
score = (attachment×0.35 + values×0.30 + weightedStyle×0.20 + semantic×0.15 + sexualAdj) × dealbreakerMultiplier
display = round(score × 100)
```

Implemented in `src/features/compatibility/styleCompatibilityScore.ts`.

## Hard filters

The system prompt instructs the model to hard-block when:

- Interview not passed
- Psychometric auto-fail floors active
- Mutual dealbreakers on kids, religion, substances, relationship structure, pets

## Output shape

See `MatchmakingCompatibilityResult` in `matchmakingPairPayload.ts` or `matchmakingCompatibilityResult.schema.json`.

Required fields: `eligible`, `hardBlockReasons`, `compatibilityScore` (0–100), `compatibilityScoreNormalized`, `subscores`, `dealbreakerMultiplier`, `confidence`, `strengths`, `risks`, `growthEdges`, `narrativeSummary`.

## Hybrid approach (recommended)

1. **Deterministic layer:** compute `style` subscore via `computeStyleCompatibility`, sexual comm adjustment via `sexualCommunicationPairAdjustment`, dealbreaker multiplier from preference rules.
2. **LLM layer:** attachment, values, semantic subscores + narrative; pass deterministic values in the prompt as hints or overwrite after parse.
3. **Validate** model JSON against the result schema before persisting to `pair_compatibility` (or equivalent).

## Related docs

- Interview scoring: `docs/CLAUDE_INTERVIEW_SCORING_PIPELINE.md`
- Onboarding fields: `src/datingProfile/screens/onboarding/modals/onboardingStepOrder.ts`, `typologyOnboardingOptions.ts`
