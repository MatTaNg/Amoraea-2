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

## Scoring formula (must match production V3)

Production ranking is `computePairCompatibilityScore` → `computeFinalCompatibilityScoreV3`.

Active core weights (sum exactly **1.00**):

| Component | Weight | Measures |
|-----------|--------|----------|
| `concreteLifeFit` | **0.50** | Pairwise desired-life fit from existing profile/onboarding fields |
| `finance` | **0.22** | Structured pooling / risk / income only |
| `lifeDomainImportanceAlignment` | **0.21** | Four abstract 0–100 importance sliders (intimacy, spirituality, family, physical health) |
| generic PVQ similarity | **0.05** | Contextual values-vector similarity, not life goals |
| generic ECR similarity | **0.02** | Contextual attachment-vector similarity |

Hard filters (`eligible = false`) stay outside the core: children want vs don’t, required religion/politics mismatch, relationship structure mismatch, distance with no relocate, substance “no”, hobby dealbreaker, non-negotiable partner-alignment mismatches.

Soft adjustments (not core weights): anxious×avoidant cap **−0.05**, conflict-style, psychometric soft flags. Flexible preference mismatches are scored inside `concreteLifeFit`, not stacked again as a second penalty.

**Unavailable in ranking:** Narrative/semantic fit (LLM job not wired; the old 0.5 stub is not used). Intimacy as a complete domain (not rebuilt from sexual-communication similarity).

Historical V2 `computeFinalCompatibilityScore` may still apply `sexualCommAdjustment` for reproducibility only. V3 ignores it.

Implemented in `src/features/compatibility/computePairCompatibilityScore.ts` and `computeCompatibilityScore.ts`.

The older style-blend helper in `styleCompatibilityScore.ts` (`attachment×0.35 + values×0.30 + style×0.20 + semantic×0.15`) is **not** production ranking.

## Hard filters

The system prompt instructs the model to hard-block when:

- Interview not passed
- Psychometric auto-fail floors active
- Mutual dealbreakers on kids, religion, substances, relationship structure, pets

## Output shape

See `MatchmakingCompatibilityResult` in `matchmakingPairPayload.ts` or `matchmakingCompatibilityResult.schema.json`.

Required fields: `eligible`, `hardBlockReasons`, `compatibilityScore` (0–100), `compatibilityScoreNormalized`, `subscores`, `dealbreakerMultiplier`, `confidence`, `strengths`, `risks`, `growthEdges`, `narrativeSummary`.

## Hybrid approach (recommended)

1. **Deterministic layer:** compute production V3 via `computePairCompatibilityScore` (hard filters, concrete life fit, finance, slider alignment, low-weight PVQ/ECR, soft adjustments). Do not apply sexual-communication pair similarity.
2. **LLM layer (optional, not currently in ranking):** narrative fit is schema-ready but `not_assessed` until a pair-specific job is wired. Do not backfill with a constant 0.5.
3. **Validate** model JSON against the result schema before persisting to `pair_compatibility` (or equivalent).

## Related docs

- Interview scoring: `docs/CLAUDE_INTERVIEW_SCORING_PIPELINE.md`
- Onboarding fields: `src/datingProfile/screens/onboarding/modals/onboardingStepOrder.ts`, `typologyOnboardingOptions.ts`
