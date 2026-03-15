import type { Database } from "bun:sqlite";

export interface SummaryStats {
  total_plays: number;
  total_ms_played: number;
  unique_tracks: number;
  unique_albums: number;
  unique_artists: number;
  first_played: string | null;
  last_played: string | null;
}

export interface GetSummaryResponse {
  summary: SummaryStats;
}

export function handleGetSummary(db: Database, req: Request): Response {
  const url = new URL(req.url);
  const datasetId = url.searchParams.get("dataset_id");
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");

  const conditions: string[] = ["content_type = 'track'"];
  const params: (string | number)[] = [];

  if (datasetId) { conditions.push("dataset_id = ?"); params.push(Number(datasetId)); }
  if (from)      { conditions.push("ts >= ?");         params.push(from); }
  if (to)        { conditions.push("ts <= ?");         params.push(to); }

  const where = conditions.map(c => `(${c})`).join(" AND ");

  const row = db.query<{
    total_plays: number;
    total_ms_played: number;
    unique_tracks: number;
    unique_albums: number;
    unique_artists: number;
    first_played: string | null;
    last_played: string | null;
  }, typeof params>(`
    SELECT
      COUNT(*) AS total_plays,
      COALESCE(SUM(ms_played), 0) AS total_ms_played,
      COUNT(DISTINCT spotify_track_uri) AS unique_tracks,
      COUNT(DISTINCT lower(trim(COALESCE(album_name,''))) || '||' || lower(trim(COALESCE(artist_name,'')))) AS unique_albums,
      COUNT(DISTINCT lower(trim(COALESCE(artist_name,'')))) AS unique_artists,
      MIN(ts) AS first_played,
      MAX(ts) AS last_played
    FROM plays
    WHERE ${where}
  `).get(...params);

  const summary: SummaryStats = row ?? {
    total_plays: 0,
    total_ms_played: 0,
    unique_tracks: 0,
    unique_albums: 0,
    unique_artists: 0,
    first_played: null,
    last_played: null,
  };

  const body: GetSummaryResponse = { summary };
  return Response.json(body);
}
