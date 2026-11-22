# Nearby pharmacies web

React, TypeScript and Vite shell for the nearest-pharmacy web app. Task 1 scope only: a localized
heading and one illustrative `0.4 km` straight-line distance. There is no map, geocoder or pharmacy
data yet. Product decisions live outside this repo in the planning `PLAN.md`.

Run every command from the repository root. Use Node 22.12 or later in the 22 series, Node 24, or
Node 26+. npm uses the committed `package-lock.json` to install dependencies.

## Setup

```sh
npm ci
npm run test:ui:install
```

`test:ui:install` downloads Playwright's Chromium and WebKit into Playwright's browser cache. Set
`PLAYWRIGHT_BROWSERS_PATH` for both this command and `npm run test:ui` if the default cache is not
writable or readable in your sandbox.

## Commands

| Purpose                              | Command                               | Expected result                                                                                                    |
| ------------------------------------ | ------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Interactive dev server               | `npm run dev`                         | `Local: http://127.0.0.1:5173/`; keeps running until stopped                                                       |
| Type check and production build      | `npm run build`                       | `tsc` prints nothing, then Vite prints `dist/...` sizes and `✓ built in ...`                                       |
| Serve the build                      | `npm run preview`                     | `Local: http://127.0.0.1:4173/`                                                                                    |
| Unit tests (Vitest)                  | `npm run test:unit`                   | `Test Files  2 passed (2)` and `Tests  15 passed (15)`                                                             |
| UI launch smoke (Playwright Test)    | `npm run test:ui`                     | `4 passed`: English fallback and Finnish on `desktop-chromium` and `narrow-webkit`                                 |
| Style check of changed and new files | `npm run style`                       | `style: OK, N changed file(s): ...` or `style: no changed source files`, exit 0; diagnostics and exit 1 on failure |
| Style check of the whole repo        | `npm run style:all`                   | Oxlint prints nothing when clean; Oxfmt prints `All matched files use the correct format.`; exit 0                 |
| Apply formatting                     | `npm run format -- ./path/to/file.ts` | Rewrites only the named files; omit the paths to format the whole repo                                             |

`npm run test:ui` builds the app and serves it on `http://127.0.0.1:4317` for the run, so it does not
clash with a dev server on 5173. Each test sets the browser locale (`sv-SE` for the English fallback,
`fi-FI` for Finnish), so results do not depend on the host language. Traces of failed tests are kept
in `test-results/`; open the report with `npx playwright show-report`.

## Locale behaviour

`src/i18n/locale.ts` walks `navigator.languages` in order and picks the first entry whose language
is `fi` or `en`, so `fi-FI` and `en-GB` match. Anything else falls back to English. The app sets
`<html lang>` and the page title to the chosen locale and formats the distance with
`Intl.NumberFormat` for it: `0.4 km straight line` in English, `0,4 km linnuntietä` in Finnish.
Messages live in `src/locales/en.json` and `src/locales/fi.json`; a unit test keeps their keys in
sync.

## Interactive review in the T3 shared browser

1. Start `npm run dev` as a background process and wait for `Local: http://127.0.0.1:5173/`.
2. Open `http://127.0.0.1:5173/` in the T3 shared browser and take a snapshot. Expect a level-one
   heading and the caption "Example distance" above `0.4 km straight line`
   for an English or unsupported browser language.
3. The shared browser uses its own language list, so check it with `navigator.languages` in the
   page before judging the locale. Both locales are covered deterministically by
   `npm run test:ui`.
4. Resize to a narrow width (for example 390 px) to check the narrow layout, then stop the dev server.

## Agent stop hook

`scripts/style-check.mjs` checks tracked files with staged or unstaged changes plus untracked files
that Git does not ignore. It skips deleted files, symlinks, `package-lock.json` and unsupported
extensions. Oxlint (`--deny-warnings`) runs on JavaScript and TypeScript files; Oxfmt runs in
`--list-different` mode on those plus JSON, CSS, HTML, Markdown and YAML. It never rewrites files.
Each failure names the file, the rule or formatting problem and the `npm run format -- ...` fix.

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

- The page shows one illustrative distance only. Pharmacy data, ranking, maps and search start in
  later tasks.
- In the agent sandbox used to build this repo, `npm ci`, `playwright install` and `npm run test:ui`
  needed to run outside the sandbox: the network proxy refused the npm registry and Playwright CDN,
  and the sandbox forbids binding local ports (`listen EPERM 127.0.0.1:4317`).
