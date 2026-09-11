# Nouri

An original, mobile-first nutrition journal for web, iOS and Android. Built with **Expo SDK 57**, Expo Router, React Native and TypeScript, using January AI v1.2. Nouri is **not affiliated with, endorsed by, or a product of Cal AI**. Its name, icon, design and copy are original.

## Run from scratch

Use Node.js **22.13+** (Node 24 LTS recommended).

```sh
cd nouri
npm install
cp .env.example .env
```

Get a **v1.2** key at [developer.january.ai](https://developer.january.ai). Edit your own `.env` and set:

```dotenv
JANUARY_API_KEY=your_key_here
```

Then one command starts the web app and its API server:

```sh
npm start
```

Open [localhost:8085](http://localhost:8085). Complete onboarding, then use **+** to add a meal. The photo screen includes three credited sample photos. These call the real API; there are no fabricated meal results or preloaded fake history. January credits are required. `GET /credits` is free; other API operations consume credits.

The key stays in the **Expo Router server route**, `app/api/january+api.ts`. The route is the only code that talks to January. No secret has an `EXPO_PUBLIC_` name or appears in the Expo config/client bundle. `.env` files are gitignored.

### Keyotter demo option

This option never reads or exports the key into Node, Expo, a shell variable or the browser. Keyotter resolves it when making its HTTPS request.

1. Ensure `keyotter` is installed and your saved key is named `JANUARY_AI_PROD_APIKEY`. `keyotter secret list --json` lists credential names and metadata.
2. Start the local adapter from the **nouri directory**:

   ```sh
   npm run keyotter-proxy
   ```

3. In another terminal, pass the local override **inline**:

   ```sh
   JANUARY_PROXY_ORIGIN=http://127.0.0.1:8788 npm start
   ```

Do not put that override in `.env`, Expo config, or another file. The adapter binds only to `127.0.0.1`, rejects browser-origin requests, allows only the app's January endpoints, and invokes `keyotter curl` without a shell. JSON request files use random relative paths under `.tmp`, are mode 0600, and are deleted in `finally` and on normal termination. It prints only endpoint/method/request counts. It does not print keys, headers, bodies or meal data.

The default adapter cap is **96 paid requests per process**, leaving room for four initial contract probes within a 100-call test allowance. Change it explicitly with `KEYOTTER_MAX_CALLS=20 npm run keyotter-proxy` for a smaller session. It never polls or automatically retries. Stop it with Ctrl-C. Do not expose this local demo adapter on the internet.

### iPhone with Expo Go / Android

Install the current **SDK 57-compatible Expo Go**, and put the phone and computer on the same network:

```sh
npm run native
# or, with the local keyotter adapter already running:
JANUARY_PROXY_ORIGIN=http://127.0.0.1:8788 npm run native
```

Scan the QR code with the iPhone Camera/Expo Go or Android Expo Go. Allow camera and photo permissions. The app sends requests to the computer's Expo server via `Constants.expoConfig.hostUri`; the phone never connects directly to the loopback adapter and never gets the January key. If LAN discovery is blocked, allow the local server through your firewall or use an Expo tunnel. A different device gets a different January diary identity.

## What works

- Adult onboarding: sex, age, height, weight, goal, pace, activity and diet; calculated, editable daily calorie and macro targets.
- A concise **Start** welcome, one onboarding question per screen, numeric steppers, back navigation and a colored target review. The pace question appears when gaining or losing weight.
- Daily calorie/macro rings, a seven-day strip, real streak, meals, and an immediately visible **Analyzing…** card. No API calls on tab focus.
- Each calendar date has a calorie-progress ring based on that day's saved meals. Calorie, protein, carbohydrate and fat use distinct violet, blue, peach and pink accents.
- Water logging is **entirely local**: per-day amounts, plus/minus a cup, an editable cup size and goal, and US fl oz/ml units. Defaults are 8 fl oz per cup and a 64 fl oz goal. It persists through reloads using browser local storage (AsyncStorage on native); no water data goes to January.
- Camera capture, photo upload, barcode camera/manual number, nutrition-label upload/capture, catalog search, and natural-language descriptions.
- Meal photos, saved nutrition, local 1–10 score, name/ingredient/serving editing, plain-English corrections, and actionable healthier swaps. A swap opens the ingredient editor for portion review before saving.
- Profile-based January glucose curves with explicit **not medical advice** labeling. Generate on demand; cached curves are invalidated when the meal or profile changes.
- Seven-day intake charts, recorded weight trends, settings, remaining credits, and a confirmed start-over flow.
- Start over resets profile, targets and weight history, **preserving meals, water history/preferences and the stable device ID**. Individual meal deletion removes the actual January record as well as local photo/prediction metadata.

The interface uses frosted surfaces, subtle background colors and a floating glass tab bar. Supported iOS 26+ devices use native [Expo Liquid Glass](https://docs.expo.dev/versions/v57.0.0/sdk/glass-effect/) for the tab bar; web and other devices use a blur/tint fallback. Reduced Transparency on iOS switches to solid surfaces. Native button and selection feedback uses Expo Haptics.

Search uses January's dedicated autocomplete API after a **600 ms pause** and at least two letters/digits, up to 64 characters. Each uncached query costs a credit. The current search component caches up to 40 queries, serializes requests, coalesces superseded queries and ignores stale suggestions/detail responses. Selecting a suggestion fetches its real catalog food and servings before logging.

## Correctness decisions

### Portions and reconciliation

`FoodSelection.quantity` means **number of catalog servings**, not grams.

- Text: consumed amount is `DetectionServing.selected_quantity` when present.
- Photo/correction: consumed amount is `DetectionServing.quantity` when `selected_quantity` is null.
- Fetch the catalog food, match its opaque serving ID, and divide the consumed amount by the catalog serving's `quantity`. Units must match; unknown IDs/units block saving.
- Catalog nutrition is multiplied by `FoodServing.scaling_factor × number_of_servings`.
- Before logging, compare calories, protein, carbohydrate and fat against the analysis's `total_nutrients` (8% tolerance, or 8 kcal / 1.5 g to allow rounding).
- After logging, compare the hydrated log totals again. January's logged nutrient values are already scaled; **do not multiply them again**. A discrepancy is prominently flagged on the meal page.

The regression case is covered by tests: **40 g feta / 100 g catalog serving = 0.4 servings**, approximately 106 kcal, never 40 servings. Catalog definitions are cached and restored from saved meal metadata.

The real corrections endpoint sometimes inherits incorrectly scaled nutrition from a text analysis. Nouri first sends the original analysis **unchanged**, as the spec requires. If the corrected physical portions disagree with catalog nutrition, it performs **one new text analysis** of the returned food names and physical amounts, resolves it, and requires reconciliation again. This is a bounded repair, not a repeated correction request or a log retry. Meals created through search/barcode first obtain a text analysis when a plain-English correction is requested.

### Identity, concurrency and failures

A cryptographically random `nouri-…` device ID is stored separately from the journal. Every food-log request forwards it in `January-End-User-ID`. Each edit/delete reads that meal's local calendar day in the user's IANA timezone, checks for a changed log, and forwards the returned day **ETag as `If-Match`**. Changed records require review rather than blind overwriting.

No automatic paid retries or polling are used. Error behavior branches on stable API `code` values. Only the spec's transient codes are classified as retryable; credit exhaustion and `not_implemented` are not. **Creating a log is never retried.** An ambiguous save is marked unconfirmed; Refresh reads the diary to reconcile it before any further action. Every visible error includes a next step, including a link/address to developer.january.ai for missing/rejected keys.

Diary reads, writes, predictions and ingredient loading share an operation lock. A refresh cannot race a create or restore an outdated glucose curve. Definitively rejected saves remain editable/discardable drafts. An unconfirmed save is matched by its exact time and meal name; if a successful day read confirms its absence, it becomes a recoverable draft. Recovery can read an older meal's specific day, beyond the normal 30-day refresh window.

Uploaded/captured photos are converted to JPEG and shrunk toward **1,024 px on the short side**, preserving aspect ratio, never upscaling small images, and capping the long side at 2,048 px. The 900 KB data-URI cap also accommodates Keyotter's 1 MiB request limit. Very large results ask the user to crop closer. Samples use size-limited public image URLs.

### Defaults and score

The default profile is an adult aged 30, 170 cm, 70 kg, female, moderately active, maintaining weight, balanced diet. Every field is editable. Targets use the Mifflin–St Jeor equation, activity multipliers, and a 250/500 kcal goal adjustment with a conservative calorie floor. Protein is 25% (30% for high-protein), fat 30% (40% for lower-carb), and carbohydrate the remainder. These are estimates; custom targets are supported. No health conditions or CGM history are assumed.

The Nouri score is a transparent local heuristic: fiber/protein density raise it; sugar, saturated fat and high sodium density lower it. Missing nutrient fields may make it less informative. It is neither a January score nor a clinical rating. There is no dish-name shortcut to force the pancake/salad comparison.

## January endpoint map

All paths below are under `/v1.2`. The browser/native app talks only to `POST /api/january`, which validates an exact method/path allowlist and strips unapproved query/header fields.

| Feature | January endpoint |
| --- | --- |
| Meal photo, camera, sample photo, nutrition label | `POST /food-analysis/image` |
| Typed description; bounded correction repair | `POST /food-analysis/text` |
| Fix results | `POST /food-analysis/corrections` |
| Food autocomplete under Search | `GET /foods/autocomplete?query=…&limit=8` |
| Barcode | `GET /foods/barcode/{barcode}` |
| Portion validation and all available servings | `GET /foods/{food_id}` |
| Create a real diary record | `POST /food-logs` |
| Refresh (last 30 days), save recovery, day ETag | `GET /food-logs?start_date=…&end_date=…&timezone=…` |
| Edit ingredients/name/portions | `PATCH /food-logs/{log_id}` with `If-Match` |
| Delete a meal | `DELETE /food-logs/{log_id}` with `If-Match` |
| Healthier alternatives, respecting diet preference | `POST /foods/{food_id}/alternatives` |
| Meal blood-sugar curve | `POST /glucose/predictions` |
| Remaining credits | `GET /credits` (free) |
| Targets, calendar/macro rings, health score, streak, weight/progress charts | Computed locally from profile and actual logged meals |
| Water logging and settings | Local browser/device storage only; no January endpoint |

The downloaded [v1.2 OpenAPI schema](https://partners.january.ai/v1.2/openapi.json) is checked into `january-openapi.json`; `lib/january-schema.ts` is generated from it. Regenerate with `npx openapi-typescript january-openapi.json -o lib/january-schema.ts` when deliberately upgrading the contract.

## Host the web version

This app requires a **server**, not static-only hosting. `web.output` is `server`.

```sh
npm install
npm run typecheck
npm test
npm run build
npm run serve
```

`npm run serve` serves `dist/client` assets and delegates HTML/API requests to Expo's official `expo-server/adapter/http`. It loads `.env` if present and defaults to port 3000; use `PORT=8080 npm run serve` if needed. In a hosting platform, set `JANUARY_API_KEY` as a **runtime server secret** and deploy `dist/`, `scripts/serve.mjs`, and runtime dependencies. Use HTTPS, preserve the public Host header through your reverse proxy, and allow requests to run for up to 120 seconds. Never publish `dist/server` as static files or expose source maps containing server internals. Browser cameras require HTTPS (localhost is allowed).

EAS Hosting is also supported by Expo's server output: configure a project and its server-side secret, run `npm run build`, then `npx eas-cli deploy`. Consult [Expo Router API route deployment](https://docs.expo.dev/router/web/api-routes/) for the current hosting-provider adapter and secret configuration.

### Production iOS/Android builds

Deploy the HTTPS API server first. Set the **non-secret** `NOURI_API_ORIGIN` to its origin when evaluating the app config/building. The app config passes this to Expo Router and the native API client:

```sh
NOURI_API_ORIGIN=https://your-nouri-host.example npx eas-cli build --platform ios
# Android:
NOURI_API_ORIGIN=https://your-nouri-host.example npx eas-cli build --platform android
```

For cloud builds, set `NOURI_API_ORIGIN` in the selected EAS build environment too; a local shell variable is not automatically a remote build secret/environment. Choose your own bundle/package identifiers, configure an EAS project and signing credentials, and supply store/privacy metadata. iOS distribution requires an Apple Developer account. January credentials belong **only on the deployed server**, not in EAS native build variables. SDK 57's documented minimum is iOS 16.4 and Node 22.13; check [the SDK 57 reference](https://docs.expo.dev/versions/v57.0.0/) for current Xcode requirements. Physical device permission/network QA is still necessary before release.

## Verification

```sh
npm run typecheck
npm test
npm run build
```

`npm run test:browser` runs a **paid, real-API** Chromium flow with a fresh device identity (onboarding, sample photo, text, barcode, search). It requires the app on port 8085 and a working server key. Install its browser with `npx playwright install chromium`. It is deliberately not part of `npm test`. Browser calls are finite, not polled; waiting for UI completion does not make additional API requests.

Additional scripts exercise corrections, glucose, ETag edits/deletes, swaps, camera, label upload, mobile layout and reset/persistence. The camera test uses a generated local fake camera stream, not an actual webcam. See `docs/verification.md` for this implementation's measured results and credit accounting. Screenshots and browser state are ignored under `test-results/`; they can contain meal/profile data and are not source assets.

The extended paid scripts use the core test's saved browser identity: run `node scripts/browser-extra.mjs`, then `node scripts/browser-media.mjs`, then `node scripts/browser-final.mjs`. Run them deliberately, with enough credits; they are not background monitors. `node scripts/browser-production.mjs` checks the exported server on port 3000 and only calls the free credit endpoint. Temporary response files and test browser state from this build session were removed; the tests recreate their artifacts when run.

`node scripts/browser-polish.mjs` verifies the focused onboarding, water persistence/units/day separation, calendar ring update, and a real autocomplete → catalog → log → delete flow. Its verified run used **5 paid calls**; local onboarding and water interactions used zero.

`node scripts/browser-local.mjs` checks onboarding, water persistence and mobile visibility while blocking all API requests. Set `NOURI_TEST_ORIGIN=http://localhost:3000` inline to check the exported production server instead of the development server.

## Limits to understand

- This is a complete personal demo, with a random device diary identity rather than an account system. Before a public multi-user launch, add authenticated user ownership and server-side rate limiting/billing controls. The endpoint allowlist and origin check alone are not user authentication.
- Photos/profile/predictions/weight and water history are device-local. Clearing app/browser storage loses the device ID and local metadata; reinstalling does not restore another device's diary. January logs remain under their original ID. Refresh imports the most recent 30 days; older locally saved meals remain available.
- AI recognition and catalog coverage vary. Unmatched foods or inconsistent portions are blocked with a correction/search path. Scores and glucose predictions are estimates, not medical advice. Type 1 diabetes prediction is not supported by January; the app submits no health-condition assumption.
- Barcode camera support depends on the platform/browser. Numeric entry always works; cameras and uploads have an explicit fallback. Native bundles were compiled; no physical iPhone/Android or App Store signing was available in this session.
- `npm audit` reports upstream transitive Expo/tooling advisories. Do not apply its suggested downgrade to Expo 46; keep the SDK aligned and review updated patches before a public deployment.

## Photo credits

All three sample photos are free to use under the [Unsplash License](https://unsplash.com/license), with attribution also shown inside the app:

- Garden bowl — [Anna Pelzer](https://unsplash.com/photos/IGfIGP5ONV0).
- Sunday pancakes — [nikldn](https://unsplash.com/photos/HzVHlwvQlyw).
- Morning yogurt — [Tetiana Bykovets](https://unsplash.com/photos/gOCWfZppp6M).

The illustrated nutrition-label fixture and geometric Nouri icon were created for this project. The label is test data, not a product photograph or a supplied January result.

The full screen-review scripts are `node scripts/browser-screens.mjs` (visual captures) and `node scripts/browser-review-local.mjs` (onboarding, settings, water, decimal inputs and progress regression checks). Both block API requests and use the real test identity saved by the core browser test for populated screens. Set `NOURI_TEST_ORIGIN=http://localhost:3000` inline to inspect a production export; the fixtures adapt their stored origin automatically. Settings opens with profile/target summaries; use **Edit profile** or **Adjust targets**, then **Save profile & targets** to apply changes.
