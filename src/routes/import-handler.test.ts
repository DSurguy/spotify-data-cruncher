import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { Database } from "bun:sqlite";
import { join } from "path";
import { runMigrations } from "../db/migrations";
import { handleImport } from "./import-handler";

const SAMPLE_DIR = join(import.meta.dir, "../../sample-data/unzipped");

function makeRequest(body: object) {
  return new Request("http://localhost/api/datasets/import", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("handleImport", () => {
  let db: Database;

  beforeEach(() => {
    db = new Database(":memory:");
    db.run("PRAGMA foreign_keys=ON");
    runMigrations(db);
  });

  afterEach(() => db.close());

  it("creates a dataset and imports records from a valid directory", async () => {
    const res = await handleImport(db, makeRequest({ name: "My Import", path: SAMPLE_DIR }));
    const body = await res.json();
    expect(res.status).toBe(201);
    expect(body.dataset.name).toBe("My Import");
    expect(body.import.status).toBe("done");
    expect(body.import.inserted_records).toBeGreaterThan(0);
    expect(body.import.total_files).toBeGreaterThan(0);
  });

  it("uses a default name when name is omitted", async () => {
    const res = await handleImport(db, makeRequest({ path: SAMPLE_DIR }));
    const body = await res.json();
    expect(res.status).toBe(201);
    expect(body.dataset.name).toMatch(/Import/);
  });

  it("returns 400 when path is missing", async () => {
    const res = await handleImport(db, makeRequest({ name: "Test" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when path does not exist", async () => {
    const res = await handleImport(db, makeRequest({ path: "/nonexistent/path/here" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when body is not valid JSON", async () => {
    const res = await handleImport(
      db,
      new Request("http://localhost/api/datasets/import", {
        method: "POST",
        body: "not json",
      })
    );
    expect(res.status).toBe(400);
  });
});
