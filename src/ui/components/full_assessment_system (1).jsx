import { useState, useEffect, useRef } from "react";

// ─────────────────────────────────────────────
// DESIGN TOKENS
// ─────────────────────────────────────────────
const T = {
  cream: "#F5F0E8",
  creamDark: "#EDE6D6",
  ink: "#1C1917",
  inkLight: "#44403C",
  inkFaint: "#A8A29E",
  inkGhost: "#D6D0C8",
  gold: "#8B6914",
  goldLight: "#C4914A",
  goldSoft: "#F5EDD8",
  red: "#8B1A1A",
  green: "#1A5C2A",
  blue: "#1A3A5C",
  surface: "#FDFAF4",
  border: "#E2DAC8",
};

const serif = "'Palatino Linotype', 'Book Antiqua', Palatino, serif";
const mono = "'Courier New', Courier, monospace";

const css = `
  @keyframes fadeUp {
    from { opacity: 0; transform: translateY(16px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes fadeIn {
    from { opacity: 0; }
    to   { opacity: 1; }
  }
  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.4; }
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: ${T.cream}; }
  textarea:focus { outline: none; }
  button { transition: all 0.2s ease; }
  button:hover { opacity: 0.85; }
  ::-webkit-scrollbar { width: 4px; }
  ::-webkit-scrollbar-track { background: ${T.creamDark}; }
  ::-webkit-scrollbar-thumb { background: ${T.inkGhost}; border-radius: 2px; }
`;

// ─────────────────────────────────────────────
// PILLAR DEFINITIONS
// ─────────────────────────────────────────────
const PILLARS = [
  { id: 1, name: "Conflict & Repair",     color: T.red,   weight: 0.14 },
  { id: 2, name: "Attachment Style",      color: "#6B3FA0", weight: 0.13 },
  { id: 3, name: "Accountability",        color: T.green, weight: 0.12 },
  { id: 4, name: "Reliability",           color: T.gold,  weight: 0.12 },
  { id: 5, name: "Responsiveness",        color: "#0D6B6B", weight: 0.12 },
  { id: 6, name: "Desire & Boundaries",   color: "#8B3A5C", weight: 0.11 },
  { id: 7, name: "Friendship & Joy",      color: "#5C3A1A", weight: 0.10 },
  { id: 8, name: "Shared Vision",         color: T.blue,  weight: 0.09 },
  { id: 9, name: "Stress Resilience",     color: "#2A5C5C", weight: 0.07 },
];

// ─────────────────────────────────────────────
// ECR-12 — ATTACHMENT (12 items, 7-point scale)
// ─────────────────────────────────────────────
const ECR12 = [
  { id:"e1",  sub:"anxiety",   text:"I worry about being abandoned." },
  { id:"e2",  sub:"avoidance", text:"I prefer not to share my feelings with partners." },
  { id:"e3",  sub:"anxiety",   text:"I worry a lot about my relationships." },
  { id:"e4",  sub:"avoidance", text:"I find it difficult to depend on romantic partners." },
  { id:"e5",  sub:"anxiety",   text:"I need a lot of reassurance that I am loved." },
  { id:"e6",  sub:"avoidance", text:"I don't feel comfortable opening up to romantic partners." },
  { id:"e7",  sub:"anxiety",   text:"I get frustrated when my partner is not around as much as I would like." },
  { id:"e8",  sub:"avoidance", text:"I find it difficult to allow myself to depend on romantic partners." },
  { id:"e9",  sub:"anxiety",   text:"I often worry that my partner doesn't really love me." },
  { id:"e10", sub:"avoidance", text:"It's not difficult for me to get close to my partner." }, // reverse
  { id:"e11", sub:"anxiety",   text:"My desire to be very close sometimes scares people away." },
  { id:"e12", sub:"avoidance", text:"I am comfortable sharing my private thoughts and feelings." }, // reverse
];
const ECR_REVERSE = ["e10","e12"];

// ─────────────────────────────────────────────
// TIPI — BIG FIVE (10 items, 7-point scale)
// ─────────────────────────────────────────────
const TIPI = [
  { id:"t1",  trait:"E",  text:"Extraverted, enthusiastic." },
  { id:"t2",  trait:"A",  text:"Critical, quarrelsome.", reverse:true },
  { id:"t3",  trait:"C",  text:"Dependable, self-disciplined." },
  { id:"t4",  trait:"N",  text:"Anxious, easily upset." },
  { id:"t5",  trait:"O",  text:"Open to new experiences, complex." },
  { id:"t6",  trait:"E",  text:"Reserved, quiet.", reverse:true },
  { id:"t7",  trait:"A",  text:"Sympathetic, warm." },
  { id:"t8",  trait:"C",  text:"Disorganized, careless.", reverse:true },
  { id:"t9",  trait:"N",  text:"Calm, emotionally stable.", reverse:true },
  { id:"t10", trait:"O",  text:"Conventional, uncreative.", reverse:true },
];

// ─────────────────────────────────────────────
// DSI-SF — DIFFERENTIATION OF SELF (20 items, 6-point scale)
// ─────────────────────────────────────────────
const DSI = [
  { id:"d1",  text:"I am able to speak calmly with family members even when they are upset with me." },
  { id:"d2",  text:"When I am with others, I feel a pressure to think or feel the same way they do." },
  { id:"d3",  text:"When someone close to me is upset, I am still able to take care of my own needs." },
  { id:"d4",  text:"I often feel responsible for how other people feel." },
  { id:"d5",  text:"I am easily affected by the moods of the people I'm close to." },
  { id:"d6",  text:"When someone I care about is upset, I am able to stay calm." },
  { id:"d7",  text:"It is difficult for me to make important decisions without getting input from people I'm close to." },
  { id:"d8",  text:"I am able to state my views calmly when people close to me disagree." },
  { id:"d9",  text:"I often act on what I think others want rather than on my own wishes." },
  { id:"d10", text:"My sense of self depends a lot on how others think of me." },
  { id:"d11", text:"I can remain emotionally calm even when those around me are anxious." },
  { id:"d12", text:"I am able to be myself even when I am with people who are very different from me." },
  { id:"d13", text:"I have a clear sense of my own values that guide me." },
  { id:"d14", text:"I often feel responsible for solving other people's problems." },
  { id:"d15", text:"Even in emotionally charged discussions, I can stay focused on the issue." },
  { id:"d16", text:"I need others' approval to feel good about myself." },
  { id:"d17", text:"I make decisions based on what is right for me, not just what others expect." },
  { id:"d18", text:"I can listen to others' criticism without feeling personally threatened." },
  { id:"d19", text:"I feel I must go along with what others want or they will reject me." },
  { id:"d20", text:"Even when I disagree, I can acknowledge another person's point of view." },
];
const DSI_REVERSE = ["d2","d4","d5","d7","d9","d10","d14","d16","d19"];

// ─────────────────────────────────────────────
// BRS — BRIEF RESILIENCE SCALE (6 items, 5-point scale)
// Smith et al. (2008). Odd items positive, even items reversed.
// Measures bounce-back capacity — distinct from TIPI Neuroticism
// (N = internal reactivity; BRS = recovery speed after a real hit)
// ─────────────────────────────────────────────
const BRS = [
  { id:"b1", text:"I tend to bounce back quickly after hard times." },
  { id:"b2", text:"I have a hard time making it through stressful events.", reverse:true },
  { id:"b3", text:"It does not take me long to recover from a stressful event." },
  { id:"b4", text:"It is hard for me to snap back when something bad happens.", reverse:true },
  { id:"b5", text:"I usually come through difficult times with little trouble." },
  { id:"b6", text:"I tend to take a long time to get over set-backs in my life.", reverse:true },
];
// Score = mean of all 6 items (after reversing b2,b4,b6); range 1–5
// ≥3.8 high resilience · 2.9–3.7 moderate · ≤2.8 low

// ─────────────────────────────────────────────
// PVQ-21 — PORTRAIT VALUES QUESTIONNAIRE (21 items, 6-point scale)
// Schwartz et al. (2001). Items reworded to second person (first person self-report).
// "How much like you is this?" 1=Not like me at all → 6=Very much like me
// 10 values grouped into 4 higher-order dimensions used for matching.
// ─────────────────────────────────────────────
const PVQ21 = [
  // SELF-TRANSCENDENCE (benevolence + universalism)
  { id:"v1",  value:"benevolence",    text:"It's very important to me to help the people around me. I want to care for other people's well-being." },
  { id:"v2",  value:"universalism",   text:"I think it's important that every person in the world be treated equally. I believe everyone should have equal opportunities in life." },
  { id:"v3",  value:"benevolence",    text:"It's very important to me to be loyal to my friends. I want to devote myself to people close to me." },
  { id:"v4",  value:"universalism",   text:"I strongly believe that people should care for nature. Looking after the environment is important to me." },
  { id:"v5",  value:"benevolence",    text:"It's very important to me to forgive people who have wronged me. I try to see the best in people and to understand them." },
  { id:"v6",  value:"universalism",   text:"I think it is important to listen to people who are different from me. Even when I disagree, I still want to understand them." },
  // SELF-ENHANCEMENT (achievement + power)
  { id:"v7",  value:"achievement",    text:"Being very successful is important to me. I hope people will recognise my achievements." },
  { id:"v8",  value:"power",          text:"It is important to me to be in charge and tell others what to do. I want people to do what I say." },
  { id:"v9",  value:"achievement",    text:"Getting ahead in life is important to me. I strive to do better than others." },
  { id:"v10", value:"power",          text:"It is important to me to be rich. I want to have a lot of money and expensive things." },
  // OPENNESS TO CHANGE (self-direction + stimulation)
  { id:"v11", value:"self_direction", text:"I think it's important to be interested in things. I like to be curious and to try to understand all sorts of things." },
  { id:"v12", value:"stimulation",    text:"I like surprises and am always looking for new things to do. I think it is important to do lots of different things in life." },
  { id:"v13", value:"self_direction", text:"I believe that people should make their own choices about what they do. It's important to me to be free and not depend on others." },
  { id:"v14", value:"stimulation",    text:"I am always looking for different things to do. I think it is important to try many different things in life." },
  // CONSERVATION (security + conformity + tradition)
  { id:"v15", value:"security",       text:"It is important to me to live in secure surroundings. I avoid anything that might endanger my safety." },
  { id:"v16", value:"conformity",     text:"I believe that people should follow rules even when no-one is watching. It is important to me to always behave properly." },
  { id:"v17", value:"tradition",      text:"Religious belief or tradition is important to me. I try hard to do what my religion or family values require." },
  { id:"v18", value:"security",       text:"It is important to me that my country is safe. I think the state must be strong to be able to defend its citizens." },
  { id:"v19", value:"conformity",     text:"I believe I should always show respect to my parents and to older people. It is important to me to be obedient." },
  { id:"v20", value:"tradition",      text:"It is important to me to maintain the traditions handed down by my religion or my family. I follow the customs of my family." },
  { id:"v21", value:"security",       text:"It is important to me that things are orderly and clean. I really don't like things to be a mess." },
];
// Higher-order axes for matching:
// Self-transcendence = mean(benevolence, universalism) — 6 items
// Self-enhancement   = mean(achievement, power) — 4 items
// Openness to change = mean(self_direction, stimulation) — 4 items
// Conservation       = mean(security, conformity, tradition) — 7 items
// Key compatibility signal: self-transcendence vs self-enhancement polarity
// and openness-to-change vs conservation polarity

// ─────────────────────────────────────────────
// 9 QUESTIONS — FINAL OPTIMIZED BANK
// Removed: Q2 (ECR-12), Q7 (TIPI-C), Q10 (ECR+Q11),
//          Q12 (PVQ-21 covers Shared Vision / Pillar 8 directly),
//          Q13 (TIPI E+A), Q15 (TIPI-N)
// ─────────────────────────────────────────────
const QUESTIONS = [
  {
    id:"q1", pillar:1, format:"open",
    prompt:"Your partner snaps at you unfairly after a bad day. You know they're stressed, but it still stings. Walk me through what happens in your mind — and what you actually do next.",
    followUp:"Looking back — would you do anything differently?",
    hint:"There's no right answer. We're interested in what actually happens, not what should.",
  },
  {
    id:"q3", pillar:1, format:"open",
    prompt:"Think of the last time a disagreement with someone close to you escalated further than you wanted it to. What happened — and who made the first move to repair things?",
    followUp:"What did that repair actually look like?",
    hint:"This can be a friend, family member, or past partner.",
  },
  {
    id:"q4", pillar:3, format:"open",
    prompt:"Tell me about a time you hurt someone you cared about — even unintentionally. What happened when you realized it, and what did you do?",
    followUp:"If you could go back, what would you do differently?",
    hint:"We all hurt people sometimes. What matters is what you did with it.",
  },
  {
    id:"q5", pillar:3, format:"open",
    prompt:"Have you ever changed something significant about how you show up in relationships — a habit, a pattern, a tendency? What prompted it, and how did you know it was real?",
    followUp:"When a partner gives you feedback that's hard to hear, what's your instinctive reaction?",
    hint:"Think about real behavioral change, not just insight.",
  },
  {
    id:"q6", pillar:4, format:"open",
    prompt:"Tell me about a time you kept a commitment when it was genuinely inconvenient — when showing up actually cost you something. What made you follow through?",
    followUp:"Is there a time you didn't follow through when you should have? What happened?",
    hint:"Can be with a friend, partner, or family member.",
  },
  {
    id:"q8", pillar:5, format:"choice",
    prompt:"Your partner texts mid-afternoon: \"I just got the best news about something I've worked on for months.\" You're busy. You:",
    options:[
      "Drop what I can and respond with genuine excitement",
      "Send a quick 'that's great!' and catch up properly later",
      "Make a mental note to ask about it when I see them",
      "Finish what I'm doing first — they know I'm busy",
    ],
  },
  {
    id:"q9", pillar:7, format:"choice",
    prompt:"Your partner wants to tell you all about something you have zero interest in. You:",
    options:[
      "Genuinely engage — their enthusiasm pulls me in",
      "Listen attentively even without personal interest",
      "Half-listen while doing something else",
      "Gently redirect to something we both enjoy",
    ],
  },
  {
    id:"q11", pillar:6, format:"open",
    prompt:"When you've felt a mismatch in what you needed versus what a partner needed — emotionally, physically, or in terms of space — how did you handle it?",
    followUp:"Did it get addressed, avoided, or did it quietly build into something bigger?",
    hint:"Think about any kind of mismatch, not just physical.",
  },
  {
    id:"q14", pillar:9, format:"open",
    prompt:"Think of a genuinely stressful period in your life — work, family, health, money. How did it affect your closest relationships, and what did you need from the people around you?",
    followUp:"Were you able to ask for what you needed — or did you tend to go quiet and handle it alone?",
    hint:"We're interested in how external pressure affects your relational behavior.",
  },
];

// ─────────────────────────────────────────────
// SCORING HELPERS
// ─────────────────────────────────────────────
function scoreECR(answers) {
  let anxSum = 0, avoSum = 0, anxN = 0, avoN = 0;
  ECR12.forEach(item => {
    const raw = answers[item.id];
    if (raw === undefined) return;
    const val = ECR_REVERSE.includes(item.id) ? 8 - raw : raw;
    if (item.sub === "anxiety") { anxSum += val; anxN++; }
    else { avoSum += val; avoN++; }
  });
  return {
    anxiety: anxN ? anxSum / anxN : 4,
    avoidance: avoN ? avoSum / avoN : 4,
  };
}

function scoreTIPI(answers) {
  const traits = { E:[], A:[], C:[], N:[], O:[] };
  TIPI.forEach(item => {
    const raw = answers[item.id];
    if (raw === undefined) return;
    const val = item.reverse ? 8 - raw : raw;
    traits[item.trait].push(val);
  });
  const avg = arr => arr.length ? arr.reduce((a,b)=>a+b,0)/arr.length : 4;
  return { E: avg(traits.E), A: avg(traits.A), C: avg(traits.C), N: avg(traits.N), O: avg(traits.O) };
}

function scoreDSI(answers) {
  let sum = 0, n = 0;
  DSI.forEach(item => {
    const raw = answers[item.id];
    if (raw === undefined) return;
    const val = DSI_REVERSE.includes(item.id) ? 7 - raw : raw;
    sum += val; n++;
  });
  return n ? sum / n : 3;
}

function scoreBRS(answers) {
  let sum = 0, n = 0;
  BRS.forEach(item => {
    const raw = answers[item.id];
    if (raw === undefined) return;
    const val = item.reverse ? 6 - raw : raw; // 5-point scale: reverse = 6 - raw
    sum += val; n++;
  });
  return n ? sum / n : 3;
}

function scorePVQ(answers) {
  const groups = {
    benevolence:    ["v1","v3","v5"],
    universalism:   ["v2","v4","v6"],
    achievement:    ["v7","v9"],
    power:          ["v8","v10"],
    self_direction: ["v11","v13"],
    stimulation:    ["v12","v14"],
    security:       ["v15","v18","v21"],
    conformity:     ["v16","v19"],
    tradition:      ["v17","v20"],
  };
  const avg = (ids) => {
    const vals = ids.map(id => answers[id]).filter(v => v !== undefined);
    return vals.length ? vals.reduce((a,b)=>a+b,0)/vals.length : 3.5;
  };
  const g = Object.fromEntries(Object.entries(groups).map(([k,ids]) => [k, avg(ids)]));
  return {
    // Individual value scores (1–6)
    ...g,
    // Higher-order axes (1–6) — used for compatibility matching
    selfTranscendence: (g.benevolence + g.universalism) / 2,
    selfEnhancement:   (g.achievement + g.power) / 2,
    opennessToChange:  (g.self_direction + g.stimulation) / 2,
    conservation:      (g.security + g.conformity + g.tradition) / 3,
  };
}

// ─────────────────────────────────────────────
// INSIGHT GENERATORS
// Deterministic — computed from scores, no API call.
// Designed to be specific, honest, and occasionally uncomfortable.
// ─────────────────────────────────────────────

function getECRInsight(answers, history="substantial") {
  const { anxiety, avoidance } = scoreECR(answers);
  const aLow = anxiety < 3, aHigh = anxiety >= 4.5;
  const vLow = avoidance < 3, vHigh = avoidance >= 4.5;

  const style =
    aLow  && vLow  ? "Secure" :
    aHigh && vLow  ? "Anxious-Preoccupied" :
    aLow  && vHigh ? "Dismissive-Avoidant" :
                     "Fearful-Avoidant";

  const descriptions = {
    "Secure": {
      headline: "You're securely attached.",
      body: "You're comfortable with closeness and generally don't worry about being abandoned or overwhelmed by intimacy. Under stress you tend to reach toward people rather than away from them. This is the most predictive single trait for relationship satisfaction — not because secure people don't have conflict, but because they're more likely to repair it.",
      edge: "The growth edge for secure people is often complacency — assuming intimacy will maintain itself without active tending.",
      color: T.green,
    },
    "Anxious-Preoccupied": {
      headline: "You show an anxious attachment pattern.",
      body: "You crave closeness but worry it won't last. When a partner seems distant or distracted, your nervous system reads it as a threat and pushes you toward reassurance-seeking. This isn't a flaw — it's a learned strategy that once made sense. But in adult relationships it can create the very distance it's trying to prevent.",
      edge: "The core work is learning to self-soothe before reaching for reassurance — not suppressing the need, but creating a brief gap between the anxiety and the action.",
      color: "#6B3FA0",
    },
    "Dismissive-Avoidant": {
      headline: "You show a dismissive-avoidant pattern.",
      body: "You value independence highly and tend to minimize emotional needs — your own and others'. You're likely to pull back when a relationship gets intense, not because you don't care, but because closeness activates discomfort. Partners often experience this as coldness or unavailability.",
      edge: "The growth edge is tolerating emotional bids without reframing them as pressure. Your avoidance often reads as rejection to people who don't share your model of closeness.",
      color: T.blue,
    },
    "Fearful-Avoidant": {
      headline: "You show a fearful-avoidant pattern.",
      body: "You want closeness but find it threatening — a push-pull dynamic that can be exhausting for you and confusing for partners. This pattern typically develops when early relationships were both a source of comfort and harm. It's the most complex attachment style and also the most responsive to conscious work.",
      edge: "The key insight is that your two fears — of abandonment and of engulfment — aren't contradictions. They're both trying to keep you safe from the same underlying thing.",
      color: T.red,
    },
  };

  const d = descriptions[style];
  const axisNote = `Anxiety: ${anxiety.toFixed(1)}/7 · Avoidance: ${avoidance.toFixed(1)}/7`;

  // Calibration note for low-history users
  const lowHistoryNote = history !== "substantial"
    ? history === "none"
      ? "One thing to keep in mind: because you answered based on imagined or non-romantic relationships, these scores are a starting point rather than a confirmed portrait. Attachment patterns often become clearer — and sometimes shift — once you're in a real relationship. Your matching algorithm accounts for this."
      : "Because your relationship experience has been limited so far, treat these scores as directional rather than definitive. Brief relationships don't always fully activate attachment patterns the way longer ones do. Your matching takes this into account."
    : null;

  return {
    instrument: "ECR-12 · Attachment",
    headline: d.headline,
    body: d.body,
    edge: d.edge,
    calibrationNote: lowHistoryNote,
    stat: axisNote,
    statLabel: "Your scores",
    color: d.color,
    visual: { type: "scatter", anxiety, avoidance },
  };
}

function getTIPIInsight(answers) {
  const t = scoreTIPI(answers);
  // Find highest and lowest traits
  const traits = [
    { key:"E", label:"Extraversion",    score:t.E, highNote:"You recharge through people and bring energy to shared spaces.", lowNote:"You recharge alone and may need more quiet time than partners expect." },
    { key:"A", label:"Agreeableness",   score:t.A, highNote:"You prioritise harmony and are easy to be close to — sometimes at the cost of your own needs.", lowNote:"You're direct and hold your ground, which can read as cold to more accommodating partners." },
    { key:"C", label:"Conscientiousness", score:t.C, highNote:"You follow through. Partners can rely on you.", lowNote:"Spontaneity is a strength; follow-through is something to watch." },
    { key:"N", label:"Neuroticism",     score:t.N, highNote:"You feel things intensely — a source of depth and also of stress spillover into relationships.", lowNote:"You have a stable emotional baseline that helps you stay grounded when things get hard." },
    { key:"O", label:"Openness",        score:t.O, highNote:"You're curious and adaptable — a partner who keeps growing.", lowNote:"You prefer what's familiar and proven, which brings stability but can resist needed change." },
  ].sort((a,b) => b.score - a.score);

  const highest = traits[0];
  const lowest = traits[4];
  const neuro = traits.find(t => t.key === "N");
  const agree = traits.find(t => t.key === "A");

  // Specific relational combination note
  let combinationNote = "";
  if (t.N > 4.5 && t.A > 4.5) combinationNote = "High Neuroticism + high Agreeableness is a pattern worth watching: you feel things intensely and tend to absorb others' emotions, which can lead to exhaustion and quiet resentment.";
  else if (t.N > 4.5 && t.A < 3) combinationNote = "High Neuroticism + low Agreeableness creates a specific tension: you feel a lot but don't naturally soften it. Partners may experience this as unpredictable intensity.";
  else if (t.C > 5 && t.O < 3) combinationNote = "High Conscientiousness + low Openness is a reliable, stable combination — and one that can struggle when a relationship requires adaptation or change.";
  else if (t.E > 5 && t.N > 4.5) combinationNote = "High Extraversion + high Neuroticism is an expressive, reactive combination. You bring a lot of life to relationships, and you also bring a lot of weather.";
  else combinationNote = `Your strongest trait in relationships is ${highest.label.toLowerCase()}: ${highest.score > 4 ? highest.highNote : highest.lowNote}`;

  return {
    instrument: "TIPI · Big Five Personality",
    headline: `Your dominant trait is ${highest.label.toLowerCase()}.`,
    body: highest.score > 4 ? highest.highNote : highest.lowNote,
    edge: combinationNote,
    stat: `${highest.label} ${highest.score.toFixed(1)} · ${lowest.label} ${lowest.score.toFixed(1)}`,
    statLabel: "Highest · Lowest",
    color: T.green,
    visual: { type: "bar", traits: [
      { label:"E", score:t.E }, { label:"A", score:t.A }, { label:"C", score:t.C },
      { label:"N", score:t.N }, { label:"O", score:t.O },
    ]},
  };
}

function getDSIInsight(answers) {
  const score = scoreDSI(answers);
  const high = score >= 4.2, low = score <= 2.8;

  const headline = high
    ? "You have high differentiation of self."
    : low
    ? "Your differentiation of self is a growth area."
    : "You show moderate differentiation of self.";

  const body = high
    ? "You can stay emotionally connected to people you love without losing your own ground. Under conflict, you tend to stay regulated rather than reactive. This is one of the strongest predictors of long-term relationship health — not because differentiated people don't feel things deeply, but because they can feel them without being controlled by them."
    : low
    ? "You tend to absorb the emotional states of people close to you, making it hard to hold your own perspective under pressure. This often shows up as one of two patterns: fusion (merging with a partner's reality) or cutoff (emotional distance as self-protection). Neither is a flaw — both are adaptive strategies that come with costs."
    : "You have reasonable emotional autonomy but can get pulled off-center in charged interactions. The specific trigger is worth knowing: most people with moderate differentiation have one or two relationship contexts where their groundedness reliably slips.";

  const edge = high
    ? "The growth edge for highly differentiated people is often warmth — the capacity for differentiation can shade into emotional unavailability if it becomes a reflex rather than a choice."
    : low
    ? "The work isn't to care less — it's to develop the capacity to care deeply while remaining recognizably yourself. Murray Bowen called this the central challenge of adult emotional life."
    : "Notice the specific conditions under which you lose your own ground. It's rarely random.";

  return {
    instrument: "DSI-SF · Differentiation of Self",
    headline,
    body,
    edge,
    stat: `${score.toFixed(2)} / 6.0`,
    statLabel: "Your differentiation score",
    color: T.red,
    visual: { type: "gauge", score, max:6, low:2.8, high:4.2 },
  };
}

function getBRSInsight(answers) {
  const brs = scoreBRS(answers);
  const tipi = scoreTIPI(answers);
  const N = tipi.N;

  // The interesting insight is the BRS × Neuroticism combination
  const highBRS = brs >= 3.8, lowBRS = brs <= 2.8;
  const highN = N >= 4.5, lowN = N <= 2.5;

  let headline, body, edge;

  if (highBRS && lowN) {
    headline = "You're highly resilient with a stable baseline.";
    body = "Low reactivity combined with strong bounce-back capacity is a genuinely unusual combination. You're unlikely to be knocked off-center by stress, and when you are, you recover quickly. In relationships this reads as dependable steadiness — which partners find deeply reassuring, especially in hard seasons.";
    edge = "The watch-out: this combination can make it hard to understand partners who are more reactive. 'Just move on' is easy advice when it's actually how your nervous system works.";
  } else if (highBRS && highN) {
    headline = "You're reactive but resilient.";
    body = "You feel stress sharply — but you recover from it well. This is an underappreciated combination. You're not low-maintenance in the short term, but you don't hold grudges or carry wounds forward. Partners experience you as intense in the moment and clear afterward.";
    edge = "The key is the recovery time. If your bounce-back is genuinely fast, the reactivity is manageable. If you're overestimating your resilience, stress will accumulate in ways that surprise you.";
  } else if (lowBRS && lowN) {
    headline = "You're stable but slow to recover from hard hits.";
    body = "Your emotional baseline is steady — ordinary friction doesn't throw you. But when something genuinely hard happens, you take longer to return to equilibrium than you might expect. This matters in relationships because major disruptions — betrayal, loss, significant conflict — hit differently for you than day-to-day stress.";
    edge = "Worth knowing: your partners may recover from serious events on a different timeline than you. What looks like 'moving on' to them may not match where you actually are.";
  } else if (lowBRS && highN) {
    headline = "Stress is genuinely hard for you — and slow to lift.";
    body = "You feel difficulty intensely and recovery takes real time. This isn't weakness — it's a nervous system profile. But it does mean that external pressure has an outsized effect on your relationships, and that support during hard periods matters more for you than for people with different profiles.";
    edge = "The most important thing is knowing this about yourself before it becomes a crisis. Relationships that can absorb stress together are different from ones that require you to manage it alone.";
  } else {
    headline = "You show moderate resilience.";
    body = `Your resilience score of ${brs.toFixed(1)}/5 places you in the typical range — you handle most stressors reasonably well and recover within a normal timeframe. The more meaningful signal comes from how this interacts with your personality: your Neuroticism score of ${N.toFixed(1)}/7 suggests ${N > 4 ? "you feel stress more intensely than average, which means your resilience is doing real work" : "your emotional baseline is fairly stable, so resilience is less likely to be tested by ordinary friction"}.`;
    edge = "Context matters more than absolute score. Resilience under chronic low-level stress is different from resilience under acute crisis — it's worth knowing which you handle better.";
  }

  return {
    instrument: "BRS · Resilience",
    headline,
    body,
    edge,
    stat: `BRS ${brs.toFixed(2)}/5 · Neuroticism ${N.toFixed(1)}/7`,
    statLabel: "Resilience × Reactivity",
    color: "#2A5C5C",
    visual: { type: "dual", a: { label:"Resilience", score:brs, max:5 }, b: { label:"Neuroticism", score:N, max:7 } },
  };
}

function getPVQInsight(answers) {
  const pvq = scorePVQ(answers);

  // Find the dominant axis
  const axes = [
    { key:"selfTranscendence", label:"Self-transcendence", score:pvq.selfTranscendence, desc:"caring, universalist, other-oriented" },
    { key:"selfEnhancement",   label:"Self-enhancement",   score:pvq.selfEnhancement,   desc:"achievement-focused, status-conscious" },
    { key:"opennessToChange",  label:"Openness to change", score:pvq.opennessToChange,  desc:"curious, autonomous, stimulation-seeking" },
    { key:"conservation",      label:"Conservation",       score:pvq.conservation,       desc:"security-oriented, traditional, orderly" },
  ].sort((a,b) => b.score - a.score);

  const dominant = axes[0];
  const tension = axes[3]; // lowest — most in tension with dominant

  // Find the single highest individual value
  const allVals = [
    { label:"Benevolence", score:pvq.benevolence },
    { label:"Universalism", score:pvq.universalism },
    { label:"Achievement", score:pvq.achievement },
    { label:"Power", score:pvq.power },
    { label:"Self-Direction", score:pvq.self_direction },
    { label:"Stimulation", score:pvq.stimulation },
    { label:"Security", score:pvq.security },
    { label:"Conformity", score:pvq.conformity },
    { label:"Tradition", score:pvq.tradition },
  ].sort((a,b) => b.score - a.score);

  const topVal = allVals[0];

  // Polarity tension note — the most interesting insight
  const stVsSeGap = pvq.selfTranscendence - pvq.selfEnhancement;
  const ocVsConGap = pvq.opennessToChange - pvq.conservation;

  let tensionNote = "";
  if (Math.abs(stVsSeGap) < 0.5 && Math.abs(ocVsConGap) < 0.5) {
    tensionNote = "Your values are unusually balanced across all four axes — which can mean genuine complexity, or it can mean your stated values haven't been tested by real trade-offs yet. The assessment can't tell the difference.";
  } else if (stVsSeGap > 1.5) {
    tensionNote = "You lean strongly toward others' welfare over personal achievement. In relationships this shows up as generosity and attunement — and can shade into self-neglect if it's not balanced with knowing what you need.";
  } else if (stVsSeGap < -1.5) {
    tensionNote = "You lean toward achievement and status over universalist caring. This doesn't predict relationship failure — but it does predict friction with partners who are strongly other-oriented unless there's explicit alignment on lifestyle and priorities.";
  } else if (ocVsConGap > 1.5) {
    tensionNote = "You prioritise autonomy and novelty over security and tradition. Partners who need stability and predictability will find this energising or destabilising depending on their own profile.";
  } else if (ocVsConGap < -1.5) {
    tensionNote = "You prioritise security, structure, and continuity. This is a deeply stable orientation — and one that requires a partner with compatible values around home, routine, and tradition to feel at ease.";
  } else {
    tensionNote = `Your strongest individual value is ${topVal.label.toLowerCase()} (${topVal.score.toFixed(1)}/6). In relationships, this shows up most clearly in what you notice and what you need from a partner.`;
  }

  return {
    instrument: "PVQ-21 · Schwartz Values",
    headline: `Your dominant values orientation is ${dominant.label.toLowerCase()}.`,
    body: `You score highest on ${dominant.label} (${dominant.score.toFixed(1)}/6) — the ${dominant.desc} cluster. This is the lens through which you tend to evaluate major decisions, including who you choose and what you need from a long-term relationship.`,
    edge: tensionNote,
    stat: `${dominant.label} ${dominant.score.toFixed(1)} · ${tension.label} ${tension.score.toFixed(1)}`,
    statLabel: "Dominant · Least dominant",
    color: T.blue,
    visual: { type: "axes", pvq },
  };
}

function buildAlgorithmPrompt(typology, pillarAnswers) {
  const { ecr, tipi, dsi, brs, pvq, lowHistory } = typology;
  const attachStyle =
    ecr.anxiety < 3 && ecr.avoidance < 3 ? "Secure" :
    ecr.anxiety >= 4 && ecr.avoidance < 3 ? "Anxious-Preoccupied" :
    ecr.anxiety < 3 && ecr.avoidance >= 4 ? "Dismissive-Avoidant" :
    "Fearful-Avoidant";

  const brsLabel = brs >= 3.8 ? "High" : brs >= 2.9 ? "Moderate" : "Low";

  return `You are an expert relationship psychologist. Score this user's relational profile across 9 pillars (0–10 each).

TYPOLOGY SCORES:
- Attachment: Anxiety=${ecr.anxiety.toFixed(1)}/7, Avoidance=${ecr.avoidance.toFixed(1)}/7 → Style: ${attachStyle}
- Big Five: E=${tipi.E.toFixed(1)}, A=${tipi.A.toFixed(1)}, C=${tipi.C.toFixed(1)}, N=${tipi.N.toFixed(1)}, O=${tipi.O.toFixed(1)} (all /7)
- Differentiation of Self: ${dsi.toFixed(1)}/6
- Brief Resilience Scale: ${brs.toFixed(2)}/5 → ${brsLabel} resilience
- Relationship history: ${lowHistory ? "LIMITED — user has minimal or no romantic relationship history. ECR scores are based on projected or non-romantic attachment experience. Apply a wider confidence band to Pillar 2 and weight narrative signals more heavily than raw ECR scores for this pillar." : "Substantial — ECR scores are grounded in real romantic relationship experience."}
- Schwartz Values (PVQ-21, all /6):
  · Self-transcendence: ${pvq.selfTranscendence.toFixed(2)} (benevolence=${pvq.benevolence.toFixed(1)}, universalism=${pvq.universalism.toFixed(1)})
  · Self-enhancement:   ${pvq.selfEnhancement.toFixed(2)} (achievement=${pvq.achievement.toFixed(1)}, power=${pvq.power.toFixed(1)})
  · Openness to change: ${pvq.opennessToChange.toFixed(2)} (self-direction=${pvq.self_direction.toFixed(1)}, stimulation=${pvq.stimulation.toFixed(1)})
  · Conservation:       ${pvq.conservation.toFixed(2)} (security=${pvq.security.toFixed(1)}, conformity=${pvq.conformity.toFixed(1)}, tradition=${pvq.tradition.toFixed(1)})

QUESTION RESPONSES:
${pillarAnswers.map(qa => `Q${qa.qid} (Pillar ${qa.pillar}): ${qa.answer}`).join("\n")}

SCORING RUBRIC:
- Pillar 1 (Conflict & Repair): DSI score + de-escalation language in narrative + repair initiation
- Pillar 2 (Attachment): primarily ECR anxiety/avoidance, contextualized by DSI
- Pillar 3 (Accountability): ownership language in narrative + absence of blame-shifting + PVQ benevolence (high benevolence correlates with prosocial repair)
- Pillar 4 (Reliability): Q6 narrative + TIPI Conscientiousness
- Pillar 5 (Responsiveness): Q8 choice + narrative attunement signals
- Pillar 6 (Desire & Bounds): Q11 narrative + ECR avoidance subscale
- Pillar 7 (Friendship & Joy): Q9 choice + TIPI Openness/Agreeableness + PVQ stimulation/self-direction
- Pillar 8 (Shared Vision): PVQ higher-order axes (primary signal — self-transcendence, conservation, openness-to-change positions reveal values alignment potential directly)
- Pillar 9 (Stress Resilience): Q14 narrative + BRS score (60%) + TIPI Neuroticism inverse (40%)

Return ONLY valid JSON:
{
  "pillarScores": {"1":0,"2":0,"3":0,"4":0,"5":0,"6":0,"7":0,"8":0,"9":0},
  "attachmentStyle": "${attachStyle}",
  "resilienceLevel": "${brsLabel}",
  "valuesProfile": {
    "topValue": "the single highest-scoring individual value name",
    "valuesAxis": "e.g. 'Self-transcendence oriented' or 'Openness-to-change oriented'"
  },
  "strengths": ["brief phrase","brief phrase"],
  "growthEdges": ["brief phrase","brief phrase"],
  "profileSummary": "3 sentences. Honest, warm, research-grounded read of this person's relational profile."
}`;
}

function buildMatchPrompt(user1, user2, lowHistory) {
  return `You are an expert relationship compatibility analyst using Gottman, EFT, and Joel et al. (2020) research.

USER 1:
- Attachment: ${user1.attachmentStyle}${lowHistory ? " (low relationship history — treat with wider confidence band; do not penalise unusual attachment scores)" : ""}
- Pillar Scores: ${Object.entries(user1.pillarScores).map(([k,v])=>`P${k}=${v}`).join(", ")}
- Strengths: ${user1.strengths?.join(", ")}
- Growth edges: ${user1.growthEdges?.join(", ")}

USER 2 (demo profile):
- Attachment: Secure
- Pillar Scores: P1=7.8,P2=8.2,P3=7.1,P4=8.5,P5=7.4,P6=6.8,P7=8.6,P8=7.2,P9=6.9
- Values orientation: Self-transcendence oriented, moderate conservation
- Strengths: high responsiveness, strong friendship base
- Growth edges: desire communication, external stress management

COMPATIBILITY LOGIC (per pillar):
- P1: similarity preferred (close scores = safe conflict dynamic)
- P2: Secure+Secure best; Secure+Anxious workable; Anxious+Avoidant high risk
- P3: threshold gate — both must score 5+; above that, similarity preferred
- P4: threshold gate — both must score 5+
- P5: similarity preferred
- P6: similarity + communication quality both weighted
- P7: similarity preferred
- P8: Schwartz values axes alignment — self-transcendence vs self-enhancement polarity and openness-to-change vs conservation polarity are the primary signals; large divergence on either axis = high friction risk
- P9: both need 4+ baseline; some complementarity acceptable

PILLAR WEIGHTS: P1=14%,P2=13%,P3=12%,P4=12%,P5=12%,P6=11%,P7=10%,P8=9%,P9=7%

Return ONLY valid JSON:
{
  "overallScore": 0,
  "pillarCompatibility": {"1":0,"2":0,"3":0,"4":0,"5":0,"6":0,"7":0,"8":0,"9":0},
  "strongestAlignment": "pillar name + one-sentence reason",
  "biggestRisk": "pillar name + one-sentence reason",
  "chemistryNote": "one sentence on the intangible feel of this pairing",
  "summary": "3 sentences. Honest, specific, research-grounded compatibility read."
}`;
}

// ─────────────────────────────────────────────
// SECTION CONFIGS
// ─────────────────────────────────────────────
const SECTIONS = [
  { id:"home",    label:"Home" },
  { id:"ecr",     label:"Attachment", subtitle:"ECR-12 · 12 items · ~3 min", color:"#6B3FA0", total:12 },
  { id:"tipi",    label:"Personality", subtitle:"TIPI · 10 items · ~2 min", color:T.green, total:10 },
  { id:"dsi",     label:"Self & Others", subtitle:"DSI-SF · 20 items · ~4 min", color:T.red, total:20 },
  { id:"brs",     label:"Resilience", subtitle:"BRS · 6 items · ~90 sec", color:"#2A5C5C", total:6 },
  { id:"pvq",     label:"Values", subtitle:"PVQ-21 · 21 items · ~4 min", color:T.blue, total:21 },
  { id:"assess",  label:"Your Story", subtitle:"9 questions · ~7 min", color:T.gold },
  { id:"scoring", label:"Analyzing" },
  { id:"profile", label:"Your Profile" },
  { id:"match",   label:"Your Match" },
];

// ─────────────────────────────────────────────
// SHARED UI PRIMITIVES
// ─────────────────────────────────────────────
const Shell = ({ children, center }) => (
  <div style={{
    background: T.cream, minHeight:"100vh", fontFamily:serif,
    display:"flex", flexDirection:"column",
    alignItems: center ? "center" : undefined,
    justifyContent: center ? "center" : undefined,
  }}>
    <style>{css}</style>
    {children}
  </div>
);

const Container = ({ children, style }) => (
  <div style={{ maxWidth:620, margin:"0 auto", padding:"40px 24px", width:"100%", ...style }}>
    {children}
  </div>
);

const Label = ({ children, color }) => (
  <div style={{ fontFamily:mono, fontSize:10, letterSpacing:3, textTransform:"uppercase", color: color || T.gold, marginBottom:8 }}>
    {children}
  </div>
);

const Heading = ({ children, size }) => (
  <h1 style={{ fontFamily:serif, fontSize: size || 34, fontWeight:400, color:T.ink, lineHeight:1.15, marginBottom:16 }}>
    {children}
  </h1>
);

const Body = ({ children, muted, style }) => (
  <p style={{ fontFamily:serif, fontSize:16, lineHeight:1.75, color: muted ? T.inkFaint : T.inkLight, ...style }}>
    {children}
  </p>
);

const Btn = ({ children, onClick, secondary, small, disabled, style }) => (
  <button onClick={onClick} disabled={disabled} style={{
    background: secondary ? "transparent" : T.ink,
    border: secondary ? `1px solid ${T.border}` : "none",
    color: secondary ? T.inkFaint : T.cream,
    fontFamily: mono, fontSize: small ? 11 : 12,
    letterSpacing:1.5, textTransform:"uppercase",
    padding: small ? "8px 18px" : "13px 28px",
    cursor: disabled ? "default" : "pointer",
    opacity: disabled ? 0.4 : 1,
    borderRadius:2,
    ...style
  }}>
    {children}
  </button>
);

const Divider = () => (
  <div style={{ height:1, background:T.border, margin:"28px 0" }} />
);

// ─────────────────────────────────────────────
// LIKERT SCALE COMPONENT
// ─────────────────────────────────────────────
function LikertScale({ value, onChange, low, high, max=7, color }) {
  return (
    <div>
      <div style={{ display:"flex", gap:8, marginBottom:8 }}>
        {Array.from({length:max},(_,i)=>i+1).map(n => (
          <button key={n} onClick={()=>onChange(n)} style={{
            flex:1, height:36, border:`1px solid ${value===n ? (color||T.gold) : T.border}`,
            background: value===n ? (color||T.gold) : T.surface,
            color: value===n ? "white" : T.inkFaint,
            fontFamily:mono, fontSize:12, cursor:"pointer", borderRadius:2,
            fontWeight: value===n ? 700 : 400,
          }}>{n}</button>
        ))}
      </div>
      {(low||high) && (
        <div style={{ display:"flex", justifyContent:"space-between" }}>
          <span style={{ fontFamily:mono, fontSize:10, color:T.inkFaint }}>{low}</span>
          <span style={{ fontFamily:mono, fontSize:10, color:T.inkFaint }}>{high}</span>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// PROGRESS BAR
// ─────────────────────────────────────────────
function ProgressBar({ current, total, color }) {
  return (
    <div style={{ height:2, background:T.border, marginBottom:32 }}>
      <div style={{ height:"100%", width:`${(current/total)*100}%`, background:color||T.gold, transition:"width 0.4s ease" }} />
    </div>
  );
}

// ─────────────────────────────────────────────
// INSIGHT SCREEN
// ─────────────────────────────────────────────
function InsightVisual({ visual, color }) {
  if (!visual) return null;

  if (visual.type === "scatter") {
    // 2D attachment plot
    const { anxiety, avoidance } = visual;
    const x = ((avoidance - 1) / 6) * 100;
    const y = 100 - ((anxiety - 1) / 6) * 100;
    return (
      <div style={{ position:"relative", width:"100%", paddingBottom:"60%", background:T.creamDark, border:`1px solid ${T.border}`, borderRadius:4, overflow:"hidden" }}>
        {/* Axis lines */}
        <div style={{ position:"absolute", left:"50%", top:0, bottom:0, width:1, background:T.inkGhost }} />
        <div style={{ position:"absolute", top:"50%", left:0, right:0, height:1, background:T.inkGhost }} />
        {/* Quadrant labels */}
        {[
          { label:"Anxious", x:"5%", y:"8%" },
          { label:"Secure", x:"55%", y:"8%" },
          { label:"Fearful", x:"5%", y:"55%" },
          { label:"Avoidant", x:"55%", y:"55%" },
        ].map(q => (
          <div key={q.label} style={{ position:"absolute", left:q.x, top:q.y, fontFamily:mono, fontSize:9, color:T.inkFaint, letterSpacing:1, textTransform:"uppercase" }}>{q.label}</div>
        ))}
        {/* User dot */}
        <div style={{
          position:"absolute",
          left:`calc(${x}% - 8px)`, top:`calc(${y}% - 8px)`,
          width:16, height:16, borderRadius:"50%",
          background:color, boxShadow:`0 0 0 4px ${color}33`,
          transition:"all 0.5s ease",
        }} />
        {/* Axis labels */}
        <div style={{ position:"absolute", bottom:4, left:"2%", fontFamily:mono, fontSize:9, color:T.inkFaint }}>← Low avoidance</div>
        <div style={{ position:"absolute", bottom:4, right:"2%", fontFamily:mono, fontSize:9, color:T.inkFaint }}>High avoidance →</div>
      </div>
    );
  }

  if (visual.type === "bar") {
    const maxScore = 7;
    const traitColors = { E:"#6B4A1A", A:T.green, C:T.gold, N:T.red, O:T.blue };
    return (
      <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
        {visual.traits.map(t => (
          <div key={t.label}>
            <div style={{ display:"flex", justifyContent:"space-between", marginBottom:3 }}>
              <span style={{ fontFamily:mono, fontSize:11, color:T.inkFaint }}>{t.label}</span>
              <span style={{ fontFamily:mono, fontSize:11, color:traitColors[t.label] }}>{t.score.toFixed(1)}</span>
            </div>
            <div style={{ height:6, background:T.creamDark, borderRadius:3 }}>
              <div style={{ height:"100%", width:`${(t.score/maxScore)*100}%`, background:traitColors[t.label], borderRadius:3, transition:"width 0.8s ease" }} />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (visual.type === "gauge") {
    const { score, max, low, high } = visual;
    const pct = (score / max) * 100;
    const zone = score >= high ? T.green : score <= low ? T.red : T.gold;
    return (
      <div>
        <div style={{ height:12, background:T.creamDark, borderRadius:6, overflow:"hidden", marginBottom:8 }}>
          <div style={{ height:"100%", width:`${pct}%`, background:zone, borderRadius:6, transition:"width 0.8s ease" }} />
        </div>
        <div style={{ display:"flex", justifyContent:"space-between" }}>
          <span style={{ fontFamily:mono, fontSize:9, color:T.red }}>Low differentiation</span>
          <span style={{ fontFamily:mono, fontSize:11, color:zone, fontWeight:700 }}>{score.toFixed(2)}</span>
          <span style={{ fontFamily:mono, fontSize:9, color:T.green }}>High differentiation</span>
        </div>
      </div>
    );
  }

  if (visual.type === "dual") {
    const { a, b } = visual;
    return (
      <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
        {[a, b].map(item => (
          <div key={item.label}>
            <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
              <span style={{ fontFamily:mono, fontSize:11, color:T.inkFaint }}>{item.label}</span>
              <span style={{ fontFamily:mono, fontSize:11, color }}>{item.score.toFixed(2)} / {item.max}</span>
            </div>
            <div style={{ height:6, background:T.creamDark, borderRadius:3 }}>
              <div style={{ height:"100%", width:`${(item.score/item.max)*100}%`, background:color, borderRadius:3, transition:"width 0.8s ease" }} />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (visual.type === "axes") {
    const { pvq } = visual;
    const axes = [
      { label:"Self-transcendence", score:pvq.selfTranscendence, color:"#1A5C2A" },
      { label:"Openness to change", score:pvq.opennessToChange,  color:T.blue },
      { label:"Conservation",       score:pvq.conservation,      color:T.gold },
      { label:"Self-enhancement",   score:pvq.selfEnhancement,   color:T.red },
    ];
    return (
      <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
        {axes.map(ax => (
          <div key={ax.label}>
            <div style={{ display:"flex", justifyContent:"space-between", marginBottom:3 }}>
              <span style={{ fontFamily:mono, fontSize:10, color:T.inkFaint }}>{ax.label}</span>
              <span style={{ fontFamily:mono, fontSize:10, color:ax.color }}>{ax.score.toFixed(1)} / 6</span>
            </div>
            <div style={{ height:5, background:T.creamDark, borderRadius:3 }}>
              <div style={{ height:"100%", width:`${(ax.score/6)*100}%`, background:ax.color, borderRadius:3, transition:"width 0.8s ease" }} />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return null;
}

function InsightScreen({ insight, onContinue, nextLabel }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => { const t = setTimeout(() => setVisible(true), 80); return () => clearTimeout(t); }, []);

  return (
    <Shell>
      <Container>
        <div style={{ opacity: visible ? 1 : 0, transform: visible ? "translateY(0)" : "translateY(20px)", transition:"all 0.5s ease" }}>

          {/* Header */}
          <div style={{ marginBottom:32 }}>
            <div style={{ fontFamily:mono, fontSize:10, color:insight.color, letterSpacing:3, textTransform:"uppercase", marginBottom:8 }}>
              ✦ Insight unlocked · {insight.instrument}
            </div>
            <h1 style={{ fontFamily:serif, fontSize:28, fontWeight:400, color:T.ink, lineHeight:1.2, marginBottom:0 }}>
              {insight.headline}
            </h1>
          </div>

          {/* Visual */}
          <div style={{ marginBottom:24 }}>
            <InsightVisual visual={insight.visual} color={insight.color} />
          </div>

          {/* Stat pill */}
          <div style={{ display:"inline-flex", gap:10, alignItems:"center", background:T.creamDark, border:`1px solid ${T.border}`, borderLeft:`3px solid ${insight.color}`, padding:"8px 14px", marginBottom:24 }}>
            <span style={{ fontFamily:mono, fontSize:10, color:T.inkFaint }}>{insight.statLabel}:</span>
            <span style={{ fontFamily:mono, fontSize:11, color:insight.color }}>{insight.stat}</span>
          </div>

          {/* Body */}
          <div style={{ background:T.surface, border:`1px solid ${T.border}`, borderLeft:`3px solid ${insight.color}`, padding:"20px 22px", marginBottom:16 }}>
            <p style={{ fontFamily:serif, fontSize:16, lineHeight:1.75, color:T.inkLight }}>{insight.body}</p>
          </div>

          {/* Growth edge */}
          <div style={{ padding:"16px 22px", marginBottom: insight.calibrationNote ? 16 : 32, borderLeft:`2px solid ${T.border}` }}>
            <div style={{ fontFamily:mono, fontSize:10, color:T.inkFaint, letterSpacing:2, textTransform:"uppercase", marginBottom:8 }}>Worth noticing</div>
            <p style={{ fontFamily:serif, fontSize:15, lineHeight:1.7, color:T.inkFaint, fontStyle:"italic" }}>{insight.edge}</p>
          </div>

          {/* Calibration note — only for low-history users on ECR */}
          {insight.calibrationNote && (
            <div style={{
              background:T.goldSoft, border:`1px solid ${T.goldLight}`,
              borderLeft:`3px solid ${T.gold}`,
              padding:"14px 18px", marginBottom:32,
            }}>
              <div style={{ fontFamily:mono, fontSize:10, color:T.gold, letterSpacing:2, textTransform:"uppercase", marginBottom:6 }}>Confidence note</div>
              <p style={{ fontFamily:serif, fontSize:14, lineHeight:1.65, color:T.inkLight }}>{insight.calibrationNote}</p>
            </div>
          )}

          {/* CTA */}
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", borderTop:`1px solid ${T.border}`, paddingTop:24 }}>
            <span style={{ fontFamily:mono, fontSize:11, color:T.inkFaint }}>This insight will appear in your full profile.</span>
            <Btn onClick={onContinue}>
              Continue to {nextLabel} →
            </Btn>
          </div>
        </div>
      </Container>
    </Shell>
  );
}


// ─────────────────────────────────────────────
// RELATIONSHIP HISTORY SCREEN
// Single screening question before ECR.
// Determines adaptive framing + algorithm confidence weight.
// ─────────────────────────────────────────────
function RelationshipHistoryScreen({ onComplete }) {
  const [selected, setSelected] = useState(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => { const t = setTimeout(() => setVisible(true), 80); return () => clearTimeout(t); }, []);

  const options = [
    { id:"substantial", label:"Yes — at least one relationship lasting 3+ months" },
    { id:"limited",     label:"Some — brief relationships or situationships, nothing long-term" },
    { id:"none",        label:"Not really — I haven't been in a romantic relationship" },
  ];

  return (
    <Shell>
      <Container>
        <div style={{ opacity:visible?1:0, transform:visible?"translateY(0)":"translateY(16px)", transition:"all 0.5s ease" }}>
          <Label color={"#6B3FA0"}>Before we begin · Attachment</Label>
          <Heading size={24}>How much romantic relationship experience do you have?</Heading>
          <Body muted style={{ marginBottom:32, fontSize:14 }}>
            This helps us interpret your attachment responses accurately. There's no wrong answer — it changes how we frame the questions, not how we judge them.
          </Body>

          <div style={{ display:"flex", flexDirection:"column", gap:10, marginBottom:36 }}>
            {options.map(opt => (
              <button key={opt.id} onClick={() => setSelected(opt.id)} style={{
                background: selected===opt.id ? T.ink : T.surface,
                border:`1px solid ${selected===opt.id ? T.ink : T.border}`,
                borderLeft:`3px solid ${selected===opt.id ? "#6B3FA0" : "transparent"}`,
                padding:"16px 20px", cursor:"pointer", textAlign:"left", borderRadius:2,
                color: selected===opt.id ? T.cream : T.inkLight,
                fontFamily:serif, fontSize:15, lineHeight:1.5,
              }}>
                {opt.label}
              </button>
            ))}
          </div>

          <div style={{ borderTop:`1px solid ${T.border}`, paddingTop:24, display:"flex", justifyContent:"flex-end" }}>
            <Btn onClick={() => onComplete(selected)} disabled={!selected}>
              Begin Attachment Assessment →
            </Btn>
          </div>
        </div>
      </Container>
    </Shell>
  );
}

function HomeScreen({ onStart }) {
  return (
    <Shell>
      <Container>
        <div style={{ animation:"fadeUp 0.6s ease both" }}>
          <div style={{ borderBottom:`1px solid ${T.border}`, paddingBottom:40, marginBottom:40 }}>
            <Label>Relationship Science</Label>
            <Heading size={42}>Know yourself<br/>before you meet.</Heading>
            <Body>
              A research-grounded assessment built on Gottman Method, EFT, and the Joel et al. (2020) machine learning study across 43 longitudinal datasets. Three validated psychometric instruments. Fifteen reflective questions. One honest profile.
            </Body>
          </div>

          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16, marginBottom:40 }}>
            {[
              { label:"ECR-12", desc:"Attachment anxiety & avoidance",   time:"3 min",  color:"#6B3FA0" },
              { label:"TIPI",   desc:"Big Five personality dimensions",   time:"2 min",  color:T.green },
              { label:"DSI-SF", desc:"Differentiation of self",           time:"4 min",  color:T.red },
              { label:"BRS",    desc:"Resilience & bounce-back capacity", time:"90 sec", color:"#2A5C5C" },
              { label:"PVQ-21", desc:"Schwartz core human values",        time:"4 min",  color:T.blue },
              { label:"9 Qs",   desc:"Open-ended & scenario questions",   time:"7 min",  color:T.gold },
            ].map(item => (
              <div key={item.label} style={{ background:T.surface, border:`1px solid ${T.border}`, padding:"16px 18px", borderLeft:`3px solid ${item.color}` }}>
                <div style={{ fontFamily:mono, fontSize:11, color:item.color, marginBottom:4 }}>{item.label} · {item.time}</div>
                <div style={{ fontFamily:serif, fontSize:14, color:T.inkLight }}>{item.desc}</div>
              </div>
            ))}
          </div>

          <div style={{ display:"flex", gap:12, alignItems:"center", flexWrap:"wrap" }}>
            <Btn onClick={onStart}>Begin — ~21 min →</Btn>
            <span style={{ fontFamily:mono, fontSize:11, color:T.inkFaint }}>No right answers · Scientifically grounded</span>
          </div>
        </div>
      </Container>
    </Shell>
  );
}

// ─────────────────────────────────────────────
// TYPOLOGY TEST SCREEN (ECR / TIPI / DSI)
// ─────────────────────────────────────────────
function TypologyScreen({ section, items, answers, onAnswer, onComplete, scaleMax=7, scaleLow="Disagree strongly", scaleHigh="Agree strongly", instructions=null }) {
  const [idx, setIdx] = useState(0);
  const item = items[idx];
  const val = answers[item.id];
  const color = section.color;

  const next = () => {
    if (idx < items.length - 1) setIdx(i => i+1);
    else onComplete();
  };

  return (
    <Shell>
      <Container>
        <ProgressBar current={idx+1} total={items.length} color={color} />
        <Label color={color}>{section.label} · {section.subtitle}</Label>

        {/* Adaptive framing banner — shown only on first item */}
        {instructions && idx === 0 && (
          <div style={{
            background: T.goldSoft, border:`1px solid ${T.goldLight}`,
            borderLeft:`3px solid ${T.gold}`,
            padding:"12px 16px", marginBottom:20,
            fontFamily:serif, fontSize:14, color:T.inkLight, lineHeight:1.6,
          }}>
            <span style={{ fontFamily:mono, fontSize:10, color:T.gold, letterSpacing:2, textTransform:"uppercase", display:"block", marginBottom:4 }}>A note on these questions</span>
            {instructions}
          </div>
        )}

        <div style={{ marginBottom:40, animation:"fadeUp 0.4s ease both" }} key={idx}>
          <div style={{ fontFamily:mono, fontSize:11, color:T.inkFaint, marginBottom:16 }}>
            {idx+1} of {items.length}
          </div>
          <Heading size={22}>{item.text}</Heading>
          <Body muted>Rate how well this describes you.</Body>
          <div style={{ marginTop:28 }}>
            <LikertScale
              value={val}
              onChange={v => onAnswer(item.id, v)}
              low={scaleLow}
              high={scaleHigh}
              max={scaleMax}
              color={color}
            />
          </div>
        </div>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <Btn secondary small onClick={() => setIdx(i => Math.max(0,i-1))} disabled={idx===0}>← Back</Btn>
          <Btn onClick={next} disabled={val===undefined}>
            {idx < items.length-1 ? "Next →" : "Complete →"}
          </Btn>
        </div>
      </Container>
    </Shell>
  );
}

// ─────────────────────────────────────────────
// ASSESSMENT SCREEN (15 Qs)
// ─────────────────────────────────────────────
function AssessmentScreen({ onComplete }) {
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState({});
  const [followUps, setFollowUps] = useState({});
  const [showFollowUp, setShowFollowUp] = useState(false);
  const [text, setText] = useState("");
  const [choiceVal, setChoiceVal] = useState(null);
  const q = QUESTIONS[idx];
  const pillar = PILLARS.find(p => p.id === q.pillar);
  const textRef = useRef(null);

  useEffect(() => {
    setText("");
    setChoiceVal(null);
    setShowFollowUp(false);
    if (textRef.current) textRef.current.focus();
  }, [idx]);

  const canProceed = () => {
    if (q.format === "open") return showFollowUp ? text.trim().length > 0 : text.trim().length > 10;
    if (q.format === "choice") return choiceVal !== null;
    return false;
  };

  const handleNext = () => {
    if (q.format === "open") {
      if (!showFollowUp && q.followUp) {
        setAnswers(p => ({ ...p, [q.id]: text }));
        setText(followUps[q.id] || "");
        setShowFollowUp(true);
        return;
      }
      const finalAnswer = showFollowUp ? (answers[q.id] + " | Follow-up: " + text) : text;
      setAnswers(p => ({ ...p, [q.id]: finalAnswer }));
      setFollowUps(p => ({ ...p, [q.id]: text }));
    } else if (q.format === "choice") {
      setAnswers(p => ({ ...p, [q.id]: q.options[choiceVal] }));
    }

    if (idx < QUESTIONS.length - 1) {
      setIdx(i => i+1);
    } else {
      onComplete(answers, followUps);
    }
  };

  return (
    <Shell>
      <Container>
        <ProgressBar current={idx+1} total={QUESTIONS.length} color={pillar.color} />

        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:28 }}>
          <Label color={pillar.color}>{pillar.name}</Label>
          <span style={{ fontFamily:mono, fontSize:11, color:T.inkFaint }}>{idx+1} / {QUESTIONS.length}</span>
        </div>

        <div style={{ animation:"fadeUp 0.35s ease both" }} key={`${idx}-${showFollowUp}`}>
          {showFollowUp && (
            <div style={{ fontFamily:mono, fontSize:11, color:pillar.color, marginBottom:12 }}>↳ Follow-up</div>
          )}

          <Heading size={20}>
            {q.format === "open" && (showFollowUp ? q.followUp : q.prompt)}
            {q.format !== "open" && (showFollowUp ? q.followUpPrompt : q.prompt)}
          </Heading>

          {q.hint && !showFollowUp && (
            <Body muted style={{ fontSize:13, marginBottom:24, fontStyle:"italic" }}>{q.hint}</Body>
          )}

          <div style={{ marginTop:24 }}>
            {/* OPEN */}
            {q.format === "open" && (
              <textarea ref={textRef} value={text} onChange={e=>setText(e.target.value)}
                onKeyDown={e => { if (e.key==="Enter" && e.metaKey && canProceed()) handleNext(); }}
                placeholder="Write your answer here..."
                rows={5}
                style={{
                  width:"100%", background:T.surface, border:`1px solid ${T.border}`,
                  borderLeft:`3px solid ${pillar.color}`,
                  padding:"16px 18px", fontFamily:serif, fontSize:15,
                  lineHeight:1.7, color:T.ink, resize:"vertical", borderRadius:2,
                }}
              />
            )}

            {/* CHOICE */}
            {q.format === "choice" && (
              <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
                {q.options.map((opt,i) => (
                  <button key={i} onClick={()=>setChoiceVal(i)} style={{
                    background: choiceVal===i ? T.ink : T.surface,
                    border:`1px solid ${choiceVal===i ? T.ink : T.border}`,
                    color: choiceVal===i ? T.cream : T.inkLight,
                    padding:"14px 18px", fontFamily:serif, fontSize:15,
                    textAlign:"left", cursor:"pointer", borderRadius:2,
                    lineHeight:1.5, borderLeft: choiceVal===i ? `3px solid ${pillar.color}` : `3px solid transparent`,
                  }}>
                    <span style={{ fontFamily:mono, fontSize:11, marginRight:10, opacity:0.5 }}>{String.fromCharCode(65+i)}.</span>
                    {opt}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <Divider />
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <span style={{ fontFamily:mono, fontSize:10, color:T.inkFaint }}>
            {q.format === "open" ? "⌘ + Enter to continue" : ""}
          </span>
          <Btn onClick={handleNext} disabled={!canProceed()}>
            {idx === QUESTIONS.length-1 && (showFollowUp || !q.followUp || q.format!=="open")
              ? "See my profile →"
              : "Continue →"}
          </Btn>
        </div>
      </Container>
    </Shell>
  );
}

// ─────────────────────────────────────────────
// SCORING SCREEN
// ─────────────────────────────────────────────
function ScoringScreen() {
  const [dots, setDots] = useState(1);
  useEffect(() => {
    const t = setInterval(() => setDots(d => d%3+1), 600);
    return () => clearInterval(t);
  }, []);
  return (
    <Shell center>
      <Container style={{ textAlign:"center" }}>
        <div style={{ fontFamily:serif, fontSize:60, color:T.goldLight, marginBottom:24, animation:"pulse 2s ease infinite" }}>◎</div>
        <Heading size={24}>Analyzing your responses</Heading>
        <Body muted>Scoring across 9 pillars{".".repeat(dots)}</Body>
      </Container>
    </Shell>
  );
}

// ─────────────────────────────────────────────
// PROFILE SCREEN
// ─────────────────────────────────────────────
function ProfileScreen({ profile, onMatch, loadingMatch }) {
  const [expanded, setExpanded] = useState(null);
  const overall = Math.round(PILLARS.reduce((s,p) => s + (profile.pillarScores[p.id]||5)*p.weight*10, 0));

  return (
    <Shell>
      <Container>
        <Label>Your Relational Profile</Label>
        <Heading>How you show up<br/>in relationship.</Heading>

        {/* Attachment + Resilience badges */}
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:12 }}>
          <div style={{ background:T.surface, border:`1px solid ${T.border}`, padding:"14px 18px", display:"flex", gap:12, alignItems:"center" }}>
            <div style={{ width:10, height:10, borderRadius:"50%", background:"#6B3FA0", flexShrink:0 }} />
            <div>
              <div style={{ fontFamily:mono, fontSize:10, color:T.inkFaint, marginBottom:2 }}>Attachment Style</div>
              <div style={{ fontFamily:serif, fontSize:15, color:T.ink }}>{profile.attachmentStyle}</div>
            </div>
          </div>
          <div style={{ background:T.surface, border:`1px solid ${T.border}`, padding:"14px 18px", display:"flex", gap:12, alignItems:"center" }}>
            <div style={{ width:10, height:10, borderRadius:"50%", background:"#2A5C5C", flexShrink:0 }} />
            <div>
              <div style={{ fontFamily:mono, fontSize:10, color:T.inkFaint, marginBottom:2 }}>Resilience</div>
              <div style={{ fontFamily:serif, fontSize:15, color:T.ink }}>{profile.resilienceLevel || "Moderate"}</div>
            </div>
          </div>
          {profile.valuesProfile && (
            <div style={{ background:T.surface, border:`1px solid ${T.border}`, padding:"14px 18px", display:"flex", gap:12, alignItems:"center", gridColumn:"1/-1" }}>
              <div style={{ width:10, height:10, borderRadius:"50%", background:T.blue, flexShrink:0 }} />
              <div style={{ flex:1 }}>
                <div style={{ fontFamily:mono, fontSize:10, color:T.inkFaint, marginBottom:2 }}>Values Orientation</div>
                <div style={{ fontFamily:serif, fontSize:15, color:T.ink }}>{profile.valuesProfile.valuesAxis}</div>
              </div>
              <div style={{ fontFamily:mono, fontSize:11, color:T.blue }}>Top value: {profile.valuesProfile.topValue}</div>
            </div>
          )}
        </div>

        {/* Overall score */}
        <div style={{ fontFamily:mono, fontSize:13, color:T.inkFaint, marginBottom:28 }}>
          Overall readiness score: <span style={{ fontFamily:serif, fontSize:22, color:T.goldLight }}>{overall}</span><span style={{ fontSize:11 }}>/100</span>
        </div>

        {/* Pillar bars */}
        <div style={{ display:"flex", flexDirection:"column", gap:2, marginBottom:28 }}>
          {PILLARS.map(p => {
            const score = profile.pillarScores[p.id] || 5;
            const isOpen = expanded === p.id;
            return (
              <div key={p.id}>
                <button onClick={()=>setExpanded(isOpen?null:p.id)} style={{
                  width:"100%", background: isOpen ? T.creamDark : T.surface,
                  border:"none", borderLeft:`3px solid ${p.color}`,
                  padding:"14px 18px", cursor:"pointer", textAlign:"left",
                  display:"flex", alignItems:"center", gap:16,
                }}>
                  <div style={{ flex:1 }}>
                    <div style={{ display:"flex", justifyContent:"space-between", marginBottom:6 }}>
                      <span style={{ fontFamily:serif, color:T.ink, fontSize:14 }}>{p.name}</span>
                      <span style={{ fontFamily:mono, color:p.color, fontSize:13 }}>{score}/10</span>
                    </div>
                    <div style={{ height:2, background:T.border }}>
                      <div style={{ height:"100%", width:`${score*10}%`, background:p.color, transition:"width 0.8s ease" }} />
                    </div>
                  </div>
                  <span style={{ color:T.inkFaint, fontSize:10 }}>{isOpen?"▲":"▼"}</span>
                </button>
                {isOpen && (
                  <div style={{ background:T.creamDark, borderLeft:`3px solid ${p.color}`, padding:"14px 18px" }}>
                    <Body style={{ fontSize:13 }}>
                      Score of {score}/10 on {p.name}.
                      {score >= 7 ? " This is a genuine strength in your relational profile." :
                       score >= 5 ? " This area shows developing capacity with room to grow." :
                       " This is a growth edge worth attention."}
                    </Body>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Strengths + growth */}
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:28 }}>
          <div style={{ background:T.surface, borderLeft:`3px solid ${T.green}`, padding:16 }}>
            <Label color={T.green}>Strengths</Label>
            {(profile.strengths||[]).map((s,i) => (
              <Body key={i} style={{ fontSize:13, marginBottom:4 }}>· {s}</Body>
            ))}
          </div>
          <div style={{ background:T.surface, borderLeft:`3px solid ${T.gold}`, padding:16 }}>
            <Label color={T.gold}>Growth Edges</Label>
            {(profile.growthEdges||[]).map((g,i) => (
              <Body key={i} style={{ fontSize:13, marginBottom:4 }}>· {g}</Body>
            ))}
          </div>
        </div>

        {/* Summary */}
        <div style={{ background:T.surface, border:`1px solid ${T.border}`, borderLeft:`3px solid ${T.gold}`, padding:"20px 22px", marginBottom:32 }}>
          <Label>Research-Based Read</Label>
          <Body>{profile.profileSummary}</Body>
        </div>

        <Btn onClick={onMatch} disabled={loadingMatch} style={{ width:"100%", justifyContent:"center", textAlign:"center" }}>
          {loadingMatch ? "Running compatibility analysis..." : "See demo match →"}
        </Btn>
      </Container>
    </Shell>
  );
}

// ─────────────────────────────────────────────
// MATCH SCREEN
// ─────────────────────────────────────────────
function MatchScreen({ match, userProfile, onBack }) {
  if (!match) return <ScoringScreen />;
  const pc = match.pillarCompatibility || {};

  return (
    <Shell>
      <Container>
        <Label>Compatibility Report</Label>
        <Heading>Your match analysis.</Heading>

        {/* Score */}
        <div style={{ textAlign:"center", padding:"40px 0", borderTop:`1px solid ${T.border}`, borderBottom:`1px solid ${T.border}`, margin:"24px 0" }}>
          <div style={{ fontFamily:serif, fontSize:80, color:T.goldLight, lineHeight:1 }}>{match.overallScore}</div>
          <div style={{ fontFamily:mono, fontSize:11, color:T.inkFaint, marginTop:8, letterSpacing:2 }}>OVERALL COMPATIBILITY</div>
        </div>

        {/* Pillar bars — dual */}
        <div style={{ marginBottom:32 }}>
          <Label>Pillar Breakdown</Label>
          {PILLARS.map(p => {
            const compat = pc[p.id] || 70;
            const myScore = (userProfile?.pillarScores?.[p.id] || 5) * 10;
            return (
              <div key={p.id} style={{ marginBottom:14 }}>
                <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
                  <span style={{ fontFamily:mono, fontSize:11, color:T.inkFaint }}>{p.name}</span>
                  <span style={{ fontFamily:mono, fontSize:11, color:p.color }}>{compat}%</span>
                </div>
                <div style={{ display:"flex", gap:3 }}>
                  <div style={{ flex:1, height:4, background:T.border, borderRadius:1 }}>
                    <div style={{ width:`${compat}%`, height:"100%", background:p.color, borderRadius:1 }} />
                  </div>
                  <div style={{ flex:1, height:4, background:T.border, borderRadius:1 }}>
                    <div style={{ width:`${myScore}%`, height:"100%", background:p.color, opacity:0.3, borderRadius:1 }} />
                  </div>
                </div>
              </div>
            );
          })}
          <div style={{ fontFamily:mono, fontSize:10, color:T.inkFaint, marginTop:4 }}>
            ■ Compatibility · ■ Your score (faded)
          </div>
        </div>

        {/* Alignment + risk */}
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:24 }}>
          <div style={{ background:T.surface, borderLeft:`3px solid ${T.green}`, padding:16 }}>
            <Label color={T.green}>Strongest Alignment</Label>
            <Body style={{ fontSize:13 }}>{match.strongestAlignment}</Body>
          </div>
          <div style={{ background:T.surface, borderLeft:`3px solid ${T.red}`, padding:16 }}>
            <Label color={T.red}>Area to Navigate</Label>
            <Body style={{ fontSize:13 }}>{match.biggestRisk}</Body>
          </div>
        </div>

        {/* Chemistry note */}
        {match.chemistryNote && (
          <div style={{ background:T.goldSoft, border:`1px solid ${T.goldLight}`, padding:"14px 18px", marginBottom:24, fontFamily:serif, fontSize:14, color:T.gold, fontStyle:"italic" }}>
            "{match.chemistryNote}"
          </div>
        )}

        {/* Summary */}
        <div style={{ background:T.surface, border:`1px solid ${T.border}`, borderLeft:`3px solid ${T.gold}`, padding:"20px 22px", marginBottom:32 }}>
          <Label>The Full Read</Label>
          <Body>{match.summary}</Body>
        </div>

        <Btn secondary onClick={onBack}>← Back to profile</Btn>
      </Container>
    </Shell>
  );
}

// ─────────────────────────────────────────────
// ROOT APP
// ─────────────────────────────────────────────
export default function App() {
  const [screen, setScreen] = useState("home");
  const [typologyAnswers, setTypologyAnswers] = useState({});
  const [assessAnswers, setAssessAnswers] = useState({});
  const [relationshipHistory, setRelationshipHistory] = useState("substantial");
  const [profile, setProfile] = useState(null);
  const [match, setMatch] = useState(null);
  const [loadingMatch, setLoadingMatch] = useState(false);

  const updateTypology = (id, val) => setTypologyAnswers(p => ({ ...p, [id]: val }));

  const handleAssessComplete = async (answers) => {
    setAssessAnswers(answers);
    setScreen("scoring");

    const ecr = scoreECR(typologyAnswers);
    const tipi = scoreTIPI(typologyAnswers);
    const dsi = scoreDSI(typologyAnswers);
    const brs = scoreBRS(typologyAnswers);
    const pvq = scorePVQ(typologyAnswers);
    const lowHistory = relationshipHistory !== "substantial";

    const pillarAnswers = QUESTIONS.map(q => ({
      qid: q.id, pillar: q.pillar,
      answer: answers[q.id] || "(no answer)"
    }));

    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method:"POST",
        headers:{ "Content-Type":"application/json" },
        body: JSON.stringify({
          model:"claude-sonnet-4-20250514",
          max_tokens:1000,
          messages:[{ role:"user", content: buildAlgorithmPrompt({ ecr, tipi, dsi, brs, pvq, lowHistory }, pillarAnswers) }]
        })
      });
      const data = await res.json();
      const text = data.content?.[0]?.text || "{}";
      const clean = text.replace(/```json|```/g,"").trim();
      setProfile(JSON.parse(clean));
    } catch {
      // Fallback profile
      setProfile({
        pillarScores:{ 1:7,2:6,3:8,4:7,5:7,6:6,7:8,8:7,9:6 },
        attachmentStyle:"Secure",
        strengths:["Strong accountability","High curiosity"],
        growthEdges:["Desire communication","Stress spillover awareness"],
        profileSummary:"Your responses indicate a grounded relational capacity with particular strength in accountability and friendship. The narrative evidence suggests real behavioral change over time rather than just intellectual awareness. The main growth edge is in communicating needs around intimacy — not absence of desire, but of vocabulary for it."
      });
    }
    setScreen("profile");
  };

  const handleMatch = async () => {
    setLoadingMatch(true);
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method:"POST",
        headers:{ "Content-Type":"application/json" },
        body: JSON.stringify({
          model:"claude-sonnet-4-20250514",
          max_tokens:1000,
          messages:[{ role:"user", content: buildMatchPrompt(profile, {}, relationshipHistory !== "substantial") }]
        })
      });
      const data = await res.json();
      const text = data.content?.[0]?.text || "{}";
      const clean = text.replace(/```json|```/g,"").trim();
      setMatch(JSON.parse(clean));
    } catch {
      setMatch({
        overallScore:76,
        pillarCompatibility:{ 1:82,2:88,3:74,4:90,5:78,6:62,7:91,8:74,9:70 },
        strongestAlignment:"Friendship & Joy — both show high curiosity and play capacity",
        biggestRisk:"Desire & Boundaries — communication styles differ; worth an early conversation",
        chemistryNote:"The kind of pairing that does the dishes together and still finds something interesting to say.",
        summary:"Strong foundational alignment on trust and positive affect. Attachment security levels suggest a stable base with low pursue-withdraw risk. The main area to navigate is desire communication — not a dealbreaker, but worth naming early rather than letting it accumulate."
      });
    }
    setLoadingMatch(false);
    setScreen("match");
  };

  if (screen === "home") return <HomeScreen onStart={() => setScreen("ecr_history")} />;

  if (screen === "ecr_history") return (
    <RelationshipHistoryScreen onComplete={(history) => {
      setRelationshipHistory(history);
      setScreen("ecr");
    }} />
  );

  if (screen === "ecr") {
    const lowHistory = relationshipHistory !== "substantial";
    const ecrInstructions = lowHistory
      ? relationshipHistory === "none"
        ? "You haven't been in a romantic relationship — and that's fine. Answer based on your closest non-romantic relationships (close friends, family), or on how you imagine you'd feel in a relationship. Your responses are still meaningful."
        : "You have some relationship experience but nothing long-term. Answer based on what you've felt in those connections, however brief — or imagine how you'd respond if things went deeper."
      : null;
    return (
      <TypologyScreen
        section={{ id:"ecr", label:"Attachment Assessment", subtitle:"ECR-12 · 12 items · ~3 min", color:"#6B3FA0", total:12 }}
        items={ECR12}
        answers={typologyAnswers}
        onAnswer={updateTypology}
        onComplete={() => setScreen("ecr_insight")}
        scaleLow="Disagree strongly"
        scaleHigh="Agree strongly"
        instructions={ecrInstructions}
      />
    );
  }

  if (screen === "ecr_insight") return (
    <InsightScreen
      insight={getECRInsight(typologyAnswers, relationshipHistory)}
      onContinue={() => setScreen("tipi")}
      nextLabel="Personality"
    />
  );

  if (screen === "tipi") return (
    <TypologyScreen
      section={{ id:"tipi", label:"Personality Assessment", subtitle:"TIPI · 10 items · ~2 min", color:T.green, total:10 }}
      items={TIPI}
      answers={typologyAnswers}
      onAnswer={updateTypology}
      onComplete={() => setScreen("tipi_insight")}
      scaleLow="Disagree strongly"
      scaleHigh="Agree strongly"
    />
  );

  if (screen === "tipi_insight") return (
    <InsightScreen
      insight={getTIPIInsight(typologyAnswers)}
      onContinue={() => setScreen("dsi")}
      nextLabel="Self & Others"
    />
  );

  if (screen === "dsi") return (
    <TypologyScreen
      section={{ id:"dsi", label:"Self & Others Assessment", subtitle:"DSI-SF · 20 items · ~4 min", color:T.red, total:20 }}
      items={DSI}
      answers={typologyAnswers}
      onAnswer={updateTypology}
      onComplete={() => setScreen("dsi_insight")}
      scaleMax={6}
      scaleLow="Never true"
      scaleHigh="Always true"
    />
  );

  if (screen === "dsi_insight") return (
    <InsightScreen
      insight={getDSIInsight(typologyAnswers)}
      onContinue={() => setScreen("brs")}
      nextLabel="Resilience"
    />
  );

  if (screen === "brs") return (
    <TypologyScreen
      section={{ id:"brs", label:"Resilience Assessment", subtitle:"BRS · 6 items · ~90 sec", color:"#2A5C5C", total:6 }}
      items={BRS}
      answers={typologyAnswers}
      onAnswer={updateTypology}
      onComplete={() => setScreen("brs_insight")}
      scaleMax={5}
      scaleLow="Strongly disagree"
      scaleHigh="Strongly agree"
    />
  );

  if (screen === "brs_insight") return (
    <InsightScreen
      insight={getBRSInsight(typologyAnswers)}
      onContinue={() => setScreen("pvq")}
      nextLabel="Values"
    />
  );

  if (screen === "pvq") return (
    <TypologyScreen
      section={{ id:"pvq", label:"Values Assessment", subtitle:"PVQ-21 · 21 items · ~4 min", color:T.blue, total:21 }}
      items={PVQ21}
      answers={typologyAnswers}
      onAnswer={updateTypology}
      onComplete={() => setScreen("pvq_insight")}
      scaleMax={6}
      scaleLow="Not like me at all"
      scaleHigh="Very much like me"
    />
  );

  if (screen === "pvq_insight") return (
    <InsightScreen
      insight={getPVQInsight(typologyAnswers)}
      onContinue={() => setScreen("assess")}
      nextLabel="Your Story"
    />
  );

  if (screen === "assess") return (
    <AssessmentScreen onComplete={handleAssessComplete} />
  );

  if (screen === "scoring") return <ScoringScreen />;

  if (screen === "profile") return (
    <ProfileScreen profile={profile} onMatch={handleMatch} loadingMatch={loadingMatch} />
  );

  if (screen === "match") return (
    <MatchScreen match={match} userProfile={profile} onBack={() => setScreen("profile")} />
  );

  return null;
}
