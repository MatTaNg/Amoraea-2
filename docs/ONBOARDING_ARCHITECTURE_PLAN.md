# Full Onboarding Architecture — Plan & File Map

## Summary
Four sequential stages: Basic Info → AI Interview (Gate 1) → Psychometrics (Gate 2, approved only) → Compatibility (Gate 3). Routing by `onboardingStage` and `applicationStatus`.

---

## Files to CREATE

| File | Purpose |
|------|---------|
| `supabase/migrations/20260218120000_onboarding_gates.sql` | Add columns: onboarding_stage, application_status, profile_visible, basic_info, gate1_score, gate2_psychometrics, gate3_compatibility |
| `src/domain/models/OnboardingGates.ts` | Types: OnboardingStage, ApplicationStatus, BasicInfo, Gate1Score, Gate2Psychometrics, Gate3Compatibility |
| `src/features/onboarding/evaluateGate1.ts` | Pure function evaluateGate1(scoringResult) → { passed, averageScore, failReasons } |
| `src/features/onboarding/__tests__/evaluateGate1.test.ts` | Unit tests for evaluateGate1 |
| `src/app/screens/onboarding/Stage1BasicInfoScreen.tsx` | Single form: first name, age (18+), gender (+ Prefer not to say), attracted to, location (city+country / use my location), occupation, single photo, height (cm/ft-in toggle), weight (kg/lbs toggle). Submit → store metric + BMI, set stage = interview, go to Stage 2 |
| `src/app/screens/onboarding/InterviewFramingScreen.tsx` | "Before we begin" copy + [Begin conversation →], no back |
| `src/app/screens/onboarding/PostInterviewScreen.tsx` | "Thank you" screen for all users after interview (no score, no pass/fail) |
| `src/app/screens/onboarding/UnderReviewScreen.tsx` | "Still reviewing" for applicationStatus = under_review on app open |
| `src/app/screens/onboarding/Gate2ReentryScreen.tsx` | "You're in" for approved users before psychometrics |
| `src/app/screens/onboarding/Stage3PsychometricsScreen.tsx` | Runs 5 instruments in order (ECR-12, TIPI, DSI-SF, BRS, PVQ-21) with progress + insight screens between; saves gate2Psychometrics, sets stage = compatibility |
| `src/app/screens/onboarding/Stage4CompatibilityScreen.tsx` | Sectioned compatibility (12 sections) + BMI selector (userHeightCm/userWeightKg from basicInfo) + Profile prompts (subset, 20–300 chars); saves gate3Compatibility, sets stage = complete, profileVisible = true |

---

## Files to MODIFY

| File | Changes |
|------|---------|
| `src/domain/models/Profile.ts` | Add BasicInfo, Gate1Score, Gate2Psychometrics, Gate3Compatibility, onboardingStage, applicationStatus, profileVisible; extend ProfileUpdate |
| `src/data/repositories/ProfileRepository.ts` | Map new columns in getProfile/upsertProfile; parse/serialize basic_info, gate1_score, gate2_psychometrics, gate3_compatibility |
| `App.tsx` | Replace current onboarding vs completed check with routing by onboardingStage + applicationStatus. Routes: basic_info → Stage1; interview → framing or Aria or post-interview; psychometrics → approved ? Gate2 reentry + Stage3 : under_review or post-interview; compatibility → Stage4; complete → main app |
| `src/app/screens/AriaScreen.tsx` | Accept optional params (e.g. fromOnboarding); after scoring call evaluateGate1, upsert gate1Score + applicationStatus; navigate to PostInterviewScreen (no results UI for onboarding flow) |
| `src/features/compatibility/compatibilityQuestions.ts` | Reorder/group COMPATIBILITY_SECTIONS into the 12 sections specified (Relationship Intent, Children, Location, Time & Lifestyle, Finances, Intimacy, Living Environment, Faith & Values, Substance Use, Pets, Physical Preference, Profile Prompts) |
| `src/app/screens/CompatibilityScreen.tsx` | When used as Stage 4: load/save gate3Compatibility, pass userHeightCm/userWeightKg to BMI selector, enforce prompt subset and 20–300 chars; on complete set onboardingStage = complete, profileVisible = true |
| `src/features/profile/promptsByCategory.ts` | Add onboarding prompt subset (15 prompts from spec) and validation 20–300 chars for Stage 4 |

---

## Conflicts & decisions

1. **Existing onboarding**  
   Current flow: 8 separate screens (Name, Age, Gender, …), `onboardingCompleted` boolean, `onboardingStep` number. **Decision:** New flow replaces this. We keep `onboardingCompleted` for backward compatibility but primary routing uses `onboarding_stage`. New users get `onboarding_stage = 'basic_info'`; after Stage 1 we set `onboarding_stage = 'interview'` and can set `onboardingCompleted = false` until Stage 4 complete.

2. **Profile vs users table**  
   All new fields live on `users` table (basic_info, gate1_score, etc. as JSONB). Existing columns (name, age, gender, …) stay; Stage 1 can sync basicInfo into name, age, gender, height_centimeters, etc., so the rest of the app keeps working.

3. **Interview UI**  
   Spec says "existing ai_interviewer.jsx". That component is web (div/button). **Decision:** Use AriaScreen (React Native) as the interview for the app; it already has INTERVIEW_COMPLETE, scoring prompt, and scoring flow. We add Gate 1 logic (evaluateGate1, save gate1Score, applicationStatus) and navigation to PostInterviewScreen.

4. **DSI-SF**  
   Spec: "DSI-SF — Dyadic satisfaction (4 items)". Codebase has DSI-SF as **Differentiation of Self** (20 items). **Decision:** Keep existing DSI (differentiation) for Gate 2; gate2Psychometrics.dsisf can store the DSI total/mean as `satisfactionScore` for API compatibility, or we add a separate 4-item Dyadic Satisfaction scale later. Document in code.

5. **Compatibility sections**  
   Current COMPATIBILITY_SECTIONS are close but not exactly 12 as listed. We'll regroup into: (1) Relationship Intent, (2) Children, (3) Location, (4) Time & Lifestyle, (5) Finances, (6) Intimacy, (7) Living Environment, (8) Faith & Values, (9) Substance Use, (10) Pets, (11) Physical Preference (BMI), (12) Profile Prompts.

6. **Profile prompts in Stage 4**  
   Spec gives 15 prompts; store `{ prompt: string, answer: string }` with 20–300 chars. Existing EditProfileModal uses promptId + answer and different list. **Decision:** Stage 4 uses the 15-prompt subset and stores full prompt text + answer in gate3Compatibility.profilePrompts; existing profile.prompts / profile_prompts can stay for edit-profile use and be synced from gate3 on completion if desired.

---

## Routing matrix (on app open)

| onboardingStage   | applicationStatus | Screen |
|-------------------|-------------------|--------|
| basic_info        | *                 | Stage 1 Basic Info |
| interview         | pending           | Framing → Aria → Post-interview (after complete) |
| interview         | under_review      | Post-interview then on next open → Under Review |
| interview         | approved          | Post-interview then on next open → Gate 2 reentry |
| psychometrics     | approved          | Gate 2 reentry → Stage 3 |
| psychometrics     | under_review      | Under Review |
| psychometrics     | pending           | Post-interview (waiting) |
| compatibility     | approved          | Stage 4 Compatibility |
| complete          | *                 | Main app (Home) |

---

## Implementation order

1. Migration + domain types (OnboardingGates.ts, Profile updates, Repository)
2. evaluateGate1 + tests
3. App.tsx routing
4. Stage 1 screen
5. Interview framing + Post-interview + Under-review screens
6. AriaScreen integration (evaluateGate1, save gate1Score/applicationStatus, navigate to post-interview)
7. Gate 2 reentry + Stage 3 (psychometrics) reusing FullAssessmentScreen instruments
8. Stage 4 compatibility (sectioned flow, BMI from basicInfo, prompts subset)
9. CompatibilityScreen dual mode (standalone vs onboarding Stage 4)

Implementing in this order.
