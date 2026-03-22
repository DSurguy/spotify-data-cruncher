import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { Database } from "bun:sqlite";
import { runMigrations } from "./migrations";

describe("runMigrations", () => {
  let db: Database;

  beforeEach(() => {
    db = new Database(":memory:");
    db.run("PRAGMA foreign_keys=ON");
  });

  afterEach(() => db.close());

  it("creates all expected tables on a fresh database", () => {
    runMigrations(db);

    const tables = db
      .query<{ name: string }, []>(`SELECT name FROM sqlite_master WHERE type='table' ORDER BY name`)
      .all()
      .map(r => r.name);

    expect(tables).toContain("schema_version");
    expect(tables).toContain("datasets");
    expect(tables).toContain("plays");
    expect(tables).toContain("metadata_overrides");
    expect(tables).toContain("album_art");
  });

  it("records the applied migration version", () => {
    runMigrations(db);
    const row = db.query<{ version: number }, []>(`SELECT MAX(version) as version FROM schema_version`).get();
    expect(row?.version).toBe(2);
  });

  it("is idempotent — running twice does not error or duplicate", () => {
    runMigrations(db);
    runMigrations(db);

    const count = db.query<{ c: number }, []>(`SELECT COUNT(*) as c FROM schema_version`).get();
    expect(count?.c).toBe(2);
  });

  it("enables foreign key enforcement", () => {
    runMigrations(db);
    db.run("PRAGMA foreign_keys=ON");

    // Inserting a play with a non-existent dataset_id should fail
    expect(() => {
      db.run(
        `INSERT INTO plays (dataset_id, ts, ms_played, content_type) VALUES (999, '2024-01-01T00:00:00Z', 0, 'track')`
      );
    }).toThrow();
  });
});
