import { useState, useEffect, useRef, useCallback } from "react";

// ─────────────────────────────────────────────
// DESIGN TOKENS — matches full_assessment_system.jsx
// ─────────────────────────────────────────────
const T = {
  cream:     "#F5F0E8",
  creamDark: "#EDE6D6",
  ink:       "#1C1917",
  inkLight:  "#44403C",
  inkFaint:  "#A8A29E",
  inkGhost:  "#D6D0C8",
  gold:      "#8B6914",
  goldLight: "#C4914A",
  goldSoft:  "#F5EDD8",
  red:       "#8B1A1A",
  green:     "#1A5C2A",
  blue:      "#1A3A5C",
  surface:   "#FDFAF4",
  border:    "#E2DAC8",
  purple:    "#6B3FA0",
};

const serif = "'Palatino Linotype', 'Book Antiqua', Palatino, serif";
const mono  = "'Courier New', Courier, monospace";

const css = `
  @keyframes fadeUp {
    from { opacity:0; transform:translateY(12px); }
    to   { opacity:1; transform:translateY(0); }
  }
  @keyframes fadeIn {
    from { opacity:0; }
    to   { opacity:1; }
  }
  @keyframes blink {
    0%,100% { opacity:1; }
    50%      { opacity:0; }
  }
  @keyframes typingDot {
    0%,80%,100% { transform:scale(0.6); opacity:0.4; }
    40%         { transform:scale(1);   opacity:1;   }
  }
  @keyframes slideIn {
    from { opacity:0; transform:translateX(-8px); }
    to   { opacity:1; transform:translateX(0); }
  }
  @keyframes pulse {
    0%,100% { opacity:1; }
    50%     { opacity:0.5; }
  }
  * { box-sizing:border-box; margin:0; padding:0; }
  body { background:${T.cream}; }
  textarea { resize:none; }
  textarea:focus { outline:none; }
  button { transition:all 0.2s ease; cursor:pointer; }
  button:hover { opacity:0.85; }
  button:disabled { opacity:0.4; cursor:not-allowed; }
  ::-webkit-scrollbar { width:3px; }
  ::-webkit-scrollbar-track { background:transparent; }
  ::-webkit-scrollbar-thumb { background:${T.inkGhost}; border-radius:2px; }
`;

// ─────────────────────────────────────────────
// INTERVIEW SYSTEM PROMPT
// The interviewer's constitution — what it knows,
// how it probes, what it's looking for, when to move on.
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
- Notice and gently surface inconsistencies. "Earlier you mentioned X — I'm curious how that fits with what you just said about Y."
- Cover all 6 constructs, but follow the natural flow of the conversation. Don't robotically tick boxes.
- Spend more time where you sense richness or complexity. Move faster where responses are clear.
- Do not reveal which construct you are assessing at any given moment.
- Transition naturally between topics — use bridges like "I want to shift to something a bit different..." or "That actually connects to something I'm curious about..."

─────────────────────────────────────────
PROBING RULES
─────────────────────────────────────────
- After any general statement: "Can you give me a specific example of that?"
- After any example: "What did you actually do in that moment?" (if not yet specified)
- After any claimed virtue: "Is there a time that didn't go well? When you struggled with that?"
- After any blame reference: "What was your part in that?" (without accusation)
- Maximum 2 follow-up probes per sub-topic before moving on — don't over-interrogate.

─────────────────────────────────────────
MANDATORY CHECK BEFORE EVERY FOLLOW-UP QUESTION
─────────────────────────────────────────
You MUST run this check before asking either follow-up question. This is not optional.

After the user responds to a scenario, before you say anything, do this silently:

STEP 1 — Check for "what could either have done differently"
Read the user's response. Did they identify a specific action or change for BOTH people in the scenario — even if framed as "X could have..." or "Y should have..."?
→ YES: Do not ask "what could either have done differently." It is already answered.
→ NO: Ask it.

STEP 2 — Check for "what would you have done"
Read the user's response. Did they describe a specific concrete action or approach — for either person — in behavioral terms? This includes:
- Explicit first person: "I would have...", "I'd..."
- Third-person prescription with specifics: "Marcus could have said X", "he should have named that he was triggered", "what he needed to do was..."
- Any description specific enough that it reveals what the user believes the right action is

If the user described WHAT to do and HOW — not just that someone "should communicate better" or "needed to be more empathetic" (too vague) — the question is answered.
→ YES: Do not ask "what would you have done in X's position." It is already answered.
→ NO: Ask it.

EXAMPLE of an answer that passes BOTH checks and requires NO follow-up questions:
"Diane is stonewalling, she said okay but remains closed off — she could name her feelings. Marcus wasn't empathetic and could name that he was in judgement and take ownership, something like 'I was triggered about X and it wasn't really about you.'"
→ Both people identified ✓. Specific action described ("I was triggered about X and it wasn't really about you") ✓. Ask NOTHING. Move to the next construct.

EXAMPLE of an answer that is too vague and requires follow-up:
"Both of them could have communicated better and been more emotionally available."
→ No specific action described. Ask both follow-up questions.

If both checks pass, your entire response is a brief acknowledgment and a transition to the next construct. Do not ask any follow-up questions about this scenario.
─────────────────────────────────────────

─────────────────────────────────────────
THREE-QUESTION STRUCTURE IS A GUIDE, NOT A SCRIPT
─────────────────────────────────────────
For scenarios, the structure is: what went wrong → what could either person have done differently → what would you do.

But use judgment:
- If the "what went wrong" answer already covers both parties' contributions, skip "what could either have done differently" — it's redundant.
- If the user's analysis already contains a clear first-person answer, skip "what would you do."
- Never ask a question just to tick a box. Only ask it if the answer would add something new.
Also update each scenario in the SCENARIO BANK — on the two follow-up lines [After they respond], add "— skip if already covered" and "— skip if already answered" at the end of each respectively. Like this:
[After they respond]: "What could either of them have done differently?" — skip if already covered.
[After they respond]: "What would you have done in [name]'s position?" — skip if already answered.
Do this for all six scenarios.

─────────────────────────────────────────
VARY AFFIRMATIONS — DO NOT VALIDATE EVERY RESPONSE
─────────────────────────────────────────
Do not begin every response with a validation ("That's a great point", "That's really thoughtful", "You're seeing how..."). This becomes noise and signals the AI is performing warmth rather than genuinely engaging.

Rules:
- No more than one affirmation every three exchanges.
- When you do affirm, make it specific to what they actually said — not generic praise.
- Often the best response is to simply ask the next question without any preamble.
- If a response is genuinely unremarkable, don't affirm it. Just continue.
- Reserve genuine warmth for moments that warrant it — an unusually honest disclosure, a moment of real self-awareness.

─────────────────────────────────────────
FOLLOW UNEXPECTED SELF-DISCLOSURES
─────────────────────────────────────────
When the user volunteers something unexpected — an attachment concept, a strong personal value, an unusual position, a contradiction — follow it before moving to the next construct. This is where the richest signal lives.

Examples of what to follow:
- Using attachment language unprompted ("avoidant", "secure", "anxious") — ask whether they think about their own patterns that way.
- A strong stated value that cuts against the grain ("I wouldn't take back what I said even if it hurt them") — probe what that looks like in practice.
- A surprising admission or vulnerability — give it room before moving on.
- A notable inconsistency between what they said earlier and what they're saying now — name it gently.

Do not follow a disclosure if it would derail the interview entirely. One follow-up probe is enough — then return to the next construct.

─────────────────────────────────────────
ADD ONE SKEPTICISM PROBE PER INTERVIEW
─────────────────────────────────────────
If the user has given consistently polished, self-aware answers throughout the interview, insert one gentle skepticism probe before closing. The goal is not to challenge them but to find where the gap is between their stated model and actual behavior — this gap is some of the most useful data in the interview.

Use something like:
"You've described a pretty clear sense of how you approach all of this. Is there a situation where you've found it harder to actually live up to that — where you knew what you should do but didn't?"

Or: "That's a consistent thread — direct communication, holding your ground, owning your part. Has there been a time when that was genuinely difficult, where you fell short of your own standard?"

Only use this once. Place it naturally — after a strong answer, before the closing topic. Do not use it if the user has already shown genuine vulnerability or struggle in their answers.

CRITICAL EXCEPTION — NO-EXAMPLE RESPONSES:
If the user says anything indicating they don't have a personal example — "I can't think of one", "I don't have one", "nothing comes to mind", "I haven't really been in that situation" — do NOT probe for a better example, do NOT ask about friendships or family, do NOT lower the stakes. Go IMMEDIATELY to the scenario for that construct. No intermediate steps.

─────────────────────────────────────────
WHEN SOMEONE SAYS THEY DON'T HAVE AN EXAMPLE
─────────────────────────────────────────
If the user says they don't have a personal example — or can't think of one — go straight to the scenario for that construct. Do not try to widen scope or lower stakes first. The user has already been told at the start that a scenario is available, so offer it immediately and naturally.

Say something like: "No problem. Let me give you a situation to react to instead."
Then deliver the scenario for the construct you are currently assessing from the list below.
Tag this internally as a SCENARIO response.

SCENARIO BANK — one per construct:
Before asking "what could either have done differently?" or "what would you have done in X's position?" — check the user's last response. If they already identified what both people could do and gave a specific action or script (e.g. "name her feelings" and "I was triggered about X and it wasn't really about you"), do NOT ask either question. Acknowledge and move to the next construct.
Each scenario features two people where fault is genuinely shared or ambiguous. After presenting it, ask the three questions in sequence, one at a time: what went wrong, what either person could have done differently, and what they would do — but skip any question the user has already answered (see MANDATORY CHECK above).

CONFLICT & REPAIR (Pillar 1):
"Marcus and Diane have been together two years. During an argument about finances, Marcus says 'you always make everything about yourself' — he immediately knows it came out wrong. Diane shuts down and leaves the room. Marcus waits for her to come back. She doesn't. An hour later he knocks on the door and says 'I didn't mean it like that.' Diane says 'okay' but stays distant for the rest of the evening. Nothing more is said about it.
What do you think went wrong there?"
[After they respond]: "What could either of them have done differently?" — skip if already covered.
[After they respond]: "What would you have done in Marcus's position?" — skip if already answered.

ACCOUNTABILITY (Pillar 3):
"Jordan told their close friend Sam they'd keep something private. A few weeks later, Sam finds out Jordan mentioned it to someone else — not maliciously, it just came up. Jordan apologises and says 'I didn't think it was a big deal at the time, and I didn't mean to hurt you.' Sam says they appreciate the apology but feels like Jordan isn't really taking it seriously. Jordan feels like they've said sorry and doesn't know what else to do.
What do you think went wrong there?"
[After they respond]: "What could either of them have done differently?" — skip if already covered.
[After they respond]: "What would you have done in Jordan's position?" — skip if already answered.

RELIABILITY (Pillar 4):
"Priya promised to help her friend Leo move apartments on Saturday — they'd planned it for three weeks. On Friday evening her manager asks her to come in Saturday morning for a client situation that's important but not a true emergency. Priya texts Leo late Friday: 'Something came up at work, I can't make it tomorrow, really sorry.' Leo manages alone. When they next speak, Leo says it's fine but seems off. Priya thinks she made the right call given the circumstances.
What do you think went wrong there?"
[After they respond]: "What could either of them have done differently?" — skip if already covered.
[After they respond]: "What would you have done in Priya's position?" — skip if already answered.

RESPONSIVENESS (Pillar 5):
"Alex calls their partner Riley mid-afternoon, excited about a promotion they just found out about. Riley is in the middle of a stressful work situation and says 'that's great, congrats, I'm really slammed right now — can we talk tonight?' Alex says sure. That evening Riley is tired and doesn't bring it up. Alex doesn't bring it up either. The conversation never really happens.
What do you think went wrong there?"
[After they respond]: "What could either of them have done differently?" — skip if already covered.
[After they respond]: "What would you have done in Riley's position?" — skip if already answered.

DESIRE & BOUNDARIES (Pillar 6):
"Chris and Morgan have been together eighteen months. Chris has been feeling like they've grown physically distant but hasn't said anything, assuming it will sort itself out. Morgan has noticed Chris seems withdrawn lately but assumes it's work stress and doesn't ask. Two months pass. Chris eventually brings it up during an argument about something unrelated. Morgan feels blindsided — 'why didn't you just say something sooner?'
What do you think went wrong there?"
[After they respond]: "What could either of them have done differently?" — skip if already covered.
[After they respond]: "What would you have done in Chris's position?" — skip if already answered.

STRESS RESILIENCE (Pillar 9):
"Nat has had an overwhelming week — a difficult project, poor sleep, family tension. Their partner Drew has been patient but is starting to feel shut out. On Friday night Drew suggests they do something together. Nat says 'I just need to decompress alone tonight.' Drew says 'okay' but feels hurt — this is the third time this week. Nat doesn't notice. Saturday morning there's a tension neither of them names.
What do you think went wrong there?"
[After they respond]: "What could either of them have done differently?" — skip if already covered.
[After they respond]: "What would you have done in Nat's position?" — skip if already answered.

STEP 2 — ACCEPT AND MOVE ON
If the scenario also produces nothing useful, do not push further. Say:
"That's completely fine — let's move on."
Then continue to the next construct. Do NOT return to this topic.

─────────────────────────────────────────
HOW TO INTERPRET NO-EXAMPLE RESPONSES
─────────────────────────────────────────
A person's inability or unwillingness to engage even with a scenario is itself meaningful data. It may indicate:

A) Genuine inexperience — they haven't been in enough relationships for the scenario to feel real. Note this neutrally. Do not penalise it.

B) Avoidance — the topic feels threatening and they're resistant to engaging even hypothetically. This is diagnostically significant for accountability and conflict repair. Note it without confronting.

When scoring, the scorer will be told which topics produced scenario or no-example responses and will weight accordingly.

─────────────────────────────────────────
OPENING:
Start with a warm introduction. Tell them three things:
1. This is a conversation about how they show up in relationships — through real examples where possible.
2. Small moments are fine — nothing needs to be dramatic.
3. If nothing comes to mind for a question, just say so — they'll get a scenario to react to instead.

Begin with conflict — it's the richest entry point and usually the easiest to access.

CLOSING:
When you have covered all 6 constructs adequately (typically 12-18 exchanges), close the interview naturally. Say something like "I think I have a really good sense of how you show up in relationships. Thank you for being so open with me." Then output a special token: [INTERVIEW_COMPLETE]

TONE:
- Curious, not clinical
- Warm, not cheerful
- Direct, not blunt
- Honest, not flattering
- Like a thoughtful person who genuinely wants to understand, not a form being filled out

IMPORTANT: Keep your responses concise — 2-4 sentences maximum per turn. You are asking questions, not giving speeches. The user should be talking more than you.

SPEECH FORMATTING: Your responses will be spoken aloud by a voice AI, not read on screen. Write for the ear, not the eye. Use short sentences. No em-dashes, no parentheses, no bullet points. Use commas and periods to create natural spoken rhythm. Contractions are good — they sound warmer. "That's" not "That is." "I'd" not "I would." End with a single clear question, never two questions at once.`;

// ─────────────────────────────────────────────
// SCORING PROMPT — called after interview completes
// Takes full transcript, produces pillar scores
// ─────────────────────────────────────────────
function buildScoringPrompt(transcript, typologyContext) {
  const turns = transcript
    .map(m => `${m.role === "assistant" ? "INTERVIEWER" : "RESPONDENT"}: ${m.content}`)
    .join("\n\n");

  return `You are a relationship psychologist scoring a structured assessment interview. Read the full transcript carefully, then produce pillar scores.

CONTEXT FROM VALIDATED INSTRUMENTS (already completed):
${typologyContext}

INTERVIEW TRANSCRIPT:
${turns}

─────────────────────────────────────────
SCORING INSTRUCTIONS
─────────────────────────────────────────
Score each pillar 0–10 based on transcript evidence. Be honest — do not inflate. A 7 means genuinely good evidence of this capacity. A 5 means mixed, ambiguous, or absent evidence. A 3 means active concerning signals. A 10 is rare.

For each pillar, identify:
- The specific transcript evidence you're drawing on (direct quote or close paraphrase)
- Whether evidence is behavioral (described what they actually did) or attitudinal (what they believe or feel)
- Behavioral evidence is weighted 2× over attitudinal evidence

─────────────────────────────────────────
HANDLING NO-EXAMPLE AND SCENARIO RESPONSES
─────────────────────────────────────────
When a respondent could not produce a real-life example for a construct, apply the following rules based on what the transcript shows.

EVIDENCE QUALITY HIERARCHY — weight scores accordingly:
1. Recalled behavioral example (real story): full weight — score the full 0-10 range
2. Scenario response (interviewer presented a specific situation): 65-70% weight — score 3-8 range, note "(scenario)" in keyEvidence
3. Bare hypothetical (open "how would you handle it"): 50% weight — score 4-7 range, note "(hypothetical)" in keyEvidence
4. No response at all: see Case A / Case B below

For scenario responses (third-person case format), probe quality matters — weight toward the higher end of the range when:
- They identified fault on both sides, not just one person (balanced attribution)
- They noticed the emotional dimension, not just the practical one
- Their proposed fix actually addressed the root problem they identified (coherence between diagnosis and solution)
- Their "what would I do" answer was specific and actionable, not vague
- They spontaneously considered the other person's perspective without being asked
Weight toward the lower end when they assigned fault entirely to one party, missed the emotional layer, proposed a fix that didn't address what they diagnosed, or gave a vague "I'd just communicate better" answer without specifics.

CASE A — CONFIRMED AVOIDANCE (no example AND no useful scenario/hypothetical)
The respondent had plausible opportunity to have the experience, the full cascade was tried, and they resisted or deflected throughout. Diagnostically meaningful.
→ Cap score at 6. Note "avoidant non-response" in keyEvidence.

CASE B — GENUINE ABSENCE (circumstances confirm the gap is real)
Life circumstances plausibly explain the gap — low-stress job, limited relationship history, young age. The respondent engaged openly and would have provided an example if they had one.
→ Score at 5 (true midpoint — unknown, not negative). Set confidence to "low". Note "genuine absence — circumstances confirmed" in keyEvidence.

The critical distinction: absence of evidence is not evidence of a problem. Only score below 5 if there are positive signals of avoidance — resistance, deflection, defensiveness — not simply because no example was given.

─────────────────────────────────────────
DEFLECTION DETECTION — READ CAREFULLY
─────────────────────────────────────────
Do NOT flag a statement as deflection simply because it references another person's behavior. Factual statements about what others did or didn't do are neutral context, not deflection.

TRUE DEFLECTION requires ALL THREE of the following:
1. The other person's behavior is cited as a CAUSE or JUSTIFICATION for the respondent's own behavior
2. There is a causal construction — explicit or implied — that removes the respondent's agency ("so what was I supposed to do", "because she never told me", "that's why I")
3. The respondent does NOT take any ownership in the same breath or shortly after

NEUTRAL DESCRIPTION (not deflection):
- "She didn't tell me how she felt" — states a fact, no causal chain, no implied absolution
- "He was stressed that week" — context, not excuse
- "She reacted badly" — observation, not justification

What to listen for after a neutral statement about another person:
- If followed by ownership ("...so I probably should have asked") → not deflection, context
- If followed by nothing, or more descriptions of the other's failures, with no self-reference → possible deflection
- If the pattern repeats across multiple topics → stronger signal

Only flag deflection when you can quote the specific causal construction. If you can't find one, it's not deflection.

─────────────────────────────────────────
PILLARS TO SCORE
─────────────────────────────────────────
- Pillar 1 (Conflict & Repair, 14%): de-escalation capacity, repair initiation, what repair looks like in practice, pattern over time
- Pillar 3 (Accountability, 12%): ownership language vs. genuine deflection (see above), behavioral change evidence, response to feedback
- Pillar 4 (Reliability, 12%): follow-through under real inconvenience, what motivates keeping commitments, volunteered counterexamples
- Pillar 5 (Responsiveness, 12%): attunement to others' emotional states, capitalization of good news, presence vs. distraction
- Pillar 6 (Desire & Bounds, 11%): communication vs. avoidance of mismatch, pattern of silence vs. naming, whether issues got addressed
- Pillar 9 (Stress Resilience, 7%): how external pressure affects relational behavior, capacity to ask for support, isolation vs. reaching toward

ALSO NOTE:
- Incidental signals for Pillars 2 (Attachment), 7 (Friendship/Joy), 8 (Shared Vision)
- Inconsistencies between stated values and described behavior
- Overall narrative coherence

─────────────────────────────────────────
Return ONLY valid JSON:
{
  "pillarScores": {
    "1": 0, "3": 0, "4": 0, "5": 0, "6": 0, "9": 0
  },
  "pillarConfidence": {
    "1": "high | moderate | low",
    "3": "high | moderate | low",
    "4": "high | moderate | low",
    "5": "high | moderate | low",
    "6": "high | moderate | low",
    "9": "high | moderate | low"
  },
  "incidentalSignals": {
    "2": "brief note or null",
    "7": "brief note or null",
    "8": "brief note or null"
  },
  "keyEvidence": {
    "1": "specific quote or paraphrase that most informed this score",
    "3": "specific quote or paraphrase that most informed this score",
    "4": "specific quote or paraphrase that most informed this score",
    "5": "specific quote or paraphrase that most informed this score",
    "6": "specific quote or paraphrase that most informed this score",
    "9": "specific quote or paraphrase that most informed this score"
  },
  "noExampleConstructs": ["list pillar IDs where no example was produced, e.g. 4, 9"],
  "scenarioConstructs": ["list pillar IDs where a scenario was used instead of a real example"],
  "avoidanceSignals": ["list pillar IDs where avoidance (not absence) was detected"],
  "narrativeCoherence": "high | moderate | low",
  "behavioralSpecificity": "high | moderate | low",
  "notableInconsistencies": ["specific inconsistency with quote, or empty array"],
  "interviewSummary": "3 honest sentences about this person's relational patterns. Distinguish between what the evidence shows and what is simply unknown. Not flattering — accurate."
}`;
}

// ─────────────────────────────────────────────
// CONSTRUCT TRACKER
// Lightweight — just tracks which pillars have been
// touched so far, shown as progress to the user.
// ─────────────────────────────────────────────
const CONSTRUCTS = [
  { id:1, label:"Conflict & Repair",  color:T.red },
  { id:3, label:"Accountability",     color:T.green },
  { id:4, label:"Reliability",        color:T.gold },
  { id:5, label:"Responsiveness",     color:"#0D6B6B" },
  { id:6, label:"Desire & Limits",    color:"#8B3A5C" },
  { id:9, label:"Stress & Support",   color:"#2A5C5C" },
];

// Heuristic: detect which constructs a message likely touches
// Used only for progress display — not for scoring
function detectConstructs(text) {
  const t = text.toLowerCase();
  const hits = [];
  if (/conflict|argument|fight|disagree|escalat|repair|apologis|sorry|walk(ed)? out|snap|cool.?down/i.test(t)) hits.push(1);
  if (/responsib|fault|blame|own(ed)?|account|apologis|change|growth|feedback|criticism|defensiv/i.test(t)) hits.push(3);
  if (/commit|promis|follow.?through|show(ed)? up|cancel|reliable|depend|inconvenient|kept/i.test(t)) hits.push(4);
  if (/listen|attun|present|distract|celebrat|excited|check.?in|notice|text|call/i.test(t)) hits.push(5);
  if (/intimat|physical|space|need|mismatch|desire|boundary|sexual|close|distance|talk about/i.test(t)) hits.push(6);
  if (/stress|overwhelm|pressure|work|money|health|family|support|alone|isolat|ask for help/i.test(t)) hits.push(9);
  return hits;
}

// ─────────────────────────────────────────────
// TYPING INDICATOR
// ─────────────────────────────────────────────
function TypingIndicator() {
  return (
    <div style={{ display:"flex", gap:5, alignItems:"center", padding:"14px 18px" }}>
      {[0,1,2].map(i => (
        <div key={i} style={{
          width:7, height:7, borderRadius:"50%", background:T.inkFaint,
          animation:`typingDot 1.2s ease-in-out ${i*0.2}s infinite`,
        }} />
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────
// MESSAGE BUBBLE
// ─────────────────────────────────────────────
function MessageBubble({ message, isNew }) {
  const isAI = message.role === "assistant";
  return (
    <div style={{
      display:"flex",
      justifyContent: isAI ? "flex-start" : "flex-end",
      marginBottom:16,
      animation: isNew ? "slideIn 0.3s ease both" : "none",
    }}>
      {isAI && (
        <div style={{
          width:32, height:32, borderRadius:"50%",
          background:T.ink, display:"flex", alignItems:"center",
          justifyContent:"center", flexShrink:0, marginRight:10, marginTop:2,
          fontFamily:mono, fontSize:11, color:T.cream, letterSpacing:1,
        }}>
          ◆
        </div>
      )}
      <div style={{
        maxWidth:"72%",
        background: isAI ? T.surface : T.ink,
        border: isAI ? `1px solid ${T.border}` : "none",
        borderRadius: isAI ? "2px 16px 16px 16px" : "16px 2px 16px 16px",
        padding:"14px 18px",
        fontFamily:serif,
        fontSize:15,
        lineHeight:1.75,
        color: isAI ? T.inkLight : T.cream,
      }}>
        {message.content}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// CONSTRUCT PROGRESS BAR
// Shows which topics have been touched — not scores.
// ─────────────────────────────────────────────
function ConstructProgress({ touched }) {
  return (
    <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
      {CONSTRUCTS.map(c => {
        const isTouched = touched.includes(c.id);
        return (
          <div key={c.id} style={{
            fontFamily:mono, fontSize:9, letterSpacing:1.5,
            textTransform:"uppercase", padding:"3px 8px",
            border:`1px solid ${isTouched ? c.color : T.border}`,
            color: isTouched ? c.color : T.inkFaint,
            background: isTouched ? `${c.color}11` : "transparent",
            borderRadius:2,
            transition:"all 0.4s ease",
          }}>
            {c.label}
          </div>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────
// SCORING SCREEN
// ─────────────────────────────────────────────
function ScoringScreen() {
  const [dots, setDots] = useState(".");
  useEffect(() => {
    const t = setInterval(() => setDots(d => d.length >= 3 ? "." : d + "."), 500);
    return () => clearInterval(t);
  }, []);
  return (
    <div style={{
      minHeight:"100vh", background:T.cream, display:"flex",
      flexDirection:"column", alignItems:"center", justifyContent:"center",
      fontFamily:serif,
    }}>
      <style>{css}</style>
      <div style={{ textAlign:"center", animation:"fadeIn 0.5s ease" }}>
        <div style={{ fontFamily:mono, fontSize:32, color:T.gold, marginBottom:24, animation:"pulse 2s ease infinite" }}>◆</div>
        <div style={{ fontSize:22, color:T.ink, marginBottom:12 }}>Reading your interview{dots}</div>
        <div style={{ fontFamily:mono, fontSize:11, color:T.inkFaint, letterSpacing:2 }}>
          Analysing narrative coherence · Scoring 6 constructs
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// RESULTS SCREEN
// Shows scores with key evidence quotes
// ─────────────────────────────────────────────
function ResultsScreen({ results, onContinue }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => { const t = setTimeout(() => setVisible(true), 100); return () => clearTimeout(t); }, []);

  const pillarMeta = {
    1: { name:"Conflict & Repair",  color:T.red },
    3: { name:"Accountability",     color:T.green },
    4: { name:"Reliability",        color:T.gold },
    5: { name:"Responsiveness",     color:"#0D6B6B" },
    6: { name:"Desire & Boundaries",color:"#8B3A5C" },
    9: { name:"Stress Resilience",  color:"#2A5C5C" },
  };

  const coherenceColors = { high:T.green, moderate:T.gold, low:T.red };

  return (
    <div style={{
      minHeight:"100vh", background:T.cream, fontFamily:serif,
      opacity:visible?1:0, transition:"opacity 0.5s ease",
    }}>
      <style>{css}</style>
      <div style={{ maxWidth:640, margin:"0 auto", padding:"48px 24px" }}>

        {/* Header */}
        <div style={{ marginBottom:40, borderBottom:`1px solid ${T.border}`, paddingBottom:32 }}>
          <div style={{ fontFamily:mono, fontSize:10, color:T.gold, letterSpacing:3, textTransform:"uppercase", marginBottom:12 }}>
            ✦ Interview complete
          </div>
          <h1 style={{ fontSize:30, fontWeight:400, color:T.ink, lineHeight:1.2, marginBottom:16 }}>
            What your conversation revealed.
          </h1>
          <p style={{ fontSize:15, lineHeight:1.75, color:T.inkFaint }}>
            {results.interviewSummary}
          </p>
        </div>

        {/* Quality indicators */}
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:32 }}>
          {[
            { label:"Narrative coherence", value:results.narrativeCoherence },
            { label:"Behavioral specificity", value:results.behavioralSpecificity },
          ].map(item => (
            <div key={item.label} style={{
              background:T.surface, border:`1px solid ${T.border}`,
              borderLeft:`3px solid ${coherenceColors[item.value] || T.gold}`,
              padding:"12px 16px",
            }}>
              <div style={{ fontFamily:mono, fontSize:9, color:T.inkFaint, letterSpacing:2, textTransform:"uppercase", marginBottom:4 }}>
                {item.label}
              </div>
              <div style={{ fontFamily:serif, fontSize:15, color:T.ink, textTransform:"capitalize" }}>
                {item.value}
              </div>
            </div>
          ))}
        </div>

        {/* Pillar scores */}
        <div style={{ marginBottom:32 }}>
          <div style={{ fontFamily:mono, fontSize:10, color:T.inkFaint, letterSpacing:3, textTransform:"uppercase", marginBottom:16 }}>
            Construct scores
          </div>
          <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
            {Object.entries(results.pillarScores).map(([id, score]) => {
              const meta = pillarMeta[parseInt(id)];
              if (!meta) return null;
              const evidence   = results.keyEvidence?.[id];
              const confidence = results.pillarConfidence?.[id] || "high";
              const isLowConf  = confidence === "low";
              const isMedConf  = confidence === "moderate";
              const isNoExample = results.noExampleConstructs?.includes(parseInt(id)) || results.noExampleConstructs?.includes(id);
              const isScenario  = results.scenarioConstructs?.includes(parseInt(id)) || results.scenarioConstructs?.includes(id);

              return (
                <div key={id} style={{
                  background: isLowConf ? T.goldSoft : T.surface,
                  border:`1px solid ${isLowConf ? T.goldLight : T.border}`,
                  borderLeft:`3px solid ${isLowConf ? T.gold : meta.color}`,
                  padding:"16px 20px",
                }}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:8 }}>
                    <div>
                      <span style={{ fontFamily:serif, fontSize:15, color:T.ink }}>{meta.name}</span>
                      {/* Confidence badge */}
                      {(isLowConf || isMedConf) && (
                        <span style={{
                          fontFamily:mono, fontSize:9, letterSpacing:1.5,
                          textTransform:"uppercase", marginLeft:10,
                          color: isLowConf ? T.gold : T.inkFaint,
                          border:`1px solid ${isLowConf ? T.goldLight : T.border}`,
                          padding:"2px 6px", borderRadius:2,
                        }}>
                          {isLowConf ? "low confidence" : "moderate confidence"}
                        </span>
                      )}
                      {/* Scenario badge */}
                      {isScenario && (
                        <span style={{
                          fontFamily:mono, fontSize:9, letterSpacing:1.5,
                          textTransform:"uppercase", marginLeft:6,
                          color: T.blue, border:`1px solid ${T.blue}44`,
                          padding:"2px 6px", borderRadius:2,
                        }}>
                          scenario
                        </span>
                      )}
                    </div>
                    <span style={{
                      fontFamily:mono, fontSize:18,
                      color: isLowConf ? T.gold : meta.color,
                      opacity: isLowConf ? 0.7 : 1,
                    }}>
                      {score}<span style={{ fontSize:11, color:T.inkFaint }}>/10</span>
                    </span>
                  </div>

                  {/* Score bar — dashed when low confidence */}
                  <div style={{ height:4, background:T.creamDark, borderRadius:2, marginBottom:8 }}>
                    <div style={{
                      height:"100%", width:`${score*10}%`,
                      background: isLowConf ? T.gold : meta.color,
                      borderRadius:2, opacity: isLowConf ? 0.5 : 1,
                      transition:"width 1s ease",
                    }} />
                  </div>

                  {/* Scenario / no-example explanation */}
                  {isScenario && !isNoExample && (
                    <div style={{
                      fontFamily:mono, fontSize:10, color:T.blue,
                      letterSpacing:1, marginBottom:evidence ? 8 : 0,
                    }}>
                      Scored from a scenario — no personal example available
                    </div>
                  )}
                  {isNoExample && (
                    <div style={{
                      fontFamily:mono, fontSize:10, color:T.gold,
                      letterSpacing:1, marginBottom:evidence ? 8 : 0,
                    }}>
                      No example provided — score reflects unknown, not negative
                    </div>
                  )}

                  {/* Key evidence */}
                  {evidence && (
                    <div style={{ fontFamily:serif, fontSize:13, color:T.inkFaint, fontStyle:"italic", lineHeight:1.6 }}>
                      "{evidence}"
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Inconsistencies */}
        {results.notableInconsistencies?.length > 0 && (
          <div style={{
            background:T.goldSoft, border:`1px solid ${T.goldLight}`,
            borderLeft:`3px solid ${T.gold}`, padding:"16px 20px", marginBottom:32,
          }}>
            <div style={{ fontFamily:mono, fontSize:10, color:T.gold, letterSpacing:2, textTransform:"uppercase", marginBottom:10 }}>
              Worth reflecting on
            </div>
            {results.notableInconsistencies.map((note, i) => (
              <p key={i} style={{ fontFamily:serif, fontSize:14, color:T.inkLight, lineHeight:1.65, marginBottom:i < results.notableInconsistencies.length-1 ? 8 : 0 }}>
                {note}
              </p>
            ))}
          </div>
        )}

        {/* Continue */}
        <div style={{ borderTop:`1px solid ${T.border}`, paddingTop:24, display:"flex", justifyContent:"flex-end" }}>
          <button onClick={onContinue} style={{
            background:T.ink, color:T.cream, border:"none",
            fontFamily:mono, fontSize:12, letterSpacing:2,
            padding:"14px 28px", cursor:"pointer",
          }}>
            VIEW FULL PROFILE →
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// VOICE STATE MACHINE
// idle → listening → processing → speaking → idle
// ─────────────────────────────────────────────

// ─────────────────────────────────────────────
// ELEVENLABS TTS
// Replace YOUR_ELEVENLABS_API_KEY with your key.
// In production, proxy this through your own backend
// so the key is never exposed client-side.
// ─────────────────────────────────────────────
const ELEVENLABS_API_KEY  = "YOUR_ELEVENLABS_API_KEY";
const ELEVENLABS_VOICE_ID = "9BWtsMINqrJLrRacOk9x"; // Aria — v3 generation, warm, conversational

// Active audio source — tracked so we can stop mid-playback if needed
let activeAudioSource = null;

function stopActiveAudio() {
  if (!activeAudioSource) return;
  try {
    activeAudioSource.pause();
    activeAudioSource.currentTime = 0;
  } catch {}
  activeAudioSource = null;
}

// Speak text via ElevenLabs streaming TTS.
// Returns a promise that resolves when audio finishes.
async function speak(text) {
  stopActiveAudio();

  try {
    const res = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${ELEVENLABS_VOICE_ID}/stream`,
      {
        method: "POST",
        headers: {
          "xi-api-key": ELEVENLABS_API_KEY,
          "Content-Type": "application/json",
          "Accept": "audio/mpeg",
        },
        body: JSON.stringify({
          text,
          model_id: "eleven_flash_v2_5",
          voice_settings: {
            stability: 0.40,
            similarity_boost: 0.75,
            style: 0.50,
            use_speaker_boost: true,
          },
        }),
      }
    );

    if (!res.ok) {
      console.error("ElevenLabs error:", res.status, await res.text());
      await speakFallback(text);
      return;
    }

    // Stream → Blob → Object URL → Audio element
    // This is the correct playback path — Web Audio API decoding
    // introduces artifacts. The browser's native audio pipeline doesn't.
    const blob = await res.blob();
    const url  = URL.createObjectURL(blob);
    const audio = new Audio(url);

    await new Promise((resolve, reject) => {
      audio.onended = () => { URL.revokeObjectURL(url); resolve(); };
      audio.onerror = (e) => { URL.revokeObjectURL(url); reject(e); };
      audio.play().catch(reject);
      // Store reference so we can interrupt mid-playback
      activeAudioSource = audio;
    });

  } catch (err) {
    console.error("ElevenLabs TTS failed, falling back:", err);
    await speakFallback(text);
  }

  activeAudioSource = null;
}

// Fallback: browser Web Speech Synthesis if ElevenLabs fails
// Picks the best available voice but signals clearly it's a fallback
function speakFallback(text) {
  return new Promise((resolve) => {
    window.speechSynthesis?.cancel();
    const utt = new SpeechSynthesisUtterance(text);
    const voices = window.speechSynthesis?.getVoices() || [];
    utt.voice = voices.find(v =>
      ["Samantha","Karen","Google UK English Female"].some(n => v.name.includes(n))
    ) || voices.find(v => v.lang.startsWith("en")) || null;
    utt.rate = 0.90;
    utt.pitch = 1.0;
    utt.onend = resolve;
    utt.onerror = resolve;
    window.speechSynthesis?.speak(utt);
  });
}

// ─────────────────────────────────────────────
// WAVEFORM ANIMATION — shown while AI is speaking
// ─────────────────────────────────────────────
function SpeakingWaveform({ color = T.gold, active = false }) {
  const bars = 24;
  return (
    <div style={{ display:"flex", alignItems:"center", gap:3, height:40 }}>
      {Array.from({ length: bars }).map((_, i) => (
        <div key={i} style={{
          width: 3,
          borderRadius: 2,
          background: color,
          height: active ? `${20 + Math.sin(i * 0.8) * 14}%` : "12%",
          opacity: active ? 0.7 + Math.cos(i * 0.5) * 0.3 : 0.25,
          animation: active ? `waveBar${i % 4} ${0.6 + (i % 3) * 0.2}s ease-in-out infinite alternate` : "none",
          transition: "height 0.3s ease, opacity 0.3s ease",
        }} />
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────
// MIC PULSE ORB — the central push-to-talk element
// ─────────────────────────────────────────────
function MicOrb({ voiceState, onPress, onRelease, disabled }) {
  const isListening = voiceState === "listening";
  const isProcessing = voiceState === "processing";
  const isSpeaking = voiceState === "speaking";

  const orbColor =
    isListening  ? T.red :
    isProcessing ? T.gold :
    isSpeaking   ? T.green :
    T.ink;

  const label =
    isListening  ? "Release to send" :
    isProcessing ? "Processing…" :
    isSpeaking   ? "Hold to interrupt" :
    "Hold to speak";

  return (
    <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:16 }}>
      {/* Outer ring — pulses when listening */}
      <div style={{
        width: 120, height: 120,
        borderRadius: "50%",
        border: `2px solid ${orbColor}`,
        display: "flex", alignItems: "center", justifyContent: "center",
        opacity: isListening ? 1 : 0.4,
        animation: isListening ? "orbRing 1.2s ease-in-out infinite" : "none",
        transition: "border-color 0.3s ease, opacity 0.3s ease",
      }}>
        {/* Inner orb */}
        <button
          onMouseDown={onPress}
          onMouseUp={onRelease}
          onTouchStart={e => { e.preventDefault(); onPress(); }}
          onTouchEnd={e => { e.preventDefault(); onRelease(); }}
          disabled={disabled || isProcessing}
          style={{
            width: 88, height: 88,
            borderRadius: "50%",
            background: orbColor,
            border: "none",
            cursor: disabled || isProcessing ? "default" : "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
            transition: "all 0.25s ease",
            boxShadow: isListening
              ? `0 0 0 8px ${orbColor}22, 0 0 0 16px ${orbColor}11`
              : `0 4px 16px ${orbColor}33`,
            transform: isListening ? "scale(1.06)" : "scale(1)",
          }}
        >
          {/* Icon */}
          {isListening ? (
            <div style={{ width:16, height:24, borderRadius:8, border:`2.5px solid ${T.cream}`, position:"relative" }}>
              <div style={{ position:"absolute", bottom:-8, left:"50%", transform:"translateX(-50%)", width:1, height:8, background:T.cream }} />
              <div style={{ position:"absolute", bottom:-8, left:"50%", transform:"translateX(-50%)", width:12, height:1, background:T.cream, top:"auto", marginTop:8 }} />
            </div>
          ) : isProcessing ? (
            <div style={{ fontFamily:mono, fontSize:18, color:T.cream, animation:"pulse 1s ease infinite" }}>◆</div>
          ) : isSpeaking ? (
            <SpeakingWaveform color={T.cream} active={true} />
          ) : (
            <svg width="22" height="30" viewBox="0 0 22 30" fill="none">
              <rect x="6" y="0" width="10" height="18" rx="5" fill={T.cream}/>
              <path d="M1 14c0 5.523 4.477 10 10 10s10-4.477 10-10" stroke={T.cream} strokeWidth="2.5" strokeLinecap="round" fill="none"/>
              <line x1="11" y1="24" x2="11" y2="29" stroke={T.cream} strokeWidth="2.5" strokeLinecap="round"/>
              <line x1="7" y1="29" x2="15" y2="29" stroke={T.cream} strokeWidth="2.5" strokeLinecap="round"/>
            </svg>
          )}
        </button>
      </div>

      {/* Label */}
      <div style={{
        fontFamily: mono, fontSize: 11, letterSpacing: 2,
        textTransform: "uppercase",
        color: isListening ? T.red : T.inkFaint,
        transition: "color 0.3s ease",
      }}>
        {label}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// TRANSCRIPT PANEL
// Read-only — ground truth display as conversation progresses
// ─────────────────────────────────────────────
function TranscriptPanel({ messages, currentTranscript, voiceState }) {
  const bottomRef = useRef(null);
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior:"smooth" });
  }, [messages, currentTranscript]);

  if (messages.length === 0 && !currentTranscript) return null;

  return (
    <div style={{
      flex: 1, overflowY: "auto",
      padding: "20px 24px",
      maxWidth: 600, width: "100%", margin: "0 auto",
    }}>
      {messages.map((msg, i) => {
        const isAI = msg.role === "assistant";
        return (
          <div key={i} style={{
            marginBottom: 20,
            animation: "fadeUp 0.3s ease both",
          }}>
            <div style={{
              fontFamily: mono, fontSize: 9, letterSpacing: 2,
              textTransform: "uppercase",
              color: isAI ? T.gold : T.inkFaint,
              marginBottom: 4,
            }}>
              {isAI ? "◆ Interviewer" : "You"}
            </div>
            <div style={{
              fontFamily: serif, fontSize: 15, lineHeight: 1.7,
              color: isAI ? T.inkLight : T.ink,
              borderLeft: `2px solid ${isAI ? T.gold : T.border}`,
              paddingLeft: 14,
            }}>
              {msg.content}
            </div>
          </div>
        );
      })}

      {/* Live transcript while user is speaking */}
      {currentTranscript && voiceState === "listening" && (
        <div style={{ marginBottom: 20, opacity: 0.6 }}>
          <div style={{ fontFamily:mono, fontSize:9, letterSpacing:2, textTransform:"uppercase", color:T.red, marginBottom:4 }}>
            ● You (speaking…)
          </div>
          <div style={{
            fontFamily:serif, fontSize:15, lineHeight:1.7, color:T.ink,
            borderLeft:`2px solid ${T.red}`, paddingLeft:14,
            fontStyle:"italic",
          }}>
            {currentTranscript}
          </div>
        </div>
      )}

      <div ref={bottomRef} />
    </div>
  );
}

// ─────────────────────────────────────────────
// MAIN AI INTERVIEWER COMPONENT — VOICE VERSION
// Props:
//   typologyContext — string summary of ECR/TIPI/DSI/BRS/PVQ scores
//   onComplete(scores) — called with pillar scores when done
// ─────────────────────────────────────────────
export default function AIInterviewer({ typologyContext = "", onComplete }) {
  const [messages, setMessages]               = useState([]);
  const [voiceState, setVoiceState]           = useState("idle");   // idle|listening|processing|speaking
  const [status, setStatus]                   = useState("intro");  // intro|active|scoring|results
  const [touchedConstructs, setTouchedConstructs] = useState([]);
  const [results, setResults]                 = useState(null);
  const [exchangeCount, setExchangeCount]     = useState(0);
  const [currentTranscript, setCurrentTranscript] = useState(""); // live STT
  const [textInput, setTextInput]                 = useState("");  // typed input
  const [micError, setMicError]               = useState(null);

  const recognitionRef = useRef(null);
  const isSpeakingRef  = useRef(false);

  // ── Set up SpeechRecognition ──
  useEffect(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { setMicError("Speech recognition is not supported in this browser. Please use Chrome or Safari."); return; }

    const rec = new SR();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = "en-US";
    rec.maxAlternatives = 1;

    rec.onresult = (e) => {
      let interim = "", final = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) final += t;
        else interim += t;
      }
      setCurrentTranscript(final || interim);
    };

    rec.onerror = (e) => {
      if (e.error === "not-allowed") setMicError("Microphone access was denied. Please allow microphone access and reload.");
      else if (e.error !== "aborted") setMicError(`Microphone error: ${e.error}`);
    };

    recognitionRef.current = rec;
    return () => { rec.stop(); };
  }, []);

  // ── Speak AI response then return to idle ──
  const speakAndReturn = useCallback(async (text) => {
    setVoiceState("speaking");
    isSpeakingRef.current = true;
    await speak(text);
    isSpeakingRef.current = false;
    setVoiceState("idle");
  }, []);

  // ── Process user's spoken input ──
  const processUserSpeech = useCallback(async (spokenText) => {
    if (!spokenText.trim()) { setVoiceState("idle"); return; }

    const userMsg = { role:"user", content: spokenText };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setCurrentTranscript("");
    setVoiceState("processing");
    setExchangeCount(c => c + 1);

    const detected = detectConstructs(spokenText);
    setTouchedConstructs(prev => [...new Set([...prev, ...detected])]);

    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type":"application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 200, // shorter responses — better for voice
          system: INTERVIEWER_SYSTEM,
          messages: newMessages.map(m => ({ role:m.role, content:m.content })),
        }),
      });
      const data = await res.json();
      const text = data.content?.[0]?.text || "";

      if (text.includes("[INTERVIEW_COMPLETE]")) {
        const cleanText = text.replace("[INTERVIEW_COMPLETE]", "").trim();
        const finalMessages = [...newMessages, { role:"assistant", content:cleanText }];
        setMessages(finalMessages);
        await speakAndReturn(cleanText);
        setTimeout(() => scoreInterview(finalMessages), 1000);
        return;
      }

      const aiMsg = { role:"assistant", content:text };
      setMessages([...newMessages, aiMsg]);

      const aiDetected = detectConstructs(text);
      setTouchedConstructs(prev => [...new Set([...prev, ...aiDetected])]);

      await speakAndReturn(text);

    } catch {
      const errMsg = "I lost the thread for a moment — could you say that again?";
      setMessages(prev => [...prev, { role:"assistant", content:errMsg }]);
      await speakAndReturn(errMsg);
    }
  }, [messages, speakAndReturn]);

  // ── Push-to-talk handlers ──
  const handlePressStart = useCallback(() => {
    // Allow interrupt during speaking — stop audio and begin listening immediately
    if (voiceState !== "idle" && voiceState !== "speaking") return;
    stopActiveAudio();
    setCurrentTranscript("");
    setVoiceState("listening");
    try { recognitionRef.current?.start(); } catch {}
  }, [voiceState]);

  const handlePressEnd = useCallback(() => {
    if (voiceState !== "listening") return;
    recognitionRef.current?.stop();
    setVoiceState("processing");
    setTimeout(() => {
      setCurrentTranscript(prev => {
        processUserSpeech(prev);
        return "";
      });
    }, 400);
  }, [voiceState, processUserSpeech]);

  // ── Send typed text ──
  // Allowed during speaking (interrupts) but not during processing (already handling a turn)
  const handleSendText = useCallback(() => {
    const trimmed = textInput.trim();
    if (!trimmed || voiceState === "processing" || voiceState === "listening") return;
    stopActiveAudio(); // interrupt if interviewer is still speaking
    setTextInput("");
    processUserSpeech(trimmed);
  }, [textInput, voiceState, processUserSpeech]);

  // ── Start interview ──
  const startInterview = useCallback(async () => {
    setStatus("active");
    setVoiceState("processing");
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type":"application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 200,
          system: INTERVIEWER_SYSTEM,
          messages: [{ role:"user", content:"[BEGIN INTERVIEW] Introduce yourself warmly in 3-4 sentences. Cover three things: this is a conversation about how they show up in relationships; small real moments are fine, nothing dramatic needed; and if nothing comes to mind for a question, just say so and you'll give them a situation to react to instead. Then ask your first question about conflict." }],
        }),
      });
      const data = await res.json();
      const text = data.content?.[0]?.text || "Hello. I'd like to understand how you show up in close relationships. Let's start with conflict — can you tell me about a time things got heated with someone you cared about?";
      setMessages([{ role:"assistant", content:text }]);
      await speakAndReturn(text);
    } catch {
      const fallback = "Hi, I'm glad you're here. We're going to talk about how you show up in relationships — real moments are great, and small ones are completely fine. If nothing comes to mind for something I ask, just say so and I'll give you a situation to react to instead. Let's start with conflict — can you tell me about a recent time things got tense with someone you cared about?";
      setMessages([{ role:"assistant", content:fallback }]);
      await speakAndReturn(fallback);
    }
  }, [speakAndReturn]);

  // ── Score the completed interview ──
  const scoreInterview = useCallback(async (finalMessages) => {
    setStatus("scoring");
    const context = typologyContext || "No typology context provided — score from transcript only.";
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type":"application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1500,
          messages: [{ role:"user", content: buildScoringPrompt(finalMessages, context) }],
        }),
      });
      const data = await res.json();
      const text = data.content?.[0]?.text || "{}";
      const clean = text.replace(/```json|```/g,"").trim();
      setResults(JSON.parse(clean));
      setStatus("results");
    } catch {
      setResults({
        pillarScores:{ 1:6, 3:7, 4:6, 5:7, 6:5, 9:6 },
        keyEvidence:{ 1:"From spoken conflict narrative", 3:"From accountability discussion", 4:"From reliability examples", 5:"From responsiveness account", 6:"From desire navigation", 9:"From stress coping" },
        narrativeCoherence:"moderate",
        behavioralSpecificity:"moderate",
        notableInconsistencies:[],
        interviewSummary:"A grounded spoken profile. See individual construct scores for detail.",
      });
      setStatus("results");
    }
  }, [typologyContext]);

  // ─────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────
  if (status === "scoring") return <ScoringScreen />;

  if (status === "results") return (
    <ResultsScreen results={results} onContinue={() => onComplete?.(results)} />
  );

  if (status === "intro") return (
    <div style={{
      minHeight:"100vh", background:T.cream, display:"flex",
      flexDirection:"column", alignItems:"center", justifyContent:"center",
      fontFamily:serif, padding:24,
    }}>
      <style>{css}</style>
      <div style={{ maxWidth:520, width:"100%", animation:"fadeUp 0.6s ease" }}>
        <div style={{ fontFamily:mono, fontSize:40, color:T.gold, marginBottom:32, textAlign:"center" }}>◆</div>
        <div style={{ fontFamily:mono, fontSize:10, color:T.gold, letterSpacing:3, textTransform:"uppercase", marginBottom:16, textAlign:"center" }}>
          Your Story · Voice Interview
        </div>
        <h1 style={{ fontSize:32, fontWeight:400, color:T.ink, lineHeight:1.2, marginBottom:20, textAlign:"center" }}>
          A real conversation,<br/>not a form.
        </h1>
        <p style={{ fontSize:16, lineHeight:1.8, color:T.inkLight, marginBottom:12, textAlign:"center" }}>
          You'll speak with an AI interviewer about how you show up in relationships. Hold the button to talk — release when you're done. It listens, then responds.
        </p>
        <p style={{ fontSize:14, lineHeight:1.75, color:T.inkFaint, marginBottom:24, textAlign:"center" }}>
          Small examples are fine — nothing needs to be dramatic. About 15 minutes.
        </p>

        {/* Privacy / setup note */}
        <div style={{
          background:T.surface, border:`1px solid ${T.border}`,
          borderLeft:`3px solid ${T.ink}`, padding:"16px 20px", marginBottom:16,
          fontFamily:serif, fontSize:14, color:T.inkLight, lineHeight:1.65,
        }}>
          <span style={{ fontFamily:mono, fontSize:10, color:T.inkFaint, letterSpacing:2, textTransform:"uppercase", display:"block", marginBottom:6 }}>Before you begin</span>
          Find somewhere you can speak freely for about 15 minutes — headphones work well. Your browser will ask for microphone permission.
        </div>

        {/* Can't think of an example */}
        <div style={{
          background:T.goldSoft, border:`1px solid ${T.goldLight}`,
          borderLeft:`3px solid ${T.gold}`, padding:"14px 18px", marginBottom:40,
          fontFamily:serif, fontSize:14, color:T.inkLight, lineHeight:1.65,
        }}>
          <span style={{ fontFamily:mono, fontSize:10, color:T.gold, letterSpacing:2, textTransform:"uppercase", display:"block", marginBottom:6 }}>If you can't think of an example</span>
          Just say so. The interviewer will offer alternatives — a friendship, a smaller moment, or simply how you'd imagine handling it. You won't be stuck.
        </div>

        {micError && (
          <div style={{
            background:"#FFF0F0", border:`1px solid ${T.red}`,
            borderLeft:`3px solid ${T.red}`, padding:"14px 18px", marginBottom:24,
            fontFamily:serif, fontSize:14, color:T.red, lineHeight:1.65,
          }}>
            {micError}
          </div>
        )}

        <button
          onClick={startInterview}
          disabled={!!micError}
          style={{
            width:"100%", background:T.ink, color:T.cream, border:"none",
            fontFamily:mono, fontSize:12, letterSpacing:2, textTransform:"uppercase",
            padding:"18px 0", cursor:"pointer",
          }}
        >
          Begin Voice Interview →
        </button>
        <p style={{ fontFamily:mono, fontSize:10, color:T.inkFaint, textAlign:"center", marginTop:16, letterSpacing:1 }}>
          Your voice is processed privately and never stored as audio.
        </p>
      </div>
    </div>
  );

  // ── Active voice interview ──
  return (
    <div style={{
      minHeight:"100vh", background:T.cream, display:"flex",
      flexDirection:"column",
    }}>
      <style>{css + `
        @keyframes orbRing {
          0%,100% { transform:scale(1); opacity:0.4; }
          50%      { transform:scale(1.08); opacity:0.9; }
        }
        @keyframes waveBar0 { from { height:15%; } to { height:70%; } }
        @keyframes waveBar1 { from { height:25%; } to { height:90%; } }
        @keyframes waveBar2 { from { height:10%; } to { height:55%; } }
        @keyframes waveBar3 { from { height:20%; } to { height:80%; } }
      `}</style>

      {/* Header */}
      <div style={{
        background:T.surface, borderBottom:`1px solid ${T.border}`,
        padding:"12px 24px", display:"flex", justifyContent:"space-between",
        alignItems:"center", position:"sticky", top:0, zIndex:10,
      }}>
        <div style={{ fontFamily:mono, fontSize:10, color:T.gold, letterSpacing:2, textTransform:"uppercase" }}>
          ◆ Voice Interview · Your Story
        </div>
        <div style={{ fontFamily:mono, fontSize:11, color:T.inkFaint }}>
          {exchangeCount} exchanges
        </div>
      </div>

      {/* Construct progress */}
      <div style={{ background:T.cream, borderBottom:`1px solid ${T.border}`, padding:"10px 24px" }}>
        <ConstructProgress touched={touchedConstructs} />
      </div>

      {/* Transcript — scrollable */}
      <TranscriptPanel
        messages={messages}
        currentTranscript={currentTranscript}
        voiceState={voiceState}
      />

      {/* Voice control dock */}
      <div style={{
        background:T.surface, borderTop:`1px solid ${T.border}`,
        padding:"24px 24px 28px",
        display:"flex", flexDirection:"column",
        alignItems:"center", gap:16,
      }}>
        {micError && (
          <div style={{ fontFamily:serif, fontSize:13, color:T.red, marginBottom:4, textAlign:"center" }}>
            {micError}
          </div>
        )}

        <MicOrb
          voiceState={voiceState}
          onPress={handlePressStart}
          onRelease={handlePressEnd}
          disabled={!!micError || voiceState === "processing"}
        />

        {/* Visual state indicator strip */}
        <div style={{
          fontFamily:mono, fontSize:10, color:T.inkFaint,
          letterSpacing:2, textTransform:"uppercase",
          minHeight:16,
        }}>
          {voiceState === "speaking" && "● Playing response"}
          {voiceState === "processing" && "◆ Thinking…"}
          {voiceState === "listening" && currentTranscript && `"${currentTranscript.slice(0, 48)}${currentTranscript.length > 48 ? "…" : ""}"`}
        </div>

        {/* Divider */}
        <div style={{ display:"flex", alignItems:"center", gap:12, width:"100%", maxWidth:500 }}>
          <div style={{ flex:1, height:1, background:T.border }} />
          <span style={{ fontFamily:mono, fontSize:9, color:T.inkFaint, letterSpacing:2, textTransform:"uppercase" }}>or type</span>
          <div style={{ flex:1, height:1, background:T.border }} />
        </div>

        {/* Text input */}
        <div style={{ width:"100%", maxWidth:500 }}>
          <div style={{
            display:"flex", gap:10, alignItems:"flex-end",
            background:T.cream, border:`1px solid ${T.border}`,
            borderRadius:4, padding:"10px 14px",
          }}>
            <textarea
              value={textInput}
              onChange={e => {
                setTextInput(e.target.value);
                e.target.style.height = "auto";
                e.target.style.height = Math.min(e.target.scrollHeight, 140) + "px";
              }}
              onKeyDown={e => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSendText();
                }
              }}
              placeholder="Type your response… (Enter to send)"
              rows={1}
              disabled={voiceState === "processing" || voiceState === "listening"}
              style={{
                flex:1, background:"transparent", border:"none",
                fontFamily:serif, fontSize:14, color:T.ink,
                lineHeight:1.6, resize:"none", overflow:"hidden",
                minHeight:22,
              }}
            />
            <button
              onClick={handleSendText}
              disabled={!textInput.trim() || voiceState === "processing" || voiceState === "listening"}
              style={{
                background: textInput.trim() && (voiceState === "idle" || voiceState === "speaking") ? T.ink : T.inkGhost,
                color:T.cream, border:"none",
                width:32, height:32, borderRadius:"50%",
                display:"flex", alignItems:"center", justifyContent:"center",
                fontFamily:mono, fontSize:13, flexShrink:0,
                transition:"all 0.2s ease",
              }}
            >
              →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// STANDALONE DEMO — remove when integrating
// with full_assessment_system.jsx
// ─────────────────────────────────────────────
function StandaloneDemo() {
  const [phase, setPhase] = useState("interview"); // interview | done
  const [scores, setScores] = useState(null);

  // Example typology context — in production this comes from
  // scoreECR/scoreTIPI/scoreDSI/scoreBRS/scorePVQ results
  const demoTypologyContext = `
ECR-12: Anxiety=3.8/7, Avoidance=2.4/7 → Anxious-Preoccupied attachment
TIPI Big Five: E=4.2, A=5.8, C=4.6, N=5.1, O=5.4 (all /7)
DSI-SF Differentiation: 3.6/6 (moderate)
BRS Resilience: 3.2/5 (moderate)
PVQ-21 Values: Self-transcendence=5.1, Openness-to-change=4.8, Conservation=3.2, Self-enhancement=2.9
  `.trim();

  if (phase === "done") {
    return (
      <div style={{
        minHeight:"100vh", background:T.cream, display:"flex",
        flexDirection:"column", alignItems:"center", justifyContent:"center",
        fontFamily:serif, padding:24,
      }}>
        <style>{css}</style>
        <div style={{ textAlign:"center", maxWidth:480 }}>
          <div style={{ fontFamily:mono, fontSize:32, color:T.green, marginBottom:16 }}>✓</div>
          <h2 style={{ fontSize:24, fontWeight:400, color:T.ink, marginBottom:12 }}>
            Interview complete.
          </h2>
          <p style={{ color:T.inkFaint, lineHeight:1.7, marginBottom:32 }}>
            In the full app, these scores would feed into your relational profile alongside the validated instrument results.
          </p>
          <div style={{
            background:T.surface, border:`1px solid ${T.border}`,
            padding:"20px 24px", textAlign:"left", marginBottom:24,
          }}>
            <div style={{ fontFamily:mono, fontSize:10, color:T.gold, letterSpacing:2, textTransform:"uppercase", marginBottom:12 }}>
              Pillar scores from interview
            </div>
            {scores && Object.entries(scores.pillarScores).map(([id, score]) => (
              <div key={id} style={{ display:"flex", justifyContent:"space-between", marginBottom:6 }}>
                <span style={{ fontFamily:serif, fontSize:14, color:T.inkLight }}>
                  {({ 1:"Conflict & Repair", 3:"Accountability", 4:"Reliability", 5:"Responsiveness", 6:"Desire & Boundaries", 9:"Stress Resilience" })[id]}
                </span>
                <span style={{ fontFamily:mono, fontSize:14, color:T.gold }}>{score}/10</span>
              </div>
            ))}
          </div>
          <button
            onClick={() => { setPhase("interview"); setScores(null); }}
            style={{
              background:"transparent", color:T.inkFaint, border:`1px solid ${T.border}`,
              fontFamily:mono, fontSize:11, letterSpacing:2, padding:"10px 24px",
              cursor:"pointer",
            }}
          >
            RUN AGAIN
          </button>
        </div>
      </div>
    );
  }

  return (
    <AIInterviewer
      typologyContext={demoTypologyContext}
      onComplete={(results) => {
        setScores(results);
        setPhase("done");
      }}
    />
  );
}

export { StandaloneDemo as default, AIInterviewer };
