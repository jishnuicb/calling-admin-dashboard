# Admin Dashboard

React admin console for the voice-calling platform. Covers every admin API the
backend exposes — dashboard, users, listener applications, language master,
OTP lockouts, wallets, payments, packages, calls, moderation, notifications,
bonuses, RBAC, configuration, reports and the audit log.

Plain JavaScript with JSX (no TypeScript), matching the backend's convention.

## Quick start

The backend must be running first (`npm run dev` in the repository root, on
`:3000`).

```bash
cd admin-dashboard
cp .env.example .env
npm install
npm run dev
```

Open http://localhost:5173 and sign in with the seeded admin credentials —
`SEED_ADMIN_EMAIL` and `SEED_ADMIN_PASSWORD` from the backend's `.env`
(`admin@voiceplatform.local` by default). Run `npm run db:seed` in the backend
first if you have not already.

### Why there is a proxy

The dev server proxies `/api` to `http://localhost:3000`, so the browser makes a
same-origin request and CORS never comes into play. No backend configuration has
to change. Point the proxy elsewhere with `VITE_PROXY_TARGET`.

For a production build, set `VITE_API_BASE_URL` to the deployed API and add that
origin to the backend's `CORS_ORIGINS`:

```bash
VITE_API_BASE_URL=https://api.example.com/api/v1 npm run build
```

## Scripts

| Script | Purpose |
| --- | --- |
| `npm run dev` | Dev server on `:5173` with the `/api` proxy |
| `npm run build` | Production build into `dist/` |
| `npm run preview` | Serve the production build locally |
| `npm run lint` | ESLint |
| `npm run format` | Prettier |

## Layout

```
src/
  api/
    client.js       axios instance, auth header, refresh rotation, error normalising
    endpoints.js    every admin endpoint, grouped by module
    queryKeys.js    React Query cache keys
  auth/
    AuthContext.jsx session state, login/logout, permission checks
    permissions.js  permission keys mirroring the backend catalogue
  components/
    ui/             buttons, fields, modal, badges, toasts, empty and error states
    DataTable.jsx   table, pagination and filter-bar primitives
    layout/         app shell, permission-filtered sidebar
  hooks/
    useTableState.js  debounced filters + pagination
    useApiMutation.js mutation wrapper: toast, invalidation, error surfacing
  lib/format.js     dates, money, tokens, durations
  pages/            one file per screen
```

## Things worth knowing before changing this

**Refresh-token rotation is single-flight.** The backend revokes the old refresh
token on every refresh and treats a replayed one as theft, revoking *all* sessions
for that admin. Two concurrent 401s must therefore share one refresh, and the
rotated token must be stored. That logic lives in `api/client.js`; breaking it
produces the confusing symptom of being logged out of everything at random.

**Permission gating here is UX, not security.** The sidebar hides sections and
route guards show a "no access" page, but the API enforces the same permission on
every route. Hiding a button never protects anything — it just avoids handing an
admin a page that would 403 on every request. Super admins bypass all checks, as
they do server-side.

**Errors carry a request id.** The backend sends `x-request-id` on every response
and exposes it through CORS. `ErrorState` renders it, so a screenshot of a failure
is enough to find the exact request in the server logs.

**The API's response envelope.** Lists return `{ data, meta }` where `meta` has
`page`, `limit`, `total`, `totalPages`, `hasNextPage`, `hasPreviousPage` —
`Pagination` reads that directly. Single resources return the object unwrapped.
A few endpoints deviate in ways the code accounts for: `GET /admin/permissions`
groups permissions by module rather than returning a flat array, and
`GET /admin/reports` returns report types as plain strings.

**Reports are generic.** The backend describes each report as
`{ columns, rows, summary }`, so `ReportsPage` renders any of them without
per-report code. Adding a report type server-side needs no change here.

**OTP lockouts are a durable state, not a cache.** A number that exhausts its OTP
request budget stays locked until an admin releases it on *OTP & lockouts* —
there is no time-based expiry, so that queue needs working through. The same
screen edits the three thresholds that drive the policy (`otp.*` config keys), so
an admin who finds the limits too tight can fix them where they noticed the
problem; the Configuration screen exposes them too.

**Listener online/offline is manual-only (plus logout).** `online` is the
listener's last choice (`POST /listener/status`), not a live socket. App close,
disconnect, and login do not flip it; **logout does set them offline**. Approved
listeners start online by default; going offline (or logging out) keeps them
offline until they manually go online again. Busy during calls is still real-time
over WebSocket. Product notifications are delivered via Firebase push, not
WebSocket.

**Payout account numbers are masked everywhere but one screen.** The application
list returns `bankDetails.bankAccountNumberMasked`; only the application detail
endpoint returns the full number, for verifying a failed payout. Do not surface it
on a list view.

**Destructive actions confirm and explain.** Wallet adjustments, refunds, call
termination, blocking, suspension and forced bonus runs all go through a modal
that states the consequence. Several of them accept an idempotency key or default
to a dry run, mirroring the guarantees the backend provides — the UI surfaces
those rather than hiding them.

## Verified against the live API

Response shapes were checked against a running backend rather than only against
the OpenAPI spec. Every admin endpoint in `docs/openapi.json` is wired in
`api/endpoints.js`, and the permission list in `auth/permissions.js` matches
`src/modules/admin/permissions.js` exactly (32 keys, including `otp:read` and
`otp:unlock`).
