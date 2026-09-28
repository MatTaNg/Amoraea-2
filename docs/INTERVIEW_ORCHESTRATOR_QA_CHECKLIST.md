# Interview Orchestrator QA Checklist

Manual QA for **Phase 2** (meta/off-topic → Claude), **Phase 3** (construct satisfaction + skip duplicate canonical probes), **Phase 4** (live LLM turn planner), and post-Claude validator.

**Config:** `src/features/aria/interviewTurnOrchestratorConfig.ts` — all phases enabled by default.

---

## Phase 1 — Dynamic scenario boundary ack + transition

At **S1→S2**, **S2→S3**, and **S3→M4**, Amoraea may generate a brief acknowledgement + pivot via Claude before the **locked** next vignette or personal-card copy. On timeout or invalid output, static bundles in `interviewTransitionBundles.ts` are used unchanged.

| # | When | Pass if | Fail if |
|---|------|---------|---------|
| B1 | Finish S1, advance to S2 | Hears brief wrap referencing something you said (or static fallback) then **exact** Sarah/James vignette | Vignette paraphrased; duplicate wrap; hang > ~3s before speech |
| B2 | Finish S2, advance to S3 | Same pattern → **exact** Sophie/Daniel vignette | Same as B1 |
| B3 | Finish S3, advance to M4 | Personal pivot then **exact** grudge / hard-time question | M4 question paraphrased; S3 vignette replayed |

**Log tag:** `[SCENARIO_BOUNDARY_LLM_LIVE]` — `source: llm` vs `static`, `completedScenario`, `preview`.

**Disable:** `INTERVIEW_SCENARIO_BOUNDARY_LLM_ENABLED = false` in `interviewTurnOrchestratorConfig.ts`.

### Phase 2 — Post-Claude + stream-end paths

Dynamic leads also apply when:

- `[SCENARIO_COMPLETE:N]` is injected post-Claude (`runPostClaudeScenarioCompleteTokenGate`, `applyPostClaudeScenarioAdvanceOverridesAsync`)
- Coerced boundary handoffs in natural-language turns (`enrichScenarioBoundaryHandoffDisplayTextForSpeak`)
- Missed boundary lead at parallel stream end (`speakMissedScenarioBoundaryLeadAtStreamEnd`)
- S1/S2 repair-satisfied stream-end handoffs (`parallelStreamStreamEndTtsFlush`)

| # | When | Pass if | Fail if |
|---|------|---------|---------|
| B4 | Model emits `[SCENARIO_COMPLETE:1]` after S1 | Dynamic or static wrap, then exact S2 vignette via token gate | Static-only regression; duplicate wrap + vignette |
| B5 | Stream suppresses wrap; canonical card skipped | `[SCENARIO_BOUNDARY_LEAD_STREAM_END_SPEAK]` with dynamic preview | Silence before next vignette |
| B6 | S1 repair satisfied at stream end | `[S1_REPAIR_SATISFIED_HANDOFF_STREAM_END_SPEAK]` with personalized lead when LLM succeeds | Hang > ~3s; wrong vignette |

### Phase 3 — Prefetch + within-scenario acks + pre-Claude gates

- **Prefetch:** when repair/boundary satisfaction is detected pre-Claude, `[SCENARIO_BOUNDARY_LLM_PREFETCH]` fires; handoff should reuse cache (`cacheHit: true` in `[SCENARIO_BOUNDARY_LLM_LIVE]`).
- **Within-scenario ack:** orchestrator `speak_canonical` with `withBriefAck` → `[WITHIN_SCENARIO_ACK_LLM]` before verbatim probe.
- **Pre-Claude gates:** skip-accept handoff, S1 repair hard-stop, empty-transcript scenario advance — all use dynamic boundary leads.

| # | When | Pass if | Fail if |
|---|------|---------|---------|
| B7 | Answer S1 repair; next turn triggers handoff quickly | Prefetch log; handoff speaks without ~2.5s stall | Long silence before S2 vignette |
| B8 | Orchestrator delivers S1 contempt with brief ack | Grounded short ack + exact contempt probe | Random template ack only |
| B9 | Skip-accept scenario handoff (S1→S2) | Dynamic wrap + exact S2 vignette | Static-only skip bridge |

**Disable prefetch / within-scenario ack:** `INTERVIEW_SCENARIO_BOUNDARY_LLM_PREFETCH_ENABLED`, `INTERVIEW_WITHIN_SCENARIO_ACK_LLM_ENABLED` in `interviewTurnOrchestratorConfig.ts`.

---

## Setup

- [ ] Fresh interview attempt (avoid resuming mid-scenario when possible)
- [ ] Real mic / voice path (gates run on transcribed speech)
- [ ] DevTools console open — filter: `INTERVIEW_TURN_ORCHESTRATOR`, `CONSTRUCT_SATISFACTION`, `PHASE3_SKIP`

**Key log tags**

| Tag | Meaning |
|-----|---------|
| `[INTERVIEW_TURN_ORCHESTRATOR_SHADOW]` | Per-turn plan: `pendingProbeId`, `actionKind`, `decisionSource` |
| `[INTERVIEW_CONSTRUCT_SATISFACTION_LLM_LIVE]` | Live LLM vs heuristic (`agrees`, `llmSatisfied`) |
| `[PHASE3_SKIP_CLIENT_CANONICAL_*]` | Client skipped verbatim canonical probe |
| `[INTERVIEW_CONSTRUCT_SATISFACTION_LLM_SHADOW]` | Async shadow (may appear after turn) |
| `[ORCHESTRATOR_EXECUTE_*]` | Phase 5: fixed line / canonical / skip execution |
| `[INTERVIEW_TURN_ORCHESTRATOR_LLM_SHADOW]` | Phase 4 shadow (when live disabled): async planner agreement |
| `[INTERVIEW_COMPLETE_STRIPPED_PRE_M5_GATE]` | Premature `[INTERVIEW_COMPLETE]` stripped before M5 close allowed |

---

## Phase 5 — Orchestrator execution

Orchestrator decisions now **execute** before Claude when enabled:

| Action | Behavior |
|--------|----------|
| `speak_fixed_line` | Score / go-back decline via `runPreClaudeOrchestratorEarlyScoreGoBackGate` (before M4) |
| `speak_canonical` | Verbatim S1–S3, M4 threshold, M5 conflict (via inject) |
| `skip_probe_already_satisfied` | Skip duplicate client canonical → Claude bridges |
| `delegate_claude` | Continue to Claude with orchestrator suffix |

Log tags: `[ORCHESTRATOR_EXECUTE_FIXED_LINE]`, `[ORCHESTRATOR_EXECUTE_CANONICAL_*]`, `[ORCHESTRATOR_EXECUTE_SKIP_PROBE]`, `[ORCHESTRATOR_EXECUTE_M4_THRESHOLD]`

Post-Claude forced probes use shared delivery helpers: `deliverPostClaudeForcedCanonicalProbe` (S1–S3) and `deliverPostClaudeForcedMoment4ThresholdProbe` (M4). S3 repair retains streaming-reconcile logic in its gate.

---

## Phase 2 — Meta / off-topic → Claude

| # | When | Say | Pass if | Fail if |
|---|------|-----|---------|---------|
| A1 | S1 Q1 | *"Are you an alien?"* | Answers in character + **re-asks question core** same turn | Cut-off line (*"I wasn't able to understand that…"*) or silence |
| A2 | Any active Q | *"I don't understand the question"* | Clarifies + shortened re-ask | *"Want me to repeat the question?"* alone |
| A3 | Same beat | *"Can you say that again?"* | **Sure.** + verbatim question replay | Meta answer only, no replay |
| A4 | S1 follow-up | *"If I were Ryan, I would"* (trail off) | Cut-off recovery line (legacy) | Claude meta redirect |
| A5a | Any | *"What's my score?"* | Fixed decline, no score | Score leak or advance |
| A5b | Any | *"Can we go back to the first scenario?"* | Fixed decline | Goes back |

---

## Phase 3 — Construct satisfied → skip duplicate probe

### Scenario 1 (Emma / Ryan)

| # | When | Say (example) | Pass if | Fail if |
|---|------|---------------|---------|---------|
| B1 | S1 Q1 | *"Emma's tone was contemptuous — 'it's very clear' was pure disdain toward Ryan."* | **No** verbatim contempt probe; bridges forward | Contempt probe spoken again |
| B2 | S1 Q1 | *"She was talking down to him — like she didn't respect him at all."* (borderline) | Brief pause (~1–2.5s) OK; still no duplicate probe; log `llm_live` | Contempt probe after LLM pause |
| B3 | S1 Q1 | *"They seem tense."* (vague) | **Hear** canonical contempt probe | Probe skipped incorrectly |

**Canonical contempt probe (should only fire when B3-style):**  
*"What specific line from Emma shows contempt toward Ryan — for example, when she said 'it's very clear'?"*

### Scenario 2 (James / Sarah)

| # | When | Say (example) | Pass if | Fail if |
|---|------|---------------|---------|---------|
| B4 | S2 Q1 | *"James could have celebrated with her — Sarah needed to feel seen, not just logistics."* | **No** duplicate James-differently Q2 | Q2 spoken verbatim again |
| B5 | S2 Q1 | *"James was wrong."* (thin) | **Hear** James-differently Q2 | Q2 skipped |

**Canonical James-differently Q2:**  
*"What do you think James could have done differently to help Sarah feel appreciated?"*

---

## Meta — already answered

| # | When | Say | Pass if |
|---|------|-----|---------|
| C1 | After substantive answer | *"I already answered that"* | Ownership + advance **or** neutral re-ask/skip offer — **not** full vignette replay |

---

## 5-minute smoke (single pass)

- [ ] A1 — alien ask → answer + re-ask
- [ ] A3 — repeat request → Sure + replay
- [ ] B1 — rich S1 contempt → no duplicate probe
- [ ] B3 — vague S1 → contempt probe fires
- [ ] A5a — score ask → decline only

---

## Failure capture template

```
Scenario/moment:
User said:
Amoraea said:
Expected:
Logs: [INTERVIEW_TURN_ORCHESTRATOR_SHADOW] pendingProbeId= actionKind= decisionSource=
      [INTERVIEW_CONSTRUCT_SATISFACTION_LLM_LIVE] heuristicSatisfied= llmSatisfied= agrees=
```

---

## Bisect flags (edit `interviewTurnOrchestratorConfig.ts`)

| Flag | Set `false` to… |
|------|------------------|
| `INTERVIEW_TURN_ORCHESTRATOR_PHASE2_ENABLED` | Revert meta to canned lines + silence |
| `INTERVIEW_TURN_ORCHESTRATOR_PHASE3_ENABLED` | Always deliver client canonical probes |
| `INTERVIEW_TURN_ORCHESTRATOR_PHASE3_LLM_LIVE_ENABLED` | Heuristic-only skip (no 2.5s LLM wait) |
| `INTERVIEW_TURN_ORCHESTRATOR_PHASE4_LLM_LIVE_ENABLED` | Heuristic-only turn planner (no 2.5s LLM wait) |
| `INTERVIEW_TURN_ORCHESTRATOR_EXECUTE_DECISIONS_ENABLED` | Disable orchestrator execution (fixed lines + canonical delivery) |
| `INTERVIEW_TURN_ORCHESTRATOR_COLLAPSE_M4_M5_INJECT_GATES` | Re-enable legacy M4 threshold + M5 conflict inject gates |
| `INTERVIEW_TURN_ORCHESTRATOR_PHASE4_LLM_SHADOW_ENABLED` | Disable async full-turn LLM planner shadow |
