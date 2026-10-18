# Season 1 country preference — local preview

Status: website release authorized on 2026-10-18; explicitly approved Supabase migration ACTIVATED. Website publication is tracked by the matching GitHub Pages workflow. No World allocation or real country preference was submitted during testing. Immediately before release, read-only production verification found all 70 countries available and zero reserved; future real team submissions change availability normally.

## Preview

`http://localhost:3047/season1/countries/preview`

Connected local page: `http://localhost:3047/season1/countries` (sign in with an existing account; real saves enabled). The `/preview` route remains an explicitly labelled in-memory demo and cannot save production records. Both share the same Season 1 hero scene, globe artwork, motion, navigation, world map and selection presentation.

Start the connected preview with `node scripts/preview-season1-connected.mjs`. It reads only the existing public `anon` browser key from the local Supabase CLI, uses the existing first-party HTTP gateway and starts Next on port 3047. No service-role or management credential is passed to the frontend or saved to disk.

Development-only fixture route; production rendering calls `notFound()` and does not render the demo (a static host may serve that not-found file with HTTP 200). An exact development-only shell exception for `/season1/countries/preview` keeps simulated data separate from account/onboarding providers. All real Season 1 routes retain their normal account gates. The old `/live-auction/country-preview` fixture was moved, not retained as an Auction entry.

The actual entry is Season 1 Lobby → Country Selection, at `/season1/countries`. It is a sibling of `/season1/my-team`, not an embedded lobby panel or an Auction subpage. The three pages share a Season 1 workspace navigation. The lobby links to Country Selection beside My Team, and My Team links through the same navigation. The preview uses the same map/selection presentation with an explicitly labelled in-memory adapter. It does not claim to verify production authentication, Supabase Realtime delivery or production migration activation.

Demo controls: member count, recruitment lock, captain/member view, competing reservation. All 70 countries start available, matching the verified initial production state; the conflict control can demonstrate a competing selection. Reload resets all demo choices.

## Behavior and boundary

- Captains must satisfy both stored captain user ID and current captain membership; ordinary members/admins cannot bypass captain checks.
- Require >= 3 actual current members, recruitment locked, mutable team status, active authenticated account and existing Season 1 gate.
- One active preference per team; unique partial index prevents two teams reserving the same code in the season, including simultaneous submissions.
- A failed change leaves the old preference intact. Expected previous code prevents stale browser tabs silently overriding another selection. Same-code retries are idempotent.
- Unlocking recruitment, dropping below 3 members, or dissolution releases the preference. Requalifying requires a fresh choice; no automatic reclaim.
- Captain removal and member self-leave use unchanged existing RPCs. Recruitment lock is not a roster freeze. Captain succession remains supported.
- Availability exposes only country codes/occupied flags and the caller’s own team preference. No other team identity, submitter ID, private roster or message is returned.
- Direct table access is revoked with RLS enabled. Only guarded functions can read/write. Private helper functions are not callable by participants.
- Realtime invalidation uses existing authorized team/member channels; fallback is coordinated by the existing single-flight refresh controller (15 seconds connected, 5 seconds disconnected with backoff, paused while hidden). No preference rows are broadcast.
- Country preferences are OS registration intentions only. No World economic, legal, runtime, office, official country-assignment or execution data is imported or written.

## Images

Source repository: `samuelq800/econmind-os-world-simulation`.
Pinned commit: `1a40309601074fe37fa3526f66a0b5c0beedb308`.
Source: `apps/world-web/src/assets/country-scenes/{01..70}.png` and `index.json`.

`lib/season1/country-catalog.json` records all 70 names/codes, native dimensions, original PNG SHA256, output SHA256 and index provenance. Images are illustrated planning scenes, not photographs or authoritative allocations. Country 52 is Zorin, matching the supplied screenshot.

`scripts/import-season1-country-scenes.mjs` reproducibly imports native-resolution quality-90 WebP and 480px quality-82 thumbnails. Original PNGs are cached only in the system temporary directory. No cropping, repainting or external substitute photos. About 48 MiB total output; thumbnails are lazy-loaded and full scenes are requested only for the selected country. Asset URLs honor the existing GitHub Pages base path.

### World map

The page now includes a full-map overview above the selection panel, using the same pinned World repository's `apps/world-web/src/assets/asterra-satellite-terrain-v8.png` and `apps/world-web/src/map-lab/land-partition.json`. `scripts/import-season1-world-map.mjs` builds a self-contained SVG with embedded optimized terrain, original boundaries and all 70 matching code labels. `lib/season1/world-map.json` records sources and SHA256 provenance. Open Full Map opens the full-size asset. This is geographic reference only, not a map of reservations or World allocations.

## Local verification

- TypeScript: `node node_modules/typescript/bin/tsc --noEmit`.
- Unit/regression: `node node_modules/vitest/vitest.mjs run`.
- PostgreSQL 16 disposable **season1_test** database: `scripts/test-season1-country-preferences.sql`, which includes existing lifecycle/admin/name-reuse regressions, new migration twice, authorization checks, idempotency, conflict rollback, member removal/leave, handover, release and requalification.
- `scripts/test-season1-country-concurrency.mjs`: two simultaneous authenticated captains submit the same country; exactly one active reservation.
- `scripts/test-season1-country-preview.mjs`: Playwright desktop/mobile interactions, 70 cards, reserved choices disabled, name search, manual code entry, successful save, unlock/member-count release, captain-only controls, competing-selection error and no horizontal overflow. Set `PLAYWRIGHT_MODULE` to an installed Playwright module path if not installed in this checkout.
- Screenshots visually reviewed in `/tmp/econmind-country-preview`.

The previous implementation passed disposable PostgreSQL lifecycle/preference and concurrent-claim checks. Those SQL files are unchanged in this route/map revision. Updated frontend checks include map provenance and all 70 labels, sibling navigation, account policy preservation, the development-only preview boundary, desktop/mobile screenshots and unchanged country-selection interactions. The disposable database server was stopped; the requested local preview remains running.

The migration `supabase/migrations/20261018000000_season1_country_preferences.sql` was applied to the explicitly authorized main OS project `vimksjrhaxdpnkvgsavz` through `scripts/publish-season1-country-preferences.mjs`, not a broad migration push. Migration SHA256: `cff17eb443601e9d1053db01790efe2549e327e976f04ff4572d3a00560fa87e`.

Production checks: exact ledger statement digest matched; guarded RPC grants, RLS, private helper restrictions, unique partial index and automatic-release triggers verified; anonymous read/write HTTP requests denied with 401/42501; preference table contains zero records. The migration transaction compared all existing team/member row fingerprints and captain-remove/member-leave/recruitment-lock function definitions before/after, and would have rolled back on any difference. Preflight contained 57 teams and 127 memberships. No test reservation was created and no World runtime tables were read or written.

`scripts/test-season1-country-release.mjs` additionally executed the exact publisher transaction in disposable PostgreSQL 16 and verified its independent readback and no-replay branch. All local behavioral/concurrency tests remain separate from production activation evidence. Real authenticated browser save, multiple production browsers' Realtime propagation and user acceptance are NOT RUN; a qualified captain must sign in to exercise the real workflow. Website release still requires separate user authorization.
