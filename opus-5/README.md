# Forkcast: a Cal AI–style calorie tracker on January AI

Snap a photo of a meal (or describe it, scan a barcode, or search for it) and get calories, macros, a health
score and a predicted blood sugar curve. It's a React Native app (Expo SDK 57) that runs in the browser, on iOS
and on Android. All the food intelligence comes from January AI's partner API (v1.2).

Forkcast is an independent demo. It isn't affiliated with or endorsed by Cal AI or MyFitnessPal.

> "Forkcast" is a placeholder name. Change `APP_NAME` in `src/constants/theme.ts` and `name` in `app.json`.

## Quick start

You need [Node.js](https://nodejs.org) 22 or newer (20.19.4+ also works) and a January API key.

1. **Get a January API key.** Sign in at [developer.january.ai](https://developer.january.ai) and create an API
   key for the v1.2 API. It starts with `sk-`. Treat it like a password: it authenticates your whole January
   account, and every call spends your credits.

2. **Install.** From the repository root:

   ```bash
   cd opus-5
   npm install
   ```

3. **Add your key.** Copy the template:

   ```bash
   cp .env.example .env
   ```

   Then open `.env` and paste your key after `JANUARY_API_KEY=`, with no quotes or spaces:

   ```
   JANUARY_API_KEY=sk-...
   ```

   `.env` is gitignored, so the key stays on your machine.

4. **Run it.**

   ```bash
   npm run web
   ```

   Open http://localhost:8081, go through the short onboarding, then tap **+** to log a meal. No food nearby? Open
   the scanner and tap **Try a sample photo**. To use a phone instead, run `npm start` and scan the QR code with
   the Expo Go app.

Edited `.env` while the app was running? Restart it (Ctrl+C, then `npm run web`). The key is read at startup.

## Troubleshooting

When a January request fails, the app shows what to fix on screen. The common cases:

| The app says | What to do |
| --- | --- |
| "No January API key is set up yet" | Do step 3 above, then restart the server. |
| "January rejected the API key" | Copy the key again from developer.january.ai. It must be a v1.2 key starting with `sk-`. Restart the server afterwards. |
| "Could not reach http://127.0.0.1:8787 (set by JANUARY_API_BASE_URL)" | That variable is only for the optional keyotter proxy below. Remove it from your shell or `.env*` files, then restart. |
| "This month's January API credits are used up" | Credits reset monthly. **Settings → January AI** in the app shows your plan and what's left. |

The terminal running the server also logs every failed January call, with January's error code.

## Features

| Cal AI feature | How it works here | January endpoint |
| --- | --- | --- |
| Onboarding and custom plan | Mifflin–St Jeor BMR × activity, adjusted for the weekly goal pace | none |
| Scan food | The photo is downsized on the device (~1,024 px JPEG) and sent as a data URI | `POST /v1.2/food-analysis/image` |
| Food label | Same endpoint; it reads nutrition panels too | `POST /v1.2/food-analysis/image` |
| Describe a meal | Plain text in, foods and portions out | `POST /v1.2/food-analysis/text` |
| Fix results | A plain-English correction of the logged meal | `POST /v1.2/food-analysis/corrections` |
| Barcode | Camera scanning (native, and browsers via BarcodeDetector) or typing the number | `GET /v1.2/foods/barcode/{code}` |
| Food database | Search, pick a serving, log it | `GET /v1.2/foods`, `GET /v1.2/foods/{id}` |
| Daily log, week strip, streak, charts | Every meal is a January food log for this device's end user | `/v1.2/food-logs` (list, create, update, delete) |
| Blood sugar impact (not in Cal AI) | Predicted glucose curve for each meal, from the onboarding profile | `POST /v1.2/glucose/predictions` |
| Healthier swaps (not in Cal AI) | Alternatives that respect the user's diet | `POST /v1.2/foods/{id}/alternatives` |
| API status | Plan and remaining credits, in Settings | `GET /v1.2/credits` (free) |

The health score (1–10) is computed in the app from nutrient density; January doesn't return one.

## How the API key stays safe

- The key only exists on the server. The browser or phone calls this app's own API route,
  `src/app/api/january/[...path]+api.ts`, which adds the key and forwards the request to January. It only
  forwards the endpoints the app uses.
- `.env` and every other `.env.*` file except `.env.example` are gitignored, both in this folder and at the
  repository root.
- Never give the variable an `EXPO_PUBLIC_` prefix. Expo copies those into the browser bundle.

## Users and food logs

The app has no sign-in. On first launch, each browser or device creates an end-user id (`forkcast-` followed by a
random UUID) and stores it locally. Every food-log request sends it in the `January-End-User-ID` header, so
January keeps each device's log separate. **Settings → January AI** shows the id, and **Start over** creates a
new one. Clearing site data or switching browsers also starts a new, empty log.

For a real product, send your own signed-in user ids instead, and put the API route behind your login. Right now
it trusts whatever id the app sends.

## Put it on a website

`app.json` sets `web.output: "server"`, so an export contains the static site plus the API route that holds the
key. Run these from `opus-5`:

- **Any Node host** (Render, Railway, Fly, a VM): build with `npm run build:web`, set `JANUARY_API_KEY` in the
  host's environment settings, and start with `npm run serve`. It listens on `$PORT` (default 3000).
- **EAS Hosting:** `npx expo export -p web`, then `npx eas-cli@latest deploy`, with `JANUARY_API_KEY` set as an
  EAS environment variable.
- Vercel, Netlify, Cloudflare Workers and Bun adapters ship in `expo-server/adapter/*`.

**Before you share the URL:** `/api/january/*` has no login or rate limit, so anyone with the link can spend your
credits. Put it behind auth or a rate limit for a public demo. For production, use January's per-user client
tokens (`POST /v1.2/auth/client-tokens`) behind your own login.

## Optional: keep the key out of `.env` with keyotter

If your key is stored in keyotter, a small local proxy adds it to each request, so the key never sits in a file.
Run the proxy in one terminal:

```bash
npm run proxy:keyotter -- YOUR_KEYOTTER_CREDENTIAL_NAME
```

And the app in another:

```bash
JANUARY_API_BASE_URL=http://127.0.0.1:8787 npm run web
```

`JANUARY_API_BASE_URL` redirects all January requests, even when `JANUARY_API_KEY` is set. Pass it inline as above
rather than saving it in a `.env*` file, where it would keep pointing at the proxy after you stop it.

## How it's built

```
src/app/                         screens (Expo Router)
src/app/api/january/[...path]+api.ts
                                 server-only proxy: holds the key, allowlists the endpoints the app uses
src/lib/january/                 typed client, error messages, analysis → food-log mapping
src/lib/analyze.ts               the "Analyzing…" pipeline: photo/text → analysis → food log
src/lib/queries.ts               React Query hooks; writes patch the cache instead of refetching
src/lib/store.ts                 profile, goals, end-user id and per-meal metadata (zustand, stored on the device)
src/lib/images.ts                photo downsizing and on-device thumbnails (January stores logs, not pictures)
scripts/keyotter-proxy.mjs       optional local proxy for keyotter users
server.mjs                       Express server for self-hosting the web export
```

Things worth knowing about January's API, found while building this:

- **Portions come back two ways.** Text analyses give `selected_quantity` in serving units ("2 cups" → 2). Image
  and corrected analyses leave it null, and `quantity` is the number of servings. The app normalizes both before
  logging (`src/lib/january/mapping.ts`).
- **Show the log, not the analysis.** A logged food's nutrients come from January's catalog serving, so the app
  always displays the saved log. "Fix results" sends the current log back as an analysis, so corrections apply to
  what the user actually sees.
- **Retries follow January's rules.** Only codes January marks retryable are retried, once. Creating a log is
  never retried, because the first attempt may have gone through.

### Credits

Every January call except `/credits` costs a credit:

| Action | Credits |
| --- | --- |
| Open the app (one request covers 60 days of history) | 1 |
| Scan, upload or describe a meal (analysis + saving the log) | 2 |
| Open a meal for the first time (glucose prediction, then cached) | 1 |
| Fix results | 2 |
| Change servings or an ingredient | 1 |
| Search, or open a food | 1 each |
| Barcode lookup | 2 |
| Healthier swaps | 1 |

## Notes

- `demo/` has six free sample meal photos to try the app with, and a script that records a vertical demo video
  for social media (`npm run demo:record`). See `demo/README.md`.
- Photos and the profile live on the device (localStorage on the web).
- On the web, the scanner waits for the user to turn the camera on. Desktop visitors can upload a photo or try
  January's sample photo instead.
- Nutrition and glucose estimates are for demonstration and aren't medical advice.

## License

The code is under the MIT License ([`LICENSE`](../LICENSE)). The sample photos in `demo/sample-meals/` are from
Pexels and covered by the [Pexels License](https://www.pexels.com/license/); `demo/sample-meals/CREDITS.md` names the
photographers.
