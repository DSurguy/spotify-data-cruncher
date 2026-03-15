---
description: "Use when writing, reviewing, or modifying tests. Covers test structure, what to test for server routes and React UI, and testing conventions for this project."
applyTo: "src/**/*.test.ts,src/**/*.test.tsx"
---

# Testing Guidelines

Tests are written with Bun's built-in test runner (`bun test`) using `describe`/`it`/`expect` syntax. React component tests use `@testing-library/react`.

## What to Test

Focus on **business logic and contracts**, not implementation details.

### Server Routes

Each API route file (`src/routes/*.ts`) has a corresponding `*.test.ts` beside it. Test routes by constructing `Request` objects and calling the handler directly — no running server needed.

Cover:
- Happy-path response shape and status code
- Filtering/query parameters produce the correct SQL results
- Invalid input returns the correct error status (400/404)
- Mutations (POST/PUT/DELETE) persist the expected change

Do **not** test:
- Bun framework internals
- That SQLite itself works
- Logging or console output

Example structure:
```typescript
import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { Database } from "bun:sqlite";
import { handleGetAlbums } from "@/routes/albums";
import { runMigrations } from "@/migrations";

describe("GET /api/albums", () => {
  let db: Database;

  beforeEach(() => {
    db = new Database(":memory:");
    runMigrations(db);
    // seed minimal fixture data
  });

  afterEach(() => db.close());

  it("returns albums with aggregate play counts", async () => {
    const req = new Request("http://localhost/api/albums");
    const res = await handleGetAlbums(req, db);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.albums[0]).toMatchObject({ album_name: expect.any(String), play_count: expect.any(Number) });
  });

  it("filters by artist query param", async () => {
    const req = new Request("http://localhost/api/albums?artist=Wolfs");
    const res = await handleGetAlbums(req, db);
    const body = await res.json();
    expect(body.albums.every((a: any) => a.artist_name === "Wolfs")).toBe(true);
  });
});
```

Use an **in-memory SQLite database** (`:memory:`) in every test. Run the real migrations on it so tests exercise the actual schema. Seed only the rows each test needs — no shared global fixtures.

### React Components

Each component or page file has a corresponding `*.test.tsx` beside it.

Cover:
- The component renders without throwing given valid props
- User interactions trigger the expected state changes or callbacks
- Conditional rendering logic (e.g. "shows rating widget only when album is loaded")
- Data display: given a mock API response, the right text/elements appear

Do **not** test:
- CSS classes or Tailwind tokens
- Implementation details like internal state variable names
- Third-party Radix UI or shadcn component internals

Example structure:
```tsx
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "bun:test";
import { StarRating } from "@/components/StarRating";

describe("StarRating", () => {
  it("renders 5 stars", () => {
    render(<StarRating value={null} onChange={() => {}} />);
    expect(screen.getAllByRole("button")).toHaveLength(5);
  });

  it("calls onChange when a star is clicked", () => {
    const onChange = vi.fn();
    render(<StarRating value={null} onChange={onChange} />);
    fireEvent.click(screen.getAllByRole("button")[2]);
    expect(onChange).toHaveBeenCalledWith(3);
  });
});
```

Mock API calls with `vi.mock` or by passing mock data as props. Don't make real HTTP requests in component tests.

## Test File Location

Tests live **alongside** the file they cover:

```
src/routes/albums.ts
src/routes/albums.test.ts
src/components/StarRating.tsx
src/components/StarRating.test.tsx
src/pages/AlbumsPage.tsx
src/pages/AlbumsPage.test.tsx
```

## Temporary Files

Prefer in-memory SQLite (`:memory:`) for all database tests. If a test genuinely requires a file on disk, use `./tmp/` (see workspace instructions). Clean up in `afterEach`:

```typescript
const dbPath = "./tmp/test-" + crypto.randomUUID() + ".db";
afterEach(() => { db.close(); unlinkSync(dbPath); });
```

## Test Hygiene

- Each test is independent — no shared mutable state between tests.
- Use `beforeEach`/`afterEach` to set up and tear down, not `beforeAll`/`afterAll`, unless the setup is genuinely read-only.
- Test names describe behaviour, not implementation: prefer `"returns 404 when album not found"` over `"calls db.query with correct SQL"`.
- Keep tests short. If setup is long, extract a small factory function inside the test file.
