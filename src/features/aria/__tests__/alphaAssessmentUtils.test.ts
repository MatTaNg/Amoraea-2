import {
  analyzeLanguageMarkers,
  buildScenarioBoundaries,
  calculateConstructAsymmetry,
  calculateScoreConsistency,
} from '../alphaAssessmentUtils';

describe('alphaAssessmentUtils', () => {
  const pillar = (n: number) =>
    Object.fromEntries(
      [
        'mentalizing',
        'accountability',
        'contempt',
        'repair',
        'regulation',
        'attunement',
        'appreciation',
        'commitment_threshold',
      ].map((id) => [id, n])
    ) as Record<string, number>;

  describe('calculateScoreConsistency', () => {
    it('computes mean and std_dev for stable scores across three scenarios', () => {
      const p = pillar(7);
      const r = calculateScoreConsistency(p, p, p);
      expect(r.mentalizing?.mean).toBe(7);
      expect(r.mentalizing?.std_dev).toBe(0);
      expect(r.repair?.s1).toBe(7);
    });

    it('uses combined contempt when slice fields present', () => {
      const s1 = { contempt_expression: 6, contempt_recognition: 8 } as Record<string, number>;
      const s2 = { contempt_expression: 6, contempt_recognition: 8 };
      const s3 = { contempt_expression: 6, contempt_recognition: 8 };
      const r = calculateScoreConsistency(s1, s2, s3);
      expect(r.contempt?.mean).toBeGreaterThan(6);
      expect(r.contempt?.std_dev).toBe(0);
    });
  });

  describe('calculateConstructAsymmetry', () => {
    it('returns empty profile when fewer than two finite constructs', () => {
      const r = calculateConstructAsymmetry({ mentalizing: 7 });
      expect(r.profile_type).toBe('');
      expect(r.gap).toBe(0);
    });

    it('labels balanced when gap ≤ 1.5', () => {
      const r = calculateConstructAsymmetry({
        mentalizing: 6,
        accountability: 7,
        contempt: 6.5,
        repair: 6.5,
        regulation: 6,
        attunement: 6,
        appreciation: 6,
        commitment_threshold: 6,
      });
      expect(r.gap).toBeLessThanOrEqual(1.5);
      expect(r.profile_type).toBe('balanced');
    });

    it('labels moderate lean when 1.5 < gap ≤ 3', () => {
      const r = calculateConstructAsymmetry({
        mentalizing: 9,
        accountability: 6,
        contempt: 6,
        repair: 6,
        regulation: 6,
        attunement: 6,
        appreciation: 6,
        commitment_threshold: 6,
      });
      expect(r.gap).toBeGreaterThan(1.5);
      expect(r.gap).toBeLessThanOrEqual(3);
      expect(r.profile_type).toMatch(/^moderate_/);
    });

    it('labels high spread when gap > 3', () => {
      const r = calculateConstructAsymmetry({
        mentalizing: 9,
        accountability: 4,
        contempt: 6,
        repair: 6,
        regulation: 6,
        attunement: 6,
        appreciation: 6,
        commitment_threshold: 6,
      });
      expect(r.gap).toBeGreaterThan(3);
      expect(r.profile_type).toMatch(/^high_/);
    });

    it('excludes listed marker ids from strongest/weakest and mean', () => {
      const scores = {
        ...pillar(6),
        mentalizing: 9,
        repair: 4,
      };
      const full = calculateConstructAsymmetry(scores);
      const ex = calculateConstructAsymmetry(scores, ['mentalizing']);
      expect(ex.gap).toBeLessThan(full.gap);
    });
  });

  describe('buildScenarioBoundaries', () => {
    it('splits user messages into three contiguous index ranges', () => {
      const users = Array.from({ length: 6 }, (_, i) => ({
        role: 'user',
        content: `turn ${i}`,
      }));
      const all = [{ role: 'assistant', content: 'hi' }, ...users];
      const b = buildScenarioBoundaries(all, []);
      const userOnly = all.filter((m) => m.role === 'user');
      expect(b[1].end - b[1].start).toBe(2);
      expect(b[3].end).toBe(userOnly.length);
    });

    it('ignores welcome-back user turns', () => {
      const msgs = [
        { role: 'user', content: 'a' },
        { role: 'user', content: 'b', isWelcomeBack: true },
        { role: 'user', content: 'c' },
      ];
      const b = buildScenarioBoundaries(msgs, []);
      expect(b[1].start).toBe(0);
      expect(b[1].end).toBeGreaterThan(0);
    });
  });

  describe('analyzeLanguageMarkers', () => {
    it('counts accountability phrases and qualifiers in bounded scenarios', () => {
      const messages = [
        { role: 'user', content: "I think maybe I own it — that was my fault." },
        { role: 'user', content: 'kind of frustrated and hurt' },
        { role: 'user', content: 'they always never listen' },
      ];
      const boundaries = buildScenarioBoundaries(messages, []);
      const r = analyzeLanguageMarkers(messages, boundaries);
      expect(r.accountability_phrases).toBeGreaterThan(0);
      expect(r.qualifier_count).toBeGreaterThan(0);
      expect(r.deflection_phrases).toBeGreaterThan(0);
      expect(r.per_scenario[1].word_count).toBeGreaterThan(0);
    });
  });
});
