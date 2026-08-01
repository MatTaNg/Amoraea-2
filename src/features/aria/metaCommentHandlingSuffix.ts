import type { MetaCommentClassification } from '@features/aria/metaCommentClassificationTypes';
import { INTERVIEW_TURN_ORCHESTRATOR_PHASE2_ENABLED } from '@features/aria/interviewTurnOrchestratorConfig';

export function buildMetaCommentHandlingSuffix(args: {
  classification: MetaCommentClassification;
  repeatedFrustrationInMoment: boolean;
  /** Active assessable question — used for Phase 2 redirect suffixes. */
  activeQuestionText?: string;
  /** First frustration signal only — whether a prior user turn in this scenario had substantive content (client-computed). */
  hadPriorSubstantiveAnswerInMoment?: boolean;
  /**
   * Sufficiency challenges ("Wasn't that enough?") — skip reflective quote even when prior substantive
   * answers exist; reflection reads as repeating them.
   */
  omitPriorReflectionClause?: boolean;
  /**
   * `already_answered` only — client verified a ≥8 word non-meta prior user turn in this interview moment.
   */
  alreadyAnsweredPriorSubstantiveVerified?: boolean;
  /** `checking_in` only — likely frustration-adjacent signal from prior turn + current phrasing. */
  checkingInFrustrationAdjacent?: boolean;
  /** `checking_in` only — already inside Moment 5 after accountability probe fired. */
  inMoment5AfterAccountabilityProbe?: boolean;
  /**
   * `confusion` + `repeat_request` in Moment 5 when the client verified a prior substantive M5 answer —
   * do not re-read the full conflict vignette / M5 bundle.
   */
  moment5ConfusionRepeatHasPriorSubstantive?: boolean;
}): string {
  const {
    classification,
    repeatedFrustrationInMoment,
    hadPriorSubstantiveAnswerInMoment,
    omitPriorReflectionClause,
    alreadyAnsweredPriorSubstantiveVerified,
    checkingInFrustrationAdjacent,
    inMoment5AfterAccountabilityProbe,
    moment5ConfusionRepeatHasPriorSubstantive,
  } = args;
  const t = classification.type;

  if (t === 'skip_request') {
    return `
─────────────────────────────────────────
META-COMMENT (CLIENT): SKIP REQUEST — NEXT / ADVANCE ASK
─────────────────────────────────────────
The participant asked to move on or for the next question (meta only — **not** a substantive answer).

**App pipeline:** The client speaks the confirmation line **verbatim** this turn and does **not** use model output for this classification. **Do not** assume this suffix applies to your reply — no assistant generation for this path in the interview app.
`;
  }

  if (t === 'inability') {
    return `
─────────────────────────────────────────
META-COMMENT: INABILITY (CANNOT ANSWER)
─────────────────────────────────────────
They are signaling genuine inability to produce content — **not** refusal.

**elongating_probe override:** Do **not** deliver any elongating probe this turn.

**Moments 1–3 (client):** On inability the client offers a softer skip confirmation:
"We can skip this question if you'd like, but it may affect your score, do you want to skip it?"

**App pipeline:** Prefer the client skip-confirmation line. If you still speak this turn, ask whether they want to skip and mention score impact in one short sentence — do **not** re-read the vignette or push for more detail.

If the client already delivered skip confirmation, your reply must **not** contradict it.
`;
  }

  if (t === 'already_answered') {
    const noElongatingIn = `
**elongating_probe override:** Do **not** deliver any elongating probe this turn (META-COMMENT classification active).

`;
    if (alreadyAnsweredPriorSubstantiveVerified === true) {
      return `
─────────────────────────────────────────
META-COMMENT: ALREADY ANSWERED — PRIOR SUBSTANCE VERIFIED (CLIENT)
─────────────────────────────────────────
${noElongatingIn}
The participant believes they already answered. The client verified a **prior substantive user turn** in this moment (≥8 words, not classified as a meta-comment).

**Take ownership** — they were not wrong. Extract **one short reflective clause** using **only** words they already said on that prior turn (same extraction discipline as frustration reflection). **Never** invent content.

Then **advance** to the **next scripted question** in normal sequence. **No** skip offer and **no** score warning.

Structure examples (spoken as one turn):
• "You're right — [reflection]. Let's keep going. [next question]."
• "My mistake — you mentioned [reflection]. Moving on. [next question]."
• "Got it, you're right — [reflection]. [next question]."

If nothing concrete is extractable from their prior words: "You're right — my mistake. [next question]."
`;
    }
    return `
─────────────────────────────────────────
META-COMMENT: ALREADY ANSWERED — NO PRIOR SUBSTANCE IN THIS MOMENT (CLIENT)
─────────────────────────────────────────
${noElongatingIn}
The participant used already-answered language, but the client **did not** find a qualifying prior substantive answer in this moment.

**Do not** apologize as if you erred. Single spoken turn — neutral, non-punitive:

"Sounds like you've said what you wanted to say. [shortened essential re-ask — same discipline as frustration]. Or we can skip it, but it may affect your score."

Mirror the frustration skip rule: **ask** whether they want to skip — do **not** skip automatically.
`;
  }

  if (repeatedFrustrationInMoment && t === 'frustration') {
    return `
─────────────────────────────────────────
META-COMMENT (CLIENT): REPEATED FRUSTRATION — SAME MOMENT
─────────────────────────────────────────
The participant has shown frustration more than once in this interview moment. **Do not** deliver performance praise ("you're doing great," etc.). **Do not** fire an elongating probe or ask them to elaborate further on this beat.

**Your entire assistant message this turn must be only** (verbatim, then stop — user will continue via mic when ready):
"No pressure at all — let's just keep going. We can move on whenever you're ready."

Then continue the scripted sequence on a **later** turn — do not probe this same question further.
`;
  }

  const noElongating = `
**elongating_probe override:** Do **not** deliver any elongating probe this turn (META-COMMENT classification active).

`;

  if (t === 'frustration') {
    const usePriorReflection =
      hadPriorSubstantiveAnswerInMoment === true && omitPriorReflectionClause !== true;
    const sufficiencyPushbackNote =
      omitPriorReflectionClause === true
        ? `
**Sufficiency pushback (client):** They are challenging whether more was needed — **do not** open by quoting or reflecting what they already said on prior turns; that reads as repeating them. Still deliver essential re-ask + skip confirmation question below (same structure as no-reflection branch).
`
        : '';
    const priorBranch = usePriorReflection
      ? `
**Prior substantive answer detected (client):** Start with **one short reflective clause** taken **only** from words the participant already said earlier **in this scenario** on a prior turn — quote or tightly paraphrase one concrete point they offered. **Do not** invent feelings or summarize if there is nothing extractable (client falls back to the no-prior branch when unclear).
Structure (single spoken turn, same TTS):
  [reflection clause]. I need to know [essential re-ask — shortened]. We can skip this question but it may affect your score, do you still want to skip it?
Example (tone only): "You touched on the emotional disconnect. I need to know how James would repair this. We can skip this question but it may affect your score, do you still want to skip it?"
`
      : `
**No prior substantive answer — or reflection suppressed (client):** Do **not** reflect or quote prior turns. Use:
Structure (single spoken turn):
  I need to know [essential re-ask — shortened]. We can skip this question but it may affect your score, do you still want to skip it?
Example (tone only): "I need to know how James would repair this. We can skip this question but it may affect your score, do you still want to skip it?"
`;
    return `
─────────────────────────────────────────
META-COMMENT (CLIENT): FRUSTRATION — FIRST SIGNAL (same moment)
─────────────────────────────────────────
${noElongating}
The participant is pushing back or frustrated about the **active question**. **Do not** say "you're doing great" or other evaluative performance praise.

**Stay-in-place guard (this turn):** Do **not** close or wrap up the scenario ("that's the end of this scenario," "nice work" as a scenario closer, etc.), do **not** introduce the next vignette, and do **not** jump to the **next** scripted scenario or moment. Stay on this **same** interview moment until they answer substantively or **confirm** they want to skip on a **later** user turn (you will then receive **SKIP ACCEPTED**).

**Re-asking:** Strip vignette setup and scene-setting from the original prompt. Ask **only** the essential interrogative core — shorter and lighter than before — **never** repeat the full prior question verbatim.

**Skip confirmation (not an immediate skip):** Always end by **asking** whether they want to skip, using this wording (or equivalent): "We can skip this question but it may affect your score, do you still want to skip it?" One confirmation prompt only for this moment — **do not** ask again on later turns in the same beat unless they bring it up.

If their **next** reply clearly **confirms** they want to skip (yes / skip / let's skip, etc.), the client advances — you will receive a **SKIP ACCEPTED** system note; follow that note's bridge wording, then deliver only the next scripted progression. If they **decline** (no / stay / don't skip), the client handles encouragement — **do not** advance the scenario on that turn.

**checking_in** signals ("Was that enough?", etc.) stay on their **own** path — never mix this frustration structure with checking_in.
${sufficiencyPushbackNote}
${priorBranch}
`;
  }

  if (t === 'confusion' && classification.confusion_subtype === 'repeat_request') {
    if (moment5ConfusionRepeatHasPriorSubstantive === true) {
      return `
─────────────────────────────────────────
META-COMMENT (CLIENT): CONFUSION — REPEAT REQUEST (MOMENT 5, PRIOR SUBSTANCE VERIFIED)
─────────────────────────────────────────
${noElongating}
The participant asked to hear the question again, but they **already gave a substantive answer** in Moment 5 (client verified).

**Do not** re-read the full conflict vignette, the Moment 4→5 transition bundle, or the long "think of a time when you had a conflict…" setup again.

**Delivery rule:** In **one** short spoken turn, start with **Sure.** then restate **only** the **immediate** last question they were answering (the latest assistant line before this meta turn — typically a follow-up probe). If the client already delivered this replay, do not contradict it.

**Forbidden:** Full scenario re-introduction, elongating probes, or treating this as a fresh conflict prompt.

Then wait for their mic reply.
`;
    }
    return `
─────────────────────────────────────────
META-COMMENT (CLIENT): CONFUSION — REPEAT REQUEST (heard / misheard the question)
─────────────────────────────────────────
${noElongating}
The participant asked to **hear the interview question again** (repeat / didn't catch / what did you ask) — **not** a request for reframing, examples, or more detail.

**Delivery rule:** Start with **Sure.** then re-read the **current active scripted question in full** — the same wording the participant was answering before this meta turn (verbatim is ideal; fix only tiny clarity glitches). **Do not** replace it with a paraphrase, a simplification, a different angle, or a vignette excerpt unless the scripted prompt itself is the vignette setup.

**Forbidden this turn:** "Can you say more about that?", any elongating probe, asking them to elaborate, or answering on their behalf. Do **not** skip the leading **Sure.**

After you finish reading the question, **stop** and wait for their mic reply.
`;
  }

  if (t === 'confusion') {
    if (INTERVIEW_TURN_ORCHESTRATOR_PHASE2_ENABLED) {
      const activeQ = (args.activeQuestionText ?? '').trim().slice(0, 500);
      const activeBlock = activeQ
        ? `\n**Active question (essential core only when re-asking):**\n"${activeQ}"\n`
        : '';
      return `
─────────────────────────────────────────
META-COMMENT (PHASE 2): CONFUSION ABOUT THE QUESTION
─────────────────────────────────────────
${noElongating}
They are confused about what you're asking — **not** an explicit "repeat what you said" ask.

**Your single spoken turn must:**
1) Briefly clarify what you are asking for in plain language (one or two sentences — no vignette replay).
2) End by re-asking the **essential core** of the active question (shortened).
${activeBlock}
Do **not** use the canned "want me to repeat the question?" offer alone. Do **not** fire an elongating probe.
`;
    }
    return `
─────────────────────────────────────────
META-COMMENT (CLIENT): CONFUSION ABOUT THE QUESTION
─────────────────────────────────────────
${noElongating}
They are confused about what you're asking (don't understand / unclear / think no question was asked) — **not** an explicit "repeat what you said" ask.

**Delivery rule (client usually injects this):** Offer to re-read the current interview question. Prefer exactly:
"No worries — want me to repeat the question?"

Do **not** reframe into a different question. Do **not** paste the full vignette. Do **not** fire an elongating probe.

If you speak this turn (client did not), keep it to that short offer, then wait for their mic reply.
`;
  }

  if (t === 'checking_in') {
    if (checkingInFrustrationAdjacent === true) {
      const moment5PivotNote =
        inMoment5AfterAccountabilityProbe === true
          ? `
**Moment 5 special rule (client state):** Accountability probe already fired. Do **not** re-ask "What do you think you did or said that contributed to the conflict?" again. Pivot to a repair-oriented next probe/question instead (what helped repair, what changed, what they did next).
`
          : '';
      return `
─────────────────────────────────────────
META-COMMENT (CLIENT): CHECKING-IN + FRUSTRATION ADJACENT
─────────────────────────────────────────
${noElongating}
The participant appears to be checking whether they were heard **with frustration undertone** after a substantive response.

Your single next message must:
1) Take ownership briefly ("Yes — I heard you." / "I got you, my mistake."),
2) Reflect one salient point from what they just said (short clause, no invention),
3) Pivot to the next contextually relevant probe/question.

Hard rule: **Do not re-ask the same question** that preceded this checking-in turn.
${moment5PivotNote}
For scenario turns, advance to the next question in sequence rather than re-probing the same construct.
`;
    }
    return `
─────────────────────────────────────────
META-COMMENT (CLIENT): CHECKING IF THEY WERE HEARD
─────────────────────────────────────────
${noElongating}
They want confirmation their answer registered — treat this as **answer acceptance**. Their substantive reply (if any) in this turn **satisfies** the active question unless they clearly gave **no** content at all.

**No reflection clause** of their prior answer here unless needed for register — **no** skip offer. Your single assistant message this turn must include **two parts in order**, same paragraph / same spoken turn:
1) **One short confirmation** (e.g. "Yes — got it." / "Got it.") — **no** evaluative "great."
2) **Immediately after**, one bridging phrase then the **next scripted question** (same spirit as): "Got it — let's keep going. [next question]."

**Never** use the frustration path (reflection + skip confirmation) for checking_in.
`;
  }

  // ambiguous_short
  if (INTERVIEW_TURN_ORCHESTRATOR_PHASE2_ENABLED) {
    const activeQ = (args.activeQuestionText ?? '').trim().slice(0, 500);
    const activeBlock = activeQ
      ? `\n**Active question (essential core when re-asking):**\n"${activeQ}"\n`
      : '';
    return `
─────────────────────────────────────────
META-COMMENT (PHASE 2): AMBIGUOUS / VERY SHORT
─────────────────────────────────────────
${noElongating}
Their message was very short and not clearly an answer. **No** evaluative praise.

Invite them naturally ("Just say whatever comes to mind" or equivalent), then **re-ask the essential core** of the active question in the **same turn** — shortened, no vignette replay.
${activeBlock}
Do **not** leave silence waiting for them to guess. Do **not** fire an elongating probe.
`;
  }
  return `
─────────────────────────────────────────
META-COMMENT (CLIENT): AMBIGUOUS / VERY SHORT
─────────────────────────────────────────
${noElongating}
Their message was very short and not clearly an answer. **No** evaluative praise.

**Never** re-read the scenario vignette, never paste the fictional setup again, and never repeat the active question verbatim unless the user **explicitly** requested a repeat.

Use this neutral invitation (or equivalent): "Just say whatever comes to mind."

Then wait for their next recording on the **same** beat — no elongating probe line from the approved list.
`;
}

