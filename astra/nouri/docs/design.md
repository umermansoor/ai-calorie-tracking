# Nouri design and implementation plan

Goal: an original mobile-first Expo calorie journal with real January v1.2 analysis, logging and glucose predictions. All work stays in nouri; no commits or reading .env files.

Architecture: Expo SDK 57 + Router server routes. A strict endpoint allowlist on /api/january forwards to January with a server-only key. A loopback-only keyotter adapter supports the owner's demo with an inline override. React Native views, SVG charts and local durable storage work on web/iOS/Android. Device identity survives start-over. Local meal metadata stores photos, original analyses, verified catalog selections and predictions; January stores the actual diary.

Design: Nouri wordmark and geometric seed icon, warm white canvas, black rings, muted sage accents. Desktop places a 430px-wide app on a quiet editorial background. Home shows a real week, calories/macros remaining, streak, immediate analysis cards and meal history. Meal details support catalog ingredient/portion editing, natural language corrections, alternatives and explicit glucose prediction. No invented history or fake API results.

Defaults: adult metric onboarding (30, 170 cm, 70 kg), biological sex for January, moderate activity, balanced diet, maintain goal, gentle pace. Editable Mifflin–St Jeor energy estimate, activity factor and ±250/500 kcal; protein/fat/carbohydrate targets. No assumed health conditions. Date boundaries use the device IANA zone. No automatic paid calls on screen focus and no polling. Glucose is generated on demand for each meal and cached, invalidated on food/profile edits.

Implementation sequence:
- [x] Contract + safety tests: generated types from downloaded schema; unit conversion tests for image 40 g feta vs catalog 100 g, text selected quantities, macro consistency, mismatch blocking, score ordering, code-based retry policy and endpoint allowlist.
- [x] Server boundary + keyotter adapter: body limits, safe headers, exact allowlist, no exposed upstream secrets, concurrency limits, 100-call demo hard cap, no retry creating logs.
- [x] Domain client: catalog caching, serving resolution, pre/post nutrition reconciliation, persistent device diary, day etags and conflicts, recover ambiguous creates by reading diary.
- [x] Product: onboarding, daily dashboard, six intake modes, ingredient editor/corrections/swaps, glucose curve, progress and settings/reset.
- [x] Verify: typecheck, unit tests, production export and real browser onboarding/photo/text/barcode/search. Additional real edits/deletion/correction/prediction and error checks within budget. Document exact credits and known gaps.

Serving invariant: food-log quantity is a COUNT of a catalog serving. Image detection quantity expresses consumed units; text selected_quantity supplies the consumed amount. Resolve the matching catalog serving ID, require matching units, divide the consumed unit amount by catalog serving.quantity, and compare to analysis total_nutrients. Block unresolved mismatches. Verify hydrated log totals too. A bounded re-analysis repairs inconsistent correction totals using the returned physical amounts.

Start-over: explicit confirmation resets profile, targets and weight history while preserving all meals and the stable device ID. Individual meal deletion removes the actual January record. Production needs authenticated users and rate limiting before a public multi-user launch.
