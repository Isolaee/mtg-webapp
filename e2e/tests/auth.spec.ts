import { test, expect } from "@playwright/test";
import { PASSWORD, uniqueUser } from "./helpers";

// The login page (frontend/src/pages/LoginPage.tsx) has:
//  - tab buttons "Log in" / "Register" (no type attr)
//  - one text input (username), one password input
//  - a submit button with type="submit" reading "Log in" or "Create account"
//  - a bottom link-button toggling the mode
// The submit button is the only button[type="submit"], so we target it that way
// to avoid colliding with the "Log in" tab.
const submit = 'button[type="submit"]';

test.describe("Authentication", () => {
  test("register, log in, then log out", async ({ page }) => {
    const username = uniqueUser();
    await page.goto("/#/login");

    // Switch to the Register tab (first match — the bottom toggle also reads
    // "Register" while in login mode).
    await page.getByRole("button", { name: "Register" }).first().click();

    await page.locator('input[type="text"]').fill(username);
    await page.locator('input[type="password"]').fill(PASSWORD);
    await page.locator(submit).click();

    await expect(
      page.getByText("Account created! You can now log in."),
    ).toBeVisible();

    // The form auto-switches to login mode and clears the password.
    await page.locator('input[type="text"]').fill(username);
    await page.locator('input[type="password"]').fill(PASSWORD);
    await page.locator(submit).click();

    // Redirected home; the nav now shows the username and a Log out button.
    await expect(page.getByRole("button", { name: "Log out" })).toBeVisible();
    await expect(
      page.getByRole("link", { name: new RegExp(username) }),
    ).toBeVisible();

    // Log out returns to the anonymous nav (a "Log in" link reappears).
    await page.getByRole("button", { name: "Log out" }).click();
    await expect(page.getByRole("link", { name: "Log in" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Log out" })).toHaveCount(0);
  });

  test("wrong password is rejected", async ({ page }) => {
    await page.goto("/#/login");
    await page.locator('input[type="text"]').fill(uniqueUser());
    await page.locator('input[type="password"]').fill("definitely-wrong");
    await page.locator(submit).click();

    await expect(page.getByText(/Bad username or password/i)).toBeVisible();
    await expect(page.getByRole("button", { name: "Log out" })).toHaveCount(0);
  });

  test("protected route redirects anonymous users to login", async ({ page }) => {
    await page.goto("/#/collection");
    await expect(page).toHaveURL(/#\/login/);
    // The login form is shown.
    await expect(page.locator('input[type="password"]')).toBeVisible();
  });
});
