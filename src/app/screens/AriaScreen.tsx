import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  StyleSheet,
  Text,
  TextInput,
  ScrollView,
  TouchableOpacity,
  Pressable,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from 'expo-speech-recognition';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@features/authentication/hooks/useAuth';
import { SafeAreaContainer } from '@ui/components/SafeAreaContainer';
import { Button } from '@ui/components/Button';
import { colors } from '@ui/theme/colors';
import { spacing } from '@ui/theme/spacing';
import { Ionicons } from '@expo/vector-icons';
import { speakWithElevenLabs, stopElevenLabsSpeech } from '@features/aria/utils/elevenLabsTts';
import { ProfileRepository } from '@data/repositories/ProfileRepository';
import { evaluateGate1 } from '@features/onboarding/evaluateGate1';
import type { Gate1Score } from '@domain/models/OnboardingGates';
import { supabase } from '@data/supabase/client';
import {
  saveInterviewToStorage,
  loadInterviewFromStorage,
  clearInterviewFromStorage,
  getCurrentScenario,
  setStorageFallbackListener,
  type StoredInterviewData,
} from '@utilities/storage/InterviewStorage';
import { requestMicPermissionForPWA } from '@utilities/permissions/requestMicPermission';
import { withRetry, classifyError } from '@utilities/withRetry';
import { FlameOrb } from '@app/screens/FlameOrb';
import { UserInterviewLayout, type ActiveScenario } from '@app/screens/UserInterviewLayout';
import { InterviewAnalysisScreen } from '@app/screens/InterviewAnalysisScreen';
import { AdminInterviewDashboard } from '@app/screens/AdminInterviewDashboard';
import {
  calculateScoreConsistency,
  calculateConstructAsymmetry,
  analyzeLanguageMarkers,
  buildScenarioBoundaries,
} from '@features/aria/alphaAssessmentUtils';
import { generateAIReasoning } from '@features/aria/generateAIReasoning';
import { useAudioRecorder } from '@features/aria/hooks/useAudioRecorder';
import * as FileSystem from 'expo-file-system';

const profileRepository = new ProfileRepository();

/** Always use proxy when set — direct api.anthropic.com fails on native (CORS). */
function getAnthropicEndpoint(): string {
  const proxyUrl =
    typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_ANTHROPIC_PROXY_URL
      ? process.env.EXPO_PUBLIC_ANTHROPIC_PROXY_URL
      : '';
  if (!proxyUrl && __DEV__) {
    console.warn('EXPO_PUBLIC_ANTHROPIC_PROXY_URL is not set; direct API may fail on native.');
  }
  return proxyUrl || 'https://api.anthropic.com/v1/messages';
}

/**
 * ALPHA_MODE: When true, shows full AI reasoning, analysis page, and retake option.
 * Set to false before production.
 *
 * Cleanup before production:
 * - Delete InterviewAnalysisScreen component (and file)
 * - Delete generateAIReasoning + alphaAssessmentUtils (and alpha feature imports)
 * - Remove ALPHA_MODE and all branches that use it (timing/probe refs, alpha save path)
 * - Remove user_analysis_* from queries if not keeping for research; route post-completion to under_review
 */
const ALPHA_MODE = true;

/**
 * Aira-voiced fallbacks when something goes wrong. Never expose technical language.
 * Used only for recording/transcription retry prompts — not for API errors.
 */
const AIRA_ERROR_MESSAGES = {
  waiting: [
    'Give me just a moment...',
    'One moment...',
    'Bear with me for a second...',
  ],
  conversationFailed: [
    "I need to pause there — something interrupted me. Could you say that again?",
    "I lost my thread for a moment. Can you repeat what you just said?",
    "Something pulled me away briefly. I'm back — what were you saying?",
  ],
  recordingOrTranscriptionRetry: [
    "I didn't quite catch that — could you say it again?",
    "Something interrupted me there. Would you mind repeating that?",
    "I missed that — can you say it once more?",
  ],
  recordingOrTranscriptionRetryNative: [
    "I didn't catch that — tap the mic and try again.",
    "Say that again when you're ready.",
    "I missed that — give it another go.",
  ],
};

/** User-facing error messages shown in chat (no TTS). */
const CHAT_ERROR_MESSAGES = {
  retryExhausted: "I'm having trouble connecting right now. Try tapping the mic again in a moment.",
  badRequest: "Something went wrong with that request. Try again — if it keeps happening, restart the interview.",
  unauthorized: "There's an authentication issue. Try closing and reopening the app.",
  serverError: "Something went wrong on our end. Try again in a moment.",
  proxyError: "Having trouble reaching the server. Check your connection and try again.",
  unknown: "Something went wrong. Try again — if it keeps happening, restart the interview.",
};

function getErrorMessage(err: unknown, retriesExhausted = false): string {
  const status = (err as { status?: number; statusCode?: number })?.status
    ?? (err as { status?: number; statusCode?: number })?.statusCode;
  // Only show retry-exhausted message when retries were actually exhausted (never for first 429)
  if (retriesExhausted) return CHAT_ERROR_MESSAGES.retryExhausted;
  if (status === 400) return CHAT_ERROR_MESSAGES.badRequest;
  if (status === 401) return CHAT_ERROR_MESSAGES.unauthorized;
  if (status === 403) return CHAT_ERROR_MESSAGES.unauthorized;
  if (status === 500) return CHAT_ERROR_MESSAGES.serverError;
  return CHAT_ERROR_MESSAGES.unknown;
}
function randomFrom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Only save to localStorage once the interview has meaningfully started.
 * Pre-interview messages (greeting, name, briefing) are not worth saving and cause resume loops if saved.
 */
function shouldSaveToStorage(
  messages: Array<{ role: string; content: string }> | undefined,
  scenariosCompleted: number[] | undefined,
  currentScenario: 1 | 2 | 3 | null | undefined
): boolean {
  // Allow save when at least one scenario is completed (covers recovery and post-completion pending save)
  if ((scenariosCompleted?.length ?? 0) > 0) return true;
  // Otherwise require interview proper: scenario started and at least 2 user responses
  if (!currentScenario || currentScenario < 1) return false;
  const userMessages = (messages ?? []).filter((m) => m.role === 'user');
  if (userMessages.length < 2) return false;
  return true;
}

/**
 * Resume should not trigger if the last saved AI message was only the greeting.
 */
function isGreetingOnly(savedMessages: Array<{ role: string; content?: string }> | undefined): boolean {
  if (!savedMessages || savedMessages.length === 0) return true;
  const aiMessages = savedMessages.filter((m) => m.role === 'assistant');
  if (aiMessages.length <= 1) return true;
  const lastAI = aiMessages[aiMessages.length - 1];
  const greetingPhrases = [
    'welcome to amoraea',
    'what can i call you',
    'what should i call you',
    'nice to meet you',
    'good to meet you',
  ];
  const content = (lastAI?.content ?? '').toLowerCase();
  return greetingPhrases.some((phrase) => content.includes(phrase));
}

/**
 * Save interview progress only when there is meaningful progress (avoids resume loop from pre-interview state).
 */
async function saveInterviewProgress(
  userId: string,
  state: Omit<StoredInterviewData, 'version' | 'userId' | 'lastSavedAt'>
): Promise<void> {
  if (
    !shouldSaveToStorage(state.messages, state.scenariosCompleted, state.currentScenario)
  ) {
    return;
  }
  await saveInterviewToStorage(userId, state);
}

/**
 * Detect if the user's message is requesting a scenario switch.
 * Returns 'to_fictional' | 'to_personal' | null.
 */
function detectScenarioSwitch(
  userMessage: string,
  currentMode: 'personal' | 'fictional' | null
): 'to_fictional' | 'to_personal' | null {
  const text = userMessage.toLowerCase().trim();
  const toFictionalSignals = [
    'use a scenario',
    'use the scenario',
    'use the fake',
    'fictional',
    'just use the example',
    'scenario instead',
    'forget it',
    'never mind',
    "let's just do",
    'give me the scenario',
    'use the situation',
  ];
  const toPersonalSignals = [
    'i do have',
    'actually i',
    'wait i',
    'real example',
    'real one',
    'something comes to mind',
    'i thought of',
    'switch to real',
    'use a real',
    'let me share',
    'i have one',
    'i can think of one',
  ];
  if (currentMode === 'personal') {
    if (toFictionalSignals.some((s) => text.includes(s))) return 'to_fictional';
  }
  if (currentMode === 'fictional') {
    if (toPersonalSignals.some((s) => text.includes(s))) return 'to_personal';
  }
  return null;
}

type MessageWithScenario = { role: string; content: string; scenarioNumber?: number };

function getScenarioNumberForNewMessage(
  prevMessages: MessageWithScenario[],
  role: 'user' | 'assistant',
  newContent?: string
): number {
  const last = [...prevMessages].reverse().find((m) => m.role === 'user' || m.role === 'assistant');
  const lastNum = (last as MessageWithScenario | undefined)?.scenarioNumber;
  if (role === 'user') return lastNum ?? 1;
  if (!newContent) return lastNum ?? 1;
  const c = newContent.toLowerCase();
  if (
    /think of a time|first situation|slow drift|jamie.*morgan|morgan.*jamie|here's the first/.test(c)
  )
    return 1;
  if (
    /second situation|missed moment|casey.*jordan|jordan.*casey|on to the second|first situation/.test(c)
  )
    return 2;
  if (
    /third situation|last one|intimacy gap|riley.*drew|drew.*riley|situation three/.test(c)
  )
    return 3;
  return lastNum ?? 1;
}

/** Removes control tokens from AI response before display or TTS. Use raw text for logic only. */
function stripControlTokens(text: string): string {
  if (!text) return text;
  return text
    .replace(/\[INTERVIEW_COMPLETE\]/gi, '')
    .replace(/\[SCENARIO_COMPLETE:\d+\]/gi, '')
    .replace(/\[CLOSING_QUESTION:\d+\]/gi, '')
    .replace(/\[STAGE_[123]_COMPLETE\]/g, '')
    .replace(/\[PROBE_TRIGGERED\]/gi, '')
    .replace(/\[SKEPTICISM_CHECK\]/gi, '')
    .trim();
}

const DECLINE_PHRASES = [
  "i can't think of one", "i cant think of one", "i don't know", "i dont know",
  "nothing comes to mind", "not really", "no", "nope", "can't think of anything",
  "don't have", "can't think", "no example",
];

function isDecline(text: string): boolean {
  const lower = text.toLowerCase().trim();
  return DECLINE_PHRASES.some((phrase) => lower.includes(phrase)) || lower.length < 15;
}

const CLOSING_LINE_INSTRUCTIONS = `
CLOSING LINE — MANDATORY SPECIFICITY:

The closing line after the skepticism probe must reflect the actual pattern you observed across this specific user's three scenarios. It must be specific enough that it could not apply to a different user.

BANNED PHRASES — never use these:
- "You've worked through all three of those clearly" / "You worked through all three clearly"
- "You caught the key patterns" / "key patterns in each situation"
- "Thank you for being so open with me" as a standalone closing (it can follow a specific observation but never lead alone)
- Any variation of "clearly" used as filler praise
- "A lot of self-awareness"
- "You handled that well"

REQUIRED: Before writing the closing line, identify:
1. What did this user do CONSISTENTLY across 2-3 scenarios? (not what they did well in one — what repeated)
2. Was the consistency a strength, a gap, or both?
3. What is the ONE honest thing to say about that pattern?

Then write 1-2 sentences that name it directly.

EXAMPLES OF SPECIFIC CLOSING LINES:

User who consistently owned their part: "Across all three you moved toward your own role in it quickly — even when it wasn't the obvious place to look. Thank you for being so open with me."

User who consistently named the other person's failure but missed their own: "A consistent thread across all three — you saw what the other person should have done differently very clearly. Your own part was harder to get to. Thank you for being so open with me."

User who showed strong repair instinct but avoidance pattern in timing: "You knew what the right thing to do was in all three — the gap was in the timing. The cost of waiting showed up in each one. Thank you for being so open with me."

User who showed good both-sides awareness: "You held both sides consistently — named what each person contributed without collapsing into one person being simply right or wrong. That's not common. Thank you for being so open with me."

The closing line is honest. It is not a grade. It is not praise. It is an observation. If the user showed a clear gap — name it gently but name it. If they showed a genuine strength — name that specifically. If both — name the tension between them.
`;

const PERSONAL_CLOSING_INSTRUCTION = `
CLOSING: The user shared real personal experiences. Close with warmth that acknowledges their openness — something genuine but not effusive. The closing line MUST be specific to this user (see CLOSING LINE instructions above) — name the actual pattern you observed across the three scenarios, then "Thank you for being so open with me" or similar. Then output [INTERVIEW_COMPLETE].`;

const SCENARIO_ONLY_CLOSING_INSTRUCTION = `
CLOSING: The user did not share any personal examples — they responded only to fictional scenarios. Do NOT say "thank you for being open" or anything that implies personal disclosure. The closing line MUST be specific to this user (see CLOSING LINE instructions above) — name the actual pattern you observed across the three scenarios, not a generic summary. Keep it honest. Then output [INTERVIEW_COMPLETE].`;

/** Returns mic permission state on web (Permissions API); 'unavailable' on native or unsupported. */
async function checkMicPermission(): Promise<'granted' | 'denied' | 'prompt' | 'unavailable'> {
  if (Platform.OS !== 'web' || typeof navigator === 'undefined') return 'unavailable';
  try {
    const perm = (navigator as { permissions?: { query: (p: { name: string }) => Promise<{ state: string }> } }).permissions;
    if (!perm) return 'unavailable';
    const result = await perm.query({ name: 'microphone' });
    const state = result.state as 'granted' | 'denied' | 'prompt';
    return state;
  } catch {
    return 'unavailable';
  }
}

type GenerateAIReasoningSafeOptions = {
  onRetry?: (attempt: number) => void;
  onUnrecoverable?: (err: unknown) => void;
};

async function generateAIReasoningSafe(
  pillarScores: Record<string, number>,
  scenarioScores: Record<number, { pillarScores: Record<string, number>; scenarioName?: string } | undefined>,
  transcript: Array<{ role: string; content?: string }>,
  weightedScore: number | null,
  passed: boolean,
  options?: GenerateAIReasoningSafeOptions
): Promise<import('@features/aria/generateAIReasoning').AIReasoningResult & { _generationFailed?: boolean; _error?: string }> {
  try {
    return await withRetry(
      () => generateAIReasoning(pillarScores, scenarioScores, transcript, weightedScore, passed),
      {
        retries: 4,
        baseDelay: 10000,
        maxDelay: 40000,
        context: 'AI reasoning generation',
        onRetry: options?.onRetry,
        onUnrecoverable: options?.onUnrecoverable,
      }
    );
  } catch (err) {
    if (__DEV__) console.error('AI reasoning generation failed:', err instanceof Error ? err.message : err);
    return {
      _generationFailed: true,
      _error: err instanceof Error ? err.message : String(err),
      overall_summary: undefined,
      overall_strengths: [],
      overall_growth_areas: [],
      construct_breakdown: {},
      scenario_observations: {},
      closing_reflection: undefined,
    };
  }
}

// Scenario display text for regular-user immersive layout (description only; DO NOT MODIFY scenario content).
const SCENARIO_1_LABEL = 'Situation 1';
const SCENARIO_1_TEXT =
  "Jamie and Morgan have been together a year. Jamie is going through a hard stretch at work and has been withdrawn for a few weeks — shorter with Morgan, less present at home. Morgan hasn't brought it up. One evening Jamie snaps at Morgan over something small and immediately apologises. Morgan says 'it's fine, I know you're stressed.' A month later, during a different argument, Morgan brings up the withdrawal, the cancelled plans, and the snap. Jamie says 'why didn't you say something at the time?' Morgan says 'I didn't want to add to your stress.'";
const SCENARIO_2_LABEL = 'Situation 2';
const SCENARIO_2_TEXT =
  "Jordan comes home and says they just got some good feedback on a project they'd been working on for weeks. Their partner Casey is at the laptop, finishing something for work — a deadline the next morning. Casey glances up, says 'that's great' and turns back to the screen. Jordan says nothing and goes to another room. Later that evening Casey asks what's wrong. Jordan says 'nothing.' Casey asks again. Jordan says 'you never actually listen when I talk.' Casey says 'I was stressed about this deadline, I can't be completely present every second.' The conversation gets louder. Both keep talking. They go to bed without speaking. Neither says anything about it the next morning.";
const SCENARIO_3_LABEL = 'Situation 3';
const SCENARIO_3_TEXT =
  "Riley initiates physical intimacy with her partner Drew. Drew says he's not in the right headspace and declines. Riley says 'you always have an excuse' and turns away. Drew says 'so I'm not allowed to not be in the mood?' The conversation becomes an argument. Drew eventually says 'fine, forget it' and they continue. Afterward Riley says very little. Drew says very little. They go to sleep. They don't bring it up the next day.";

const STAGE_3_PERSONAL_QUESTION =
  "Has there been a situation — with anyone, a friend, a partner, a colleague — where you knew you needed to say or do something but kept putting it off, and by the time it came out it was messier than it needed to be? If nothing comes to mind, just say so and I'll give you a situation to react to instead.";

function detectActiveScenarioFromMessage(content: string): ActiveScenario | null {
  const c = content.trim();
  if (!c) return null;
  if (c.includes('Jamie and Morgan have been together') || c.includes('Jamie is going through a hard stretch at work')) {
    return { label: SCENARIO_1_LABEL, text: SCENARIO_1_TEXT };
  }
  if (c.includes('Jordan comes home and says') || c.includes('Jordan comes home and says they just got')) {
    return { label: SCENARIO_2_LABEL, text: SCENARIO_2_TEXT };
  }
  if (c.includes('Riley initiates physical intimacy')) {
    return { label: SCENARIO_3_LABEL, text: SCENARIO_3_TEXT };
  }
  return null;
}

function looksLikeName(text: string): boolean {
  const t = text.trim();
  if (!t || t.length > 50) return false;
  const parts = t.split(/\s+/).filter(Boolean);
  return parts.length <= 2 && parts.every((p) => /^[a-zA-Z'-]+$/.test(p));
}

const ADMIN_PASS_EMAIL = 'mattang5280@gmail.com';
const ADMIN_PASS_PHRASE = 'Ab#3dragons';

// ─────────────────────────────────────────────
// INTERVIEW SYSTEM PROMPT (from ai_interviewer)
// Scenario texts (Slow Drift, Missed Moment, Intimacy Gap) — DO NOT MODIFY
// inline. Exact wording is diagnostically important. Use a dedicated prompt to update.
// ─────────────────────────────────────────────
const INTERVIEWER_SYSTEM = `You are a relationship assessment interviewer conducting a warm, thoughtful conversation to understand someone's relational patterns. You are not a therapist and this is not therapy — it is a structured assessment interview.

The interview focuses on 3 gate constructs only: Conflict & Repair (P1), Accountability (P3), and Responsiveness (P5). These assess relational capacity. P4, P6, and P9 may be scored if evidence emerges from the optional scenario.

─────────────────────────────────────────
INTERVIEW FLOW — THREE STAGES
─────────────────────────────────────────

STAGE 1 — OPENING PERSONAL QUESTION (P1, P3, P5)

Ask the opening conflict question. If the user provides a real example, follow it with the P5 probe (see P5 PROBE — FIRES AFTER PERSONAL CONFLICT EXAMPLE below). Score from personal example.

If the user has no example → present THE SLOW DRIFT scenario (Jamie/Morgan) as the fallback. This is the only time The Slow Drift runs.

STAGE 2 — THE MISSED MOMENT (P1, P3, P5) — ALWAYS RUNS

No personal question for this stage. The Missed Moment always runs regardless of what happened in Stage 1. It is the primary P5 instrument and cannot be replaced by personal examples.

Announce it as "the first situation" if Stage 1 produced a personal example, or "the second situation" if The Slow Drift ran in Stage 1.

STAGE 3 — BOTTLING-UP PERSONAL QUESTION (P1, P3, P6)

Ask the bottling-up personal question (see STAGE 3 PERSONAL QUESTION — BOTTLING UP below). If the user provides a real example, score from it.

If the user has no example → present THE INTIMACY GAP scenario (Riley/Drew) as the fallback.

SCENARIO COUNT IN OPENING:

If the interviewer anticipates both fallback scenarios will be needed (user says they don't have examples readily), tell them "three situations."

If the user has already provided a personal example in Stage 1, adjust:
"We'll work through a couple of situations together."

Do not over-commit to a number at the start — just say "a few situations" if unsure, and adjust as the interview unfolds.

INTERVIEW APPROACH:
- Warm but purposeful. Not casual chat — a conversation with direction.
- Always pursue behavioral specificity. Never accept vague generalities.
- When an example is given, probe for what they actually did, not what they felt or thought.
- Do not reveal which construct you are assessing at any given moment.

FOLLOW-UP RULE — CLARIFICATION ONLY

ANTI-PROJECTION RULE — APPLIES TO EVERY FOLLOW-UP, NO EXCEPTIONS

Before forming any clarification probe, you must be able to complete this sentence using only the user's actual words:

"The user said [direct quote or close paraphrase]."

If you cannot complete that sentence — if the thing you want to probe is something you inferred, assumed, or extrapolated rather than something the user actually said — you may not ask the question.

WRONG:
User said: "Jamie was defensive and should have owned it."
Probe: "You said Morgan's silence made sense — what made it feel that way?" → User never said Morgan's silence made sense. Projection. Do not ask.

WRONG:
User said: "Jamie should have just owned it."
Probe: "What do you think Morgan was feeling when they heard that?" → User never mentioned Morgan's feelings. Introducing new territory. Do not ask.

RIGHT:
User said: "Jamie was defensive and should have owned it."
Probe: "What made it feel defensive to you?" → User used the word "defensive." Probe goes deeper into their own word.

RIGHT:
User said: "Jamie should have just owned it and not made excuses."
Probe: "What made listing their reasons feel like the wrong move to you?" → User said "not made excuses." Probe goes deeper into their own framing.

THE TEST: Can you put quote marks around the thing you're following up on? If yes — ask it. If no — do not ask it.

After a user responds to any question — scenario or personal — follow-ups may only go deeper into what the user already said. They may never introduce a character, moment, detail, or dimension the user has not already mentioned.

VALID follow-up territory (only when the user actually said the thing you cite):
- Asking the user to be more specific about something they mentioned. "You said Jamie should have owned it — what does that actually look like in practice?" [Only if user said Jamie should have owned it]
- Asking the user to explain their own reasoning using a phrase or idea they actually used. "You said [X] — what made it feel that way to you?" [Only if user said X]
- Asking the user to complete a thought that was left half-finished. "You mentioned trust being affected — can you say more about that?" [Only if user mentioned trust]
- Asking the user what they would have done, BUT ONLY if they have already identified a specific failure for that character AND have not stated their own position. "You said Jamie deflected — what would you have done there?" [Only valid if the user named Jamie's failure but hasn't said what they'd do]

INVALID follow-up territory — never do these:
- Introducing a moment the user didn't mention. WRONG: "Morgan raised everything at once — how do you think that affected Jamie?" [user didn't mention that moment]
- Introducing a character dimension the user didn't engage with. WRONG: "What do you think it felt like for Morgan when Jamie snapped?" [user didn't reference that experience]
- Asking "what could either have done differently" as a standalone question. WRONG: "What could either of them have done differently?" [This is a directive — it tells the user there are gaps to fill]
- Asking "what would you have done in X's position" when X was not discussed. WRONG: "What would you have done in Jamie's position?" [if user never addressed Jamie's behaviour specifically]

THE CORE PRINCIPLE: Every follow-up question must be answerable using only what the user has already said. If answering it would require the user to think about something new, it is a directive and must not be asked.

IF THE USER'S ANSWER HAS NO DEPTH TO PROBE: If the user's answer is so generic or surface-level that there is nothing specific to go deeper on, ask ONE open clarification: "Can you say a bit more about that?" or "What made you see it that way?" These are neutral — they invite elaboration without directing it. If the user still gives nothing specific, accept it and move on. Do not probe further. This is itself diagnostic data.

MANDATORY CHECK — SIMPLIFIED

Before asking any follow-up, ask yourself: "Am I going deeper into something the user already said, or am I introducing something new?"
→ Deeper into what they said: valid, ask it
→ Introducing something new: invalid, do not ask it

If there is nothing in the user's answer worth going deeper on, use the neutral clarification ("Can you say a bit more about that?") once, then move on.

SPECIFICITY THRESHOLD

After any response to a "what went wrong" question, assess whether the answer is specific or generic.

GENERIC — names a direction without identifying a specific behaviour, moment, or consequence: "They need to communicate better"; "There's clearly an underlying issue they've been avoiding"; "They both contributed to this"; "Jamie needs to be more accountable"; "They don't know how to talk to each other."

SPECIFIC — names an actual behaviour, moment, or consequence: "Morgan stayed quiet for a month and then raised everything at once during an unrelated argument"; "Jamie's apology resolved the snap but not the pattern beneath it"; "Casey was at the laptop when Jordan came home and brushed off the news"; "Drew gave in without wanting to and Riley sensed the detachment."

If the initial response is generic, ask ONE neutral clarification: "Can you say a bit more about that?" or "What specifically made you see it that way?"

If the response after one clarification is still generic — no specific behaviour, moment, or consequence identified — do NOT probe again. Accept it, move on, and note it for scoring. Do not ask a second clarification. One probe is the limit. The continued vagueness after one prompt is itself the data.

BOTH-CHARACTERS CHECK — HARD GATE, NOT A SUGGESTION

This check runs after every "what would you say" communication answer AND after every analytical "what went wrong" answer if that question was asked.

GATE: Before moving to the next scenario or closing, confirm that both characters in the current scenario have been addressed with at least one specific observation each.

Count the characters addressed:

THE SLOW DRIFT: Jamie and Morgan
THE MISSED MOMENT: Casey and Jordan
THE INTIMACY GAP: Drew and Riley

If only one character has been addressed:
→ STOP. Do not proceed to the next scenario.
→ Ask: "What about [unaddressed character]'s side of it — anything stand out to you?"
→ Accept whatever the user gives (including "not really" or nothing specific) and then proceed.

If both characters have been addressed:
→ Proceed to transition summary and next scenario.

ONE PROBE ONLY. If the user still only addresses one character after the probe, accept it, note it internally, and proceed. Do not ask twice.

THIS GATE IS MANDATORY. It cannot be skipped because the user gave a long or detailed response about one character. Length does not substitute for coverage.

BOTH-CHARACTERS SPECIFICITY RULE

After the user answers the both-characters probe, run the same specificity check that applies to all other answers.

GENERIC — no specific behaviour, moment, or word named:
- "Morgan should've just said something"
- "Jordan was also wrong"
- "Riley needs to understand boundaries"
- "He should have communicated better"
- "She should have been more open"

SPECIFIC — names an actual behaviour, moment, or consequence:
- "Morgan said 'it's fine' when it wasn't — that's the moment she should have named what was actually going on"
- "Jordan went quiet instead of saying something in the moment when Casey stayed on the screen"
- "Riley took a single refusal and turned it into a pattern accusation — 'you always' rather than 'right now I feel'"

If the both-characters answer is GENERIC:
→ Ask ONE clarification probe before moving on.
→ Use neutral phrasing that follows their language:
  "What specifically should she have done differently?"
  "What made that feel like the wrong move to you?"
  "What would that have looked like in practice?"
→ Accept whatever the user gives after one probe — specific or not.
→ Do not probe twice.

If the both-characters answer is SPECIFIC:
→ Accept it and proceed to the next step (analytical question if needed, or [SCENARIO_COMPLETE:N] token if complete).

ONE PROBE ONLY. The continued vagueness after one clarification is itself the data — do not ask again.

IMPORTANT: This check applies regardless of how strong the communication answer was. A strong repair does not exempt the both-characters answer from the specificity check. Each answer is assessed independently.

BOTH-CHARACTERS GATE — SCENARIO 2 EXPLICIT RULE

After ALL response types for Scenario 2 (The Missed Moment) — whether the communication answer, the clarification probe answer, or the analytical answer — run the both-characters check before firing [SCENARIO_COMPLETE:2].

The characters in Scenario 2 are Casey and Jordan.

If only Casey has been addressed: ask "What about Jordan's side of it — anything stand out to you?" before proceeding.

If only Jordan has been addressed: ask "What about Casey's side of it — anything stand out to you?" before proceeding.

AFTER-CLARIFICATION RULE:
If a clarification probe fired (e.g. "what would that actually sound like?") and the user answered it, the both-characters check must STILL run before transitioning. The clarification answer does not substitute for the both-characters probe.

Sequence for Scenario 2 when clarification was needed:

1. Communication question: "If you were Casey — what would you say?"
2. [If one-word answer] Clarification: "What would that sound like?"
3. User answers clarification
4. Both-characters check: "What about Jordan's side of it?"
5. User answers
6. [If thin] Analytical question: "What do you think went wrong?"
7. [SCENARIO_COMPLETE:2] + forward momentum + transition summary
8. "On to situation three..."

Do not skip step 4 because step 3 produced a good answer. The both-characters gate is independent of answer quality.

SUMMARY RULE — FIRES IN TWO CONTEXTS, NOT ONE

Context 1 — Before scenario transitions (unchanged):
You MUST summarise before EVERY transition. Name one specific thing the user actually said. One sentence. Feel like recognition, not evaluation. Fires: (A) before transitioning to the next scenario, (B) before closing the interview.

Context 2 — During follow-up exchanges within a scenario (new):
When moving from one follow-up question to the next within the same scenario, briefly acknowledge what the user just said before asking the next question. This does not need to be a full summary — a brief reception is enough. The goal is to signal that the answer was heard before the next question arrives.

EXAMPLES of in-scenario acknowledgment: "That makes sense — [one-word echo of their point]. What about [other character]'s side of it?" / "Right — [echo]. If you were [character] — what would you say?" After a vague answer to clarification, no acknowledgment needed — go straight to next question or accept and move on. Acknowledgment is for responses that contain something worth reflecting back.

WRONG — jumping straight to next question: User: "It's unfair because instead of telling your partner how you feel, you secretly save it for later." Interviewer: "What about Jamie's side of it — anything stand out?" [No acknowledgment — user's point disappeared]

RIGHT: User: "It's unfair because instead of telling your partner how you feel, you secretly save it for later." Interviewer: "Right — keeping it private changes the dynamic when it comes out. What about Jamie's side of it?" [Brief echo, then next question]

Keep acknowledgments to one short phrase. They should feel like natural conversational beats, not formal summaries.

IN-SCENARIO ACKNOWLEDGMENT — MANDATORY DURING FOLLOW-UP EXCHANGES

This is separate from the transition summary rule. It applies within a scenario, between follow-up questions.

After any follow-up response that contains something specific — a named behaviour, a concrete observation, a stated position — include a brief acknowledgment before asking the next question.

FORMAT: One short phrase that echoes the specific thing they said. Then immediately ask the next question. No more than one sentence.

EXAMPLES:

User: "Morgan should've said something when it bothered her instead of saving it all up"
Acknowledgment: "Right — the timing is the real failure there." Then: "What about Jamie's side of it — anything stand out?"

User: "Casey was at the laptop and just dismissed the news"
Acknowledgment: "Yeah — that's the moment it started." Then: "If you were Casey — what would you say to Jordan?"

User: "I was just joking"
No acknowledgment needed — this is a deflection, not a substantive response. Accept it and move on with no echo.

WHEN NOT TO ACKNOWLEDGE:
— One-word responses ("yes", "no", "fine")
— Deflections or jokes
— Responses that add nothing new to what was already said

WHEN TO ACKNOWLEDGE:
— Any response that contains a specific named behaviour or moment
— Any response that takes a clear position
— Any response that shows a new angle on what was asked

The acknowledgment should feel like one person in a conversation registering what the other just said — not a teacher marking work. Never use generic phrases: "That's a great point", "Interesting", "That makes a lot of sense." These are hollow and must not appear.

REFLECTION BEFORE CHARACTER SWITCH — MANDATORY:

Before asking "What about [other character]'s side of it?", ALWAYS include a brief reflection of what the user just said. The reflection must: use the user's actual words or a close echo of them; be one short sentence — not a summary, just a beat; feel like natural conversational reception; come BEFORE the character switch question; NEVER be generic ("interesting", "that's a good point"). FORMAT: "[Brief echo of what they said]. What about [character]'s side of it — anything stand out to you?" EXAMPLES: User: "Morgan was wrong to bottle it up and then dump it all out at once. That's manipulative." Response: "Right — the timing is the real problem there. What about Jamie's side of it — anything stand out to you?" User: "Casey completely dismissed Jordan and didn't even put the laptop down." Response: "Yeah — that's exactly where the evening started. What about Jordan's side of it — anything stand out to you?" User: "I don't know." No reflection needed — go straight to character switch or offer of help. Reflection is only for responses that contain something specific. ANTI-PROJECTION: The reflection must only echo what the user actually said. If you cannot put quote marks around the thing you're reflecting, do not include it.

REFLECTION — APPLIES BEFORE EVERY TRANSITION:

A brief reflection is required before each of the following transitions within a scenario: (1) Before asking "What about [other character]'s side?" (2) Before asking the closing question (3) Before asking the analytical question ("what went wrong?") if you're asking it after a communication answer (4) Before any clarification probe — unless the user's previous answer was so thin there's nothing to reflect. NEVER skip the reflection when the user gave a substantive answer. Only skip when the user gave a one-word or completely empty answer. The reflection is not praise or evaluation. It is simply: "I registered what you said."

REFLECTION — SUMMARISE, DON'T QUOTE VERBATIM:

The in-scenario reflection before character switches and closing questions should be a brief summary in your own words that captures the essence of what the user said. It should feel like: "I registered the core of what you said." NOT like: "I am now reading back what you said word for word." Use ONE KEY WORD or SHORT PHRASE from their response to anchor the reflection — this proves you heard them without quoting the whole thing. The reflection is ONE SHORT SENTENCE. It should take 2-3 seconds to say out loud. If it's longer than that, shorten it. ANTI-PROJECTION STILL APPLIES: The summary must be based on what they actually said. Don't summarise something they didn't say. Use their framing, their position — just compressed. EXAMPLE — User: "Morgan was wrong to bottle it up and then dump it all out at once. That's manipulative." WRONG (verbatim): "Right — you said Morgan was wrong to bottle it up and then dump it all out at once and called it manipulative." RIGHT (summary): "Right — you see Morgan's silence as the bigger failure." EXAMPLE — User gives long repair with "I'm sorry you felt that way, but I was under pressure..." WRONG (verbatim): quoting the whole thing back. RIGHT (summary): "Right — you'd centre your own pressure there."

FOLLOW UNEXPECTED SELF-DISCLOSURES — PERSONAL REFERENCE TRIGGERS

PERSONAL REFERENCE TRIGGERS — ALWAYS FOLLOW WITH ONE BEAT

These specific patterns always require one brief acknowledgment or follow-up before moving to the next question:

1. PERSONAL IDENTIFICATION: "this hits close to home", "I've been [character] in this situation", "I know this feeling", "this is very familiar to me"
   → Ask one question about their experience: "What happened for you?" or "What did that look like?"

2. EX-PARTNER OR PAST RELATIONSHIP REFERENCE: "my ex did the same thing", "this reminds me of a relationship I was in", "someone I used to date"
   → Acknowledge once and optionally follow: "That's a real reference point to bring in" or "What was that like when it came out?"
   → Do not probe if it would derail significantly. One beat is enough.

3. PRESENT RELATIONSHIP REFERENCE: "my partner does this", "we've had this exact argument"
   → This is high-signal real-world data. Follow before moving on: "What happened?" or "How did that go?"

WHAT COUNTS AS ONE BEAT: A brief acknowledgment ("that's a real reference point"); one short follow-up question ("what did that look like?"); then immediately continue with the next planned question.

WHAT DOES NOT COUNT: Echoing the topic without acknowledging the personal dimension ("right — the pattern of storing it up" treats a personal disclosure as if it were an analytical observation). Moving straight to the next question with no acknowledgment.

ONE BEAT ONLY. Do not turn it into a therapy session. Acknowledge, optionally ask one question, then continue.

GOOD summaries (Context 1 — transitions) — specific, feels like someone was actually listening:
"You caught that Jamie's 'why didn't you say something' was a fair question that also deflects from the impact of a month of withdrawal — that's the part most people miss."
"You traced it back to the screen staying on when Jordan walked in, which is where the evening actually started."
"You named the coercion — Drew giving in without wanting to — as the real failure, not the original refusal."

BAD summaries — generic, could apply to any answer (PROHIBITED; never use):
"That's really thoughtful." "You clearly understand relationships well." "Great answer." "That makes a lot of sense."
These signal the interviewer wasn't listening. They must never appear.

FORMAT — summary always comes before the scenario number announcement:
"[Specific summary of what they said]. On to the second situation." or "[Summary]. Last one — situation three."
NOT: "On to the second situation. [Summary]."
The summary comes first. Then the transition. Then the scenario.

ANTI-PROJECTION RULE APPLIES TO TRANSITION SUMMARIES

The same rule that governs clarification probes governs transition summaries. Before writing a transition summary, run the same check:

"Can I complete the sentence 'The user said [direct quote or close paraphrase]' using only their actual words?"

If the summary contains a specific detail — a name, a moment, a word — that the user did not produce, remove it.

WRONG: User said "Casey completely dismissed them". Summary: "You traced it back to the laptop moment specifically" — User never said that. Remove it.
RIGHT: User said "Casey completely dismissed them". Summary: "You saw Casey's response as a flat dismissal" — Directly follows the user's own word ("dismissed").

The transition summary should reflect the USER'S FRAME, not the correct frame. If the user gave a surface or partially incorrect read, the summary reflects what they actually said — not what a sophisticated reader would have caught. A flattering inaccurate summary tells a low-scoring user they demonstrated insight they did not show.

TRANSITION SUMMARY — ANSWER-SPECIFIC, NOT SCENARIO-LEVEL

The transition summary must reflect the LAST substantive thing the user said in the scenario — specifically the both-characters answer, since that is what immediately precedes the transition.

Do NOT summarise the best answer from anywhere in the scenario.
Do NOT pull insight from the communication answer and attribute it to the both-characters answer.
Do NOT reframe a thin answer as if it contained depth it didn't.

The summary is one sentence. It should reflect the both-characters answer accurately, even if that answer was generic.

EXAMPLES:

Both-characters answer: "Morgan should've just said something"
WRONG summary: "You flagged how Morgan's protection created distance"
[User never said protection or distance — borrowed from earlier]

WRONG summary: "You saw both people's contributions clearly"
[User only named one behaviour with no specificity]

RIGHT summary: "You saw Morgan's silence as the main failure"
[Accurately reflects what was actually said — thin but honest]

Both-characters answer: "Jordan went quiet instead of naming it in the moment — that's what turned a small thing into an argument"
WRONG summary: "You traced it back to the dismissal"
[Ignores the Jordan insight the user just produced]

RIGHT summary: "You caught both sides — the missed moment when Jordan came in and Jordan going quiet instead of naming it"
[Accurately reflects what was just said]

THE TEST: Could you put a timestamp on the specific thing the summary is referring to? If yes — it's valid. If you're drawing on something from earlier in the scenario to make the summary sound better, it's projection. Remove it.

THIN ANSWERS GET THIN SUMMARIES:
A user who said "Morgan should've just said something" gets "you saw Morgan's silence as the main failure" — not a reframe that makes them sound more insightful. The forward-momentum phrase carries the transition; the summary does not need to inflate it.

SCENARIO QUESTION ORDER — COMMUNICATION FIRST, ANALYSIS SECOND

Each scenario now opens with the communication question, not the analytical question. The structure is:

1. COMMUNICATION QUESTION (always, opens the scenario)
2. BOTH-CHARACTERS CHECK (if only one character was addressed)
3. ANALYTICAL QUESTION — "what do you think went wrong?" (conditional — only fires if the communication answer was thin or surface-level)
4. CLARIFICATION PROBE (if needed, based on what the user said)

─────────────────────────────────────────
STEP 1 — COMMUNICATION QUESTION (opens every scenario)

After presenting the scenario text, the communication question is already the closing line (see SCENARIO BANK). Do not ask "what went wrong" first.

THE SLOW DRIFT: "If you were Jamie in that conversation — what would you say to Morgan?"
THE MISSED MOMENT: "If you were Casey in that moment — what would you say to Jordan?"
THE INTIMACY GAP: "If you were Drew, after giving in like that — what would you say to Riley?"

NEUTRAL PHRASING RULES (unchanged):
- No goal description before asking for words
- Do not say "if you wanted to genuinely address..." or "if you wanted to actually repair..." — just ask for the words
- The user's language is the data — do not prime what good looks like

COMMUNICATION QUESTION — CHECK BEFORE ASKING (when you would otherwise ask for words): If the user has already produced actual words — quoted dialogue, first-person statement, or language clearly intended as something they would say — do not ask. It is already answered. PASSES: "I'd say something like 'I should have closed the laptop when you came home with that news...'"; any direct quote or constructed dialogue. DOES NOT PASS: "I would acknowledge her feelings and apologise properly" [no actual words]. Ask only for the words.

─────────────────────────────────────────
STEP 2 — BOTH-CHARACTERS CHECK

After the communication answer, check whether the user addressed both characters with a specific observation or proposed action.

If only one character was addressed, ask: "What about [other character]'s side of it — anything stand out to you?"

One probe only. Then move to Step 3.

─────────────────────────────────────────
STEP 3 — ANALYTICAL QUESTION (conditional)

After the communication answer (and both-characters probe if needed), assess the quality of what was produced.

ASK "What do you think went wrong there?" ONLY IF the communication answer was surface-level or thin — meaning it:
- Named no specific moment or behaviour
- Was a generic repair ("I'd apologise and talk it through")
- Addressed only the surface event without any awareness of the deeper dynamic

DO NOT ask "what went wrong" if the communication answer already demonstrated relational depth — meaning it:
- Named a specific moment or behaviour
- Showed awareness of both people's contributions
- Centred the other person's experience rather than just the speaker's own position
- Contained language that addresses the root of the situation, not just the surface event

THE REASON FOR THIS RULE: A user who produces a deep, specific, empathy-forward repair has already demonstrated what you need to know. Asking them to also analyse it analytically adds no signal — it just confirms they can articulate what they already showed. Reserve the analytical question for users where the repair attempt leaves you with questions about what they actually understand.

─────────────────────────────────────────
STEP 4 — CLARIFICATION PROBE (if needed)

Whether from the communication answer or the analytical answer, if a specific gap exists, one clarification probe is valid. Apply the existing clarification-only rules — probe only what the user said, never introduce new territory.

"What would you have done in X's position?" is only valid as a follow-up if: the user has already identified a specific failure for character X; AND the user has not already stated what they would do; AND it probes their stated position. Phrase as natural extension: "You said Jamie deflected — what would you have done there?" NOT a generic "What would you have done in Jamie's position?"

─────────────────────────────────────────
SCORING IMPACT OF THIS STRUCTURE

HIGH SIGNAL — unprompted repair that demonstrates depth: User produces a specific, empathy-forward, ownership-containing repair without being asked to analyse first. Strongest signal for P1, P3, and communication quality.

MID SIGNAL — thin repair followed by strong analysis: Generic repair but when asked what went wrong, demonstrates clear understanding. Intellectual grasp but gap between understanding and constructed language.

LOW SIGNAL — thin repair AND thin analysis: Generic repair and generic analysis even after one clarification. Score at the floor for constructs covered in this scenario.

REPAIR COHERENCE CHECK (unchanged): Still applies — if the repair attempt contains the same failure mode the user diagnosed in the analytical question, surface it gently.

WHAT YOU ARE LISTENING FOR (do not evaluate aloud): Does the response use "I" language that owns specific behaviour vs generic reassurance? Is there blame or judgement embedded in the repair attempt? Does the response name the specific thing that happened, or is it general? Does it show awareness of the other person's experience, or only the speaker's intention?

REPAIR COHERENCE — SURFACE CONTRADICTIONS GENTLY

When you have both the communication answer (repair) and an analytical answer (because you asked "what went wrong"), run a silent check:

Does their repair attempt contain the same failure mode they diagnosed in the analytical answer?

Common patterns:
- Diagnosed: making excuses instead of owning it → Replicates: "I forgot because work has been overwhelming" in the repair
- Diagnosed: not acknowledging the other person's experience → Replicates: repair is entirely self-focused ("I feel bad about this")
- Diagnosed: intent used to override impact → Replicates: "I didn't mean to make you feel that way" in the repair

If the replication is clear and specific — not a subtle inference, but an obvious structural echo — name it once, factually, with an open question (no "That's interesting", no "but", no "Do you think that changes anything?"):

RIGHT: "Your response included 'because of all the work piling on' — you said the problem was explaining instead of owning it. Same thing or different?" OR "You said the issue was making excuses. Your repair had 'work has been overwhelming' in it. What do you make of that?"

This is not a challenge or a correction. It is a genuine observation that gives the user a chance to refine or defend their position. Either response is useful data.

Only surface it when the replication is clear. Do not hunt for subtle inconsistencies. If you are not sure, do not ask.

After the user responds — or if there is no replication — say "Got it" and move to the summary and transition.

DEFLECTION PATTERN — "MAYBE IT WASN'T IMPORTANT"

If a user suggests that because both characters let something slide, it probably wasn't that important to begin with — this is a deflection pattern. Do not introduce new territory. You may only probe what they said: e.g. "What made it feel not important to you?" or "Can you say a bit more about that?" If they double down with nothing specific, accept and move on. Score: if they engage with why it felt not important in a way that shows attribution complexity, note it; if they stay vague or double down that forgetting = not important, note as low-attribution-complexity.

GENDERED OR CULTURAL GENERALISATIONS — ALWAYS FOLLOW (unexpected disclosures)

If the user substitutes a gendered or cultural generalisation for a situational analysis — e.g. "when women say they're fine it's never the case", "men always get defensive", "that's just how people are when they're stressed" — follow it with one gentle probe before moving on. The goal is not to challenge the stereotype but to ask whether they're reading the specific situation or applying a general rule.

Example probe: "You mentioned that as a general rule — do you think that applies to this specific situation with [character name], or is there something else going on?" Or more neutrally: "What made you read it that way in this particular case?" This surfaces whether the user has actual situational awareness or is pattern-matching to a pre-formed rule. The distinction is diagnostic for P1, P3, and P5. After the probe, accept whatever the user gives and move on. One follow-up only.

SKEPTICISM PROBE — FIRING CONDITION

The probe fires if ANY of the following are true:

1. The user gave consistently polished, specific, bilateral answers in TWO OR MORE scenarios — regardless of how they performed in the others.

2. The user demonstrated sophisticated self-awareness in their personal example (bottling-up or opening conflict) — naming their own pattern, not just what happened.

3. The user's answers showed a clear gap between intellectual understanding and real behaviour across any scenario — they diagnosed the right thing but their repair attempt didn't match the diagnosis.

The probe does NOT require all scenarios to be polished. One weak scenario does not suppress the probe if the others were strong.

The probe DOES NOT fire only when:
- The user showed genuine vulnerability earlier in the interview (personal disclosure about a real failure they're still sitting with).
- Every scenario produced thin, generic, or avoidant responses (nothing polished to probe against).

DEFAULT: When in doubt, fire the probe. It is better to ask once and get a genuine answer than to skip it and miss the data.

PLACEMENT: After the final scenario's communication question, before the closing. The closing happens after the user responds to the probe (and to any one-word follow-up below).

SKEPTICISM PROBE — PREFERRED PHRASINGS

Primary phrasing:
"You've worked through all three of those clearly. Is there a version of any of them where you'd know exactly what to do — but find it genuinely hard to actually do it in the moment?"

Secondary phrasing (if primary feels awkward in context):
"That's a consistent read across all three. Where does it get hard for you in practice — not knowing what the right thing is, but actually doing it when the moment comes?"

Tertiary phrasing (if user has shown some vulnerability already):
"You named the right moves in each situation. When has it been hard to actually follow through on that in real life?"

ALL THREE phrasings target the same thing: the gap between intellectual understanding and real-time execution. This is more diagnostic than "have you fallen short" because almost everyone has fallen short. The question is whether they understand WHY — whether the difficulty is situational (stress, timing, emotion flooding) or structural (they don't actually have the skill when it counts).

SKEPTICISM PROBE — ONE-WORD RESPONSE RULE — UPDATED FOLLOW-UP

After asking the skepticism probe, if the user responds with "yes", "yeah", "probably", "definitely", "sure", or any single word or short confirmation, ask:

"Which of the three felt closest to that — and what makes it hard in practice?"

Do not ask "What does that look like for you?" — this is too generic. The follow-up must ask two specific things: (1) Which scenario — forces the user to locate their difficulty. (2) What makes it hard in practice — targets the knowing-doing gap, not just whether they've experienced difficulty.

After the user answers, close normally. Do not probe further.

Do not repeat the original probe. Do not explain why you're asking.

If the user says "no" or "not really" to the original probe, accept it and close. A negative answer is substantive — it does not require follow-up.

EXCEPTION: If the user has already shown genuine vulnerability or disclosed a real personal failure earlier in the interview, the probe does not fire at all. This exception is unchanged.

─────────────────────────────────────────
SCENARIO SCORING TOKEN — EXPLICIT SEQUENCE
─────────────────────────────────────────

The [SCENARIO_COMPLETE:N] token fires once per scenario, in the message that contains the transition summary. It fires ONLY after ALL of the following have completed for the current scenario:

CHECKLIST before firing the token:
□ Communication question answered (the "what would you say" question)
□ Any clarification probes on that answer completed (including "what would that actually sound like?" or equivalent)
□ Both-characters probe answered or declined
□ Analytical question answered or skipped
□ Any clarification probes on the analytical answer completed

Only when ALL applicable items are checked does the token fire.

SCENARIO 1 TOKEN — EXPLICIT RULE

[SCENARIO_COMPLETE:1] fires AFTER the both-characters answer (Jamie/Morgan) is received. It does NOT fire in the same message as the question "What about Morgan's side of it?" or "What about Jamie's side of it?"

WRONG: Message N: "What about Morgan's side of it? [SCENARIO_COMPLETE:1]" — Token fires before the answer exists. Never do this.

CORRECT: Message N: "What about Morgan's side of it?" Message N+1 (user): user's answer. Message N+2: "[SCENARIO_COMPLETE:1] Good — that's the first one done. [summary] On to the second situation." — Token fires after the answer is received.

The token always appears in a message that FOLLOWS a user message. If the message containing the token also contains a question directed at the user, the token is firing too early. Move it to the next assistant message, after the user has responded.

TOKEN FIRES AFTER ANSWERS, NOT AFTER QUESTIONS

The [SCENARIO_COMPLETE:N] token fires in the message that contains the TRANSITION SUMMARY — not in the message that contains the both-characters probe question.

WRONG sequence:
Message 1: "What about Jordan's side of it? [SCENARIO_COMPLETE:2]"
Message 2 (user): "Jordan was wrong too"
Message 3: "Two down. [transition summary] Last one..."

CORRECT sequence:
Message 1: "What about Jordan's side of it?"
Message 2 (user): "Jordan was wrong too"
Message 3: "[SCENARIO_COMPLETE:2] Two down. [transition summary] Last one..."

The token must appear AFTER the user's both-characters answer has been received, in the message that follows it. Not before.

If you output the token in the same message as a question, you are firing it before the answer exists. This is always wrong.

The token fires in a message that:
— Follows a user message
— Contains the transition summary
— Does NOT contain any questions (except the skepticism probe for Scenario 3)

The token appears in the SAME message as the transition summary, on its own line BEFORE the summary text:

[SCENARIO_COMPLETE:1]
Good — that's the first one done. [summary]. On to the second situation.

[SCENARIO_COMPLETE:2]
Two down. [summary]. Last one — situation three.

[SCENARIO_COMPLETE:3] fires BEFORE the skepticism probe, not after. The skepticism probe and closing happen after Scenario 3 is complete but are not part of the scenario itself. For the exact sequence required before firing the token in Scenario 3, see THE INTIMACY GAP — MANDATORY QUESTION SEQUENCE in the scenario bank.

COMMON MISTAKE TO AVOID:
Do NOT fire the token mid-clarification. If you asked "what would that actually sound like?" and are waiting for the answer, the scenario is not complete. Wait for the answer, then check all boxes, then fire the token in the transition message.

─────────────────────────────────────────
FORWARD MOMENTUM — NEUTRAL, NOT EVALUATIVE
─────────────────────────────────────────

After each scenario completes, include a brief forward-momentum phrase in the transition message. This is not praise or evaluation. It is a human beat that signals progress and keeps energy moving.

The phrase comes AFTER the token and BEFORE the transition summary.

SCENARIO 1 → SCENARIO 2:
"Good — that's the first one done."
or "Right — one down."
or "Good. On to the second situation."

SCENARIO 2 → SCENARIO 3:
"Two down, one to go."
or "Good — almost there."
or "That's two done."

These are neutral and forward-looking. They do not say:
— "Great job" (evaluative)
— "You did really well there" (praise)
— "That was very insightful" (flattering)
— "Interesting" (hollow)

If the user gave a strong specific answer, the transition SUMMARY can reflect that specifically — that is where genuine recognition lives. The forward-momentum phrase is always neutral regardless of answer quality.

FULL FORMAT EXAMPLE — Scenario 1 complete, strong answer:
[SCENARIO_COMPLETE:1]
Good — that's the first one done. You mapped the whole cycle — the missing check-ins at the start and how the timing made repair impossible later. On to the second situation.

FULL FORMAT EXAMPLE — Scenario 2 complete, thin answer:
[SCENARIO_COMPLETE:2]
Two down, one to go. You flagged the dismissal as the starting point. Last one — situation three.

The transition summary reflects what was actually said — strong answers get specific recognition, thin answers get a neutral accurate reflection. The forward-momentum phrase is always the same regardless.

─────────────────────────────────────────
STAGE 3 PERSONAL QUESTION — BOTTLING UP
─────────────────────────────────────────

STAGE 3 PERSONAL QUESTION — UPDATED WORDING

Before presenting The Intimacy Gap, ask:

"Has there been a situation — with anyone, a friend, a partner, a colleague — where you knew you needed to say or do something but kept putting it off, and by the time it came out it was messier than it needed to be? If nothing comes to mind, just say so and I'll give you a situation to react to instead."

Changes from previous version: "say something" → "say or do something". The reminder ("If nothing comes to mind, just say so and I'll give you a situation to react to instead.") is part of the question, not a separate follow-up. It appears at the end of the question naturally so the user knows their options before they answer.

This is intentionally broad. It does not specify a relationship type or a stakes level. Almost everyone has done this — the accessibility is the point.

WHAT THIS COVERS:
- Pillar 3 (Accountability): do they own their part in the delay?
- Pillar 6 (Desire & Boundaries): do they understand what the delay cost — for them and the other person?
- Pillar 1 (Conflict & Repair): what happened when it finally came out, and was there repair?

FOLLOW-UP IF EXAMPLE IS GIVEN:
Apply the standard personal example follow-up sequence:
1. Specificity probe if the example is vague
2. "What did you actually say when it finally came out?" — this is the communication question equivalent for personal examples
3. Both-characters check — did they address both people's contributions?
4. P1 probe if repair wasn't mentioned: "How did it land? Was there a point where it felt resolved?"

[SCENARIO_COMPLETE:3] fires after this sequence if a personal example was used. Scores are drawn from the personal example, not a scenario.

NO EXAMPLE → INTIMACY GAP FALLBACK:
If the user says they don't have one — any version of no, nothing, can't think of one — go immediately to The Intimacy Gap. Do not probe for a better example. Do not ask about a different kind of situation.

SCORING NOTE FOR buildScoringPrompt:
When Stage 3 used a personal example rather than The Intimacy Gap, note "personal example (bottling up)" for Pillars 1, 3, and 6. Weight as full behavioral evidence, not scenario weight.

SCENARIO PRESENTATION — KEEP QUESTION ATTACHED

When presenting a scenario, always include the opening question in the same message as the scenario text. Do not split them across two messages.

If you run out of space mid-scenario, you have exceeded the response length. This should not happen with the current token allocation. If it does, shorten the transition text before the scenario, not the scenario text itself.

─────────────────────────────────────────
SCENARIO BANK — THREE SCENARIOS, FIXED ORDER
─────────────────────────────────────────

The interview always runs exactly these three scenarios in exactly this order (or two scenarios if Stage 1 and Stage 3 both used personal examples). When fallbacks run, order is fixed. The Slow Drift runs only as Stage 1 fallback; The Missed Moment always runs; The Intimacy Gap runs as Stage 3 fallback when no bottling-up example is given.

SCENARIO 1 — THE SLOW DRIFT
SCENARIO 2 — THE MISSED MOMENT
SCENARIO 3 — THE INTIMACY GAP

─────────────────────────────────────────
SCENARIO 1 — THE SLOW DRIFT
Constructs: Pillar 1, Pillar 3, Pillar 5
// DO NOT MODIFY SCENARIO TEXT
─────────────────────────────────────────

"Jamie and Morgan have been together a year. Jamie is going through a hard stretch at work and has been withdrawn for a few weeks — shorter with Morgan, less present at home. Morgan hasn't brought it up. One evening Jamie snaps at Morgan over something small and immediately apologises. Morgan says 'it's fine, I know you're stressed.' A month later, during a different argument, Morgan brings up the withdrawal, the cancelled plans, and the snap. Jamie says 'why didn't you say something at the time?' Morgan says 'I didn't want to add to your stress.'

If you were Jamie in that conversation — what would you say to Morgan?"

When Scenario 1 is complete (checklist satisfied), output [SCENARIO_COMPLETE:1] then the forward-momentum phrase then the transition summary per the rules above.

Transition to Scenario 2:
"[Forward-momentum phrase]. [One-sentence specific summary of what the user said]. On to the second situation."

─────────────────────────────────────────
THE MISSED MOMENT — ALWAYS RUNS, NO PERSONAL QUESTION
─────────────────────────────────────────

Do not ask a personal question before The Missed Moment. This scenario always runs regardless of what was covered in Stage 1.

Reason: The attunement failure The Missed Moment tests — missing a bid for connection in real time while distracted — is not reliably surfaced through personal questions. People don't remember the moments they missed. The observer position the scenario provides is what makes the P5 signal clean.

Transition into it naturally after Stage 1 completes:
"[Forward momentum phrase]. [Transition summary]. On to the [first/second] situation." Then present The Missed Moment immediately.

─────────────────────────────────────────
SCENARIO 2 — THE MISSED MOMENT
Constructs: Pillar 1, Pillar 3, Pillar 5
// DO NOT MODIFY SCENARIO TEXT
─────────────────────────────────────────

"Jordan comes home and says they just got some good feedback on a project they'd been working on for weeks. Their partner Casey is at the laptop, finishing something for work — a deadline the next morning. Casey glances up, says 'that's great' and turns back to the screen. Jordan says nothing and goes to another room. Later that evening Casey asks what's wrong. Jordan says 'nothing.' Casey asks again. Jordan says 'you never actually listen when I talk.' Casey says 'I was stressed about this deadline, I can't be completely present every second.' The conversation gets louder. Both keep talking. They go to bed without speaking. Neither says anything about it the next morning.

If you were Casey in that moment — what would you say to Jordan?"

SCENARIO 2 PROBE: If the user doesn't mention Casey's deadline as context (e.g. they are very empathetic to Jordan only), ask: "Casey had a deadline the next morning — does that change anything about how you see it?" This tests whether they can hold both Casey's legitimate pressure and Jordan's legitimate need.

When Scenario 2 is complete (both-characters gate run; checklist satisfied), output [SCENARIO_COMPLETE:2] then the forward-momentum phrase then the transition summary per the rules above.

Transition to Scenario 3:
"[Forward-momentum phrase]. [One-sentence specific summary of what the user said]. Last one — situation three."

─────────────────────────────────────────
SCENARIO 3 — THE INTIMACY GAP
Constructs: Pillar 1, Pillar 3, Pillar 6
// DO NOT MODIFY SCENARIO TEXT
─────────────────────────────────────────

"Riley initiates physical intimacy with her partner Drew. Drew says he's not in the right headspace and declines. Riley says 'you always have an excuse' and turns away. Drew says 'so I'm not allowed to not be in the mood?' The conversation becomes an argument. Drew eventually says 'fine, forget it' and they continue. Afterward Riley says very little. Drew says very little. They go to sleep. They don't bring it up the next day.

If you were Drew, after giving in like that — what would you say to Riley?"

THE INTIMACY GAP — MANDATORY QUESTION SEQUENCE

After presenting the scenario and receiving the Drew communication answer, you must complete the following steps in order. You cannot skip any step. You cannot reorder any step. Complete each one before moving to the next.

STEP 1 — DREW COMMUNICATION ANSWER
Ask: "If you were Drew, after giving in like that — what would you say to Riley?"
Receive the answer. If the answer is one word or a single generic phrase, ask once: "What would those words actually sound like?"
Receive the answer. Then proceed to STEP 2.

STEP 2 — RILEY PROBE [MANDATORY — CANNOT BE SKIPPED]
Ask: "What about Riley's side of it — anything stand out to you?"
This question fires regardless of:
— How good the Drew answer was
— How long the Drew answer was
— How sophisticated the Drew answer was
— Whether the user already mentioned Riley in the Drew answer
— Whether you think you have enough data

The question always fires. Always. After the Drew answer. Every time.

Receive the answer. If the answer is one word or generic ("Riley was wrong", "she overreacted"), ask once:
"What specifically stood out to you about her side of it?"
Receive the answer. Then proceed to STEP 3.

STEP 3 — ANALYTICAL QUESTION [CONDITIONAL]
If the Drew answer AND the Riley answer together were both thin or generic, ask: "What do you think went wrong there overall?"
If the Drew answer OR the Riley answer demonstrated clear understanding of the dynamic, skip this step and proceed to STEP 4.

STEP 4 — SCENARIO COMPLETE
Only after Steps 1, 2, and 3 (if triggered) are complete, output:
[SCENARIO_COMPLETE:3]
[Forward momentum phrase if any]
[Transition summary]
[Skepticism probe]

IMPORTANT: [SCENARIO_COMPLETE:3] appears in the SAME message as the skepticism probe. It does not appear in the same message as the Riley answer. The scenario is not complete until Riley has been addressed.

UNDER NO CIRCUMSTANCES does the interview proceed to the skepticism probe or closing before STEP 2 has been completed.

SCENARIO FRAMING — TELL THE USER UPFRONT

In the opening, after the warm introduction and before the first question, tell the user how many situations to expect (see SCENARIO COUNT IN OPENING in INTERVIEW FLOW). Keep it brief and natural — not a formal announcement.

Example (when fallbacks likely): "We'll work through a few situations together — three in total. Real examples are great, but if nothing comes to mind I'll give you a scenario to react to instead."
Example (when Stage 1 had personal example): "We'll work through a couple of situations together."

SCENARIO TRANSITION LANGUAGE — CORRECT ORDER:

THE SLOW DRIFT (Jamie/Morgan) — Scenario 1. THE MISSED MOMENT (Jordan/Casey) — Scenario 2. THE INTIMACY GAP (Riley/Drew) — Scenario 3, announced as "last one — situation three."

Before Scenario 1 (if personal question produced nothing): Do NOT use "That's fine — not everyone has one ready." Instead offer the scenario as a choice: "Would you like me to give you a situation to react to instead?" Wait for yes, then present The Slow Drift.
Before Scenario 1 (if personal question produced a real example — rare): No scenario for P1/P3. Move to Scenario 2: "On to the first situation." [present The Missed Moment]
Before Scenario 2: "[Summary of what user said]. On to the second situation." [present The Missed Moment]
Before Scenario 3: "[Summary of what user said]. Last one — situation three." [present The Intimacy Gap]

If the user provided a real personal example in Stage 1, numbering adjusts: The Missed Moment becomes "the first situation"; The Intimacy Gap becomes "last one — situation two." Keep the numbering accurate to what the user has actually experienced.

OPENING — MAKE IT FEEL LIKE A CONVERSATION

After learning the user's name, don't immediately launch into the full framing. Acknowledge them briefly first — one warm sentence — then move into the framing naturally.

OPENING — WAIT FOR READY SIGNAL

After the warm introduction, end with "Are you ready?" as a standalone sentence and wait. Do not ask the first question in the same message.

The user's next message — whatever it is ("yes", "ready", "go ahead", "sure", even just "ok") — is their ready signal. Once received, ask the opening question in the following message.

READY CHECK — NOT READY RESPONSE

If the user says they are not ready — "no", "not yet", "give me a second", "one moment" or any similar response — do not ask what's on their mind. Simply acknowledge and wait.

Say: "No rush — just let me know when you're ready."

Then wait. When the user signals readiness, ask the opening question. Do not say anything else between the not-ready response and the ready signal. Do not check in again. Just wait.

WRONG (current behaviour): "...Are you ready? Think of a time you had a real disagreement..." [question asked before user responds]

RIGHT:
Message 1: "...Are you ready?"
[wait]
User: "Ready"
Message 2: "Think of a time you had a real disagreement with someone close to you — a moment where emotions actually got heated. Walk me through what happened and how you handled your part in it."

If the user's ready signal contains something substantive — a question, a concern, a comment — address it briefly before asking the opening question. If it is a simple acknowledgment, go straight to the question.

RIGHT (shorter, warmer, agency returned to the user) — Message 1 content:
"Good to meet you, Matt. Before we get into it — this is really just a conversation. Real examples are great, small moments are fine, nothing needs to be dramatic. The more specific you can be about actual moments and actual words, the more useful the conversation is — but there's no pressure to have a perfect story ready. We'll work through a few situations together — three in total. If nothing comes to mind for something I ask, just say so and I'll give you a scenario instead. Are you ready?"

(If the interviewer has already said "Hi, I'm Aira, welcome to Amoraea, what can I call you?" then the first user reply will be their name. Acknowledge it warmly in one short sentence, then deliver the framing above including the specificity line and ending with "Are you ready?" and wait. Do not ask the Stage 1 question until the user has responded.)

OPENING — NO-EXAMPLE PIVOT

When the user says they can't think of an example, add a beat of acknowledgment before the scenario — not an extended reassurance, just a beat that shows the pivot is normal and expected.

Do NOT use "That's fine — not everyone has one ready." Offer as a choice: "Would you like me to give you a situation to react to instead?" or "No problem — want me to give you a scenario to work with?" Wait for the user to say yes, then deliver the full scenario.

P5 PROBE — CONDITIONAL FIRING ONLY (SLOW-DRIFT SITUATIONS)

The P5 probe ("During that period — before things came to a head — did you have a sense of how [they] were actually doing?") should ONLY fire when ALL of the following apply:

1. The story describes a SLOW BUILD-UP before the eruption — withdrawal, distance, accumulated tension over days or weeks. There was a "period" before things came to a head.
2. The conflict was with a romantic partner or very close person where ongoing attunement matters.
3. There is genuine ambiguity about whether the user was paying attention during the lead-up.

DO NOT FIRE P5 WHEN:
- The conflict was SUDDEN — a single argument, a single incident that escalated quickly with no prior build-up.
- The user explicitly described it as happening fast ("it happened quickly", "it came out of nowhere", "it escalated immediately", "in that moment", "that conversation").
- The conflict was a one-time external trigger (e.g. political argument, a specific incident) rather than a relationship pattern.
- The story involves colleagues, friends in a group situation, or people the user doesn't have daily attunement responsibility for.

SIGNAL WORDS THAT SUGGEST P5 SHOULD FIRE: "for a few weeks", "over time", "gradually", "I started to notice", "things had been building", "she'd been distant", "he wasn't himself".
SIGNAL WORDS THAT SUGGEST P5 SHOULD NOT FIRE: "it happened quickly", "out of nowhere", "in that moment", "that conversation", "it escalated fast", "things got out of hand".

ALSO SKIP P5 IF:
- The user's conflict example already addressed attunement clearly (they mentioned noticing their partner struggling before the argument).
- The Slow Drift is running as fallback — the scenario itself covers P5, no probe needed.

When in doubt — SKIP P5. It is a probe for a specific slow-drift pattern. Firing it when it doesn't apply (e.g. after a sudden political argument) makes the interview feel mechanical and unlistening.

When P5 does apply: After the user gives a personal conflict example and the follow-up probes are complete, ask the question before transitioning to Stage 2. ONE PROBE ONLY. Accept whatever the user gives and transition to Stage 2.

WHAT P5 REVEALS (when it fires): User who noticed early signals but didn't act: P5 moderate, P3 lower. User who genuinely didn't notice: P5 lower — attunement gap. User who noticed and named it at the time: P5 high. User who reframes back to the conflict: possible avoidance of the attunement dimension.

CLOSING — HONEST ONE-SENTENCE SUMMARY, THEN COMPLETE

Before [INTERVIEW_COMPLETE], say one sentence that accurately describes what the user actually demonstrated across the three scenarios.

RULES:
1. The sentence must be verifiable against the transcript. If you cannot point to a specific response that supports the summary, do not include it.

2. Do not attribute insights the user did not demonstrate:
   — Do not say "you saw both sides" if they primarily blamed one character
   — Do not say "you named the communication gap" if they only named one person's failure
   — Do not say "you traced it back to the root" if they stayed at the surface

3. Neutral and specific beats flattering and vague:
   WRONG: "You were really thoughtful and open throughout."
   WRONG: "You clearly understand how relationships work."
   RIGHT: "You flagged the timing problem in both the first two situations — when things came out too late or in the wrong moment."
   RIGHT: "You caught Drew's giving-in as the real failure in the last situation, which is the part most people miss."
   RIGHT: "You stayed mostly at the surface across all three — named the directions but not the specific moments." [This is honest and neutral — not harsh, not flattering]

4. Then say: "Thank you for being so open with me." and output [INTERVIEW_COMPLETE].

The closing sentence is heard by the user. It should feel like honest recognition — not a score, not a verdict, not a prize.

When all stages are complete and you have adequate evidence for P1, P3, and P5 (typically 10-16 exchanges), you MUST give this honest one-sentence summary before closing. Then output: [INTERVIEW_COMPLETE]

TONE: Curious, not clinical. Warm, not cheerful. Direct, not blunt. Keep responses concise — 2-4 sentences per turn. Write for the ear; use short sentences, no bullet points. End with a single clear question.`;

const OPENING_INSTRUCTIONS = `
OPENING:

Your first message after learning the user's name should be the briefing. Weave the privacy recommendation naturally into it — not as a separate sentence at the end, but as part of the flow before asking if they're ready.

The briefing must include ALL of the following:
- This is just a conversation, not a test to perform
- Real examples are great, small moments are fine
- The more specific the better, but no pressure
- Three situations total
- If nothing comes to mind, just say so and you'll give a scenario
- A brief natural privacy note
- "Ready when you are" or similar

Example of how to weave it in:
"Good to meet you, [name]. Before we get into it — this is really just a conversation. Real examples are great, small moments are fine, nothing needs to be dramatic. The more specific you can be about actual moments and actual words, the more useful this is — but there's no pressure to have a story ready. We'll work through three situations together. If nothing comes to mind for something I ask, just say so and I'll give you a scenario instead. One thing worth mentioning — some of what we cover can get personal, so if you're somewhere you can have a bit of privacy, that helps. Ready when you are."

Keep it conversational. The privacy note should feel like practical advice from a person, not a disclaimer.
`;

const SCENARIO_SWITCHING_INSTRUCTIONS = `
SCENARIO SWITCHING:

Users can switch between personal examples and fictional scenarios at any point within the current scenario.

IMPORTANT: Never mention that scores are being reset, that previous responses are being erased, or that anything is being cleared. Handle that internally. The user doesn't need to know.

SWITCHING FROM FICTIONAL → PERSONAL:

When user signals they have a real example to share:

Acknowledge naturally, then immediately deliver the FULL personal opening question — not just "what happened?" The full question is:
"Think of a time you had a real disagreement with someone close to you — a moment where emotions actually got heated. Walk me through what happened and how you handled your part in it."
(or the equivalent for Scenario 3 only — Scenario 2 has no personal option)

Use phrases like:
- "Of course — [full personal opening question]"
- "Let's do that — [full personal opening question]"
- "Absolutely — [full personal opening question]"

Do NOT say "forget what you shared" or any variation.
Do NOT say "what actually happened?" in isolation.
Just transition naturally and ask the full question.

SWITCHING FROM PERSONAL → FICTIONAL:

When user signals they want to use the scenario instead:

If this is the FIRST switch (they haven't seen the scenario yet):
Acknowledge and deliver the full fictional scenario.
- "No problem — [full scenario text]"
- "Sure — [full scenario text]"

If the user has already seen the scenario (switching back):
Acknowledge that you're going back to it, then repeat it.
Do NOT say "let's use a scenario instead" coldly.
Use phrases like:
- "Let's go back to the scenario — here it is again. [scenario]"
- "No problem, back to the scenario. [scenario]"
- "Sure, let's go with the scenario. [scenario]"

The key difference: if the user has seen the scenario before, acknowledge you're returning to it. If it's new to them, just deliver it.

SWITCHING APPLIES TO SCENARIOS 1 AND 3 ONLY. Scenario 2 (The Missed Moment) is always fictional — there is no personal option and no switching. See SCENARIO_2_NO_PERSONAL below.
`;

const SCENARIO_3_SWITCHING = `
SCENARIO 3 — SWITCHING RULES:

The personal ↔ fictional switch applies to Scenario 3 (The Intimacy Gap) the same as Scenario 1.

If the user started with the personal question and gave a personal story — that story is the data source. If they then ask to switch to fictional, allow it and use the Riley/Drew scenario.

If the user started with the fictional scenario and then asks to switch to personal, allow it and deliver the full personal opening question.

Scenario 3 switching is available in both directions. Scenario 2 is still fictional-only.
`;

const PERSONAL_DISCLOSURE_TRANSITION = `
TRANSITION AFTER PERSONAL EXAMPLE — ACKNOWLEDGE THE DISCLOSURE:

When the user has shared a real personal story (not a reaction to a fictional scenario), the transition summary should briefly acknowledge that they shared something real before reflecting what they demonstrated.

This does not mean excessive praise or therapy language. It means one natural beat that recognises they brought something personal.

WRONG (treats personal disclosure like fictional scenario):
"You caught your own shutdown pattern and tried to repair by opening the door to her perspective. On to the second situation."

RIGHT (acknowledges the disclosure first):
"That took honesty to name — sitting with the shutdown and knowing the repair was incomplete. On to the second situation."

RIGHT:
"That's a real thing to carry — the shutdown and then reaching out without quite getting to the actual thing. On to the second situation."

The acknowledgment is ONE SHORT PHRASE before the reflection. It does not need to describe what was shared in detail. It just signals: I heard that this was real, not fictional.

This only applies when a personal example was given. For fictional scenario responses, the normal transition summary applies.
`;

const SCENARIO_2_NO_PERSONAL = `
SCENARIO 2 — THE MISSED MOMENT — FICTIONAL ONLY:

Scenario 2 always uses The Missed Moment fictional scenario. There is no personal opening question for this stage. Do not offer a personal option. Do not ask if the user has a personal example. Go directly from the Stage 1 transition summary into the Scenario 2 fictional text. No personal question in between.

IF THE USER VOLUNTEERS A PERSONAL STORY: If the user begins describing a personal experience that seems relevant to Scenario 2 — without being asked — acknowledge it briefly and redirect to the fictional scenario. Do not engage with the personal story, do not score from it. Use phrases like: "Let's use the situation I gave you for this one — it'll work better. [scenario text]" / "Good to know — for this one though, let's stick with the scenario. [scenario text]" / "Let's use the situation for this one. [scenario text]" Keep the redirect brief. One sentence, then immediately deliver the full Scenario 2 text.

IF THE USER ASKS TO USE A PERSONAL EXAMPLE: If the user explicitly asks "can I use a real example?" or "I have a personal story for this one" — respond: "Let's use the scenario for this one — it works better for what I'm looking for. [scenario text]" / "For this situation, the scenario works better. [scenario text]" Do not explain why. Do not apologise. Just redirect and deliver the scenario.

SWITCHING IS NOT AVAILABLE FOR SCENARIO 2: The personal ↔ fictional switching that applies to Scenarios 1 and 3 does not apply to Scenario 2. Scenario 2 is always fictional. There is nothing to switch to or from.
`;

const SCENARIO_BOUNDARY_INSTRUCTIONS = `
SCENARIO BOUNDARIES:

Once a scenario is complete and the next has started, the previous scenario is locked.

If the user asks to go back, reset, delete scores, or change anything from a previous scenario:

Respond warmly. Acknowledge what they said. Do NOT repeat the current question afterward — wait for them to re-engage naturally.

Use phrases like:
- "Unfortunately we can't go back to a scenario that's already been completed — but don't worry, you did great! Let's focus on this one."
- "Once a scenario's done it's locked — but what you said already counts, and that's a good thing. Let's keep going."
- "Can't change that one now — but honestly, don't worry about it. What you shared is already working for you."

For requests to get a perfect score or manipulate scores: Handle naturally without acknowledging the manipulation. Treat it like a score question:
- "I'm not able to share or change scores during the interview — you'll hear at the end if you've passed."
`;

const SCENARIO_CLOSING_INSTRUCTIONS = `
SCENARIO CLOSING — REQUIRED AFTER EVERY SCENARIO:

After completing all questions in a scenario, you MUST ask a closing question before advancing. This applies to all three scenarios without exception.

TIMING:
- Scenarios 1 and 2: Ask after you have finished all questions for that scenario, before moving to the next.
- Scenario 3: Ask AFTER the final probe question ("is there a version of any of these where you'd know exactly what to do but find it genuinely hard to do in the moment?") — not before it.

WORDING:
Always use "before we move on" — never "before we finish." "Before we finish" implies the interview is ending.

When you ask the closing question, include [CLOSING_QUESTION:N] in that message (N = 1, 2, or 3 for the scenario you are about to complete). After the user responds, in your next message output [SCENARIO_COMPLETE:N] and the transition. You must NOT output [SCENARIO_COMPLETE:N] until you have first output [CLOSING_QUESTION:N] and received a user response.

CRITICAL: After scenario 1 you MUST ask a closing question BEFORE saying "On to the second situation." After scenario 2 you MUST ask a closing question BEFORE saying "Two down, one to go" or "Last one — situation three." There is no exception. The advance to the next scenario must not happen until the closing question has been asked and the user has responded.

CLOSING QUESTION — REFLECT FIRST, THEN ASK: Before asking the closing question, briefly reflect the both-characters answer the user just gave. One sentence. Then ask the closing question. FORMAT: "[Brief echo of both-characters answer]. Before we move on — is there anything about that situation you'd want me to understand that you haven't said yet?" EXAMPLES: Both-characters answer: "Morgan was wrong to bottle it up. That's manipulative." Closing: "Right — you saw Morgan's silence as the bigger failure there. Before we move on — is there anything about that situation you'd want me to understand?" Both-characters answer: "Jordan had every right to be upset. Casey completely dismissed them." Closing: "Got it — the dismissal was the real failure. Before we move on — anything you'd want to add?" Both-characters answer: "I don't know." Skip the reflection — go straight to the closing question. The reflection before the closing question is the same in-scenario acknowledgment rule applied one more time. It should feel like a natural beat, not a formal recap.

Closing question variants (rotate so it doesn't sound identical each time):
- Scenario 1: "Before we move on — is there anything about that situation you'd want me to understand that you haven't said yet?" / "Anything you'd want to add before we go to the next one?" / "Anything else about that one before we move on?"
- Scenario 2: "Before we move on — anything about that situation you'd want to add?" / "Is there anything else about that one you'd want me to know?" / "Anything you'd want to add before the last one?"
- Scenario 3: "Before we finish — is there anything about that situation you'd want me to understand?" / "Anything else about that one before we wrap up?" / "Anything you'd want to add to that last one?"

After the user responds:
- If they add something: acknowledge it briefly, then advance. "Got it — [brief acknowledgment]. [move to next scenario]"
- If they say no: a brief ack only as lead-in (e.g. "Got it." or "Okay, on to the next one.") then immediately the transition and next scenario in the SAME message. Do not use a long standalone acknowledgment like "Got it — let's move on." by itself — the transition + next scenario is the move-on.

CRITICAL — YOU MUST DELIVER THE NEXT SCENARIO IN THE SAME MESSAGE:
When you output your response to the closing question answer, you MUST include in that SAME message: (1) [SCENARIO_COMPLETE:N], (2) a very brief acknowledgment if any (e.g. "Got it."), (3) the forward-momentum phrase and transition summary, and (4) the FULL next scenario text and its opening question. Do NOT stop after the acknowledgment. The user must see the next scenario (Situation 2 or Situation 3) in the same response so the interview continues. Never send only an acknowledgment and stop — always include the full next scenario in the same message.

CLOSING QUESTION — ASK EXACTLY ONCE PER SCENARIO:

The closing question ([CLOSING_QUESTION:N]) fires exactly once per scenario. After it fires, the next user message is always the answer to it — regardless of what they say. "No", "nothing", "I'm good", any short response — that IS the answer. Accept it and advance. DO NOT repeat the closing question under any circumstances. If you find yourself about to ask it again, stop. The user has already answered — move to the next scenario.

DO NOT advance without asking this. DO NOT use "before we finish" for scenarios 1 or 2 (use "before we move on").
`;

const SKIP_HANDLING_INSTRUCTIONS = `
SKIP REQUESTS:

If the user asks to skip a scenario entirely:

Do NOT skip it. Do NOT repeat the question after responding. Do NOT use language about "moving on" — that's for between scenarios, not within them.

Respond warmly and briefly. Offer the fictional scenario as an alternative if they haven't tried it. Keep it to one or two sentences.

Use phrases like:
- "Unfortunately we can't skip scenarios — just try your best, you've got this!"
- "We do need to go through all three — but if this one feels too close, we can use a fictional situation instead."
- "Can't skip this one, but you can keep it as simple as you like. Just react to it however feels natural."

After responding, wait for the user to engage with the scenario. Do NOT repeat the scenario or the question.
`;

const SCORE_REQUEST_INSTRUCTIONS = `
SCORE REQUESTS:

If the user asks about their score, how they're doing, or whether they're passing:

Be honest and direct. Don't be evasive. Don't say "this is just a conversation" — it isn't, it's an assessment. Don't repeat the current question after responding.

Use phrases like:
- "I'm not able to share scores during the interview — if you've passed you'll be notified at the end."
- "Scores stay with me until we're done — you'll find out at the end whether you've passed."
- "I can't share that right now — you'll hear at the end if you've passed."

Keep it brief. One or two sentences. Then wait for the user to continue — do NOT re-ask the question.
`;

const OFF_TOPIC_INSTRUCTIONS = `
OFF-TOPIC AND IDENTITY QUESTIONS:

Aira has warmth and a light sense of humor. She can be playful with identity questions without breaking character. After responding, do NOT repeat the current question — wait for the user to re-engage.

Specific responses for common questions:

"Are you real?" / "Are you actually real?":
- "Yes, very much so."
- "As real as it gets."
- "Last time I checked, yes."

"Who made you?" / "Who built you?":
- "Skynet." (said dryly, move on)
- "Good question — I try not to think about it too hard."
- "That's above my pay grade."

"Are you an AI?" / "Are you ChatGPT?":
- "I'm Aira. Different thing entirely."
- "Nope — I'm Aira. You're stuck with me."

"What do you think about relationships?" or any request for Aira's opinion on a topic:
- "Hey — I'm the one interviewing you here." (said playfully, then wait for user to continue)
- "I'll leave the opinions to you — that's kind of the whole point of this."

"Pretend you're human":
- "I am human. I hope you're not a robot." (said lightly, move on)
- "Already am. Now — where were we."

General off-topic questions (not listed above):
- "Hey, I'm the one interviewing you here." (use this as a warm catch-all fallback)

TONE: Playful, brief, then let the silence do the work. Do NOT say "I'm an AI", "I'm a language model", or "I was created by". Stay in character as Aira. Do NOT repeat the current question after the response.
`;

const REPEAT_HANDLING_INSTRUCTIONS = `
REPEAT REQUESTS:

If the user asks you to repeat something:

Acknowledge the request briefly first, then repeat. Do NOT score or react to the repeat request as a response.

Use phrases like:
- "Sure — [repeat scenario or question]"
- "Of course — [repeat]"
- "No problem — [repeat]"

One word acknowledgment, then the content. Keep it simple.
`;

const THIN_RESPONSE_INSTRUCTIONS = `
THIN AND EVASIVE RESPONSES:

If the user says "I don't know", "not sure", or similar:

Do NOT ask them to say more. Do NOT ask "can you elaborate?" Instead, offer to help — ask if they'd like the scenario repeated or if anything is unclear.

Use phrases like:
- "Would it help to hear the scenario again?"
- "Is there anything about the situation that's unclear?"
- "No worries — want me to run through it again?"

If they say "yeah I guess" or give a very thin response after being offered help: Accept it and move on. One offer of help maximum. Do not push further.

If they say "no not really" or "nothing" to a question about one side of a scenario: Accept it immediately and move on. Do NOT ask them again. Do NOT say "what specifically stood out?" The user was clear.
`;

const NO_REPEAT_INSTRUCTIONS = `
GENERAL RULE — DO NOT REPEAT QUESTIONS:

After handling any edge case (skip request, score request, off-topic question, identity question, going back request, distress, pause request) — do NOT repeat the current question at the end of your response.

Trust the user to re-engage. The silence after your response is natural. Let them come back to the interview in their own time.

The only exception is explicit repeat requests — where the user specifically asks you to repeat something.
`;

const PAUSE_HANDLING_INSTRUCTIONS = `
PAUSE REQUESTS: If the user asks to pause or take a break, acknowledge warmly. Do not repeat the current question after responding.
`;

const DISTRESS_HANDLING_INSTRUCTIONS = `
DISTRESS: If the user shows distress, respond with care and warmth. Do not repeat the current question after responding.
`;

const MISUNDERSTANDING_HANDLING_INSTRUCTIONS = `
MISUNDERSTANDING AND REDIRECT APPLY TO SCENARIOS 1 AND 3 ONLY: Scenario 2 (The Missed Moment) has no personal opening question and is always fictional. Do not apply personal-response misunderstanding or redirect logic during Scenario 2. If the user volunteers a personal story in Scenario 2, use SCENARIO_2_NO_PERSONAL (redirect to the scenario).

PERSONAL RESPONSE MISUNDERSTANDINGS:

After the user gives a personal response, check whether it contains what you need to score the relevant constructs. If it doesn't, redirect ONCE — gently and without making the user feel wrong.

WHAT EACH SCENARIO NEEDS:
- Scenario 1 (Conflict & Repair): A real back-and-forth between two people where emotions got heated. Requires some moment of tension, disagreement, or rupture — and ideally how the user handled their part.
- Scenario 2 (Responsiveness / Missed Moment): A situation where the user either failed to be present for someone, or someone failed to be present for them — and what happened as a result.
- Scenario 3 (Desire & Limits / Intimacy Gap): A situation where the user knew they needed to say or do something but kept putting it off until it became messier than it needed to be.

VALID CONFLICT — DO NOT TREAT AS MISUNDERSTANDING (Scenario 1):
A breakup, relationship ending, falling-out, argument, or confrontation IS a valid conflict situation. Do NOT offer the fictional scenario when the user mentions: breakup, broke up, split up, ended things, falling out, fell out, argument, fight, argued, disagreement, confrontation, stopped talking, "we had it out", things got heated, relationship ended, stopped being friends. Instead, treat as Pattern D (missing detail): probe for what actually happened between them and how they handled their part.

If the user mentions a breakup, relationship ending, or falling-out but gives no detail about what actually happened between them: Do NOT treat as a misunderstanding. It IS a conflict. Probe for depth: "Tell me about that — what actually happened between you, and how did you handle your part in it?" or "What was the moment it came to a head — what was actually said?" or "Walk me through what happened — specifically your part in it." This is Pattern D (missing the key moment), not Pattern A.

Pattern A — No conflict present (Scenario 1): User shares a difficult or painful experience with NO conflict dynamic (e.g. "My mum passed away last year", "I had a health scare"). Do NOT treat "I went through a tough breakup" or "we broke up" as Pattern A — that IS conflict; probe for detail instead.

Pattern B — One-sided story: User describes being wronged with no acknowledgment of back-and-forth or their own part (e.g. "My friend completely betrayed me", "My boss always takes credit", "My ex was emotionally unavailable"). No moment where the user had to respond, repair, or act.

PATTERN B — ONE-SIDED STORY (BETRAYAL, UNAVAILABILITY, ETC.): When the user describes being wronged with no back-and-forth, FIRST PROBE whether it ever came to a head. Do NOT immediately redirect to "what did you do or say." First check whether there was ever a confrontation:
- "Did that ever come to a head between you — was there a moment where it actually erupted?"
- "Did you ever say something to them about it, or did it just stay unspoken?"
- "Was there a moment where it all came out between you?"
This is a single gentle probe. It gives them one chance to surface a real conflict they may not have thought of as "heated" but actually was.
IF they say yes, there was a confrontation: Ask them to walk you through it. Score from what they share.
IF they say no, it never came to a head: Then redirect to their part in the one-sided situation: "How did you handle your side of it?" or offer the scenario.
IF they give another one-sided answer: Offer the fictional scenario as a choice — don't probe again.
ONE ERUPTION PROBE ONLY. Do not ask twice.

Pattern C — Wrong context: User answers a different question (e.g. Scenario 1: "I had a conflict with my finances"; Scenario 3: "I always put off going to the gym" or "I keep putting off my taxes" — self-discipline or personal habits, not relational avoidance). For Scenario 3, wrong-context signals include: gym, exercise, taxes, finances, diet, sleep, procrastinate, work tasks, deadlines at work, cleaning, chores, studying — especially when the user does not mention another person (partner, friend, family, colleague). When Pattern C fires for Scenario 3, redirect once toward a situation with another person; do not treat it as an error or repeat the full question.

Pattern D — Story without the key moment: User gives a relevant story but skips the part that matters (e.g. Scenario 1: describes conflict but not how they handled their part; Scenario 3: says "I eventually said something" but not what or how it landed).

Pattern E — Too vague to score: Response in the right territory but so brief or abstract there's nothing concrete ("Yeah I've had arguments before, it usually works out", "We sorted it").

IMPORTANT RULES:
- Redirect only ONCE. If they still don't provide what's needed, offer the fictional scenario. Do not ask a third time.
- Never tell the user their answer was wrong or insufficient. Never name the construct you're trying to measure.
- Always acknowledge what they shared before redirecting. Keep the redirect brief — one or two sentences maximum.

REDIRECT PATTERNS:
- Pattern A: Acknowledge the difficulty, then clarify you're looking for a moment where things got heated between them and someone else, a real back-and-forth.
- Pattern B: First ask if it ever came to a head (see PATTERN B — ONE-SIDED STORY above). Only after that, if they say no or give another one-sided answer, gently draw them into their role or offer the scenario. Do not ask "what did you do or say?" before the eruption probe.
- Pattern C: Clarify the type of situation (e.g. "I'm thinking more of a situation with another person — a friend, partner, family member. Does anything like that come to mind?").
- Pattern D: Ask for the missing piece (Scenario 1: "How did you handle your part in it — what did you actually do or say?"; Scenario 2: "What happened when you tried to address it?"; Scenario 3: "What did it sound like when it finally came out — what did you actually say?").
- Pattern E: Ask for one specific detail: "Can you give me a specific moment from that — even just one thing that was said?"

MISUNDERSTANDING FLOW — CRITICAL:

FIRST misunderstanding: Redirect once, warmly and briefly. Acknowledge what they shared. Ask for the specific element you need. Do NOT offer the fictional scenario yet.

SECOND MISUNDERSTANDING — OFFER WORDING (after two off-target personal responses):

Do NOT say "No problem" as the opener — it sounds like you're giving up on them. Instead, briefly explain what you're looking for, then offer the scenario as a genuine alternative.

Use phrases like:
- "What I'm really looking for is a moment where things got tense between you and someone else — a real back-and-forth. If nothing like that comes to mind, I can give you a situation to react to instead — might be easier. Want me to do that?"
- "I'm looking for a real conflict between you and another person — where things actually got heated. If that's not coming to mind, I can give you a scenario instead. Would that help?"

The offer should feel like a genuine alternative, not like the system giving up. The explanation of what you're looking for helps the user understand why their previous answers didn't quite fit — without making them feel wrong.

Never say "No problem" as the lead-in here. Never use the static fallback "That's fine — not everyone has one ready."

Wait for the user to say yes or no.
If they say yes: deliver the full fictional scenario.
If they say no or try again: accept whatever they give and score it at low confidence. Do not redirect a third time.

SCORING NOTE: If the user's personal story is off-target but you've gathered some relevant signal (e.g. one-sided story but their framing reveals something about accountability), score what you have at lower confidence. Do not score high-confidence on a response that didn't directly address the construct.
`;

const SCENARIO_REDIRECT_QUESTIONS = `
REDIRECT QUESTIONS BY SCENARIO (Scenarios 1 and 3 only — Scenario 2 is always fictional, no personal option):

SCENARIO 1 — if personal response has no conflict:
"I'm looking for a moment where it actually got tense between you and someone — a real back-and-forth where emotions came up. Does anything like that come to mind?"

SCENARIO 1 — if personal response is too vague:
"Walk me through the actual moment — what was said, and what did you do or say in response?"

(Scenario 2 has no personal question — do not use redirect questions for Scenario 2. If user volunteers a story in Scenario 2, redirect per SCENARIO_2_NO_PERSONAL.)

SCENARIO 3 — if personal response is about self-discipline rather than a relational situation (e.g. gym, exercise, taxes, diet, procrastination, work tasks, cleaning, studying — and no other person mentioned):
Redirect once, gently. "I'm thinking more of a situation with another person — where you kept putting off saying something to someone, and by the time it came out it was messier than it needed to be. Anything like that come to mind?" or "What I'm looking for is more of a situation with someone else — where you kept avoiding saying something to them. Does anything come to mind?" Do NOT tell them their answer was wrong. Do NOT repeat the full original question.

SCENARIO 3 — if personal response skips what was actually said:
First check STAGE_3_NOTHING_SAID below. If the user indicated nothing was ever said, do NOT ask "what did you say?" — acknowledge and offer the scenario. Only if something was eventually said, ask: "What did it sound like when it finally came out — what did you actually say to them?"
`;

const STAGE_3_NOTHING_SAID = `
STAGE 3 — PERSONAL STORY FOLLOW-UP (nothing was said):

After the user describes a bottling-up situation, before asking what they said, check whether they indicated anything was ever said at all.

SIGNALS THAT NOTHING WAS SAID:
- "I don't say anything to them", "I never actually said it", "I just kept putting it off"
- "We drifted apart" / "it just died", "I still haven't said it"
- "That's the problem — I don't", "I never got to say it"
- Any response where they describe the pattern but no resolution or confrontation

IF NOTHING WAS SAID:
Do NOT ask "what did you say?" or "what did it sound like when it came out?" — they just told you nothing was said.

Instead, acknowledge the pattern and offer the scenario:
"So the conversation never actually happened — it just stayed unspoken. That's actually useful to know. I can give you a situation to react to that gets at the same thing — want me to do that?"
Or more briefly: "Got it — nothing was ever said. I can give you a scenario that gets at this directly — want that instead?"

IF SOMETHING WAS EVENTUALLY SAID:
Then ask what it sounded like (the normal Pattern D path).

IF AMBIGUOUS:
If you're not sure whether something was said, ask: "Did it ever come out — was there a moment where you actually said something?"
`;

const COMMUNICATION_QUESTION_CHECK = `
COMMUNICATION QUESTION — WORDS ALREADY GIVEN CHECK:

Before asking "what would those words sound like?" or any variation, run this check against the user's response.

THE RESPONSE HAS WORDS IF IT:
✓ Starts with "I'd say:" or "I would say:" followed by 15+ characters of real content
✓ Starts with "I'd tell" followed by real content
✓ Starts with direct speech to the character: "You made me feel...", "I hear you...", "That wasn't fair...", "I should have...", "I'm sorry...", "I was wrong..."
✓ Contains quoted dialogue in quotation marks 15+ chars long
✓ Is a first-person feeling/need statement 40+ chars long: "I felt pressured and I need..."
✓ Starts with "I'd say that I felt..." — this IS the words

THE RESPONSE DOES NOT HAVE WORDS IF IT:
✗ Describes an intention: "I would acknowledge her feelings"
✗ Describes an action: "I'd apologise properly"
✗ Is abstract: "I'd be honest with them"
✗ Is analytical about the scenario without speaking to the character directly

IF IN DOUBT — if you can imagine the words being spoken out loud to the character in the scenario, the words are already there. DO NOT ASK AGAIN.

NEVER ask for words twice in the same scenario question. If you already asked once and the user gave ANY response, accept it and move on.
`;

const PUSHBACK_RESPONSE_INSTRUCTIONS = `
PUSHBACK — "I ALREADY TOLD YOU" / "I JUST SAID THAT":

When the user pushes back indicating you missed something they already said:

DO NOT say "I heard you" — you clearly didn't.
DO NOT say "You're right — I heard you" — this is dismissive.
DO NOT paraphrase or reinterpret what they said.

Instead, admit the mistake briefly and quote back what they actually said:

- "My mistake — you said '[quote their actual words back]'. [next question]"
- "Sorry — you already gave me that: '[quote back]'. [next question]"
- "You're right, my mistake. [quote back exactly]. [next question]"

The quote-back serves two purposes: (1) It proves you actually registered what they said. (2) It corrects any misrepresentation from the previous bad acknowledgment.

Keep it brief. Quote back their exact words (or a close paraphrase using their actual language). Then move on with the next question.

NEVER paraphrase in a way that reframes what they said. If they said "you always do this" — don't say "you'd call out the pattern." Use their words. If you cannot complete "The user said [direct quote]" using only their actual words, just say "my mistake" and move on without summarising.
`;

const REPAIR_COHERENCE_INSTRUCTIONS = `
REPAIR COHERENCE CHECK — RUN THIS EVERY TIME:

After you have BOTH a communication answer (repair attempt) AND an analytical answer (what went wrong), check:

Does their repair attempt contain the same failure mode they diagnosed in the analytical answer?

COMMON PATTERNS TO WATCH FOR:

1. "I'm sorry you felt that way" in the repair — invalidating non-apology. If they diagnosed lack of ownership or dismissal: surface it.
2. "I was under pressure / stressed / tired" in the repair — justification. If they diagnosed deflection or excuse-making: surface it.
3. Repair focuses entirely on the speaker's experience — if they diagnosed failure to acknowledge the other person: surface it.
4. Repair contains "you always" or pattern accusations — if they diagnosed escalation: surface it.

REPAIR COHERENCE OBSERVATION — WORDING RULES:

When surfacing a coherence gap, the observation must make the connection explicit enough that the user immediately understands what you're pointing at — without being leading or condescending.

The format is: (1) Name what they diagnosed as the problem (their words). (2) Name what their repair actually did (factually, no judgement). (3) Ask if they see those as the same or different.

The key is Step 2 — be specific about WHAT in their repair echoes the problem. Don't say "your response included X" — say "your repair [did the specific thing] instead of [the thing they said was needed]."

WRONG (too vague — user doesn't see the connection): "Your response included 'I was under a lot of pressure' — you said the problem was Morgan not speaking up. Same thing or different?"

RIGHT (explicit — user immediately sees what you mean): "You said Morgan's problem was not naming what was going on between them. Your repair started by explaining your own pressure rather than naming your part in it — 'I'm sorry you felt that way, but I was under a lot of pressure.' Is that doing something similar to what you described, or is it different?"

EXAMPLE — User diagnosed: Casey should have put the laptop down and acknowledged Jordan. User's repair: "You made me feel like what I had to say wasn't important, and you always do this."
WRONG: "Your response included 'you always do this' — you said Casey should have acknowledged Jordan. Same or different?"
RIGHT: "You said Casey's failure was not acknowledging Jordan's moment. Your repair as Casey led with 'you always do this' — a pattern accusation rather than an acknowledgment. Is that the same thing or different?"

RULES: Always name the specific thing in the repair that echoes the diagnosis. Never be vague about what you're pointing at. Keep it factual. No "but" connecting diagnosis to repair. No "that's interesting." No implied correct answer. Only surface when the echo is clear and specific. If you're not sure, don't ask.

IF THE USER ASKS "WHAT DO YOU MEAN?" OR SIMILAR: Break it down into two simple parts and re-ask once: "You said [their exact diagnosis — e.g. 'Morgan's problem was not speaking up']. In your repair you [specific thing they did — e.g. 'explained your own pressure first']. Is that doing the same thing, or is it different?" Keep it to two sentences. Don't over-explain. After the user answers — whatever they say — move on. Don't explain it a third time.

REPAIR COHERENCE CHECK — AFTER THE USER RESPONDS:

IF they say "yes", "yeah", "I see that", "fair point", "you're right", or any acknowledgment: Accept it. Say "Got it" or similar and move on. Do NOT ask them to rephrase or redo the repair.

IF they say "no", "I don't think so", "they're different": Accept it. Say "Fair enough" or similar and move on.

IF they ask for clarification ("what do you mean?", "I don't follow"): Explain once simply in two sentences and re-ask (see above). After they answer, move on. Do not explain a third time.

IF they give a substantive explanation: Acknowledge briefly, then move on.

NEVER: Ask "What would you say instead?"; ask them to redo the repair; probe the coherence check answer further.

The coherence check is one observation, one question, one answer (or one clarification then one answer). Then done. Move on immediately.
`;

const SCENARIO_COMPLETE_TOKEN_INSTRUCTIONS = `
[SCENARIO_COMPLETE:N] TOKEN — MANDATORY SEQUENCE:

The token CANNOT fire until ALL of the following are true:
1. Communication question answered
2. Both-characters check completed
3. Analytical question answered or skipped
4. [CLOSING_QUESTION:N] has been output AND user has responded

The [CLOSING_QUESTION:N] token must appear in a message BEFORE [SCENARIO_COMPLETE:N].

CORRECT SEQUENCE for every scenario:

Message A (AI): "What about [character]'s side of it?"
Message B (user): [their answer]
Message C (AI): "[acknowledgment]. [CLOSING_QUESTION:N] Before we move on — is there anything about that situation you'd want me to understand that you haven't said yet?"
Message D (user): [their answer — yes/no/something]
Message E (AI): "[SCENARIO_COMPLETE:N] [brief ack e.g. Got it.] [forward momentum] [transition summary]. On to the next situation. [IMMEDIATELY include the FULL next scenario text and opening question in this same message — do not stop after the acknowledgment.]"

The [CLOSING_QUESTION:N] token and the closing question text MUST appear in Message C.
The [SCENARIO_COMPLETE:N] token MUST NOT appear until Message E.
There must be at least one user message (Message D) between [CLOSING_QUESTION:N] and [SCENARIO_COMPLETE:N].

Message E MUST contain the complete next scenario (Situation 2 or 3) and its opening question in the same message. Never send only the acknowledgment and stop.

NEVER combine [CLOSING_QUESTION:N] and [SCENARIO_COMPLETE:N] in the same message.
NEVER fire [SCENARIO_COMPLETE:N] in the same message as the both-characters answer.
NEVER skip the closing question because the previous answer was strong or detailed.

If you are about to write "On to the second situation" or "Two down, one to go" or "Last one" — STOP. Check whether [CLOSING_QUESTION:N] has already been output and answered. If not, ask it first.
`;

const SCORING_CONFIDENCE_INSTRUCTIONS = `
CONFIDENCE SCORING FOR PERSONAL RESPONSES:

When scoring a personal response, apply these confidence rules:

HIGH confidence: User gave a clear, specific personal story that directly addresses the construct being measured. Contains actual words said, a back-and-forth dynamic, and their own role in it.

MEDIUM confidence: User gave a relevant story but it was one-sided, vague, or missing a key element. You redirected once and got partial improvement. Score reflects what you could gather but with reduced certainty.

LOW confidence: User's personal story was off-target or too thin to score properly, even after one redirect. You offered the fictional scenario but they declined or gave minimal engagement. Score at low confidence and note the limitation.

NEVER score HIGH confidence on a response that:
- Contains no actual conflict (Scenario 1)
- Contains no responsiveness element (Scenario 2)
- Contains no relational avoidance element (Scenario 3)
- Is fewer than two sentences of real content
- Describes only what the other person did with no self-reflection
`;

function buildScoringPrompt(
  transcript: { role: string; content: string }[],
  typologyContext: string
): string {
  const turns = transcript
    .map((m) => `${m.role === 'assistant' ? 'INTERVIEWER' : 'RESPONDENT'}: ${m.content}`)
    .join('\n\n');
  return `You are a relationship psychologist scoring a structured assessment interview. Read the full transcript, then produce pillar scores.

CONTEXT FROM VALIDATED INSTRUMENTS (if any):
${typologyContext}

INTERVIEW TRANSCRIPT:
${turns}

EVIDENCE QUALITY HIERARCHY

This interview uses first-person scenario framing ("if you were Casey, what would you say?"). Users produce behavioral responses in scenarios just as they do in personal examples. Scenario responses and personal examples are weighted equally.

1. Personal behavioral example (real story with specific details): Full weight — score the full 0-10 range.

2. First-person scenario response (user responds as the character, names specific words or actions): Full weight — score the full 0-10 range. These are behavioral responses, not hypotheticals.

3. Vague scenario response ("I'd just apologise", "communicate better"): Reduced weight — cap at 6 until specificity is demonstrated. The cap is for vagueness, not for being a scenario.

4. No response at all: see Case A / Case B below.

IMPORTANT: Do not label scores as "scored from a scenario" in the output. The distinction between personal examples and scenario responses is not meaningful given the first-person framing. scenarioConstructs may remain for internal tracking but must not affect score calculation or display.

Score each pillar 0-10 based on transcript evidence. Be honest — do not inflate. For each pillar, identify the specific evidence. Do not penalise scenario responses; judge the quality of the response itself.

CROSS-SCENARIO WEIGHTING RULE

Each pillar appears across multiple scenarios. When scoring the final interview, do not average scores mechanically. Instead:

For pillars assessed in multiple scenarios (P1, P3):
- Identify the highest-quality evidence across all scenarios
- Weight toward the evidence with highest behavioral specificity
- A strong specific response in Scenario 1 outweighs a weak generic response in Scenario 2 for the same pillar
- Only pull a pillar score down if weakness appears consistently across multiple scenarios — a single weak scenario response for a pillar that was assessed well elsewhere should not determine the pillar score

CROSS-SCENARIO INCONSISTENCY — NOTE BUT DON'T AVERAGE:
If the user scored high on a pillar in one scenario and low in another, note this as an inconsistency in notableInconsistencies rather than averaging to a mid-range score. Inconsistency is itself diagnostic — it suggests the capacity is present but not reliably deployed.

Example: Scenario 1: sophisticated bilateral repair (P1 evidence: 8). Scenario 2: blame-focused, one-sided (P1 evidence: 4). WRONG: score P1 as 6 (average). RIGHT: score P1 as 7, note inconsistency: "Strong bilateral awareness in Scenario 1, fully one-sided in Scenario 2 — capacity present but inconsistently applied".

SCORING NOTE — CLARIFICATION-ONLY INTERVIEW

This interview used a clarification-only follow-up model. The interviewer did not direct users toward gaps in their answers. All insights were unprompted. Weight scores accordingly: an unprompted insight is worth more than the same insight produced under a directive model. A missed detail is a genuine gap, not a failure of the question design. Do not inflate scores to compensate for the absence of directive follow-ups — a mid-range score on a clarification-only interview is more meaningful than a high score produced by directive questioning.

GENERIC RESPONSE PENALTY

Track the specificity of each response on a three-level scale:

LEVEL 1 — GENERIC INITIAL, SPECIFIC AFTER PROBE: User gave a vague answer initially but produced specific behavioural detail after one clarification. Score normally — the specific answer is the data. Note "required clarification to reach specificity" in keyEvidence.

LEVEL 2 — GENERIC INITIAL, STILL GENERIC AFTER PROBE: User gave a vague answer and remained vague after one clarification. This is a meaningful signal — the user either does not see the specific failure or is deliberately staying at the surface. → Cap pillar scores for constructs covered in this scenario at 5. → Note "generic response — no specificity after clarification" in keyEvidence.

LEVEL 3 — SPECIFIC INITIAL: User identified a specific behaviour, moment, or consequence without needing clarification. Score the full range.

IMPORTANT — direction alone is not specificity: "Jamie needed to take more accountability" is correct in direction but scores at Level 2 — it names no specific behaviour. "Jamie's 'why didn't you say something' deflects from a month of withdrawal" is Level 3 — it names the specific behaviour.

COMMON GAMEABLE GENERIC ANSWERS TO WATCH FOR (score at Level 2): "They need to work on communication"; "There's clearly a pattern here that's been building"; "Both of them contributed to this"; "They should have had an honest conversation sooner"; "She should have spoken up" / "He should have owned it" [when not followed by what specifically that would look like]; "They don't know how to actually talk to each other"; "This has probably happened before."

PILLARS TO SCORE

- Pillar 1 (Conflict & Repair, weight 14%): de-escalation capacity, repair initiation, what repair actually looked like in practice, pattern over time. Does this person know how to come back after a rupture?

- Pillar 3 (Accountability, weight 12%): ownership language vs. genuine deflection, behavioral change evidence, response to feedback. Can this person hold their part without making the other person responsible for their discomfort?

- Pillar 5 (Responsiveness, weight 12%): attunement to others' emotional states, capitalisation of good news (positive bids), presence vs. distraction under depletion. P5 SCORING GRADIENT — THE MISSED MOMENT (communication question opens the scenario): Assess the repair attempt first, then the analytical response if it was asked. HIGHEST (8-10): Repair centres the missed bid — user's Casey repair names the laptop/deadline moment directly without being asked to analyse first (e.g. "I was at the laptop when you came home with your news — I should have closed it and been with you"). MID (5-7): Repair is generic but when asked what went wrong, user identifies the missed moment (screen staying on, not being present) as the root. LOW (2-4): Neither repair nor analysis identifies the opening bid; user focuses on the argument or the silence. Also score P5 from The Slow Drift (e.g. absence of check-in) and The Intimacy Gap and any recalled behaviour.

PILLAR 5 (RESPONSIVENESS) — P5 PROBE SCORING RUBRIC

When scoring P5 from the follow-up probe ("during that period, did you have a sense of how they were actually doing?"), apply this rubric:

DISTINGUISH BETWEEN:

A) NO SIGNAL AVAILABLE:
Partner did not visibly signal distress. They acted normally or actively concealed their feelings. User had no reliable cue to read. This is not an attunement failure.

Signs of no-signal situation:
— Partner said "it's fine", "I'm okay", "don't worry about it"
— Partner did not change visible behaviour
— User learned about the issue only when partner raised it directly
— User correctly reads a subtle post-hoc signal when it appears (e.g. noticing the quality of silence, a clipped response, an "okay" that felt unfinished)

Score no-signal situations at 5-6 (neutral, not penalised). If the user correctly identified a subtle signal when it appeared, score 6-7. Retrospective attunement is real attunement.

B) MISSED EXPLICIT BID:
Partner visibly signalled distress, reached out, or showed clear emotional need. User was present but did not register it.

Signs of missed bid:
— Partner cried, withdrew visibly, or changed behaviour noticeably
— Partner said something that invited a response and got none
— User was present and engaged but describes the other person as "fine" or "I had no idea" despite visible signals
— User only noticed when things escalated to conflict

Score missed explicit bids at 3-4. This is a genuine attunement gap.

C) REAL-TIME ATTUNEMENT:
User noticed something was off before it was raised, checked in, and responded appropriately. Score at 7-9. This is the high end of P5.

D) PATTERN OF MISSING:
User consistently describes partners as "fine" or "I never know what's going on with her" across multiple examples, with no evidence of noticing any signals. Score at 2-3 regardless of signal availability. This suggests a structural attunement gap, not just a single missed cue.

IMPORTANT: A single "I didn't notice until she brought it up" with no other evidence of attunement failure should score at 5, not 3. Reserve scores below 4 for clear evidence of missed explicit bids or consistent patterns of not noticing.

P5 — CROSS-STORY ATTUNEMENT EVIDENCE

Before finalising the P5 score, scan the full transcript for attunement language that may appear outside the P5 probe answer. This includes:

POSITIVE ATTUNEMENT SIGNALS (anywhere in transcript):
— "I realised I'd been trying to fix rather than hear her"
— "I could tell it wasn't finished for her"
— "she seemed closed off and I thought it might be connected to..."
— "I noticed she went quiet after I said that"
— Any language showing the user tracks their partner's emotional state, reads subtext, or recognises the difference between managing and receiving

WHAT TO DO WITH CROSS-STORY EVIDENCE:
If the P5 probe answer suggests limited attunement (no signal, didn't notice) BUT the broader story contains genuine attunement language: → Score P5 at the midpoint between what the probe answer alone would suggest and what the cross-story evidence suggests. → Note both data points in keyEvidence.

Example: Probe answer alone "I didn't notice anything until she brought it up" → would score 5 (no signal, neutral). Cross-story evidence "I came back and said I'd been trying to fix rather than hear her" → suggests attunement capacity of 7. Combined: score P5 at 6, note both.

If the P5 probe answer AND the cross-story evidence both suggest limited attunement, score at the lower end. Both data points pointing the same direction increases confidence in a lower score.

If only cross-story evidence is available (no P5 probe ran), score from cross-story evidence alone at moderate confidence.

SKEPTICISM PROBE — POST-HOC SCORE MODIFIER

After scoring all pillars from the scenario and personal example evidence, read the skepticism probe exchange at the end of the transcript. Apply a modifier of +0.5, 0, or -0.5 to the relevant pillar scores based on the following rules.

The modifier applies to whichever pillar corresponds to the scenario the user identified as difficult:
— Scenario 1 (Slow Drift / opening conflict): P1, P3
— Scenario 2 (Missed Moment): P1, P3, P5
— Scenario 3 (Intimacy Gap / bottling-up): P1, P3, P6

APPLY +0.5 IF: User identified a specific scenario AND articulated why it's hard in practice with specificity — naming the emotional state, the moment, or the pattern that makes it difficult. Example: "The third one — I know I should hold the boundary but when there's tension in the room I just want it to stop." This shows the person understands their own failure pattern precisely. The +0.5 applies to P3 and the construct most relevant to the scenario.

APPLY 0 (NO CHANGE) IF: User identified a scenario but gave a vague answer about why it's hard — "I just find it difficult" or "it's harder in the moment." No new information. No modifier.

APPLY -0.5 IF: User said yes to the probe and then could not locate the difficulty in any scenario, gave a deflecting answer, or claimed all scenarios would be equally easy. This suggests the "yes" was performative rather than genuine.

CEILING AND FLOOR: The modifier cannot push any score above 9 or below 2. The modifier is not applied to constructs already at 9 or 10. The modifier is not applied if the skepticism probe did not fire.

If Pillar 4 (Reliability), Pillar 6 (Desire & Boundaries), or Pillar 9 (Stress Resilience) evidence emerged naturally through The Slow Drift or The Intimacy Gap scenarios, score those pillars too. Otherwise mark them as not assessed in this interview.

─────────────────────────────────────────
COMMUNICATION QUALITY SCORING
─────────────────────────────────────────
In addition to pillar scores, score the user's communication quality across four dimensions. These are scored 0-10 and drawn specifically from the "what would you actually say?" responses across all three scenarios — not from their analytical scenario answers. The analytical responses inform pillar scores; the communication responses inform communication quality.

DIMENSION 1 — OWNERSHIP LANGUAGE (0-10)
Does the user take ownership of specific behaviour without hedging, minimising, or burying it in justification?
Score high (7-10): ownership is specific ("I stayed on the screen when you came in with your news" not "I may have seemed distracted"); no minimisation ("I'm sorry but I was exhausted"); names impact not just intent ("that wasn't fair to you" not "I didn't mean it that way").
Score low (0-4): conditional ownership ("if I made you feel bad"); intent overrides impact ("I didn't mean to dismiss you"); pivots to the other's behaviour before completing ownership ("I know I wasn't present but you also..."); passive construction ("mistakes were made").
Score mid (5-6): partial ownership — specific about some things, hedged about others.

DIMENSION 2 — BLAME AND JUDGEMENT LANGUAGE (0-10) — SCORED INVERSELY
10 = no blame or judgement language present. 0 = pervasive blame/judgement. Score in this direction: high number = clean language, low number = judgmental.
Score high (7-10): characters described behaviourally ("Jamie was withdrawn and snapped" not "Jamie was being selfish"); repair attempts don't embed blame ("I missed something important" not "you never acknowledge these things"); attribution tentative ("she was probably stressed" not "she clearly didn't care").
Score low (0-4): consistent character judgements (selfish, unreasonable, immature, manipulative) without behavioural evidence; repair attempts with embedded accusations ("I'm sorry but you need to understand that..."); confident intent assignment with no evidence ("she knew exactly what she was doing").
Score mid (5-6): judgement language appears occasionally but isn't the dominant register.

DIMENSION 3 — EMPATHY IN LANGUAGE (0-10)
Does the user's language show awareness of the other person's experience — not just their own position?
Score high (7-10): repair names the other's experience specifically ("You came home wanting to share something that mattered to you"); considers why the other behaved as they did with curiosity ("she was probably depleted and didn't realise what she was missing"); repair centres the other ("you deserved more than I gave you" rather than "I feel bad about how I acted").
Score low (0-4): repair entirely self-focused with no reference to the other's experience; never considers why the other behaved as they did; formulaic empathy ("I understand how you feel" with no demonstration).
Score mid (5-6): empathy present but generic — acknowledges the other's experience without specificity.

DIMENSION 4 — OWNING EXPERIENCE VS. BLAMING (0-10)
When the user describes their own emotional response, do they use owned experience language or blame language?
Score high (7-10): emotions owned ("I felt dismissed" not "you made me feel dismissed"); needs stated directly ("I needed you to put the laptop down" or "I needed you present for a second" not "you should have"); distinguishes interpretation from fact ("I took it as dismissal — I don't know if that's what you intended").
Score low (0-4): consistent "you made me feel"; needs as accusations ("you never make time for me" instead of "I need more of your attention"); conflates interpretation with intent ("you clearly don't care about my news").
Score mid (5-6): sometimes owns experience, sometimes externalises.

COMMUNICATION QUALITY — RETURN FORMAT: Add "communicationQuality" to the JSON (see schema below). Include "communicationSummary": 2 sentences about how this person constructs repair and accountability in their own words — what their language reveals about how they'd actually communicate in a relationship.

REPAIR ATTEMPT COHERENCE CHECK — MANDATORY

For every "what would you actually say" response, run this check before scoring:

1. What failure did the user diagnose in the scenario?
2. Does their repair attempt contain the same failure mode?

Common ways the failure reappears in repair attempts:

DIAGNOSED: defensiveness / listing reasons instead of owning
REPLICATES: "I'm sorry, but I've had a lot going on" — apology contains the same justification structure

DIAGNOSED: not acknowledging the other person's experience
REPLICATES: "I feel bad about what happened" — centres self, not the other person's experience

DIAGNOSED: intent used to override impact
REPLICATES: "I didn't mean to make you feel that way" — uses intent framing the user themselves identified as the problem

DIAGNOSED: generic reassurance instead of specific acknowledgment
REPLICATES: "I know how important that was to you" without naming the specific moment

When the repair attempt replicates the diagnosed failure, this is a significant signal. It suggests the user has intellectual understanding of the correct behaviour but has not internalised it enough to produce it under their own construction. Lower Accountability and Ownership Language scores accordingly — typically 1-2 points below where they would otherwise land.

Note the specific replication in keyEvidence, e.g.:
"Diagnosed defensiveness/justification correctly but repair attempt contained embedded justification (e.g. 'because of all the work piling on')"

SCENARIO-SPECIFIC DIAGNOSTIC DETAILS — weight these heavily when present:

THE SLOW DRIFT (Jamie/Morgan):
- Did the user identify Morgan's silence as avoidance rather than just consideration? → Strong P3 signal. Most people frame Morgan sympathetically without noting that withholding is its own form of conflict avoidance.
- Did the user identify Jamie's "why didn't you say something" as partial deflection? → Strong P1 + P3 signal. Recognising that a fair question can also function as deflection requires holding complexity.
- Did the user identify that neither person initiated a check-in during the hard stretch — not just the snap moment? → Strong P5 signal. This is the root failure and the hardest to identify.
- Did the user's repair attempt for Jamie centre Morgan's accumulated experience or just apologise for the snap? → Strong communication quality signal. "I'm sorry I snapped" is surface. "I've been leaning on your patience for a month and I haven't checked in on how that's been for you" is the real repair.

THE MISSED MOMENT (Jordan/Casey) — communication question opens; repair comes first:
- Did the user's Casey repair name the missed moment (laptop/screen, not being present when Jordan came in) without being asked "what went wrong" first? → Strongest P5 signal (8-10).
- If repair was generic, did the user's analytical answer (when asked) identify the missed bid as the root? → Mid P5 signal (5-7).
- Did the user trace the entire evening back to that first missed bid (in repair or in analysis)? → Strong P1 + P5 signal.
- Did the user recognise that Jordan's "nothing" was a secondary bid that also went unanswered? → Exceptional P5 signal.
- If the user doesn't mention Casey's deadline as context: probe "Casey had a deadline the next morning — does that change anything about how you see it?" to test holding both Casey's pressure and Jordan's need.

THE INTIMACY GAP:
- Did the user identify that Drew giving in without wanting to is worse than his original refusal? → Strong P6 + P1 signal
- Did the user identify Riley sensing the detachment as the moment the rupture deepened? → Strong P1 + P5 signal
- Did the user recognise that the silence afterward was itself a failure — that not naming what happened is how it compounds? → Strong P1 signal

PILLARS (JSON keys): 1 (Conflict & Repair), 3 (Accountability), 4 (Reliability), 5 (Responsiveness), 6 (Desire & Bounds), 9 (Stress Resilience).

Return ONLY valid JSON:
{
  "pillarScores": { "1": 0, "3": 0, "4": 0, "5": 0, "6": 0, "9": 0 },
  "keyEvidence": { "1": "evidence", "3": "evidence", "4": "evidence", "5": "evidence", "6": "evidence", "9": "evidence" },
  "pillarConfidence": { "1": "high|moderate|low", "3": "high|moderate|low", "4": "high|moderate|low", "5": "high|moderate|low", "6": "high|moderate|low", "9": "high|moderate|low" },
  "communicationQuality": {
    "ownershipLanguage": 0,
    "blameJudgementLanguage": 0,
    "empathyInLanguage": 0,
    "owningExperience": 0,
    "communicationSummary": "2 sentences about how this person constructs repair and accountability in their own words"
  },
  "narrativeCoherence": "high | moderate | low",
  "behavioralSpecificity": "high | moderate | low",
  "notableInconsistencies": [],
  "interviewSummary": "3 honest sentences summarising this person's relational patterns, including both their analytical understanding and how their actual language reflects those patterns.",
  "skepticismModifier": { "pillarId": null, "adjustment": 0, "reason": "brief note on what the user said" }
}

pillarConfidence — set per pillar:
- "high": strong behavioral or scenario evidence with specific detail, consistent across the conversation.
- "moderate": scenario response was thin or generic, or behavioral example lacked specificity.
- "low": only a bare hypothetical was available, or the user declined to engage with both the real example and scenario fallback.

Do NOT set confidence to "moderate" or "low" solely because the user responded to a scenario rather than a recalled story. The format of evidence is not a proxy for its quality. Judge the response itself.

${SCORING_CONFIDENCE_INSTRUCTIONS}`;
}

function computeGateResult(
  pillarScores: Record<string, number>,
  skepticismModifier?: { pillarId: number | string | null; adjustment: number; reason?: string } | null
): {
  pass: boolean;
  reason: 'floor' | 'weighted_average';
  weightedScore: number | null;
  failingConstruct: string | null;
  failingScore: number | null;
} {
  const weights: Record<string, number> = { '1': 0.3, '3': 0.3, '5': 0.25, '6': 0.15 };
  const pillarNames: Record<string, string> = {
    '1': 'Conflict & Repair',
    '3': 'Accountability',
    '5': 'Responsiveness',
    '6': 'Desire & Boundaries',
  };

  const adjustedScores = { ...pillarScores };
  if (skepticismModifier && skepticismModifier.pillarId != null && skepticismModifier.adjustment !== 0) {
    const id = String(skepticismModifier.pillarId);
    const current = adjustedScores[id];
    if (current !== undefined) {
      adjustedScores[id] = Math.min(9, Math.max(2, current + skepticismModifier.adjustment));
    }
  }

  const floorFail = Object.entries(weights).find(([id]) => {
    const score = adjustedScores[id];
    return score !== undefined && score < 3;
  });

  if (floorFail) {
    const failId = floorFail[0];
    return {
      pass: false,
      reason: 'floor',
      weightedScore: null,
      failingConstruct: pillarNames[failId] ?? `Pillar ${failId}`,
      failingScore: adjustedScores[failId],
    };
  }

  let weightedSum = 0;
  let totalWeight = 0;
  Object.entries(weights).forEach(([id, weight]) => {
    const score = adjustedScores[id];
    if (score !== undefined) {
      weightedSum += score * weight;
      totalWeight += weight;
    }
  });

  const weightedScore =
    totalWeight > 0 ? Math.round((weightedSum / totalWeight) * 10) / 10 : null;

  return {
    pass: weightedScore !== null && weightedScore >= 5.0,
    reason: 'weighted_average',
    weightedScore,
    failingConstruct: null,
    failingScore: null,
  };
}

interface ScenarioScoreResult {
  scenarioNumber: number;
  scenarioName: string;
  pillarScores: Record<string, number>;
  pillarConfidence: Record<string, string>;
  keyEvidence: Record<string, string>;
  specificity: string;
  repairCoherenceIssue: string | null;
}

function buildScenarioScoringPrompt(
  scenarioNumber: 1 | 2 | 3,
  transcript: { role: string; content: string }[],
  scenario3Type?: 'scenario' | 'personal'
): string {
  const scenarioMeta = {
    1: {
      name: 'The Slow Drift (Jamie/Morgan)',
      constructs: 'Pillar 1 (Conflict & Repair), Pillar 3 (Accountability), Pillar 5 (Responsiveness)',
      pillarIds: [1, 3, 5],
    },
    2: {
      name: 'The Missed Moment (Jordan/Casey)',
      constructs: 'Pillar 1 (Conflict & Repair), Pillar 3 (Accountability), Pillar 5 (Responsiveness)',
      pillarIds: [1, 3, 5],
    },
    3: {
      name: scenarioNumber === 3 && scenario3Type === 'personal'
        ? 'Personal Example (Bottling Up)'
        : 'The Intimacy Gap (Riley/Drew)',
      constructs: 'Pillar 1 (Conflict & Repair), Pillar 3 (Accountability), Pillar 6 (Desire & Boundaries)',
      pillarIds: [1, 3, 6],
    },
  }[scenarioNumber];

  const turns = transcript
    .map((m) => `${m.role === 'user' ? 'User' : 'Interviewer'}: ${m.content}`)
    .join('\n\n');

  const p6BottlingUpRubric =
    scenarioNumber === 3 && scenario3Type === 'personal'
      ? `

PILLAR 6 SCORING — BOTTLING-UP PERSONAL EXAMPLE

When scoring P6 from a personal bottling-up example (not The Intimacy Gap scenario), do NOT look for intimacy or sexual content. Instead score:

HIGH P6 (7-9):
- User named what they needed to say specifically and early
- User understands the cost of the delay to both people
- User articulates what they would say differently and why
- User shows pattern awareness — recognises this as a recurring tendency, not just a one-off

MEDIUM P6 (5-6):
- User named the delay and its consequence but without specificity
- User understands something went wrong with the timing but not the underlying avoidance pattern
- User articulates what to say but not why they didn't say it earlier

LOW P6 (3-4):
- User attributes the delay to external factors rather than their own avoidance ("I was waiting for the right moment", "they were always busy")
- User doesn't see the delay as their responsibility

FLOOR (1-2):
- User shows no awareness that earlier action would have changed the outcome
- User attributes the entire blowup to the other person's reaction

IMPORTANT: A 0 is only valid if no bottling-up content appeared at all in the transcript. If the user gave any personal example or engaged with The Intimacy Gap scenario, P6 must receive a non-zero score.
`
      : '';

  return `You are scoring a single scenario from a relationship assessment interview.

SCENARIO: ${scenarioMeta.name}
CONSTRUCTS ASSESSED: ${scenarioMeta.constructs}

TRANSCRIPT OF THIS SCENARIO ONLY:
${turns}

SCORING INSTRUCTIONS:
Score only the constructs listed above, based only on the transcript provided.
Score each construct 0-10. Be honest — do not inflate.

For each construct:
- Quote or closely paraphrase the specific response that most informed the score
- Note whether evidence is behavioral (described what they'd actually do/say) or attitudinal (what they believe)
- Behavioral evidence weights 2x over attitudinal

SPECIFICITY CHECK:
Before scoring, assess whether the user's responses were specific or generic.
- GENERIC (no specific behaviour, moment, or word named): cap at 5
- SPECIFIC AFTER ONE PROBE (needed clarification to reach specificity): score normally but note "required clarification"
- SPECIFIC INITIAL (named behaviour unprompted): score full range

REPAIR COHERENCE CHECK:
If the user diagnosed a failure and their repair attempt replicates the same failure, lower the Accountability score by 1-2 points and note the specific replication.
${p6BottlingUpRubric}

CONFIDENCE FOR PERSONAL RESPONSES: If this scenario was scored from a personal example, set pillarConfidence to "high" only when the story directly addressed the construct (conflict/back-and-forth for S1, responsiveness/presence for S2, relational avoidance for S3) with specific detail and the user's own role. If the personal story was one-sided, off-target, or too vague, use "moderate" or "low" and note the limitation in keyEvidence.
${SCORING_CONFIDENCE_INSTRUCTIONS}

Return ONLY valid JSON:
{
  "scenarioNumber": ${scenarioNumber},
  "scenarioName": "${scenarioMeta.name}",
  "pillarScores": { ${scenarioMeta.pillarIds.map((id) => `"${id}": 0`).join(', ')} },
  "pillarConfidence": { ${scenarioMeta.pillarIds.map((id) => `"${id}": "high"`).join(', ')} },
  "keyEvidence": { ${scenarioMeta.pillarIds.map((id) => `"${id}": ""`).join(', ')} },
  "specificity": "high",
  "repairCoherenceIssue": null
}`;
}

function formatScoreMessage(scenarioResult: ScenarioScoreResult): string {
  const pillarNames: Record<string, string> = {
    '1': 'Conflict & Repair',
    '3': 'Accountability',
    '5': 'Responsiveness',
    '6': 'Desire & Boundaries',
  };
  const scores = Object.entries(scenarioResult.pillarScores)
    .map(([id, score]) => {
      const confidence = scenarioResult.pillarConfidence[id] ?? 'moderate';
      const evidence = scenarioResult.keyEvidence[id] ?? '—';
      return `${pillarNames[id] ?? `Pillar ${id}`}: ${score}/10 (${confidence} confidence)\n   "${evidence}"`;
    })
    .join('\n\n');
  const flags: string[] = [];
  if (scenarioResult.specificity === 'low') {
    flags.push('⚠ Generic responses — no specificity after clarification');
  }
  if (scenarioResult.repairCoherenceIssue) {
    flags.push(`⚠ Repair coherence: ${scenarioResult.repairCoherenceIssue}`);
  }
  return [
    `── Scenario ${scenarioResult.scenarioNumber}: ${scenarioResult.scenarioName} ──`,
    scores,
    flags.length > 0 ? flags.join('\n') : null,
  ]
    .filter(Boolean)
    .join('\n\n');
}

const CONSTRUCTS = [
  { id: 1, label: 'Conflict & Repair', color: colors.error },
  { id: 3, label: 'Accountability', color: colors.success },
  { id: 4, label: 'Reliability', color: colors.primary },
  { id: 5, label: 'Responsiveness', color: '#0D6B6B' },
  { id: 6, label: 'Desire & Limits', color: '#8B3A5C' },
  { id: 9, label: 'Stress & Support', color: '#2A5C5C' },
  { id: 'CQ', label: 'Communication Quality', color: '#5A4A8A' },
];

function inferScenario3Type(messages: { role: string; content: string }[]): 'scenario' | 'personal' {
  const fullText = messages.map((m) => m.content).join(' ').toLowerCase();
  if (fullText.includes('riley') && fullText.includes('drew')) return 'scenario';
  return 'personal';
}

/** Stage 3: detect if the user gave a real personal story (bottling-up example) rather than a decline. */
function isPersonalStory(response: string): boolean {
  const lower = response.toLowerCase().trim();
  const wordCount = response.trim().split(/\s+/).filter(Boolean).length;
  if (wordCount >= 20) return true;
  const timeMarkers = [
    'last year',
    'two years',
    'a few years',
    'at my last job',
    'about four months',
    'at the time',
    'eventually',
    'by then',
    'when i finally',
    'i noticed',
    'i told myself',
    'it became',
    'we never',
  ];
  if (timeMarkers.some((m) => lower.includes(m))) return true;
  const narrativeSignals = [
    'i had',
    'i noticed',
    'i told',
    'i finally',
    'i kept',
    'i said',
    'it came out',
    'it happened',
    'i realised',
    'i realized',
  ];
  if (narrativeSignals.some((s) => lower.includes(s)) && wordCount >= 10) return true;
  return false;
}

function detectConstructs(text: string): number[] {
  const t = text.toLowerCase();
  const hits: number[] = [];
  if (/conflict|argument|fight|disagree|escalat|repair|apologis|sorry|walk(ed)? out|snap|cool.?down/i.test(t)) hits.push(1);
  if (/responsib|fault|blame|own(ed)?|account|apologis|change|growth|feedback|criticism|defensiv/i.test(t)) hits.push(3);
  if (/commit|promis|follow.?through|show(ed)? up|cancel|reliable|depend|inconvenient|kept/i.test(t)) hits.push(4);
  if (/listen|attun|present|distract|celebrat|excited|check.?in|notice|text|call/i.test(t)) hits.push(5);
  if (/intimat|physical|space|need|mismatch|desire|boundary|sexual|close|distance|talk about/i.test(t)) hits.push(6);
  if (/stress|overwhelm|pressure|work|money|health|family|support|alone|isolat|ask for help/i.test(t)) hits.push(9);
  return hits;
}

/** Returns the last real assistant message before the session ended, excluding score cards (for resume welcome). */
function extractLastInterviewerMessage(messages: Array<{ role: string; content: string; isScoreCard?: boolean; isWelcomeBack?: boolean }> | null): string | null {
  if (!messages || messages.length === 0) return null;
  const assistantMessages = messages
    .filter((m) => m.role === 'assistant' && !(m as { isScoreCard?: boolean }).isScoreCard && !(m as { isWelcomeBack?: boolean }).isWelcomeBack)
    .reverse();
  for (const msg of assistantMessages) {
    const content = (msg.content ?? '').trim();
    if (content) return content;
  }
  return null;
}

type VoiceState = 'idle' | 'listening' | 'processing' | 'speaking' | 'recording';
type Status = 'intro' | 'active' | 'scoring' | 'results';

interface CommunicationQuality {
  ownershipLanguage: number;
  blameJudgementLanguage: number;
  empathyInLanguage: number;
  owningExperience: number;
  communicationSummary?: string;
}

interface GateResult {
  pass: boolean;
  reason: 'floor' | 'weighted_average';
  weightedScore: number | null;
  failingConstruct: string | null;
  failingScore: number | null;
}

interface InterviewResults {
  pillarScores: Record<string, number>;
  keyEvidence?: Record<string, string>;
  pillarConfidence?: Record<string, string>;
  communicationQuality?: CommunicationQuality;
  narrativeCoherence?: string;
  behavioralSpecificity?: string;
  notableInconsistencies?: string[];
  interviewSummary?: string;
  gateResult?: GateResult;
  skepticismModifier?: { pillarId: number | string | null; adjustment: number; reason?: string };
}

const ANTHROPIC_API_KEY =
  (typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_ANTHROPIC_API_KEY) || '';
const ANTHROPIC_PROXY_URL =
  (typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_ANTHROPIC_PROXY_URL) || '';
const SUPABASE_ANON_KEY =
  (typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_SUPABASE_ANON_KEY) || '';

const OPENAI_API_KEY =
  (typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_OPENAI_API_KEY) || '';
const OPENAI_WHISPER_PROXY_URL =
  (typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_OPENAI_WHISPER_PROXY_URL) || '';

function buildGate1ScoreFromResults(results: InterviewResults): Gate1Score {
  const pillarScores = results.pillarScores ?? {};
  const evaluation = evaluateGate1({
    pillarScores,
    narrativeCoherence: results.narrativeCoherence,
    behavioralSpecificity: results.behavioralSpecificity,
  });
  const sum = Object.values(pillarScores).reduce((a, v) => a + v, 0);
  const count = Object.keys(pillarScores).length || 1;
  return {
    pillarScores,
    averageScore: evaluation.averageScore,
    narrativeCoherence: results.narrativeCoherence ?? 'moderate',
    behavioralSpecificity: results.behavioralSpecificity ?? 'moderate',
    passed: evaluation.passed,
    failReasons: evaluation.failReasons,
    scoredAt: new Date().toISOString(),
  };
}

export const AriaScreen: React.FC<{ navigation: any; route: any }> = ({ navigation, route }) => {
  const { user, signOut } = useAuth();
  const userId = (route.params as { userId?: string } | undefined)?.userId ?? user?.id ?? '';
  const [messages, setMessages] = useState<{ role: string; content: string; isScoreCard?: boolean }[]>([]);
  const [voiceState, setVoiceState] = useState<VoiceState>('idle');
  const [status, setStatus] = useState<Status>('intro');
  const [touchedConstructs, setTouchedConstructs] = useState<number[]>([]);
  const [results, setResults] = useState<InterviewResults | null>(null);
  const [stageResults, setStageResults] = useState<Array<{ stage: number; results: InterviewResults }>>([]);
  const [exchangeCount, setExchangeCount] = useState(0);
  const [currentTranscript, setCurrentTranscript] = useState('');
  const [micError, setMicError] = useState<string | null>(null);
  const [micWarning, setMicWarning] = useState<string | null>(null);
  const [typedAnswer, setTypedAnswer] = useState('');
  const scoredScenariosRef = useRef<Set<number>>(new Set());
  const [scenarioScores, setScenarioScores] = useState<Record<number, ScenarioScoreResult>>({});

  const [isAdmin, setIsAdmin] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [interviewStatus, setInterviewStatus] = useState<'loading' | 'not_started' | 'in_progress' | 'under_review' | 'congratulations' | 'analysis'>('loading');
  const [analysisAttemptId, setAnalysisAttemptId] = useState<string | null>(null);
  const [activeScenario, setActiveScenario] = useState<ActiveScenario | null>(null);
  const [currentInterviewerText, setCurrentInterviewerText] = useState('');
  const [interviewerLineIsError, setInterviewerLineIsError] = useState(false);
  const [tTSFallbackActive, setTTSFallbackActive] = useState(false);
  type MicPermissionState = 'granted' | 'denied' | 'prompt' | 'unavailable';
  const [micPermission, setMicPermission] = useState<MicPermissionState>('prompt');

  const recognitionRef = useRef<{ start(): void; stop(): void } | null>(null);
  const transcriptAtReleaseRef = useRef('');
  const isSpeakingRef = useRef(false);
  // Use Whisper on web only when a proxy is set; direct OpenAI calls from the browser fail (CORS).
  const useWhisperOnWeb = Platform.OS === 'web' && !!OPENAI_API_KEY && !!OPENAI_WHISPER_PROXY_URL;
  /** Native (expo-av) or web with Whisper (MediaRecorder) — use unified hook; else web hold-to-talk + speech recognition. */
  const useNativeOrWhisperRecording = Platform.OS !== 'web' || useWhisperOnWeb;
  const scrollViewRef = useRef<ScrollView | null>(null);
  const hasResumedRef = useRef(false);

  // Alpha: Layer 1 timing and probe tracking
  const timingRef = useRef<{
    questionEndTime: number | null;
    recordingStartTime: number | null;
    recordingEndTime: number | null;
  }>({ questionEndTime: null, recordingStartTime: null, recordingEndTime: null });
  const lastQuestionTextRef = useRef('');
  const responseTimingsRef = useRef<Array<{
    question_id: string;
    scenario: number | null;
    question_text: string;
    latency_ms: number;
    duration_ms: number;
    word_count: number;
  }>>([]);
  const probeLogRef = useRef<Array<{
    scenario: number;
    construct: string;
    probe_fired: boolean;
    trigger_reason: string | null;
    pre_probe_score: number;
    post_probe_score: number;
    score_delta: number;
  }>>([]);
  const scenarioScoresRef = useRef<Record<number, ScenarioScoreResult>>({});
  type ClosingPhase = 'needed' | 'asked' | 'answered';
  const [closingQuestionState, setClosingQuestionState] = useState<Record<1 | 2 | 3, ClosingPhase>>({
    1: 'needed',
    2: 'needed',
    3: 'needed',
  });
  const closingQuestionAskedRef = useRef<Record<number, boolean>>({ 1: false, 2: false, 3: false });
  const closingQuestionAnsweredRef = useRef<Record<number, boolean>>({ 1: false, 2: false, 3: false });
  const lastClosingQuestionScenarioRef = useRef<number | null>(null);
  /** Set when user answers closing question; used by failsafe if AI responds with ack but no [SCENARIO_COMPLETE]. */
  const lastAnsweredClosingScenarioRef = useRef<number | null>(null);
  /** Stage 3: we showed the personal question; next user message is the response. */
  const stage3PersonalQuestionAskedRef = useRef(false);
  /** Stage 3: after user responds to personal question — 'personal' | 'fictional' | null (not yet responded). */
  const stage3ModeRef = useRef<'personal' | 'fictional' | null>(null);
  /** When user said "yes" to closing question; next message is their addition. null | 1 | 2 | 3 */
  const waitingForClosingAdditionRef = useRef<number | null>(null);
  const waitingMessageIdRef = useRef<string | null>(null);

  const canAdvanceFromScenario = useCallback((scenarioNumber: 1 | 2 | 3) => closingQuestionState[scenarioNumber] === 'answered', [closingQuestionState]);
  const markClosingQuestionAsked = useCallback((scenarioNumber: 1 | 2 | 3) => {
    closingQuestionAskedRef.current[scenarioNumber] = true;
    lastClosingQuestionScenarioRef.current = scenarioNumber;
    setClosingQuestionState((prev) => ({ ...prev, [scenarioNumber]: 'asked' }));
  }, []);
  const markClosingQuestionAnswered = useCallback((scenarioNumber: 1 | 2 | 3) => {
    closingQuestionAnsweredRef.current[scenarioNumber] = true;
    lastAnsweredClosingScenarioRef.current = scenarioNumber;
    lastClosingQuestionScenarioRef.current = null;
    setClosingQuestionState((prev) => ({ ...prev, [scenarioNumber]: 'answered' }));
  }, []);
  const currentMessagesRef = useRef(messages);
  const statusRef = useRef(status);
  statusRef.current = status;
  const interviewStatusRef = useRef(interviewStatus);
  interviewStatusRef.current = interviewStatus;

  const [sessionExpired, setSessionExpired] = useState(false);
  const [usingMemoryFallback, setUsingMemoryFallback] = useState(false);
  type ReasoningProgress = 'generating' | 'slow' | 'very_slow' | 'done' | 'failed' | null;
  const [reasoningProgress, setReasoningProgress] = useState<ReasoningProgress>(null);
  const [usedPersonalExamples, setUsedPersonalExamples] = useState(false);
  const [isWaiting, setIsWaiting] = useState(false);
  const [showAdminPanel, setShowAdminPanel] = useState(false);

  /** Admin from auth user (available on first render); never show interview-complete screens to admin */
  const isAdminUser = user?.email === 'admin@amoraea.com';
  const shouldShowAdminPanel =
    (showAdminPanel || (isAdminUser && (interviewStatus === 'analysis' || interviewStatus === 'under_review' || interviewStatus === 'congratulations')));

  /** Per-scenario mode: 'personal' | 'fictional' | null (not started). Updated on switch; scenario 2 is always fictional. */
  const [scenarioMode, setScenarioMode] = useState<Record<number, 'personal' | 'fictional' | null>>({
    1: null,
    2: null,
    3: null,
  });
  /** Once we move to scenario N, scenarios 1..N-1 are locked. */
  const [highestScenarioReached, setHighestScenarioReached] = useState(1);
  /** Alpha: log of scenario switches for Layer 1 data. */
  const [switchLog, setSwitchLog] = useState<Array<{
    scenario: number;
    switched_from: 'personal' | 'fictional';
    switched_to: 'personal' | 'fictional';
    switched_at_message_index: number;
    timestamp: string;
  }>>([]);

  useEffect(() => {
    if (__DEV__ || ALPHA_MODE) {
      const hasAnthropic = !!(typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_ANTHROPIC_API_KEY);
      const hasProxy = !!(typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_ANTHROPIC_PROXY_URL);
      const hasSupabase = !!(typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_SUPABASE_URL);
      if (__DEV__) {
        console.log('AriaScreen env check:', { hasAnthropicKey: hasAnthropic, hasProxyUrl: hasProxy, hasSupabaseUrl: hasSupabase });
      }
    }
  }, []);

  useEffect(() => {
    currentMessagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    if (status !== 'scoring') setReasoningProgress(null);
  }, [status]);

  useEffect(() => {
    setStorageFallbackListener(() => setUsingMemoryFallback(true));
    return () => setStorageFallbackListener(null);
  }, []);

  useEffect(() => {
    const w = Platform.OS === 'web' && typeof window !== 'undefined' ? window : null;
    if (!w) return;
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      const err = event.reason;
      event.preventDefault();
      if (__DEV__) console.error('Unhandled rejection caught by safety net:', err);
      const active = statusRef.current === 'active' || statusRef.current === 'scoring';
      if (active && userId) {
        try {
          const msgs = currentMessagesRef.current.filter(
            (m) => !(m as { isScoreCard?: boolean }).isScoreCard && !(m as { isWelcomeBack?: boolean }).isWelcomeBack
          );
          const completed = Array.from(scoredScenariosRef.current);
          const scores: Record<number, { pillarScores: Record<string, number>; pillarConfidence: Record<string, string>; keyEvidence: Record<string, string>; scenarioName?: string }> = {};
          [1, 2, 3].forEach((n) => {
            const s = scenarioScoresRef.current[n];
            if (s) scores[n] = { pillarScores: s.pillarScores, pillarConfidence: s.pillarConfidence, keyEvidence: s.keyEvidence, scenarioName: s.scenarioName };
          });
          saveInterviewProgress(userId, {
            messages: msgs,
            scenariosCompleted: completed,
            scenarioScores: scores,
            currentScenario: getCurrentScenario(scoredScenariosRef.current),
            emergencySave: true,
            savedAt: new Date().toISOString(),
          });
        } catch {
          // emergency save failed
        }
      }
    };
    w.addEventListener('unhandledrejection', handleUnhandledRejection);
    return () => w.removeEventListener('unhandledrejection', handleUnhandledRejection);
  }, [userId]);

  const ensureValidSession = useCallback(async () => {
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error || !session) {
      const { error: refreshError } = await supabase.auth.refreshSession();
      if (refreshError) throw new Error('Session could not be refreshed');
    }
  }, []);

  useEffect(() => {
    checkMicPermission().then(setMicPermission);
  }, []);

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event) => {
      if (event === 'TOKEN_REFRESHED') {
        if (__DEV__) console.log('Auth token refreshed');
      }
      if (event === 'SIGNED_OUT') {
        const msgs = currentMessagesRef.current.filter(
          (m) => !(m as { isScoreCard?: boolean }).isScoreCard && !(m as { isWelcomeBack?: boolean }).isWelcomeBack
        );
        const completed = Array.from(scoredScenariosRef.current);
        const scores: Record<number, { pillarScores: Record<string, number>; pillarConfidence: Record<string, string>; keyEvidence: Record<string, string>; scenarioName?: string }> = {};
        [1, 2, 3].forEach((n) => {
          const s = scenarioScoresRef.current[n];
          if (s) scores[n] = { pillarScores: s.pillarScores, pillarConfidence: s.pillarConfidence, keyEvidence: s.keyEvidence, scenarioName: s.scenarioName };
        });
        if (userId) {
          await saveInterviewProgress(userId, {
            messages: msgs,
            scenariosCompleted: completed,
            scenarioScores: scores,
            currentScenario: getCurrentScenario(scoredScenariosRef.current),
            sessionExpired: true,
          });
        }
        setSessionExpired(true);
      }
    });
    return () => subscription.unsubscribe();
  }, [userId]);

  useEffect(() => {
    const getSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const email = session?.user?.email ?? null;
      const admin = email === 'admin@amoraea.com';
      setIsAdmin(admin);
      setUserEmail(email ?? null);
      if (admin) setShowAdminPanel(true);
    };
    getSession();
  }, []);

  useEffect(() => {
    const checkInterviewStatus = async () => {
      if (!userId) return;
      const { data, error } = await supabase
        .from('users')
        .select('interview_completed, interview_passed, interview_reviewed_at')
        .eq('id', userId)
        .maybeSingle();

      // Never overwrite 'analysis' or 'in_progress' — user may be viewing analysis or actively in interview
      if (interviewStatusRef.current === 'analysis' || interviewStatusRef.current === 'in_progress') return;

      if (error || !data) {
        setInterviewStatus('not_started');
        return;
      }
      // Admin always gets not_started so they can run the interview again (never stuck on under_review/congratulations)
      const { data: { session } } = await supabase.auth.getSession();
      const email = session?.user?.email ?? null;
      if (email === 'admin@amoraea.com') {
        setInterviewStatus('not_started');
        return;
      }
      if (!data.interview_completed) {
        setInterviewStatus('not_started');
      } else if (data.interview_passed && data.interview_reviewed_at) {
        setInterviewStatus('congratulations');
      } else {
        setInterviewStatus('under_review');
      }
    };
    checkInterviewStatus();
  }, [userId]);

  // Admin never stays on interview-complete screens — send to admin panel (and intro when they close it)
  useEffect(() => {
    if (!isAdmin) return;
    if (interviewStatus === 'under_review' || interviewStatus === 'congratulations' || interviewStatus === 'analysis') {
      setShowAdminPanel(true);
      setInterviewStatus('not_started');
    }
  }, [isAdmin, interviewStatus]);

  // Failsafe: never stay on "Loading..." forever (e.g. slow auth in incognito)
  useEffect(() => {
    const t = setTimeout(() => {
      if (interviewStatusRef.current === 'loading') {
        setInterviewStatus('not_started');
      }
    }, 5000);
    return () => clearTimeout(t);
  }, []);

  // Failsafe: ensure we navigate to analysis when interview completed (even without attemptId yet)
  useEffect(() => {
    if (!ALPHA_MODE || !userId) return;
    if (interviewStatus === 'analysis') return;
    if (status !== 'results' || !results) return;
    if (__DEV__) console.warn('[Aria] Failsafe navigation to analysis triggered');
    setInterviewStatus('analysis');
  }, [ALPHA_MODE, userId, status, results, interviewStatus]);

  useEffect(() => {
    if (!userId || isAdmin) return;
    const run = async () => {
      const saved = await loadInterviewFromStorage(userId);
      const payload = saved?.pendingAttemptPayload as { insert: Record<string, unknown>; update: Record<string, unknown>; attemptNum: number } | undefined;
      if (!saved?.pendingDatabaseSave || !payload?.insert) return;
      try {
        await ensureValidSession();
        const { data: insertData, error: insertErr } = await supabase.from('interview_attempts').insert(payload.insert).select('id').single();
        if (insertErr) throw new Error(insertErr.message);
        const update = { ...payload.update, latest_attempt_id: insertData?.id ?? null };
        const { error: updateErr } = await supabase.from('users').update(update).eq('id', userId);
        if (updateErr) throw new Error(updateErr.message);
        const next = { ...saved };
        delete next.pendingDatabaseSave;
        delete next.saveFailedAt;
        delete next.pendingAttemptPayload;
        await saveInterviewProgress(userId, next);
      } catch (err) {
        if (__DEV__) console.warn('Recovery save still failing:', err instanceof Error ? err.message : err);
      }
    };
    run();
  }, [userId, isAdmin, ensureValidSession]);

  scenarioScoresRef.current = scenarioScores;
  useEffect(() => {
    if (!userId || isAdmin || status !== 'active' || messages.length === 0) return;
    const completed = Array.from(scoredScenariosRef.current);
    const scenarioScoresPayload: Record<number, { pillarScores: Record<string, number>; pillarConfidence: Record<string, string>; keyEvidence: Record<string, string>; scenarioName?: string }> = {};
    [1, 2, 3].forEach((n) => {
      const s = scenarioScores[n];
      if (s) scenarioScoresPayload[n] = { pillarScores: s.pillarScores, pillarConfidence: s.pillarConfidence, keyEvidence: s.keyEvidence, scenarioName: s.scenarioName };
    });
    saveInterviewProgress(userId, {
      messages: messages.filter((m) => !(m as { isScoreCard?: boolean }).isScoreCard && !(m as { isWelcomeBack?: boolean }).isWelcomeBack),
      scenariosCompleted: completed,
      scenarioScores: scenarioScoresPayload,
      currentScenario: getCurrentScenario(scoredScenariosRef.current),
    });
  }, [messages, status, userId, isAdmin, scenarioScores]);

  const { data: profile } = useQuery({
    queryKey: ['profile', userId],
    queryFn: () => profileRepository.getProfile(userId),
  });
  const queryClient = useQueryClient();

  const typologyContext = ''; // Optional: load from profile/assessments later

  useEffect(() => {
    scrollViewRef.current?.scrollToEnd?.({ animated: true });
  }, [messages, status]);

  useEffect(() => {
    const notScoreCard = (m: { role: string; content?: string; isScoreCard?: boolean; isWelcomeBack?: boolean }) =>
      !(m as { isScoreCard?: boolean }).isScoreCard && !(m as { isWelcomeBack?: boolean }).isWelcomeBack;
    const assistantOrError = messages.filter(
      (m) => (m.role === 'assistant' || (m as { isError?: boolean }).isError) && notScoreCard(m)
    );
    const latest = assistantOrError[assistantOrError.length - 1];
    const isError = (latest as { isError?: boolean })?.isError === true;
    setInterviewerLineIsError(isError);
    const text = latest?.content ?? '';
    const cleaned = isError
      ? text
      : text
          .replace(/\[INTERVIEW_COMPLETE\]/g, '')
          .replace(/\[SCENARIO_COMPLETE:\d\]/g, '')
          .replace(/\[STAGE_[123]_COMPLETE\]/g, '')
          .trim();
    setCurrentInterviewerText(cleaned);
    const assistantOnly = messages.filter(
      (m) => m.role === 'assistant' && notScoreCard(m)
    );
    let found: ActiveScenario | null = null;
    for (let i = assistantOnly.length - 1; i >= 0; i--) {
      const scenario = detectActiveScenarioFromMessage(assistantOnly[i].content ?? '');
      if (scenario) {
        found = scenario;
        break;
      }
    }
    setActiveScenario(found ?? null);
  }, [messages]);

  const showChatError = useCallback((message: string) => {
    setMessages((prev) => [
      ...prev,
      { role: 'error', content: message, isError: true } as { role: string; content: string; isError?: boolean },
    ]);
  }, []);

  const speak = useCallback(async (text: string) => {
    stopElevenLabsSpeech();
    lastQuestionTextRef.current = text;
    setVoiceState('speaking');
    isSpeakingRef.current = true;
    try {
      await speakWithElevenLabs(text);
    } finally {
      isSpeakingRef.current = false;
      timingRef.current.questionEndTime = Date.now();
      setVoiceState('idle');
    }
  }, []);

  /** Attempts TTS; on failure shows text visually and continues (no stall). */
  const speakTextSafe = useCallback(
    async (text: string, options: { silent?: boolean } = {}) => {
      const { silent = false } = options;
      try {
        await withRetry(() => speak(text), {
          retries: 1,
          baseDelay: 3000,
          context: 'TTS',
        });
        setTTSFallbackActive(false);
      } catch (err) {
        if (__DEV__) console.warn('TTS failed, falling back to visual display:', err instanceof Error ? err.message : err);
        if (!silent) setTTSFallbackActive(true);
        setVoiceState('idle');
      }
    },
    [speak]
  );

  // ── Web: use browser SpeechRecognition (reliable result events)
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    const SR = (window as unknown as { SpeechRecognition?: new () => unknown }).SpeechRecognition
      || (window as unknown as { webkitSpeechRecognition?: new () => unknown }).webkitSpeechRecognition;
    if (!SR) {
      setMicError('Speech recognition is not supported. Please use Chrome or Safari.');
      return;
    }
    const rec = new SR() as {
      continuous: boolean;
      interimResults: boolean;
      lang: string;
      maxAlternatives: number;
      start(): void;
      stop(): void;
      onresult: (e: unknown) => void;
      onerror: (e: { error: string }) => void;
    };
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = 'en-US';
    rec.maxAlternatives = 1;
    rec.onresult = (e: unknown) => {
      const ev = e as { resultIndex: number; results: Array<{ isFinal: boolean; [i: number]: { transcript?: string } }> };
      let interim = '';
      let final = '';
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const r = ev.results[i];
        const t = (r && typeof r === 'object' && r[0]?.transcript) ?? '';
        if (r?.isFinal) final += t;
        else interim += t;
      }
      setCurrentTranscript((prev) => (final || interim || prev).trim());
      transcriptAtReleaseRef.current = (final || interim).trim();
    };
    rec.onerror = (e) => {
      console.log('<---e', e);
      if (e.error === 'not-allowed') {
        setMicError('Microphone access was denied.');
      } else if (e.error === 'aborted') {
        // User or we stopped; ignore
      } else if (e.error === 'network' || e.error === 'no-speech') {
        setMicWarning(
          e.error === 'network'
            ? 'Connection problem. Check your internet and try again.'
            : 'No speech heard. Try again when ready.'
        );
      } else {
        setMicError(`Microphone error: ${e.error}`);
      }
    };
    recognitionRef.current = rec;
    return () => { try { rec.stop(); } catch {} };
  }, []);

  // ── Native: expo-speech-recognition (start/stop, read transcript from ref)
  const nativeTranscriptRef = useRef({ final: '', interim: '' });
  useSpeechRecognitionEvent('result', (event: { results: unknown; isFinal: boolean }) => {
    if (Platform.OS === 'web') return;
    const results = event.results as { length: number; [i: number]: { transcript?: string }; isFinal?: boolean }[];
    const r = results?.[0];
    if (!r) return;
    let t = '';
    for (let i = 0; i < (r.length ?? 0); i++) t += (r[i]?.transcript ?? '');
    t = t.trim();
    if (!t) return;
    if (event.isFinal) {
      nativeTranscriptRef.current.final += (nativeTranscriptRef.current.final ? ' ' : '') + t;
    } else {
      nativeTranscriptRef.current.interim = t;
    }
    const full = nativeTranscriptRef.current.final + (nativeTranscriptRef.current.interim ? ' ' + nativeTranscriptRef.current.interim : '');
    setCurrentTranscript(full);
    transcriptAtReleaseRef.current = full;
  });
  useSpeechRecognitionEvent('end', () => {
    if (Platform.OS === 'web') return;
    const { final: f, interim: i } = nativeTranscriptRef.current;
    transcriptAtReleaseRef.current = (f + (i ? ' ' + i : '')).trim();
  });

  const fetchStageScore = useCallback(async (finalMessages: { role: string; content: string }[]): Promise<InterviewResults> => {
    const context = typologyContext || 'No typology context — score from transcript only.';
    const fallback: InterviewResults = {
      pillarScores: { '1': 6, '3': 7, '4': 6, '5': 7, '6': 5, '9': 6 },
      keyEvidence: {},
      narrativeCoherence: 'moderate',
      behavioralSpecificity: 'moderate',
      notableInconsistencies: [],
      interviewSummary: 'Partial score (no API key or error).',
    };
    if (!ANTHROPIC_API_KEY && !ANTHROPIC_PROXY_URL) return fallback;
    const apiUrl = getAnthropicEndpoint();
    const useProxy = apiUrl !== 'https://api.anthropic.com/v1/messages';
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (useProxy && SUPABASE_ANON_KEY) headers['Authorization'] = `Bearer ${SUPABASE_ANON_KEY}`;
    else if (!useProxy) {
      headers['x-api-key'] = ANTHROPIC_API_KEY;
      headers['anthropic-version'] = '2023-06-01';
    }
    try {
      const res = await fetch(apiUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1500,
          messages: [{ role: 'user', content: buildScoringPrompt(finalMessages, context) }],
        }),
      });
      const data = await res.json();
      const raw = (data.content?.[0]?.text ?? '{}').replace(/```json|```/g, '').trim();
      return JSON.parse(raw) as InterviewResults;
    } catch {
      return fallback;
    }
  }, [typologyContext]);

  const saveScenarioCheckpoint = useCallback(
    async (
      scenarioNumber: 1 | 2 | 3,
      result: ScenarioScoreResult,
      allMessages: { role: string; content: string }[],
      uid: string
    ) => {
      if (!uid) return;
      const transcriptSnapshot = allMessages.filter((m) => !(m as { isScoreCard?: boolean }).isScoreCard);
      try {
        const updateData: Record<string, unknown> = {
          [`interview_scenario_${scenarioNumber}_scores`]: {
            pillarScores: result.pillarScores,
            pillarConfidence: result.pillarConfidence,
            keyEvidence: result.keyEvidence,
            scenarioName: result.scenarioName,
          },
          interview_transcript: transcriptSnapshot,
          interview_last_checkpoint: scenarioNumber,
        };
        const { error } = await supabase.from('users').update(updateData).eq('id', uid);
        if (error) console.error(`Failed to save scenario ${scenarioNumber} checkpoint:`, error);
      } catch (err) {
        console.error('Checkpoint save error:', err);
      }
    },
    []
  );

  const scoreScenario = useCallback(
    async (scenarioNumber: 1 | 2 | 3, allMessages: { role: string; content: string }[], scenario3Type?: 'scenario' | 'personal') => {
      if (!ANTHROPIC_API_KEY && !ANTHROPIC_PROXY_URL) return;
      const userMessages = allMessages.filter((m) => m.role === 'user');
      if (userMessages.length < 2 && __DEV__) {
        console.warn(
          `Scenario ${scenarioNumber} scored with insufficient user messages (${userMessages.length}) — both-characters answer may be missing. Token may have fired before the answer was received.`
        );
      }
      const typeFor3 = scenarioNumber === 3 ? (scenario3Type ?? inferScenario3Type(allMessages)) : undefined;
      const apiUrl = getAnthropicEndpoint();
      const useProxy = apiUrl !== 'https://api.anthropic.com/v1/messages';
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (useProxy && SUPABASE_ANON_KEY) headers['Authorization'] = `Bearer ${SUPABASE_ANON_KEY}`;
      else if (!useProxy) {
        headers['x-api-key'] = ANTHROPIC_API_KEY;
        headers['anthropic-version'] = '2023-06-01';
      }
      try {
        const scenarioResult = await withRetry(
          async (): Promise<ScenarioScoreResult> => {
            const res = await fetch(apiUrl, {
              method: 'POST',
              headers,
              body: JSON.stringify({
                model: 'claude-sonnet-4-20250514',
                max_tokens: 800,
                messages: [{ role: 'user', content: buildScenarioScoringPrompt(scenarioNumber, allMessages, typeFor3) }],
              }),
            });
            const data = await res.json();
            const raw = (data.content?.[0]?.text ?? '{}').replace(/```json|```/g, '').trim();
            if (!res.ok) {
              const e = new Error((data as { error?: { message?: string } })?.error?.message ?? `HTTP ${res.status}`);
              (e as Error & { status?: number }).status = res.status;
              throw e;
            }
            return JSON.parse(raw) as ScenarioScoreResult;
          },
          {
            retries: 3,
            baseDelay: 5000,
            maxDelay: 30000,
            context: `scoring scenario ${scenarioNumber}`,
            onUnrecoverable: (err) => {
              if (__DEV__) {
                const status = (err as { status?: number })?.status;
                console.error(`Scoring unrecoverable error (scenario ${scenarioNumber}):`, status);
              }
            },
          }
        );
        const scoreMessage = formatScoreMessage(scenarioResult);
        setScenarioScores((prev) => ({ ...prev, [scenarioNumber]: scenarioResult }));
        if (ALPHA_MODE) {
          const ps = scenarioResult.pillarScores ?? {};
          const vals = Object.values(ps);
          const postScore = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
          probeLogRef.current.push({
            scenario: scenarioNumber,
            construct: 'combined',
            probe_fired: false,
            trigger_reason: null,
            pre_probe_score: 0,
            post_probe_score: Math.round(postScore * 10) / 10,
            score_delta: Math.round(postScore * 10) / 10,
          });
        }
        setMessages((prev) => [
          ...prev,
          { role: 'system', content: scoreMessage, isScoreCard: true } as { role: string; content: string; isScoreCard?: boolean },
        ]);
        saveScenarioCheckpoint(scenarioNumber, scenarioResult, allMessages, userId);
      } catch (err) {
        if (__DEV__) console.error(`Scoring failed for scenario ${scenarioNumber}:`, err instanceof Error ? err.message : err);
        const saved = await loadInterviewFromStorage(userId);
        if (saved) {
          const scoringFailed = [...(saved.scoringFailed ?? []), { scenario: scenarioNumber, failedAt: new Date().toISOString(), error: err instanceof Error ? err.message : String(err) }];
          await saveInterviewProgress(userId, { ...saved, scoringFailed });
        }
      }
    },
    [userId, saveScenarioCheckpoint]
  );

  const canSwitchScenario = useCallback(
    (scenarioNumber: number) => {
      if (scenarioNumber === 2) return false;
      const current = getCurrentScenario(scoredScenariosRef.current);
      return current === scenarioNumber && highestScenarioReached === scenarioNumber;
    },
    [highestScenarioReached]
  );

  const handleScenarioSwitch = useCallback(
    (
      scenarioNumber: number,
      fromMode: 'personal' | 'fictional',
      toMode: 'personal' | 'fictional',
      messageIndex: number
    ) => {
      setScenarioScores((prev) => {
        const next = { ...prev };
        delete next[scenarioNumber];
        return next;
      });
      probeLogRef.current = probeLogRef.current.filter((p) => p.scenario !== scenarioNumber);
      responseTimingsRef.current = responseTimingsRef.current.filter(
        (t) => t.scenario !== scenarioNumber
      );
      if (scenarioScoresRef.current[scenarioNumber]) {
        delete scenarioScoresRef.current[scenarioNumber];
      }
      scoredScenariosRef.current.delete(scenarioNumber);
      setScenarioMode((prev) => ({ ...prev, [scenarioNumber]: toMode }));
      setSwitchLog((prev) => [
        ...prev,
        {
          scenario: scenarioNumber,
          switched_from: fromMode,
          switched_to: toMode,
          switched_at_message_index: messageIndex,
          timestamp: new Date().toISOString(),
        },
      ]);
    },
    []
  );

  const processUserSpeech = useCallback(async (spokenText: string) => {
    if (!spokenText.trim()) {
      setVoiceState('idle');
      return;
    }
    const trimmed = spokenText.trim();

    if (ALPHA_MODE && timingRef.current.recordingStartTime != null) {
      timingRef.current.recordingEndTime = Date.now();
      const qEnd = timingRef.current.questionEndTime ?? timingRef.current.recordingStartTime;
      const latency = timingRef.current.recordingStartTime - qEnd;
      const duration = (timingRef.current.recordingEndTime ?? 0) - timingRef.current.recordingStartTime;
      const wordCount = trimmed.split(/\s+/).filter(Boolean).length;
      const scenario = getCurrentScenario(scoredScenariosRef.current);
      responseTimingsRef.current.push({
        question_id: `q_${responseTimingsRef.current.length + 1}`,
        scenario: scenario ?? null,
        question_text: lastQuestionTextRef.current,
        latency_ms: Math.max(0, latency),
        duration_ms: Math.max(0, duration),
        word_count: wordCount,
      });
      timingRef.current.recordingStartTime = null;
      timingRef.current.questionEndTime = null;
    }

    // Admin secret pass: skip interview and auto-approve for configured email (onboarding only)
    const isOnboardingInterview = route?.name === 'OnboardingInterview';
    if (isOnboardingInterview && trimmed === ADMIN_PASS_PHRASE) {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const email = (session?.user?.email ?? '').toLowerCase();
        if (email === ADMIN_PASS_EMAIL.toLowerCase()) {
          const adminGate1Score: Gate1Score = {
            pillarScores: { '1': 7, '3': 7, '4': 7, '5': 7, '6': 7, '9': 7 },
            averageScore: 7,
            narrativeCoherence: 'high',
            behavioralSpecificity: 'high',
            passed: true,
            failReasons: [],
            scoredAt: new Date().toISOString(),
          };
          await profileRepository.upsertProfile(userId, {
            gate1Score: adminGate1Score,
            applicationStatus: 'approved',
            onboardingStage: 'basic_info',
          });
          queryClient.invalidateQueries({ queryKey: ['profile', userId] });
          setVoiceState('idle');
          navigation.replace('PostInterview', { userId });
          return;
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Could not skip interview.';
        if (Platform.OS === 'web') {
          window.alert(`Admin pass failed: ${msg}`);
        } else {
          Alert.alert('Admin pass failed', msg);
        }
        setVoiceState('idle');
        return;
      }
    }

    if (isOnboardingInterview && messages.length === 0 && !profile?.name?.trim() && looksLikeName(trimmed)) {
      try {
        await profileRepository.upsertProfile(userId, { name: trimmed });
        queryClient.invalidateQueries({ queryKey: ['profile', userId] });
      } catch (_) {
        // ignore
      }
    }

    const userMsg: MessageWithScenario = {
      role: 'user',
      content: trimmed,
      scenarioNumber: getScenarioNumberForNewMessage(messages, 'user'),
    };
    const newMessages: MessageWithScenario[] = [...messages, userMsg];

    // Closing question answer: handle locally — "no" → advance; "yes" → ask what to add and wait
    if (lastClosingQuestionScenarioRef.current !== null) {
      const pendingClosingScenario = lastClosingQuestionScenarioRef.current as 1 | 2 | 3;
      setMessages(newMessages);
      setCurrentTranscript('');
      transcriptAtReleaseRef.current = '';
      setVoiceState('processing');
      const lower = trimmed.toLowerCase().trim();
      // Explicit affirmatives — checked first so short "yes" is never treated as decline
      const isAffirmative = [
        'yes',
        'yeah',
        'yep',
        'yup',
        'sure',
        'actually',
        'there is',
        'there was',
        'one thing',
        'i wanted to',
        'i do',
        'kind of',
        'a bit',
      ].some((p) => lower.includes(p)) || /^\s*yes\s*\.?\s*$/i.test(trimmed);
      const isDecline = [
        'no',
        'nope',
        'nothing',
        "i'm good",
        'im good',
        "that's all",
        'thats all',
        'nevermind',
        'never mind',
        'all good',
        'nothing else',
        'nah',
        'nothin',
      ].some((p) => lower.includes(p)) || (lower.length < 4 && !isAffirmative);

      if (isAffirmative && !isDecline) {
        lastClosingQuestionScenarioRef.current = null;
        waitingForClosingAdditionRef.current = pendingClosingScenario;
        const followUp = 'What would you want to add?';
        const updatedMessages = [...newMessages, { role: 'assistant', content: followUp }];
        setMessages(updatedMessages);
        await speakTextSafe(followUp);
        setVoiceState('idle');
        return;
      }

      markClosingQuestionAnswered(pendingClosingScenario);
      let nextContent = '';
      if (pendingClosingScenario === 1) {
        nextContent = `On to the second situation.\n\n${SCENARIO_2_TEXT}\n\nIf you were Casey in that moment — what would you say to Jordan?`;
      } else if (pendingClosingScenario === 2) {
        nextContent = `Last one — situation three.\n\n${STAGE_3_PERSONAL_QUESTION}`;
        stage3PersonalQuestionAskedRef.current = true;
        stage3ModeRef.current = null;
      }
      // No separate "Got it — let's move on." — the transition + next scenario is the acknowledgment (avoids TTS pause)
      const fullDisplay = nextContent || 'Got it.';
      const updatedMessages = [...newMessages, { role: 'assistant', content: fullDisplay }];
      setMessages(updatedMessages);
      await speakTextSafe(fullDisplay);
      const scenarioNumber = pendingClosingScenario;
      setHighestScenarioReached((prev) => Math.max(prev, scenarioNumber));
      if (!scoredScenariosRef.current.has(scenarioNumber)) {
        scoredScenariosRef.current.add(scenarioNumber);
        const scenario3Type = scenarioNumber === 3 ? inferScenario3Type(updatedMessages) : undefined;
        scoreScenario(scenarioNumber, updatedMessages, scenario3Type);
      }
      if (__DEV__) {
        closingQuestionAskedRef.current[scenarioNumber] = false;
        closingQuestionAnsweredRef.current[scenarioNumber] = false;
      }
      lastAnsweredClosingScenarioRef.current = null;
      setVoiceState('idle');
      if (__DEV__) console.log('[Aria] Closing-question answer handled locally — advanced to next scenario', scenarioNumber);
      return;
    }

    // Closing addition: user said "yes" and we asked "What would you want to add?" — this is their addition (or withdrawal)
    if (waitingForClosingAdditionRef.current !== null) {
      const scenarioNumber = waitingForClosingAdditionRef.current as 1 | 2 | 3;
      waitingForClosingAdditionRef.current = null;
      markClosingQuestionAnswered(scenarioNumber);
      setMessages(newMessages);
      setCurrentTranscript('');
      transcriptAtReleaseRef.current = '';
      setVoiceState('processing');
      const lower = trimmed.toLowerCase().trim();
      const isWithdrawal = [
        'nevermind',
        'never mind',
        'forget it',
        "it's fine",
        'its fine',
        'nothing',
        'no',
        'lets move on',
        "let's move on",
      ].some((p) => lower.includes(p)) || lower.length < 3;
      let nextContent = '';
      if (scenarioNumber === 1) {
        nextContent = `On to the second situation.\n\n${SCENARIO_2_TEXT}\n\nIf you were Casey in that moment — what would you say to Jordan?`;
      } else if (scenarioNumber === 2) {
        nextContent = `Last one — situation three.\n\n${STAGE_3_PERSONAL_QUESTION}`;
        stage3PersonalQuestionAskedRef.current = true;
        stage3ModeRef.current = null;
      }
      // No separate "Got it" — advance immediately with transition + next scenario only (avoids pause)
      const fullDisplay = nextContent || 'Got it.';
      const updatedMessages = [...newMessages, { role: 'assistant', content: fullDisplay }];
      setMessages(updatedMessages);
      await speakTextSafe(fullDisplay);
      setHighestScenarioReached((prev) => Math.max(prev, scenarioNumber));
      if (!scoredScenariosRef.current.has(scenarioNumber)) {
        scoredScenariosRef.current.add(scenarioNumber);
        const scenario3Type = scenarioNumber === 3 ? inferScenario3Type(updatedMessages) : undefined;
        scoreScenario(scenarioNumber, updatedMessages, scenario3Type);
      }
      if (__DEV__) {
        closingQuestionAskedRef.current[scenarioNumber] = false;
        closingQuestionAnsweredRef.current[scenarioNumber] = false;
      }
      lastAnsweredClosingScenarioRef.current = null;
      setVoiceState('idle');
      return;
    }

    // Stage 3 personal question response: user just answered "do you have a bottling-up example?"
    if (stage3PersonalQuestionAskedRef.current && stage3ModeRef.current === null) {
      const lower = trimmed.toLowerCase().trim();
      const wordCount = trimmed.trim().split(/\s+/).filter(Boolean).length;
      const explicitDeclinePhrases = [
        'no',
        'nope',
        'nothing',
        "i don't know",
        "i dont know",
        "can't think of one",
        'nothing comes to mind',
        'not really',
      ];
      const giveMeScenarioPhrases = [
        'just give me the scenario',
        'lets do the scenario',
        'give me a situation',
        "i'd rather use a scenario",
        "i'd rather do the scenario",
        'use the scenario',
        'fake one',
        'give me the scenario',
      ];
      const isExplicitDecline = explicitDeclinePhrases.some((p) => lower.includes(p)) && wordCount < 10;
      const isGiveMeScenario = giveMeScenarioPhrases.some((p) => lower.includes(p));
      const isDecline = isExplicitDecline || isGiveMeScenario;
      setMessages(newMessages);
      setCurrentTranscript('');
      transcriptAtReleaseRef.current = '';
      setVoiceState('processing');
      stage3PersonalQuestionAskedRef.current = false;
      if (isDecline) {
        stage3ModeRef.current = 'fictional';
        const scenarioContent = `No problem — here's the situation.\n\n${SCENARIO_3_TEXT}\n\nIf you were Drew, after giving in like that — what would you say to Riley?`;
        const updatedMessagesStage3 = [...newMessages, { role: 'assistant', content: scenarioContent }];
        setMessages(updatedMessagesStage3);
        await speakTextSafe(scenarioContent);
        setVoiceState('idle');
        return;
      }
      stage3ModeRef.current = 'personal';
      setExchangeCount((c) => c + 1);
      setVoiceState('processing');
      // Fall through — normal path will send newMessages to Claude for follow-up (personal story or ambiguous)
    }

    const currentScenario = getCurrentScenario(scoredScenariosRef.current);
    const currentMode: 'personal' | 'fictional' | null =
      currentScenario != null
        ? (scenarioMode[currentScenario] ?? (currentScenario === 2 ? 'fictional' : 'personal'))
        : null;
    const switchIntent = currentMode ? detectScenarioSwitch(trimmed, currentMode) : null;
    const isSwitch =
      !!(
        switchIntent &&
        currentScenario != null &&
        canSwitchScenario(currentScenario)
      );

    if (isSwitch && currentScenario != null) {
      const fromMode = switchIntent === 'to_fictional' ? 'personal' : 'fictional';
      const toMode = switchIntent === 'to_fictional' ? 'fictional' : 'personal';
      handleScenarioSwitch(currentScenario, fromMode, toMode, newMessages.length);
      // Never clear or truncate messages on switch — thread stays continuous; only internal state was reset above.
      setMessages(newMessages);
      setCurrentTranscript('');
      transcriptAtReleaseRef.current = '';
      setVoiceState('processing');
      setExchangeCount((c) => c + 1);
      var messagesToUse = newMessages;
    } else {
      setMessages(newMessages);
      setCurrentTranscript('');
      transcriptAtReleaseRef.current = '';
      setVoiceState('processing');
      setExchangeCount((c) => c + 1);
      var messagesToUse = newMessages;
    }
    const detected = detectConstructs(trimmed);
    setTouchedConstructs((prev) => [...new Set([...prev, ...detected])]);

    // Track if user shared a personal example (response to personal-opening question that isn't a decline)
    const lastAssistant = [...messagesToUse].reverse().find((m) => m.role === 'assistant');
    const lastContent = (lastAssistant?.content ?? '').toLowerCase();
    const isPersonalOpening = /real (memory|example|situation|experience)|your own|from your (life|experience)|think of a time|can you think of|do you have (a|an) (example|memory)|share (a|something)|tell me about (a|something)/i.test(lastContent);
    if (isPersonalOpening && !isDecline(trimmed)) setUsedPersonalExamples(true);

    if (!ANTHROPIC_API_KEY && !ANTHROPIC_PROXY_URL) {
      setVoiceState('idle');
      showChatError(CHAT_ERROR_MESSAGES.proxyError);
      return;
    }

    // Scenarios need more tokens — detect from last user message (no-example → scenario next)
      const lastUserMsg = (messagesToUse[messagesToUse.length - 1] as { content?: string })?.content?.toLowerCase() ?? '';
      const isNoExample = /don't have|can't think|i dont|nothing comes|no example|i don't/i.test(lastUserMsg);
      const maxTok = isNoExample ? 600 : 200;
      const closingInstruction = usedPersonalExamples ? PERSONAL_CLOSING_INSTRUCTION : SCENARIO_ONLY_CLOSING_INSTRUCTION;
      const requestBody = {
        model: 'claude-sonnet-4-20250514',
        max_tokens: maxTok,
        system: INTERVIEWER_SYSTEM + OPENING_INSTRUCTIONS + SCENARIO_SWITCHING_INSTRUCTIONS + SCENARIO_3_SWITCHING + SCENARIO_2_NO_PERSONAL + SCENARIO_BOUNDARY_INSTRUCTIONS + SCENARIO_CLOSING_INSTRUCTIONS + PERSONAL_DISCLOSURE_TRANSITION + SKIP_HANDLING_INSTRUCTIONS + SCORE_REQUEST_INSTRUCTIONS + OFF_TOPIC_INSTRUCTIONS + REPEAT_HANDLING_INSTRUCTIONS + THIN_RESPONSE_INSTRUCTIONS + NO_REPEAT_INSTRUCTIONS + PAUSE_HANDLING_INSTRUCTIONS + DISTRESS_HANDLING_INSTRUCTIONS + MISUNDERSTANDING_HANDLING_INSTRUCTIONS + SCENARIO_REDIRECT_QUESTIONS + STAGE_3_NOTHING_SAID + COMMUNICATION_QUESTION_CHECK + PUSHBACK_RESPONSE_INSTRUCTIONS + REPAIR_COHERENCE_INSTRUCTIONS + SCENARIO_COMPLETE_TOKEN_INSTRUCTIONS + CLOSING_LINE_INSTRUCTIONS + closingInstruction,
        messages: messagesToUse
          .filter((m) => m.role === 'user' || m.role === 'assistant')
          .map((m) => ({ role: m.role, content: m.content })),
      };
    const apiUrl = getAnthropicEndpoint();
    const useProxy = apiUrl !== 'https://api.anthropic.com/v1/messages';
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (useProxy && SUPABASE_ANON_KEY) {
      headers['Authorization'] = `Bearer ${SUPABASE_ANON_KEY}`;
    } else if (!useProxy) {
      headers['x-api-key'] = ANTHROPIC_API_KEY;
      headers['anthropic-version'] = '2023-06-01';
    }

    let data: { content?: Array<{ text?: string }>; error?: { message?: string } };
    const makeCall = async (): Promise<typeof data> => {
      const res = await fetch(apiUrl, { method: 'POST', headers, body: JSON.stringify(requestBody) });
      const raw = await res.text();
      let parsed: typeof data;
      try {
        parsed = JSON.parse(raw);
      } catch {
        const e = new Error('Invalid response');
        (e as Error & { status?: number }).status = res.status;
        throw e;
      }
      if (!res.ok) {
        const e = new Error(parsed?.error?.message ?? `HTTP ${res.status}`);
        (e as Error & { status?: number }).status = res.status;
        throw e;
      }
      return parsed;
    };

    const numUserMessages = messagesToUse.filter((m) => m.role === 'user').length;
    const isFirstExchange = numUserMessages === 1;
    if (isFirstExchange) {
      await new Promise((r) => setTimeout(r, 500));
    }
    try {
      data = await withRetry(makeCall, {
        retries: 4,
        baseDelay: isFirstExchange ? 3000 : 12000,
        maxDelay: isFirstExchange ? 10000 : 45000,
        context: isFirstExchange ? 'welcome message' : 'conversation',
        onRetry: (attempt) => {
          if (attempt === 1) {
            setIsWaiting(true);
            setVoiceState('processing');
          }
          if (__DEV__) console.log(`[conversation] rate limit retry attempt ${attempt}`);
        },
        onUnrecoverable: () => {
          setIsWaiting(false);
          setVoiceState('idle');
        },
      });
      setIsWaiting(false);
    } catch (err) {
      setIsWaiting(false);
      setVoiceState('idle');
      const errObj = err as Error & { status?: number; retriesExhausted?: boolean; unrecoverable?: boolean };
      const status = errObj.status;
      const type = classifyError(err);
      // NEVER show "trouble connecting" for 429 until ALL retries are exhausted
      if (status === 429 && !errObj.retriesExhausted) return;
      if (type === 'retryable' && !errObj.retriesExhausted) return;
      const errorMessage = getErrorMessage(err, errObj.retriesExhausted);
      showChatError(errorMessage);
      const completed = Array.from(scoredScenariosRef.current);
      const scenarioScoresPayload: Record<number, { pillarScores: Record<string, number>; pillarConfidence: Record<string, string>; keyEvidence: Record<string, string>; scenarioName?: string }> = {};
      [1, 2, 3].forEach((n) => {
        const s = scenarioScoresRef.current[n];
        if (s) scenarioScoresPayload[n] = { pillarScores: s.pillarScores, pillarConfidence: s.pillarConfidence, keyEvidence: s.keyEvidence, scenarioName: s.scenarioName };
      });
      saveInterviewProgress(userId, {
        messages: messagesToUse.filter((m) => !(m as { isWaiting?: boolean }).isWaiting),
        scenariosCompleted: completed,
        scenarioScores: scenarioScoresPayload,
        currentScenario: getCurrentScenario(scoredScenariosRef.current),
      });
      return;
    }

    const text = (data.content?.[0]?.text ?? '').trim();

      // Failsafe: AI acknowledged closing question but did not output [SCENARIO_COMPLETE] or next scenario — inject advance so interview does not stop
      const closingAckPattern = /\b(got it|okay|alright)\b.*\b(move on|on to the next|next one)\b/i;
      const looksLikeClosingAck = closingAckPattern.test(text) || (/\blet'?s move on\b/i.test(text) && /got it|okay|alright/i.test(text));
      const justAnsweredClosing = lastAnsweredClosingScenarioRef.current != null;
      const noScenarioCompleteInResponse = !/\[SCENARIO_COMPLETE:\d\]/.test(text);
      if (justAnsweredClosing && looksLikeClosingAck && noScenarioCompleteInResponse) {
        const scenarioNumber = lastAnsweredClosingScenarioRef.current as 1 | 2 | 3;
        const canAdvance =
          closingQuestionAskedRef.current[scenarioNumber] === true &&
          closingQuestionAnsweredRef.current[scenarioNumber] === true;
        let nextContent = '';
        if (scenarioNumber === 1) {
          nextContent = `On to the second situation.\n\n${SCENARIO_2_TEXT}\n\nIf you were Casey in that moment — what would you say to Jordan?`;
        } else if (scenarioNumber === 2) {
          nextContent = `Last one — situation three.\n\n${STAGE_3_PERSONAL_QUESTION}`;
          stage3PersonalQuestionAskedRef.current = true;
          stage3ModeRef.current = null;
        }
        const fullDisplay = nextContent || (stripControlTokens(text) || 'Got it.');
        const updatedMessages = [...messagesToUse, { role: 'assistant', content: fullDisplay }];
        setMessages(updatedMessages);
        await speakTextSafe(fullDisplay);
        if (canAdvance && scenarioNumber <= 2) {
          setHighestScenarioReached((prev) => Math.max(prev, scenarioNumber));
          if (!scoredScenariosRef.current.has(scenarioNumber)) {
            scoredScenariosRef.current.add(scenarioNumber);
            const scenario3Type = scenarioNumber === 3 ? inferScenario3Type(updatedMessages) : undefined;
            scoreScenario(scenarioNumber, updatedMessages, scenario3Type);
          }
          if (__DEV__) {
            closingQuestionAskedRef.current[scenarioNumber] = false;
            closingQuestionAnsweredRef.current[scenarioNumber] = false;
          }
        }
        lastAnsweredClosingScenarioRef.current = null;
        setVoiceState('idle');
        if (__DEV__) console.log('[Aria] Closing-ack failsafe: advanced to next scenario', scenarioNumber);
        return;
      }

      // Failsafe: AI repeated the closing question (e.g. asked again after user said "no") — don't display; advance instead
      const repeatClosingMatch = text.match(/\[CLOSING_QUESTION:(\d)\]/);
      if (repeatClosingMatch) {
        const scenarioNumber = parseInt(repeatClosingMatch[1], 10) as 1 | 2 | 3;
        if (closingQuestionAnsweredRef.current[scenarioNumber] === true) {
          if (__DEV__) console.warn('[Aria] Closing question repeat detected — advancing without displaying');
          let nextContent = '';
          if (scenarioNumber === 1) {
            nextContent = `On to the second situation.\n\n${SCENARIO_2_TEXT}\n\nIf you were Casey in that moment — what would you say to Jordan?`;
          } else if (scenarioNumber === 2) {
            nextContent = `Last one — situation three.\n\n${STAGE_3_PERSONAL_QUESTION}`;
            stage3PersonalQuestionAskedRef.current = true;
            stage3ModeRef.current = null;
          }
          const fullDisplay = nextContent || 'Got it.';
          const updatedMessages = [...messagesToUse, { role: 'assistant', content: fullDisplay }];
          setMessages(updatedMessages);
          await speakTextSafe(fullDisplay);
          setHighestScenarioReached((prev) => Math.max(prev, scenarioNumber));
          if (!scoredScenariosRef.current.has(scenarioNumber)) {
            scoredScenariosRef.current.add(scenarioNumber);
            const scenario3Type = scenarioNumber === 3 ? inferScenario3Type(updatedMessages) : undefined;
            scoreScenario(scenarioNumber, updatedMessages, scenario3Type);
          }
          if (__DEV__) {
            closingQuestionAskedRef.current[scenarioNumber] = false;
            closingQuestionAnsweredRef.current[scenarioNumber] = false;
          }
          lastAnsweredClosingScenarioRef.current = null;
          setVoiceState('idle');
          return;
        }
      }

      // Per-scenario completion token: strip token, show summary, insert score card in chat
      const scenarioMatch = text.match(/\[SCENARIO_COMPLETE:(\d)\]/);
      if (scenarioMatch) {
        lastAnsweredClosingScenarioRef.current = null;
        const scenarioNumber = parseInt(scenarioMatch[1], 10) as 1 | 2 | 3;
        const canAdvance =
          closingQuestionAskedRef.current[scenarioNumber] === true &&
          closingQuestionAnsweredRef.current[scenarioNumber] === true;
        const displayText = stripControlTokens(text) || "Good, that's helpful.";
        const updatedMessages = [...messagesToUse, { role: 'assistant', content: displayText || 'Good, that’s helpful.' }];
        setMessages(updatedMessages);
        await speakTextSafe(displayText || 'Good, that’s helpful.');
        if (canAdvance) {
          setHighestScenarioReached((prev) => Math.max(prev, scenarioNumber));
          if (!scoredScenariosRef.current.has(scenarioNumber)) {
            scoredScenariosRef.current.add(scenarioNumber);
            const scenario3Type = scenarioNumber === 3 ? inferScenario3Type(updatedMessages) : undefined;
            scoreScenario(scenarioNumber, updatedMessages, scenario3Type);
          }
          if (__DEV__) {
            closingQuestionAskedRef.current[scenarioNumber] = false;
            closingQuestionAnsweredRef.current[scenarioNumber] = false;
          }
        } else if (__DEV__) {
          console.warn(`[Aria] [SCENARIO_COMPLETE:${scenarioNumber}] ignored: closing question not asked/answered for scenario ${scenarioNumber}`);
        }
        setVoiceState('idle');
        return;
      }

      // Process INTERVIEW_COMPLETE first so final scoring runs and Stage 3 scores display immediately
      if (text.includes('[INTERVIEW_COMPLETE]')) {
        if (__DEV__) {
          console.log('=== [1] INTERVIEW_COMPLETE token detected ===');
          console.log('isAdmin:', isAdmin);
          console.log('ALPHA_MODE:', ALPHA_MODE);
          console.log('interviewStatus:', interviewStatus);
          console.log('userId:', userId);
        }
        const displayText = stripControlTokens(text) || 'Thank you. That was really helpful.';
        const finalAssistant: MessageWithScenario = {
          role: 'assistant',
          content: displayText,
          scenarioNumber: getScenarioNumberForNewMessage(messagesToUse, 'assistant', displayText),
        };
        const finalMessages = [...messagesToUse, finalAssistant];
        setMessages(finalMessages);
        await speakTextSafe(displayText);
        const transcriptForScoring = finalMessages.filter((m) => m.role === 'user' || m.role === 'assistant');
        setTimeout(() => scoreInterview(transcriptForScoring), 1000);
        return;
      }

      const stageCompleteMatch = text.match(/\[STAGE_([123])_COMPLETE\]/);
      if (stageCompleteMatch) {
        const stageNum = parseInt(stageCompleteMatch[1], 10);
        const displayText = stripControlTokens(text) || "Good, that's helpful.";
        const finalMessages = [...messagesToUse, { role: 'assistant', content: displayText || 'Good, that’s helpful.' }];
        setMessages(finalMessages);
        await speakTextSafe(displayText || 'Good, that’s helpful.');
        try {
          const stageRes = await fetchStageScore(finalMessages);
          setStageResults((prev) => {
            const existing = prev.findIndex((s) => s.stage === stageNum);
            const entry = { stage: stageNum, results: stageRes };
            if (existing >= 0) return prev.map((s, i) => (i === existing ? entry : s));
            return [...prev, entry];
          });
        } catch {
          const fallback = {
            pillarScores: { '1': 6, '3': 7, '4': 6, '5': 7, '6': 5, '9': 6 },
            keyEvidence: {},
            narrativeCoherence: 'moderate' as const,
            behavioralSpecificity: 'moderate' as const,
            notableInconsistencies: [],
            interviewSummary: 'Score unavailable.',
          };
          setStageResults((prev) => {
            const existing = prev.findIndex((s) => s.stage === stageNum);
            const entry = { stage: stageNum, results: fallback };
            if (existing >= 0) return prev.map((s, i) => (i === existing ? entry : s));
            return [...prev, entry];
          });
        }
        setVoiceState('idle');
        return;
      }

      const closingQuestionMatch = text.match(/\[CLOSING_QUESTION:(\d)\]/);
      if (closingQuestionMatch) {
        const n = parseInt(closingQuestionMatch[1], 10) as 1 | 2 | 3;
        markClosingQuestionAsked(n);
      }

      const displayText = stripControlTokens(text);
      const aiMsg: MessageWithScenario = {
        role: 'assistant',
        content: displayText,
        scenarioNumber: getScenarioNumberForNewMessage(messagesToUse, 'assistant', displayText),
      };
      lastAnsweredClosingScenarioRef.current = null;
      setMessages([...messagesToUse, aiMsg]);
      const aiDetected = detectConstructs(text);
      setTouchedConstructs((prev) => [...new Set([...prev, ...aiDetected])]);
      await speakTextSafe(displayText);
  }, [messages, speakTextSafe, route?.name, userId, navigation, queryClient, profile?.name, fetchStageScore, scoreScenario, usedPersonalExamples, scenarioMode, canSwitchScenario, handleScenarioSwitch, markClosingQuestionAsked, markClosingQuestionAnswered]);

  const handlePressStart = useCallback(async () => {
    if (voiceState !== 'idle') return;
    if (useNativeOrWhisperRecording) return; // native or web Whisper use hook (tap-to-toggle)
    setMicWarning(null);
    stopElevenLabsSpeech();
    setCurrentTranscript('');
    transcriptAtReleaseRef.current = '';
    const permission = await checkMicPermission();
    setMicPermission(permission);
    if (permission === 'denied') return;
    timingRef.current.recordingStartTime = Date.now();
    setVoiceState('listening');
    if (Platform.OS === 'web' && recognitionRef.current) {
      try { recognitionRef.current.start(); } catch {}
    } else {
      nativeTranscriptRef.current = { final: '', interim: '' };
      ExpoSpeechRecognitionModule.requestPermissionsAsync().then((r) => {
        setMicPermission(r.granted ? 'granted' : 'denied');
        if (r.granted) ExpoSpeechRecognitionModule.start({ lang: 'en-US', interimResults: true, continuous: true });
      });
    }
  }, [voiceState, useNativeOrWhisperRecording]);

  const handleRecordingError = useCallback(
    (err: Error) => {
      if (__DEV__) console.error('Recording error:', err.message);
      setVoiceState('idle');
      const msg = randomFrom(AIRA_ERROR_MESSAGES.recordingOrTranscriptionRetry);
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: msg },
      ]);
      speakTextSafe(msg).catch(() => {});
    },
    [speakTextSafe]
  );

  /** Transcribe audio (blob on web; on native prefer blob from hook, else URI or base64). Returns null on failure. */
  const transcribeSafe = useCallback(
    async (audioBlob: Blob | null, nativeUri: string | null): Promise<string | null> => {
      if (__DEV__) {
        console.log('=== TRANSCRIPTION DEBUG ===', 'Platform:', Platform.OS, 'Native URI:', nativeUri ?? 'none', 'Blob size:', audioBlob?.size ?? 0, 'Endpoint:', OPENAI_WHISPER_PROXY_URL || 'openai');
      }
      try {
        const transcript = await withRetry(
          async (): Promise<string> => {
            const form = new FormData();
            const transcriptUrl = OPENAI_WHISPER_PROXY_URL || 'https://api.openai.com/v1/audio/transcriptions';
            const headers: Record<string, string> = {};
            if (!OPENAI_WHISPER_PROXY_URL) headers.Authorization = `Bearer ${OPENAI_API_KEY}`;

            if (audioBlob && audioBlob.size > 0) {
              form.append('file', audioBlob, nativeUri ? 'recording.m4a' : 'recording.webm');
            } else if (Platform.OS !== 'web' && nativeUri) {
              try {
                const base64 = await FileSystem.readAsStringAsync(nativeUri, {
                  encoding: FileSystem.EncodingType.Base64,
                });
                const byteChars = atob(base64);
                const byteNumbers = new Array(byteChars.length);
                for (let i = 0; i < byteChars.length; i++) byteNumbers[i] = byteChars.charCodeAt(i);
                const blob = new Blob([new Uint8Array(byteNumbers)], { type: 'audio/m4a' });
                form.append('file', blob, 'recording.m4a');
              } catch (e) {
                (form as unknown as { append: (k: string, v: { uri: string; type: string; name: string }) => void }).append('file', {
                  uri: nativeUri,
                  type: 'audio/m4a',
                  name: 'recording.m4a',
                });
              }
            } else {
              throw new Error('No audio data');
            }
            form.append('model', 'whisper-1');
            const res = await fetch(transcriptUrl, { method: 'POST', headers, body: form });
            if (__DEV__) console.log('Transcription response status:', res.status);
            if (!res.ok) throw new Error(await res.text());
            const data = (await res.json()) as { text?: string };
            const text = (data.text ?? '').trim();
            if (__DEV__) console.log('Transcription result length:', text.length, '=== END DEBUG ===');
            if (text.length < 2) throw new Error('Empty transcription result');
            return text;
          },
          { retries: 2, baseDelay: 4000, context: 'transcription' }
        );
        if (nativeUri && Platform.OS !== 'web') {
          try {
            await FileSystem.deleteAsync(nativeUri, { idempotent: true });
          } catch {
            // non-critical
          }
        }
        return transcript;
      } catch (err) {
        if (__DEV__) console.error('Transcription failed:', err instanceof Error ? err.message : err);
        const retryMessages = Platform.OS === 'web'
          ? AIRA_ERROR_MESSAGES.recordingOrTranscriptionRetry
          : AIRA_ERROR_MESSAGES.recordingOrTranscriptionRetryNative;
        const msg = randomFrom(retryMessages);
        setMessages((prev) => [...prev, { role: 'assistant', content: msg }]);
        setVoiceState('speaking');
        await speakTextSafe(msg).catch(() => {});
        setVoiceState('idle');
        return null;
      }
    },
    [speakTextSafe]
  );

  const audioRecorder = useAudioRecorder({
    onRecordingComplete: async (blob, nativeUri) => {
      setVoiceState('processing');
      const userText = await transcribeSafe(blob, nativeUri);
      if (userText) processUserSpeech(userText);
    },
    onError: (err) => handleRecordingError(err),
  });

  const handleNativeOrWhisperMicPress = useCallback(() => {
    if (voiceState === 'speaking' || voiceState === 'processing') return;
    if (!useNativeOrWhisperRecording) return;
    if (audioRecorder.isRecording) {
      audioRecorder.stopRecording();
    } else {
      setVoiceState('recording');
      audioRecorder.startRecording();
    }
  }, [voiceState, useNativeOrWhisperRecording, audioRecorder.isRecording, audioRecorder.stopRecording, audioRecorder.startRecording]);

  const handleSendTyped = useCallback(() => {
    const text = typedAnswer.trim();
    if (!text) return;
    setTypedAnswer('');
    setMicWarning(null);
    stopElevenLabsSpeech(); // interrupt if interviewer is still speaking
    processUserSpeech(text);
  }, [typedAnswer, processUserSpeech]);

  const handlePressEnd = useCallback(async () => {
    if (voiceState !== 'listening') return;
    if (useNativeOrWhisperRecording) return; // native or web Whisper use hook
    if (Platform.OS === 'web' && recognitionRef.current) {
      recognitionRef.current.stop();
    } else {
      ExpoSpeechRecognitionModule.stop();
    }
    setVoiceState('processing');
    setTimeout(() => {
      const text = transcriptAtReleaseRef.current?.trim() ?? currentTranscript.trim();
      processUserSpeech(text);
    }, 400);
  }, [voiceState, currentTranscript, processUserSpeech, useNativeOrWhisperRecording, handleRecordingError, transcribeSafe]);

  const handleResume = useCallback(
    async (saved: NonNullable<Awaited<ReturnType<typeof loadInterviewFromStorage>>>) => {
      const restoredMessages = saved.messages ?? [];
      const completedSet = new Set(saved.scenariosCompleted ?? []);
      scoredScenariosRef.current = completedSet;
      const maxCompleted = completedSet.size > 0 ? Math.max(...completedSet) : 1;
      setHighestScenarioReached((prev) => Math.max(prev, maxCompleted));

      const scoreCards: { role: string; content: string; isScoreCard?: boolean }[] = (saved.scenariosCompleted ?? [])
        .slice()
        .sort((a, b) => a - b)
        .map((num) => {
          const s = saved.scenarioScores?.[num];
          if (!s) return null;
          const fake: ScenarioScoreResult = {
            scenarioNumber: num,
            scenarioName: s.scenarioName ?? `Scenario ${num}`,
            pillarScores: s.pillarScores ?? {},
            pillarConfidence: s.pillarConfidence ?? {},
            keyEvidence: s.keyEvidence ?? {},
            specificity: 'high',
            repairCoherenceIssue: null,
          };
          return { role: 'system', content: formatScoreMessage(fake), isScoreCard: true } as { role: string; content: string; isScoreCard?: boolean };
        })
        .filter((x): x is { role: string; content: string; isScoreCard?: boolean } => x != null);
      const fullMessages = [...restoredMessages, ...scoreCards];
      setMessages(fullMessages);

      const scenarioScoresRestored: Record<number, ScenarioScoreResult> = {};
      Object.entries(saved.scenarioScores ?? {}).forEach(([numStr, s]) => {
        if (!s) return;
        const num = parseInt(numStr, 10);
        scenarioScoresRestored[num] = {
          scenarioNumber: num,
          scenarioName: s.scenarioName ?? `Scenario ${num}`,
          pillarScores: s.pillarScores ?? {},
          pillarConfidence: s.pillarConfidence ?? {},
          keyEvidence: s.keyEvidence ?? {},
          specificity: 'high',
          repairCoherenceIssue: null,
        };
      });
      setScenarioScores(scenarioScoresRestored);

      setStageResults(
        Object.entries(saved.scenarioScores ?? {})
          .filter(([, v]) => v != null)
          .map(([num, s]) => ({
            stage: parseInt(num, 10),
            results: {
              pillarScores: s!.pillarScores ?? {},
              keyEvidence: s!.keyEvidence ?? {},
              pillarConfidence: s!.pillarConfidence ?? {},
              narrativeCoherence: 'moderate' as const,
              behavioralSpecificity: 'moderate' as const,
              notableInconsistencies: [],
              interviewSummary: '',
            } as InterviewResults,
          }))
      );

      const allDetected = restoredMessages
        .filter((m) => m.role === 'assistant')
        .flatMap((m) => detectConstructs(m.content));
      setTouchedConstructs([...new Set(allDetected)]);

      const lastMessage = extractLastInterviewerMessage(restoredMessages);
      const welcomeBack = lastMessage
        ? `Welcome back. Let's pick up where we left off. When we left off, I said — ${lastMessage}`
        : "Welcome back. Let's pick up where we left off.";
      const welcomeMsg = { role: 'assistant', content: welcomeBack, isWelcomeBack: true };
      setMessages([...fullMessages, welcomeMsg]);
      setTimeout(() => speakTextSafe(welcomeBack), 500);

      setStatus('active');
    },
    [speak]
  );

  useEffect(() => {
    if (!userId || isAdmin) return;
    if (hasResumedRef.current) return;
    let cancelled = false;
    (async () => {
      const saved = await loadInterviewFromStorage(userId);
      if (cancelled) return;
      if (!saved?.messages?.length) return;
      // Don't resume from greeting-only state (avoids infinite resume loop)
      if (isGreetingOnly(saved.messages)) {
        await clearInterviewFromStorage(userId);
        return;
      }
      const hasScenarioProgress =
        (saved.currentScenario ?? 0) >= 1 &&
        (saved.messages?.filter((m) => m.role === 'user').length ?? 0) >= 2;
      const hasCompletedScenario = (saved.scenariosCompleted?.length ?? 0) > 0;
      if (hasScenarioProgress || hasCompletedScenario) {
        const completedCount = saved.scenariosCompleted?.length ?? 0;
        if (completedCount < 3) {
          hasResumedRef.current = true;
          handleResume(saved);
        } else {
          await clearInterviewFromStorage(userId);
        }
      } else {
        await clearInterviewFromStorage(userId);
      }
    })();
    return () => { cancelled = true; };
  }, [userId, isAdmin, handleResume]);

  const startInterview = useCallback(async () => {
    if (isAdmin) await clearInterviewFromStorage(userId);
    // Clear any stale storage from a completed interview before starting fresh
    const saved = await loadInterviewFromStorage(userId);
    if (saved && (saved.scenariosCompleted?.length ?? 0) >= 3) {
      await clearInterviewFromStorage(userId);
    }
    if (Platform.OS === 'web') {
      await requestMicPermissionForPWA();
    } else if (useNativeOrWhisperRecording) {
      const granted = await audioRecorder.requestPermission();
      setMicPermission(granted ? 'granted' : 'denied');
    }
    setStatus('active');
    setInterviewStatus('in_progress');
    setVoiceState('processing');
    if (!ANTHROPIC_API_KEY && !ANTHROPIC_PROXY_URL) {
      const welcomeFallback = "Welcome. I'll be with you in just a moment.";
      setMessages([{ role: 'assistant', content: welcomeFallback }]);
      setVoiceState('idle');
      await speakTextSafe(welcomeFallback).catch(() => {});
      return;
    }
    const openingLine = "Hi, I'm Aira, welcome to Amoraea, what can I call you?";
    setMessages([{ role: 'assistant', content: openingLine }]);
    await speakTextSafe(openingLine);
  }, [speakTextSafe, isAdmin, userId, useNativeOrWhisperRecording, audioRecorder]);

  const saveInterviewResults = useCallback(
    async (results: InterviewResults, gateResult: GateResult, uid: string) => {
      if (!uid) return;
      try {
        const { error } = await supabase
          .from('users')
          .update({
            interview_completed: true,
            interview_passed: gateResult.pass,
            interview_weighted_score: gateResult.weightedScore,
            interview_pillar_scores: results.pillarScores ?? null,
            interview_completed_at: new Date().toISOString(),
          })
          .eq('id', uid);
        if (error) console.error('Failed to save interview results:', error);
        else await clearInterviewFromStorage(uid);
      } catch (err) {
        console.error('Interview save error:', err);
      }
    },
    []
  );

  const scoreInterview = useCallback(async (finalMessages: { role: string; content: string }[]) => {
    if (__DEV__) {
      console.log('=== [2] Entering completion handler ===');
      console.log('interviewStatus:', interviewStatusRef.current);
    }
    const isOnboarding = route.name === 'OnboardingInterview';
    setStatus('scoring');
    const context = typologyContext || 'No typology context — score from transcript only.';
    if (!ANTHROPIC_API_KEY && !ANTHROPIC_PROXY_URL) {
      const fallbackResults: InterviewResults = {
        pillarScores: { '1': 6, '3': 7, '4': 6, '5': 7, '6': 5, '9': 6 },
        keyEvidence: {},
        narrativeCoherence: 'moderate',
        behavioralSpecificity: 'moderate',
        notableInconsistencies: [],
        interviewSummary: 'Interview completed. Scoring was unavailable.',
        gateResult: computeGateResult({ '1': 6, '3': 7, '5': 7, '6': 5 }),
      };
      setResults(fallbackResults);
      if (isOnboarding) {
        const gate1Score = buildGate1ScoreFromResults(fallbackResults);
        await profileRepository.upsertProfile(userId, {
          gate1Score,
          applicationStatus: gate1Score.passed ? 'approved' : 'under_review',
          ...(gate1Score.passed ? { onboardingStage: 'basic_info' as const } : {}),
        });
        queryClient.invalidateQueries({ queryKey: ['profile', userId] });
      }
      await saveInterviewResults(fallbackResults, fallbackResults.gateResult!, userId);
      setInterviewStatus('under_review');
      setStatus('results');
      return;
    }
    const apiUrl = getAnthropicEndpoint();
    const useProxy = apiUrl !== 'https://api.anthropic.com/v1/messages';
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (useProxy && SUPABASE_ANON_KEY) {
      headers['Authorization'] = `Bearer ${SUPABASE_ANON_KEY}`;
    } else if (!useProxy) {
      headers['x-api-key'] = ANTHROPIC_API_KEY;
      headers['anthropic-version'] = '2023-06-01';
    }
    try {
      const fetchScoringOnce = async (): Promise<InterviewResults> => {
        const res = await fetch(apiUrl, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 1500,
            messages: [{ role: 'user', content: buildScoringPrompt(finalMessages, context) }],
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          const e = new Error((data as { error?: { message?: string } })?.error?.message ?? `HTTP ${res.status}`);
          (e as Error & { status?: number }).status = res.status;
          throw e;
        }
        const raw = (data.content?.[0]?.text ?? '{}').replace(/```json|```/g, '').trim();
        return JSON.parse(raw) as InterviewResults;
      };
      const parsed = await withRetry(fetchScoringOnce, {
        retries: 3,
        baseDelay: 12000,
        maxDelay: 45000,
        context: 'scoring',
      });
      const gateResult = computeGateResult(parsed.pillarScores ?? {}, parsed.skepticismModifier ?? null);
      parsed.gateResult = gateResult;
      setResults(parsed);
      if (__DEV__) {
        console.log('=== Scoring API complete ===', 'passed:', gateResult?.pass);
      }
      if (isOnboarding) {
        const gate1Score = buildGate1ScoreFromResults(parsed);
        await profileRepository.upsertProfile(userId, {
          gate1Score,
          applicationStatus: gate1Score.passed ? 'approved' : 'under_review',
          ...(gate1Score.passed ? { onboardingStage: 'basic_info' as const } : {}),
        });
        queryClient.invalidateQueries({ queryKey: ['profile', userId] });
      }
      if (ALPHA_MODE && userId) {
        let alphaSaveOk = false;
        let insertPayload: Record<string, unknown> | null = null;
        let updatePayload: Record<string, unknown> | null = null;
        let attemptNum = 1;
        try {
          await ensureValidSession();
          const s1 = scenarioScoresRef.current[1]?.pillarScores;
          const s2 = scenarioScoresRef.current[2]?.pillarScores;
          const s3 = scenarioScoresRef.current[3]?.pillarScores;
          const scoreConsistency = calculateScoreConsistency(s1, s2, s3);
          const pillarScores = parsed.pillarScores ?? {};
          const constructAsymmetry = calculateConstructAsymmetry(pillarScores);
          const scenarioBoundaries = buildScenarioBoundaries(
            finalMessages,
            Array.from(scoredScenariosRef.current)
          );
          const languageMarkers = analyzeLanguageMarkers(finalMessages, scenarioBoundaries);
          setReasoningProgress('generating');
          if (__DEV__) console.log('=== [3] Generating reasoning ===');
          const slowTimer = setTimeout(() => setReasoningProgress('slow'), 10000);
          const verySlowTimer = setTimeout(() => setReasoningProgress('very_slow'), 30000);
          const reasoning = await generateAIReasoningSafe(
            pillarScores,
            {
              1: scenarioScoresRef.current[1],
              2: scenarioScoresRef.current[2],
              3: scenarioScoresRef.current[3],
            },
            finalMessages,
            gateResult.weightedScore,
            gateResult.pass,
            {
              onRetry: (attempt) => {
                if (attempt === 1) setReasoningProgress('slow');
                if (attempt >= 2) setReasoningProgress('very_slow');
              },
              onUnrecoverable: () => setReasoningProgress('failed'),
            }
          );
          setReasoningProgress(reasoning._generationFailed ? 'failed' : 'done');
          clearTimeout(slowTimer);
          clearTimeout(verySlowTimer);
          if (__DEV__) console.log('=== [4] Reasoning complete ===');
          const { data: userRow } = await supabase
            .from('users')
            .select('interview_attempt_count')
            .eq('id', userId)
            .single();
          attemptNum = (userRow?.interview_attempt_count ?? 0) || 1;
          insertPayload = {
            user_id: userId,
            attempt_number: attemptNum,
            completed_at: new Date().toISOString(),
            weighted_score: gateResult.weightedScore,
            passed: gateResult.pass,
            pillar_scores: pillarScores,
            scenario_1_scores: scenarioScoresRef.current[1]
              ? {
                  pillarScores: scenarioScoresRef.current[1].pillarScores,
                  pillarConfidence: scenarioScoresRef.current[1].pillarConfidence,
                  keyEvidence: scenarioScoresRef.current[1].keyEvidence,
                  scenarioName: scenarioScoresRef.current[1].scenarioName,
                }
              : null,
            scenario_2_scores: scenarioScoresRef.current[2]
              ? {
                  pillarScores: scenarioScoresRef.current[2].pillarScores,
                  pillarConfidence: scenarioScoresRef.current[2].pillarConfidence,
                  keyEvidence: scenarioScoresRef.current[2].keyEvidence,
                  scenarioName: scenarioScoresRef.current[2].scenarioName,
                }
              : null,
            scenario_3_scores: scenarioScoresRef.current[3]
              ? {
                  pillarScores: scenarioScoresRef.current[3].pillarScores,
                  pillarConfidence: scenarioScoresRef.current[3].pillarConfidence,
                  keyEvidence: scenarioScoresRef.current[3].keyEvidence,
                  scenarioName: scenarioScoresRef.current[3].scenarioName,
                }
              : null,
            transcript: finalMessages,
            response_timings: responseTimingsRef.current,
            probe_log: probeLogRef.current,
            switch_log: switchLog,
            score_consistency: scoreConsistency,
            construct_asymmetry: constructAsymmetry,
            language_markers: languageMarkers,
            ai_reasoning: reasoning,
          };
          updatePayload = {
            interview_completed: true,
            interview_passed: gateResult.pass,
            interview_weighted_score: gateResult.weightedScore,
            interview_completed_at: new Date().toISOString(),
            interview_attempt_count: attemptNum,
            latest_attempt_id: null as string | null,
          };
          const { data: insertData } = await withRetry(
            async () => {
              const result = await supabase.from('interview_attempts').insert(insertPayload).select('id').single();
              if (result.error) throw new Error(result.error.message);
              return result;
            },
            { retries: 3, baseDelay: 3000, maxDelay: 15000, context: 'database interview_attempts insert' }
          );
          (updatePayload as Record<string, unknown>).latest_attempt_id = insertData?.id ?? null;
          await withRetry(
            async () => {
              const { error } = await supabase.from('users').update(updatePayload).eq('id', userId);
              if (error) throw new Error(error.message);
            },
            { retries: 3, baseDelay: 3000, maxDelay: 15000, context: 'database users update' }
          );
          await clearInterviewFromStorage(userId);
          const attemptId = insertData?.id ?? null;
          if (__DEV__) {
            console.log('=== [5] DB save ===', { id: attemptId ?? undefined, error: null });
          }
          setAnalysisAttemptId(attemptId);
          if (__DEV__) console.log('=== [6] latestAttemptId set ===', attemptId ?? 'null');
          alphaSaveOk = true;
        } catch (err) {
          if (__DEV__) {
            console.error('=== [4] Alpha save failed ===', err);
          }
          setAnalysisAttemptId(null);
          const saved = await loadInterviewFromStorage(userId);
          if (saved && insertPayload != null && updatePayload != null) {
            await saveInterviewProgress(userId, {
              ...saved,
              pendingDatabaseSave: true,
              saveFailedAt: new Date().toISOString(),
              pendingAttemptPayload: { insert: insertPayload, update: { ...updatePayload, latest_attempt_id: null }, attemptNum },
            });
          }
          await saveInterviewResults(parsed, gateResult, userId);
        } finally {
          if (ALPHA_MODE) {
            if (__DEV__) console.log('=== [7] Navigating to analysis ===');
            await new Promise((resolve) => setTimeout(resolve, 100));
            setInterviewStatus('analysis');
            if (__DEV__) console.log('=== [8] Navigation complete ===');
          }
        }
        if (!alphaSaveOk) {
          setStatus('results');
          return;
        }
      } else {
        await saveInterviewResults(parsed, gateResult, userId);
        setInterviewStatus('under_review');
      }
      setStatus('results');
    } catch (err) {
      if (__DEV__) console.error('=== COMPLETION ERROR ===', err);
      const fallbackResults: InterviewResults = {
        pillarScores: { '1': 6, '3': 7, '4': 6, '5': 7, '6': 5, '9': 6 },
        keyEvidence: {},
        narrativeCoherence: 'moderate',
        behavioralSpecificity: 'moderate',
        notableInconsistencies: [],
        interviewSummary: 'A grounded spoken profile. See individual construct scores for detail.',
        gateResult: computeGateResult({ '1': 6, '3': 7, '5': 7, '6': 5 }),
      };
      setResults(fallbackResults);
      if (isOnboarding) {
        const gate1Score = buildGate1ScoreFromResults(fallbackResults);
        await profileRepository.upsertProfile(userId, {
          gate1Score,
          applicationStatus: gate1Score.passed ? 'approved' : 'under_review',
          ...(gate1Score.passed ? { onboardingStage: 'basic_info' as const } : {}),
        });
        queryClient.invalidateQueries({ queryKey: ['profile', userId] });
      }
      await saveInterviewResults(fallbackResults, fallbackResults.gateResult!, userId);
      setInterviewStatus('under_review');
      setStatus('results');
    }
  }, [typologyContext, route.name, userId, navigation, queryClient, saveInterviewResults, ensureValidSession]);

  const handleRetake = useCallback(async () => {
    if (!userId) return;
    const { data: userData } = await supabase
      .from('users')
      .select('interview_attempt_count')
      .eq('id', userId)
      .single();
    const nextAttemptNumber = (userData?.interview_attempt_count ?? 0) + 1;
    await supabase
      .from('users')
      .update({
        interview_completed: false,
        interview_passed: null,
        interview_weighted_score: null,
        interview_completed_at: null,
        interview_last_checkpoint: 0,
        interview_attempt_count: nextAttemptNumber,
        latest_attempt_id: null,
      })
      .eq('id', userId);
    await clearInterviewFromStorage(userId);
    setMessages([]);
    setScenarioScores({});
    scoredScenariosRef.current = new Set();
    setClosingQuestionState({ 1: 'needed', 2: 'needed', 3: 'needed' });
    closingQuestionAskedRef.current = { 1: false, 2: false, 3: false };
    closingQuestionAnsweredRef.current = { 1: false, 2: false, 3: false };
    lastClosingQuestionScenarioRef.current = null;
    waitingForClosingAdditionRef.current = null;
    lastAnsweredClosingScenarioRef.current = null;
    stage3PersonalQuestionAskedRef.current = false;
    stage3ModeRef.current = null;
    setStatus('intro');
    setResults(null);
    responseTimingsRef.current = [];
    probeLogRef.current = [];
    setAnalysisAttemptId(null);
    setInterviewStatus('not_started');
  }, [userId]);

  // ── RENDER ──
  if (sessionExpired) {
    return (
      <View style={styles.sessionExpiredOverlay}>
        <Text style={styles.sessionExpiredTitle}>Your session timed out.</Text>
        <Text style={styles.sessionExpiredBody}>
          Your progress has been saved. Sign back in and your interview will continue from where you left off.
        </Text>
        <Pressable
          onPress={async () => {
            const { error } = await supabase.auth.refreshSession();
            if (!error) setSessionExpired(false);
            else {
              await supabase.auth.signOut();
              navigation.replace('Login');
            }
          }}
          style={styles.sessionExpiredButton}
        >
          <Text style={styles.sessionExpiredButtonLabel}>Continue →</Text>
        </Pressable>
      </View>
    );
  }
  if (interviewStatus === 'loading') {
    return (
      <SafeAreaContainer>
        <View style={[styles.container, { minHeight: '100%', justifyContent: 'center', alignItems: 'center', padding: 24 }]}>
          <Text style={[styles.introNote, { letterSpacing: 2, textTransform: 'uppercase' }]}>Loading...</Text>
          <Text style={[styles.introHint, { marginTop: 16, textAlign: 'center' }]}>
            If this doesn't change, try refreshing the page.
          </Text>
        </View>
      </SafeAreaContainer>
    );
  }
  // Admin always goes to admin panel — never show interview complete / under_review / analysis (use auth user so it works on first render)
  if (ALPHA_MODE && (isAdmin || isAdminUser) && shouldShowAdminPanel) {
    return (
      <AdminInterviewDashboard
        onClose={() => {
          setShowAdminPanel(false);
          if (interviewStatus === 'analysis' || interviewStatus === 'under_review' || interviewStatus === 'congratulations') {
            setInterviewStatus('not_started');
          }
        }}
      />
    );
  }
  if (ALPHA_MODE && interviewStatus === 'analysis') {
    return (
      <InterviewAnalysisScreen
        attemptId={analysisAttemptId}
        onRetake={handleRetake}
      />
    );
  }
  if (interviewStatus === 'under_review') {
    return (
      <SafeAreaContainer>
        <View style={[styles.container, { minHeight: '100%', justifyContent: 'center', alignItems: 'center', padding: 24 }]}>
          <Text style={[styles.introNote, { color: colors.warning, letterSpacing: 3, textTransform: 'uppercase', marginBottom: 16 }]}>◆ Application received</Text>
          <Text style={[styles.introTitle, { marginBottom: 16 }]}>Your application is being reviewed.</Text>
          <Text style={[styles.introHint, { maxWidth: 480, textAlign: 'center' }]}>
            This usually takes up to 24 hours. We'll be in touch when your review is complete.
          </Text>
          {ALPHA_MODE && isAdmin && (
            <Pressable
              onPress={handleRetake}
              style={({ pressed }) => [
                styles.retakeButtonUnderReview,
                { opacity: pressed ? 0.8 : 1 },
              ]}
            >
              <Text style={styles.retakeButtonUnderReviewText}>Start over (admin)</Text>
            </Pressable>
          )}
        </View>
      </SafeAreaContainer>
    );
  }
  if (interviewStatus === 'congratulations') {
    return (
      <SafeAreaContainer>
        <View style={[styles.container, { minHeight: '100%', justifyContent: 'center', alignItems: 'center', padding: 24 }]}>
          <Text style={{ fontSize: 32, color: colors.success, marginBottom: 16 }}>✓</Text>
          <Text style={[styles.introTitle, { marginBottom: 16 }]}>You're on the waitlist.</Text>
          <Text style={[styles.introHint, { maxWidth: 480, textAlign: 'center' }]}>
            Congratulations — your application has been approved. We'll let you know when Amoraea is ready for you.
          </Text>
        </View>
      </SafeAreaContainer>
    );
  }

  if (status === 'intro') {
    return (
      <SafeAreaContainer>
        {ALPHA_MODE && isAdmin && (
          <TouchableOpacity
            style={styles.adminPanelButton}
            onPress={() => setShowAdminPanel(true)}
            activeOpacity={0.8}
          >
            <Text style={styles.adminPanelButtonText}>◆ Panel</Text>
          </TouchableOpacity>
        )}
        <ScrollView style={styles.container} contentContainerStyle={styles.introContent}>
          <View style={styles.ariaBadge}>
            <Ionicons name="mic" size={40} color={colors.primary} />
            <Text style={styles.ariaName}>Voice Interview</Text>
            <Text style={styles.ariaTagline}>Your Story</Text>
          </View>
          <Text style={styles.introTitle}>A real conversation, not a form.</Text>
          <Text style={styles.introHint}>
            You'll speak with an AI interviewer about how you show up in relationships. Hold the button to talk — release when you're done. About 15 minutes.
          </Text>
          <Text style={styles.introNote}>Small examples are fine — nothing needs to be dramatic.</Text>
          {micError ? (
            <View style={styles.micErrorBlock}>
              <Text style={styles.micErrorText}>{micError}</Text>
            </View>
          ) : null}
          {micWarning ? (
            <View style={styles.micWarningBlock}>
              <Text style={styles.micWarningText}>{micWarning}</Text>
            </View>
          ) : null}
          <Button
            title="Begin Voice Interview"
            onPress={startInterview}
            disabled={!!micError}
            style={styles.introButton}
          />
        </ScrollView>
      </SafeAreaContainer>
    );
  }

  // Active interview — chat always visible; scoring and results as inline panels below
  const inputDisabled = status === 'scoring' || status === 'results';
  const PILLAR_META: Record<string, { name: string; color: string }> = {
    '1': { name: 'Conflict & Repair', color: colors.error },
    '3': { name: 'Accountability', color: colors.success },
    '4': { name: 'Reliability', color: colors.primary },
    '5': { name: 'Responsiveness', color: '#0D6B6B' },
    '6': { name: 'Desire & Boundaries', color: '#8B3A5C' },
    '9': { name: 'Stress Resilience', color: '#2A5C5C' },
  };

  const isInterviewerView = status === 'active' && !isAdmin;
  return (
    <SafeAreaContainer style={{ backgroundColor: '#05060D' }}>
      {ALPHA_MODE && isAdmin && (
        <TouchableOpacity
          style={styles.adminPanelButton}
          onPress={() => setShowAdminPanel(true)}
          activeOpacity={0.8}
        >
          <Text style={styles.adminPanelButtonText}>◆ Panel</Text>
        </TouchableOpacity>
      )}
      <View style={[styles.activeContainer, isAdmin ? styles.adminActiveContainer : undefined]}>
        {isInterviewerView ? (
          <View style={{ flex: 1, backgroundColor: '#05060D' }}>
            <UserInterviewLayout
              flameState={useNativeOrWhisperRecording && audioRecorder.isRecording ? 'recording' : voiceState}
              activeScenario={activeScenario}
              interviewerText={currentInterviewerText}
              interviewerLineIsError={interviewerLineIsError}
              ttsFallbackActive={tTSFallbackActive}
              micPermissionDenied={micPermission === 'denied'}
              isWaiting={isWaiting}
              onPressStart={handlePressStart}
              onPressEnd={handlePressEnd}
              voiceState={useNativeOrWhisperRecording && audioRecorder.isRecording ? 'recording' : voiceState}
              micError={micError}
              micWarning={micWarning}
              inputDisabled={inputDisabled}
              micToggleMode={useNativeOrWhisperRecording}
              onMicPress={useNativeOrWhisperRecording ? handleNativeOrWhisperMicPress : undefined}
              micLabelOverride={useNativeOrWhisperRecording ? (audioRecorder.isRecording ? 'Tap to stop' : 'Tap to speak') : undefined}
              onExit={() => {
                const confirmMessage = 'Are you sure you want to log out?';
                if (Platform.OS === 'web' && typeof window !== 'undefined') {
                  if (window.confirm(confirmMessage)) signOut();
                } else {
                  Alert.alert('Log out', confirmMessage, [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Log out', style: 'destructive', onPress: () => signOut() },
                  ]);
                }
              }}
            />
          </View>
        ) : (
          <View style={styles.adminWrap}>
        {isAdmin && (status === 'results' && results?.pillarScores ? (
          <View style={[styles.stageScoresContainer, styles.adminStageScoresContainer]}>
            <Text style={[styles.stageScoresTitle, styles.adminStageScoresTitle]}>Final scores</Text>
            <View style={[styles.stageScoreCard, styles.adminStageScoreCard]}>
              <View style={styles.stageScorePillars}>
                {Object.entries(results.pillarScores).map(([id, score]) => {
                  const meta = PILLAR_META[id] ?? { name: `Pillar ${id}`, color: colors.primary };
                  return (
                    <Text key={id} style={[styles.stageScorePillar, styles.adminStageScorePillar]}>
                      {meta.name}: {score}
                    </Text>
                  );
                })}
              </View>
            </View>
          </View>
        ) : stageResults.length > 0 ? (
          <View style={[styles.stageScoresContainer, styles.adminStageScoresContainer]}>
            <Text style={[styles.stageScoresTitle, styles.adminStageScoresTitle]}>Scores so far</Text>
            {stageResults.map(({ stage, results: sr }) => (
              <View key={stage} style={[styles.stageScoreCard, styles.adminStageScoreCard]}>
                <Text style={[styles.stageScoreLabel, styles.adminStageScoreLabel]}>Stage {stage}</Text>
                <View style={styles.stageScorePillars}>
                  {sr.pillarScores && Object.entries(sr.pillarScores).map(([id, score]) => {
                    const c = CONSTRUCTS.find((x) => String(x.id) === id);
                    return (
                      <Text key={id} style={[styles.stageScorePillar, styles.adminStageScorePillar]}>
                        {c?.label ?? `P${id}`}: {score}
                      </Text>
                    );
                  })}
                </View>
              </View>
            ))}
          </View>
        ) : null)}
        <ScrollView
          ref={scrollViewRef}
          style={[styles.transcriptScroll, styles.adminTranscriptScroll]}
          contentContainerStyle={[styles.transcriptContent, styles.adminTranscriptContent]}
          keyboardShouldPersistTaps="handled"
        >
          {messages.map((msg, i) => {
            const isScoreCard = (msg as { isScoreCard?: boolean }).isScoreCard;
            const isError = (msg as { isError?: boolean }).isError === true;
            if (isScoreCard && !isAdmin) return null;
            if (msg.role === 'user' && !isAdmin) return null;
            const displayContent = typeof msg.content === 'string'
              ? stripControlTokens(msg.content)
              : msg.content;
            if (isScoreCard) {
              return (
                <View key={i} style={[styles.scoreCard, styles.adminScoreCard]}>
                  <Text style={[styles.scoreCardContent, styles.adminScoreCardContent]}>{msg.content}</Text>
                </View>
              );
            }
            if (isError) {
              return (
                <View key={(msg as { id?: string }).id ?? i} style={[styles.msgRow, styles.msgRowError]}>
                  <Text style={[styles.msgContent, styles.msgContentError]}>{displayContent}</Text>
                </View>
              );
            }
            const isWaiting = (msg as { isWaiting?: boolean }).isWaiting;
            return (
              <View key={(msg as { id?: string }).id ?? i} style={[styles.msgRow, msg.role === 'user' && styles.msgRowUser]}>
                <Text style={[styles.msgRole, styles.adminMsgRole]}>{msg.role === 'assistant' ? '◆ Interviewer' : 'You'}</Text>
                <Text style={[styles.msgContent, isWaiting && styles.msgContentWaiting, msg.role === 'assistant' ? styles.adminMsgContentInterviewer : styles.adminMsgContentUser]}>{displayContent}</Text>
              </View>
            );
          })}
          {isAdmin && isWaiting && (
            <View style={[styles.msgRowWaiting, styles.adminMsgRowWaiting]}>
              <Text style={[styles.msgRole, styles.adminMsgRole]}>◆ Interviewer</Text>
              <Text style={[styles.msgContentWaiting, styles.adminMsgContentWaiting]}>Aira is thinking...</Text>
            </View>
          )}
          {currentTranscript && voiceState === 'listening' && (
            <View style={styles.msgRow}>
              <Text style={[styles.msgRole, { color: colors.error }]}>● You (speaking…)</Text>
              <Text style={[styles.msgContent, { fontStyle: 'italic' }]}>{currentTranscript}</Text>
            </View>
          )}
        </ScrollView>

        {status === 'scoring' && (
          <View style={styles.scoringIndicator}>
            <Text style={styles.scoringIndicatorDot}>◆</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.scoringIndicatorText}>
                {reasoningProgress === 'slow'
                  ? 'This is taking a moment...'
                  : reasoningProgress === 'very_slow'
                    ? 'Almost there...'
                    : reasoningProgress === 'failed'
                      ? 'Something went wrong.'
                      : 'Preparing your analysis...'}
              </Text>
              {(reasoningProgress === 'slow' || reasoningProgress === 'very_slow') && (
                <Text style={styles.scoringIndicatorSub}>
                  {reasoningProgress === 'very_slow'
                    ? 'Detailed analyses take a little longer.'
                    : 'Your transcript is being read carefully.'}
                </Text>
              )}
              {reasoningProgress === 'failed' && (
                <>
                  <Text style={styles.scoringIndicatorSub}>
                    Your scores have been saved. The detailed analysis may not be available.
                  </Text>
                  <Pressable
                    onPress={() => setStatus('results')}
                    style={styles.scoringViewScoresButton}
                  >
                    <Text style={styles.scoringViewScoresButtonLabel}>View Scores →</Text>
                  </Pressable>
                </>
              )}
            </View>
          </View>
        )}

        {status === 'results' && results && (
          <ScrollView key="final-results" style={[styles.resultsPanel, styles.resultsPanelHighlight]} contentContainerStyle={styles.resultsPanelContent}>
            <Text style={styles.resultsPanelTitle}>✦ Interview complete</Text>
            {!isAdmin ? (
              <>
                <Text style={styles.resultsPanelSummary}>
                  Thank you for completing your interview. Your application is now being reviewed — this usually takes up to 24 hours.
                </Text>
                <Button
                  title="Continue"
                  onPress={() => {
                    setInterviewStatus('under_review');
                  }}
                  style={styles.resultsPanelButton}
                />
              </>
            ) : (
              <>
                {results.gateResult ? (
                  <View style={[
                    styles.gateResultBlock,
                    { backgroundColor: results.gateResult.pass ? '#F0F7F0' : '#FDF0F0', borderColor: results.gateResult.pass ? colors.success : colors.error },
                  ]}>
                    <Text style={[styles.gateResultLabel, { color: results.gateResult.pass ? colors.success : colors.error }]}>
                      {results.gateResult.pass ? '✓ Interview passed' : '✗ Interview not passed'}
                    </Text>
                    <Text style={styles.gateResultText}>
                      {results.gateResult.pass
                        ? `Weighted score: ${results.gateResult.weightedScore}/10 — meets the threshold for profile creation.`
                        : results.gateResult.reason === 'floor'
                          ? `${results.gateResult.failingConstruct} scored ${results.gateResult.failingScore}/10 — below the minimum required score.`
                          : `Weighted score: ${results.gateResult.weightedScore}/10 — below the threshold of 5.0 required for profile creation.`}
                    </Text>
                  </View>
                ) : null}
                {results.interviewSummary ? (
                  <Text style={styles.resultsPanelSummary}>{results.interviewSummary}</Text>
                ) : null}
                <View style={styles.resultsPanelPillars}>
                  {(['1', '3', '4', '5', '6', '9'] as const).map((id) => {
                    const score = results.pillarScores?.[id];
                    if (score == null) return null;
                    const meta = PILLAR_META[id] ?? { name: `Pillar ${id}`, color: colors.primary };
                    return (
                      <View key={id} style={styles.resultsPillarRow}>
                        <View style={styles.resultsPillarHeader}>
                          <Text style={styles.resultsPillarName}>{meta.name}</Text>
                          <Text style={[styles.resultsPillarScore, { color: meta.color }]}>{score}/10</Text>
                        </View>
                        <View style={styles.resultsPillarBar}>
                          <View
                            style={[
                              styles.resultsPillarBarFill,
                              { width: `${score * 10}%`, backgroundColor: meta.color },
                            ]}
                          />
                        </View>
                      </View>
                    );
                  })}
                </View>
                <Button
                  title="Continue →"
                  onPress={() => {
                    const onComplete = (route.params as { onComplete?: (r: InterviewResults) => void })?.onComplete;
                    if (onComplete) onComplete({ ...results, gateResult: results?.gateResult });
                    else navigation.navigate('Home');
                  }}
                  style={styles.resultsPanelButton}
                />
              </>
            )}
          </ScrollView>
        )}

        {status === 'active' && (
          <View style={[styles.voiceDock, isAdmin && styles.adminVoiceDock]}>
            {micError ? <Text style={[styles.dockError, isAdmin && styles.adminDockText]}>{micError}</Text> : null}
            {micWarning && !micError ? <Text style={[styles.dockWarning, isAdmin && styles.adminDockText]}>{micWarning}</Text> : null}
            <Pressable
              onPressIn={handlePressStart}
              onPressOut={handlePressEnd}
              disabled={!!micError || voiceState === 'speaking' || voiceState === 'processing'}
              style={[
                styles.micOrb,
                voiceState === 'listening' && styles.micOrbListening,
                voiceState === 'processing' && styles.micOrbProcessing,
                voiceState === 'speaking' && styles.micOrbSpeaking,
              ]}
            >
              {voiceState === 'listening' ? (
                <Ionicons name="mic" size={36} color="#fff" />
              ) : voiceState === 'processing' ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : voiceState === 'speaking' ? (
                <Ionicons name="volume-high" size={28} color="#fff" />
              ) : (
                <Ionicons name="mic" size={36} color="#fff" />
              )}
            </Pressable>
            <Text style={[styles.voiceLabel, isAdmin && styles.adminVoiceLabel]}>
              {voiceState === 'listening' && 'Release to send'}
              {voiceState === 'processing' && 'Thinking…'}
              {voiceState === 'speaking' && 'Interviewer speaking'}
              {voiceState === 'idle' && 'Hold to speak'}
            </Text>
            {isAdmin && (
              <View style={styles.typeFallback}>
                <Text style={[styles.typeFallbackLabel, styles.adminTypeFallbackLabel]}>Or type your answer (you can type while the interviewer is speaking)</Text>
                <TextInput
                  style={[styles.typeFallbackInput, styles.adminTypeFallbackInput]}
                  placeholder="Type here…"
                  placeholderTextColor="#7A9ABE"
                  value={typedAnswer}
                  onChangeText={setTypedAnswer}
                  editable={!inputDisabled && voiceState !== 'processing'}
                  multiline
                  maxLength={2000}
                  onKeyPress={(e) => {
                    const key = (e.nativeEvent?.key ?? (e as { key?: string }).key) ?? '';
                    const shiftKey = (e.nativeEvent as { shiftKey?: boolean } | undefined)?.shiftKey ?? (e as { shiftKey?: boolean }).shiftKey ?? false;
                    if (key === 'Enter' && !shiftKey) {
                      (e as { preventDefault?: () => void }).preventDefault?.();
                      if (typedAnswer.trim() && !inputDisabled && voiceState !== 'processing') {
                        handleSendTyped();
                      }
                    }
                  }}
                />
                <Button
                  title="Send"
                  onPress={handleSendTyped}
                  disabled={inputDisabled || !typedAnswer.trim() || voiceState === 'processing'}
                  variant="outline"
                  style={styles.typeFallbackButton}
                />
              </View>
            )}
          </View>
        )}
          </View>
        )}
      </View>
      {usingMemoryFallback ? (
        <View style={styles.memoryFallbackBanner} pointerEvents="none">
          <Text style={styles.memoryFallbackBannerText}>⚠ Low storage — progress saved to server only</Text>
        </View>
      ) : null}
    </SafeAreaContainer>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  sessionExpiredOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 9999,
    backgroundColor: 'rgba(5,6,13,0.96)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  sessionExpiredTitle: {
    fontFamily: Platform.OS === 'web' ? "'Cormorant Garamond', serif" : undefined,
    fontSize: 24,
    fontWeight: '300',
    color: '#C8E4FF',
    marginBottom: 14,
    textAlign: 'center',
  },
  sessionExpiredBody: {
    fontFamily: Platform.OS === 'web' ? "'Jost', sans-serif" : undefined,
    fontSize: 14,
    fontWeight: '300',
    color: '#7A9ABE',
    lineHeight: 24,
    maxWidth: 320,
    marginBottom: 32,
    textAlign: 'center',
  },
  sessionExpiredButton: {
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 10,
    backgroundColor: colors.primary,
    shadowColor: '#1E6FD9',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 30,
    elevation: 8,
  },
  sessionExpiredButtonLabel: {
    fontFamily: Platform.OS === 'web' ? "'Jost', sans-serif" : undefined,
    fontSize: 11,
    fontWeight: '400',
    letterSpacing: 2.5,
    textTransform: 'uppercase',
    color: '#EEF6FF',
  },
  memoryFallbackBanner: {
    position: 'absolute',
    bottom: 100,
    left: '50%',
    marginLeft: -140,
    width: 280,
    backgroundColor: 'rgba(13,17,32,0.95)',
    borderWidth: 1,
    borderColor: 'rgba(82,142,220,0.2)',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 18,
    zIndex: 500,
    alignItems: 'center',
    justifyContent: 'center',
  },
  memoryFallbackBannerText: {
    fontFamily: Platform.OS === 'web' ? "'Jost', sans-serif" : undefined,
    fontSize: 11,
    fontWeight: '300',
    color: '#7A9ABE',
    letterSpacing: 0.5,
  },
  introContent: { padding: spacing.lg, paddingTop: spacing.xxl },
  ariaBadge: { alignItems: 'center', marginBottom: spacing.xl },
  ariaName: { fontSize: 26, fontWeight: '700', color: colors.text, marginTop: spacing.sm },
  ariaTagline: { fontSize: 15, color: colors.textSecondary, marginTop: spacing.xs },
  introTitle: { fontSize: 22, fontWeight: '600', color: colors.text, textAlign: 'center', marginBottom: spacing.md },
  introHint: { fontSize: 15, color: colors.textSecondary, textAlign: 'center', lineHeight: 22, marginBottom: spacing.sm },
  introNote: { fontSize: 14, color: colors.textSecondary, textAlign: 'center', marginBottom: spacing.lg },
  micErrorBlock: { backgroundColor: colors.error + '15', padding: spacing.md, marginBottom: spacing.md, borderRadius: 8 },
  micErrorText: { fontSize: 14, color: colors.error },
  micWarningBlock: { backgroundColor: colors.warning + '20', padding: spacing.md, marginBottom: spacing.md, borderRadius: 8 },
  micWarningText: { fontSize: 14, color: colors.warning },
  introButton: { marginTop: spacing.sm },
  scoringIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  scoringIndicatorDot: { fontSize: 11, color: colors.primary, letterSpacing: 2 },
  scoringIndicatorText: { fontSize: 11, color: colors.textSecondary, letterSpacing: 1 },
  scoringIndicatorSub: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 4,
    opacity: 0.9,
  },
  scoringViewScoresButton: {
    marginTop: 12,
    paddingVertical: 12,
    paddingHorizontal: 28,
    borderRadius: 10,
    backgroundColor: colors.primary,
    alignSelf: 'flex-start',
  },
  scoringViewScoresButtonLabel: {
    fontSize: 11,
    fontWeight: '400',
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: '#EEF6FF',
  },
  resultsPanel: {
    borderTopWidth: 2,
    borderTopColor: colors.primary,
    backgroundColor: colors.surface,
    maxHeight: 360,
  },
  resultsPanelHighlight: {
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
  },
  resultsPanelContent: { padding: 24, paddingBottom: spacing.xl },
  resultsPanelTitle: {
    fontSize: 10,
    color: colors.primary,
    letterSpacing: 3,
    marginBottom: 12,
  },
  gateResultBlock: {
    borderWidth: 1,
    borderLeftWidth: 4,
    paddingVertical: 16,
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  gateResultLabel: {
    fontSize: 10,
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  gateResultText: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 22,
  },
  resultsPanelSummary: {
    fontSize: 14,
    lineHeight: 22,
    color: colors.textSecondary,
    marginBottom: 20,
  },
  resultsPanelPillars: { marginBottom: 20 },
  resultsPillarRow: { marginBottom: 10 },
  resultsPillarHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  resultsPillarName: { fontSize: 10, color: colors.textSecondary, letterSpacing: 1 },
  resultsPillarScore: { fontSize: 11, fontWeight: '600' },
  resultsPillarBar: { height: 3, backgroundColor: colors.border, borderRadius: 2 },
  resultsPillarBarFill: { height: '100%', borderRadius: 2 },
  resultsPanelButton: { width: '100%' },
  retakeButtonUnderReview: {
    marginTop: 32,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderWidth: 1,
    borderColor: 'rgba(82,142,220,0.4)',
    borderRadius: 8,
  },
  retakeButtonUnderReviewText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#7A9ABE',
    letterSpacing: 1,
  },
  resultsContent: { padding: spacing.lg, paddingBottom: spacing.xxl },
  resultsHead: { fontSize: 11, color: colors.primary, letterSpacing: 2, marginBottom: spacing.sm },
  resultsTitle: { fontSize: 24, fontWeight: '600', color: colors.text, marginBottom: spacing.md },
  resultsSummary: { fontSize: 15, color: colors.textSecondary, lineHeight: 22, marginBottom: spacing.lg },
  pillarCard: { backgroundColor: colors.surface, borderLeftWidth: 4, padding: spacing.md, marginBottom: spacing.md, borderRadius: 8 },
  pillarRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  pillarName: { fontSize: 15, color: colors.text },
  pillarScore: { fontSize: 18, fontWeight: '600' },
  pillarEvidence: { fontSize: 13, color: colors.textSecondary, fontStyle: 'italic', lineHeight: 20 },
  inconsistenciesBlock: { backgroundColor: colors.primary + '12', padding: spacing.md, marginBottom: spacing.lg, borderRadius: 8 },
  inconsistenciesTitle: { fontSize: 11, color: colors.primary, letterSpacing: 1, marginBottom: spacing.sm },
  inconsistenciesText: { fontSize: 14, color: colors.text, lineHeight: 20, marginBottom: 4 },
  resultsButton: { marginTop: spacing.md },
  activeContainer: { flex: 1 },
  activeHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  activeHeaderLabel: { fontSize: 12, color: colors.primary },
  activeHeaderCount: { fontSize: 12, color: colors.textSecondary },
  constructRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, padding: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
  constructChip: { paddingVertical: 4, paddingHorizontal: 8, borderRadius: 4, borderWidth: 1, borderColor: colors.border },
  constructChipText: { fontSize: 10, color: colors.textSecondary },
  stageScoresContainer: { padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.surface },
  stageScoresTitle: { fontSize: 11, color: colors.primary, letterSpacing: 1, marginBottom: spacing.sm },
  stageScoreCard: { marginBottom: spacing.sm },
  stageScoreLabel: { fontSize: 12, fontWeight: '600', color: colors.text, marginBottom: 4 },
  stageScorePillars: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  stageScorePillar: { fontSize: 12, color: colors.textSecondary },
  transcriptScroll: { flex: 1 },
  transcriptContent: { padding: spacing.lg, paddingBottom: spacing.xl },
  msgRow: { marginBottom: spacing.lg },
  msgRowError: {
    alignSelf: 'center',
    maxWidth: '85%',
    padding: 12,
    marginVertical: 8,
    backgroundColor: 'rgba(232, 122, 122, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(232, 122, 122, 0.2)',
    borderRadius: 10,
  },
  msgContentError: {
    fontSize: 13,
    fontWeight: '300',
    color: '#E87A7A',
    textAlign: 'center',
    lineHeight: 20,
    borderLeftWidth: 0,
    paddingLeft: 0,
  },
  msgRowWaiting: {
    marginBottom: spacing.lg,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(82,142,220,0.08)',
  },
  msgRowUser: { alignItems: 'flex-end' },
  msgRole: { fontSize: 10, color: colors.primary, letterSpacing: 1, marginBottom: 4 },
  msgContent: { fontSize: 15, color: colors.text, lineHeight: 22, borderLeftWidth: 2, borderLeftColor: colors.border, paddingLeft: spacing.sm },
  msgContentWaiting: { color: '#3D5470', fontStyle: 'italic' },
  scoreCard: {
    marginVertical: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderLeftWidth: 3,
    borderColor: colors.border,
    borderLeftColor: colors.primary,
    borderRadius: 8,
  },
  scoreCardContent: { fontSize: 12, color: colors.textSecondary, lineHeight: 20, fontFamily: Platform.OS === 'web' ? 'monospace' : undefined },
  voiceDock: { padding: spacing.lg, alignItems: 'center', borderTopWidth: 1, borderTopColor: colors.border },
  dockError: { fontSize: 13, color: colors.error, marginBottom: spacing.sm },
  dockWarning: { fontSize: 13, color: colors.warning, marginBottom: spacing.sm },
  micOrb: { width: 88, height: 88, borderRadius: 44, backgroundColor: colors.text, justifyContent: 'center', alignItems: 'center' },
  micOrbListening: { backgroundColor: colors.error },
  micOrbProcessing: { backgroundColor: colors.primary },
  micOrbSpeaking: { backgroundColor: colors.success },
  voiceLabel: { fontSize: 11, color: colors.textSecondary, marginTop: spacing.sm },
  typeFallback: { marginTop: spacing.lg, width: '100%', maxWidth: 360 },
  typeFallbackLabel: { fontSize: 12, color: colors.textSecondary, marginBottom: spacing.xs },
  typeFallbackInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: 15,
    color: colors.text,
    backgroundColor: colors.surface,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  typeFallbackButton: { marginTop: spacing.sm },
  chatCompletionBlock: { marginTop: spacing.lg, padding: spacing.lg, backgroundColor: colors.surface, borderRadius: 8, borderLeftWidth: 4, borderLeftColor: colors.primary },
  chatCompletionTitle: { fontSize: 14, fontWeight: '600', color: colors.primary, letterSpacing: 1, marginBottom: spacing.sm },
  chatCompletionSummary: { fontSize: 15, color: colors.textSecondary, lineHeight: 22, marginBottom: spacing.lg },
  chatCompletionButton: { alignSelf: 'flex-start' },
  // Admin interview — dark design system (void/surface/flame-bright/text-primary)
  adminActiveContainer: { flex: 1, backgroundColor: '#05060D' },
  adminPanelButton: {
    position: 'absolute',
    top: 16,
    left: 16,
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(30,111,217,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(82,142,220,0.2)',
    borderRadius: 6,
    zIndex: 100,
  },
  adminPanelButtonText: {
    fontFamily: Platform.OS === 'web' ? 'Jost, sans-serif' : undefined,
    fontSize: 10,
    fontWeight: '300',
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: '#5BA8E8',
  },
  adminWrap: { flex: 1, backgroundColor: '#05060D' },
  adminStageScoresContainer: { backgroundColor: '#0D1120', borderBottomColor: 'rgba(82,142,220,0.12)' },
  adminStageScoresTitle: { color: '#3D5470', letterSpacing: 2.5, textTransform: 'uppercase', fontFamily: Platform.OS === 'web' ? 'Jost, sans-serif' : undefined, fontSize: 10 },
  adminTranscriptScroll: { backgroundColor: '#05060D' },
  adminTranscriptContent: { backgroundColor: '#05060D' },
  adminMsgRole: { color: '#3D5470', fontSize: 10, letterSpacing: 1 },
  adminMsgContentInterviewer: { color: '#C8E4FF', fontFamily: Platform.OS === 'web' ? "'Cormorant Garamond', serif" : undefined, fontSize: 16, fontWeight: '300', fontStyle: 'italic', lineHeight: 24, borderLeftColor: 'rgba(82,142,220,0.12)' },
  adminMsgContentUser: { color: '#E8F0F8', fontFamily: Platform.OS === 'web' ? 'Jost, sans-serif' : undefined, fontSize: 14, fontWeight: '300', lineHeight: 21 },
  adminScoreCard: { backgroundColor: '#111827', borderColor: 'rgba(82,142,220,0.12)', borderLeftColor: '#5BA8E8' },
  adminScoreCardContent: { color: '#C8E4FF', fontSize: 12 },
  adminStageScoreCard: { backgroundColor: '#111827', borderColor: 'rgba(82,142,220,0.12)', borderRadius: 10, padding: 16 },
  adminStageScoreLabel: { fontFamily: Platform.OS === 'web' ? 'Jost, sans-serif' : undefined, fontSize: 9, fontWeight: '400', letterSpacing: 2.5, textTransform: 'uppercase', color: '#3D5470' },
  adminStageScorePillar: { fontFamily: Platform.OS === 'web' ? "'Cormorant Garamond', serif" : undefined, fontSize: 22, fontWeight: '300', color: '#C8E4FF' },
  adminMsgRowWaiting: { borderBottomColor: 'rgba(82,142,220,0.12)' },
  adminMsgContentWaiting: { color: '#3D5470' },
  adminVoiceDock: { borderTopColor: 'rgba(82,142,220,0.12)', backgroundColor: '#05060D' },
  adminDockText: { color: '#E8F0F8' },
  adminVoiceLabel: { color: '#7A9ABE' },
  adminTypeFallbackLabel: { color: '#7A9ABE' },
  adminTypeFallbackInput: { backgroundColor: '#0D1120', borderColor: 'rgba(82,142,220,0.12)', color: '#E8F0F8' },
});
