import { describe, expect, it } from 'vitest';
import {
  buildInterviewEvidencePromptBlock,
  buildPersonalInterviewEvidenceBlock,
  composeNarrativeCalibration,
  getGateAwarenessCalibration,
  resolveReportGateNarrativeTier,
  shouldNarrateInstrument,
} from '../narrativeCalibration';

describe('narrativeCalibration', () => {
  it('classifies Jordan as psychometric_floor_only with RSES qualifier', () => {
    const tier = resolveReportGateNarrativeTier({
      finalGatePass: false,
      gateFailReasons: ['rses_low_self_esteem_floor'],
    });
    expect(tier).toBe('psychometric_floor_only');

    const instructions = getGateAwarenessCalibration({
      finalGatePass: false,
      gateFailReasons: ['rses_low_self_esteem_floor'],
      gamingCorrection: {
        correctedModifier: 0,
        originalModifier: -0.5,
        correctionApplied: 0.5,
        additionalPenalty: 0,
        strippedInstruments: ['rses'],
        allPositivesStripped: false,
        correctionLevel: 1,
        activeTriggers: [
          {
            type: 'straight_line',
            instrument: 'rses',
            detail: 'Straight-line on rses',
            level: 1,
          },
        ],
        explanation: 'test',
      },
      pillarScores: {
        repair: 8,
        accountability: 7,
        mentalizing: 8,
        contempt: 8,
        appreciation: 8,
        regulation: 7,
        attunement: 7,
      },
      aaq2Score: 30,
    });

    expect(instructions).toMatch(/PSYCHOMETRIC-ONLY CONCERN TONE/i);
    expect(instructions).toMatch(/self-doubt or self-criticism/i);
    expect(instructions).toMatch(/EXPERIENTIAL AVOIDANCE \(SEPARATE INPUT\)/i);
    expect(instructions).not.toMatch(/INTERVIEW FAIL TONE/i);
  });

  it('classifies interview weighted_score fail with stricter interview tone', () => {
    const instructions = getGateAwarenessCalibration({
      finalGatePass: false,
      gateFailReasons: ['weighted_score'],
      gamingCorrection: null,
      pillarScores: { accountability: 5, repair: 5 },
      aaq2Score: 18,
    });

    expect(instructions).toMatch(/INTERVIEW FAIL TONE/i);
    expect(instructions).not.toMatch(/PSYCHOMETRIC-ONLY CONCERN TONE/i);
  });

  it('returns empty gate calibration when gate is not yet applicable', () => {
    expect(
      getGateAwarenessCalibration({
        finalGatePass: null,
        gateFailReasons: [],
      }),
    ).toBe('');
  });

  it('composeNarrativeCalibration always includes priority and mechanics hiding', () => {
    const block = composeNarrativeCalibration({
      finalGatePass: null,
      gateFailReasons: [],
    });
    expect(block).toMatch(/PRIORITY PRINCIPLE/i);
    expect(block).toMatch(/MECHANICS-HIDING/i);
    expect(block).not.toMatch(/PSYCHOMETRIC-ONLY CONCERN TONE/i);
  });

  it('shouldNarrateInstrument respects stripped instruments and straight-line flags', () => {
    expect(shouldNarrateInstrument(4, 'scs_sf', null, ['scs_sf_straight_line'])).toBe(false);
    expect(shouldNarrateInstrument(4, 'scs_sf', null, ['rses_straight_line'])).toBe(true);
  });

  it('blocks surface-level filler when scenario engagement is strong', () => {
    const block = buildInterviewEvidencePromptBlock({
      pillarScores: { mentalizing: 8, repair: 8, accountability: 7 },
      scenarioMentalizingScores: { scenario1: 8, scenario2: 9, scenario3: 7 },
      scenarioKeyEvidence: {
        scenario1: 'Sophisticated read of partner inner state',
        scenario2: 'Nuanced perspective-taking',
        scenario3: 'Strong emotional inference',
      },
    });
    expect(block).toMatch(/do NOT characterize the interview as broadly "surface-level"/i);
  });

  it('buildPersonalInterviewEvidenceBlock includes M5 and evidence grounding rule', () => {
    const block = buildPersonalInterviewEvidenceBlock({
      pillarScores: { accountability: 7, mentalizing: 8 },
      scenarioKeyEvidence: {
        scenario1: { accountability: 'Named own contribution without prompting' },
      },
      moment5Profile: {
        pillarScores: { accountability: 7, mentalizing: 6 },
        keyEvidence: { accountability: 'Spontaneous ownership of letting things build' },
      },
    });
    expect(block).toMatch(/EVIDENCE GROUNDING RULE/i);
    expect(block).toMatch(/M5 — first-person account/i);
    expect(block).toMatch(/Spontaneous ownership of letting things build/i);
    expect(block).toMatch(/Named own contribution without prompting/i);
  });

  it('buildPersonalInterviewEvidenceBlock degrades gracefully without evidence', () => {
    const block = buildPersonalInterviewEvidenceBlock({
      pillarScores: { repair: 7 },
      scenarioKeyEvidence: null,
      moment5Profile: null,
    });
    expect(block).toMatch(/Personal conflict moment \(M5\): not available/i);
    expect(block).toMatch(/do not invent specific behavioral observations/i);
  });
});
