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
3. Start the backend dev server:
    ```bash
    pnpm be:dev
    ```
4. Verify the health check:
    ```bash
    curl http://localhost:3000/api/v1/health
    ```

The backend currently exposes a Fastify instance with CORS/Helmet middleware and a versioned `GET /api/v1/health` endpoint. Future work will integrate PostgreSQL, domain modules, and shared API contracts for the mobile app.
