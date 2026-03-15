import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { Database } from "bun:sqlite";
import { runMigrations } from "../db/migrations";
import { handleGetOverrides, handlePutOverrides, handleDeleteOverride } from "./overrides";

describe("overrides routes", () => {
  let db: Database;

  beforeEach(() => {
    db = new Database(":memory:");
    db.run("PRAGMA foreign_keys=ON");
    runMigrations(db);
  });

  afterEach(() => db.close());

  it("GET returns empty overrides for unknown key", async () => {
    const res = handleGetOverrides(db, "album", "unknown||key");
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.overrides).toEqual({});
  });

  it("GET returns 400 for unknown entity type", async () => {
    const res = handleGetOverrides(db, "badtype", "key");
    expect(res.status).toBe(400);
  });

  it("PUT upserts override fields", async () => {
    const req = new Request("http://localhost/api/overrides/album/some%7C%7Ckey", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify([
        { field: "rating", value: "4" },
        { field: "genre",  value: '"Rock"' },
      ]),
    });
    const res = await handlePutOverrides(db, req, "album", "some||key");
    expect(res.status).toBe(200);

    const getRes = handleGetOverrides(db, "album", "some||key");
    const body = await getRes.json();
    expect(body.overrides.rating).toBe(4);
    expect(body.overrides.genre).toBe("Rock");
  });

  it("PUT with null value removes field", async () => {
    db.run(`INSERT INTO metadata_overrides (entity_type, entity_key, field, value, updated_at)
      VALUES ('album', 'key', 'genre', '"Pop"', '2024-01-01')`);

    const req = new Request("http://localhost/api/overrides/album/key", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify([{ field: "genre", value: null }]),
    });
    await handlePutOverrides(db, req, "album", "key");

    const getRes = handleGetOverrides(db, "album", "key");
    const body = await getRes.json();
    expect(body.overrides.genre).toBeUndefined();
  });

  it("PUT ignores unknown fields silently", async () => {
    const req = new Request("http://localhost/api/overrides/album/key", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify([{ field: "hacked", value: "bad" }]),
    });
    const res = await handlePutOverrides(db, req, "album", "key");
    expect(res.status).toBe(200);
    const row = db.query("SELECT * FROM metadata_overrides WHERE field = 'hacked'").get();
    expect(row).toBeNull();
  });

  it("DELETE removes a specific field", async () => {
    db.run(`INSERT INTO metadata_overrides (entity_type, entity_key, field, value, updated_at)
      VALUES ('album', 'key', 'notes', '"hi"', '2024-01-01')`);
    const res = handleDeleteOverride(db, "album", "key", "notes");
    expect(res.status).toBe(200);
    const row = db.query("SELECT * FROM metadata_overrides WHERE field = 'notes'").get();
    expect(row).toBeNull();
  });

  it("DELETE returns 400 for unknown field", async () => {
    const res = handleDeleteOverride(db, "album", "key", "hacked");
    expect(res.status).toBe(400);
  });
});
