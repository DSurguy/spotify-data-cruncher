# Project Guidelines

## Overview

Spotify Data Cruncher is a local full-stack web application built with Bun + React + TypeScript. It ingests Spotify listening history JSON exports into a SQLite database and presents a UI for exploring and annotating that data. See [docs/app.plan.md](../docs/app.plan.md) for the full application plan.

## Tech Stack

- **Runtime & server:** Bun (built-in HTTP server, `bun:sqlite`)
- **Frontend:** React 19 + TypeScript, Tailwind CSS v4, Radix UI, shadcn/ui components
- **Database:** SQLite via `bun:sqlite`, stored in OS user data directory
- **Build:** `bun build --compile` produces a single self-contained executable
- **Tests:** `bun test` (built-in runner)

## Build & Dev Commands

```bash
bun run dev          # Start dev server with HMR on localhost:4242
bun run build        # Compile production binary to dist/
bun test             # Run all tests
```

## Code Style

- **Prefer simple and readable over clever.** If a solution is hard to skim, it needs to be simplified.
- **No premature abstraction.** Don't extract a helper, utility, or shared component until it is needed in at least two distinct places.
- **No premature optimization.** Write straightforward code first. Only optimize when a measured bottleneck exists.
- **Minimal defensive coding.** Don't add error handling, fallbacks, or validation for cases that cannot occur from normal usage. Validate at real system boundaries (user input, file I/O, external API responses).
- **No speculative features.** Implement only what is described in the plan or explicitly requested. Do not add configurability or extension points "for the future."
- **Comments only where logic is non-obvious.** Don't comment what the code already says clearly.

## Commit Discipline

- **Commit immediately after each unit of work is complete and tests pass.** Do not continue to the next piece of work until the current one is committed.
- **Each commit is one coherent unit** — a new route, a schema migration, a UI component, a bug fix. Never accumulate multiple units and batch-commit them at the end.
- **Never batch unrelated changes into one commit.** If a task touches both schema and UI, those are separate commits made at separate times.
- **Commit messages use imperative present tense:** `Add plays API route`, `Fix album art BLOB serving`, `Migrate schema to v3`.
- **Every commit must leave the codebase in a working state** — no half-implemented features unless clearly behind a feature flag or unreachable code path.
- **Tests travel with the code they cover.** If you add a route or component, add its tests in the same commit — then commit before moving on.

### Commit workflow
For every unit of work, follow this sequence without deviation:
1. Write the code and its tests.
2. Run the tests and confirm they pass.
3. `git add` only the files for this unit.
4. `git commit` with a clear message.
5. Only then begin the next unit.

## Temporary Files

Always use the local `./tmp/` directory (already in `.gitignore`) for any temporary files — test artifacts, scratch output, downloaded files, shell redirects, etc. **Never use the system `/tmp/`.**

## Project Conventions

- API routes live in `src/routes/` — one file per resource (e.g. `plays.ts`, `albums.ts`).
- Database migrations live in `src/migrations/` — numbered sequentially (`001_initial_schema.ts`, `002_add_album_art.ts`). Each exports `version: number` and `up(db: Database): void`.
- React pages live in `src/pages/`, reusable UI components in `src/components/`.
- Shared TypeScript types (API request/response shapes, DB row types) live in `src/types/`.
- Tests live alongside the files they cover: `src/routes/plays.test.ts`, `src/components/AlbumCard.test.tsx`.
- Use absolute imports via the `@/` alias (already configured in `tsconfig.json`).

See [docs/app.plan.md](../docs/app.plan.md) for the full data model, API contract, SQLite schema, and UI layout.
