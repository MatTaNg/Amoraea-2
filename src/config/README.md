# Amoraea algorithm configuration



**Edit these files to tune scoring, matching, and narrative thresholds.** Application code and Supabase edge functions import from here so values stay in one place.



## Layout



| Folder | What you can change |

|--------|---------------------|

| [`scoring/`](./scoring/) | Interview gate pass/fail, pillar weights & floors, depth-signal modifiers, scenario floors, skip penalties, concreteness & disclosure levels, elaboration ceilings, emotion recognition keys, communication floor |

| [`psychometrics/`](./psychometrics/) | Psychometric auto-fail floors, modifier band penalties, interview-signal consistency, gaming correction thresholds, uncertainty routing |

| [`matching/`](./matching/) | Compatibility algorithm weights, distance limits, interview-confidence discounts |

| [`reports/`](./reports/) | Pillar narrative score bands, gate narrative calibration, questionnaire vs interview divergence thresholds |

| [`onboarding/`](./onboarding/) | Dating-profile assessment insight display tiers (attachment, values, resilience, DSIR, etc.) |



## Scoring files



| File | Purpose |

|------|---------|

| `interviewGateThresholds.ts` | Weighted pass min, referral pass min, marker floors & weights |

| `depthSignalModifiers.ts` | Depth-signal bonus/penalty on weighted score |

| `scenarioFloors.ts` | Scenario composite & mentalizing/repair floors |

| `interviewSkipPenalties.ts` | Skip penalties by interview moment |

| `personalMomentConcretenessModifiers.ts` | Moment 4/5 concreteness modifiers |

| `disclosureLevels.ts` | Disclosure calibration levels |

| `elaborationAbsenceCeilings.ts` | Post-LLM programmatic score caps (mentalizing, repair, depth word thresholds) |

| `pillarRollup.ts` | Pillar rollup weights |

| `emotionRecognitionItems.ts` | Correct answers for in-interview emotion MC items |

| `contemptHeuristics.ts` | Contempt expression heuristic thresholds |

| `adminDisplayMargins.ts` | “Almost passed” margins in admin UI |

| `emotionalVocabThresholds.ts` | Personal-moment emotional vocabulary scoring |

| `communicationFloor.ts` | Minimum avg words per turn for communication floor |



## Psychometrics files



| File | Purpose |

|------|---------|

| `floors.ts` | Auto-fail psychometric floor thresholds |

| `modifierBandPenalties.ts` | Per-instrument modifier band penalties |

| `interviewSignalConsistency.ts` | Questionnaire vs interview divergence checks in modifier |

| `gamingCorrectionThresholds.ts` | Straight-line, divergence, and uncertainty correction levels |

| `uncertaintyAndGaming.ts` | Uncertainty score weights and routing threshold |



## Reports & onboarding



| File | Purpose |

|------|---------|

| `reports/pillarNarrativeBands.ts` | strong / good / developing / needs-attention score cutoffs |

| `reports/narrativeGateCalibration.ts` | Gate pass comfortable margin for narrative tone |

| `reports/evidenceConflictThresholds.ts` | Divergence thresholds for “mixed evidence” report copy |

| `onboarding/assessmentInsightTiers.ts` | Attachment, PVQ, DSIR, BRS insight tier cutoffs |



## Quick reference — highest-impact knobs



- **Pass weighted score:** `scoring/interviewGateThresholds.ts` → `GATE_PASS_WEIGHTED_MIN` (default **6.5**)

- **Referral pass score:** same file → `REFERRAL_WEIGHTED_PASS_MIN` (default **6.0**)

- **Pillar floors:** same file → `GATE_MARKER_FLOORS`

- **Pillar weights:** same file → `GATE_MARKER_BASE_WEIGHTS`

- **Psych auto-fail:** `psychometrics/floors.ts`

- **Match geography:** `matching/compatibilityScoring.ts` → `MAX_DISTANCE_KM`

- **Uncertainty routing:** `psychometrics/uncertaintyAndGaming.ts` → `UNCERTAINTY_ROUTING_THRESHOLD`



## Import conventions



**App code** (via `tsconfig` alias):



```ts

import { GATE_PASS_WEIGHTED_MIN } from '@config/scoring/interviewGateThresholds';

```



**Supabase edge `_shared`** (relative path to repo `src/config`):



```ts

import { GATE_PASS_WEIGHTED_MIN } from '../../../src/config/scoring/interviewGateThresholds.ts';

```



Thin re-export barrels in `@features/aria/computeGateResultCore` and `_shared/*.ts` preserve backward compatibility for existing importers.



After changing values, run:



```bash

npx jest --testPathPattern="src/features/aria|src/features/psychometrics|src/features/compatibility|src/features/reports" --forceExit

```



