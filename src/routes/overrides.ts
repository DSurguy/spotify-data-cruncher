import type { Database } from "bun:sqlite";

interface OverrideInput {
  field: string;
  value: string | null;
}

const VALID_FIELDS: Record<string, string[]> = {
  track:   ["name", "artist", "album", "genre", "rating", "notes", "art_path"],
  album:   ["name", "artist", "genre", "rating", "notes", "art_path"],
  artist:  ["name", "genre", "notes"],
  episode: ["name", "notes", "rating"],
  show:    ["name", "genre", "notes"],
};

export function handleGetOverrides(db: Database, entityType: string, entityKey: string): Response {
  const validFields = VALID_FIELDS[entityType];
  if (!validFields) return new Response("unknown entity type", { status: 400 });

  const rows = db.query<{ field: string; value: string | null }, [string, string]>(
    `SELECT field, value FROM metadata_overrides WHERE entity_type = ? AND entity_key = ?`
  ).all(entityType, entityKey);

  const overrides: Record<string, unknown> = {};
  for (const row of rows) {
    try { overrides[row.field] = row.value !== null ? JSON.parse(row.value) : null; }
    catch { overrides[row.field] = row.value; }
  }

  return Response.json({ overrides });
}

export async function handlePutOverrides(
  db: Database,
  req: Request,
  entityType: string,
  entityKey: string,
): Promise<Response> {
  const validFields = VALID_FIELDS[entityType];
  if (!validFields) return new Response("unknown entity type", { status: 400 });

  let inputs: OverrideInput[];
  try { inputs = await req.json(); }
  catch { return new Response("Invalid JSON body", { status: 400 }); }

  if (!Array.isArray(inputs)) return new Response("body must be an array", { status: 400 });

  const upsert = db.prepare(`
    INSERT INTO metadata_overrides (entity_type, entity_key, field, value, updated_at)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(entity_type, entity_key, field)
    DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
  `);

  const del = db.prepare(
    `DELETE FROM metadata_overrides WHERE entity_type = ? AND entity_key = ? AND field = ?`
  );

  const now = new Date().toISOString();

  db.transaction(() => {
    for (const { field, value } of inputs) {
      if (!validFields.includes(field)) continue;
      if (value === null || value === undefined) {
        del.run(entityType, entityKey, field);
      } else {
        upsert.run(entityType, entityKey, field, value, now);
      }
    }
  })();

  return Response.json({ ok: true });
}

export function handleDeleteOverride(
  db: Database,
  entityType: string,
  entityKey: string,
  field: string,
): Response {
  const validFields = VALID_FIELDS[entityType];
  if (!validFields) return new Response("unknown entity type", { status: 400 });
  if (!validFields.includes(field)) return new Response("unknown field", { status: 400 });

  db.run(
    `DELETE FROM metadata_overrides WHERE entity_type = ? AND entity_key = ? AND field = ?`,
    [entityType, entityKey, field]
  );
  return Response.json({ ok: true });
}
