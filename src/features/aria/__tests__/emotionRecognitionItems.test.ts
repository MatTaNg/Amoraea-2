import {
  EMOTION_ITEM_CORRECT_ANSWERS,
  emotionRecognitionDisplayScore,
  scoreEmotionItems,
  splitTransitionDisplayForEmotionModal,
} from '../emotionRecognitionItems';
import { SCENARIO_1_TO_2_TRANSITION_FALLBACK } from '../interviewTransitionBundles';

describe('emotionRecognitionItems', () => {
  it('scoreEmotionItems returns correct thirds', () => {
    expect(scoreEmotionItems(['B', 'C', 'C'])).toBe(1);
    expect(scoreEmotionItems(['A', 'C', 'C'])).toBeCloseTo(2 / 3);
    expect(scoreEmotionItems(['A', 'B', 'C'])).toBeCloseTo(1 / 3);
    expect(scoreEmotionItems(['A', 'B', 'D'])).toBe(0);
  });

  it('scoreEmotionItems scores partial batteries out of three items', () => {
    expect(scoreEmotionItems(['B', 'C'])).toBeCloseTo(2 / 3);
    expect(scoreEmotionItems([])).toBe(0);
  });

  it('matches EMOTION_ITEM_CORRECT_ANSWERS length', () => {
    expect(EMOTION_ITEM_CORRECT_ANSWERS.length).toBe(3);
  });

  it('emotionRecognitionDisplayScore maps to 0, 3, 7, 10', () => {
    expect(emotionRecognitionDisplayScore(0)).toBe(0);
    expect(emotionRecognitionDisplayScore(1 / 3)).toBe(3);
    expect(emotionRecognitionDisplayScore(2 / 3)).toBe(7);
    expect(emotionRecognitionDisplayScore(1)).toBe(10);
  });

  it('splitTransitionDisplayForEmotionModal splits on double newline', () => {
    const body = 'Next vignette line one.\nLine two.';
    const t = `${SCENARIO_1_TO_2_TRANSITION_FALLBACK}\n\n${body}`;
    const { preModal, postModal } = splitTransitionDisplayForEmotionModal(t);
    expect(preModal).toContain(SCENARIO_1_TO_2_TRANSITION_FALLBACK.slice(0, 20));
    expect(postModal).toContain('Next vignette');
  });
});
