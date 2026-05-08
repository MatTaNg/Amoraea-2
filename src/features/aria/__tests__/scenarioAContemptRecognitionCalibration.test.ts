import { SCENARIO_A_CONTEMPT_RECOGNITION_CALIBRATION } from '../scenarioAContemptRecognitionCalibration';

describe('SCENARIO_A_CONTEMPT_RECOGNITION_CALIBRATION', () => {
  it('caps pattern-only recognition and credits emotional register recognition', () => {
    expect(SCENARIO_A_CONTEMPT_RECOGNITION_CALIBRATION).toContain('Pattern recognition is not the same as contempt recognition');
    expect(SCENARIO_A_CONTEMPT_RECOGNITION_CALIBRATION).toContain(
      `she's frustrated because this has happened before`
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
