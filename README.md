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
