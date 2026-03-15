import type { Database } from "bun:sqlite";

export type TimelineGranularity = "week" | "month" | "year";

export interface TimelinePoint {
  period: string;
  total_ms_played: number;
}

export interface GetTimelineResponse {
  points: TimelinePoint[];
  granularity: TimelineGranularity;
}

export interface TopTrack {
  track_key: string;
  track_name: string;
  artist_name: string;
  album_name: string | null;
  play_count: number;
  total_ms_played: number;
}

export interface GetTopTracksResponse {
  tracks: TopTrack[];
}

export interface TopAlbum {
  album_key: string;
  album_name: string;
  artist_name: string;
  play_count: number;
  total_ms_played: number;
}

export interface GetTopAlbumsResponse {
  albums: TopAlbum[];
}

export interface TopArtist {
  artist_key: string;
  artist_name: string;
  play_count: number;
  total_ms_played: number;
}

export interface GetTopArtistsResponse {
  artists: TopArtist[];
}

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

function buildTrackFilters(p: URLSearchParams): { conditions: string[]; params: (string | number)[] } {
  const conditions: string[] = ["content_type = 'track'"];
  const params: (string | number)[] = [];
  const datasetId = p.get("dataset_id");
  const from = p.get("from");
  const to = p.get("to");
  if (datasetId) { conditions.push("dataset_id = ?"); params.push(Number(datasetId)); }
  if (from)      { conditions.push("ts >= ?");         params.push(from); }
  if (to)        { conditions.push("ts <= ?");         params.push(to); }
  return { conditions, params };
}

export function handleGetTopTracks(db: Database, req: Request): Response {
  const url = new URL(req.url);
  const { conditions, params } = buildTrackFilters(url.searchParams);
  const limit = Math.min(25, Math.max(1, parseInt(url.searchParams.get("limit") ?? "10", 10)));
  const where = conditions.map(c => `(${c})`).join(" AND ");

  const rows = db.query<{
    track_key: string; track_name: string; artist_name: string;
    album_name: string | null; play_count: number; total_ms_played: number;
  }, typeof params>(`
    SELECT
      COALESCE(spotify_track_uri,
        lower(trim(COALESCE(track_name,''))) || '||' ||
        lower(trim(COALESCE(artist_name,''))) || '||' ||
        lower(trim(COALESCE(album_name,'')))) AS track_key,
      track_name,
      artist_name,
      album_name,
      COUNT(*) AS play_count,
      SUM(ms_played) AS total_ms_played
    FROM plays
    WHERE ${where}
    GROUP BY track_key
    ORDER BY play_count DESC
    LIMIT ${limit}
  `).all(...params);

  const body: GetTopTracksResponse = { tracks: rows };
  return Response.json(body);
}

export function handleGetTopAlbums(db: Database, req: Request): Response {
  const url = new URL(req.url);
  const { conditions, params } = buildTrackFilters(url.searchParams);
  const limit = Math.min(25, Math.max(1, parseInt(url.searchParams.get("limit") ?? "10", 10)));
  const where = conditions.map(c => `(${c})`).join(" AND ");

  const rows = db.query<{
    album_key: string; album_name: string; artist_name: string;
    play_count: number; total_ms_played: number;
  }, typeof params>(`
    SELECT
      lower(trim(COALESCE(album_name,''))) || '||' || lower(trim(COALESCE(artist_name,''))) AS album_key,
      album_name,
      artist_name,
      COUNT(*) AS play_count,
      SUM(ms_played) AS total_ms_played
    FROM plays
    WHERE ${where}
    GROUP BY album_key
    ORDER BY total_ms_played DESC
    LIMIT ${limit}
  `).all(...params);

  const body: GetTopAlbumsResponse = { albums: rows };
  return Response.json(body);
}

export function handleGetTopArtists(db: Database, req: Request): Response {
  const url = new URL(req.url);
  const { conditions, params } = buildTrackFilters(url.searchParams);
  const limit = Math.min(25, Math.max(1, parseInt(url.searchParams.get("limit") ?? "10", 10)));
  const where = conditions.map(c => `(${c})`).join(" AND ");

  const rows = db.query<{
    artist_key: string; artist_name: string;
    play_count: number; total_ms_played: number;
  }, typeof params>(`
    SELECT
      lower(trim(COALESCE(artist_name,''))) AS artist_key,
      artist_name,
      COUNT(*) AS play_count,
      SUM(ms_played) AS total_ms_played
    FROM plays
    WHERE ${where}
    GROUP BY artist_key
    ORDER BY total_ms_played DESC
    LIMIT ${limit}
  `).all(...params);

  const body: GetTopArtistsResponse = { artists: rows };
  return Response.json(body);
}

const GRANULARITY_FORMATS: Record<TimelineGranularity, string> = {
  week: "%Y-W%W",
  month: "%Y-%m",
  year: "%Y",
};

export function handleGetTimeline(db: Database, req: Request): Response {
  const url = new URL(req.url);
  const p = url.searchParams;

  const granularity = (p.get("granularity") ?? "month") as TimelineGranularity;
  if (!GRANULARITY_FORMATS[granularity]) {
    return new Response("invalid granularity, use: week, month, year", { status: 400 });
  }

  const conditions: string[] = ["content_type = 'track'"];
  const params: (string | number)[] = [];

  const datasetId = p.get("dataset_id");
  const from = p.get("from");
  const to = p.get("to");
  const year = p.get("year");

  if (datasetId) { conditions.push("dataset_id = ?");              params.push(Number(datasetId)); }
  if (from)      { conditions.push("ts >= ?");                     params.push(from); }
  if (to)        { conditions.push("ts <= ?");                     params.push(to); }
  if (year)      { conditions.push("strftime('%Y', ts) = ?");      params.push(year); }

  const where = conditions.map(c => `(${c})`).join(" AND ");
  const fmt = GRANULARITY_FORMATS[granularity];

  const rows = db.query<TimelinePoint, typeof params>(`
    SELECT strftime('${fmt}', ts) AS period, SUM(ms_played) AS total_ms_played
    FROM plays
    WHERE ${where}
    GROUP BY period
    ORDER BY period ASC
  `).all(...params);

  const body: GetTimelineResponse = { points: rows, granularity };
  return Response.json(body);
}

