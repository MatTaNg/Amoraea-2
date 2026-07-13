# Claude / Cursor context: interview scoring & Amoraea pipeline

Use this document as **attachable context** when asking Claude (or Cursor Agent) to reason about pillar scoring, interview flow, `interview_attempts`, or scoring prompts. It maps the repo; it does not duplicate full prompt text (those live in the cited files).

---

## 1. Pillar scores from transcript turns

### Client (live `AriaScreen` interview)

| Concern | Location |
|--------|----------|
| **Per-scenario scoring (1–3)** | `src/app/screens/AriaScreen.tsx` — `scoreScenario` (~6977+): POST Anthropic `v1/messages`, user message = `buildScenarioScoringPrompt(...)`. Parses `pillarScores` / `keyEvidence`, then heuristics (normalize, contempt heuristic, elaboration penalties, frustration skips, numeric fallbacks). |
| **Scenario prompt text** | Same file — `buildScenarioScoringPrompt` (**~3580**). Large inline prompt; not extracted to `src/features/Amoraea`. |
| **End-of-interview scoring** | Same file — `scoreInterview` (**~13475+**): Moment 4 / Moment 5 Claude calls, aggregation, gate, persistence, optional edge delegate `complete-standard-interview`. |

### Prompt modules (Moments 4–5 & holistic)

| Export | File |
|--------|------|
| `buildPersonalMomentScoringPrompt` | `src/features/Amoraea/personalMomentScoringPrompt.ts` |
| `buildMoment5AccountabilityScoringPrompt` | `src/features/Amoraea/moment5AccountabilityScoringPrompt.ts` |
| `buildScoringPrompt` (full transcript, eight markers) | `src/features/Amoraea/holisticScoringPrompt.ts` |

### Aggregation & gate (TypeScript)

| Concern | Location |
|--------|----------|
| Merge slices → holistic-style pillar map | `src/features/Amoraea/aggregateMarkerScoresFromSlices.ts` — `aggregatePillarScoresWithCommitmentMergeDetailed`, etc. |
| Pass/fail & floors | `src/features/Amoraea/computeGateResultCore.ts` |
| Shared calibration snippets | `src/features/Amoraea/interviewScoringCalibration.ts` (pulled into holistic prompt) |

### Server (deferred standard interview completion)

| Concern | Location |
|--------|----------|
| Load attempt → holistic Claude → gate → DB + AI reasoning | `supabase/functions/_shared/completeStandardInterviewCore.ts` — `runCompleteStandardInterview` |
| Holistic user prompt | `buildScoringPrompt(transcript, typology)` — **~250** in that file; implementation: `supabase/functions/_shared/holisticScoringPrompt.ts` (**keep in sync** with `src/features/Amoraea/holisticScoringPrompt.ts`) |
| Gate (Deno duplicate of app logic) | `supabase/functions/_shared/computeGateResultCore.ts` |

### Related edge functions (not the main per-marker scorecard)

- `supabase/functions/analyze-interview-text/index.ts` — text/style features, not pillar JSON scorecards.
- `supabase/functions/analyze-interview-audio/index.ts` — audio pipeline / persistence; admin can invoke.

---

## 2. Interview flow: Amoraea responses & probe logic

| Concern | Location |
|--------|----------|
| **Main screen** (streaming LLM, TTS, transitions, scoring hooks) | `src/app/screens/AriaScreen.tsx` — streaming ~9610+, `complete-standard-interview` invoke ~13879+, `scoreInterview` / `scoreScenario` as above |
| **Interviewer system instructions** (moments, probes, check-before-asking) | `src/features/Amoraea/interviewerFrameworkPrompt.ts` — `INTERVIEWER_SYSTEM_FRAMEWORK` |
| **Transcript-level probe / skip helpers** | `src/features/Amoraea/probeAndScoringUtils.ts` |
| **Disengagement probes** | `src/features/Amoraea/interviewDisengagementProbes.ts` |
| **Audio / TTS helpers** | `src/features/Amoraea/hooks/useAudioRecorder.ts`, `src/features/Amoraea/utils/elevenLabsTts.ts`, `src/features/Amoraea/utils/webInterviewMicPreInit.ts` |

---

## 3. `interview_attempts` schema (Supabase)

**Canonical CREATE TABLE** (base columns):

- `supabase/migrations/20260228120000_interview_attempts_alpha.sql`  
  Includes: `id`, `user_id`, `attempt_number`, `created_at`, `completed_at`, `weighted_score`, `passed`, `pillar_scores`, `scenario_1_scores` … `scenario_3_scores`, `transcript`, `response_timings`, `probe_log`, `ai_reasoning`, review/feedback columns, etc.

**Important follow-on migrations** (grep `interview_attempts` under `supabase/migrations/` for the full set). Examples:

- `20260430120000_interview_attempts_scoring_deferred.sql` — `scoring_deferred`, `interview_typology_context`
- `20260430210000_interview_attempts_scenario_composite_floor.sql` — `scenario_composites`, floor review flags
- `20260430220000_interview_attempts_gate_fail_multi.sql` — `gate_fail_reasons`, `gate_fail_detail`, grandfather review
- `20260506120000_interview_attempts_skip_penalties.sql` — skip counts / penalties / auto-fail
- `20260618120000_interview_attempts_switch_log.sql` — `switch_log`
- RLS / admin policies: e.g. `20260423140000_interview_attempts_rls_admin_and_own.sql`, `20260430220000_interview_attempts_override_reveal.sql`

For an authoritative current schema in a deployed project, use `supabase db dump` or the Supabase dashboard after migrations.

---

## 4. Scoring prompt text → Claude API

| Call site | Prompt builder | Notes |
|-----------|------------------|-------|
| `AriaScreen` `scoreScenario` | `buildScenarioScoringPrompt` in **AriaScreen.tsx** | User message only; model `CLAUDE_SONNET_MODEL` (`claude-sonnet-4-6`) |
| `AriaScreen` `scoreInterview` (Moments 4/5) | `buildPersonalMomentScoringPrompt`, `buildMoment5AccountabilityScoringPrompt` | Imports from `src/features/Amoraea/` |
| Edge `runCompleteStandardInterview` | `buildScoringPrompt` in **`supabase/functions/_shared/holisticScoringPrompt.ts`** | Full-transcript holistic JSON; same ideas as `src/features/Amoraea/holisticScoringPrompt.ts` |
| Narrative after scores (not pillar numbers) | `supabase/functions/_shared/generateAIReasoning.ts` | Parallel: `src/features/Amoraea/generateAIReasoning.ts` |

---

## 5. Cursor / Claude “starter prompt” (copy-paste)

You can paste the block below into a new Cursor chat and **@**-mention files as needed.

```text
You are working in the Amoraea repo. Ground truth:

PILLAR SCORING
- Live per-scenario Claude scoring and prompt: src/app/screens/AriaScreen.tsx (buildScenarioScoringPrompt ~3580, scoreScenario ~6977+).
- End-of-interview scoring: same file scoreInterview ~13475+; uses buildPersonalMomentScoringPrompt, buildMoment5AccountabilityScoringPrompt, aggregatePillarScoresWithCommitmentMergeDetailed, computeGateResultCore.
- Prompt modules: src/features/Amoraea/personalMomentScoringPrompt.ts, moment5AccountabilityScoringPrompt.ts, holisticScoringPrompt.ts.
- Server holistic completion: supabase/functions/_shared/completeStandardInterviewCore.ts + holisticScoringPrompt.ts (mirror src/features/Amoraea/holisticScoringPrompt.ts).

INTERVIEW / Amoraea
- UI + stream: src/app/screens/AriaScreen.tsx.
- System instructions: src/features/Amoraea/interviewerFrameworkPrompt.ts.
- Probe helpers: src/features/Amoraea/probeAndScoringUtils.ts, interviewDisengagementProbes.ts.

DATABASE
- interview_attempts: start at supabase/migrations/20260228120000_interview_attempts_alpha.sql; many ALTERs add columns — grep interview_attempts in supabase/migrations.

When suggesting code changes, prefer minimal diffs and keep Deno _shared copies in sync with src/features/Amoraea where duplicated.
```

---

## 6. Maintenance note

If you edit **`src/features/Amoraea/holisticScoringPrompt.ts`**, check whether **`supabase/functions/_shared/holisticScoringPrompt.ts`** must match for edge behavior. Same idea for **`computeGateResultCore`** (`src/features/Amoraea` vs `supabase/functions/_shared`).
