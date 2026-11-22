import { expect, row, test } from "./support/test";

test.describe("English fallback for an unsupported browser language", () => {
  test.use({ locale: "sv-SE" });

  test("shows the default origin and its nearest pharmacy in English", async ({
    page,
    tiles,
  }, testInfo) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Nearby pharmacies");
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(page).toHaveTitle("Nearby pharmacies");

    const origin = page.getByTestId("origin");
    await expect(origin).toContainText("Starting point");
    await expect(origin).toContainText("Helsinki Central Railway Station (default)");
    if (testInfo.project.name === "desktop-chromium") {
      await expect(page.getByRole("heading", { name: "Nearest pharmacies" })).toBeVisible();
      await expect(page.getByText(/^Mapped pharmacies in Finland · 784$/)).toBeVisible();
    } else {
      await page.getByRole("button", { name: "Results", exact: true }).click();
      await expect(page.getByRole("heading", { name: "Nearest pharmacies" })).toHaveCount(0);
      await expect(page.getByText(/^Mapped pharmacies in Finland · 784$/)).toHaveCount(0);
    }

    const first = page.locator(".result-row").first();
    await expect(first).toHaveAccessibleName(/^Steissin Apteekki, 50\sm$/);
    await expect(first).toHaveAttribute("aria-pressed", "false");
    await expect(first).toContainText(/50\sm/);

    const attribution = page.getByRole("link", { name: "© OpenStreetMap contributors" });
    await expect(attribution).toBeVisible();
    await expect(attribution).toHaveAttribute("href", "https://www.openstreetmap.org/copyright");
    await expect(page.getByRole("region", { name: "Map of pharmacies" })).toBeVisible();
    await expect(page.locator(".pharmacy-pin")).toHaveCount(20);
    await expect(page.locator(".origin-marker")).toHaveCount(1);
    // No details until something is selected.
    await expect(page.getByTestId("details")).toHaveCount(0);
    expect(tiles.urls.length).toBeGreaterThan(0);
  });
});

test.describe("Finnish for a Finnish browser", () => {
  test.use({ locale: "fi-FI" });

  test("shows the default origin and its nearest pharmacy in Finnish", async ({
    page,
  }, testInfo) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Lähiapteekit");
    await expect(page.locator("html")).toHaveAttribute("lang", "fi");
    await expect(page).toHaveTitle("Lähiapteekit");

    const origin = page.getByTestId("origin");
    await expect(origin).toContainText("Lähtöpiste");
    await expect(origin).toContainText("Helsingin päärautatieasema (oletus)");
    if (testInfo.project.name === "desktop-chromium") {
      await expect(page.getByRole("heading", { name: "Lähimmät apteekit" })).toBeVisible();
      await expect(page.getByText(/^Kartoitetut apteekit Suomessa · 784$/)).toBeVisible();
    } else {
      await page.getByRole("button", { name: "Tulokset", exact: true }).click();
    }
    await expect(row(page, "Steissin Apteekki")).toHaveAccessibleName(/^Steissin Apteekki, 50\sm$/);
    await expect(page.getByRole("region", { name: "Apteekkikartta" })).toBeVisible();

    // Finnish times use a period and no leading zero.
    await row(page, "Steissin Apteekki").click();
    await expect(page.getByTestId("hours").locator(".hours__day")).toHaveText([
      "ma7.30–18.00",
      "ti7.30–18.00",
      "ke7.30–18.00",
      "to7.30–18.00",
      "pe7.30–18.00",
      "la10.00–16.00",
      "suSuljettu",
    ]);

    if (testInfo.project.name === "desktop-chromium") {
      const card = page.getByRole("region", { name: "Apteekin tiedot" });
      await expect(card.getByRole("heading", { level: 2 })).toHaveText("Steissin Apteekki");
      await card.getByRole("button", { name: "Sulje tiedot" }).click();
      await expect(card).toHaveCount(0);
    } else {
      await page.getByRole("button", { name: "Takaisin tuloksiin" }).click();
    }
    await expect(row(page, "Steissin Apteekki")).toBeFocused();
    await expect(row(page, "Steissin Apteekki")).toHaveAttribute("aria-pressed", "true");
  });
});
