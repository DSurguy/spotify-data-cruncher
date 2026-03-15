import type { Database } from "bun:sqlite";
import type { DatasetRow } from "../types/db";
import type { ImportStatusResponse } from "../types/api";
import { importZip } from "./import";

export async function handleImport(db: Database, req: Request): Promise<Response> {
  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return new Response("Expected multipart form data", { status: 400 });
  }

  const file = formData.get("file");
  if (!(file instanceof File)) return new Response("file is required", { status: 400 });
  if (!file.name.endsWith(".zip")) return new Response("file must be a .zip", { status: 400 });

  const nameField = formData.get("name");
  const name = (typeof nameField === "string" && nameField.trim())
    ? nameField.trim()
    : `Import ${new Date().toLocaleDateString()}`;

  const zipBuffer = new Uint8Array(await file.arrayBuffer());

  let result;
  try {
    db.run(`INSERT INTO datasets (name, created_at, source_path) VALUES (?, ?, ?)`, [
      name,
      new Date().toISOString(),
      file.name,
    ]);
    const datasetId = db.query<{ id: number }, []>(`SELECT last_insert_rowid() as id`).get()!.id;
    result = importZip(db, datasetId, zipBuffer);
    const dataset = db.query<DatasetRow, [number]>(`SELECT * FROM datasets WHERE id = ?`).get(datasetId)!;
    const statusBody: ImportStatusResponse = {
      status: "done",
      total_files: 1,
      processed_files: 1,
      total_records: result.total_records,
      inserted_records: result.inserted_records,
    };
    return Response.json({ dataset, import: statusBody }, { status: 201 });
  } catch (err) {
    return new Response("Failed to extract zip: " + String(err), { status: 400 });
  }
}
