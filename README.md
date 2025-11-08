# Entertainment Tracker Monorepo

Entertainment Tracker is a pnpm-powered Turborepo that bundles a Node.js backend and an Expo mobile application for tracking movies, TV series, and anime. Users can browse titles from a free media API, mark items as watched, rate them, and for episodic content track their current episode.

## Repository Layout

```
entertainment-tracker/
├─ apps/
│  ├─ backend/   # Node.js API service (PostgreSQL, feature modules, shared lib)
│  └─ mobile/    # Expo React Native client
├─ packages/
│  ├─ tsconfig/       # Shared TypeScript configs
│  ├─ eslint-config/  # Shared lint rules
│  ├─ ui/             # Cross-platform UI primitives (optional)
│  └─ utils/          # Reusable logic, API contracts, DB typings
├─ turbo.json         # Turborepo pipeline definitions
├─ pnpm-workspace.yaml
└─ package.json
```

## Tech Stack

-   **Monorepo tooling:** Turborepo + pnpm workspaces
-   **Backend:** Node.js, PostgreSQL, modular feature architecture
-   **Mobile app:** Expo (React Native)
-   **Shared tooling:** ESLint, TypeScript,

## Planned Capabilities

-   Search and browse media data via a free movie/series API
-   Maintain per-user watchlists across movies, TV series, and anime
-   Track completion state, episode progress, and personal ratings
-   Sync data between the Expo app and backend API

## Backend (Fastify) Setup

1. Install dependencies from the repo root:
    ```bash
    pnpm install
    ```
2. Copy environment template and adjust values as needed:
    ```bash
    cp apps/backend/env.example apps/backend/.env
    ```
3. Start the database (requires Docker Desktop or local PostgreSQL):

    ```bash
    pnpm db:up
    ```

    The script tries `docker compose` first and falls back to `docker-compose` for older setups.

4. Start the backend dev server:
    ```bash
    pnpm be:dev
    ```
5. Verify the health check:
    ```bash
    curl http://localhost:3000/api/v1/health
    ```

### Handy Database Commands

-   Start Postgres: `pnpm db:up`
-   Stop Postgres: `pnpm db:down`
-   Reset Postgres (drops volume): `pnpm db:reset`
-   Run Prisma migrations: `pnpm be:prisma:migrate`
-   Generate Prisma client: `pnpm be:prisma:generate`
-   Open Prisma Studio: `pnpm be:prisma:studio`
-   Seed database: `pnpm be:db:seed`

### Backend Workflows

-   Lint backend sources: `pnpm be:lint`
-   Type-check backend code: `pnpm be:typecheck`
-   Build backend bundle: `pnpm be:build`

The backend currently exposes a Fastify instance with CORS/Helmet middleware, Prisma integration, and versioned APIs. Future work will expand domain modules and shared API contracts for the mobile app.
