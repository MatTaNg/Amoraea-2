import {
  triggerCompletedScenarioScoringIfNeeded,
  runEnsureCompletedScenarioScored,
} from '@features/aria/runScenarioBoundaryScoring';
import { completedScenarioForShowScenarioCardKind } from '@features/aria/showScenarioCardCanonicalTts';

describe('runScenarioBoundaryScoring', () => {
  it('completedScenarioForShowScenarioCardKind maps next card to completed scenario', () => {
    expect(completedScenarioForShowScenarioCardKind('situation_1')).toBeNull();
    expect(completedScenarioForShowScenarioCardKind('situation_2')).toBe(1);
    expect(completedScenarioForShowScenarioCardKind('situation_3')).toBe(2);
    expect(completedScenarioForShowScenarioCardKind('moment_4')).toBe(3);
  });

  it('triggerCompletedScenarioScoringIfNeeded calls ensureCompletedScenarioScored with trigger', () => {
    const ensureCompletedScenarioScored = jest.fn();
    const messages = [
      { role: 'user', content: 'repair answer' },
      { role: 'assistant', content: 'handoff' },
    ];
    triggerCompletedScenarioScoringIfNeeded({
      completedScenario: 1,
      messagesForScoring: messages,
      trigger: 'show_scenario_card_canonical_situation_2',
      ensureCompletedScenarioScored,
    });
    expect(ensureCompletedScenarioScored).toHaveBeenCalledWith(
      1,
      messages,
      'show_scenario_card_canonical_situation_2',
    );
  });

  it('triggerCompletedScenarioScoringIfNeeded no-ops when completedScenario is null', () => {
    const ensureCompletedScenarioScored = jest.fn();
    triggerCompletedScenarioScoringIfNeeded({
      completedScenario: completedScenarioForShowScenarioCardKind('situation_1'),
      messagesForScoring: [],
      trigger: 'show_scenario_card_canonical_situation_1',
      ensureCompletedScenarioScored,
    });
    expect(ensureCompletedScenarioScored).not.toHaveBeenCalled();
  });

  it('runEnsureCompletedScenarioScored dedupes via scoredScenariosRef', () => {
    const scored = new Set<number>();
    const scoreScenario = jest.fn();
    const messages = [{ role: 'user', content: 'x' }];
    runEnsureCompletedScenarioScored(
      { scoredScenariosRef: { current: scored }, scoreScenario } as never,
      { completedScenario: 1, messagesForScoring: messages, trigger: 'test' },
    );
    expect(scored.has(1)).toBe(true);
    expect(scoreScenario).toHaveBeenCalledTimes(1);
    runEnsureCompletedScenarioScored(
      { scoredScenariosRef: { current: scored }, scoreScenario } as never,
      { completedScenario: 1, messagesForScoring: messages, trigger: 'test_again' },
    );
    expect(scoreScenario).toHaveBeenCalledTimes(1);
  });
});
