import {
  mentalizingRepairFloorTriggered,
  pillarScoreAssessedInScenario,
  scenariosBelowMinForPillar,
} from '../mentalizingRepairScenarioFloor';

describe('mentalizingRepairScenarioFloor', () => {
  it('treats null as not assessed', () => {
    expect(pillarScoreAssessedInScenario(null)).toBe(false);
    expect(pillarScoreAssessedInScenario(undefined)).toBe(false);
  });

  it('counts finite numbers including edge values', () => {
    expect(pillarScoreAssessedInScenario(3.5)).toBe(true);
    expect(pillarScoreAssessedInScenario(4)).toBe(true);
  });

  it('flags mentalizing floor only with 2+ low assessed scenarios', () => {
    const hi = { mentalizing: 7, repair: 7 } as Record<string, number>;
    const oneLow = mentalizingRepairFloorTriggered({
      1: { ...hi, mentalizing: 3 },
      2: hi,
      3: hi,
    });
    expect(oneLow.mentalizingFloorFails).toBe(false);

    const twoLow = mentalizingRepairFloorTriggered({
      1: { ...hi, mentalizing: 3 },
      2: { ...hi, mentalizing: 3 },
      3: hi,
    });
    expect(twoLow.mentalizingFloorFails).toBe(true);
    expect(scenariosBelowMinForPillar({ 1: { mentalizing: 3 }, 2: { mentalizing: 3 } }, 'mentalizing')).toHaveLength(
      2,
    );
  });
});
