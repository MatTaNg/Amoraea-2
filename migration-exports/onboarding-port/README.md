# Onboarding migration bundle

This folder helps you **copy** onboarding + assessment flows into your **target app** (same stack: Expo + Expo Router, same Supabase + Auth).  
**Nothing here removes files from the main Amoraea app** — the bundle is a duplicate snapshot you can zip and merge into the other project.

## Contents

| Path | Description |
|------|-------------|
| `bundle/app/onboarding/` | Expo Router routes: modals flow, assessments, break, profile-builder, additional-info |
| `bundle/screens/onboarding/` | Modal onboarding UI, free-user flow, profile builder steps, hooks |
| `bundle/screens/assessments/` | Big Five / attachment / Schwartz instruments UI, break, insight, conflict style screens |
| `bundle/data/assessments/` | Instrument definitions, scoring, insight copy, conflict style data |
| `bundle/data/services/onboarding/` | Progress checkers, metadata, trait/basic-info updates, navigation helpers |
| `bundle/data/services/` | `onboardingService.ts`, `assessmentService.ts`, `assessmentAiInsightService.ts`, `conflictStyleService.ts` |
| `FILE_LIST.txt` | Flat list of every file in `bundle/` |

## Phase 0 assumptions (confirmed)

- Target app: **Expo + Expo Router** (same as this repo).
- **Same Supabase project** and env (`EXPO_PUBLIC_SUPABASE_URL`, anon key).
- **Same auth** (Supabase Auth); `user.id` drives all saves.
- Target route prefix will be something like **`/profile`** (you remap `app/onboarding/*` → `app/profile/*` in the new app).

## What is *not* in this bundle (you must wire in the target app)

Imports in the bundle still reference the **rest of this monolith**, for example:

- `@/shared/*` — theme, `Button`, `Input`, hooks (`AuthProvider`, `useProfile`), filters, sexual compatibility constants, etc.
- `@/src/types` — `UserProfile`, `Result`, assessment types
- `@/data/repos/*` — `profilesRepo`, `traitsRepo` (and mappers)
- `@/data/supabaseClient`
- `@/screens/profile/*` — e.g. `editProfile/aboutYouOptions`, `editProfileService`, `AvailabilityModal`, location helpers
- `@/hooks/*`, `@/components/*` as referenced by screens

**Next migration steps:** either copy those dependencies as you hit import errors, or temporarily re-export them from the target app under the same `@/` paths.

Repos / data layer **not** duplicated here on purpose: keep **one** implementation of `data/repos` and Supabase in the target app, aligned with the same schema.

## Suggested order in the target app

1. Copy `bundle/` tree into the new repo (preserve `app/`, `screens/`, `data/` structure or adjust path aliases).
2. Add **route group** `app/profile/` (or your chosen name) and move/rename files from `bundle/app/onboarding/` → `app/profile/...`; update **every** `router.replace('/onboarding/...')` to your new paths.
3. Port **root layout gate** — see `GATE_REFERENCE.md` (excerpt from this app’s `app/_layout.tsx`).
4. Fix **imports** top-down: `data/services` → repos → screens.
5. Run a full onboarding + all assessments against **staging** Supabase before switching production traffic.

## Re-generating the bundle later

From the repo root (PowerShell):

```powershell
$root = "."
$dest = "migration/onboarding-port/bundle"
# Remove old bundle if you want a clean copy
Remove-Item -Recurse -Force $dest -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Force -Path $dest | Out-Null
robocopy "$root\app\onboarding" "$dest\app\onboarding" /E
robocopy "$root\screens\onboarding" "$dest\screens\onboarding" /E
robocopy "$root\screens\assessments" "$dest\screens\assessments" /E
robocopy "$root\data\services\onboarding" "$dest\data\services\onboarding" /E
robocopy "$root\data\assessments" "$dest\data\assessments" /E
New-Item -ItemType Directory -Force -Path "$dest\data\services" | Out-Null
Copy-Item "$root\data\services\onboardingService.ts" "$dest\data\services\"
Copy-Item "$root\data\services\assessmentService.ts" "$dest\data\services\"
Copy-Item "$root\data\services\assessmentAiInsightService.ts" "$dest\data\services\"
Copy-Item "$root\data\services\conflictStyleService.ts" "$dest\data\services\"
```

Then regenerate `FILE_LIST.txt` if needed.

## Zipping for the other machine

Zip the whole `migration/onboarding-port` folder (includes README + `bundle/`). The original app remains unchanged.
