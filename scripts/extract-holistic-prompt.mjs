import fs from 'fs';
const path = 'src/app/screens/AriaScreen.tsx';
const lines = fs.readFileSync(path, 'utf8').split(/\r?\n/);
const body = lines.slice(3005, 3260).join('\n');
const header = `import {
  ACCOUNTABILITY_BLAME_SHIFT_VS_CLARITY_REQUEST,
  REPAIR_AND_ACCOUNTABILITY_UNPROMPTED_VS_PROMPTED_WEIGHTING,
  REPAIR_CONDITIONAL_AND_PROMPTED_SCORING,
  SCENARIO_B_ATTUNEMENT_APPRECIATION_ANCHORS,
  SCORE_CALIBRATION_0_10,
} from './interviewScoringCalibration';

`;
const out =
  header +
  body
    .replace('const SCORING_CONFIDENCE', 'export const SCORING_CONFIDENCE')
    .replace('const SCORING_GUARDRAILS', 'const SCORING_GUARDRAILS') // no-op, keep
    .replace('function buildScoringPrompt', 'export function buildScoringPrompt');
fs.writeFileSync('src/features/aria/holisticScoringPrompt.ts', out);
const edgePath = 'supabase/functions/_shared/holisticScoringPrompt.ts';
fs.writeFileSync(
  edgePath,
  out.replace("from './interviewScoringCalibration'", "from './interviewScoringCalibration.ts'")
);
console.log('Wrote src/features/aria/holisticScoringPrompt.ts and', edgePath);
