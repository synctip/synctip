# synctip

Synctip is a TypeScript monorepo:

- `apps/api` — NestJS 11 HTTP API (Bun runtime, Prisma 7, Postgres 18).
- `apps/web` — Vite 8 + React 19 SPA with TanStack Router + TanStack Query.
- `packages/db` — Prisma schema, migrations, and generated client.
- `packages/api-client` — shared types and a typed `fetch` client used by web.

## Prerequisites

- [Bun](https://bun.sh) 1.3+
- [Docker](https://www.docker.com/) (for the local Postgres)
- Git with SSH commit signing configured (commits on `main` must be signed)

## Local setup

```bash
# 1. Install dependencies
bun install

# 2. Copy env templates
cp .env.example .env
cp apps/api/.env.example apps/api/.env
cp packages/db/.env.example packages/db/.env
cp apps/web/.env.example apps/web/.env.local

# 3. Start Postgres
docker compose up -d

# 4. Apply migrations + generate the Prisma client
cd packages/db && bunx prisma migrate dev && cd -

# 5. Run both apps
bun run dev
```

The web app is then served at <http://localhost:5173> and the API at <http://localhost:3000>. The Vite dev server proxies `/api/*` to the API.

## Useful scripts

From the repo root:

| Command           | What it does                  |
| ----------------- | ----------------------------- |
| `bun run dev`     | runs web and api concurrently |
| `bun run dev:web` | web only                      |
| `bun run dev:api` | api only (Bun watch mode)     |

Per package (run via `cd <dir> && bun run <script>`):

| Package       | Script     | What it does                       |
| ------------- | ---------- | ---------------------------------- |
| `apps/api`    | `lint`     | ESLint (CI mode, no auto-fix)      |
| `apps/api`    | `lint:fix` | ESLint with `--fix`                |
| `apps/api`    | `test`     | Bun test runner over `src/`        |
| `apps/web`    | `lint`     | oxlint                             |
| `apps/web`    | `build`    | type-check + Vite production build |
| `packages/db` | (none)     | use `bunx prisma <cmd>` directly   |

## Branch model and deployments

- `develop` is the integration branch. Every push deploys to the **staging** Render environment automatically.
- `main` is production. Promotion is by PR from `develop` to `main`, which requires:
  - all CI checks green (`ci` workflow),
  - staging currently healthy (`probe` job in `staging-health` workflow),
  - all commits on the PR signed,
  - one approving review.
- Merges to `main` must use **Squash and merge** (linear history is enforced).

## Health endpoints

The API exposes RFC-style health endpoints consumed by the web `/health` page, Render, and the CI staging gate:

- `GET /health` — full check, includes db ping, memory, uptime.
- `GET /health/live` — liveness only (does not touch the database).
- `GET /health/ready` — same payload as `/health`; intended for load-balancers and the CI gate.

Response format follows <https://inadarei.github.io/rfc-healthcheck/>.

## Pre-commit hook

`husky` + `lint-staged` runs `eslint --fix` (api) and `oxlint` (web) on staged files. To bypass in an emergency: `git commit --no-verify`. Don't make a habit of it.

