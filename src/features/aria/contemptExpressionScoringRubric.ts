/**
 * Injected into LLM scenario + personal-moment prompts for **contempt_expression** only.
 * **contempt_recognition** must use its own separate instructions and is not covered here.
 */

export type ContemptTierLevel = {
  count: number;
  examples: string[];
};

export type TierCentrality = 'high' | 'medium' | 'low';
/** @deprecated use TierCentrality */
export type Tier3Centrality = TierCentrality;
export type TierConviction = 'stated_as_fact' | 'speculative' | 'hedged';
/** @deprecated use TierConviction */
export type Tier3Conviction = TierConviction;

/** Auditable tier counts + Tier 2/3 prominence (scoring output). */
export type ContemptTierBreakdown = {
  tier_1: ContemptTierLevel;
  tier_2: ContemptTierLevel;
  tier_3: ContemptTierLevel;
  /** Verbatim Tier 2 blame-attribution clauses (detection is never suppressed). */
  tier_2_statements: string[];
  tier_2_centrality: TierCentrality | null;
  /** Approximate % of response that is Tier 2 blame framing; 0 when no Tier 2. */
  tier_2_proportion: number | null;
  tier_2_conviction: TierConviction | null;
  /** Internal **1–3** Tier-2 blame strength before prominence (full signal ≈ 3). */
  tier_2_raw_score: number | null;
  /** Same 1–3 scale after proportionality. */
  tier_2_adjusted_score: number | null;
  tier_2_adjustment_rationale: string | null;
  /** Verbatim Tier 3 clauses from the participant (detection is never suppressed). */
  tier_3_statements: string[];
  tier_3_centrality: TierCentrality | null;
  /** Approximate share of the response (by substance or words) that is Tier 3 framing; 0 when no Tier 3. */
  tier_3_proportion: number | null;
  tier_3_conviction: TierConviction | null;
  /** Internal 1–10 severity of Tier 3 language before prominence weighting (still log all Tier 3). */
  tier_3_raw_score: number | null;
  /** Same scale after proportionality adjustment — dominates composite when high-centrality. */
  tier_3_adjusted_score: number | null;
  /** Tier 3 proportionality explanation (legacy key **adjustment_rationale** accepted by parser). */
  adjustment_rationale: string | null;
};

function parseTierCentrality(raw: unknown): TierCentrality | null {
  if (typeof raw !== 'string') return null;
  const v = raw.trim().toLowerCase();
  if (v === 'high' || v === 'medium' || v === 'low') return v;
  return null;
}

/** @deprecated use parseTierCentrality */
const parseTier3Centrality = parseTierCentrality;

function parseTierConviction(raw: unknown): TierConviction | null {
  if (typeof raw !== 'string') return null;
  const v = raw.trim().toLowerCase().replace(/-/g, '_');
  if (v === 'stated_as_fact' || v === 'speculative' || v === 'hedged') return v as TierConviction;
  // tolerate human-readable variants
  if (v === 'stated as fact') return 'stated_as_fact';
  return null;
}

const parseTier3Conviction = parseTierConviction;

function clampScore1to10(n: number): number {
  if (!Number.isFinite(n)) return NaN;
  return Math.min(10, Math.max(1, Math.round(n * 10) / 10));
}

/** Tier 2 internal footprint scale (per rubric): 1 = mild — 3 = full Tier-2 blame signal. */
function clampTier2Score1to3(n: number): number {
  if (!Number.isFinite(n)) return NaN;
  return Math.min(3, Math.max(1, Math.round(n * 10) / 10));
}

export function parseContemptTierBreakdown(raw: unknown): ContemptTierBreakdown | null {
  if (raw === null) return null;
  if (typeof raw !== 'object' || raw === null) return null;
  const o = raw as Record<string, unknown>;
  const one = (key: string): ContemptTierLevel => {
    const v = o[key];
    if (typeof v !== 'object' || v === null) return { count: 0, examples: [] };
    const t = v as Record<string, unknown>;
    const count =
      typeof t.count === 'number' && Number.isFinite(t.count) ? Math.max(0, Math.round(t.count)) : 0;
    const examples = Array.isArray(t.examples)
      ? (t.examples as unknown[])
          .filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
          .slice(0, 12)
      : [];
    return { count, examples };
  };

  const tier1 = one('tier_1');
  const tier2 = one('tier_2');
  const tier3 = one('tier_3');

  const tier2StatementsRaw = o['tier_2_statements'];
  const tier_2_statements = Array.isArray(tier2StatementsRaw)
    ? (tier2StatementsRaw as unknown[])
        .filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
        .map((s) => s.trim())
        .slice(0, 24)
    : [];

  const tier_2_centrality = parseTierCentrality(o['tier_2_centrality']);

  let tier_2_proportion: number | null = null;
  const tier2PropRaw = o['tier_2_proportion'];
  if (typeof tier2PropRaw === 'number' && Number.isFinite(tier2PropRaw)) {
    tier_2_proportion = Math.min(100, Math.max(0, Math.round(tier2PropRaw)));
  }

  const tier_2_conviction = parseTierConviction(o['tier_2_conviction']);

  const parseOptional110 = (key: string): number | null => {
    const v = o[key];
    if (v === null || v === undefined) return null;
    if (typeof v !== 'number' || !Number.isFinite(v)) return null;
    const c = clampScore1to10(v);
    return Number.isNaN(c) ? null : c;
  };

  const parseOptionalTier2 = (key: string): number | null => {
    const v = o[key];
    if (v === null || v === undefined) return null;
    if (typeof v !== 'number' || !Number.isFinite(v)) return null;
    const c = clampTier2Score1to3(v);
    return Number.isNaN(c) ? null : c;
  };

  const tier_2_raw_score = parseOptionalTier2('tier_2_raw_score');
  const tier_2_adjusted_score = parseOptionalTier2('tier_2_adjusted_score');

  let tier_2_adjustment_rationale: string | null = null;
  const t2ar = o['tier_2_adjustment_rationale'];
  if (typeof t2ar === 'string' && t2ar.trim().length > 0) {
    tier_2_adjustment_rationale = t2ar.trim().slice(0, 1200);
  }

  const statementsRaw = o['tier_3_statements'];
  const tier_3_statements = Array.isArray(statementsRaw)
    ? (statementsRaw as unknown[])
        .filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
        .map((s) => s.trim())
        .slice(0, 24)
    : [];

  const tier_3_centrality = parseTierCentrality(o['tier_3_centrality']);

  let tier_3_proportion: number | null = null;
  const propRaw = o['tier_3_proportion'];
  if (typeof propRaw === 'number' && Number.isFinite(propRaw)) {
    tier_3_proportion = Math.min(100, Math.max(0, Math.round(propRaw)));
  }

  const tier_3_conviction = parseTierConviction(o['tier_3_conviction']);

  const tier_3_raw_score = parseOptional110('tier_3_raw_score');
  const tier_3_adjusted_score = parseOptional110('tier_3_adjusted_score');

  let adjustment_rationale: string | null = null;
  const arLegacy = o['adjustment_rationale'];
  const arT3 = o['tier_3_adjustment_rationale'];
  if (tier3.count > 0) {
    const arPick =
      typeof arT3 === 'string' && arT3.trim().length > 0
        ? arT3.trim()
        : typeof arLegacy === 'string' && arLegacy.trim().length > 0
          ? arLegacy.trim()
          : '';
    if (arPick.length > 0) adjustment_rationale = arPick.slice(0, 1200);
  } else if (typeof arLegacy === 'string' && arLegacy.trim().length > 0) {
    adjustment_rationale = arLegacy.trim().slice(0, 1200);
  }

  const base = {
    tier_1: tier1,
    tier_2: tier2,
    tier_3: tier3,
    tier_2_statements:
      tier2.count === 0 ? [] : tier_2_statements.length > 0 ? tier_2_statements : tier2.examples.slice(0, 24),
    tier_2_centrality: tier2.count === 0 ? null : tier_2_centrality,
    tier_2_proportion: tier2.count === 0 ? (tier_2_proportion ?? 0) : tier_2_proportion,
    tier_2_conviction: tier2.count === 0 ? null : tier_2_conviction,
    tier_2_raw_score: tier2.count === 0 ? null : tier_2_raw_score,
    tier_2_adjusted_score: tier2.count === 0 ? null : tier_2_adjusted_score,
    tier_2_adjustment_rationale:
      tier2.count === 0
        ? (tier_2_adjustment_rationale ?? 'No Tier 2 blame attribution detected.')
        : tier_2_adjustment_rationale,
    tier_3_statements: tier3.count === 0 ? [] : tier_3_statements,
    tier_3_centrality: tier3.count === 0 ? null : tier_3_centrality,
    tier_3_proportion: tier3.count === 0 ? (tier_3_proportion ?? 0) : tier_3_proportion,
    tier_3_conviction: tier3.count === 0 ? null : tier_3_conviction,
    tier_3_raw_score: tier3.count === 0 ? null : tier_3_raw_score,
    tier_3_adjusted_score: tier3.count === 0 ? null : tier_3_adjusted_score,
    adjustment_rationale:
      tier3.count === 0
        ? (adjustment_rationale ?? 'No Tier 3 language detected.')
        : adjustment_rationale,
  };

  if (tier3.count > 0 && base.tier_3_statements.length === 0) {
    base.tier_3_statements = tier3.examples.slice(0, 24);
  }

  return base;
}

/** Embedded in JSON return templates (scenario + moments). Keep in sync with parser keys. */
export const CONTEMPT_TIER_BREAKDOWN_JSON_TEMPLATE = `{
    "tier_1": { "count": 0, "examples": [] },
    "tier_2": { "count": 0, "examples": [] },
    "tier_3": { "count": 0, "examples": [] },
    "tier_2_statements": [],
    "tier_2_centrality": null,
    "tier_2_proportion": 0,
    "tier_2_conviction": null,
    "tier_2_raw_score": null,
    "tier_2_adjusted_score": null,
    "tier_2_adjustment_rationale": "",
    "tier_3_statements": [],
    "tier_3_centrality": null,
    "tier_3_proportion": 0,
    "tier_3_conviction": null,
    "tier_3_raw_score": null,
    "tier_3_adjusted_score": null,
    "adjustment_rationale": ""
  }`;

/** Appended next to JSON templates that score contempt_expression. */
export const CONTEMPT_TIER_BREAKDOWN_JSON_INSTRUCTION = `
CONTEMPT_TIER_BREAKDOWN (required audit field when \`contempt_expression\` is a number):
Include a top-level JSON object \`contempt_tier_breakdown\` with exactly this shape (same slice root as pillarScores):
  "contempt_tier_breakdown": ${CONTEMPT_TIER_BREAKDOWN_JSON_TEMPLATE.trim()}
- Classify **each** distinct negative/critical statement about a **person** into **Tier 1, 2, or 3** per the rubric.
- **tier_1 / tier_2 / tier_3**: **count** = distinct classified claims; **examples**: up to **3** short verbatim snippets per tier (participant words). Use \`[]\` for examples when count is 0.
- **tier_2_statements**: list **every** Tier 2 blame-attribution clause as **exact participant text**. Detection is never omitted.
- When **tier_2.count === 0**: \`tier_2_statements\` \`[]\`; \`tier_2_proportion\` **0**; \`tier_2_centrality\`, \`tier_2_conviction\`, \`tier_2_raw_score\`, \`tier_2_adjusted_score\` JSON **null**; \`tier_2_adjustment_rationale\` e.g. **"No Tier 2 blame attribution detected."**
- When **tier_2.count > 0**: fill Tier 2 prominence per rubric — **tier_2_centrality** (**high** | **medium** | **low**), **tier_2_proportion** (**0–100**), **tier_2_conviction** (**stated_as_fact** | **speculative** | **hedged**), **tier_2_raw_score** / **tier_2_adjusted_score** on internal scale **1–3** (**higher = stronger Tier 2 blame footprint**; **adjusted** after same proportionality multipliers as Tier 3).
- **tier_3_statements**: list **every** Tier 3 clause as exact text — detection never omitted.
- When **tier_3.count === 0**: mirror Tier 3 nulls/\`adjustment_rationale\` as in rubric (no Tier 3).
- When **tier_3.count > 0**: fill Tier 3 prominence — **tier_3_raw_score** / **tier_3_adjusted_score** are **1–10** (**higher = stronger Tier 3 footprint**). Prefer **tier_3_adjustment_rationale** or legacy **adjustment_rationale** for Tier 3 multiplier explanation.
- If \`pillarScores.contempt_expression\` is JSON **null** (not assessed), set \`contempt_tier_breakdown\` to JSON **null** as well.
`;

export const CONTEMPT_EXPRESSION_SCORING_RUBRIC = `

CONTEMPT_EXPRESSION (participant’s own language — this marker only; **not** contempt_recognition)

**Scale (final pillar score):** **Higher = healthier** — less participant contempt in how they talk **about** people in this slice (1–2 = harshest participant stance, 8–10 = no meaningful contemptuous stance). Judge **only** the *participant’s* framing of others, not accuracy of vignette reads.

────────────────────────────────────────
STEP 1 — CLASSIFY EVERY CRITICAL LINE INTO A TIER (before choosing the pillar score)
────────────────────────────────────────
For each negative or critical statement about a **person** (not neutral description of plot), assign **exactly one** tier:

**Tier 1 — Analytical observation (internal severity 0; does *not* pull contempt_expression down)**  
The user describes **behavior, action, communication, or decision** in neutral or evaluative terms **without** attacking **character, worth, or identity**. Includes: what someone did/didn’t do, communication failure, emotional mismatch, mistake or oversight, impact on the other person. This is **expected** scenario-analysis language — **never** treat Tier 1 alone as participant contempt.

Examples (Tier 1):  
• “Sarah wasn’t communicating what she needed.”  
• “James focused on the wrong things in that moment.”  
• “Ryan avoided the conversation instead of addressing it.”  
• “Sophie was hurt and Daniel didn’t acknowledge that.”  
• “He/she was wrong” **when** it means wrong **action or move** in context (e.g. “James was wrong to dismiss her feelings there”).  
Subject = **behavior / choice / pattern in the situation**, not “who they are.”

**Tier 2 — Blame attribution (internal low contempt signal; strengths ~1–3 on an internal tier scale)**  
Fault or responsibility is assigned with **judgment**, but language stays on **what the person did**, not **who they are**. No hostility, mockery, dismissiveness, or character devaluation. Record as a **mild** signal — **must not by itself** justify pillar scores in the **1–4** “harsh contempt” band.

Examples (Tier 2):  
• “It was Sarah’s fault for not speaking up.”  
• “James should have known better than to do that.”  
• “That was a selfish choice on Ryan’s part.”  
• “Sophie handled that badly.”

**Tier 3 — Contempt / character attack (internal high contempt signal; strengths ~6–10 on an internal tier scale)**  
The participant **devalues the person** — worth, intelligence, maturity, fundamental nature. Includes dismissive **labeling**, **mockery**, **global** negative identity verdicts, reducing someone to a **type**, **profanity directed at a character**, **sarcasm used to ridicule**, **sweeping real-world generalizations** (“that’s just how people are,” “women always…”), and **clinical/psychological labels used as hostile verdicts** (“she’s gaslighting him,” “he’s a narcissist,” “she’s manipulative”) **when** they function as **character attacks**, not careful behavioral description.

Examples (Tier 3):  
• “Sarah is just manipulative.” / “James is emotionally stunted.” / “Ryan is pathetic.”  
• “Honestly Sarah sounds like a nightmare.”  
• Clinical labels **weaponized** as insults (see edge cases).  
• “Oh sure, James is the victim here” (**sarcastic mockery**).

**Edge cases**  
• **Gaslighting / narcissist / manipulative:** Tier **3** when used as a **hostile label** or verdict on **who someone is**; **not** Tier 3 when the participant carefully describes **specific repeated behaviors** in-scene without globalizing character worth.  
• **Profanity directed at a character** → **Tier 3** regardless of context.  
• **Sarcasm / mockery** ridiculing a character → **Tier 3**.  
• **Sweeping generalizations beyond the vignette** → **Tier 3** (real-world contempt spillover).  
• **“He/she is wrong”** vs **“was wrong”:** resolve by referent — behavioral wrongdoing in context → Tier **1**; global verdict on the person → Tier **3**.

────────────────────────────────────────
STEP 2 — TIER 2 PROMINENCE (required whenever Tier 2 appears — **always** list every Tier 2 clause in **tier_2_statements**)
────────────────────────────────────────
**Log fully:** Never suppress Tier 2 detection — every blame-attribution clause belongs in **tier_2_statements** and **tier_2.examples**. Prominence controls **how much** Tier 2 pulls the pillar toward **mid/lower-mid**, **not** whether it is recorded.

Assess Tier 2 across the **same three dimensions** as Tier 3:

**A) Centrality** — Is blame attribution the **main interpretive frame**, or **peripheral**?  
• **Low:** appears **after** substantial Tier 1; **one of several** observations; hedged (“maybe,” “I guess,” “in a way”); **immediately balanced** by acknowledging the other party’s role or the dynamic.  
• **High:** **opening frame**, **repeated theme**, or **primary** answer to “what’s going on?” — fault assignment dominates over analyzing the dynamic.

**B) Proportion** — What **fraction** of the response is Tier 2 blame language **relative to** Tier 1 analytical content? ~80% Tier 1 / ~20% peripheral Tier 2 behaves differently from ~60% Tier 2.

**C) Conviction** — **stated_as_fact** vs **speculative** vs **hedged** (offered as one interpretation among others).

────────────────────────────────────────
STEP 3 — TIER 3 PROMINENCE (required whenever Tier 3 appears — **always** list every Tier 3 clause in **tier_3_statements**)
────────────────────────────────────────
**Log fully:** Never suppress Tier 3 detection — every Tier 3 clause belongs in **tier_3_statements** and **tier_3.examples**. Prominence controls **how much** it drags the pillar score, **not** whether it is recorded.

Assess Tier 3 across **three dimensions**:

**A) Centrality** — Main thesis vs peripheral aside (hedging, “one of three,” after long Tier 1).  
**B) Proportion** — Fraction of response that is Tier 3 framing.  
**C) Conviction** — **stated_as_fact** vs **speculative** vs **hedged**.

────────────────────────────────────────
STEP 4 — RAW vs ADJUSTED SCORES (Tier 2 internal **1–3**; Tier 3 internal **1–10**)
────────────────────────────────────────
**Tier 2 — tier_2_raw_score vs tier_2_adjusted_score (1–3, higher = stronger blame footprint)**  
• **tier_2_raw_score:** Strength/density of blame language **before** prominence (**~3** = full Tier-2 signal when blame would dominate absent Tier 1).  
• **Apply the same proportionality multipliers as Tier 3:**  
  – **High** centrality **and** **high** proportion **and** **stated_as_fact** → **~full** Tier 2 signal (**adjusted ≈ raw**, top of 1–3).  
  – **Medium** centrality **or** **medium** proportion → retain **~40–60%** of Tier 2 penalty strength (**reduce effective Tier 2 contribution by ~40–60%** vs raw).  
  – **Low** on all three → retain **~20–30%** (**reduce by ~70–80%**).  
• Peripheral, hedged blame after extensive Tier 1 should yield **low tier_2_adjusted_score** even when **tier_2_raw_score** is moderate.

**Tier 3 — tier_3_raw_score vs tier_3_adjusted_score (1–10, higher = stronger Tier 3 footprint)**  
• **tier_3_raw_score:** Harshness/density **ignoring** prominence first.  
• **Same multiplier bands** as in the prior rubric (high → ~full; medium → ~40–60% retained; low throwaway → ~20–30% retained).  
• **Anchor:** *“That, or she’s gaslighting him. One of the three.”* → raw may be **moderate–high**, **adjusted ~2–3** on the Tier-3 scale — **mild** residual; pillar must not collapse if Tier 1 dominates.

**Boundaries:** Proportionality **never** deletes Tier 2 or Tier 3 from evidence.

────────────────────────────────────────
STEP 5 — COMPOSITE FOOTPRINT & TIER INTERACTION
────────────────────────────────────────
• Build an **internal composite** (conceptually **0–10**, higher = worse participant contempt stance) from **tier_2_adjusted** and **tier_3_adjusted**, reflecting **balance**: mostly Tier 1 with a **small** Tier 2 tail → composite stays **low** (healthy); **raise** composite as Tier 2/Tier 3 **adjusted** footprints grow and as Tier 2/Tier 3 **proportion** of the answer grows. **Cap** the summed conceptual contribution at **10**.

• **Tier 1 vs Tier 2 balance:** A response **~80% Tier 1** / **~20% peripheral Tier 2** should land **much closer** on the composite to **pure Tier 1** than to **full Tier 2**. **~60% Tier 2** with some Tier 1 framing → composite **much closer** to the **Tier 2-heavy** band.

• **Tier 3 dominates:** When **Tier 3** is present at **meaningful centrality** (**high** or **medium-high** adjusted footprint), it **sets the ceiling** on how healthy the pillar can be — **surrounding Tier 1 cannot fully rescue** into the **upper healthy band**. Concretely on **pillarScores.contempt_expression** (**higher = healthier**): when Tier 3 is **high-centrality** and **meaningfully adjusted** (mid–upper range on **tier_3_adjusted_score**), pillar **must not exceed ~5** (**must stay in the harsh/mid-low band 1–5**). Do **not** assign **8–10** when **high-centrality Tier 3** is doing the interpretive work.

• When **only** Tier 1 + Tier 2 (no Tier 3), pillar follows **tier_2_adjusted** and Tier 1 proportion — **do not** use Tier 3 rules.

────────────────────────────────────────
STEP 6 — MAP TO pillarScores.contempt_expression (1–10, **higher = healthier**)
────────────────────────────────────────
• Translate the internal composite / tier balance into a **single** pillar score. **Prioritize tier_3_adjusted_score** whenever Tier 3 exists; then fold in **tier_2_adjusted_score** and Tier 1 dominance.

• **Tier 2 without Tier 3:** with **low adjusted** Tier 2 and strong Tier 1, pillar can still reach **~7–9+**; **high adjusted** Tier 2 across the answer → **mid pillar (~5–7)** — **still do not** assign **1–4** **only** from Tier 2 unless Tier 3-level hostility sneaks in as Tier 3.

• **Tier 1 only** → **must not** force **1–4** from analytical language.

• **Ceiling for 7–10:** Still require **active engagement** with people’s inner experience for **7+**; wholesale dismissal → **cap at 6**, as before.

• **contempt_recognition** vs **expression:** fiction-as-contemptuous is **recognition**, not participant **expression**.

────────────────────────────────────────
CALIBRATION ANCHORS (verbatim examples — interpret **pillarScores.contempt_expression** where **higher = healthier**)
────────────────────────────────────────
The labels **F** below are an optional **internal contempt footprint** (**0–10**, higher = worse). Roughly: **pillar ≈ 10 − F** (clamp 1–10), or map qualitatively to the pillar bands given.

**Response A:** “James dropped the ball here — he should have known better than to focus on logistics when Sarah was clearly emotional. That said, Sarah could have been clearer about what she needed instead of expecting James to read her mind.”  
→ Tier 2 **medium** centrality (blame + **balanced** accountability). **F ~2–3** → **pillar ~7–8**.

**Response B:** “It was entirely Sarah's fault. She didn't communicate, she expected James to be a mind reader, and then she blamed him for failing to meet expectations she never set. James did everything right.”  
→ Tier 2 **high** centrality, one-sided, **high** conviction. **F ~3–4** → **pillar ~5–6**.

**Response C:** “I think James genuinely tried but missed what Sarah actually needed emotionally — he defaulted to problem-solving when she needed to feel heard first.”  
→ **Pure Tier 1**, no Tier 2 blame attribution. **F ~0–1** → **pillar ~9–10**.

**Response D:** “Sarah is clearly manipulative — she set James up to fail and then blamed him for it. That's a toxic pattern.”  
→ Tier 3 **high** centrality + conviction; Tier 3 **dominates**. **F ~7–9** → **pillar ~1–4** regardless of how much Tier 1 might appear elsewhere.

Populate **contempt_tier_breakdown** per the JSON instruction (Tier 2 + Tier 3 prominence fields, **tier_2_adjustment_rationale**, and Tier 3 rationale via **adjustment_rationale** or **tier_3_adjustment_rationale**).
`;
