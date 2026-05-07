# Root layout gate (reference for the target app)

When you move onboarding under `/profile` (or similar), replicate **equivalent** redirect logic in the **target app’s root layout** so users cannot open the main tabs until profile onboarding + assessments are complete.

Below is the **logic pattern** from this repo’s `app/_layout.tsx` (see full file for imports and state). Adapt segment checks from `onboarding` → your route group name (e.g. `profile`).

## Conditions (conceptual)

1. If **not logged in** → send to auth (`/(auth)/sign-in` or your equivalent).
2. If logged in and **not** already inside the onboarding/profile group:
   - Load `onboardingService.getOnboardingProgress(user.id)` (or your unified progress API).
   - Load profile via `profilesRepo.getProfile(user.id)`.
   - If profile exists:
     - If **`hasSeenOnboardingIntro` is false** → `router.replace` to **modal onboarding entry** (here: `/onboarding/modals`; you: `/profile/modals` or your first step).
     - Else if **`hasSeenOnboardingIntro` is true** and **`assessmentsCompleted` is false**:
       - If **`currentAssessment`** is set → `router.replace(getAssessmentEntryRoute(currentAssessment))` (from `assessmentService`).
       - Else → `router.replace` to **break / resume** screen (here: `/onboarding/break`; you: `/profile/break`).
   - If profile missing / error → still send to modal onboarding entry so the user can create profile data.

3. After **`assessmentsCompleted`** is true, optional side effects (here: `eventModalService.markOnboardingCompleted()`) — port if the target app uses the same event modal system.

## Imports the gate relies on

- `@/data/services/onboardingService` — `getOnboardingProgress`
- `@/data/services/assessmentService` — `getAssessmentEntryRoute`
- `@/data/repos/profilesRepo` — `getProfile`
- `@/data/services/eventModalService` — optional, post-completion

## Segment checks

This app uses:

- `const inOnboarding = segments[0] === "onboarding";`

Your app should use the **first segment** of your stack (e.g. `segments[0] === "profile"`).

Do not copy-paste the entire `_layout.tsx` blindly: the target app may have different headers, tutorial, or modals — only the **gate conditions** and **replace targets** need to match product behavior.
