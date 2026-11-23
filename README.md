# Nearby Pharmacies · Web

Find the 20 closest mapped pharmacies to a starting point in Finland. The React app starts at
**Helsinki Central Railway Station** and ranks results by straight-line distance. Choose a row or
pin to see the pharmacy's address and weekly opening hours.

| Desktop · English                                                    | Mobile · Finnish, dark mode                                                                                                   |
| -------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| ![Desktop map and pharmacy details](docs/images/desktop-details.png) | <img src="docs/images/narrow-details-fi-dark.png" width="300" alt="Mobile map and pharmacy details in Finnish and dark mode"> |

[Watch the app journey](docs/images/journey.gif)

## Run locally

Use Node 22.12+, 24, or 26+ and the pnpm version pinned in `package.json`. The default setup
needs no account or API key.

Run `nix develop` for Node 24, Corepack, and the data and hook tools. With direnv and nix-direnv
configured, `direnv allow` loads the shell automatically. See [agent stop hooks](AGENTS.md#agent-stop-hooks)
for Betterleaks setup and the history scan.

```sh
pnpm install --frozen-lockfile
pnpm run dev
```

Open `http://127.0.0.1:5173/`. Search for a city or street address, choose **Use my location**, or
select **Choose on map** and confirm with **Search from here**. On narrow screens, open the results
drawer to see the list. The app follows the browser's preferred supported language, Finnish or
English.

## Data and services

- **Ranking runs locally** against a snapshot of 784 Finnish pharmacies. Both apps use
  unrounded haversine distance, break exact ties by OSM ID in UTF-16 order, and round the display
  only. A [shared fixture](fixtures/ranking/ranking-v1.json) checks parity with the SwiftUI app
  in `nearby-pharmacies-ios`. [Coverage and ranking decisions](docs/adr/0001-finland-coverage-and-straight-line-ranking.md)
- **Address search** sends submitted text, language, and country filter to Nominatim by default.
  Bundled Finnish and Swedish place names provide a fallback. Device fixes and map picks use
  “Your location” and “Dropped pin.” [Geocoder configuration and privacy](docs/adr/0002-geocoder-and-web-tiles.md)
- **Map tiles** come from OpenStreetMap through Leaflet. The tile provider receives requests for
  the visible map area. [Tile configuration](AGENTS.md#map-tiles)

## Reviewer demo

The checked-in configuration enables Nominatim for a controlled review with one reviewer at a
time. The service caps traffic across the app at one request per second. Keep online search to
submitted public places and addresses. [Nominatim usage policy](https://operations.osmfoundation.org/policies/nominatim/)

For an unrestricted hosted demo, set the deployed `geocoder.json` next to `index.html` to
`{"provider":"local"}`. The app then searches the bundled city and town index. The host can
update the file without rebuilding the app.

## Repository

| Path                         | Contents                                                              |
| ---------------------------- | --------------------------------------------------------------------- |
| `src/app/`                   | App shell, page layout and state shared by the features               |
| `src/features/`              | Origin search and location, pharmacy results and details, Leaflet map |
| `src/shared/`                | Localization, coordinate math, and base styles                        |
| `src/data/`, `scripts/data/` | Bundled data, importer, and iOS sync                                  |

The [data guide](docs/data/README.md) explains how to reproduce the snapshot and verify the iOS
copies. The [design spec](docs/design/design-spec.md) defines both apps' interactions and copy.

The app has three runtime dependencies: React, React DOM, and Leaflet. One `useReducer` holds the
state shared across features, so a state library would add little. The pharmacy data is bundled,
and the only remote calls are the geocoder configuration and submitted searches. Search keeps its
own session cache and allows one request per second, without retries or background refetching, to
stay within the Nominatim usage policy. A query library would need most of its defaults turned off
here.

## Checks

```sh
pnpm run style:all
pnpm run build
pnpm run test:unit
pnpm run test:ui:install
pnpm run test:ui
```

Playwright covers desktop Chromium and narrow WebKit with stubbed map tiles, geocoding, and
location. See [AGENTS.md](AGENTS.md) for test commands and configuration.

### Continuous integration

These checks run locally for this submission. A GitHub Actions workflow could run them on a Linux
runner for pushes and pull requests, using the pinned pnpm version and a frozen lockfile. The
workflow would install Chromium, WebKit, and their system dependencies with Playwright, then run
lint and unit checks and test the production build in both browsers. It could upload traces when
a browser test fails.

## Limitations

- Distances are straight lines, so water or rail can make a listed pharmacy farther away on foot.
  Ranking by walking time is the natural follow-up. Street-address search requires a network
  connection.
- Address and opening-hours availability depend on the snapshot. The weekly schedule excludes
  public holidays.
- On phones, expanding the drawer can cover pins near the bottom of the initial map view.

## Development

I chose the data and services, wrote the design spec and shared fixtures, and used Claude Code
and Codex in T3 Code to implement and test both apps. I iterated on the web interactions first
and used the reviewed screens and fixtures for the iOS implementation.

## Data licence

Pharmacy, place, boundary, and address data © OpenStreetMap contributors, under the
[Open Database License](https://www.openstreetmap.org/copyright). See the
[bundled data notice](src/data/ODbL-NOTICE.txt) and [machine-readable snapshot](src/data/).
The production app links to **Data and licence**, which offers the exact JSON used in that build.
The build also includes `third-party-licenses.txt` for the software shipped to the browser.
