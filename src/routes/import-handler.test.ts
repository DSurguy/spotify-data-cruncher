import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { Database } from "bun:sqlite";
import { join } from "path";
import { readFileSync } from "fs";
import { runMigrations } from "../db/migrations";
import { handleImport } from "./import-handler";

const SAMPLE_ZIP = join(import.meta.dir, "../../sample-data/my_spotify_data.zip");

function makeRequest(fields: { name?: string; hasFile?: boolean; badZip?: boolean }) {
  const formData = new FormData();
  if (fields.name) formData.set("name", fields.name);
  if (fields.hasFile !== false) {
    const data = fields.badZip
      ? new Uint8Array([0, 1, 2, 3]) // not a valid zip
      : readFileSync(SAMPLE_ZIP);
    formData.set("file", new File([data], "my_spotify_data.zip", { type: "application/zip" }));
  }
  return new Request("http://localhost/api/datasets", { method: "POST", body: formData });
}

describe("handleImport", () => {
  let db: Database;

  beforeEach(() => {
    db = new Database(":memory:");
    db.run("PRAGMA foreign_keys=ON");
    runMigrations(db);
  });

  afterEach(() => db.close());

  it("creates a dataset and imports records from a valid zip", async () => {
    const res = await handleImport(db, makeRequest({ name: "My Import", hasFile: true }));
    const body = await res.json();
    expect(res.status).toBe(201);
    expect(body.dataset.name).toBe("My Import");
    expect(body.import.status).toBe("done");
    expect(body.import.inserted_records).toBeGreaterThan(0);
  });

  it("uses a default name when name is omitted", async () => {
    const res = await handleImport(db, makeRequest({ hasFile: true }));
    const body = await res.json();
    expect(res.status).toBe(201);
    expect(body.dataset.name).toMatch(/Import/);
  });

  it("returns 400 when no file is provided", async () => {
    const res = await handleImport(db, makeRequest({ hasFile: false }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when zip is invalid", async () => {
    const res = await handleImport(db, makeRequest({ hasFile: true, badZip: true }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when body is not multipart", async () => {
    const res = await handleImport(
      db,
      new Request("http://localhost/api/datasets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "test" }),
      })
    );
    expect(res.status).toBe(400);
  });
});
