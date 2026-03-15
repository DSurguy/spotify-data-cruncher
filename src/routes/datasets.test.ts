import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { Database } from "bun:sqlite";
import { runMigrations } from "../db/migrations";
import {
  handleGetDatasets,
  handleGetDataset,
  handlePatchDataset,
  handleDeleteDataset,
} from "./datasets";

function seedDataset(db: Database, name = "Test Set", sourcePath: string | null = null) {
  db.run(`INSERT INTO datasets (name, created_at, source_path) VALUES (?, ?, ?)`, [
    name,
    new Date().toISOString(),
    sourcePath,
  ]);
  return db.query<{ id: number }, []>(`SELECT last_insert_rowid() as id`).get()!.id;
}

describe("datasets routes", () => {
  let db: Database;

  beforeEach(() => {
    db = new Database(":memory:");
    db.run("PRAGMA foreign_keys=ON");
    runMigrations(db);
  });

  afterEach(() => db.close());

  describe("GET /api/datasets", () => {
    it("returns empty list when no datasets exist", async () => {
      const res = handleGetDatasets(db);
      const body = await res.json();
      expect(res.status).toBe(200);
      expect(body.datasets).toEqual([]);
    });

    it("returns all datasets ordered by created_at desc", async () => {
      db.run(`INSERT INTO datasets (name, created_at) VALUES ('First', '2024-01-01T00:00:00Z')`);
      db.run(`INSERT INTO datasets (name, created_at) VALUES ('Second', '2024-06-01T00:00:00Z')`);

      const res = handleGetDatasets(db);
      const body = await res.json();
      expect(body.datasets).toHaveLength(2);
      expect(body.datasets[0].name).toBe("Second");
      expect(body.datasets[1].name).toBe("First");
    });
  });

  describe("GET /api/datasets/:id", () => {
    it("returns the dataset by id", async () => {
      const id = seedDataset(db, "My Export");
      const res = handleGetDataset(db, id);
      const body = await res.json();
      expect(res.status).toBe(200);
      expect(body.name).toBe("My Export");
    });

    it("returns 404 for unknown id", () => {
      const res = handleGetDataset(db, 999);
      expect(res.status).toBe(404);
    });
  });

  describe("PATCH /api/datasets/:id", () => {
    it("updates the name", async () => {
      const id = seedDataset(db, "Old Name");
      const res = handlePatchDataset(db, id, { name: "New Name" });
      const body = await res.json();
      expect(res.status).toBe(200);
      expect(body.name).toBe("New Name");
    });

    it("returns 400 when name is blank", () => {
      const id = seedDataset(db);
      const res = handlePatchDataset(db, id, { name: "   " });
      expect(res.status).toBe(400);
    });

    it("returns 404 for unknown id", () => {
      const res = handlePatchDataset(db, 999, { name: "x" });
      expect(res.status).toBe(404);
    });
  });

  describe("DELETE /api/datasets/:id", () => {
    it("deletes the dataset", () => {
      const id = seedDataset(db);
      const res = handleDeleteDataset(db, id);
      expect(res.status).toBe(204);
      expect(handleGetDataset(db, id).status).toBe(404);
    });

    it("cascades to plays", () => {
      const id = seedDataset(db);
      db.run(
        `INSERT INTO plays (dataset_id, ts, ms_played, content_type) VALUES (?, '2024-01-01T00:00:00Z', 1000, 'track')`,
        [id]
      );
      handleDeleteDataset(db, id);
      const count = db.query<{ c: number }, [number]>(`SELECT COUNT(*) as c FROM plays WHERE dataset_id = ?`).get(id);
      expect(count?.c).toBe(0);
    });

    it("returns 404 for unknown id", () => {
      const res = handleDeleteDataset(db, 999);
      expect(res.status).toBe(404);
    });
  });
});
