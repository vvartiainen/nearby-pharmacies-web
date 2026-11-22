import type { Page } from "@playwright/test";
import borderSample from "../../docs/research/samples/tornio-haparanda-border.json" with { type: "json" };
import addressSample from "../../docs/research/geocoding/kauppakatu1.json" with { type: "json" };
import { expect, pin, row, test } from "./support/test";

test.use({ locale: "en-GB", colorScheme: "light" });

const initialOrigin = "Helsinki Central Railway Station (default)";
const tampere = { latitude: 61.4983, longitude: 23.7732 };
const searchUrl = "https://nominatim.openstreetmap.org/search?**";
const addressResults = addressSample.providers.nominatim.results.map((result) => ({
  lat: String(result.lat),
  lon: String(result.lon),
  address: {
    road: result.road,
    housenumber: result.houseNumber,
    city: result.municipality,
    country: result.country,
    country_code: result.countryCode,
  },
}));

type LocationResult = { latitude: number; longitude: number } | { code: number };
async function mockLocation(page: Page, results: readonly LocationResult[], deferred = false) {
  await page.addInitScript(
    ({ responses, waitForEvent }) => {
      let count = 0;
      navigator.geolocation.getCurrentPosition = (success, failure) => {
        const result = responses[count++];
        document.documentElement.dataset.locationRequests = String(count);
        if (!result) return;
        const respond = () => {
          if ("code" in result) failure?.({ code: result.code } as GeolocationPositionError);
          else success({ coords: { ...result, accuracy: 20 } } as GeolocationPosition);
        };
        if (waitForEvent) document.addEventListener("deliver-position", respond, { once: true });
        else queueMicrotask(respond);
      };
    },
    { responses: results, waitForEvent: deferred },
  );
}

async function ensureResultsOpen(page: Page) {
  const toggle = page.getByRole("button", { name: "Results", exact: true });
  if ((await toggle.count()) && (await toggle.getAttribute("aria-expanded")) === "false") {
    await toggle.click();
  }
}

function firstResult(page: Page) {
  return page.locator(".result-row__name").first();
}

async function submitSearch(page: Page, query: string) {
  const field = page.getByRole("combobox", { name: "City or street address" });
  await field.fill(query);
  await field.press("Enter");
}

function latch() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

async function chooseMapPoint(page: Page) {
  const map = page.getByTestId("map");
  const box = (await map.boundingBox())!;
  await map.click({
    button: "right",
    position: { x: Math.round(box.width * 0.6), y: Math.round(box.height * 0.3) },
  });
  await page.getByRole("button", { name: "Search from here" }).click();
}

test("shows Helsinki before consent and reranks for a granted Tampere location", async ({
  page,
}, testInfo) => {
  const releaseAddress = latch();
  if (testInfo.project.name === "desktop-chromium") {
    await page.route("**/address-index/122-23.json.gz", (route) =>
      route.fulfill({
        path: "public/address-index/122-23.json.gz",
        contentType: "application/gzip",
      }),
    );
  }
  await page.route("**/address-index/index.json", async (route) => {
    await releaseAddress.promise;
    await route.continue();
  });
  await mockLocation(page, [tampere]);
  await page.goto("/");
  await expect(page.getByTestId("origin")).toHaveValue(initialOrigin);
  await expect(page.getByText("Show pharmacies nearest to you?")).toBeVisible();
  await expect(page.locator("html")).not.toHaveAttribute("data-location-requests");
  await ensureResultsOpen(page);
  await expect(firstResult(page)).toHaveText("Steissin Apteekki");
  try {
    await page.getByRole("button", { name: "Use my location" }).click();
    await expect(page.getByTestId("origin")).toHaveValue("Your location");
    await expect(firstResult(page)).toHaveText("Tullintorin apteekki");
  } finally {
    releaseAddress.resolve();
  }
  await expect(page.getByTestId("origin")).toHaveValue("Near Rautatienkatu 25, Tampere");
  await expect(page.locator(".origin-search__title")).toHaveText("Near Rautatienkatu 25");
  await expect(page.locator(".origin-search__locality")).toHaveText("Tampere");
  await expect(firstResult(page)).toHaveText("Tullintorin apteekki");
  await row(page, "Tullintorin apteekki").click();
  await expect(pin(page, "Tullintorin apteekki")).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("details")).toContainText("Tullintorin apteekki");
});

for (const [code, notice] of [
  [1, "Location permission was denied"],
  [3, "Finding your location took too long"],
] as const) {
  test(`keeps Helsinki when the location response is ${code}`, async ({ page }) => {
    await mockLocation(page, [{ code }]);
    await page.goto("/");
    await page.getByRole("button", { name: "Use my location" }).click();
    await expect(page.getByRole("status")).toContainText(notice);
    await expect(page.getByTestId("origin")).toHaveValue(initialOrigin);
    await ensureResultsOpen(page);
    await expect(firstResult(page)).toHaveText("Steissin Apteekki");
  });
}

test("a submitted address lists distinct municipalities and can be chosen with the keyboard", async ({
  page,
}) => {
  const requests: URL[] = [];
  await page.route(searchUrl, async (route) => {
    requests.push(new URL(route.request().url()));
    await route.fulfill({ json: addressResults });
  });
  await page.goto("/");
  await expect(
    page.getByText("Search text is sent to OpenStreetMap’s Nominatim service."),
  ).toBeVisible();
  await page.getByRole("combobox").fill("Kauppakatu 1");
  expect(requests).toHaveLength(0);
  await page.getByRole("combobox").press("Enter");
  const choices = page.getByRole("listbox", { name: "Choose a match" });
  await expect(choices.getByRole("option")).toHaveCount(5);
  await expect(
    choices.getByRole("option", { name: "Kauppakatu 1 · Lahti, Finland" }),
  ).toBeVisible();
  const target = choices.getByRole("option", { name: "Kauppakatu 1 · Tampere, Finland" });
  const field = page.getByRole("combobox");
  await field.press("ArrowDown");
  await expect(target).toHaveAttribute("aria-selected", "true");
  await field.press("Enter");
  await expect(page.getByTestId("origin")).toHaveValue("Kauppakatu 1 · Tampere, Finland");
  const title = page.locator(".origin-search__title");
  const locality = page.locator(".origin-search__locality");
  await expect(title).toBeVisible();
  await expect(title).toHaveText("Kauppakatu 1");
  await expect(locality).toHaveText("Tampere, Finland");
  const titleBox = (await title.boundingBox())!;
  const localityBox = (await locality.boundingBox())!;
  expect(localityBox.y).toBeGreaterThanOrEqual(titleBox.y + titleBox.height);
  await expect(choices).toHaveCount(0);
  await ensureResultsOpen(page);
  await expect(firstResult(page)).toHaveText("Yliopiston Apteekki");
  expect(requests).toHaveLength(1);
  expect(Object.fromEntries(requests[0]!.searchParams)).toMatchObject({
    q: "Kauppakatu 1",
    countrycodes: "fi",
    addressdetails: "1",
    limit: "5",
    "accept-language": "en",
  });
  await field.press("k");
  await expect(field).toHaveValue("k");
  await expect(title).toBeHidden();
  await field.fill("kauppakatu 1");
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await expect(choices.getByRole("option")).toHaveCount(5);
  expect(requests).toHaveLength(1);
});

test("keeps named places distinct and anchors the picker to the search bar", async ({
  page,
}, testInfo) => {
  await page.route(searchUrl, (route) =>
    route.fulfill({
      json: [
        {
          name: "Ylioppilaskylä",
          lat: "60.461",
          lon: "22.297",
          address: {
            quarter: "Ylioppilaskylä",
            city: "Turku",
            country: "Finland",
            country_code: "fi",
          },
        },
        {
          display_name: "Ylioppilastalo, Turku, Finland",
          lat: "60.455",
          lon: "22.288",
          address: { city: "Turku", country: "Finland", country_code: "fi" },
        },
        {
          name: "Ylioppilastalo",
          lat: "62.235",
          lon: "25.738",
          address: { city: "Jyväskylä", country: "Finland", country_code: "fi" },
        },
      ],
    }),
  );
  await page.goto("/");
  await submitSearch(page, "Ylioppilas");
  const choices = page.getByRole("listbox", { name: "Choose a match" });
  await expect(choices.getByRole("option")).toHaveCount(3);
  const target = choices.getByRole("option", { name: "Ylioppilaskylä · Turku, Finland" });
  await expect(target.getByText("Ylioppilaskylä", { exact: true })).toBeVisible();
  await expect(target.getByText("Turku, Finland", { exact: true })).toBeVisible();
  const entry = (await page.locator(".origin-search__entry").boundingBox())!;
  const dropdown = (await page.locator(".origin-matches").boundingBox())!;
  expect(dropdown.x).toBeCloseTo(entry.x, 0);
  expect(dropdown.width).toBeCloseTo(entry.width, 0);
  expect(dropdown.y - entry.y - entry.height).toBeCloseTo(4, 0);

  if (testInfo.project.name === "desktop-chromium") {
    await target.hover();
    await expect(target).toHaveAttribute("aria-selected", "true");
    await expect(target).toHaveCSS("background-color", "rgb(227, 242, 236)");
  }
  await target.click();
  await expect(page.getByTestId("origin")).toHaveValue("Ylioppilaskylä · Turku, Finland");
  await expect(choices).toHaveCount(0);
});

test("offers a local Swedish-name match when the geocoder is unavailable", async ({ page }) => {
  await page.route(searchUrl, (route) => route.fulfill({ status: 503 }));
  await page.goto("/");
  await submitSearch(page, "Tammerfor");
  await expect(page.getByText("Matches from the bundled place index.")).toBeVisible();
  await page.getByRole("option", { name: "Tampere · Finland", exact: true }).click();
  await expect(page.getByTestId("origin")).toHaveValue("Tampere · Finland");
});

test("an empty address search leaves the current origin in place", async ({ page }) => {
  await page.route(searchUrl, (route) => route.fulfill({ json: [] }));
  await page.goto("/");
  await submitSearch(page, "Kuvitteellinen 123");
  await expect(page.getByRole("status")).toContainText("No places in Finland match");
  await page.getByRole("heading", { level: 1 }).click();
  await expect(page.getByTestId("origin")).toHaveValue(initialOrigin);
});

test("a map pick wins over a pending geocoder response", async ({ page }) => {
  const started = latch();
  const reply = latch();
  const finished = latch();
  await page.route(searchUrl, async (route) => {
    started.resolve();
    await reply.promise;
    try {
      await route.fulfill({ json: addressResults });
    } catch {
      // The application aborted this request when a new origin was applied.
    } finally {
      finished.resolve();
    }
  });
  await page.goto("/");
  try {
    await submitSearch(page, "Kauppakatu 1");
    await started.promise;
    await expect(page.getByRole("button", { name: "Searching…" })).toBeDisabled();
    await chooseMapPoint(page);
    await expect(page.getByTestId("origin")).toHaveValue("Dropped pin");
  } finally {
    reply.resolve();
  }
  await finished.promise;
  await expect(page.getByRole("listbox", { name: "Choose a match" })).toHaveCount(0);
  await expect(page.getByTestId("origin")).toHaveValue("Dropped pin");
  await expect(page.locator(".origin-marker")).toHaveAccessibleName("Dropped pin");
});

test("a map pick also wins over a late device fix", async ({ page }) => {
  await mockLocation(page, [tampere], true);
  await page.goto("/");
  const locate = page.getByRole("button", { name: "Use my location" });
  await locate.click();
  await expect(locate).toHaveAttribute("aria-busy", "true");
  await expect(locate.locator(".origin-location__spinner")).toBeVisible();
  await expect(page.getByRole("status")).toHaveClass("visually-hidden");
  await expect(page.getByTestId("origin")).toHaveValue(initialOrigin);
  await page.getByTestId("map").press("ArrowRight");
  await page.getByRole("button", { name: "Search from here" }).press("Enter");
  await page.evaluate(() => document.dispatchEvent(new Event("deliver-position")));
  await expect(page.getByTestId("origin")).toHaveValue("Dropped pin");
  await expect(page.getByRole("button", { name: "Use my location" })).toBeEnabled();
});

test("keeps the device location when a nearby address cannot be loaded", async ({ page }) => {
  await page.route("**/address-index/index.json", (route) => route.fulfill({ status: 503 }));
  await mockLocation(page, [tampere]);
  await page.goto("/");
  await page.getByRole("button", { name: "Use my location" }).click();
  await ensureResultsOpen(page);
  await expect(page.getByTestId("origin")).toHaveValue("Your location");
  await expect(firstResult(page)).toHaveText("Tullintorin apteekki");
});

test("a pending address lookup cannot relabel a newer starting point", async ({ page }) => {
  const started = latch();
  const releaseAddress = latch();
  const finished = latch();
  await page.route("**/address-index/index.json", async (route) => {
    started.resolve();
    await releaseAddress.promise;
    try {
      await route.continue();
    } catch {
      // The app aborted the address lookup when the origin changed.
    } finally {
      finished.resolve();
    }
  });
  await mockLocation(page, [tampere]);
  await page.goto("/");
  try {
    await page.getByRole("button", { name: "Use my location" }).click();
    await started.promise;
    await chooseMapPoint(page);
    await expect(page.getByTestId("origin")).toHaveValue("Dropped pin");
  } finally {
    releaseAddress.resolve();
  }
  await finished.promise;
  await expect(page.getByTestId("origin")).toHaveValue("Dropped pin");
});

test("shows Finnish results near and across the border and can return to Helsinki", async ({
  page,
}) => {
  const tornio = borderSample.origin;
  const haparanda = borderSample.otherOrigins[0]!;
  await mockLocation(
    page,
    [tornio, haparanda].map(({ lat, lon }) => ({ latitude: lat, longitude: lon })),
  );
  await page.goto("/");
  const location = page.getByRole("button", { name: "Use my location" });
  await location.click();
  await expect(page.getByRole("status")).toContainText(
    "Pharmacies across the border may be nearer",
  );
  await ensureResultsOpen(page);
  await expect(firstResult(page)).toHaveText("Tornion I Apteekki");
  await location.click();
  await expect(page.getByRole("status")).toContainText("This starting point is outside Finland");
  await expect(firstResult(page)).toHaveText("Tornion I Apteekki");
  await page.getByRole("button", { name: "Return to Helsinki" }).click();
  await expect(page.getByTestId("origin")).toHaveValue(initialOrigin);
  await expect(firstResult(page)).toHaveText("Steissin Apteekki");
  await expect(page.getByRole("button", { name: "Return to Helsinki" })).toHaveCount(0);
});
