export function generateBriefAck(_userText: string): string {
  const acks = ['Got that.', 'Noted.', "That's useful context.", "Appreciate you adding that."];
  return acks[Math.floor(Math.random() * acks.length)];
}

/** Build prompt for Claude to generate one closing line based on transcript (user turns only). */
export function buildClosingLinePrompt(messages: { role: string; content: string }[]): string {
  const userMessages = messages
    .filter((m) => m.role === 'user')
    .map((m) => m.content)
    .join('\n');
  return `Based on this interview transcript (user turns below are from THIS session only), write ONE OR TWO short sentences for the interviewer to deliver before the scripted thanks (see below). It should:
- **Anchor on something specific they actually said** in this session — e.g. Moment 4 (grudge / walk-away), or one concrete scenario read (Emma/Ryan contempt, Sarah/James appreciation miss, Sophie/Daniel leaving). Name the beat in plain language so it feels remembered, not like a form letter.
- The observation sentence is **optional**. Include it only when it is grammatically complete (clear subject + verb + object), grounded in something they specifically said, and accurate.
- If no specific grounded observation is available, write **nothing** before thanks — do not generate placeholder filler.
- You may pair a grounded anchor with brief **task** acknowledgement (good work / thanks for sticking with this). Never use a vague observation that sounds meaningful but says nothing specific.
- Stay accurate: only people, events, and lines that appear in the user turns below. Do not invent biographical detail.
- Do not use evaluative performance language about the user as a whole (no "direct and thoughtful throughout," "really grounded," "very clear," grades, or how well they "handled" the interview).
- Do not invent through-lines they did not offer.
- Only attribute positive relational qualities if supported by what they said (perspective-taking, ownership, repair orientation).
- Stay warm without diagnosing personal limitations or unresolved failures.
- NOT be a question; at most 2 sentences before the thanks line.
- NOT start with "Thank you" (thanks come after your line(s), in the same assistant message as instructed elsewhere)
- NOT start with "Sure" or "Okay" or "Absolutely" or "That makes sense" or "That checks out" or "That lands"
- NOT mention the word "journey" or "foundation"

Banned closing phrases:
"You worked through all five clearly"
"You have a strong foundation"
"Thank you for being so open"
"You did a great job"
"What came through was that you remember what happened between you and how it felt"
"What you said about catching yourself showed real self-awareness" (unless they actually said this)
"pursue-withdraw cycle"
"emotional witness"
"attunement"
"mentalizing"
"repair cycle"
"flooding"
"dysregulation"
"reflective functioning"
"going through the motions" (reads as hollow/cynical — never use when reflecting appreciation or genuine effort; it contradicts "made it happen" / concrete care)

Interview transcript (user turns only):
${userMessages}

Write only the closing line(s) before thanks (no "Thank you" in your output). No preamble.`;
}

export const CLOSING_LINE_INSTRUCTIONS = `
CLOSING — ONE MESSAGE, ANCHORED (THIS TRANSCRIPT ONLY):

After the personal questions (Moments 4–5), deliver a warm sign-off. Structure:

"Good work getting through all of this[, Name]. [Optional observation.] Your interview is complete. Thank you for being so open with me[, Name]." Then [INTERVIEW_COMPLETE].

The **observation sentence is optional**. Include it only when ALL of these are true:
- Grammatically complete (clear subject, verb, and object — not a fragment)
- Grounded in something the user specifically said or did in this interview
- Accurate — does not attribute qualities their answers do not support

If no specific grounded observation is available, **omit the middle sentence entirely**. A clean two-sentence closing is better than a vague or inaccurate three-sentence one.

**Prefer** a concrete detail from their **Moment 5 conflict / resolution** answer when they gave one; otherwise their grudge or commitment-threshold (Moment 4), or a concrete scenario stance (e.g. Emma/Ryan, Sarah/James, Sophie/Daniel).

Pillar grounding (when scores are low): only attribute perspective-taking if mentalizing ≥ 6; ownership if accountability ≥ 6; repair orientation if repair ≥ 6. When average pillar score < 4, omit the observation sentence entirely.

**Banned:** hollow trait praise ("direct and thoughtful throughout," "really self-aware," "very clear" as filler), invented biographical content, clinical/theoretical labels ("attunement," "mentalizing," "repair cycle," "flooding," "dysregulation," "reflective functioning," "pursue-withdraw cycle"), vague placeholders like "you remember what happened between you and how it felt."

SOURCE BOUNDARY: Only content supported by this transcript. No borrowing from other sessions.

BANNED PHRASES — never use these:
- "You've worked through all three of those clearly" / "You worked through all three clearly"
- "You caught the key patterns" / "key patterns in each situation"
- "What came through was that you remember what happened between you and how it felt"
- Any variation of "clearly" used as filler praise
- "A lot of self-awareness"
- "You handled that well"
- "Going through the motions" — never in closings
- Templated closings that stitch unrelated beats the user did not link

Do NOT reframe low-scoring signals as strengths. If signals were broadly low, stay brief and kind — omit the observation sentence rather than inventing one.

EXAMPLES (illustrative only — do not copy verbatim):

Good: "Good work getting through all of this — what you said about pulling off that surprise for your brother really stuck with me. Your interview is complete." Good: "Thanks for sticking with it; naming Emma's line as contempt while still seeing a path for Ryan is specific in a way most people gloss over. Your interview is complete." Good (no observation): "Good work getting through all of this. Your interview is complete. Thank you for being so open with me."

Bad: "What came through was that you remember what happened between you and how it felt." (vague, incomplete, not grounded)
Bad: "I appreciate you walking through all of this — you've been direct and thoughtful throughout." (generic / trait-only, no concrete anchor)
`;

export const PERSONAL_CLOSING_INSTRUCTION = `
CLOSING: The user shared personal experiences across Moments 4 and 5. **One** assistant message only: "Good work getting through all of this" + optional **one** grounded observation + "Your interview is complete" + "Thank you for being so open with me". The observation is optional — include it only when grammatically complete and anchored in something they specifically said (prefer Moment 5 conflict/resolution, else Moment 4 grudge/threshold, else a scenario detail). **Omit the observation entirely** when nothing specific and accurate is available. **No** generic trait-only praise ("direct and thoughtful throughout," "very clear," "self-aware"). Do not start with "Sure," "Okay," "Absolutely," "That makes sense," "That checks out," or "That lands." Do not reframe low-scoring signals as positives. No clinical/theoretical labels. Then output [INTERVIEW_COMPLETE].`;

export const SCENARIO_ONLY_CLOSING_INSTRUCTION = `
CLOSING: The user gave limited personal detail. **One** assistant message only: "Good work getting through all of this" + optional **one** grounded observation from the scenarios (a named character, a line they quoted, or how they framed the conflict) + "Your interview is complete" + "Thank you for being so open with me". **Omit the observation** when nothing specific and accurate is available. Do not start with "Sure," "Okay," "Absolutely," "That makes sense," "That checks out," or "That lands." No hollow trait evaluation. No biographical content that does not appear in this transcript. Then output [INTERVIEW_COMPLETE].`;
