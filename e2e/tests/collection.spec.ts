import { test, expect } from "@playwright/test";
import { createUser, seedAuth } from "./helpers";

// Quantity controls use a real minus sign (U+2212) and the delete button uses
// a multiplication sign (U+2715) — copy them exactly from CollectionPage.tsx.
const MINUS = "−";
const DELETE = "✕";

test.describe("Collection", () => {
  test("add a card, adjust quantity, then remove it", async ({
    page,
    request,
  }) => {
    const { token } = await createUser(request);
    await seedAuth(page, token);
    await page.goto("/#/collection");

    // Fresh user starts empty.
    await expect(
      page.getByText("No cards yet — search above to add some."),
    ).toBeVisible();

    // Search and pick a card from the results dropdown.
    await page.getByPlaceholder("Search card name…").fill("Sol Ring");
    await page.getByRole("button", { name: "Search" }).click();
    await page.getByText("Sol Ring", { exact: true }).first().click();

    await page.getByRole("button", { name: "Add to Collection" }).click();

    // The card now appears in the table.
    const row = page.getByRole("row", { name: /Sol Ring/ });
    await expect(row).toBeVisible();
    await expect(page.getByText("1 card")).toBeVisible();

    // Increment quantity.
    await row.getByRole("button", { name: "+" }).click();
    await expect(row.getByText("2", { exact: true })).toBeVisible();

    // Decrement back.
    await row.getByRole("button", { name: MINUS }).click();
    await expect(row.getByText("1", { exact: true })).toBeVisible();

    // Delete (the page confirms via window.confirm).
    page.on("dialog", (d) => d.accept());
    await row.getByRole("button", { name: DELETE }).click();
    await expect(
      page.getByText("No cards yet — search above to add some."),
    ).toBeVisible();
  });
});
