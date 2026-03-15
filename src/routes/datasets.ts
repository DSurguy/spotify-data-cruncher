import type { Database } from "bun:sqlite";
import type { DatasetRow } from "../types/db";
import type {
  GetDatasetsResponse,
  Dataset,
  UpdateDatasetRequest,
} from "../types/api";

function rowToDataset(row: DatasetRow): Dataset {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    created_at: row.created_at,
    source_path: row.source_path,
  };
}

export function handleGetDatasets(db: Database): Response {
  const rows = db.query<DatasetRow, []>(`SELECT * FROM datasets ORDER BY created_at DESC`).all();
  const body: GetDatasetsResponse = { datasets: rows.map(rowToDataset) };
  return Response.json(body);
}

export function handleGetDataset(db: Database, id: number): Response {
  const row = db.query<DatasetRow, [number]>(`SELECT * FROM datasets WHERE id = ?`).get(id);
  if (!row) return new Response("Not found", { status: 404 });
  return Response.json(rowToDataset(row));
}

export function handlePatchDataset(db: Database, id: number, body: UpdateDatasetRequest): Response {
  const existing = db.query<DatasetRow, [number]>(`SELECT * FROM datasets WHERE id = ?`).get(id);
  if (!existing) return new Response("Not found", { status: 404 });

  if (body.name !== undefined) {
    const trimmed = body.name.trim();
    if (!trimmed) return new Response("name must not be empty", { status: 400 });
  }

  db.run(`UPDATE datasets SET name = COALESCE(?, name), description = COALESCE(?, description) WHERE id = ?`, [
    body.name?.trim() ?? null,
    body.description ?? null,
    id,
  ]);

  const updated = db.query<DatasetRow, [number]>(`SELECT * FROM datasets WHERE id = ?`).get(id)!;
  return Response.json(rowToDataset(updated));
}

export function handleDeleteDataset(db: Database, id: number): Response {
  const existing = db.query<DatasetRow, [number]>(`SELECT * FROM datasets WHERE id = ?`).get(id);
  if (!existing) return new Response("Not found", { status: 404 });
  db.run(`DELETE FROM datasets WHERE id = ?`, [id]);
  return new Response(null, { status: 204 });
}
