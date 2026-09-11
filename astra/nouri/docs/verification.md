# Verification — September 10, 2026 (America/Los_Angeles)

## Result

- `npm run typecheck`: **0 errors**.
- `npm test`: **26 passing tests** covering portions, reconciliation, score ordering, target consistency, offset timestamps, route allowlisting, code-based retry classification, malformed bodies, device identity, ETag requirements, origin checks, missing keys, safe header forwarding, save recovery, nullable log IDs and concurrent diary operations.
- `npm run build`: **passed**, exporting the web client and `/api/january` server route.
- iOS and Android production JavaScript/Hermes exports: **passed** with the SDK-matched native modules. This is compilation evidence, not a physical-device test.
- Chromium desktop (1440×1100) and mobile (390×844): onboarding, real logging, editing and supporting screens exercised. Final browser pass: **0 unexpected console errors**, no mobile horizontal overflow.
- Production Node adapter: serves exported HTML/assets and the server route; Chromium onboarding, credit lookup and sample-photo screen pass with **0 console/hydration errors**. Missing-key response directs the user to developer.january.ai. Exported web bundles were scanned for the credential reference and local proxy override; neither server credential code nor proxy credentials were present.

## Real January results

These are measured responses, not preset demo values. Photo analysis is nondeterministic and can differ when run again.

| Browser action | Verified result |
| --- | --- |
| Sample garden-bowl photo | 674.94 kcal, 7/10 local score; catalog and saved totals reconciled |
| Typed `40 g feta cheese and 100 g cucumber` | 120.60 kcal; feta count **0.4 × 100 g** |
| Barcode `049000006346` | Cola, 140 kcal; a real diary log |
| Search `banana` | 105.02 kcal; a real diary log |
| Edit banana to two servings | 210.04 kcal; PATCH with day ETag |
| Plain-English correction to 20 g feta + 100 g cucumber | 67.80 kcal; guarded correction repair followed by PATCH |
| Glucose prediction | 10 real points over 0–135 minutes; low impact; IANA timezone/profile/offset and actual food+serving IDs supplied |
| Feta alternatives | 11 January suggestions returned |
| Healthier cola swap | Selected real alternative, reviewed in editor and saved as “A lighter drink” |
| Syrupy pancake photo | 429.00 kcal, **3/10**, lower than the salad’s **7/10** |
| Illustrated nutrition label through browser file picker | 139.86 kcal; upload converted to **1024×1280 JPEG**, 62,976 bytes before base64 |
| Browser camera, driven by a real meal image fixture | 559.84 kcal in final pass; capture/JPEG/analysis/catalog/log all completed |
| Delete | Actual January record removed with day ETag, then diary refreshed |
| Progress/settings | Real totals, weight recording, credits, reset confirmation |
| Start over/reload | Profile reset and onboarding completed again; meals and stable device ID preserved |

The browser camera used Chromium's fake device stream containing Anna Pelzer's credited salad photograph. No physical webcam, iPhone, Android device or signing account was tested. The capture remained at 640×480 rather than artificially upscaling a smaller input. Barcode numeric lookup was tested against January; physical barcode optics remain device QA.

## Issues found and fixed

1. React Native Web text nodes and SVG rotation attributes produced console errors; corrected conditional rendering and SVG transforms.
2. Desktop flex shorthand overrode the intended phone width; explicit basis/min/max width now keeps the frame at 430px.
3. Keyotter requires **relative** request-file paths. The initial invalid adapter request was refused locally and consumed no January credit.
4. January corrections can mis-scale nutrients inherited from text analysis. The consistency guard caught this before logging; a single bounded text re-analysis of corrected physical amounts repairs the response and is independently reconciled.
5. Camera permission loading could briefly render a stale permission button before the already-granted camera appeared. Permission initialization now shows a loading indicator, and explicit capture was re-tested successfully.
6. Newly analyzing meals now appear above the daily rings so the immediate feedback is visible on a phone.
7. Production hydration initially disagreed about the viewport width. The first client render now matches the server before enabling the desktop frame; a fresh production Chromium run confirms the error is gone.
8. Review found unconfirmed drafts could remain stuck and concurrent refresh/create could lose or duplicate a meal. Day-specific reconciliation now recovers drafts, distinguishes rejected saves, preserves photos/source, and handles nullable log IDs. A shared gate prevents overlapping diary operations, including delayed predictions and ingredient loading that could otherwise restore stale data. Seven regression tests cover these cases.

## Exact credit accounting

Free balance before testing: **508 used / 492 remaining**.
Free balance after testing: **578 used / 422 remaining**.

**70 credits consumed**, below the requested 100-credit ceiling. Breakdown:

- 4 initial contract probes (text, image, catalog feta, empty diary).
- 1 direct correction diagnostic.
- 65 paid operations through the bounded local proxy.
- One additional adapter attempt was rejected locally for its absolute body-file path: **0 credits**.
- Credit balance reads were free.

There were no API polling loops, no automatic paid retries, and no repeated create after an uncertain save. The proxy cap remained active throughout. No January key was read, copied, printed, stored in a file, or sent to a client bundle.

## Remaining release work

Physical iOS/Android and browser-specific barcode scanning QA; authenticated account ownership, production rate limits and abuse/billing controls; durable cross-device photo/profile storage and account recovery; review transitive SDK/tooling dependency advisories before public deployment. These are documented production boundaries, not mocked feature results.

## Visual-polish follow-up — September 10, 2026

Implemented a Start CTA, one-question onboarding (including validation, back navigation and conditional pace), colored target cards, frosted surfaces with native iOS Liquid Glass support, floating navigation, actual per-day calorie rings, dedicated January autocomplete and local water logging.

- **32 unit/server tests pass**; TypeScript is clean. New tests cover water unit conversion, zero-clamped removal, separate days, settings that preserve consumed volume, autocomplete minimum query/caching/serialization, stale suggestion and food-detail suppression, and calendar progress excluding unconfirmed meals.
- Chromium at 390×844 and 360×740: Start is visible; invalid age is rejected; back preserves the entered age; goal/pace work; target review completes; no horizontal overflow or console errors.
- Three water taps show **24 fl oz (3 cups)**; minus gives **16 fl oz (2 cups)**. Reload preserves the amount. Switching to a 250 ml cup preserves the existing volume; adding gives **723.2 ml**, and another date has independent history. These interactions issued **zero API requests**.
- Typing one character issued no request; `ban` produced real January suggestions; repeating it used the local cache. Selecting banana, reviewing the catalog serving and logging produced **105.02 kcal**, and the calendar ring updated. The test meal was then deleted using the day ETag.
- Final web production and iOS/Android exports pass. A fresh Chromium run against the production server verifies onboarding and water persistence with **zero API calls or console errors**. The mobile water total and controls remain visible above the floating navigation.
- **5 additional paid January calls**: autocomplete, catalog detail, create, day read, delete. This project's cumulative testing is **75 credits**, under the original 100-credit ceiling. The new proxy process is capped at 20 paid calls. Account credit balances may also reflect activity outside these tests; the follow-up count is verified directly from the proxy and browser request records.
- Screenshots: `welcome-glass.png`, `targets-glass.png`, `home-glass-mobile.png`, `home-glass-desktop.png`, and `autocomplete.png` under `docs/screenshots/`.

Native Liquid Glass rendering still needs physical iOS 26+ QA; web uses the frosted fallback. No January key value or `.env` contents were inspected, printed or copied. During this follow-up, Expo reported automatically loading an existing `.env` during export; subsequent build checks explicitly use `EXPO_NO_DOTENV=1`, and API testing continues through the inline Keyotter proxy override.

## Full screen review — September 10, 2026

The server was restarted using the existing `.env` file as explicitly requested. Its contents/key value were not displayed or copied. The production server also loaded `.env`; a browser credit lookup verified that connection. Client bundle checks found no server credential access, Keyotter reference, proxy override or January upstream URL. The public missing-key error intentionally names `JANUARY_API_KEY` as a setup instruction.

Changes from the screen review:

- Singular/plural streak text, real spacing between the streak number and label, a useful empty state, and a dark blur treatment with readable contrast.
- Calories next to their `kcal eaten` label; “Daily average” with the number of logged days. Zero-calorie meals count as logged days, while days without logs remain excluded.
- Three-letter chart weekdays, actual weight dates, a centered first weight point and a more appropriate weight scale.
- Compact profile and daily-target summaries in Settings, expandable editing, visible save/cancel feedback, and retained unsaved changes when sections close.
- Clearer add-meal headings, colored meal macro cards, singular serving labels, consistent unit spacing, long-button wrapping and correct glass layering for icons.
- Numeric inputs preserve fractional typing, including `.5` servings and `69.5` kg.

Verification: **33 unit/server tests passed**, TypeScript reported **0 errors**, and web/iOS/Android production exports passed. Chromium checked desktop 1440×1100, mobile 390×844 and narrow 360×740 layouts, every onboarding step, empty and populated progress, profile/target validation/save/cancel, local water persistence, meal detail/editing, corrections, glucose, swaps, camera permission/capture, upload, barcode, autocomplete and reset. Final production runs reported **zero unexpected console/hydration errors and zero horizontal control overflow**. Local visual/regression passes blocked all API calls.

Real API results in this round:

| Flow | Result |
| --- | --- |
| Garden-bowl photo | 698.51 kcal, 7/10 |
| Typed 40 g feta + 100 g cucumber | 120.60 kcal |
| Barcode cola | 140 kcal |
| Search banana / edit to two | 105.02 / 210.04 kcal |
| Correct feta to 20 g | 67.80 kcal |
| Glucose | 10 points, low predicted impact |
| Ingredient alternatives | 11 returned; a drink swap was reviewed and saved |
| Pancake photo | 429.00 kcal, 3/10 |
| Nutrition label upload | 139.86 kcal; resized to 1024×1280 JPEG |
| Camera image fixture | 574.91 kcal in the media pass |
| Delete / reset | Real ETag delete, stable device identity and preserved meals after reset/reload |

**55 paid credits used against this round's new 100-credit allowance**: core 21, extended 16, media 5, first final pass 5, successful final pass 8. The first final test selected an older meal with the same generated name; it correctly deleted that selected record but failed the test's expected ID. The test now selects a unique meal ID. No create request was automatically retried. Earlier sessions used 75 credits; cumulative project testing is 130, across the separately authorized allowances.

Final screenshots are in `docs/screenshots/review/`. Physical iPhone/Android and native Liquid Glass rendering still require device QA. Temporary browser identities, response records and native export fixtures were removed after verification; the development app remains available on port 8085 using `.env`.
