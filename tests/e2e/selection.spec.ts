import type { Locator, Page, TestInfo } from "@playwright/test";
import { expect, pin, row, test, uncoveredPinName } from "./support/test";

test.use({ locale: "en-GB", colorScheme: "light" });

const isDesktop = (testInfo: TestInfo) => testInfo.project.name === "desktop-chromium";
const highestTileZoom = (urls: readonly string[]) =>
  Math.max(...urls.map((url) => Number(new URL(url).pathname.split("/")[1])));

async function leaveDetails(page: Page, testInfo: TestInfo) {
  const name = isDesktop(testInfo) ? "Close details" : "Back to results";
  await page.getByRole("button", { name }).click();
}

/** The visible shape of a pin, which is what the user sees; its 44 px focus box is larger. */
async function pinShapeBox(target: Locator) {
  const box = await target.locator(".pharmacy-pin__shape").boundingBox();
  expect(box).not.toBeNull();
  return box!;
}

async function expectSelectionInView(page: Page, target: Locator, testInfo: TestInfo) {
  const map = (await page.getByTestId("map").boundingBox())!;
  const desktop = isDesktop(testInfo);
  const overlay = desktop ? page.getByTestId("details-card") : page.locator(".results");
  const box = (await overlay.boundingBox())!;
  const left = desktop ? box.x + box.width : map.x;
  const bottom = desktop ? map.y + map.height : box.y;

  const origin = page.locator(".origin-marker");
  for (const marker of [(await origin.boundingBox())!, await pinShapeBox(target)]) {
    expect(marker.x).toBeGreaterThanOrEqual(left);
    expect(marker.y).toBeGreaterThanOrEqual(map.y);
    expect(marker.x + marker.width).toBeLessThanOrEqual(map.x + map.width);
    expect(marker.y + marker.height).toBeLessThanOrEqual(bottom);
  }

  const line = page.locator("path.selection-line");
  await expect(line).toHaveCount(1);
  await expect(line).toBeVisible();
  await expect(line).toHaveAttribute("stroke", "#243e9e");
  await expect(page.locator("path.selection-line-outline")).toHaveAttribute("stroke", "#ffffff");
  const [start, end] = await line.evaluate((element: SVGPathElement) => {
    const matrix = element.getScreenCTM()!;
    return [0, element.getTotalLength()].map((length) => {
      const point = element.getPointAtLength(length).matrixTransform(matrix);
      return { x: point.x, y: point.y };
    });
  });
  const originBox = (await origin.boundingBox())!;
  const targetBox = (await target.boundingBox())!;
  // Leaflet rounds marker and SVG positions separately.
  expect(
    Math.hypot(
      start!.x - originBox.x - originBox.width / 2,
      start!.y - originBox.y - originBox.height / 2,
    ),
  ).toBeLessThanOrEqual(2);
  expect(
    Math.hypot(end!.x - targetBox.x - targetBox.width / 2, end!.y - targetBox.y - targetBox.height),
  ).toBeLessThanOrEqual(2);
}

type Box = { x: number; y: number; width: number; height: number };
const overlaps = (a: Box, b: Box) =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

async function sheetHeight(page: Page) {
  const box = await page.locator(".results").boundingBox();
  return box!.height;
}

async function expandSheetIfNarrow(page: Page) {
  const toggle = page.getByRole("button", { name: "Results", exact: true });
  if ((await toggle.count()) > 0 && (await toggle.getAttribute("aria-expanded")) === "false") {
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
  }
}

test("ranks 20 pharmacies from the default origin in distance order", async ({ page }) => {
  await page.goto("/");
  await expandSheetIfNarrow(page);
  const names = page.locator(".result-row__name");
  await expect(names).toHaveCount(20);
  await expect(names.nth(0)).toHaveText("Steissin Apteekki");
  await expect(names.nth(1)).toHaveText("Apteekki CityCenter");
  await expect(names.nth(2)).toHaveText("Yliopiston apteekki");
  await expect(names.nth(3)).toHaveText("Kluuvin apteekki");

  const distance = (name: string) => row(page, name).locator(".result-row__distance");
  await expect(distance("Steissin Apteekki")).toHaveCSS("color", "rgb(22, 97, 68)");
  await expect(distance("Töölön apteekki")).toHaveCSS("color", "rgb(120, 83, 0)");
  await expect(distance("Brahen Apteekki")).toHaveCSS("color", "rgb(168, 43, 56)");
});

test("selecting a row zooms in, selects its pin and shows details with hours", async ({
  page,
  tiles,
}, testInfo) => {
  await page.goto("/");
  await expandSheetIfNarrow(page);
  await expect.poll(() => highestTileZoom(tiles.urls)).toBeGreaterThan(0);
  const initialZoom = highestTileZoom(tiles.urls);
  const initialTileCount = tiles.urls.length;
  await page.getByRole("button", { name: "Zoom out" }).click();
  await expect.poll(() => tiles.urls.length).toBeGreaterThan(initialTileCount);
  await expect
    .poll(() => highestTileZoom(tiles.urls.slice(initialTileCount)))
    .toBeLessThan(initialZoom);
  await expect(page.locator(".leaflet-zoom-anim")).toHaveCount(0);

  const zoomedOutTileCount = tiles.urls.length;
  await row(page, "Steissin Apteekki").click();
  const zoomedOut = highestTileZoom(tiles.urls.slice(initialTileCount, zoomedOutTileCount));
  await expect
    .poll(() => highestTileZoom(tiles.urls.slice(zoomedOutTileCount)))
    .toBeGreaterThan(zoomedOut);

  const selectedPin = pin(page, "Steissin Apteekki");
  const otherPin = pin(page, "Apteekki CityCenter");
  await expect(selectedPin).toHaveAttribute("aria-pressed", "true");
  await expect(selectedPin).toHaveClass(/is-selected/);
  await expect(page.locator(".pharmacy-pin.is-selected")).toHaveCount(1);
  await expect(otherPin.locator(".pharmacy-pin__body")).toHaveCSS("fill", "rgb(98, 107, 116)");
  await expect(selectedPin.locator(".pharmacy-pin__body")).toHaveCSS("fill", "rgb(6, 64, 47)");
  await expectSelectionInView(page, selectedPin, testInfo);

  const details = page.getByTestId("details");
  await expect(details.getByRole("heading", { level: 2 })).toHaveText("Steissin Apteekki");
  await expect(details).toContainText(/50\sm straight line/);
  await expect(details).toContainText("Elielinaukio 3");
  const hours = details.getByTestId("hours");
  await expect(hours.getByRole("heading", { name: "Opening hours" })).toBeVisible();
  await expect(hours.locator(".hours__day")).toHaveText([
    "Mon07:30–18:00",
    "Tue07:30–18:00",
    "Wed07:30–18:00",
    "Thu07:30–18:00",
    "Fri07:30–18:00",
    "Sat10:00–16:00",
    "SunClosed",
  ]);
  await expect(page.getByTestId("origin")).toHaveValue(
    "Helsinki Central Railway Station (default)",
  );

  await leaveDetails(page, testInfo);
  await expect(details).toHaveCount(0);
  await expect(row(page, "Steissin Apteekki")).toHaveAttribute("aria-pressed", "true");
  await expect(row(page, "Steissin Apteekki")).toBeFocused();
});

test("selecting a pin selects its row and shows details", async ({ page }, testInfo) => {
  await page.goto("/");
  // Pins near the station overlap at the initial zoom, so click one that is not covered.
  const name = await uncoveredPinName(page);
  await pin(page, name).click();

  await expect(pin(page, name)).toHaveAttribute("aria-pressed", "true");
  const details = page.getByTestId("details");
  await expect(details.getByRole("heading", { level: 2 })).toHaveText(name);
  await expect(details).toContainText(/straight line/);
  await expect(details.getByTestId("hours")).toBeAttached();
  await expect(pin(page, name)).toBeFocused();
  await expectSelectionInView(page, pin(page, name), testInfo);

  await leaveDetails(page, testInfo);
  const selectedRow = row(page, name);
  await expect(selectedRow).toHaveAttribute("aria-pressed", "true");
  await expect(selectedRow).toBeInViewport();
  await expect(page.locator('.result-row[aria-pressed="true"]')).toHaveCount(1);
  await expect(page.locator(".result-row__name").first()).toHaveText("Steissin Apteekki");
});

test("keyboard: Tab reaches a row with a visible focus ring and Enter selects it", async ({
  page,
}, testInfo) => {
  await page.goto("/");
  await page.getByRole("combobox", { name: "City or street address" }).focus();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: "Use my location" })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: "Not now" })).toBeFocused();
  if (!isDesktop(testInfo)) {
    const toggle = page.getByRole("button", { name: "Results", exact: true });
    await page.keyboard.press("Tab");
    await expect(toggle).toBeFocused();
    await page.keyboard.press("Enter");
  }
  const first = row(page, "Steissin Apteekki");
  await expect(first).toBeVisible();
  for (let presses = 0; presses < 5; presses += 1) {
    await page.keyboard.press("Tab");
    if (await first.evaluate((element) => element === document.activeElement)) break;
  }
  await expect(first).toBeFocused();
  const outline = await first.evaluate((element) => {
    const style = getComputedStyle(element);
    return { style: style.outlineStyle, width: style.outlineWidth };
  });
  expect(outline).toEqual({ style: "solid", width: "3px" });

  await page.keyboard.press("Enter");
  await expect(pin(page, "Steissin Apteekki")).toHaveAttribute("aria-pressed", "true");
  const heading = page.getByTestId("details").getByRole("heading", { level: 2 });
  await expect(heading).toBeFocused();

  await page
    .getByRole("button", { name: isDesktop(testInfo) ? "Close details" : "Back to results" })
    .focus();
  await page.keyboard.press("Enter");
  await expect(first).toBeFocused();
  await expect(first).toHaveAttribute("aria-pressed", "true");
});

test("keyboard: Enter on a focused pin selects it", async ({ page }) => {
  await page.goto("/");
  const target = pin(page, "Apteekki CityCenter");
  await target.focus();
  await page.keyboard.press("Enter");
  await expect(target).toHaveAttribute("aria-pressed", "true");
  const details = page.getByTestId("details");
  await expect(details.getByRole("heading", { level: 2 })).toHaveText("Apteekki CityCenter");
  await expect(details).toContainText("Address unavailable");
  await expect(details.locator(".hours__day").last()).toHaveText("SunClosed");
  await expect(target).toBeFocused();
});

test("desktop: the list stays and the details open in a card over the map", async ({
  page,
}, testInfo) => {
  test.skip(!isDesktop(testInfo), "desktop layout only");
  await page.goto("/");
  await row(page, "Steissin Apteekki").click();

  const card = page.getByRole("region", { name: "Pharmacy details" });
  await expect(card).toBeVisible();
  await expect(card.getByRole("heading", { level: 2 })).toHaveText("Steissin Apteekki");
  await expect(card.getByRole("heading", { level: 2 })).toBeFocused();
  await expect(card.getByTestId("hours").locator(".hours__day").first()).toHaveText(
    "Mon07:30–18:00",
  );
  await expect(page.getByRole("button", { name: "Back to results" })).toHaveCount(0);
  await expect(page.locator(".result-row")).toHaveCount(20);
  await expect(row(page, "Steissin Apteekki")).toBeVisible();
  await expect(row(page, "Steissin Apteekki")).toHaveAttribute("aria-pressed", "true");

  const cardBox = (await card.boundingBox())!;
  const mapBox = (await page.getByTestId("map").boundingBox())!;
  expect(cardBox.x).toBeCloseTo(mapBox.x + 16, 0);
  expect(cardBox.y).toBeCloseTo(mapBox.y + 16, 0);
  expect(cardBox.width).toBeCloseTo(320, 0);
  expect(cardBox.y + cardBox.height).toBeLessThanOrEqual(mapBox.y + mapBox.height - 16);

  const close = card.getByRole("button", { name: "Close details" });
  const closeBox = (await close.boundingBox())!;
  expect(closeBox.width).toBeGreaterThanOrEqual(44);
  expect(closeBox.height).toBeGreaterThanOrEqual(44);

  const zoomBox = (await page.locator(".leaflet-control-zoom").boundingBox())!;
  expect(overlaps(cardBox, zoomBox)).toBe(false);

  await card.evaluate((element) => element.setAttribute("data-probe", "same"));
  await row(page, "Kluuvin apteekki").click();
  await expect(card.getByRole("heading", { level: 2 })).toHaveText("Kluuvin apteekki");
  await expect(card).toHaveAttribute("data-probe", "same");
  await expect(row(page, "Kluuvin apteekki")).toHaveAttribute("aria-pressed", "true");
  await expect(row(page, "Steissin Apteekki")).toHaveAttribute("aria-pressed", "false");
  await expect(page.locator('.result-row[aria-pressed="true"]')).toHaveCount(1);

  await expectSelectionInView(page, pin(page, "Kluuvin apteekki"), testInfo);

  await close.click();
  await expect(card).toHaveCount(0);
  await expect(row(page, "Kluuvin apteekki")).toBeFocused();
  await expect(row(page, "Kluuvin apteekki")).toHaveAttribute("aria-pressed", "true");
  await expect(pin(page, "Kluuvin apteekki")).toHaveAttribute("aria-pressed", "true");

  await page.keyboard.press("Enter");
  await expect(card.getByRole("heading", { level: 2 })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(card).toHaveCount(0);
  await expect(row(page, "Kluuvin apteekki")).toBeFocused();
  await expect(row(page, "Kluuvin apteekki")).toHaveAttribute("aria-pressed", "true");
  await expect(pin(page, "Kluuvin apteekki")).toHaveAttribute("aria-pressed", "true");
});

test("desktop: the card never covers the selected pin", async ({ page }, testInfo) => {
  test.skip(!isDesktop(testInfo), "desktop layout only");
  await page.goto("/");
  await expect(page.locator(".pharmacy-pin")).toHaveCount(20);
  // The pin drawn farthest left is the one the card would cover first.
  const leftmost = await page.evaluate(() => {
    const pins = [...document.querySelectorAll<HTMLElement>(".pharmacy-pin")];
    pins.sort((a, b) => a.getBoundingClientRect().x - b.getBoundingClientRect().x);
    return pins[0]!.getAttribute("aria-label")!.split(", ")[0]!;
  });
  const mapBox = (await page.getByTestId("map").boundingBox())!;
  expect((await pinShapeBox(pin(page, leftmost))).x).toBeLessThan(mapBox.x + 16 + 320);

  await row(page, leftmost).click();
  const card = page.getByRole("region", { name: "Pharmacy details" });
  await expect(card.getByRole("heading", { level: 2 })).toHaveText(leftmost);
  await expect(page.locator(".leaflet-pan-anim")).toHaveCount(0);
  const cardBox = (await card.boundingBox())!;
  await expect
    .poll(async () => overlaps(cardBox, await pinShapeBox(pin(page, leftmost))))
    .toBe(false);
  await expect(pin(page, leftmost)).toBeInViewport();
});

test("narrow layout: collapsing hides results and selecting a map pin expands the drawer", async ({
  page,
}, testInfo) => {
  test.skip(isDesktop(testInfo), "narrow layout only");
  await page.goto("/");
  const resultsToggle = page.getByRole("button", { name: "Results", exact: true });
  const detailsToggle = page.getByRole("button", { name: "Pharmacy details", exact: true });
  const back = page.getByRole("button", { name: "Back to results" });
  const rows = page.locator(".result-row");
  await expect(resultsToggle).toHaveAttribute("aria-expanded", "false");
  await expect(rows).toHaveCount(0);
  const collapsedHeight = await sheetHeight(page);

  await resultsToggle.click();
  await expect(resultsToggle).toHaveAttribute("aria-expanded", "true");
  await expect(rows).toHaveCount(20);
  const mapBox = (await page.locator(".map-area").boundingBox())!;
  expect(Math.abs((await sheetHeight(page)) - mapBox.height * 0.55)).toBeLessThanOrEqual(2);

  await resultsToggle.click();
  await expect(rows).toHaveCount(0);
  expect(await sheetHeight(page)).toBeCloseTo(collapsedHeight, 0);

  const name = await uncoveredPinName(page);
  await pin(page, name).click();
  await expect(detailsToggle).toHaveAttribute("aria-expanded", "true");
  await expect(page.getByTestId("details")).toBeVisible();

  await detailsToggle.click();
  await expect(detailsToggle).toHaveAttribute("aria-expanded", "false");
  await expect(detailsToggle).toHaveText("Pharmacy details");
  await expect(back).toHaveCount(0);
  await expect(page.getByTestId("details")).toHaveCount(0);

  await detailsToggle.click();
  await expect(detailsToggle).toHaveAttribute("aria-expanded", "true");
  await expect(page.getByTestId("details").getByRole("heading", { level: 2 })).toHaveText(name);
  await back.click();
  await expect(resultsToggle).toHaveAttribute("aria-expanded", "true");
  await expect(rows).toHaveCount(20);
  await expect(page.locator('.result-row[aria-pressed="true"]')).toBeFocused();
});

test("narrow layout: Back to results stays pinned when scrolling details", async ({
  page,
}, testInfo) => {
  test.skip(isDesktop(testInfo), "narrow layout only");
  await page.setViewportSize({ width: 360, height: 510 });
  await page.goto("/");
  await expandSheetIfNarrow(page);
  await row(page, "Steissin Apteekki").click();

  const details = page.getByTestId("details");
  const back = page.getByRole("button", { name: "Back to results" });
  const detailsBox = (await details.boundingBox())!;
  expect(detailsBox.x).toBeGreaterThan(40);
  expect(detailsBox.x).toBeCloseTo(360 - detailsBox.x - detailsBox.width, 0);
  const hoursBox = (await details.getByTestId("hours").boundingBox())!;
  const summaryBox = (await details.locator(".details__summary").boundingBox())!;
  expect(hoursBox.x).toBeCloseTo(summaryBox.x, 0);
  expect(hoursBox.width).toBeCloseTo(detailsBox.width, 0);
  expect(hoursBox.y - summaryBox.y - summaryBox.height).toBeCloseTo(16, 0);
  await expect(details.getByTestId("hours")).toHaveCSS("border-top-width", "0px");
  await expect(details).toHaveCSS("text-align", "start");

  const content = page.locator(".results__content");
  const contentBox = (await content.boundingBox())!;
  expect(detailsBox.y - contentBox.y).toBeCloseTo(8, 0);

  const before = await back.boundingBox();
  await content.evaluate((element) => {
    element.scrollTop = element.scrollHeight;
  });
  expect(await content.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
  expect(await back.boundingBox()).toEqual(before);

  await back.click();
  await expect(row(page, "Steissin Apteekki")).toBeFocused();
});

test("narrow layout: a wider drawer centers the pharmacy details and schedule together", async ({
  page,
}, testInfo) => {
  test.skip(isDesktop(testInfo), "narrow layout only");
  await page.setViewportSize({ width: 850, height: 800 });
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/");
  await expandSheetIfNarrow(page);
  const first = row(page, "Steissin Apteekki");
  const rowBox = (await first.boundingBox())!;
  const distance = first.locator(".result-row__distance");
  await expect(distance).toHaveText(/^50\sm$/);
  const distanceBox = (await distance.boundingBox())!;
  expect(distanceBox.x).toBeGreaterThan(rowBox.x + rowBox.width / 2);
  await first.click();

  const details = page.getByTestId("details");
  const heading = (await details.getByRole("heading", { level: 2 }).boundingBox())!;
  const detailsBox = (await details.boundingBox())!;
  const back = page.getByRole("button", { name: "Back to results" });
  const toggle = page.getByRole("button", { name: "Pharmacy details", exact: true });
  const backBox = (await back.boundingBox())!;
  const toggleBox = (await toggle.boundingBox())!;
  expect(backBox.x).toBeLessThan(30);
  expect(850 - toggleBox.x - toggleBox.width).toBeLessThan(30);
  expect(backBox.x + backBox.width).toBeLessThan(detailsBox.x);
  expect(toggleBox.x).toBeGreaterThan(detailsBox.x + detailsBox.width);
  expect(detailsBox.width).toBeLessThanOrEqual(448);
  expect(detailsBox.x).toBeGreaterThan(150);
  expect(detailsBox.x).toBeCloseTo(850 - detailsBox.x - detailsBox.width, 0);
  const contentBox = (await page.locator(".results__content").boundingBox())!;
  const spaceAbove = detailsBox.y - contentBox.y;
  const spaceBelow = contentBox.y + contentBox.height - detailsBox.y - detailsBox.height;
  expect(spaceAbove).toBeGreaterThan(16);
  expect(spaceAbove).toBeCloseTo(spaceBelow, 1);
  const hours = details.getByTestId("hours");
  const hoursHeading = hours.getByRole("heading", { name: "Opening hours" });
  const hoursBox = (await hoursHeading.boundingBox())!;
  const address = (await details.locator("address").boundingBox())!;
  expect(hoursBox.x).toBeGreaterThanOrEqual(address.x + address.width);
  expect(hoursBox.x + hoursBox.width).toBeCloseTo(detailsBox.x + detailsBox.width, 0);
  expect(hoursBox.y).toBeCloseTo(heading.y, 0);
  await expect(hours.locator(".hours__day").first()).toHaveText("Mon07:30–18:00");
  await expect(hours.locator(".hours__day").last()).toHaveText("SunClosed");
});

test("fits 320 px without horizontal scrolling", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await page.goto("/");
  await expandSheetIfNarrow(page);
  await expect(page.locator(".result-row")).toHaveCount(20);
  const first = (await page.locator(".result-row").nth(0).boundingBox())!;
  const second = (await page.locator(".result-row").nth(1).boundingBox())!;
  expect(first.x).toBe(10);
  expect(first.height).toBe(44);
  expect(second.y - first.y - first.height).toBe(4);
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBe(0);
});

test("desktop: selection zooms out to fit a distant pharmacy and the origin", async ({
  page,
  tiles,
}, testInfo) => {
  test.skip(!isDesktop(testInfo), "desktop layout only");
  await page.goto("/");
  // Zoom in until the 20th pin leaves the viewport.
  const tileZoom = () => highestTileZoom(tiles.urls);
  await expect.poll(tileZoom).toBeGreaterThan(0);
  while (tileZoom() < 18) {
    const zoom = tileZoom();
    await page.getByRole("button", { name: "Zoom in" }).click();
    await expect.poll(tileZoom).toBe(zoom + 1);
    await expect(page.locator(".leaflet-zoom-anim")).toHaveCount(0);
  }
  const zoomedInTileCount = tiles.urls.length;
  const farthest = page.locator(".result-row").last();
  const name = (await farthest.locator(".result-row__name").textContent())!;
  const target = pin(page, name);
  await expect(target).not.toBeInViewport();
  await farthest.click();
  await expectSelectionInView(page, target, testInfo);
  await expect.poll(() => tiles.urls.length).toBeGreaterThan(zoomedInTileCount);
  expect(highestTileZoom(tiles.urls.slice(zoomedInTileCount))).toBeLessThan(18);
});
