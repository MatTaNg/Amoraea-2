# PWA Setup & Vercel Deployment

Amoraea is set up as an installable Progressive Web App deployable to Vercel. Users on iPhone and Android can install it to their home screen and launch it full-screen.

## Icons

Copy all icons from your `pwa_icons/` folder into `public/icons/` (see `public/icons/README.md` for the list). Until then, the app runs normally; install prompts may use fallbacks.

## Build & Deploy

1. **Build web:** `npm run build:web` (runs `expo export -p web` → output in `dist/`).
2. **Deploy to Vercel:** Connect the repo to Vercel; use build command `npm run build:web`, output directory `dist`. Add env vars (e.g. `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`, etc.) — all client env vars must start with `EXPO_PUBLIC_` (Vite-style `VITE_` is not used in this Expo project).
3. **Redeploy** after adding environment variables.

## How users install

- **iPhone:** Safari → your URL → Share → Add to Home Screen. Open from home screen for full-screen.
- **Android:** Chrome → your URL → Add to Home Screen / Install.

## iOS behaviour

- **Audio:** Unlocked on first user gesture (tap/click) so Aira TTS is not blocked.
- **Microphone:** Permission is requested when the user taps "Start" on the interview intro screen (user gesture required on iOS PWA).
- **Safe areas:** `index.html` and root styles use `env(safe-area-inset-*)` and `100dvh` so content is not hidden behind the notch or home bar.

## Security for Alpha

- **Option A:** Vercel Password Protection (Pro).
- **Option B:** Rely on Supabase auth — the app requires login; registration is gated.
