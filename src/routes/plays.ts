import type { Database } from "bun:sqlite";
import type { Play, GetPlaysResponse } from "../types/api";

type PlaySort = "ts_asc" | "ts_desc" | "ms_played_desc";

const SORT_CLAUSES: Record<PlaySort, string> = {
  ts_asc: "ts ASC",
  ts_desc: "ts DESC",
  ms_played_desc: "ms_played DESC",
};

interface PlayRow {
  id: number;
  dataset_id: number;
  ts: string;
  platform: string | null;
  ms_played: number;
  content_type: string;
  track_name: string | null;
  artist_name: string | null;
  album_name: string | null;
  spotify_track_uri: string | null;
  episode_name: string | null;
  episode_show_name: string | null;
  audiobook_title: string | null;
  reason_start: string | null;
  reason_end: string | null;
  shuffle: number | null;
  skipped: number | null;
  offline: number | null;
  incognito_mode: number | null;
}

function rowToPlay(r: PlayRow): Play {
  return {
    id: r.id,
    dataset_id: r.dataset_id,
    ts: r.ts,
    platform: r.platform,
    ms_played: r.ms_played,
    content_type: r.content_type as Play["content_type"],
    track_name: r.track_name,
    artist_name: r.artist_name,
    album_name: r.album_name,
    spotify_track_uri: r.spotify_track_uri,
    episode_name: r.episode_name,
    episode_show_name: r.episode_show_name,
    audiobook_title: r.audiobook_title,
    reason_start: r.reason_start,
    reason_end: r.reason_end,
    shuffle: r.shuffle === null ? null : r.shuffle === 1,
    skipped: r.skipped === null ? null : r.skipped === 1,
    offline: r.offline === null ? null : r.offline === 1,
    incognito_mode: r.incognito_mode === null ? null : r.incognito_mode === 1,
  };
}

export function handleGetPlays(db: Database, req: Request): Response {
  const url = new URL(req.url);
  const p = url.searchParams;

  const datasetId = p.get("dataset_id");
  const contentType = p.get("content_type");
  const from = p.get("from");
  const to = p.get("to");
  const artist = p.get("artist");
  const album = p.get("album");
  const track = p.get("track");
  const skipped = p.get("skipped");
  const minMs = p.get("min_ms");
  const shuffle = p.get("shuffle");
  const sort: PlaySort = (p.get("sort") as PlaySort) || "ts_desc";
  const page = Math.max(1, parseInt(p.get("page") ?? "1", 10));
  const pageSize = Math.min(500, Math.max(1, parseInt(p.get("page_size") ?? "100", 10)));

  if (!SORT_CLAUSES[sort]) {
    return new Response("invalid sort value", { status: 400 });
  }

  const conditions: string[] = [];
  const params: (string | number)[] = [];

  if (datasetId)          { conditions.push("dataset_id = ?");       params.push(Number(datasetId)); }
  if (contentType)        { conditions.push("content_type = ?");     params.push(contentType); }
  if (from)               { conditions.push("ts >= ?");              params.push(from); }
  if (to)                 { conditions.push("ts <= ?");              params.push(to); }
  if (artist)             { conditions.push("artist_name LIKE ?");   params.push(`%${artist}%`); }
  if (album)              { conditions.push("album_name LIKE ?");    params.push(`%${album}%`); }
  if (track)              { conditions.push("track_name LIKE ?");    params.push(`%${track}%`); }
  if (skipped === "true") { conditions.push("skipped = 1"); }
  if (skipped === "false"){ conditions.push("(skipped = 0 OR skipped IS NULL)"); }
  if (shuffle === "true") { conditions.push("shuffle = 1"); }
  if (shuffle === "false"){ conditions.push("(shuffle = 0 OR shuffle IS NULL)"); }
  if (minMs)              { conditions.push("ms_played >= ?");       params.push(Number(minMs)); }

  const where = conditions.length > 0
    ? "WHERE " + conditions.map(c => `(${c})`).join(" AND ")
    : "";

  const sortClause = SORT_CLAUSES[sort];
  const offset = (page - 1) * pageSize;

  const countRow = db.query<{ n: number }, typeof params>(
    `SELECT COUNT(*) AS n FROM plays ${where}`
  ).get(...params);
  const total = countRow?.n ?? 0;

  const rows = db.query<PlayRow, typeof params>(
    `SELECT id, dataset_id, ts, platform, ms_played, content_type,
            track_name, artist_name, album_name, spotify_track_uri,
            episode_name, episode_show_name,
            audiobook_title,
            reason_start, reason_end,
            shuffle, skipped, offline, incognito_mode
     FROM plays ${where}
     ORDER BY ${sortClause}
     LIMIT ${pageSize} OFFSET ${offset}`
  ).all(...params);

  const body: GetPlaysResponse = {
    plays: rows.map(rowToPlay),
    total,
    page,
    page_size: pageSize,
  };

  return Response.json(body);
}
