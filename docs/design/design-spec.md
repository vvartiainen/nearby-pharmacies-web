# Design spec

Status: draft for review, 22 November 2026. The same file lives in `nearby-pharmacies-web` and
`nearby-pharmacies-ios`. Change both copies together.

This spec replaces static mock-ups. Both apps follow it directly. The first web screens built in
task 6 are reviewed against it, and the approved web screenshots become the visual reference for iOS
and for the final review. Product decisions are in the planning `PLAN.md`,
ADR 0001 (`docs/adr/0001-finland-coverage-and-straight-line-ranking.md`) and
ADR 0002 (`docs/adr/0002-geocoder-and-web-tiles.md`) in the web repo. Sample content is in the web
repo's `docs/research/samples/`.

The Figma file "Nearby Pharmacies" (`D81X51CsEpVwY4DGKegGKd`, Components page) holds the result
row, pin, origin marker, origin search, hours block and results sheet as a reference. Where Figma
and this file differ, this file wins.

## Principles

- Show useful results immediately. The labelled default origin works without permission, search or
  network.
- One selected pharmacy drives the pin, the row and the details. Selection never moves the origin.
- Results change only when the origin changes. Panning explores. It never reranks.
- Selection must survive grayscale: shape, size and border change, not colour alone.
- Long pharmacy names wrap. Never truncate a name.
- Use the platform: semantic HTML and keyboard on web, native sheet, Dynamic Type and VoiceOver on
  iOS.

## Tokens

Web names are CSS custom properties on `:root`. iOS names are SwiftUI `Color` assets or constants
with Any and Dark appearances. Dark values marked † are proposals not yet in Figma, which holds
dark colours as separate `color/dark/…` variables because its free plan allows one mode.

### Colour

| Role                    | Web                              | iOS                    | Light     | Dark      |
| ----------------------- | -------------------------------- | ---------------------- | --------- | --------- |
| Page background         | `--color-page-background`        | `pageBackground`       | `#F2F4F6` | `#0D141B` |
| Surface (rows, sheet)   | `--color-surface-default`        | `surfaceDefault`       | `#FFFFFF` | `#17212B` |
| Border                  | `--color-border-subtle`          | `borderSubtle`         | `#DCE1E6` | `#2E3C49` |
| Border, strong (inputs) | `--color-border-strong`          | `borderStrong`         | `#8895A1` | `#6B7A88` |
| Text, primary           | `--color-text-primary`           | `textPrimary`          | `#14202B` | `#EEF2F5` |
| Text, secondary         | `--color-text-secondary`         | `textSecondary`        | `#51606E` | `#A9B6C2` |
| Accent (marker, pin)    | `--color-accent-default`         | `accentDefault`        | `#0B7A5A` | `#3FBF8F` |
| Interactive, primary    | `--color-interactive-primary`    | `interactivePrimary`   | `#0B7A5A` | `#3FBF8F` |
| On primary              | `--color-interactive-on-primary` | `interactiveOnPrimary` | `#FFFFFF` | `#0D141B` |
| Pin, selected           | `--color-pin-selected`           | `pinSelected`          | `#06402F` | `#8FE3C1` |
| Pin outline             | `--color-pin-outline`            | `pinOutline`           | `#FFFFFF` | `#0D141B` |
| Origin marker           | `--color-origin-marker`          | `originMarker`         | `#1D5FBF` | `#5B9BFF` |
| Selection surface       | `--color-selection-surface`      | `selectionSurface`     | `#E3F2EC` | `#163A2F` |
| Selection border        | `--color-selection-border`       | `selectionBorder`      | `#06402F` | `#8FE3C1` |
| Focus ring              | `--color-focus-ring`             | `focusRing`            | `#1D5FBF` | `#7FB0FF` |
| Notice surface          | `--color-notice-surface`         | `noticeSurface`        | `#FFF4D6` | `#3A2E10` |
| Notice border           | `--color-notice-border`          | `noticeBorder`         | `#E2C06E` | `#7A6230` |
| Notice text             | `--color-notice-text`            | `noticeText`           | `#5C3D00` | `#F5D48A` |

Dark values for page background, border strong, on primary, pin selected and outline, origin marker,
focus ring and notice are †. Measured contrast: secondary text 6.5:1 light and 7.9:1 dark on
surface, 5.6:1 and 6.0:1 on the selection surface; on-primary text 5.3:1 light and 8.0:1 dark;
notice text over 9:1; focus ring over 6:1; strong border over 3:1. The map colours in Figma are for
the placeholder only. The apps use real tiles on web and MapKit on iOS.

### Type

Use the system font: `system-ui` on web, San Francisco on iOS. Figma uses Inter as a stand-in. On
iOS, use the Dynamic Type style in the table so text scales; web sizes are in `rem` so browser zoom
and text size settings apply.

| Role         | Use                                 | Web (size / line height, weight) | iOS text style                 |
| ------------ | ----------------------------------- | -------------------------------- | ------------------------------ |
| Title        | App or sheet title, details name    | 1.25rem / 1.75rem, 600           | `.title3.weight(.semibold)`    |
| Row name     | Pharmacy name in a row              | 1rem / 1.375rem, 600             | `.headline`                    |
| Body         | Address, notices, hours             | 1rem / 1.5rem, 400               | `.body`                        |
| Body strong  | Day names in hours, emphasised text | 1rem / 1.5rem, 600               | `.body.weight(.semibold)`      |
| Label        | Field labels, buttons               | 0.875rem / 1.25rem, 500          | `.subheadline.weight(.medium)` |
| Row distance | Distance in a row                   | 0.875rem / 1.25rem, 400          | `.subheadline`                 |
| Caption      | Origin caption, attribution, counts | 0.8125rem / 1.125rem, 400        | `.footnote`                    |

### Spacing and radius

| Token       | Web             | iOS          | Value |
| ----------- | --------------- | ------------ | ----- |
| spacing/xs  | `--spacing-xs`  | `spacingXS`  | 4     |
| spacing/sm  | `--spacing-sm`  | `spacingSM`  | 8     |
| spacing/md  | `--spacing-md`  | `spacingMD`  | 12    |
| spacing/lg  | `--spacing-lg`  | `spacingLG`  | 16    |
| spacing/xl  | `--spacing-xl`  | `spacingXL`  | 24    |
| radius/sm   | `--radius-sm`   | `radiusSM`   | 6     |
| radius/md   | `--radius-md`   | `radiusMD`   | 12    |
| radius/lg   | `--radius-lg`   | `radiusLG`   | 16    |
| radius/full | `--radius-full` | `radiusFull` | 999   |

Values are CSS pixels on web and points on iOS. Minimum hit target: 44 × 44.

## Components

### Origin search

- A field labelled "City or street address", a Search button and a "Use my location" button.
- Above or below the field, the active origin: a caption "Starting point" and its label, for example
  "Helsinki Central Railway Station (default)", "Your location", "Dropped pin" or the chosen match.
- Submitting runs one geocoder request. There is no autocomplete. While it runs, the button shows a
  busy state and the field stays editable.
- Matches appear as a list under the field. Each shows street and number, then municipality and
  country, for example "Kauppakatu 1 · Lahti, Finland". Build labels from address fields, never
  from the feature name. Choosing a match sets the origin and closes the list.
- A short note near the field says that search text is sent to OpenStreetMap's Nominatim service.

### Pharmacy pin and origin marker

- Pin: teardrop with a white cross, accent fill. Selected: about 1.5 times larger, darker fill,
  extra outline, drawn above other pins. Each pin is a button labelled with the pharmacy name and
  distance.
- Origin marker: a blue dot with a halo, never a teardrop, so it cannot be mistaken for a pharmacy.
  It always has a visible label nearby or in the origin search.

### Pharmacy result row

- Marker column 18 wide, then the name (row name style, wraps) and the distance (row distance
  style). Padding 12 vertical and 16 horizontal, gap 12, radius 12, subtle border.
- Selected: ring-and-dot marker, 2 px selection border, selection surface fill. Text does not move.
- The whole row is one button. Its accessible name is "{name}, {distance}", and it exposes the
  selected state (`aria-pressed` or `aria-current` on web, `.isSelected` trait on iOS).
- Unnamed features use "Unnamed pharmacy".

### Hours block

- Heading "Opening hours", then one line per day, Monday first, with the day in body strong and the
  time ranges in body. Closed days say "Closed".
- When `opening_hours` is missing: a notice box "Hours unavailable". When present but not
  interpretable by the app: show the raw text under the heading.
- No "open now" badge in this release.

### Results sheet and list

- Header: title "Nearest pharmacies", the origin label, and the scope "Mapped pharmacies in Finland"
  with the result count.
- Rows in distance order. Selecting a row shows its details: name, distance, address (or "Address
  unavailable") and the hours block, with a back control to the list on narrow layouts.
- Notices (location, search, border, outside Finland) appear at the top of the list, above the rows.

## Layouts

| Layout      | Width         | Structure                                                                                                                                                                |
| ----------- | ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Desktop web | 900 px and up | Left panel 400 wide: origin search, notices, list or details. Map fills the rest. Attribution bottom right.                                                              |
| Narrow web  | below 900 px  | Origin search on top, map below, results sheet over the map with peek (header plus first row) and expanded states. Smallest checked width 320.                           |
| iPhone      | all sizes     | Full-screen MapKit map. Sheet with detents: small (header plus nearest row), medium, large. Search field at the top of the sheet. Smallest checked: iPhone SE 375 × 667. |

- The first launch shows the default origin and its results before any prompt.
- On narrow web and iPhone, selecting a pin raises the sheet to show the row or details.
- At the largest text sizes (iOS accessibility sizes, 200 % browser text) a long name such as
  "Vaara-Karjalan apteekki (Heinävaaran palvelupiste)" wraps over several lines, the distance stays
  below it, and the iPhone sheet opens at the medium detent so at least one full row is visible.

## States and interactions

| Event                                                           | Origin                                                          | Results                       | Selection     | Map                                                      | Message                                                                      |
| --------------------------------------------------------------- | --------------------------------------------------------------- | ----------------------------- | ------------- | -------------------------------------------------------- | ---------------------------------------------------------------------------- |
| First launch                                                    | Default: Helsinki Central Railway Station                       | Ranked from default           | None          | Fits origin and nearest results                          | Location prompt after the results show                                       |
| Location granted, default origin still active                   | Your location                                                   | Reranked                      | Cleared       | Recentres on the fix                                     | None                                                                         |
| Location granted after the user chose an origin                 | Unchanged                                                       | Unchanged                     | Unchanged     | Unchanged                                                | None. "Use my location" can apply it later                                   |
| Location denied or timed out                                    | Unchanged                                                       | Unchanged                     | Unchanged     | Unchanged                                                | "Location unavailable…" notice with search and map hints                     |
| Search submitted                                                | Unchanged until a match is chosen                               | Unchanged                     | Unchanged     | Unchanged                                                | Busy state on the button                                                     |
| Match chosen                                                    | The match, with its label                                       | Reranked                      | Cleared       | Fits origin and nearest results                          | None                                                                         |
| No matches                                                      | Unchanged                                                       | Unchanged                     | Unchanged     | Unchanged                                                | "No places in Finland match…" under the field                                |
| Geocoder failed or rate-limited                                 | Unchanged; a city query may still match the bundled place index | Unchanged                     | Unchanged     | Unchanged                                                | "Address search is unavailable…"                                             |
| Pin dropped (long press, or right click and "Search from here") | Dropped pin                                                     | Reranked                      | Cleared       | Keeps the viewport                                       | None                                                                         |
| Late geocoder response after a pin drop                         | Stays on the dropped pin                                        | Unchanged                     | Unchanged     | Unchanged                                                | Response ignored                                                             |
| Map panned or zoomed                                            | Unchanged                                                       | Unchanged                     | Unchanged     | Moves                                                    | "Search from here" button appears; pressing it drops a pin at the map centre |
| Row selected                                                    | Unchanged                                                       | Unchanged                     | That pharmacy | Pans only if its pin is off screen; pin becomes selected | Details shown                                                                |
| Pin selected                                                    | Unchanged                                                       | Unchanged                     | That pharmacy | Unchanged                                                | Row selected and scrolled into view; details shown                           |
| Origin outside Finland                                          | The chosen origin stays                                         | Nearest pharmacies in Finland | Cleared       | Fits origin and nearest results                          | "This starting point is outside Finland…" with "Return to Helsinki"          |
| Origin within about 5 km of a land border                       | As chosen                                                       | As ranked                     | As before     | As before                                                | "Pharmacies across the border…" notice                                       |
| Tiles fail to load                                              | Unchanged                                                       | Unchanged                     | Unchanged     | Blank map, pins still drawn on web                       | List and search keep working                                                 |

## Interface text

Finnish and English for the core journey. Pharmacy names and addresses come from the data and are
never translated. Strings with `{…}` take values.

| Key                     | English                                                                                          | Finnish                                                                                                |
| ----------------------- | ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------ |
| App title               | Nearby pharmacies                                                                                | Lähiapteekit                                                                                           |
| Search label            | City or street address                                                                           | Kaupunki tai katuosoite                                                                                |
| Search button           | Search                                                                                           | Hae                                                                                                    |
| Use my location         | Use my location                                                                                  | Käytä sijaintiani                                                                                      |
| Origin caption          | Starting point                                                                                   | Lähtöpiste                                                                                             |
| Default origin          | Helsinki Central Railway Station (default)                                                       | Helsingin päärautatieasema (oletus)                                                                    |
| Your location           | Your location                                                                                    | Oma sijainti                                                                                           |
| Dropped pin             | Dropped pin                                                                                      | Kartalta valittu kohta                                                                                 |
| Search from here        | Search from here                                                                                 | Hae tästä kohdasta                                                                                     |
| Search privacy note     | Search text is sent to OpenStreetMap's Nominatim service.                                        | Hakuteksti lähetetään OpenStreetMapin Nominatim-palveluun.                                             |
| Matches heading         | Choose a match                                                                                   | Valitse osuma                                                                                          |
| No matches              | No places in Finland match "{query}". Check the spelling or choose a point on the map.           | Hakusanalla ”{query}” ei löytynyt paikkoja Suomesta. Tarkista kirjoitusasu tai valitse kohta kartalta. |
| Search unavailable      | Address search is unavailable right now. City search and choosing a point on the map still work. | Osoitehaku ei ole juuri nyt käytettävissä. Kaupunkihaku ja kartalta valinta toimivat.                  |
| Location prompt title   | Show pharmacies nearest to you?                                                                  | Näytetäänkö sinua lähimmät apteekit?                                                                   |
| Location prompt body    | Your location is used only on this device to calculate distances.                                | Sijaintiasi käytetään vain tällä laitteella etäisyyksien laskemiseen.                                  |
| Location prompt accept  | Use location                                                                                     | Käytä sijaintia                                                                                        |
| Location prompt dismiss | Not now                                                                                          | Ei nyt                                                                                                 |
| Location unavailable    | Location unavailable. Search for a city or address, or choose a point on the map.                | Sijainti ei ole käytettävissä. Hae kaupunkia tai osoitetta tai valitse kohta kartalta.                 |
| Results title           | Nearest pharmacies                                                                               | Lähimmät apteekit                                                                                      |
| Scope and count         | Mapped pharmacies in Finland · {count}                                                           | Kartoitetut apteekit Suomessa · {count}                                                                |
| Distance                | {distance} straight line                                                                         | {distance} linnuntietä                                                                                 |
| Address unavailable     | Address unavailable                                                                              | Osoite ei saatavilla                                                                                   |
| Unnamed pharmacy        | Unnamed pharmacy                                                                                 | Nimetön apteekki                                                                                       |
| Hours heading           | Opening hours                                                                                    | Aukioloajat                                                                                            |
| Hours unavailable       | Hours unavailable                                                                                | Aukioloajat eivät saatavilla                                                                           |
| Closed                  | Closed                                                                                           | Suljettu                                                                                               |
| Days                    | Mon Tue Wed Thu Fri Sat Sun                                                                      | ma ti ke to pe la su                                                                                   |
| Back to list            | Back to results                                                                                  | Takaisin tuloksiin                                                                                     |
| Outside Finland         | This starting point is outside Finland. Only pharmacies in Finland are shown.                    | Lähtöpiste on Suomen ulkopuolella. Näytetään vain Suomen apteekit.                                     |
| Return to Helsinki      | Return to Helsinki                                                                               | Palaa Helsinkiin                                                                                       |
| Border notice           | Pharmacies across the border may be nearer but are not shown.                                    | Rajan takana voi olla lähempiä apteekkeja, joita ei näytetä.                                           |
| Map attribution         | © OpenStreetMap contributors                                                                     | © OpenStreetMap contributors                                                                           |

## Distance format

Proposal, finalized with the ranking fixture in task 5. Format with the active locale's number
formatting.

| Unrounded distance  | Shown as       | Example                                      |
| ------------------- | -------------- | -------------------------------------------- |
| Under 1 km          | Nearest 10 m   | "50 m linnuntietä", "300 m straight line"    |
| 1 km to under 10 km | Nearest 0.1 km | "1,7 km linnuntietä", "1.7 km straight line" |
| 10 km and over      | Nearest 1 km   | "141 km linnuntietä"                         |

Yliopiston apteekki (295.96 m) and Kluuvin apteekki (296.05 m) from the default origin both show
"300 m". Their order still comes from the unrounded distance.

## Sample content for reviews and tests

From `docs/research/samples/helsinki-central.json` in the web repo, origin Helsinki Central Railway
Station. The unnamed duplicate next to Apteekki CityCenter is dropped by the importer.

| Rank | Name                | Distance | Address           | Hours                                     |
| ---- | ------------------- | -------- | ----------------- | ----------------------------------------- |
| 1    | Steissin Apteekki   | 50 m     | Elielinaukio 3    | Mo-Fr 07:30-18:00; Sa 10:00-16:00; Su off |
| 2    | Apteekki CityCenter | 230 m    | none              | Mo-Fr 08:00-19:00; Sa 10:00-17:00; Su off |
| 3    | Yliopiston apteekki | 300 m    | Mannerheimintie 5 | 08:00-24:00                               |
| 4    | Kluuvin apteekki    | 300 m    | Keskuskatu 7      | Mo-Fr 08:00-20:00; Sa 11:00-17:00         |

Edge cases: "Vaara-Karjalan apteekki (Heinävaaran palvelupiste)" for long-name wrapping and missing
hours, Kuusankosken Ykkösapteekki for missing hours, Utsjoki for a 141 km nearest result, and
Haparanda station for the outside-Finland and border notices.

## Review checklist

- Finnish and English at 320 px web, iPhone SE and desktop: origin search, location prompt, a
  result row, details with hours and with "Hours unavailable", no matches.
- Long name at 200 % browser text and the largest iOS accessibility size.
- Selected pin and row are distinguishable in grayscale.
- Keyboard on web: search, choose a match, move through rows, open and close details, with a
  visible focus ring.
- VoiceOver on iOS: sheet order is origin, notices, results; rows read name, distance and selection.
