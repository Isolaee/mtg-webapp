# End-to-end tests (Playwright)

Browser-driven tests covering the primary user journeys of the TCG Builder web
app: authentication & navigation, card browsing, deck-builder gating, and the
collection.

These replace the long-removed Python/Flask `pytest` suite — the app is now
React + Axum, so the tests drive the real UI against the real backend.

## Run

```bash
cd e2e
npm install
npx playwright install chromium   # one-time browser download
npx playwright test
```

`playwright.config.ts` auto-starts **both** servers (and reuses them if already
running locally):

- **Backend** — `cargo run` in `../backend-rust` with
  `DATABASE_URL=sqlite:../database/mtg_card_db.db` and a test `JWT_SECRET`,
  ready when `http://localhost:8080/health` returns. The first run compiles the
  backend, so allow a few minutes.
- **Frontend** — `npm start` in `../frontend` (CRA dev server on :3000), which
  reads `REACT_APP_API_URL` from `frontend/.env.development`.

Useful variants:

```bash
npm run test:ui        # interactive UI mode
npm run test:headed    # watch the browser
npm run report         # open the last HTML report
```

## Notes

- The app uses **HashRouter**, so routes are `/#/path` (helpers handle this).
- Tests register **unique users per run** (`e2e_<timestamp>_<n>`); there is no DB
  teardown, so usernames must not collide. Auth specs exercise the login UI;
  other specs register via the API and seed the JWT into `localStorage` for
  speed (and to stay under the 10-requests/60s register rate limit).
- **MTG** card data (34k cards) is assumed present. **Riftbound** data may be
  unseeded locally, so those assertions only check the page/controls work, not a
  specific result count.
- The collection **Scan** page is native-only (Capacitor camera) and is excluded
  from these web tests.
- These specs live outside `frontend/` so they don't collide with CRA's Jest
  runner (`npm test` in `frontend/`).
