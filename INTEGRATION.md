# Amoraea ↔ Dating App Integration

Hand-off document for a **separate dating-app Expo project** that shares Amoraea’s backend.

**Architecture decision:** keep two client apps; **one Supabase project**.  
Amoraea owns interview, scoring, admission, and match ranking.  
The dating app owns discover / chat / dates and may host dating-profile UI.

Copy this file into the dating-app repo root so agents there have the contract.

---

## 1. Ownership split

| Concern | Amoraea (`amoraea`) | Dating app |
|---------|---------------------|------------|
| AI interview + psychometrics scoring | **Owns (write)** | Do not reimplement |
| Admission (`interview_passed`) | **Owns (write)** | **Read only** |
| Dating profile onboarding / edit | May still run post-pass | Port UI; same tables |
| Photos, preferences, dealbreakers | Shared schema | Read/write |
| Pair compatibility ranking | **Owns (compute)** | Consume ranked results |
| Discover / swipe / messaging / video dates | Not built here | **Owns** |
| Admin / rescoring / interview analytics | **Owns** | No access needed |

---

## 2. Shared backend (do not fork)

### Env (dating app client)

```bash
EXPO_PUBLIC_SUPABASE_URL=<same as Amoraea>
EXPO_PUBLIC_SUPABASE_ANON_KEY=<same as Amoraea>
```

- Use the **anon** key only in the client. Never ship the service role key.
- Phone auth / Twilio is configured once on this Supabase project — see Amoraea `docs/PHONE_AUTH_SETUP.md`.

### Auth

- Same `auth.users.id` across both apps.
- Amoraea patterns to mirror (do not invent a second user table):
  - `src/data/supabase/client.ts`
  - `src/features/authentication/hooks/useAuth.ts`
  - `src/shared/hooks/AuthProvider.tsx`
  - Screens: `LoginScreen`, `RegisterScreen`, `ForgotPasswordScreen`, `LinkPhoneScreen`
- Invite codes: `users.invite_code`, RPC `get_user_id_by_invite_code`, `InviteCodeRepository.ts`
- Landing-page email leads (optional): `signup_leads` + `create-signup-lead` / `claim-signup-lead`; client `src/features/authentication/signupLead.ts`

### Canonical dating tables / storage

| Resource | Role |
|----------|------|
| `public.profiles` + **`profile_json`** | Primary dating profile blob + flags |
| `public.profile_photos` + Storage bucket **`profile-photos`** | Photos |
| `public.compatibility` (`compatibility_data` JSONB) | Match prefs / dealbreakers |
| `public.user_traits` | Trait scores (JSON) |
| `public.life_domain_settings` / `life_domain_answers` | Life-domain priorities + answers |
| `public.user_assessments` (+ related results) | Post-interview typology instruments |
| `public.users` | Auth-linked row; **`interview_passed`**, display fields, psychometrics columns |

Storage setup notes live in Amoraea `supabase/storage-setup.md` / `SETUP.md`.

---

## 3. Eligibility contract (“ready to date / match”)

Dating app should treat users as match-eligible only when **both** hold:

### A. Interview admission (Amoraea-owned)

```text
users.interview_passed === true
```

- Written by Amoraea after interview gate / admin override (`interview_passed_admin_override`).
- Dating app: **read only**. Never recompute gate scores.
- Related selects: `src/data/supabase/userInterviewRoutingSelect.ts`

### B. Profile completeness (shared helper logic)

Amoraea’s matching eligibility uses:

```text
src/datingProfile/data/services/onboarding/progress/profileCompletenessChecker.ts
  → isProfileComplete(profile)

src/features/compatibility/adminMatchEligibleProfile.ts
  → isUserProfileMatchEligible(profile)
```

`isProfileComplete` currently requires:

1. Basic info completed (`checkBasicInfoCompleted`)
2. Birth info: `birthDate` + `birthTime` + `birthLocation`
3. Filters: `matchPreferences.distanceRange` + `ageRange` + `genderPreference`
4. Life domains completed (`checkLifeDomainsCompleted`)
5. At least one photo
6. Availability completed (`checkAvailabilityCompleted`)

Also watch profile flags in `profile_json` / profiles:

- `onboarding_completed` / `onboardingCompleted` / `onboardingCompletedAt`
- `assessmentsCompleted`
- `hasSeenOnboardingIntro` (legacy UX)

**Rule of thumb for dating UI:**  
if `interview_passed !== true` → send user to Amoraea / “complete assessment” deep link;  
if passed but incomplete profile → run dating onboarding / edit profile;  
if both pass → allow discover.

---

## 4. Matchmaking (dating app consumes; Amoraea computes)

### Source of truth in Amoraea

| Artifact | Path |
|----------|------|
| Pair scoring (production V3) | `src/features/compatibility/computePairCompatibilityScore.ts` |
| Score building blocks | `src/features/compatibility/computeCompatibilityScore.ts` |
| Snapshot loader inputs | `docs/MATCHMAKING_AI_COMPATIBILITY.md` |
| Payload types / schemas | `src/features/compatibility/matchmakingPairPayload.ts` (+ `.schema.json`) |
| LLM prompt (optional narrative) | `matchmakingCompatibilityPrompt.ts` |

### Snapshot sources (for ranking / narratives)

| Section | Tables / fields |
|---------|-----------------|
| Interview | `interview_attempts` (latest passed): pillar / weighted scores, composites, flags |
| Psychometrics | `users.psychometrics_*` |
| Typology | `user_assessments` / test results |
| Communication style | `communication_style_profiles` |
| Profile | `profiles` / `profile_json` |
| Preferences | `compatibility.compatibility_data`, `matchPreferences` |

Hard filters (kids, religion, substances, relationship structure, distance/relocate, hobby dealbreaker, etc.) live in the Amoraea scorer — dating app should not reimplement a second filter stack unless you deliberately sync copies.

### Recommended dating-app integration

1. **Preferred:** Amoraea (or a Supabase edge/RPC) writes ranked pair results; dating app only **reads** “my matches.”
2. **Avoid:** shipping the full V3 scorer + interview scoring config into the dating client (drift risk).
3. Until a persist API exists, admin/tools in Amoraea use in-process ranking — plan a small **match feed API** before launch.

---

## 5. What to port into the dating app (client)

### Ready-made export kit

```text
migration-exports/onboarding-port/
```

Refresh from live sources:

```powershell
powershell -File migration-exports/onboarding-port/scripts/sync-bundle.ps1
```

See `migration-exports/onboarding-port/README.md` and `GATE_REFERENCE.md`.

**In the bundle:** modal onboarding, assessments UI, onboarding services/progress checkers.  
**Not in the bundle (wire separately):** `profilesRepo`, Supabase client, `AuthProvider` / `useAuth`, `@/shared/*` constants, edit-profile screens.

### Live sources to copy / sync

| Area | Amoraea paths |
|------|----------------|
| Dating onboarding | `src/datingProfile/**` |
| Edit profile | `src/app/screens/DatingProfileEditScreen.tsx`, `src/screens/profile/editProfile/**` |
| Shared field UI | `src/shared/components/profileFields/**` (hobbies, dealbreakers, typology, prompts, …) |
| Option catalogs | `src/shared/constants/` — esp. `hobbies.ts`, `sexualCompatibilityOptions.ts`, life-domain + filter constants |
| Profile repos | `profilesRepo`, `editProfileRepo`, `ProfileRepository` (photos) |
| Completeness | `profileCompletenessChecker.ts` + related checkers |
| Theme / primitives | `src/shared/ui/*`, theme tokens (as imports break) |

### Field catalog (dating UI should understand)

Demographics & identity: name, gender, ethnicity, attraction, DOB / birth time / birth location, relationship style, location, education, occupation.  
Lifestyle: height/weight, workout, substances, kids, politics, religion, sleep/habits as applicable.  
Social: hobbies, hobby dealbreaker (`professionalHobbyId` / hobby dealbreaker fields), profile prompts, photos.  
Compatibility prefs: sexual rhythm / interests, dealbreakers in `MatchPreferencesEmbedded`, life domains, typology.  
Ops: availability / contact preference (video-date scheduling).

Labels reference: `src/app/screens/admin/adminOnboardingFieldLabels.ts`, step order `src/datingProfile/screens/onboarding/modals/onboardingStepOrder.ts`.

---

## 6. What must stay only in Amoraea

Do **not** move these into the dating app:

- Interview runtime: `src/features/aria/**`, TTS / Whisper / Anthropic proxies
- Gate & psychometrics config: `src/config/scoring/**`, `src/config/psychometrics/**`, `computeGateResult*`
- Edge functions: `complete-standard-interview`, `analyze-interview-*`, repair/rescore/digest functions
- Admin: `src/features/admin/**`, interview dashboard, rescoring `scripts/`
- Post-interview admission UX: `PostInterview*` screens (dating may deep-link after pass)
- Relationship validation track (`ValidationAmoraea`)
- Scoring research docs / orchestrator QA checklists

---

## 7. Suggested dating-app bootstrap checklist

1. Create Expo app; set **same** Supabase URL + anon key.
2. Port thin auth (session + phone login) against existing Auth providers.
3. Gate root navigation:
   - not signed in → auth
   - `interview_passed !== true` → “finish Amoraea assessment” (deep link / web URL)
   - passed, profile incomplete → dating onboarding (from onboarding-port / `datingProfile`)
   - eligible → dating home / discover
4. Wire profile read/write via `profiles` + `profile_json` + photos bucket.
5. Port edit-profile if users should update prefs inside the dating app.
6. Add discover/chat/dates product surfaces (new work).
7. Agree on match-feed API with Amoraea before computing pairs client-side.
8. Staging smoke test: register → (Amoraea) pass interview → complete profile → appear in eligible pool → dating app can load profile + photos.

---

## 8. Deep links / handoff URLs

| Intent | Suggested target |
|--------|------------------|
| Continue registration from landing lead | `https://www.amoraea.com/register?lead=<token>` (Amoraea) |
| Finish interview / see results | Amoraea post-interview routes |
| Open dating product after eligible | Dating app home (your scheme) |
| Edit profile | Either app writing the **same** `profiles` row |

Keep one canonical profile — both UIs must write compatible `profile_json` shapes.

---

## 9. Optional later

- Shared published TS package for profile/match types (only if copy-drift hurts)
- Expose `computePairCompatibilityScore` behind an edge function the dating app calls
- Shared design tokens (`docs/COLOR_PALETTE.md`) if brands stay identical
- Read-only display of communication-style / interview insights in dating UI

---

## 10. Quick reference — Amoraea docs & exports

| Doc / folder | Why it matters |
|--------------|----------------|
| `INTEGRATION.md` (this file) | Cross-app contract |
| `migration-exports/onboarding-port/` | Zip-ready onboarding + assessments |
| `docs/MATCHMAKING_AI_COMPATIBILITY.md` | Snapshot + scoring contract |
| `docs/PHONE_AUTH_SETUP.md` | Shared phone auth |
| `docs/PWA_DEPLOYMENT.md` | Env var inventory |
| `docs/ONBOARDING_ARCHITECTURE_PLAN.md` | Historical stages (legacy; prefer interview → dating-profile flow) |

---

## 11. One-line summary for the dating-app agent

> Use **the same Supabase project**. Read `users.interview_passed` and shared `profiles` / photos / preferences. Port dating onboarding/edit UI from `migration-exports/onboarding-port` + `src/datingProfile`. Do **not** port interview scoring. Consume match rankings from Amoraea; build discover/chat/dates here.
