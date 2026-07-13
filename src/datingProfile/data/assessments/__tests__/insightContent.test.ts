import { describe, expect, it } from '@jest/globals';

import {
  ATTACHMENT_HIGH_ANXIETY_OR_AVOIDANCE_MIN,
  BRS_INSIGHT_HIGH_MIN,
  BRS_INSIGHT_LOW_MAX,
  DSIR_INSIGHT_HIGH_MIN,
  DSIR_INSIGHT_LOW_MAX,
  PVQ_INSIGHT_HIGH_DEVIATION_MIN,
} from '@config/onboarding/assessmentInsightTiers';
import {
  attachmentStyleDisplayName,
  attachmentStyleFromScores,
  getInsightContent,
} from '../insightContent';

describe('insightContent', () => {
  describe('attachmentStyleFromScores', () => {
    const t = ATTACHMENT_HIGH_ANXIETY_OR_AVOIDANCE_MIN;

    it('maps quadrants using config attachment threshold', () => {
      expect(attachmentStyleFromScores(t - 0.1, t - 0.1)).toBe('Secure');
      expect(attachmentStyleFromScores(t, t - 0.1)).toBe('Anxious-Preoccupied');
      expect(attachmentStyleFromScores(t - 0.1, t)).toBe('Dismissive-Avoidant');
      expect(attachmentStyleFromScores(t, t)).toBe('Fearful-Avoidant');
    });
  });

  describe('attachmentStyleDisplayName', () => {
    it('maps internal style keys to user-facing labels', () => {
      expect(attachmentStyleDisplayName('Anxious-Preoccupied')).toBe('Anxious');
      expect(attachmentStyleDisplayName('Unknown')).toBe('Mixed');
    });
  });

  describe('getInsightContent tier copy', () => {
    it('uses DSIR config tiers for differentiation headline', () => {
      const high = getInsightContent('DSI-R', { overall: DSIR_INSIGHT_HIGH_MIN });
      const low = getInsightContent('DSI-R', { overall: DSIR_INSIGHT_LOW_MAX });
      const mid = getInsightContent('DSI-R', { overall: (DSIR_INSIGHT_HIGH_MIN + DSIR_INSIGHT_LOW_MAX) / 2 });

      expect(high.headline).toMatch(/high differentiation/i);
      expect(low.headline).toMatch(/low differentiation/i);
      expect(mid.headline).toMatch(/moderate differentiation/i);
    });

    it('uses BRS config tiers for resilience headline', () => {
      const high = getInsightContent('BRS', { resilience: BRS_INSIGHT_HIGH_MIN });
      const low = getInsightContent('BRS', { resilience: BRS_INSIGHT_LOW_MAX });
      const mid = getInsightContent('BRS', { resilience: (BRS_INSIGHT_HIGH_MIN + BRS_INSIGHT_LOW_MAX) / 2 });

      expect(high.headline).toMatch(/High resilience/i);
      expect(low.headline).toMatch(/Low resilience/i);
      expect(mid.headline).toMatch(/Moderate resilience/i);
    });

    it('labels PVQ value rows High/Low using deviation config', () => {
      const content = getInsightContent('PVQ-21', {
        self_direction: PVQ_INSIGHT_HIGH_DEVIATION_MIN + 0.1,
        conformity: -(PVQ_INSIGHT_HIGH_DEVIATION_MIN + 0.1),
        benevolence: 0,
      });
      const selfDir = content.details?.find((d) => d.label === 'Self Direction');
      const conformity = content.details?.find((d) => d.label === 'Conformity');
      const benevolence = content.details?.find((d) => d.label === 'Benevolence');

      expect(selfDir?.value).toMatch(/^High /);
      expect(conformity?.value).toMatch(/^Low /);
      expect(benevolence?.value).toMatch(/^Moderate /);
    });
  });
});
