import { test, expect } from "@playwright/test";

test.describe("MTG card browser", () => {
  test("searching by name returns matching cards", async ({ page }) => {
    await page.goto("/#/cards");

    await page.getByPlaceholder("Search by name…").fill("Lightning Bolt");
    await page.getByRole("button", { name: "Search" }).click();

    // Result count line + the card row itself (reliable in the 34k-card DB).
    await expect(page.getByText(/\d+ cards? found/)).toBeVisible();
    await expect(page.getByText("Lightning Bolt").first()).toBeVisible();
  });

  test("a no-match search shows the empty state", async ({ page }) => {
    await page.goto("/#/cards");

    await page.getByPlaceholder("Search by name…").fill("zzzqqqxxnotacard");
    await page.getByRole("button", { name: "Search" }).click();

    await expect(
      page.getByText("No cards found. Try a different search."),
    ).toBeVisible();
  });
});

test.describe("Riftbound card browser", () => {
  // Riftbound data may be unseeded locally, so assert the page + controls work
  // rather than a specific result count.
  test("renders filters and runs a search without error", async ({ page }) => {
    await page.goto("/#/riftbound");

    await expect(
      page.getByRole("heading", { name: "Riftbound Cards" }),
    ).toBeVisible();
    await expect(page.getByPlaceholder("Search by name…")).toBeVisible();

    await page.getByPlaceholder("Search by name…").fill("a");
    await page.getByRole("button", { name: "Search" }).click();

    // Either results appear or nothing does — but the page must not surface a
    // fetch error and must stay interactive.
    await expect(page.getByText("Failed to fetch cards.")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Search" })).toBeEnabled();
  });
});
