import { test as base, expect, type Page } from "@playwright/test";

/** A 1 × 1 grey PNG served for every map tile, so tests never contact a tile server. */
const tilePng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAAAAAA6fptVAAAACklEQVR4nGO4CwAA3wDeKXlwtgAAAABJRU5ErkJggg==",
  "base64",
);

export interface TileLog {
  readonly urls: string[];
}

/**
 * Playwright `test` with the network sealed off: requests to the OSM tile server get the local
 * PNG, and any other request that does not go to the local preview server is aborted.
 */
export const test = base.extend<{ tiles: TileLog }>({
  tiles: [
    async ({ context, baseURL }, use) => {
      const log: TileLog = { urls: [] };
      const local = new URL(baseURL!).origin;
      await context.route(
        (url) => url.origin !== local,
        async (route) => {
          const url = new URL(route.request().url());
          if (url.hostname === "tile.openstreetmap.org") {
            log.urls.push(url.href);
            await route.fulfill({ status: 200, contentType: "image/png", body: tilePng });
          } else {
            await route.abort("blockedbyclient");
          }
        },
      );
      await use(log);
    },
    { auto: true },
  ],
});

export { expect };

export function row(page: Page, name: string) {
  return page
    .getByRole("button", { name: new RegExp(`^${name}, `) })
    .and(page.locator(".result-row"));
}

export function pin(page: Page, name: string) {
  return page
    .getByRole("button", { name: new RegExp(`^${name}, `) })
    .and(page.locator(".pharmacy-pin"));
}

/**
 * The pharmacy name of the first pin in ranking order, after the nearest `skip`, whose visible centre is not
 * covered by another marker, so a pointer click reaches it at the initial zoom.
 */
export async function uncoveredPinName(page: Page, skip = 1): Promise<string> {
  await expect(page.locator(".pharmacy-pin")).toHaveCount(20);
  const name = await page.evaluate((skipCount) => {
    const pins = [...document.querySelectorAll<HTMLElement>(".pharmacy-pin")];
    for (const element of pins.slice(skipCount)) {
      const body = element.querySelector(".pharmacy-pin__body")!.getBoundingClientRect();
      const hit = document.elementFromPoint(body.x + body.width / 2, body.y + body.height / 3);
      if (hit && element.contains(hit)) return element.getAttribute("aria-label");
    }
    return null;
  }, skip);
  expect(name).not.toBeNull();
  return name!.split(", ")[0]!;
}
