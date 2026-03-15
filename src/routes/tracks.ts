import type { Database } from "bun:sqlite";
import type { Track, GetTracksResponse } from "../types/api";

type TrackSort =
  | "name_asc"
  | "play_count_desc"
  | "total_ms_desc"
  | "last_played_desc"
  | "skip_rate_desc"
  | "rating_desc";

const SORT_CLAUSES: Record<TrackSort, string> = {
  name_asc: "track_name ASC",
  play_count_desc: "play_count DESC",
  total_ms_desc: "total_ms_played DESC",
  last_played_desc: "last_played DESC",
  skip_rate_desc: "skip_rate DESC",
  rating_desc: "COALESCE(rating, 0) DESC",
};

interface TrackRow {
  track_key: string;
  track_name: string;
  artist_name: string;
  album_name: string | null;
  play_count: number;
  total_ms_played: number;
  last_played: string;
  skipped_count: number;
  rating: string | null;
  notes: string | null;
}

function parseOverrideValue(raw: string | null): string | number | null {
  if (raw === null) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

// Track key: URI when available, else normalized name||artist||album
const trackKeySql = `
  CASE
    WHEN p.spotify_track_uri IS NOT NULL THEN p.spotify_track_uri
    ELSE lower(trim(COALESCE(p.track_name,''))) || '||' || lower(trim(COALESCE(p.artist_name,''))) || '||' || lower(trim(COALESCE(p.album_name,'')))
  END
`;

export function handleGetTracks(db: Database, req: Request): Response {
  const url = new URL(req.url);
  const p = url.searchParams;

  const datasetId = p.get("dataset_id");
  const track = p.get("track");
  const artist = p.get("artist");
  const album = p.get("album");
  const from = p.get("from");
  const to = p.get("to");
  const sort: TrackSort = (p.get("sort") as TrackSort) || "play_count_desc";
  const page = Math.max(1, parseInt(p.get("page") ?? "1", 10));
  const pageSize = Math.min(200, Math.max(1, parseInt(p.get("page_size") ?? "50", 10)));

  if (!SORT_CLAUSES[sort]) {
    return new Response("invalid sort value", { status: 400 });
  }

  const conditions: string[] = ["p.content_type = 'track'"];
  const params: (string | number)[] = [];

  if (datasetId) { conditions.push("p.dataset_id = ?");      params.push(Number(datasetId)); }
  if (from)      { conditions.push("p.ts >= ?");             params.push(from); }
  if (to)        { conditions.push("p.ts <= ?");             params.push(to); }
  if (track)     { conditions.push("p.track_name LIKE ?");   params.push(`%${track}%`); }
  if (artist)    { conditions.push("p.artist_name LIKE ?");  params.push(`%${artist}%`); }
  if (album)     { conditions.push("p.album_name LIKE ?");   params.push(`%${album}%`); }

  const where = conditions.map(c => `(${c})`).join(" AND ");

  const baseQuery = `
    SELECT
      (${trackKeySql}) AS track_key,
      p.track_name,
      p.artist_name,
      p.album_name,
      COUNT(*) AS play_count,
      SUM(p.ms_played) AS total_ms_played,
      MAX(p.ts) AS last_played,
      SUM(CASE WHEN p.skipped = 1 THEN 1 ELSE 0 END) AS skipped_count,
      (SELECT o.value FROM metadata_overrides o
        WHERE o.entity_type = 'track'
          AND o.entity_key = (${trackKeySql})
          AND o.field = 'rating' LIMIT 1) AS rating,
      (SELECT o.value FROM metadata_overrides o
        WHERE o.entity_type = 'track'
          AND o.entity_key = (${trackKeySql})
          AND o.field = 'notes' LIMIT 1) AS notes
    FROM plays p
    WHERE ${where}
    GROUP BY track_key
  `;

  // skip_rate computed after grouping
  const withSkipRate = `
    SELECT *, CAST(skipped_count AS REAL) / play_count * 100 AS skip_rate
    FROM (${baseQuery}) inner_q
  `;

  const sortClause = SORT_CLAUSES[sort];
  const offset = (page - 1) * pageSize;

  const countRow = db.query<{ n: number }, typeof params>(
    `SELECT COUNT(*) AS n FROM (${withSkipRate}) sub`
  ).get(...params);
  const total = countRow?.n ?? 0;

  const rows = db.query<TrackRow & { skip_rate: number }, typeof params>(
    `${withSkipRate} ORDER BY ${sortClause} LIMIT ${pageSize} OFFSET ${offset}`
  ).all(...params);

  const tracks: Track[] = rows.map(r => ({
    track_key: r.track_key,
    track_name: r.track_name,
    artist_name: r.artist_name,
    album_name: r.album_name,
    play_count: r.play_count,
    total_ms_played: r.total_ms_played,
    last_played: r.last_played,
    skip_rate: Math.round((r.skip_rate ?? 0) * 10) / 10,
    rating: parseOverrideValue(r.rating) as number | null,
    notes: parseOverrideValue(r.notes) as string | null,
  }));

  const body: GetTracksResponse = { tracks, total, page, page_size: pageSize };
  return Response.json(body);
}
