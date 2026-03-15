import type { Database } from "bun:sqlite";
import { readdirSync, existsSync } from "fs";
import { join } from "path";
import type { DatasetRow } from "../types/db";
import type { ImportStatusResponse } from "../types/api";
import { importJsonFiles } from "./import";

function findJsonFiles(dir: string): string[] {
  return readdirSync(dir)
    .filter(f => f.startsWith("Streaming_History_") && f.endsWith(".json"))
    .map(f => join(dir, f));
}

export async function handleImport(db: Database, req: Request): Promise<Response> {
  let body: { name?: string; path?: string };
  try {
    body = await req.json();
  } catch {
    return new Response("Invalid JSON body", { status: 400 });
  }

  const sourcePath = body.path?.trim();
  if (!sourcePath) return new Response("path is required", { status: 400 });
  if (!existsSync(sourcePath)) return new Response("path does not exist", { status: 400 });

  const name = body.name?.trim() || `Import ${new Date().toLocaleDateString()}`;

  const files = findJsonFiles(sourcePath);
  if (files.length === 0) {
    return new Response("No Streaming_History_*.json files found at path", { status: 400 });
  }

  // Create the dataset
  db.run(`INSERT INTO datasets (name, created_at, source_path) VALUES (?, ?, ?)`, [
    name,
    new Date().toISOString(),
    sourcePath,
  ]);
  const datasetId = db.query<{ id: number }, []>(`SELECT last_insert_rowid() as id`).get()!.id;

  // Run the import synchronously
  const result = importJsonFiles(db, datasetId, files);

  const dataset = db.query<DatasetRow, [number]>(`SELECT * FROM datasets WHERE id = ?`).get(datasetId)!;
  const statusBody: ImportStatusResponse = {
    status: "done",
    total_files: files.length,
    processed_files: files.length,
    total_records: result.total_records,
    inserted_records: result.inserted_records,
  };

  return Response.json({ dataset, import: statusBody }, { status: 201 });
}
