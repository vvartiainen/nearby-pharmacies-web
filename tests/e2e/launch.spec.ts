import { expect, row, test } from "./support/test";

test.describe("English fallback for an unsupported browser language", () => {
  test.use({ locale: "sv-SE" });

  test("shows the default origin and its nearest pharmacy in English", async ({
    page,
    tiles,
  }, testInfo) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Pharmacy finder");
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(page).toHaveTitle("Pharmacy finder");

    const origin = page.getByTestId("origin");
    await expect(origin).toHaveValue("Helsinki Central Railway Station (default)");
    await expect(page.getByText("784 mapped pharmacies in Finland", { exact: true })).toBeVisible();
    const locationButton = page
      .locator(".origin-search__field")
      .getByRole("button", { name: "Use my location" });
    await expect(locationButton).toBeVisible();
    await expect(locationButton).toHaveText("");
    if (testInfo.project.name === "desktop-chromium") {
      await expect(page.getByRole("heading", { name: "Nearest pharmacies" })).toBeVisible();
    } else {
      const toggle = page.getByRole("button", { name: /^Nearest: Steissin Apteekki · 50\sm$/ });
      await expect(toggle).toBeVisible();
      await expect(toggle).toHaveText(/^Nearest: Steissin Apteekki · 50\sm$/);
      await expect(toggle).toHaveAttribute("aria-expanded", "false");
      await expect(toggle).toHaveAttribute("aria-controls", "results-content");
      await expect(page.locator("#results-content")).toBeHidden();
      await toggle.click();
      await expect(page.getByRole("button", { name: "Results", exact: true })).toHaveAttribute(
        "aria-expanded",
        "true",
      );
      await expect(page.getByRole("heading", { name: "Nearest pharmacies" })).toHaveCount(0);
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
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Apteekkihaku");
    await expect(page.locator("html")).toHaveAttribute("lang", "fi");
    await expect(page).toHaveTitle("Apteekkihaku");

    const origin = page.getByTestId("origin");
    await expect(origin).toHaveValue("Helsingin päärautatieasema (oletus)");
    await expect(
      page.getByText("784 kartoitettua apteekkia Suomessa", { exact: true }),
    ).toBeVisible();
    if (testInfo.project.name === "desktop-chromium") {
      await expect(page.getByRole("heading", { name: "Lähimmät apteekit" })).toBeVisible();
    } else {
      const toggle = page.getByRole("button", { name: /^Lähin: Steissin Apteekki · 50\sm$/ });
      await expect(toggle).toBeVisible();
      await expect(toggle).toHaveText(/^Lähin: Steissin Apteekki · 50\sm$/);
      await expect(toggle).toHaveAttribute("aria-expanded", "false");
      await toggle.click();
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
