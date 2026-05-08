import { MENTALIZING_INFERENCE_SOURCE_CALIBRATION } from '../scenarioInferenceSourceCalibration';

describe('MENTALIZING_INFERENCE_SOURCE_CALIBRATION', () => {
  it('distinguishes scenario restatement from independent Daniel inference', () => {
    expect(MENTALIZING_INFERENCE_SOURCE_CALIBRATION).toContain('mentalizing_inference_source');
    expect(MENTALIZING_INFERENCE_SOURCE_CALIBRATION).toContain('scenario_restatement');
    expect(MENTALIZING_INFERENCE_SOURCE_CALIBRATION).toContain('surface_addition');
    expect(MENTALIZING_INFERENCE_SOURCE_CALIBRATION).toContain('independent_inference');
    expect(MENTALIZING_INFERENCE_SOURCE_CALIBRATION).toContain(
      "Daniel didn't know what to say because he didn't want to upset her more"
    );
    expect(MENTALIZING_INFERENCE_SOURCE_CALIBRATION).toContain(
      "when he's flooded he loses access to language"
    );
    expect(MENTALIZING_INFERENCE_SOURCE_CALIBRATION).toContain("Sophie feels unheard");
  });
});
