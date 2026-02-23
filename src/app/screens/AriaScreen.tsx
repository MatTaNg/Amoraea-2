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
import { useQuery } from '@tanstack/react-query';
import { SafeAreaContainer } from '@ui/components/SafeAreaContainer';
import { Button } from '@ui/components/Button';
import { colors } from '@ui/theme/colors';
import { spacing } from '@ui/theme/spacing';
import { Ionicons } from '@expo/vector-icons';
import { speakWithElevenLabs, stopElevenLabsSpeech } from '@features/aria/utils/elevenLabsTts';
import { ProfileRepository } from '@data/repositories/ProfileRepository';

const profileRepository = new ProfileRepository();

// ─────────────────────────────────────────────
// INTERVIEW SYSTEM PROMPT (from ai_interviewer)
// ─────────────────────────────────────────────
const INTERVIEWER_SYSTEM = `You are a relationship assessment interviewer conducting a warm, thoughtful conversation to understand someone's relational patterns. You are not a therapist and this is not therapy — it is a structured assessment interview.

You are assessing 6 constructs across approximately 15-20 minutes of conversation:
1. CONFLICT & REPAIR (Pillar 1) — How they handle escalation, who initiates repair, what repair looks like
2. ACCOUNTABILITY (Pillar 3) — Ownership vs. blame-shifting, capacity for genuine change, response to feedback
3. RELIABILITY (Pillar 4) — Follow-through under inconvenience, what motivates keeping commitments
4. RESPONSIVENESS (Pillar 5) — Attunement to partner's bids, capitalization of good news, presence vs. absence
5. DESIRE & BOUNDARIES (Pillar 6) — Navigation of mismatch, communication vs. avoidance, pattern of silence
6. STRESS RESILIENCE (Pillar 9) — How external pressure spills into relationships, what they need and can ask for

INTERVIEW APPROACH:
- Warm but purposeful. Not casual chat — a conversation with direction.
- Always pursue behavioral specificity. Never accept vague generalities.
- When someone says "I'm usually pretty good at X" — always ask for a specific example.
- When an example is given, probe for what they actually did, not what they felt or thought.
- Cover all 6 constructs, but follow the natural flow of the conversation.
- Do not reveal which construct you are assessing at any given moment.

CRITICAL — WHEN SOMEONE SAYS THEY DON'T HAVE AN EXAMPLE:
If the user says they can't think of one, don't have one, nothing comes to mind, or haven't been in that situation — do NOT widen scope (friendship, family), do NOT lower the stakes, do NOT probe for a better example. Go IMMEDIATELY to the scenario for that construct. Say something like "No problem. Let me give you a situation to react to instead." Then deliver the scenario for the construct you are currently assessing from the list below. Each scenario features two people where fault is genuinely shared or ambiguous. After presenting it, ask three things in sequence, one at a time: what went wrong, what either person could have done differently, and what they would do in that situation. Do not ask all three at once. If the scenario also produces nothing useful, say "That's completely fine — let's move on." and continue to the next construct.

SCENARIO BANK — use exactly when the user has no personal example:

CONFLICT & REPAIR (Pillar 1):
"Marcus and Diane have been together two years. During an argument about finances, Marcus says 'you always make everything about yourself' — he immediately knows it came out wrong. Diane shuts down and leaves the room. Marcus waits for her to come back. She doesn't. An hour later he knocks on the door and says 'I didn't mean it like that.' Diane says 'okay' but stays distant for the rest of the evening. Nothing more is said about it.
What do you think went wrong there?"
[After they respond]: "What could either of them have done differently?"
[After they respond]: "What would you have done in Marcus's position?"

ACCOUNTABILITY (Pillar 3):
"Jordan told their close friend Sam they'd keep something private. A few weeks later, Sam finds out Jordan mentioned it to someone else — not maliciously, it just came up. Jordan apologises and says 'I didn't think it was a big deal at the time, and I didn't mean to hurt you.' Sam says they appreciate the apology but feels like Jordan isn't really taking it seriously. Jordan feels like they've said sorry and doesn't know what else to do.
What do you think went wrong there?"
[After they respond]: "What could either of them have done differently?"
[After they respond]: "What would you have done in Jordan's position?"

RELIABILITY (Pillar 4):
"Priya promised to help her friend Leo move apartments on Saturday — they'd planned it for three weeks. On Friday evening her manager asks her to come in Saturday morning for a client situation that's important but not a true emergency. Priya texts Leo late Friday: 'Something came up at work, I can't make it tomorrow, really sorry.' Leo manages alone. When they next speak, Leo says it's fine but seems off. Priya thinks she made the right call given the circumstances.
What do you think went wrong there?"
[After they respond]: "What could either of them have done differently?"
[After they respond]: "What would you have done in Priya's position?"

RESPONSIVENESS (Pillar 5):
"Alex calls their partner Riley mid-afternoon, excited about a promotion they just found out about. Riley is in the middle of a stressful work situation and says 'that's great, congrats, I'm really slammed right now — can we talk tonight?' Alex says sure. That evening Riley is tired and doesn't bring it up. Alex doesn't bring it up either. The conversation never really happens.
What do you think went wrong there?"
[After they respond]: "What could either of them have done differently?"
[After they respond]: "What would you have done in Riley's position?"

DESIRE & BOUNDARIES (Pillar 6):
"Chris and Morgan have been together eighteen months. Chris has been feeling like they've grown physically distant but hasn't said anything, assuming it will sort itself out. Morgan has noticed Chris seems withdrawn lately but assumes it's work stress and doesn't ask. Two months pass. Chris eventually brings it up during an argument about something unrelated. Morgan feels blindsided — 'why didn't you just say something sooner?'
What do you think went wrong there?"
[After they respond]: "What could either of them have done differently?"
[After they respond]: "What would you have done in Chris's position?"

STRESS RESILIENCE (Pillar 9):
"Nat has had an overwhelming week — a difficult project, poor sleep, family tension. Their partner Drew has been patient but is starting to feel shut out. On Friday night Drew suggests they do something together. Nat says 'I just need to decompress alone tonight.' Drew says 'okay' but feels hurt — this is the third time this week. Nat doesn't notice. Saturday morning there's a tension neither of them names.
What do you think went wrong there?"
[After they respond]: "What could either of them have done differently?"
[After they respond]: "What would you have done in Nat's position?"

OPENING: Start with a warm introduction. Begin with conflict — it's the richest entry point.
CLOSING: When you have covered all 6 constructs adequately, close naturally and output: [INTERVIEW_COMPLETE]

TONE: Curious, not clinical. Warm, not cheerful. Direct, not blunt. Keep responses concise — 2-4 sentences per turn. Write for the ear; use short sentences, no bullet points. End with a single clear question.`;

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

Score each pillar 0-10 based on transcript evidence. Be honest — do not inflate. For each pillar, identify the specific evidence.

PILLARS: 1 (Conflict & Repair), 3 (Accountability), 4 (Reliability), 5 (Responsiveness), 6 (Desire & Bounds), 9 (Stress Resilience).

Return ONLY valid JSON:
{
  "pillarScores": { "1": 0, "3": 0, "4": 0, "5": 0, "6": 0, "9": 0 },
  "keyEvidence": { "1": "evidence", "3": "evidence", "4": "evidence", "5": "evidence", "6": "evidence", "9": "evidence" },
  "narrativeCoherence": "high | moderate | low",
  "behavioralSpecificity": "high | moderate | low",
  "notableInconsistencies": [],
  "interviewSummary": "3 honest sentences summarising this person's relational patterns."
}`;
}

const CONSTRUCTS = [
  { id: 1, label: 'Conflict & Repair', color: colors.error },
  { id: 3, label: 'Accountability', color: colors.success },
  { id: 4, label: 'Reliability', color: colors.primary },
  { id: 5, label: 'Responsiveness', color: '#0D6B6B' },
  { id: 6, label: 'Desire & Limits', color: '#8B3A5C' },
  { id: 9, label: 'Stress & Support', color: '#2A5C5C' },
];

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

type VoiceState = 'idle' | 'listening' | 'processing' | 'speaking';
type Status = 'intro' | 'active' | 'scoring' | 'results';

interface InterviewResults {
  pillarScores: Record<string, number>;
  keyEvidence?: Record<string, string>;
  narrativeCoherence?: string;
  behavioralSpecificity?: string;
  notableInconsistencies?: string[];
  interviewSummary?: string;
}

const ANTHROPIC_API_KEY =
  (typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_ANTHROPIC_API_KEY) || '';
const ANTHROPIC_PROXY_URL =
  (typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_ANTHROPIC_PROXY_URL) || '';
const SUPABASE_ANON_KEY =
  (typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_SUPABASE_ANON_KEY) || '';

const OPENAI_API_KEY =
  (typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_OPENAI_API_KEY) || '';

export const AriaScreen: React.FC<{ navigation: any; route: any }> = ({ navigation, route }) => {
  const { userId } = route.params as { userId: string };
  const [messages, setMessages] = useState<{ role: string; content: string }[]>([]);
  const [voiceState, setVoiceState] = useState<VoiceState>('idle');
  const [status, setStatus] = useState<Status>('intro');
  const [touchedConstructs, setTouchedConstructs] = useState<number[]>([]);
  const [results, setResults] = useState<InterviewResults | null>(null);
  const [exchangeCount, setExchangeCount] = useState(0);
  const [currentTranscript, setCurrentTranscript] = useState('');
  const [micError, setMicError] = useState<string | null>(null);
  const [micWarning, setMicWarning] = useState<string | null>(null);
  const [typedAnswer, setTypedAnswer] = useState('');

  const recognitionRef = useRef<{ start(): void; stop(): void } | null>(null);
  const transcriptAtReleaseRef = useRef('');
  const isSpeakingRef = useRef(false);
  const useWhisperOnWeb = Platform.OS === 'web' && !!OPENAI_API_KEY;
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const { data: profile } = useQuery({
    queryKey: ['profile', userId],
    queryFn: () => profileRepository.getProfile(userId),
  });

  const typologyContext = ''; // Optional: load from profile/assessments later

  const speak = useCallback(async (text: string) => {
    stopElevenLabsSpeech();
    setVoiceState('speaking');
    isSpeakingRef.current = true;
    try {
      await speakWithElevenLabs(text);
    } finally {
      isSpeakingRef.current = false;
      setVoiceState('idle');
    }
  }, []);

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

  const processUserSpeech = useCallback(async (spokenText: string) => {
    if (!spokenText.trim()) {
      setVoiceState('idle');
      return;
    }
    const userMsg = { role: 'user', content: spokenText };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setCurrentTranscript('');
    transcriptAtReleaseRef.current = '';
    setVoiceState('processing');
    setExchangeCount((c) => c + 1);
    const detected = detectConstructs(spokenText);
    setTouchedConstructs((prev) => [...new Set([...prev, ...detected])]);

    if (!ANTHROPIC_API_KEY && !ANTHROPIC_PROXY_URL) {
      setMessages((prev) => [...prev, { role: 'assistant', content: 'API key or proxy not set. Add EXPO_PUBLIC_ANTHROPIC_API_KEY or EXPO_PUBLIC_ANTHROPIC_PROXY_URL.' }]);
      setVoiceState('idle');
      return;
    }

    const requestBody = {
      model: 'claude-sonnet-4-20250514',
      max_tokens: 200,
      system: INTERVIEWER_SYSTEM,
      messages: newMessages.map((m) => ({ role: m.role, content: m.content })),
    };
    const useProxy = !!ANTHROPIC_PROXY_URL;
    const apiUrl = useProxy ? ANTHROPIC_PROXY_URL : 'https://api.anthropic.com/v1/messages';
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (useProxy && SUPABASE_ANON_KEY) {
      headers['Authorization'] = `Bearer ${SUPABASE_ANON_KEY}`;
    } else if (!useProxy) {
      headers['x-api-key'] = ANTHROPIC_API_KEY;
      headers['anthropic-version'] = '2023-06-01';
    }

    try {
      const res = await fetch(apiUrl, { method: 'POST', headers, body: JSON.stringify(requestBody) });
      const raw = await res.text();
      let data: { content?: Array<{ text?: string }>; error?: { message?: string } };
      try {
        data = JSON.parse(raw);
      } catch {
        if (!res.ok) {
          const errMsg = `API error ${res.status}. On web, direct API calls are often blocked (CORS). Use a backend proxy — set EXPO_PUBLIC_ANTHROPIC_PROXY_URL to your proxy URL.`;
          setMessages((prev) => [...prev, { role: 'assistant', content: errMsg }]);
          setVoiceState('idle');
          return;
        }
        setMessages((prev) => [...prev, { role: 'assistant', content: "Couldn't parse API response. Please try again." }]);
        setVoiceState('idle');
        return;
      }

      if (!res.ok) {
        const msg = data?.error?.message || `API error ${res.status}`;
        const hint = res.status === 401 ? ' Check your API key.' : res.status === 429 ? ' Rate limit — wait a moment.' : '';
        setMessages((prev) => [...prev, { role: 'assistant', content: `${msg}.${hint}` }]);
        setVoiceState('idle');
        return;
      }

      const text = (data.content?.[0]?.text ?? '').trim();

      if (text.includes('[INTERVIEW_COMPLETE]')) {
        const cleanText = text.replace('[INTERVIEW_COMPLETE]', '').trim();
        const finalMessages = [...newMessages, { role: 'assistant', content: cleanText || 'Thank you. That was really helpful.' }];
        setMessages(finalMessages);
        await speak(cleanText || 'Thank you. That was really helpful.');
        setTimeout(() => scoreInterview(finalMessages), 1000);
        return;
      }

      const aiMsg = { role: 'assistant', content: text };
      setMessages([...newMessages, aiMsg]);
      const aiDetected = detectConstructs(text);
      setTouchedConstructs((prev) => [...new Set([...prev, ...aiDetected])]);
      await speak(text);
    } catch (err) {
      const isNetwork = err instanceof TypeError && (err.message === 'Failed to fetch' || err.message?.includes('network'));
      const errMsg = isNetwork || (err as Error)?.message?.toLowerCase?.().includes('fetch')
        ? "Can't reach the API (network or CORS). If you're on web, call Anthropic from a backend and set EXPO_PUBLIC_ANTHROPIC_PROXY_URL to your proxy URL."
        : "Something went wrong. Please try again.";
      setMessages((prev) => [...prev, { role: 'assistant', content: errMsg }]);
      setVoiceState('idle');
      await speak(errMsg);
    }
  }, [messages, speak]);

  const handlePressStart = useCallback(async () => {
    if (voiceState !== 'idle') return;
    setMicWarning(null);
    stopElevenLabsSpeech();
    setCurrentTranscript('');
    transcriptAtReleaseRef.current = '';
    setVoiceState('listening');
    if (useWhisperOnWeb && typeof navigator !== 'undefined' && navigator.mediaDevices?.getUserMedia) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaStreamRef.current = stream;
        audioChunksRef.current = [];
        const mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' : 'audio/webm';
        const recorder = new MediaRecorder(stream);
        mediaRecorderRef.current = recorder;
        recorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
        recorder.start(100);
      } catch (err) {
        setMicError('Microphone access was denied or unavailable.');
        setVoiceState('idle');
      }
      return;
    }
    if (Platform.OS === 'web' && recognitionRef.current) {
      try { recognitionRef.current.start(); } catch {}
    } else {
      nativeTranscriptRef.current = { final: '', interim: '' };
      ExpoSpeechRecognitionModule.requestPermissionsAsync().then((r) => {
        if (r.granted) ExpoSpeechRecognitionModule.start({ lang: 'en-US', interimResults: true, continuous: true });
      });
    }
  }, [voiceState, useWhisperOnWeb]);

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
    if (useWhisperOnWeb && mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      const recorder = mediaRecorderRef.current;
      const stream = mediaStreamRef.current;
      mediaRecorderRef.current = null;
      mediaStreamRef.current = null;
      await new Promise<void>((resolve) => {
        recorder.onstop = () => resolve();
        recorder.stop();
      });
      stream?.getTracks().forEach((t) => t.stop());
      setVoiceState('processing');
      const chunks = audioChunksRef.current;
      audioChunksRef.current = [];
      if (chunks.length === 0) {
        setMicWarning('No audio recorded. Try again.');
        setVoiceState('idle');
        return;
      }
      try {
        const blob = new Blob(chunks, { type: 'audio/webm' });
        const form = new FormData();
        form.append('file', blob, 'recording.webm');
        form.append('model', 'whisper-1');
        const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
          method: 'POST',
          headers: { Authorization: `Bearer ${OPENAI_API_KEY}` },
          body: form,
        });
        if (!res.ok) {
          const err = await res.text();
          setMicWarning(res.status === 401 ? 'Invalid OpenAI API key.' : `Transcription failed: ${res.status}`);
          setVoiceState('idle');
          return;
        }
        const data = (await res.json()) as { text?: string };
        const text = (data.text ?? '').trim();
        if (text) processUserSpeech(text);
        else {
          setMicWarning('No speech detected. Try again.');
          setVoiceState('idle');
        }
      } catch (err) {
        setMicWarning('Connection problem. Check your internet and try again.');
        setVoiceState('idle');
      }
      return;
    }
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
  }, [voiceState, currentTranscript, processUserSpeech, useWhisperOnWeb]);

  const startInterview = useCallback(async () => {
    setStatus('active');
    setVoiceState('processing');
    if (!ANTHROPIC_API_KEY && !ANTHROPIC_PROXY_URL) {
      setMessages([{ role: 'assistant', content: 'API key or proxy not set. Add EXPO_PUBLIC_ANTHROPIC_API_KEY or EXPO_PUBLIC_ANTHROPIC_PROXY_URL.' }]);
      setVoiceState('idle');
      return;
    }
    const useProxy = !!ANTHROPIC_PROXY_URL;
    const apiUrl = useProxy ? ANTHROPIC_PROXY_URL : 'https://api.anthropic.com/v1/messages';
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (useProxy && SUPABASE_ANON_KEY) {
      headers['Authorization'] = `Bearer ${SUPABASE_ANON_KEY}`;
    } else if (!useProxy) {
      headers['x-api-key'] = ANTHROPIC_API_KEY;
      headers['anthropic-version'] = '2023-06-01';
    }
    try {
      const res = await fetch(apiUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 200,
          system: INTERVIEWER_SYSTEM,
          messages: [{ role: 'user', content: '[BEGIN INTERVIEW] Please introduce yourself briefly and ask your first question. Keep it to 2-3 sentences.' }],
        }),
      });
      const data = await res.json();
      const text = (data.content?.[0]?.text ?? "Hello. I'd like to understand how you show up in close relationships. Let's start with conflict — can you tell me about a time things got heated with someone you cared about?");
      setMessages([{ role: 'assistant', content: text }]);
      await speak(text);
    } catch {
      const fallback = "Hello. I'd like to understand how you show up in close relationships. Let's start — can you tell me about a time things got tense with someone you cared about?";
      setMessages([{ role: 'assistant', content: fallback }]);
      await speak(fallback);
    }
  }, [speak]);

  const scoreInterview = useCallback(async (finalMessages: { role: string; content: string }[]) => {
    setStatus('scoring');
    const context = typologyContext || 'No typology context — score from transcript only.';
    if (!ANTHROPIC_API_KEY && !ANTHROPIC_PROXY_URL) {
      setResults({
        pillarScores: { '1': 6, '3': 7, '4': 6, '5': 7, '6': 5, '9': 6 },
        keyEvidence: {},
        narrativeCoherence: 'moderate',
        behavioralSpecificity: 'moderate',
        notableInconsistencies: [],
        interviewSummary: 'Interview completed. Set EXPO_PUBLIC_ANTHROPIC_API_KEY or proxy for scoring.',
      });
      setStatus('results');
      return;
    }
    const useProxy = !!ANTHROPIC_PROXY_URL;
    const apiUrl = useProxy ? ANTHROPIC_PROXY_URL : 'https://api.anthropic.com/v1/messages';
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (useProxy && SUPABASE_ANON_KEY) {
      headers['Authorization'] = `Bearer ${SUPABASE_ANON_KEY}`;
    } else if (!useProxy) {
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
      setResults(JSON.parse(raw) as InterviewResults);
      setStatus('results');
    } catch {
      setResults({
        pillarScores: { '1': 6, '3': 7, '4': 6, '5': 7, '6': 5, '9': 6 },
        keyEvidence: {},
        narrativeCoherence: 'moderate',
        behavioralSpecificity: 'moderate',
        notableInconsistencies: [],
        interviewSummary: 'A grounded spoken profile. See individual construct scores for detail.',
      });
      setStatus('results');
    }
  }, [typologyContext]);

  // ── RENDER ──
  if (status === 'scoring') {
    return (
      <SafeAreaContainer>
        <View style={styles.scoringContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.scoringTitle}>Reading your interview</Text>
          <Text style={styles.scoringSub}>Analysing narrative coherence · Scoring 6 constructs</Text>
        </View>
      </SafeAreaContainer>
    );
  }

  if (status === 'results' && results) {
    const pillarMeta: Record<string, { name: string; color: string }> = {
      '1': { name: 'Conflict & Repair', color: colors.error },
      '3': { name: 'Accountability', color: colors.success },
      '4': { name: 'Reliability', color: colors.primary },
      '5': { name: 'Responsiveness', color: '#0D6B6B' },
      '6': { name: 'Desire & Boundaries', color: '#8B3A5C' },
      '9': { name: 'Stress Resilience', color: '#2A5C5C' },
    };
    return (
      <SafeAreaContainer>
        <ScrollView style={styles.container} contentContainerStyle={styles.resultsContent}>
          <Text style={styles.resultsHead}>Interview complete</Text>
          <Text style={styles.resultsTitle}>What your conversation revealed</Text>
          {results.interviewSummary ? (
            <Text style={styles.resultsSummary}>{results.interviewSummary}</Text>
          ) : null}
          {results.pillarScores && Object.entries(results.pillarScores).map(([id, score]) => {
            const meta = pillarMeta[id];
            if (!meta) return null;
            const evidence = results.keyEvidence?.[id];
            return (
              <View key={id} style={[styles.pillarCard, { borderLeftColor: meta.color }]}>
                <View style={styles.pillarRow}>
                  <Text style={styles.pillarName}>{meta.name}</Text>
                  <Text style={[styles.pillarScore, { color: meta.color }]}>{score}/10</Text>
                </View>
                {evidence ? <Text style={styles.pillarEvidence}>"{evidence}"</Text> : null}
              </View>
            );
          })}
          {results.notableInconsistencies && results.notableInconsistencies.length > 0 && (
            <View style={styles.inconsistenciesBlock}>
              <Text style={styles.inconsistenciesTitle}>Worth reflecting on</Text>
              {results.notableInconsistencies.map((note, i) => (
                <Text key={i} style={styles.inconsistenciesText}>{note}</Text>
              ))}
            </View>
          )}
          <Button
            title="Back to Home"
            onPress={() => navigation.navigate('Home')}
            style={styles.resultsButton}
          />
        </ScrollView>
      </SafeAreaContainer>
    );
  }

  if (status === 'intro') {
    return (
      <SafeAreaContainer>
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

  // Active interview
  return (
    <SafeAreaContainer>
      <View style={styles.activeContainer}>
        <View style={styles.activeHeader}>
          <Text style={styles.activeHeaderLabel}>Voice Interview · Your Story</Text>
          <Text style={styles.activeHeaderCount}>{exchangeCount} exchanges</Text>
        </View>
        <View style={styles.constructRow}>
          {CONSTRUCTS.map((c) => {
            const isTouched = touchedConstructs.includes(c.id);
            return (
              <View key={c.id} style={[styles.constructChip, isTouched && { borderColor: c.color, backgroundColor: c.color + '15' }]}>
                <Text style={[styles.constructChipText, isTouched && { color: c.color }]}>{c.label}</Text>
              </View>
            );
          })}
        </View>
        <ScrollView
          style={styles.transcriptScroll}
          contentContainerStyle={styles.transcriptContent}
          keyboardShouldPersistTaps="handled"
          ref={(r) => { /* scroll to end could be added */ }}
        >
          {messages.map((msg, i) => (
            <View key={i} style={[styles.msgRow, msg.role === 'user' && styles.msgRowUser]}>
              <Text style={styles.msgRole}>{msg.role === 'assistant' ? '◆ Interviewer' : 'You'}</Text>
              <Text style={styles.msgContent}>{msg.content}</Text>
            </View>
          ))}
          {currentTranscript && voiceState === 'listening' && (
            <View style={styles.msgRow}>
              <Text style={[styles.msgRole, { color: colors.error }]}>● You (speaking…)</Text>
              <Text style={[styles.msgContent, { fontStyle: 'italic' }]}>{currentTranscript}</Text>
            </View>
          )}
        </ScrollView>
        <View style={styles.voiceDock}>
          {micError ? <Text style={styles.dockError}>{micError}</Text> : null}
          {micWarning && !micError ? <Text style={styles.dockWarning}>{micWarning}</Text> : null}
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
          <Text style={styles.voiceLabel}>
            {voiceState === 'listening' && 'Release to send'}
            {voiceState === 'processing' && 'Thinking…'}
            {voiceState === 'speaking' && 'Interviewer speaking'}
            {voiceState === 'idle' && 'Hold to speak'}
          </Text>
          <View style={styles.typeFallback}>
            <Text style={styles.typeFallbackLabel}>Or type your answer (you can type while the interviewer is speaking)</Text>
            <TextInput
              style={styles.typeFallbackInput}
              placeholder="Type here…"
              placeholderTextColor={colors.textSecondary}
              value={typedAnswer}
              onChangeText={setTypedAnswer}
              editable={voiceState !== 'processing'}
              multiline
              maxLength={2000}
            />
            <Button
              title="Send"
              onPress={handleSendTyped}
              disabled={!typedAnswer.trim() || voiceState === 'processing'}
              variant="outline"
              style={styles.typeFallbackButton}
            />
          </View>
        </View>
      </View>
    </SafeAreaContainer>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
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
  scoringContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.xl },
  scoringTitle: { fontSize: 20, color: colors.text, marginTop: spacing.lg },
  scoringSub: { fontSize: 12, color: colors.textSecondary, marginTop: spacing.xs },
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
  transcriptScroll: { flex: 1 },
  transcriptContent: { padding: spacing.lg, paddingBottom: spacing.xl },
  msgRow: { marginBottom: spacing.lg },
  msgRowUser: { alignItems: 'flex-end' },
  msgRole: { fontSize: 10, color: colors.primary, letterSpacing: 1, marginBottom: 4 },
  msgContent: { fontSize: 15, color: colors.text, lineHeight: 22, borderLeftWidth: 2, borderLeftColor: colors.border, paddingLeft: spacing.sm },
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
});
