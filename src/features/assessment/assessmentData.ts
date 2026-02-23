/**
 * Assessment items and scoring from full_assessment_system.
 * ECR-12, TIPI, DSI-SF, BRS, PVQ-21 — used by FullAssessmentScreen and (optionally) web.
 */

// ─── ECR-12 (Attachment) ─────────────────────────────────────────────────
export const ECR12 = [
  { id: 'e1', sub: 'anxiety' as const, text: "I worry about being abandoned." },
  { id: 'e2', sub: 'avoidance' as const, text: "I prefer not to share my feelings with partners." },
  { id: 'e3', sub: 'anxiety' as const, text: "I worry a lot about my relationships." },
  { id: 'e4', sub: 'avoidance' as const, text: "I find it difficult to depend on romantic partners." },
  { id: 'e5', sub: 'anxiety' as const, text: "I need a lot of reassurance that I am loved." },
  { id: 'e6', sub: 'avoidance' as const, text: "I don't feel comfortable opening up to romantic partners." },
  { id: 'e7', sub: 'anxiety' as const, text: "I get frustrated when my partner is not around as much as I would like." },
  { id: 'e8', sub: 'avoidance' as const, text: "I find it difficult to allow myself to depend on romantic partners." },
  { id: 'e9', sub: 'anxiety' as const, text: "I often worry that my partner doesn't really love me." },
  { id: 'e10', sub: 'avoidance' as const, text: "It's not difficult for me to get close to my partner." },
  { id: 'e11', sub: 'anxiety' as const, text: "My desire to be very close sometimes scares people away." },
  { id: 'e12', sub: 'avoidance' as const, text: "I am comfortable sharing my private thoughts and feelings." },
];
export const ECR_REVERSE = ['e10', 'e12'];
export const ECR_SCALE_MAX = 7;

// ─── TIPI (Big Five) ────────────────────────────────────────────────────
export const TIPI = [
  { id: 't1', trait: 'E' as const, text: 'Extraverted, enthusiastic.', reverse: false },
  { id: 't2', trait: 'A' as const, text: 'Critical, quarrelsome.', reverse: true },
  { id: 't3', trait: 'C' as const, text: 'Dependable, self-disciplined.', reverse: false },
  { id: 't4', trait: 'N' as const, text: 'Anxious, easily upset.', reverse: false },
  { id: 't5', trait: 'O' as const, text: 'Open to new experiences, complex.', reverse: false },
  { id: 't6', trait: 'E' as const, text: 'Reserved, quiet.', reverse: true },
  { id: 't7', trait: 'A' as const, text: 'Sympathetic, warm.', reverse: false },
  { id: 't8', trait: 'C' as const, text: 'Disorganized, careless.', reverse: true },
  { id: 't9', trait: 'N' as const, text: 'Calm, emotionally stable.', reverse: true },
  { id: 't10', trait: 'O' as const, text: 'Conventional, uncreative.', reverse: true },
];
export const TIPI_SCALE_MAX = 7;

// ─── DSI-SF (Differentiation of Self) ─────────────────────────────────────
export const DSI = [
  { id: 'd1', text: 'I am able to speak calmly with family members even when they are upset with me.' },
  { id: 'd2', text: "When I am with others, I feel a pressure to think or feel the same way they do." },
  { id: 'd3', text: "When someone close to me is upset, I am still able to take care of my own needs." },
  { id: 'd4', text: "I often feel responsible for how other people feel." },
  { id: 'd5', text: "I am easily affected by the moods of the people I'm close to." },
  { id: 'd6', text: "When someone I care about is upset, I am able to stay calm." },
  { id: 'd7', text: "It is difficult for me to make important decisions without getting input from people I'm close to." },
  { id: 'd8', text: "I am able to state my views calmly when people close to me disagree." },
  { id: 'd9', text: "I often act on what I think others want rather than on my own wishes." },
  { id: 'd10', text: "My sense of self depends a lot on how others think of me." },
  { id: 'd11', text: "I can remain emotionally calm even when those around me are anxious." },
  { id: 'd12', text: "I am able to be myself even when I am with people who are very different from me." },
  { id: 'd13', text: "I have a clear sense of my own values that guide me." },
  { id: 'd14', text: "I often feel responsible for solving other people's problems." },
  { id: 'd15', text: "Even in emotionally charged discussions, I can stay focused on the issue." },
  { id: 'd16', text: "I need others' approval to feel good about myself." },
  { id: 'd17', text: "I make decisions based on what is right for me, not just what others expect." },
  { id: 'd18', text: "I can listen to others' criticism without feeling personally threatened." },
  { id: 'd19', text: "I feel I must go along with what others want or they will reject me." },
  { id: 'd20', text: "Even when I disagree, I can acknowledge another person's point of view." },
];
export const DSI_REVERSE = ['d2', 'd4', 'd5', 'd7', 'd9', 'd10', 'd14', 'd16', 'd19'];
export const DSI_SCALE_MAX = 6;

// ─── BRS (Resilience) ───────────────────────────────────────────────────
export const BRS = [
  { id: 'b1', text: 'I tend to bounce back quickly after hard times.', reverse: false },
  { id: 'b2', text: 'I have a hard time making it through stressful events.', reverse: true },
  { id: 'b3', text: 'It does not take me long to recover from a stressful event.', reverse: false },
  { id: 'b4', text: 'It is hard for me to snap back when something bad happens.', reverse: true },
  { id: 'b5', text: 'I usually come through difficult times with little trouble.', reverse: false },
  { id: 'b6', text: 'I tend to take a long time to get over set-backs in my life.', reverse: true },
];
export const BRS_SCALE_MAX = 5;

// ─── PVQ-21 (Values) ────────────────────────────────────────────────────
export const PVQ21 = [
  { id: 'v1', value: 'benevolence' as const, text: "It's very important to me to help the people around me. I want to care for other people's well-being." },
  { id: 'v2', value: 'universalism' as const, text: "I think it's important that every person in the world be treated equally. I believe everyone should have equal opportunities in life." },
  { id: 'v3', value: 'benevolence' as const, text: "It's very important to me to be loyal to my friends. I want to devote myself to people close to me." },
  { id: 'v4', value: 'universalism' as const, text: "I strongly believe that people should care for nature. Looking after the environment is important to me." },
  { id: 'v5', value: 'benevolence' as const, text: "It's very important to me to forgive people who have wronged me. I try to see the best in people and to understand them." },
  { id: 'v6', value: 'universalism' as const, text: "I think it is important to listen to people who are different from me. Even when I disagree, I still want to understand them." },
  { id: 'v7', value: 'achievement' as const, text: "Being very successful is important to me. I hope people will recognise my achievements." },
  { id: 'v8', value: 'power' as const, text: "It is important to me to be in charge and tell others what to do. I want people to do what I say." },
  { id: 'v9', value: 'achievement' as const, text: "Getting ahead in life is important to me. I strive to do better than others." },
  { id: 'v10', value: 'power' as const, text: "It is important to me to be rich. I want to have a lot of money and expensive things." },
  { id: 'v11', value: 'self_direction' as const, text: "I think it's important to be interested in things. I like to be curious and to try to understand all sorts of things." },
  { id: 'v12', value: 'stimulation' as const, text: "I like surprises and am always looking for new things to do. I think it is important to do lots of different things in life." },
  { id: 'v13', value: 'self_direction' as const, text: "I believe that people should make their own choices about what they do. It's important to me to be free and not depend on others." },
  { id: 'v14', value: 'stimulation' as const, text: "I am always looking for different things to do. I think it is important to try many different things in life." },
  { id: 'v15', value: 'security' as const, text: "It is important to me to live in secure surroundings. I avoid anything that might endanger my safety." },
  { id: 'v16', value: 'conformity' as const, text: "I believe that people should follow rules even when no-one is watching. It is important to me to always behave properly." },
  { id: 'v17', value: 'tradition' as const, text: "Religious belief or tradition is important to me. I try hard to do what my religion or family values require." },
  { id: 'v18', value: 'security' as const, text: "It is important to me that my country is safe. I think the state must be strong to be able to defend its citizens." },
  { id: 'v19', value: 'conformity' as const, text: "I believe I should always show respect to my parents and to older people. It is important to me to be obedient." },
  { id: 'v20', value: 'tradition' as const, text: "It is important to me to maintain the traditions handed down by my religion or my family. I follow the customs of my family." },
  { id: 'v21', value: 'security' as const, text: "It is important to me that things are orderly and clean. I really don't like things to be a mess." },
];
export const PVQ_SCALE_MAX = 6;

// ─── Scoring ─────────────────────────────────────────────────────────────
export function scoreECR(answers: Record<string, number>) {
  let anxSum = 0, avoSum = 0, anxN = 0, avoN = 0;
  ECR12.forEach((item) => {
    const raw = answers[item.id];
    if (raw === undefined) return;
    const val = ECR_REVERSE.includes(item.id) ? 8 - raw : raw;
    if (item.sub === 'anxiety') {
      anxSum += val;
      anxN++;
    } else {
      avoSum += val;
      avoN++;
    }
  });
  return {
    anxiety: anxN ? anxSum / anxN : 4,
    avoidance: avoN ? avoSum / avoN : 4,
  };
}

export function scoreTIPI(answers: Record<string, number>) {
  const traits: Record<string, number[]> = { E: [], A: [], C: [], N: [], O: [] };
  TIPI.forEach((item) => {
    const raw = answers[item.id];
    if (raw === undefined) return;
    const val = item.reverse ? 8 - raw : raw;
    traits[item.trait].push(val);
  });
  const avg = (arr: number[]) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 4);
  return {
    E: avg(traits.E),
    A: avg(traits.A),
    C: avg(traits.C),
    N: avg(traits.N),
    O: avg(traits.O),
  };
}

export function scoreDSI(answers: Record<string, number>) {
  let sum = 0, n = 0;
  DSI.forEach((item) => {
    const raw = answers[item.id];
    if (raw === undefined) return;
    const val = DSI_REVERSE.includes(item.id) ? 7 - raw : raw;
    sum += val;
    n++;
  });
  return n ? sum / n : 3;
}

export function scoreBRS(answers: Record<string, number>) {
  let sum = 0, n = 0;
  BRS.forEach((item) => {
    const raw = answers[item.id];
    if (raw === undefined) return;
    const val = item.reverse ? 6 - raw : raw;
    sum += val;
    n++;
  });
  return n ? sum / n : 3;
}

export function scorePVQ(answers: Record<string, number>) {
  const groups: Record<string, string[]> = {
    benevolence: ['v1', 'v3', 'v5'],
    universalism: ['v2', 'v4', 'v6'],
    achievement: ['v7', 'v9'],
    power: ['v8', 'v10'],
    self_direction: ['v11', 'v13'],
    stimulation: ['v12', 'v14'],
    security: ['v15', 'v18', 'v21'],
    conformity: ['v16', 'v19'],
    tradition: ['v17', 'v20'],
  };
  const avg = (ids: string[]) => {
    const vals = ids.map((id) => answers[id]).filter((v) => v !== undefined) as number[];
    return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 3.5;
  };
  const g: Record<string, number> = {};
  Object.entries(groups).forEach(([k, ids]) => {
    g[k] = avg(ids);
  });
  return {
    ...g,
    selfTranscendence: (g.benevolence + g.universalism) / 2,
    selfEnhancement: (g.achievement + g.power) / 2,
    opennessToChange: (g.self_direction + g.stimulation) / 2,
    conservation: (g.security + g.conformity + g.tradition) / 3,
  };
}

/** Full assessment payload saved as typology_data for type 'full_assessment' */
export interface FullAssessmentData {
  ecr: Record<string, number>;
  tipi: Record<string, number>;
  dsi: Record<string, number>;
  brs: Record<string, number>;
  pvq: Record<string, number>;
}

export function isFullAssessmentComplete(data: FullAssessmentData | null): boolean {
  if (!data) return false;
  const required = [data.ecr, data.tipi, data.dsi, data.brs, data.pvq];
  const lengths = [ECR12.length, TIPI.length, DSI.length, BRS.length, PVQ21.length];
  return required.every((ans, i) => Object.keys(ans).length >= lengths[i]);
}
