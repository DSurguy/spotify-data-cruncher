import { Database } from "bun:sqlite";
import * as migration001 from "../migrations/001_initial_schema";
import * as migration002 from "../migrations/002_add_slugs";

const migrations = [migration001, migration002];

export function runMigrations(db: Database): void {
  // Ensure schema_version exists before we can query it
  const tableExists = db
    .query<{ count: number }, []>(
      `SELECT COUNT(*) as count FROM sqlite_master WHERE type='table' AND name='schema_version'`
    )
    .get();

  const currentVersion = tableExists?.count
    ? (db.query<{ v: number }, []>(`SELECT MAX(version) as v FROM schema_version`).get()?.v ?? 0)
    : 0;

  for (const migration of migrations) {
    if (migration.version <= currentVersion) continue;

    const run = db.transaction(() => {
      migration.up(db);
      db.run(`INSERT INTO schema_version (version, applied_at) VALUES (?, ?)`, [
        migration.version,
        new Date().toISOString(),
      ]);
    });
    run();
  }
}
