import { APIRequestContext, Page, expect } from "@playwright/test";

/** Backend API base. Matches the frontend's REACT_APP_API_URL for local dev. */
export const API = process.env.E2E_API_URL ?? "http://localhost:8080/api";

/** localStorage key the app stores the JWT under (frontend/src/api.tsx). */
export const STORAGE_KEY = "tcg_token";

/** A valid password (≥ 8 chars, the backend's minimum). */
export const PASSWORD = "e2e-password-123";

// The register/login endpoints are rate-limited (10 req / 60s per IP), so tests
// register real users sparingly and prefer API-register + token seeding for the
// non-auth specs.
let counter = 0;

/**
 * A username unique per run so re-runs against the same (untorn-down) DB never
 * collide on the register endpoint.
 */
export function uniqueUser(prefix = "e2e"): string {
  counter += 1;
  return `${prefix}_${Date.now()}_${counter}`;
}

/** Register a user via the API. 201 (created) and 400 (already exists) both pass. */
export async function apiRegister(
  request: APIRequestContext,
  username: string,
  password = PASSWORD,
): Promise<void> {
  const res = await request.post(`${API}/register`, { data: { username, password } });
  expect(
    res.status() === 201 || res.status() === 400,
    `register ${username} returned ${res.status()}`,
  ).toBeTruthy();
}

/** Log in via the API and return the JWT access token. */
export async function apiLogin(
  request: APIRequestContext,
  username: string,
  password = PASSWORD,
): Promise<string> {
  const res = await request.post(`${API}/login`, { data: { username, password } });
  expect(res.ok(), `login ${username} returned ${res.status()}`).toBeTruthy();
  const body = (await res.json()) as { access_token: string };
  return body.access_token;
}

/** Create a fresh user (register + login) and return its name + token. */
export async function createUser(
  request: APIRequestContext,
): Promise<{ username: string; token: string }> {
  const username = uniqueUser();
  await apiRegister(request, username);
  const token = await apiLogin(request, username);
  return { username, token };
}

/**
 * Seed a JWT into localStorage so the app boots already logged in. Must be called
 * before the first navigation — AuthProvider reads the token in its initializer.
 */
export async function seedAuth(page: Page, token: string): Promise<void> {
  await page.addInitScript(
    ([k, v]) => window.localStorage.setItem(k as string, v as string),
    [STORAGE_KEY, token],
  );
}

/** Navigate to a HashRouter route, e.g. gotoHash(page, "/collection"). */
export async function gotoHash(page: Page, hash: string): Promise<void> {
  await page.goto(`/#${hash}`);
}

/** Best-effort cleanup so saved decks don't accumulate across runs. */
export async function deleteMtgDeck(
  request: APIRequestContext,
  token: string,
  name: string,
): Promise<void> {
  await request
    .delete(`${API}/decks/${encodeURIComponent(name)}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    .catch(() => undefined);
}
