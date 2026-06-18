S2 CONSTRUCT UNIQUENESS AUDIT
================================

Does S2 uniquely score appreciation: **YES**

Evidence:
- `scenarioScoringPrompt.ts` — Scenario B marker list: `appreciation, attunement, mentalizing, repair, accountability, contempt_expression`. Scenario A adds `contempt_recognition` but **no appreciation**. Scenario C adds `regulation` but **no appreciation**.
- `aggregateMarkerScoresFromSlices.ts` — `appreciation: new Set(['scenario_2'])` (holistic rollup uses S2 only).
- `interviewerFrameworkPrompt.ts` — "Appreciation is assessed from Scenario B only." Scenario B primary targets: "Appreciation, Attunement, Mentalizing, Repair."

**Implication:** Isolated S2 floor breaches may be partly driven by a pillar (appreciation) that has **no other scenario-level contributor**. A weak S2 appreciation score enters the S2 composite mean with no dilution from S1/S3. Holistic `appreciation` is a single data point. Low S2 composites are structurally more likely when appreciation/attunement miss together, even if mentalizing/repair look fine elsewhere.

---

Does S2 require inference of an unstated need vs S1/S3's explicit verbal/behavioral cues: **YES**

**Scenario A (Emma/Ryan)** — `interviewerFrameworkPrompt.ts`:
- Vignette gives Emma's stated hurt: "I just think you always put your family first before us."
- Explicit contempt cue: Emma says **"I know, you've made that very clear."**
- Mandatory contempt probe if user missed register: *"What about when Emma says 'you've made that very clear' — what do you make of that?"*
- Primary targets: mentalizing, accountability, **contempt recognition** (reading a line that is quoted in the vignette).

**Scenario C (Sophie/Daniel)** — `interviewerFrameworkPrompt.ts`:
- Explicit behavioral arc: Daniel leaves, returns, says **"I didn't know what to say."**
- Q1 is anchored on that exact line: *"When Daniel comes back and says 'I didn't know what to say' — what do you make of that?"*
- Primary targets: regulation, repair, mentalizing, attunement.

**Scenario B (Sarah/James)** — `interviewerFrameworkPrompt.ts` + `SCENARIO_B_ATTUNEMENT_APPRECIATION_ANCHORS`:
- Sarah's complaint ("never feels appreciated") is stated, but the **failure mode is not named** — user must infer James led with **logistics** and **redirected tears** ("hey don't cry, this is a good thing") as attunement/appreciation misses.
- Scoring anchors: *"Does the participant recognize that James redirecting Sarah's tears… is a failure to receive her emotional response"* and *"James led with logistics… rather than emotional presence first?"*
- No equivalent mandatory probe that quotes a single diagnostic line; Q2 asks what James could have done differently (construct is named only after Q1).

**Implication:** S2 tests **unstated-need inference** (celebration vs logistics; witnessing vs fixing tears) that S1/S3 do not structurally duplicate. S1 tests reading an **explicit** contempt/hurt line; S3 tests inference about an **explicitly quoted** Daniel statement. A low S2 score can be **valid unique signal**, not mere noise — but it is also a **harder** task by design.

---

S2 rubric calibration language vs S1/S3: **Somewhat more construct-specific / demanding on attunement-appreciation; globally similar floors**

**Shared (all scenarios)** — `holisticScoringPrompt.ts` / `FLOOR_AND_BONUS_SCORING_PHILOSOPHY`:
> "A user who provides a minimally adequate answer to the question as asked should score at or above 5 on any pillar."
> GUARDRAIL 2: correct macro understanding → "score no lower than 5.5 for that construct in that scenario."

**S2-specific** — `SCENARIO_B_ATTUNEMENT_APPRECIATION_ANCHORS`:
> "Strong attunement **names that miss**. Weaker answers read James as merely positive, reassuring, or 'trying to help' **without naming the attunement failure**."
> Appreciation: distinguish "honoring Sarah's experience" from "processing the outcome logistically."

**S1-specific** — `SCENARIO_A_CONTEMPT_RECOGNITION_CALIBRATION`:
> Pattern-only reads without dismissive register → contempt_recognition **5–6** (partial credit).
> Explicit quoted line + contempt probe provides a second chance.

**S3-specific** — `scenarioScoringPrompt.ts` Scenario C mentalizing:
> Level 1 behavioral description → **5–6** floor; Score **4** only for pure restatement with no inference.
> Q1 scoped to Daniel only — not penalized for omitting Sophie.

**S2 accountability** — extra named ceiling in `scenarioScoringPrompt.ts`:
> Ownership + "but I also need them to…" → **cap accountability at 6–7** (stricter than generic accountability rubric alone).

**Comparison:** S1 and S3 have **explicit textual anchors** in vignette/questions that the rubric treats as primary evidence. S2 expects users to **infer** the attunement/appreciation failure from situational context; the rubric text treats failure to name James's redirect as a **primary** attunement miss (not a micro-evidence deduction). That is **arguably a higher evidentiary bar** than S1's quoted contempt line or S3's quoted Daniel line — but all scenarios share the same **5.0 composite floor** and mean-all-pillars composite math.

**Implication:** **Mixed — not uniformly harsher numeric floors**, but S2's **primary scoring anchors are more inferential**, which can produce lower scores without the user having "failed" in the same way as missing an explicit quoted cue in S1/S3.

---

CONCLUSION
============

Evidence points to a **combination (a + c + partial b)**, not a single explanation:

| Factor | Weight | Notes |
|--------|--------|-------|
| **(a) S2 tests a distinct, harder construct** | Strong | Unstated appreciation/attunement miss is by design; framework labels S2 primary targets differently from S1/S3. |
| **(c) Appreciation scenario-exclusive** | Strong | S2 composite mean includes appreciation with no S1/S3 counterpart → single-moment pillar can drag composite below 5.0 in isolation. |
| **(b) Rubric / structural difficulty** | Moderate | Inferential anchors + 6-pillar mean vs S1's contempt_recognition split; not necessarily miscalibrated but **asymmetric difficulty**. |
| **Content-level fairness (5-case review)** | Strong signal | See `isolated-s2-breaches.md` — worst cases (e.g. 086fc5a1) show explicit blame-shift, attunement miss, appreciation=1 with S1/S2 strong; failures look **substantive**, not scorer artifacts. |

**7 of 10** isolated-collapse breaches in the 75-attempt cohort are **S2** (prior `scenario-floor-consistency-audit.txt`). That pattern aligns with S2 being the **only** scenario scoring appreciation + the most **inferential** attunement task, not random noise.

**Policy levers (no recommendation — options only):**
1. **Keep as-is** — S2 failures are intentional hard tests; one bad Sarah/James read is disqualifying on principle.
2. **Reweight appreciation** — exclude appreciation from S2 composite floor, or require holistic appreciation + S2 agreement before floor fires.
3. **Soften S2-only rubric** — align attunement/appreciation floors with S1/S3 explicit-cue partial-credit patterns.
4. **Change composite math** — e.g. floor on median of S1/S2/S3, or 2-of-3 breach rule (see scenario-floor consistency audit).

Transcript export: `scripts/output/isolated-s2-breaches.md` (5 cases, severity order).
