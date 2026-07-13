import { detectScenarioFromResponse } from '@features/aria/scenarioNumberDetection';
import { assignScenarioNumbersToTranscript } from '@utilities/interviewResumeCursor';
import { sliceTranscriptForScenario3Scoring } from './scenarioCProbeLogic';

export type InterviewMomentIndex = 1 | 2 | 3 | 4 | 5;

export type MessageWithScenario = {
  role: string;
  content: string;
  scenarioNumber?: number;
  interviewMoment?: InterviewMomentIndex;
};

export function normalizeAssistantTypographicPunctuationForRegex(text: string): string {
  return text
    .replace(/[\u2018\u2019\u201A\u201B\u2032\u2035\u0060]/g, "'")
    .replace(/[\u201C\u201D\u201E]/g, '"');
}

export function inferScenarioMessages(
  allMessages: { role: string; content: string }[],
  scenarioNum: 1 | 2 | 3
): { role: string; content: string }[] {
  const scenarioAnchors: Record<number, string[]> = {
    1: [
      'emma and ryan',
      'ryan takes a call',
      "here's the first",
      'first situation',
      "what can i call you",
      "i'm Amoraea",
      "welcome to amoraea",
    ],
    2: [
      'sarah has been job hunting',
      'on to the second',
      'second situation',
      "here's the next situation",
      'the second situation',
      'next situation',
      'sarah and james',
      'situation 2',
      'situation two',
    ],
    3: [
      'sophie and daniel',
      'i need ten minutes',
      "here's the third situation",
      'third situation',
      'last one',
      'situation three',
      'the third situation',
      'situation 3',
    ],
  };
  const anchors = scenarioAnchors[scenarioNum].map((a) => a.toLowerCase());

  const findScenarioStartIndex = (): number => {
    const primary = allMessages.findIndex((m) => {
      if (m.role !== 'assistant') return false;
      const c = (m.content ?? '').toLowerCase();
      return anchors.some((anchor) => c.includes(anchor));
    });
    if (primary !== -1) return primary;

    for (let i = 0; i < allMessages.length; i++) {
      const m = allMessages[i];
      if (m.role !== 'assistant') continue;
      if (detectScenarioFromResponse(m.content ?? '') === scenarioNum) return i;
    }

    if (scenarioNum === 2) {
      const h = allMessages.findIndex((m) => {
        if (m.role !== 'assistant') return false;
        const c = (m.content ?? '').toLowerCase();
        return (
          (/\bsarah\b/.test(c) && /\bjames\b/.test(c) && /job|hunting|offer|celebrate|appreciated|blindsided|deadline|fight/.test(c)) ||
          /\bsituation\s*2\b/.test(c)
        );
      });
      if (h !== -1) return h;
    }
    if (scenarioNum === 3) {
      const h = allMessages.findIndex((m) => {
        if (m.role !== 'assistant') return false;
        const c = (m.content ?? '').toLowerCase();
        return (
          (/\bsophie\b/.test(c) && /\bdaniel\b/.test(c) && /ten minutes|avoiding|didn'?t know what to say|silent|upset/.test(c)) ||
          /\bsituation\s*3\b/.test(c)
        );
      });
      if (h !== -1) return h;
    }
    return -1;
  };

  const startIdx = findScenarioStartIndex();
  const effectiveStartIdx = scenarioNum === 1 && startIdx === -1 ? 0 : startIdx;
  if (effectiveStartIdx === -1) return [];
  const nextScenarioAnchors =
    scenarioNum < 3
      ? ([] as string[]).concat(
          ...Object.entries(scenarioAnchors)
            .filter(([k]) => Number(k) > scenarioNum)
            .map(([, v]) => v),
          'on to the second situation',
          'second situation',
          "here's the next situation",
          'last one',
          "here's the third situation",
          'third situation',
          'situation three',
          'situation two'
        )
      : ["we've covered those three", 'held a grudge', 'something a bit more personal'];
  const nextAnchorsLower = nextScenarioAnchors.map((a) => a.toLowerCase());
  const endIdx =
    nextAnchorsLower.length > 0
      ? allMessages.findIndex(
          (m, i) => i > effectiveStartIdx && m.role === 'assistant' && nextAnchorsLower.some((anchor) => (m.content ?? '').toLowerCase().includes(anchor))
        )
      : -1;
  return allMessages.slice(effectiveStartIdx, endIdx === -1 ? allMessages.length : endIdx);
}

export function pickMessagesForScenarioScoring(
  allMessages: MessageWithScenario[],
  scenarioNum: 1 | 2 | 3
): { role: string; content: string }[] {
  const corpus =
    scenarioNum === 3 ? sliceTranscriptForScenario3Scoring(allMessages) : allMessages;
  const tagged = corpus.filter((m) => (m as MessageWithScenario).scenarioNumber === scenarioNum);
  const inferred = inferScenarioMessages(corpus, scenarioNum);
  const taggedUser = tagged.filter((m) => m.role === 'user').length;
  const inferredUser = inferred.filter((m) => m.role === 'user').length;

  if (inferred.length >= 2 && inferredUser >= 1 && (tagged.length === 0 || inferredUser > taggedUser)) {
    return inferred;
  }
  if (tagged.length >= 2) return tagged;
  if (inferred.length >= 2) return inferred;
  return inferred.length >= tagged.length ? inferred : tagged;
}

/** User turns for scoring heuristics — tagged transcript first, then anchor-inferred slice. */
export function resolveScenarioUserTurnsForScoring(
  allMessages: MessageWithScenario[],
  scenarioNum: 1 | 2 | 3,
): string[] {
  const corpus =
    scenarioNum === 3 ? sliceTranscriptForScenario3Scoring(allMessages) : allMessages;
  const tagged = corpus
    .filter(
      (m): m is MessageWithScenario =>
        m.role === 'user' &&
        m.scenarioNumber === scenarioNum &&
        typeof m.content === 'string' &&
        m.content.trim().length > 0,
    )
    .map((m) => m.content.replace(/\s+/g, ' ').trim());
  if (tagged.length > 0) return tagged;
  return pickMessagesForScenarioScoring(corpus, scenarioNum)
    .filter((m) => m.role === 'user' && typeof m.content === 'string' && m.content.trim().length > 0)
    .map((m) => m.content.replace(/\s+/g, ' ').trim());
}

export function resolveScenarioUserTextForScoring(
  allMessages: MessageWithScenario[],
  scenarioNum: 1 | 2 | 3,
): string {
  return resolveScenarioUserTurnsForScoring(allMessages, scenarioNum).join(' ');
}

/** Ensure every scored transcript turn carries scenarioNumber before persisting or syncing. */
export function tagInterviewTranscriptMessages(msgs: MessageWithScenario[]): MessageWithScenario[] {
  return assignScenarioNumbersToTranscript(msgs);
}
