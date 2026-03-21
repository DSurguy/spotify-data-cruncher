import type { Database } from "bun:sqlite";
import type { Track, GetTracksResponse, TrackDetail, GetTrackResponse } from "../types/api";

type TrackSort =
  | "name_asc"
  | "play_count_desc"
  | "play_count_asc"
  | "total_ms_desc"
  | "last_played_desc"
  | "first_played_asc"
  | "first_played_desc"
  | "skip_rate_desc"
  | "rating_desc"
  | "random";

const SORT_CLAUSES: Record<TrackSort, string> = {
  name_asc: "track_name ASC",
  play_count_desc: "play_count DESC",
  play_count_asc: "play_count ASC",
  total_ms_desc: "total_ms_played DESC",
  last_played_desc: "last_played DESC",
  first_played_asc: "first_played ASC",
  first_played_desc: "first_played DESC",
  skip_rate_desc: "skip_rate DESC",
  rating_desc: "rating DESC",
  random: "RANDOM()",
};

interface TrackRow {
  track_key: string;
  track_name: string;
  artist_name: string;
  album_name: string | null;
  play_count: number;
  total_ms_played: number;
  first_played: string;
  last_played: string;
  skipped_count: number;
  genre: string | null;
  rating: string | null;
  notes: string | null;
  reviewed_raw: string | null;
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
  const reviewedParam = p.get("reviewed"); // "true" | "false" | null
  const sort: TrackSort = (p.get("sort") as TrackSort) || "play_count_desc";
  const page = Math.max(1, parseInt(p.get("page") ?? "1", 10));
  const pageSize = Math.min(2000, Math.max(1, parseInt(p.get("page_size") ?? "50", 10)));

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
      MIN(p.ts) AS first_played,
      MAX(p.ts) AS last_played,
      SUM(CASE WHEN p.skipped = 1 THEN 1 ELSE 0 END) AS skipped_count,
      (SELECT o.value FROM metadata_overrides o
        WHERE o.entity_type = 'track'
          AND o.entity_key = (${trackKeySql})
          AND o.field = 'genre' LIMIT 1) AS genre,
      (SELECT o.value FROM metadata_overrides o
        WHERE o.entity_type = 'track'
          AND o.entity_key = (${trackKeySql})
          AND o.field = 'rating' LIMIT 1) AS rating,
      (SELECT o.value FROM metadata_overrides o
        WHERE o.entity_type = 'track'
          AND o.entity_key = (${trackKeySql})
          AND o.field = 'notes' LIMIT 1) AS notes,
      (SELECT o.value FROM metadata_overrides o
        WHERE o.entity_type = 'track'
          AND o.entity_key = (${trackKeySql})
          AND o.field = 'reviewed' LIMIT 1) AS reviewed_raw
    FROM plays p
    WHERE ${where}
    GROUP BY track_key
  `;

  // skip_rate computed after grouping
  const withSkipRate = `
    SELECT *, CAST(skipped_count AS REAL) / play_count * 100 AS skip_rate
    FROM (${baseQuery}) inner_q
  `;

  const reviewedFilter =
    reviewedParam === "true"  ? "WHERE reviewed_raw = 'true'" :
    reviewedParam === "false" ? "WHERE (reviewed_raw IS NULL OR reviewed_raw != 'true')" :
    "";
  const filteredQuery = `SELECT * FROM (${withSkipRate}) rq ${reviewedFilter}`;

  const sortClause = SORT_CLAUSES[sort];
  const offset = (page - 1) * pageSize;

  const countRow = db.query<{ n: number }, typeof params>(
    `SELECT COUNT(*) AS n FROM (${filteredQuery}) sub`
  ).get(...params);
  const total = countRow?.n ?? 0;

  const rows = db.query<TrackRow & { skip_rate: number }, typeof params>(
    `${filteredQuery} ORDER BY ${sortClause} LIMIT ${pageSize} OFFSET ${offset}`
  ).all(...params);

  const tracks: Track[] = rows.map(r => ({
    track_key: r.track_key,
    track_name: r.track_name,
    artist_name: r.artist_name,
    album_name: r.album_name,
    play_count: r.play_count,
    total_ms_played: r.total_ms_played,
    first_played: r.first_played,
    last_played: r.last_played,
    skip_rate: Math.round((r.skip_rate ?? 0) * 10) / 10,
    genre: parseOverrideValue(r.genre) as string | null,
    rating: parseOverrideValue(r.rating) as "like" | "dislike" | "none" | null,
    notes: parseOverrideValue(r.notes) as string | null,
    reviewed: r.reviewed_raw === "true",
  }));

  const body: GetTracksResponse = { tracks, total, page, page_size: pageSize };
  return Response.json(body);
}

export function handleGetTrack(db: Database, _req: Request, key: string): Response {
  const url = new URL(_req.url);
  const p = url.searchParams;
  const page = Math.max(1, parseInt(p.get("page") ?? "1", 10));
  const pageSize = Math.min(200, Math.max(1, parseInt(p.get("page_size") ?? "50", 10)));

  const keyFilter = `(${trackKeySql}) = ?`;

  interface TrackDetailRow {
    track_key: string;
    track_name: string;
    artist_name: string;
    album_name: string | null;
    play_count: number;
    total_ms_played: number;
    first_played: string;
    last_played: string;
    skipped_count: number;
    skip_rate: number;
    genre: string | null;
    rating: string | null;
    notes: string | null;
    reviewed_raw: string | null;
  }

  const trackRow = db.query<TrackDetailRow, [string]>(`
    SELECT
      (${trackKeySql}) AS track_key,
      p.track_name,
      p.artist_name,
      p.album_name,
      COUNT(*) AS play_count,
      SUM(p.ms_played) AS total_ms_played,
      MIN(p.ts) AS first_played,
      MAX(p.ts) AS last_played,
      SUM(CASE WHEN p.skipped = 1 THEN 1 ELSE 0 END) AS skipped_count,
      CAST(SUM(CASE WHEN p.skipped = 1 THEN 1 ELSE 0 END) AS REAL) / COUNT(*) * 100 AS skip_rate,
      (SELECT o.value FROM metadata_overrides o
        WHERE o.entity_type = 'track'
          AND o.entity_key = (${trackKeySql})
          AND o.field = 'genre' LIMIT 1) AS genre,
      (SELECT o.value FROM metadata_overrides o
        WHERE o.entity_type = 'track'
          AND o.entity_key = (${trackKeySql})
          AND o.field = 'rating' LIMIT 1) AS rating,
      (SELECT o.value FROM metadata_overrides o
        WHERE o.entity_type = 'track'
          AND o.entity_key = (${trackKeySql})
          AND o.field = 'notes' LIMIT 1) AS notes,
      (SELECT o.value FROM metadata_overrides o
        WHERE o.entity_type = 'track'
          AND o.entity_key = (${trackKeySql})
          AND o.field = 'reviewed' LIMIT 1) AS reviewed_raw
    FROM plays p
    WHERE p.content_type = 'track'
      AND ${keyFilter}
    GROUP BY track_key
  `).get(key);

  if (!trackRow) return new Response("not found", { status: 404 });

  interface AlbumRow {
    album_key: string;
    album_name: string | null;
    artist_name: string | null;
    play_count: number;
  }

  const albumRows = db.query<AlbumRow, [string]>(`
    SELECT
      lower(trim(COALESCE(p.album_name,''))) || '||' || lower(trim(COALESCE(p.artist_name,''))) AS album_key,
      p.album_name,
      p.artist_name,
      COUNT(*) AS play_count
    FROM plays p
    WHERE p.content_type = 'track'
      AND ${keyFilter}
    GROUP BY lower(trim(COALESCE(p.album_name,''))), lower(trim(COALESCE(p.artist_name,'')))
    ORDER BY play_count DESC
  `).all(key);

  interface PlayHistoryRow {
    ts: string;
    ms_played: number;
    skipped: number | null;
    platform: string | null;
    reason_start: string | null;
    reason_end: string | null;
    shuffle: number | null;
  }

  const totalPlaysRow = db.query<{ n: number }, [string]>(
    `SELECT COUNT(*) AS n FROM plays p WHERE p.content_type = 'track' AND ${keyFilter}`
  ).get(key);
  const totalPlays = totalPlaysRow?.n ?? 0;

  const offset = (page - 1) * pageSize;
  const playRows = db.query<PlayHistoryRow, [string]>(`
    SELECT ts, ms_played, skipped, platform, reason_start, reason_end, shuffle
    FROM plays p
    WHERE p.content_type = 'track'
      AND ${keyFilter}
    ORDER BY ts DESC
    LIMIT ${pageSize} OFFSET ${offset}
  `).all(key);

  const track: TrackDetail = {
    track_key: trackRow.track_key,
    track_name: trackRow.track_name,
    artist_name: trackRow.artist_name,
    album_name: trackRow.album_name,
    play_count: trackRow.play_count,
    total_ms_played: trackRow.total_ms_played,
    first_played: trackRow.first_played,
    last_played: trackRow.last_played,
    skip_rate: Math.round((trackRow.skip_rate ?? 0) * 10) / 10,
    skipped_count: trackRow.skipped_count,
    genre: parseOverrideValue(trackRow.genre) as string | null,
    rating: parseOverrideValue(trackRow.rating) as "like" | "dislike" | "none" | null,
    notes: parseOverrideValue(trackRow.notes) as string | null,
    reviewed: trackRow.reviewed_raw === "true",
  };

  const body: GetTrackResponse = {
    track,
    albums: albumRows.map(r => ({
      album_key: r.album_key,
      album_name: r.album_name ?? "",
      artist_name: r.artist_name ?? "",
      play_count: r.play_count,
    })),
    plays: {
      items: playRows.map(r => ({
        ts: r.ts,
        ms_played: r.ms_played,
        skipped: r.skipped === null ? null : r.skipped === 1,
        platform: r.platform,
        reason_start: r.reason_start,
        reason_end: r.reason_end,
        shuffle: r.shuffle === null ? null : r.shuffle === 1,
      })),
      total: totalPlays,
      page,
      page_size: pageSize,
    },
  };

  return Response.json(body);
}
