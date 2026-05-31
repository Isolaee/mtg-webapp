import { test, expect } from "@playwright/test";

test.describe("Navigation", () => {
  test("home page shows both game sections", async ({ page }) => {
    await page.goto("/#/");

    await expect(
      page.getByRole("heading", { name: "Magic: The Gathering" }),
    ).toBeVisible();
    await expect(page.getByRole("heading", { name: "Riftbound" })).toBeVisible();
    await expect(
      page.getByText("34,000+ cards from all sets and formats"),
    ).toBeVisible();
  });

  test("home page primary CTAs link into each game", async ({ page }) => {
    await page.goto("/#/");

    // Two "Browse Cards" links — MTG first, Riftbound second.
    await page.getByRole("link", { name: "Browse Cards" }).first().click();
    await expect(page).toHaveURL(/#\/cards/);
    await expect(page.getByRole("heading", { name: "MTG Cards" })).toBeVisible();
  });

  test("game switcher tabs swap the active game", async ({ page }) => {
    await page.goto("/#/cards");
    await expect(page.getByRole("heading", { name: "MTG Cards" })).toBeVisible();

    await page.getByRole("link", { name: "Riftbound" }).click();
    await expect(page).toHaveURL(/#\/riftbound/);
    await expect(
      page.getByRole("heading", { name: "Riftbound Cards" }),
    ).toBeVisible();

    await page.getByRole("link", { name: "Magic: The Gathering" }).click();
    await expect(page).toHaveURL(/#\/cards/);
    await expect(page.getByRole("heading", { name: "MTG Cards" })).toBeVisible();
  });

  test("MTG sub-nav links to the deck builder", async ({ page }) => {
    await page.goto("/#/cards");

    // The per-game sub-nav exposes a "Deck Builder" link.
    await page.getByRole("link", { name: "Deck Builder" }).click();
    await expect(page).toHaveURL(/#\/deck-builder/);
    await expect(
      page.getByRole("heading", { name: "MTG Deck Builder" }),
    ).toBeVisible();
  });
});
