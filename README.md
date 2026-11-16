# ministry-of-friendship-api

Parse Server API for Ministry of Friendship, backed by MongoDB Atlas. Sign in is handled by Clerk.

## How authentication works

- The UI signs people in with Clerk and sends the Clerk session token as `Authorization: Bearer <token>` on every
  Parse request.
- `app.js` mounts `@clerk/express` `clerkMiddleware()` plus `requireClerkUser` (`auth/clerkAuth.js`) in front of
  `/parse`. Requests without a valid Clerk session get a 401 before Parse sees them. After verification the
  middleware sets the `x-clerk-user-id` header server side (any client copy is discarded), and cloud code reads it
  from `request.headers`.
- `cloud/main.js` stamps every `Profile`, `Preference` and `Squad` with `clerkUserId` on create and only lets the
  owner change or delete it. Non-hosts may only move themselves into an `OPEN` squad slot or back out of one.
- `cloud/schema.js` defines the class-level permissions: `_User` is master-key only (no Parse signup or login), client
  class creation is off, and schemas are locked.
- `/health` stays public for Render's health check.

There are no Parse users any more. Everyone signs up again through Clerk; old Parse accounts are not migrated.

## Local setup

```bash
cp .env.example .env
npm install
npm start
```

Fill in `.env`:

| Variable | Purpose |
| --- | --- |
| `DATABASE_URI` | MongoDB connection string (local MongoDB or Atlas) |
| `APP_ID` / `MASTER_KEY` | Parse app id and master key. The UI's `PARSE_APP_ID` must match `APP_ID` |
| `SERVER_URL` / `PUBLIC_SERVER_URL` | Parse server URLs (default to `http://localhost:<PORT>/parse`) |
| `CORS_ORIGIN` | Browser origin of the UI (default `http://localhost:3000`) |
| `CLERK_PUBLISHABLE_KEY` / `CLERK_SECRET_KEY` | From the Clerk dashboard, API keys page |

The app expects two placeholder Profiles, gamer tags `OPEN` and `CLASSIFIED`, in the database. Clients cannot
create them, so add them directly in MongoDB when starting from an empty database, for example:

```bash
mongosh "$DATABASE_URI" --eval 'const now = new Date(); db.Profile.insertMany([{ _id: "openPlacehold", gamerTag: "OPEN", _created_at: now, _updated_at: now }, { _id: "classifiedPlc", gamerTag: "CLASSIFIED", _created_at: now, _updated_at: now }])'
```

## Tests

```bash
npm test
```

Unit tests cover the Clerk middleware and cloud functions. The integration suite starts Parse Server on an
in-memory MongoDB with Clerk mocked and checks the lockdown rules end to end. `npm run start:test` starts the
Playwright test server on port 1338 (see `.env.test`); it uses real Clerk verification.

## Deploying to Render

`render.yaml` is a Render Blueprint that defines two web services (Node, free plan, health check `/health`), one per
environment:

| Environment | Service | Branch | UI origin |
| --- | --- | --- | --- |
| Production | `ministry-of-friendship-api` | `master` | `https://ministry-of-friendship-ui.onrender.com` |
| Test | `ministry-of-friendship-api-test` | `develop` | `https://ministry-of-friendship-ui-test.onrender.com` |

Pushing to `master` deploys production; pushing to `develop` deploys test. In the Render dashboard choose
New > Blueprint and point it at this repo, then set the `sync: false` values on each service: `APP_ID`,
`DATABASE_URI`, `MASTER_KEY`, `CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY`.

- Each environment has its own MongoDB Atlas database, so `DATABASE_URI` differs per service. Seed the `OPEN` and
  `CLASSIFIED` placeholder Profiles in both databases. Allow Render's outbound IPs (or `0.0.0.0/0`) in the Atlas
  network access list.
- Both environments use the same Clerk development instance keys.
- `APP_ID` must match the `PARSE_APP_ID` of the UI service in the same environment.

Each UI static site rewrites `/api/*` to its own environment's API `/parse/*`, so browsers talk to the API through
the UI origin. `CORS_ORIGIN` and `PUBLIC_SERVER_URL` point at the matching UI hostname.
