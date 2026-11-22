# Nearby pharmacies web

React, TypeScript and Vite web app that lists the pharmacies nearest to a starting point in
Finland. The page shows the labelled default origin (Helsinki Central Railway Station), the 20
nearest pharmacies from the bundled snapshot ranked by straight-line distance, a Leaflet map with
OSM tiles, a pin per listed pharmacy and the origin marker, and details with opening hours for the
selected pharmacy. The starting point can come from a city or address search, device location, or
a point chosen on the map. The layouts and text follow `docs/design/design-spec.md`. The repo also
holds the OSM data importer, the bundled
pharmacy snapshot in `src/data/`, the ranking code in `src/ranking/` and the shared ranking fixture
in `fixtures/ranking/`, which is also used by the iOS app. Product decisions live outside this repo
in the planning `PLAN.md`.

Run every command from the repository root. Use Node 22.12 or later in the 22 series, Node 24, or
Node 26+. `package.json` pins pnpm 12.21.0. Install dependencies from `pnpm-lock.yaml`.

## Source layout

| Path                      | Contents                                                                                    |
| ------------------------- | ------------------------------------------------------------------------------------------- |
| `src/App.tsx`             | Page layout: origin bar, results panel or sheet, map                                        |
| `src/app/state.ts`        | Origin, selection and sheet state (`appReducer`), `nearestPharmacies`, `pinPosition`        |
| `src/app/format.ts`       | Display name with the "Unnamed pharmacy" fallback, address lines                            |
| `src/components/`         | `ResultRow`, `PharmacyDetails`, `DetailsCard` (desktop), `HoursBlock`                       |
| `src/origin/`             | Geocoder, bundled place fallback, origin requests and coverage notices                      |
| `src/hours/`              | `interpretOpeningHours`: weekly view of common OSM `opening_hours` forms, else the raw text |
| `src/map/PharmacyMap.tsx` | Leaflet map, pins and origin marker                                                         |
| `src/map/config.ts`       | Build-time tile settings                                                                    |
| `src/styles.css`          | Design tokens as CSS custom properties (light and dark) and both layouts                    |

## Setup

```sh
pnpm install --frozen-lockfile
pnpm run test:ui:install
```

`--frozen-lockfile` fails instead of changing `pnpm-lock.yaml` when it does not match
`package.json`. After editing dependencies in `package.json`, run `pnpm install` and commit the
updated lockfile.

`test:ui:install` downloads Playwright's Chromium and WebKit into Playwright's browser cache. Set
`PLAYWRIGHT_BROWSERS_PATH` for both this command and `pnpm run test:ui` if the default cache is not
writable or readable in your sandbox. Skip it when that directory already holds the browsers.

## Commands

Use `pnpm run <script>` for the project scripts. Pass arguments directly after the script name.

| Purpose                              | Command                             | Expected result                                                                                                    |
| ------------------------------------ | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Interactive dev server               | `pnpm run dev`                      | `Local: http://127.0.0.1:5173/`; keeps running until stopped                                                       |
| Type check and production build      | `pnpm run build`                    | `tsc` prints nothing, then Vite prints `dist/...` sizes and `✓ built in ...`                                       |
| Serve the build                      | `pnpm run preview`                  | `Local: http://127.0.0.1:4173/`                                                                                    |
| Unit tests (Vitest)                  | `pnpm run test:unit`                | `Test Files  11 passed (11)` and `Tests  153 passed (153)`                                                         |
| UI tests (Playwright Test)           | `pnpm run test:ui`                  | `46 passed` and `6 skipped` (layout-specific tests) on `desktop-chromium` and `narrow-webkit`                      |
| Style check of changed and new files | `pnpm run style`                    | `style: OK, N changed file(s): ...` or `style: no changed source files`, exit 0; diagnostics and exit 1 on failure |
| Style check of the whole repo        | `pnpm run style:all`                | Oxlint prints nothing when clean; Oxfmt prints `All matched files use the correct format.`; exit 0                 |
| Apply formatting                     | `pnpm run format ./path/to/file.ts` | Rewrites only the named files; omit the paths to format the whole repo                                             |

`pnpm run test:ui` runs `pnpm run build && pnpm exec vite preview --port 4317`, serving the app on
`http://127.0.0.1:4317` for the run so it does not clash with a dev server on 5173. Each test sets
the browser locale (`sv-SE` for the English fallback, `fi-FI` for Finnish, `en-GB` elsewhere), so
results do not depend on the host language. Traces of failed tests are kept in `test-results/`;
open the report with `pnpm exec playwright show-report`.

The UI tests never contact a tile server. Import `test` and `expect` from
`tests/e2e/support/test.ts`, not from `@playwright/test`: its automatic `tiles` fixture answers
every `tile.openstreetmap.org` request with a 1 × 1 PNG, records the URLs in `tiles.urls`, and
aborts any other request that does not go to the preview server. `tests/e2e/launch.spec.ts`
covers both locales; `tests/e2e/selection.spec.ts` covers ranking, row and pin selection, details
with hours, keyboard use, the desktop details card, the narrow sheet heights, panning and 320 px
width. `tests/e2e/origin.spec.ts` covers consent, location results and failures, address
matches, city fallback, late replies, keyboard map picking and coverage notices. It stubs
the online geocoder and device location and exercise the bundled address files. Pins near the station overlap at the initial zoom, so
pointer tests pick a pin with `uncoveredPinName`.

## Origin search and location

The public demo defaults to Nominatim. Search sends only explicitly submitted text and the locale
and country filter. The browser keeps a session cache and starts at most one outbound geocoding
request per second per app page, with no autocomplete or retries. Keep use within the public
service’s application-wide limit and attribution requirements. [Nominatim usage policy](https://operations.osmfoundation.org/policies/nominatim/)

The deployed `geocoder.json` file configures a Nominatim or Photon endpoint and country filter.
It's loaded once per page and can be changed on the static host. Keep the filter aligned with the
bundled data. A build with both `VITE_GEOCODER_PROVIDER=geoapify` and `VITE_GEOAPIFY_KEY` uses
Geoapify. Vite embeds this key in the browser bundle, so use a site-restricted key.

Submitted matches appear in a dropdown below the field, with the place or street first and the
neighborhood, municipality, and country where available. Arrow keys highlight a match, Enter
chooses it, and Escape closes the dropdown.

Device location starts on user action and needs HTTPS or localhost. The app ranks from the GPS
fix immediately and looks for a nearby address using the bundled OSM index. It requests only the
relevant regional files from the app host. An unavailable address leaves “Your location” in the
field. The map picker appears after panning or zooming. Right-click or long-press to position its target directly. Keyboard users can
focus the map and pan with the arrow keys before choosing “Search from here”.

## Map tiles

Tiles follow ADR 0002: OSM Standard raster tiles from
`https://tile.openstreetmap.org/{z}/{x}/{y}.png`, max zoom 19, attribution
"© OpenStreetMap contributors" linked to `https://www.openstreetmap.org/copyright`. These are
build-time settings read in `src/map/config.ts`; override them when building, for example
`VITE_TILE_URL=https://tiles.example/{z}/{x}/{y}.png VITE_TILE_MAX_ZOOM=18 pnpm run build`. The
other variables are `VITE_TILE_ATTRIBUTION` (text; default is the localized "Map attribution"
message) and `VITE_TILE_ATTRIBUTION_URL`. Leaflet loads only the tiles in view; the app neither
prefetches tiles nor sets a `Referrer-Policy`. The OSM tile usage policy bans automated use, so
keep real tiles to manual review and stub them in tests.

## Locale behaviour

`src/i18n/locale.ts` walks `navigator.languages` in order and picks the first entry whose language
is `fi` or `en`, so `fi-FI` and `en-GB` match. Anything else falls back to English. The app sets
`<html lang>` and the page title to the chosen locale and formats the distance with
`Intl.NumberFormat` for it: `1.7 km straight line` in English, `1,7 km linnuntietä` in Finnish
(`formatDistance` in `src/i18n/distance.ts`, rounding as in the design spec and the fixture).
Messages live in `src/locales/en.json` and `src/locales/fi.json`, worded exactly as the spec's
"Interface text" table; a unit test keeps their keys in sync.

## Interactive review in the T3 shared browser

Manual review loads real OSM tiles; keep it light (a few page loads, no scripted panning).

1. Start `pnpm run dev` as a background process and wait for `Local: http://127.0.0.1:5173/`.
2. Open `http://127.0.0.1:5173/` in the T3 shared browser and take a snapshot. At 900 px and
   wider, expect a 400 px left panel with "Pharmacy finder" above "784 mapped pharmacies in
   Finland". The search field initially shows "Helsinki Central Railway Station (default)" and
   has a location icon at its right edge. The "Nearest pharmacies" list starts with "Steissin
   Apteekki, 50 m". The map fills the rest, with 20 pins, the blue origin dot and
   "© OpenStreetMap contributors" at the bottom right.
3. Click a row or a pin. The selected pin grows, the other pharmacy pins turn gray, and the map
   fits the starting point and the selected pin with a dashed blue line outlined in white. The row
   stays selected in the list. A details card over the map's top-left corner shows the name, distance, address and "Opening
   hours" from Monday to Sunday; the zoom control is at the top right. "Close details" or Escape
   closes the card and returns focus to the row, which stays selected. Press Tab to reach the rows
   and Enter to select one; the focus ring is blue.
4. The shared browser uses its own language list, so check it with `navigator.languages` in the
   page before judging the locale. Both locales are covered deterministically by
   `pnpm run test:ui`.
5. Submit “Kauppakatu 1” once and choose a municipality from the dropdown. Check that the
   field shows the selected match and the results change. Pan or right-click the map and choose “Search from here”. Try “Use my location” with
   location blocked to check the fallback notice.
6. Resize below 900 px (for example 390 and 320 px): the results become a sheet over the map that
   starts collapsed. The "Results" button expands it to 55 % of the map.
   Selecting expands the drawer and shows details. "Back to results" stays visible while scrolling
   and returns to the expanded list. Collapse the drawer to show only its toggle.
   At 700 px the hours and pharmacy information form a centered block. The back button and
   chevron sit at the outer edges of the toolbar. At phone widths the schedule is below the
   pharmacy information. Attribution moves to the top right. Then stop the dev server.

## Data commands

The data scripts run TypeScript directly with Node (type stripping), which needs Node 22.18+, 24
or 26. Formats, reproducibility and licence are described in
[`docs/data/README.md`](docs/data/README.md).

| Purpose                                | Command                                                          | Expected result                                                                |
| -------------------------------------- | ---------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| Import a PBF extract                   | `pnpm run data:import -- --input <file.osm.pbf> --region fi`     | `data:import: wrote N pharmacies and M places to src/data/ (osm-pbf, ...)`     |
| Interim import from an Overpass answer | `pnpm run data:import -- --overpass <overpass.json> --region fi` | `data:import: wrote N pharmacies to src/data/ (overpass-interim, ...)`         |
| Copy data, coverage and fixture to iOS | `pnpm run data:sync-ios -- --ios-repo ../nearby-pharmacies-ios`  | `copied ...` per file, then `data:verify: N file(s) match`                     |
| Check the iOS copies                   | `pnpm run data:verify -- --ios-repo ../nearby-pharmacies-ios`    | `data:verify: N file(s) match`, exit 0; `missing:`/`differs:` lines and exit 1 |
| Re-check the fixture in Python         | `pnpm run data:check-fixture`                                    | `fixture OK: 3 origins, 19 display cases`                                      |

The checked-in data comes from the Geofabrik Finland extract with OSM data from
2026-11-21T21:20:51Z: 784 pharmacies and 4,675 places. To refresh it, download the extract (about
742 MB) and run the importer. It reads the file three times and takes a few minutes:

```sh
curl -L -o /tmp/finland-latest.osm.pbf https://download.geofabrik.de/europe/finland-latest.osm.pbf
pnpm run data:import -- --input /tmp/finland-latest.osm.pbf --region fi
pnpm run data:sync-ios -- --ios-repo ../nearby-pharmacies-ios
```

The sync writes `NearbyPharmacies/Resources/Data/` and `NearbyPharmaciesTests/Fixtures/` in the
iOS repo. Commit both repos together. Regenerate the fixture's expected values only on purpose:
`python3 -I fixtures/ranking/compute_expected.py --write`, then
`pnpm run format ./fixtures/ranking/ranking-v1.json`.

## Agent stop hook

`scripts/style-check.mjs` checks tracked files with staged or unstaged changes plus untracked files
that Git does not ignore. It skips deleted files, symlinks, `pnpm-lock.yaml`, the generated
`src/data/*.json` files and unsupported extensions. Oxlint (`--deny-warnings`) runs on JavaScript
and TypeScript files; Oxfmt runs in `--list-different` mode on those plus JSON, CSS, HTML, Markdown and YAML. It never rewrites files.
Each failure names the file, the rule or formatting problem and the `pnpm run format ...` fix.

Run it directly:

```sh
node scripts/style-check.mjs
echo '{"stop_hook_active":false}' | node scripts/style-check.mjs --hook
```

The first form exits 0 when clean and 1 with diagnostics. The `--hook` form always exits 0: it prints
nothing when clean, `{"decision":"block","reason":"..."}` on failure, which makes the agent continue
with the diagnostics as its next prompt, and `{"systemMessage":"..."}` instead when
`stop_hook_active` is true, so a failure that survives one retry is reported once rather than
looping.

- **Claude Code** reads `.claude/settings.json` and runs
  `node "$CLAUDE_PROJECT_DIR/scripts/style-check.mjs" --hook` on `Stop`. Start Claude Code in this
  repository root. Claude Code shows project hooks in `/hooks`; it may ask you to review settings
  that changed while it was running.
- **Codex** reads `.codex/hooks.json` and runs
  `node "$(git rev-parse --show-toplevel)/scripts/style-check.mjs" --hook` on `Stop`. Codex loads
  project hooks only from a trusted project: accept the trust prompt when you first open this
  repository. It also skips a new or changed hook until you trust its exact definition, so run
  `/hooks` and trust this one after cloning and after each edit to `.codex/hooks.json`.

## Commits

Keep each commit focused on one change and write a short, imperative Conventional Commit subject
such as `docs: add agent skills`. Use `type(scope): summary` when naming the affected area adds
clarity, as in `test(locale): cover English fallback`.

## Limitations

- The bundled index is for place names. Street addresses rely on the online geocoder. Coverage
  uses the simplified OSM national boundary and warns within about 5 km of the land border.
- The hours view describes an ordinary week: public holiday (`PH`) rules are ignored, and values
  with months, weeks, dates, comments or `||` (10 of 623 in the snapshot) are shown as raw text.
- Pins near the station overlap at the initial zoom; clicks hit only the visible pin shape, and
  every pin is also reachable with Tab and Enter.
- Dependency and Playwright browser downloads require network access. The UI suite starts a local
  server on port 4317. If the agent sandbox blocks network access or that listener, run the affected
  command outside the sandbox with approval.
