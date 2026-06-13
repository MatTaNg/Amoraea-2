import { describe, it, expect } from 'vitest';
import { SCENARIO_A_CONTEMPT_RECOGNITION_CALIBRATION } from '../scenarioAContemptRecognitionCalibration';

describe('SCENARIO_A_CONTEMPT_RECOGNITION_CALIBRATION', () => {
  it('caps pattern-only recognition and credits emotional register recognition', () => {
    expect(SCENARIO_A_CONTEMPT_RECOGNITION_CALIBRATION).toContain('Pattern recognition alone is not contempt recognition');
    expect(SCENARIO_A_CONTEMPT_RECOGNITION_CALIBRATION).toContain(
      `she's frustrated because this has happened before`
    );
    expect(SCENARIO_A_CONTEMPT_RECOGNITION_CALIBRATION).toContain(
      'Register-neutral analytical reads'
    );
    expect(SCENARIO_A_CONTEMPT_RECOGNITION_CALIBRATION).toContain(
      'Partial recognition (5–6)'
    );
    expect(SCENARIO_A_CONTEMPT_RECOGNITION_CALIBRATION).toContain(
      'cap contempt_recognition at 4-5'
    );
    expect(SCENARIO_A_CONTEMPT_RECOGNITION_CALIBRATION).toContain(
      'sharp, sarcastic edge'
    );
    expect(SCENARIO_A_CONTEMPT_RECOGNITION_CALIBRATION).toContain(
      'dismisses anything Ryan might say next'
    );
  });
});
