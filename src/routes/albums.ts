import type { Database } from "bun:sqlite";
import type { Album, GetAlbumsResponse } from "../types/api";

type AlbumSort =
  | "name_asc"
  | "name_desc"
  | "play_count_desc"
  | "total_ms_desc"
  | "last_played_desc"
  | "artist_asc"
  | "rating_desc";

const SORT_CLAUSES: Record<AlbumSort, string> = {
  name_asc: "album_name ASC",
  name_desc: "album_name DESC",
  play_count_desc: "play_count DESC",
  total_ms_desc: "total_ms_played DESC",
  last_played_desc: "last_played DESC",
  artist_asc: "artist_name ASC",
  rating_desc: "COALESCE(rating, 0) DESC",
};

interface AlbumRow {
  album_key: string;
  album_name: string;
  artist_name: string;
  play_count: number;
  total_ms_played: number;
  track_count: number;
  first_played: string;
  last_played: string;
  rating: string | null;   // JSON-encoded from overrides
  genre: string | null;
  notes: string | null;
}

function parseOverrideValue(raw: string | null): string | number | null {
  if (raw === null) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

export function handleGetAlbums(db: Database, req: Request): Response {
  const url = new URL(req.url);
  const p = url.searchParams;

  const datasetId = p.get("dataset_id");
  const artist = p.get("artist");
  const album = p.get("album");
  const from = p.get("from");
  const to = p.get("to");
  const ratedOnly = p.get("rated") === "true";
  const sort: AlbumSort = (p.get("sort") as AlbumSort) || "total_ms_desc";
  const page = Math.max(1, parseInt(p.get("page") ?? "1", 10));
  const pageSize = Math.min(200, Math.max(1, parseInt(p.get("page_size") ?? "50", 10)));

  if (!SORT_CLAUSES[sort]) {
    return new Response("invalid sort value", { status: 400 });
  }

  const conditions: string[] = ["p.content_type = 'track'"];
  const params: (string | number)[] = [];

  if (datasetId) { conditions.push("p.dataset_id = ?"); params.push(Number(datasetId)); }
  if (from)      { conditions.push("p.ts >= ?");         params.push(from); }
  if (to)        { conditions.push("p.ts <= ?");         params.push(to); }
  if (artist)    { conditions.push("p.artist_name LIKE ?"); params.push(`%${artist}%`); }
  if (album)     { conditions.push("p.album_name LIKE ?");  params.push(`%${album}%`); }

  const where = conditions.map(c => `(${c})`).join(" AND ");

  // album_key: URI preferred for tracks with URIs, otherwise normalized name+artist
  const albumKeySql = `
    CASE
      WHEN p.spotify_track_uri IS NOT NULL
        THEN lower(trim(COALESCE(p.album_name,''))) || '||' || lower(trim(COALESCE(p.artist_name,'')))
      ELSE lower(trim(COALESCE(p.album_name,''))) || '||' || lower(trim(COALESCE(p.artist_name,'')))
    END
  `;

  const baseQuery = `
    SELECT
      ${albumKeySql} AS album_key,
      p.album_name,
      p.artist_name,
      COUNT(*) AS play_count,
      SUM(p.ms_played) AS total_ms_played,
      COUNT(DISTINCT p.spotify_track_uri) AS track_count,
      MIN(p.ts) AS first_played,
      MAX(p.ts) AS last_played,
      (SELECT o.value FROM metadata_overrides o
        WHERE o.entity_type = 'album'
          AND o.entity_key = ${albumKeySql}
          AND o.field = 'rating' LIMIT 1) AS rating,
      (SELECT o.value FROM metadata_overrides o
        WHERE o.entity_type = 'album'
          AND o.entity_key = ${albumKeySql}
          AND o.field = 'genre' LIMIT 1) AS genre,
      (SELECT o.value FROM metadata_overrides o
        WHERE o.entity_type = 'album'
          AND o.entity_key = ${albumKeySql}
          AND o.field = 'notes' LIMIT 1) AS notes
    FROM plays p
    WHERE ${where}
    GROUP BY album_key
  `;

  const havingClause = ratedOnly ? "HAVING rating IS NOT NULL" : "";
  const sortClause = SORT_CLAUSES[sort];
  const offset = (page - 1) * pageSize;

  const countRow = db.query<{ n: number }, typeof params>(
    `SELECT COUNT(*) AS n FROM (${baseQuery} ${havingClause}) sub`
  ).get(...params);
  const total = countRow?.n ?? 0;

  const rows = db.query<AlbumRow, typeof params>(
    `${baseQuery} ${havingClause} ORDER BY ${sortClause} LIMIT ${pageSize} OFFSET ${offset}`
  ).all(...params);

  const albums: Album[] = rows.map(r => ({
    album_key: r.album_key,
    album_name: r.album_name,
    artist_name: r.artist_name,
    play_count: r.play_count,
    total_ms_played: r.total_ms_played,
    track_count: r.track_count,
    first_played: r.first_played,
    last_played: r.last_played,
    genre: parseOverrideValue(r.genre) as string | null,
    rating: parseOverrideValue(r.rating) as number | null,
    notes: parseOverrideValue(r.notes) as string | null,
    art_url: null, // album art served separately via /api/art
  }));

  const body: GetAlbumsResponse = { albums, total, page, page_size: pageSize };
  return Response.json(body);
}

export function handleGetAlbum(db: Database, req: Request, key: string): Response {
  const url = new URL(req.url);
  const datasetId = url.searchParams.get("dataset_id");

  const conditions: string[] = ["p.content_type = 'track'", `(lower(trim(COALESCE(p.album_name,''))) || '||' || lower(trim(COALESCE(p.artist_name,'')))) = ?`];
  const params: (string | number)[] = [key];

  if (datasetId) { conditions.push("p.dataset_id = ?"); params.push(Number(datasetId)); }

  const where = conditions.map(c => `(${c})`).join(" AND ");

  const overrideRow = (field: string) => db.query<{ value: string | null }, [string, string, string]>(
    `SELECT value FROM metadata_overrides WHERE entity_type = 'album' AND entity_key = ? AND field = ? LIMIT 1`
  ).get(key, field, field);  // intentional: third param unused, bun needs exact arity

  const getOverride = (field: string): string | null => {
    const row = db.query<{ value: string | null }, [string, string]>(
      `SELECT value FROM metadata_overrides WHERE entity_type = 'album' AND entity_key = ? AND field = ?`
    ).get(key, field);
    return row?.value ?? null;
  };

  const albumRow = db.query<{
    album_name: string; artist_name: string; play_count: number;
    total_ms_played: number; track_count: number; first_played: string; last_played: string;
  }, typeof params>(
    `SELECT p.album_name, p.artist_name,
      COUNT(*) AS play_count, SUM(p.ms_played) AS total_ms_played,
      COUNT(DISTINCT p.spotify_track_uri) AS track_count,
      MIN(p.ts) AS first_played, MAX(p.ts) AS last_played
    FROM plays p WHERE ${where} GROUP BY 1, 2 LIMIT 1`
  ).get(...params);

  if (!albumRow) return new Response("album not found", { status: 404 });

  const album: Album = {
    album_key: key,
    album_name: albumRow.album_name,
    artist_name: albumRow.artist_name,
    play_count: albumRow.play_count,
    total_ms_played: albumRow.total_ms_played,
    track_count: albumRow.track_count,
    first_played: albumRow.first_played,
    last_played: albumRow.last_played,
    genre: parseOverrideValue(getOverride("genre")) as string | null,
    rating: parseOverrideValue(getOverride("rating")) as number | null,
    notes: parseOverrideValue(getOverride("notes")) as string | null,
    art_url: null,
  };

  return Response.json({ album });
}
