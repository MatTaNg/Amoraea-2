/** Heuristic: moment is likely a short confirmation (yes/no / ready). */
export function isSimpleYesNoInterviewMoment(lastQuestionText: string | null | undefined): boolean {
  const q = (lastQuestionText ?? '').toLowerCase().trim();
  if (!q) return false;
  if (/are you ready\b/.test(q)) return true;
  if (/\bready to (get )?started\b/.test(q)) return true;
  if (/\bready\?\s*$/.test(q) && q.length < 80) return true;
  /** Explicit yes/no choice — not merely containing the word "yes" or "no" (scenario copy often says "no right or wrong"). */
  if (/\b(yes or no|answer yes or no|a simple yes or no|just yes or no)\b/i.test(q)) return true;
  return false;
}

/** Resume / re-entry copy — user may answer briefly (yes / repeat / continue). */
export function isResumeReentryWelcomePrompt(lastQuestionText: string | null | undefined): boolean {
  const q = (lastQuestionText ?? '').toLowerCase();
  if (!q || !/\bwelcome back\b/.test(q)) return false;
  if (/\b(pick up where we left off|left off in the personal|continue from there|continue where we left off)\b/.test(q)) {
    return true;
  }
  if (/\brepeat what i said\b/.test(q)) return true;
  if (/\bready for your response\b/.test(q)) return true;
  return false;
}

/** Client recovery lines must not become the "question" for ratio gating (avoids re-ask loops). */
export function isClientAudioRecoveryAssistantLine(lastQuestionText: string | null | undefined): boolean {
  const q = (lastQuestionText ?? '').trim();
  if (!q) return false;
  const lower = q.toLowerCase();
  if (/^i only caught part of that\b/i.test(q)) return true;
  if (/^i didn't catch any speech on that try\b/i.test(q)) return true;
  if (/^i'm having a little trouble on my end\b/i.test(q)) return true;
  // Silent / mic / transcription recovery — never verbatim-repeat these as the interview prompt.
  if (/\bon that try\b/.test(lower) && /\b(catch|hear|missed|speech|audio)\b/.test(lower)) return true;
  if (/\bcouldn'?t hear (anything|you|that)\b/.test(lower)) return true;
  if (/\bcould not hear (anything|you|that)\b/.test(lower)) return true;
  if (/\bdidn'?t (quite )?catch (that|any speech|you)\b/.test(lower)) return true;
  if (/\bi missed that\b/.test(lower) && /\b(say|tap|try|again|once more)\b/.test(lower)) return true;
  if (/\btap the mic\b/.test(lower) && /\b(ready|again|try)\b/.test(lower)) return true;
  if (/\bmic did not start cleanly\b/.test(lower)) return true;
  if (/\bhaving trouble starting the microphone\b/.test(lower)) return true;
  if (/\bseems like an interruption happened\b/.test(lower)) return true;
  return false;
}

export function isNamePromptInterviewMoment(lastQuestionText: string | null | undefined): boolean {
  const q = (lastQuestionText ?? '').toLowerCase();
  /** Opening line: "Hi, I'm Amoraea. What can I call you?" — must match or whisper ratio gate re-asks one-word names. */
  if (/\bwhat\s+(can|should)\s+i\s+call\s+you\b/.test(q)) return true;
  if (/what('?s|\s+is)\s+your\s+name\b/.test(q)) return true;
  if (/\bhow\s+(do\s+you|should\s+i)\s+(call\s+you|address\s+you)\b/.test(q)) return true;
  if (/\bhi,?\s+i'?m\s+amoraea\b/.test(q) && /\bwhat\s+(can|should)\s+i\s+call\s+you\b/.test(q)) return true;
  /** Split-stream opener before the name question sentence is queued for TTS. */
  if (/\bhi,?\s+i'?m\s+amoraea\b/.test(q) && q.length <= 48) return true;
  /** Truncated buffered opener: "Hi, I'm Amoraea. What can" */
  if (/\bhi,?\s+i'?m\s+amoraea\b/.test(q) && /\bwhat can\b/.test(q) && !/\bi call you\b/.test(q)) {
    return true;
  }
  /** Name re-ask lines must stay in name-collection mode (ratio gate, whisper retry copy). */
  if (/\bwhat\s+name\s+would\s+you\s+like\s+me\s+to\s+use\b/.test(q)) return true;
  if (/\bdidn'?t\s+quite\s+catch\s+that\b/.test(q) && /\bname\b/.test(q)) return true;
  return false;
}

export type InterviewNameCollectionContext = {
  interviewName?: string | null;
  nameReaskPending?: boolean;
  lastQuestionText?: string | null;
  lastAssistantCue?: string | null;
};

/** True while the interview is still collecting the participant's first name. */
export function isInterviewNameCollectionActive(ctx: InterviewNameCollectionContext): boolean {
  if ((ctx.interviewName ?? '').trim()) return false;
  if (ctx.nameReaskPending) return true;
  if (isNamePromptInterviewMoment(ctx.lastQuestionText)) return true;
  if (isNamePromptInterviewMoment(ctx.lastAssistantCue)) return true;
  /** Ratio / mic recovery lines after a failed name attempt — still name collection. */
  if (isClientAudioRecoveryAssistantLine(ctx.lastQuestionText)) return true;
  return false;
}

/** Post-name briefing (five parts, readiness) — not substantive interview response timing. */
export function isInterviewPreambleBriefingMoment(lastQuestionText: string | null | undefined): boolean {
  const q = (lastQuestionText ?? '').toLowerCase();
  if (/the way this works is/i.test(q)) return true;
  if (
    /good to meet you/i.test(q) &&
    (/the way this works|five parts|three short|are you ready/i.test(q))
  ) {
    return true;
  }
  return false;
}

const READINESS_AFFIRMATION_PATTERNS: RegExp[] = [
  /^yes\b/i,
  /^yeah\b/i,
  /^yep\b/i,
  /^yup\b/i,
  /** Whisper often clips "Yes" to a single letter on readiness turns. */
  /^[sy]$/i,
  /^sure\b/i,
  /^ok(?:ay)?\b/i,
  /^ready\b/i,
  /^i'?m ready\b/i,
  /^let'?s (?:go|do it|start|begin)\b/i,
  /^go ahead\b/i,
  /^sounds good\b/i,
  /^absolutely\b/i,
  /^definitely\b/i,
  /^of course\b/i,
];

/** Whisper often mishears short "yes" as "bye" / "by" / "buy" on readiness turns. */
const READINESS_YES_HOMOPHONE_NORMALIZED = new Set(['bye', 'by', 'buy', 'bay']);

function normalizeReadinessHomophoneToken(raw: string): string {
  let s = raw.trim().toLowerCase();
  s = s.replace(/\u2019/g, "'").replace(/\u2018/g, "'");
  s = s.replace(/-/g, ' ');
  return s.replace(/[.,!?;:…]+$/g, '').trim();
}

export function looksLikeReadinessYesHomophone(text: string | null | undefined): boolean {
  const raw = (text ?? '').trim();
  if (!raw || raw.length > 32) return false;
  const compact = raw.toLowerCase().replace(/[^a-z]/g, '');
  if (compact === 'byebye' || compact === 'byby') return true;
  const words = raw
    .split(/\s+/)
    .flatMap((chunk) => normalizeReadinessHomophoneToken(chunk).split(/\s+/))
    .map((w) => w.trim())
    .filter(Boolean);
  if (words.length === 0 || words.length > 2) return false;
  return words.every((w) => READINESS_YES_HOMOPHONE_NORMALIZED.has(w));
}

/** Readiness briefing, resume welcome, or an active resume gate awaiting assent. */
export function userIsAnsweringProceduralAssentPrompt(
  lastQuestionTexts: Array<string | null | undefined>,
  opts?: { resumeGatePending?: boolean },
): boolean {
  if (opts?.resumeGatePending === true) return true;
  return lastQuestionTexts.some(
    (t) =>
      isSimpleYesNoInterviewMoment(t) ||
      isInterviewPreambleBriefingMoment(t) ||
      isResumeReentryWelcomePrompt(t),
  );
}

/**
 * Map Whisper yes homophones ("bye", "bye-bye") to "Yes" on procedural assent turns
 * (readiness, preamble, resume welcome) so intercepts do not route to leave/stop flows.
 */
export function normalizeReadinessHomophoneTranscript(
  text: string,
  lastQuestionTexts: Array<string | null | undefined>,
  opts?: { resumeGatePending?: boolean },
): string {
  if (lastQuestionTexts.some((t) => isNamePromptInterviewMoment(t))) return text;
  if (!userIsAnsweringProceduralAssentPrompt(lastQuestionTexts, opts)) return text;
  if (looksLikeReadinessYesHomophone(text)) return 'Yes';
  return text;
}

/** Assistant asked whether the participant still wants to stop / leave early. */
export function isInterviewExitConfirmationMoment(lastQuestionText: string | null | undefined): boolean {
  const q = (lastQuestionText ?? '').toLowerCase();
  if (!q) return false;
  if (/\b(sure you want to stop|still want to go|want to leave|want to stop)\b/.test(q)) return true;
  if (/\bif you (leave|stop)\b/.test(q) && /\baffect your score\b/.test(q)) return true;
  return false;
}

/** Participant declines exit / affirms they want to continue the interview. */
export function looksLikeInterviewExitDecline(text: string | null | undefined): boolean {
  const raw = (text ?? '').trim();
  if (!raw || raw.length > 200) return false;
  const t = raw.toLowerCase();
  if (/\b(want you to stay|want to stay|don'?t want to (leave|go|stop|quit|end))\b/.test(t)) {
    return true;
  }
  if (/\b(i'?ll|let me)\s+stay\b/.test(t)) return true;
  if (/\bno[,.]?\s*(i\s+)?(want|wanna)\s+(you\s+to\s+)?stay\b/.test(t)) return true;
  if (/\bkeep\s+going\b/.test(t) && /\b(no|don'?t)\b/.test(t)) return true;
  return false;
}

/** Short procedural assent to "Are you ready?" — not a substantive scenario answer. */
export function looksLikeReadinessAffirmation(text: string | null | undefined): boolean {
  const raw = (text ?? '').trim();
  if (!raw || raw.length > 48) return false;
  const t = raw.replace(/[.!?,…]+$/g, '').trim();
  if (!t) return false;
  if (/\brepeat\b/i.test(t)) return false;
  if (/^\bno\b/i.test(t)) return false;
  if (/^(not yet|not ready|wait|hold on|one sec)/i.test(t)) return false;
  if (looksLikeReadinessYesHomophone(raw)) return true;
  return READINESS_AFFIRMATION_PATTERNS.some((re) => re.test(t));
}

/** True when the participant is answering a readiness / preamble briefing prompt (not Scenario A Q1). */
export function userIsAnsweringInterviewReadinessPrompt(
  lastQuestionTexts: Array<string | null | undefined>,
): boolean {
  return lastQuestionTexts.some(
    (t) => isSimpleYesNoInterviewMoment(t) || isInterviewPreambleBriefingMoment(t),
  );
}

/** Only log `response_timings` for substantive scenario / personal-moment questions. */
export function shouldRecordInterviewResponseTiming(lastQuestionText: string | null | undefined): boolean {
  if (isNamePromptInterviewMoment(lastQuestionText)) return false;
  if (isInterviewPreambleBriefingMoment(lastQuestionText)) return false;
  if (isSimpleYesNoInterviewMoment(lastQuestionText)) return false;
  return true;
}

/** Use for whisper ratio re-ask: short answers are OK (do not require a full sentence). */
export function isShortAnswerOkForWhisperRatioGate(lastQuestionText: string | null | undefined): boolean {
  return (
    isSimpleYesNoInterviewMoment(lastQuestionText) ||
    isInterviewPreambleBriefingMoment(lastQuestionText) ||
    isResumeReentryWelcomePrompt(lastQuestionText) ||
    isClientAudioRecoveryAssistantLine(lastQuestionText) ||
    isNamePromptInterviewMoment(lastQuestionText)
  );
}
