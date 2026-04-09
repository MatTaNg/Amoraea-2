import { ACCOUNTABILITY_BLAME_SHIFT_VS_CLARITY_REQUEST, SCORE_CALIBRATION_0_10 } from './interviewScoringCalibration';

export function buildPersonalMomentScoringPrompt(
  momentNumber: 4 | 5,
  transcript: { role: string; content: string }[]
): string {
  const momentMeta =
    momentNumber === 4
      ? {
          name: 'Moment 4 (Personal Grudge/Dislike)',
          constructs:
            'contempt_recognition (only ongoing bitterness/hostility toward the real person named), contempt_expression, commitment_threshold, accountability, mentalizing — NOT repair, NOT attunement, NOT appreciation, NOT regulation',
          markerIds: [
            'contempt_recognition',
            'contempt_expression',
            'commitment_threshold',
            'accountability',
            'mentalizing',
          ] as const,
        }
      : {
          name: 'Moment 5 (Personal Appreciation)',
          constructs:
            'appreciation, attunement, mentalizing, contempt_expression (participant dismissive/derogatory framing in their own words, if any) — NOT accountability, NOT repair, NOT commitment_threshold, NOT regulation, NOT contempt_recognition',
          markerIds: ['appreciation', 'attunement', 'mentalizing', 'contempt_expression'] as const,
        };
  const turns = transcript
    .map((m) => `${m.role === 'user' ? 'User' : 'Interviewer'}: ${m.content}`)
    .join('\n\n');
  const ids = [...momentMeta.markerIds];
  const momentSpecificCalibration =
    momentNumber === 5
      ? `
MOMENT 5 — ANSWER-TYPE BRANCHES (use the full user slice, including any follow-up pivot and response):

1) CONCRETE BEHAVIORAL EXAMPLE: The user describes a specific relational act they did (or clearly recall doing) to celebrate or appreciate someone — enough behavioral and contextual detail that you could picture the scene (specific person, moment or occasion, attunement to the other's state, and how it landed relationally). Score appreciation, attunement, and mentalizing normally from that content.

2) LIMITED CLOSE-RELATIONSHIP EXPERIENCE / NO LIVED EXAMPLE (explicit framing): The user clearly signals sparse opportunity or a non-demonstrative background (e.g. few close relationships, family not big on showing affection, no great example, hard to think of something specific) and is not purely deflecting with zero reflective content. In this branch: set appreciation in pillarScores to JSON null (not 0). In keyEvidence for appreciation, briefly state that appreciation was not assessed from this slice because the user framed limited lived opportunity — absence of a behavioral example must not be scored as low appreciation capacity. Score attunement and mentalizing from what they say about what meaningful celebration would look like, others' needs, or self-reflection (including after a values pivot question if present). Set pillarConfidence for appreciation to "low".

3) PURE DEFLECTION / NO REAL REFLECTION: Brief dodge, empty, or off-topic with no substantive content about celebration, values, or relationships — score appreciation, attunement, and mentalizing low with numeric scores (not null for appreciation).

4) MIXED: If they both frame limited experience AND give a concrete behavioral example, use branch (1).

When appreciation is JSON null per branch (2), output null (not 0) for appreciation in pillarScores.
`
      : momentNumber === 4
        ? `
MOMENT 4 — NON-ENGAGEMENT / DEFLECTION (entire moment):
If the user does not substantively engage with the grudge/dislike question — topic switching, philosophical deflection, vague non-answers with no real person or situation, "I don't hold grudges" without a concrete story when pushed, or other absence of signal — set EVERY listed marker in pillarScores to JSON null (not 0, not 1). Use the SAME keyEvidence string for all markers: "No substantive engagement with grudge/dislike question in this slice — deflection, avoidance, or absent signal." Set pillarConfidence to "low" for each. Numeric scores apply only when there is assessable content.

MOMENT 4 — SCORE 1 ONLY FOR ACTIVE FAILURE (when there IS engagement):
Reserve score 1 for active construct failure: e.g. unreflective contempt expression, explicit refusal of any responsibility, or hostile framing. Do NOT use 1 for mere absence of signal — that is null as above.

MOMENT 4 — CONSTRUCT SCOPE (this slice only):
- **repair:** Do not score. Set \`repair\` to JSON null if present in your template keys, or omit it — this moment does not assess live repair skill.
- **contempt_recognition:** Score ONLY if the user shows ongoing bitterness, hostility, or contemptuous narrative toward the real person they named (not generic conflict description). If there is no assessable signal for that specific recognition strand, use JSON null with keyEvidence noting it was not assessed.
- **contempt_expression:** Score whenever the participant uses dismissive, derogatory, victim framing ("I can't win"), or character verdicts about the person or situation in their own words — across their turns in this slice.
- **attunement:** Do not score. Omit or null — the grudge prompt does not test real-time attunement to another's emotional state.
- **regulation:** Do not score. Omit or null — regulation is assessed only from Scenario C (pursue-withdraw).

MOMENT 4 CALIBRATION ANCHORS (when engagement exists):
- Accountability: Unprompted acknowledgment of avoidant behavior (e.g., "I never confronted it and just distanced myself") is partial accountability and should score around 4-5 minimum. Reserve <=3 for fully externalized blame with no self-awareness.
${ACCOUNTABILITY_BLAME_SHIFT_VS_CLARITY_REQUEST}
- Mentalizing: Limited but present self-awareness/perspective-taking should score at least 3-4; reserve <=2 for zero self-reflection and pure external blame.

COMMITMENT_THRESHOLD (Moment 4 — first-person):
- **Low scores (about 2–4):** Unconditional persistence, "I never walk away," "just keep trying no matter what," or no workable invest/communicate/assess/decide structure — **without** reflective limits or self-critique.
- **7–8 (positive, not a deficit):** The user admits tending to **stay too long** or struggling to leave **and** shows **differentiation** — e.g. working on recognizing **genuine irrecoverability** vs **fear of conflict** / avoidance, or growth-oriented framing of past over-staying. That is **self-knowledge and developing capacity**; **do not** score as unhealthy commitment threshold or conflate with "no limits" staying.

COMMITMENT_THRESHOLD CONFIDENCE (this moment slice):
Reserve "high" pillarConfidence for commitment_threshold when this slice includes clear first-person work-through versus walk-away reasoning (from the follow-up or embedded in the grudge answer) — including a concise but complete invest/communicate/assess/decide structure without procedural detail, **or** clear self-aware differentiation as in the 7–8 anchor above. If threshold signal is absent or purely vague ("just try harder"), use "moderate" or "low".
`
        : '';
  return `You are scoring one personal moment from a relationship assessment interview.

MOMENT: ${momentMeta.name}
MARKERS TO SCORE IN THIS SLICE: ${momentMeta.constructs}

${SCORE_CALIBRATION_0_10}

TRANSCRIPT OF THIS MOMENT ONLY:
${turns}

SCORING INSTRUCTIONS:
Score only the listed markers using only this moment transcript slice.
For each marker: quote or paraphrase the response that most informed the score.
If responses are generic and unspecific, cap that marker at 5.
${momentSpecificCalibration}

When any marker uses JSON null per instructions above, output null (not 0) for that key.

Return ONLY valid JSON:
{
  "momentNumber": ${momentNumber},
  "momentName": "${momentMeta.name}",
  "pillarScores": { ${ids.map((id) => `"${id}": 0`).join(', ')} },
  "pillarConfidence": { ${ids.map((id) => `"${id}": "high"`).join(', ')} },
  "keyEvidence": { ${ids.map((id) => `"${id}": ""`).join(', ')} },
  "summary": "",
  "specificity": "high"
}`;
}
