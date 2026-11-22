import { expect, test } from "@playwright/test";

test.describe("English fallback for an unsupported browser language", () => {
  test.use({ locale: "sv-SE" });

  test("shows English heading and distance", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Nearby pharmacies");
    await expect(page.getByText("Example distance", { exact: true })).toBeVisible();
    await expect(page.getByTestId("sample-distance")).toHaveText(/^1\.7\skm straight line$/);
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(page).toHaveTitle("Nearby pharmacies");
  });
});

test.describe("Finnish for a Finnish browser", () => {
  test.use({ locale: "fi-FI" });

  test("shows Finnish heading and distance", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Lähiapteekit");
    await expect(page.getByText("Esimerkkietäisyys", { exact: true })).toBeVisible();
    await expect(page.getByTestId("sample-distance")).toHaveText(/^1,7\skm linnuntietä$/);
    await expect(page.locator("html")).toHaveAttribute("lang", "fi");
    await expect(page).toHaveTitle("Lähiapteekit");
  });
});
