import { test, expect } from "@playwright/test";
import { createUser, deleteMtgDeck, seedAuth, uniqueUser } from "./helpers";

// "+ Create Deck" (page) and "Create Deck" (modal submit) differ by the leading
// "+", so exact names disambiguate them.
const createDeckButton = { name: "+ Create Deck" };
const modalSubmit = { name: "Create Deck", exact: true };

test.describe("MTG deck builder gating", () => {
  test("builder is hidden until a deck is created", async ({ page }) => {
    await page.goto("/#/deck-builder");

    // Initial state: only the create button; no toolbar / save banner.
    await expect(page.getByRole("button", createDeckButton)).toBeVisible();
    await expect(page.getByRole("button", { name: "Save Deck" })).toHaveCount(0);
    await expect(page.getByText(/until you press/i)).toHaveCount(0);

    // Open the Create New Deck dialog and create a deck.
    await page.getByRole("button", createDeckButton).click();
    await expect(page.getByText("Create New Deck")).toBeVisible();
    await page.getByPlaceholder("Untitled deck").fill(uniqueUser("deck"));
    await page.getByRole("button", modalSubmit).click();

    // Builder is now revealed: save-note banner + Save Deck button.
    await expect(page.getByText(/until you press/i)).toBeVisible();
    await expect(page.getByRole("button", { name: "Save Deck" })).toBeVisible();
  });

  test("Clear collapses the builder back to the create button", async ({
    page,
  }) => {
    await page.goto("/#/deck-builder");
    await page.getByRole("button", createDeckButton).click();
    await page.getByPlaceholder("Untitled deck").fill(uniqueUser("deck"));
    await page.getByRole("button", modalSubmit).click();
    await expect(page.getByRole("button", { name: "Save Deck" })).toBeVisible();

    // The deck has a name, so Clear asks to confirm — accept it.
    page.on("dialog", (d) => d.accept());
    await page.getByRole("button", { name: "Clear" }).click();

    await expect(page.getByRole("button", { name: "Save Deck" })).toHaveCount(0);
    await expect(page.getByText(/until you press/i)).toHaveCount(0);
    await expect(page.getByRole("button", createDeckButton)).toBeVisible();
  });
});

test.describe("MTG deck save", () => {
  test("a logged-in user can save a deck and see it in My Decks", async ({
    page,
    request,
  }) => {
    const { token } = await createUser(request);
    const deckName = uniqueUser("deck");
    await seedAuth(page, token);

    await page.goto("/#/deck-builder");
    await page.getByRole("button", createDeckButton).click();
    await page.getByPlaceholder("Untitled deck").fill(deckName);
    await page.getByRole("button", modalSubmit).click();

    // The Save Deck button is enabled once logged in with a deck name.
    const save = page.getByRole("button", { name: "Save Deck" });
    await expect(save).toBeEnabled();
    await save.click();

    await expect(page.getByText("Deck saved!")).toBeVisible();
    await expect(
      page.getByRole("link", { name: /View in My Decks/ }),
    ).toBeVisible();

    // The deck shows up on the My Decks page.
    await page.goto("/#/my-decks");
    await expect(page.getByText(deckName)).toBeVisible();

    await deleteMtgDeck(request, token, deckName);
  });
});
