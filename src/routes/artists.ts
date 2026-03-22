import type { Database } from "bun:sqlite";
import type { Artist, GetArtistsResponse } from "../types/api";

type ArtistSort =
  | "name_asc"
  | "name_desc"
  | "play_count_desc"
  | "total_ms_desc"
  | "last_played_desc"
  | "rating_desc";

const SORT_CLAUSES: Record<ArtistSort, string> = {
  name_asc: "artist_name ASC",
  name_desc: "artist_name DESC",
  play_count_desc: "play_count DESC",
  total_ms_desc: "total_ms_played DESC",
  last_played_desc: "last_played DESC",
  rating_desc: "COALESCE(rating, 0) DESC",
};

interface ArtistRow {
  artist_slug: string;
  artist_name: string;
  play_count: number;
  total_ms_played: number;
  album_count: number;
  first_played: string;
  last_played: string;
  rating: string | null;
  genre: string | null;
  notes: string | null;
  reviewed_raw: string | null;
}

function parseOverrideValue(raw: string | null): string | number | null {
  if (raw === null) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

export function handleGetArtists(db: Database, req: Request): Response {
  const url = new URL(req.url);
  const p = url.searchParams;

  const datasetId = p.get("dataset_id");
  const artist = p.get("artist");
  const from = p.get("from");
  const to = p.get("to");
  const ratedOnly = p.get("rated") === "true";
  const reviewedParam = p.get("reviewed"); // "true" | "false" | null
  const sort: ArtistSort = (p.get("sort") as ArtistSort) || "total_ms_desc";
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
  if (artist)    { conditions.push("p.artist_name LIKE ?");  params.push(`%${artist}%`); }

  const where = conditions.map(c => `(${c})`).join(" AND ");

  const baseQuery = `
    SELECT
      p.artist_slug,
      p.artist_name,
      COUNT(*) AS play_count,
      SUM(p.ms_played) AS total_ms_played,
      COUNT(DISTINCT p.album_slug) AS album_count,
      MIN(p.ts) AS first_played,
      MAX(p.ts) AS last_played,
      (SELECT o.value FROM metadata_overrides o
        WHERE o.entity_type = 'artist'
          AND o.entity_key = p.artist_slug
          AND o.field = 'rating' LIMIT 1) AS rating,
      (SELECT o.value FROM metadata_overrides o
        WHERE o.entity_type = 'artist'
          AND o.entity_key = p.artist_slug
          AND o.field = 'genre' LIMIT 1) AS genre,
      (SELECT o.value FROM metadata_overrides o
        WHERE o.entity_type = 'artist'
          AND o.entity_key = p.artist_slug
          AND o.field = 'notes' LIMIT 1) AS notes,
      (SELECT o.value FROM metadata_overrides o
        WHERE o.entity_type = 'artist'
          AND o.entity_key = p.artist_slug
          AND o.field = 'reviewed' LIMIT 1) AS reviewed_raw
    FROM plays p
    WHERE ${where} AND p.artist_slug IS NOT NULL
    GROUP BY p.artist_slug
  `;

  const havingClause = ratedOnly ? "HAVING rating IS NOT NULL" : "";
  const reviewedFilter =
    reviewedParam === "true"  ? "WHERE reviewed_raw = 'true'" :
    reviewedParam === "false" ? "WHERE (reviewed_raw IS NULL OR reviewed_raw != 'true')" :
    "";
  const filteredQuery = `SELECT * FROM (${baseQuery} ${havingClause}) rq ${reviewedFilter}`;
  const sortClause = SORT_CLAUSES[sort];
  const offset = (page - 1) * pageSize;

  const countRow = db.query<{ n: number }, typeof params>(
    `SELECT COUNT(*) AS n FROM (${filteredQuery}) sub`
  ).get(...params);
  const total = countRow?.n ?? 0;

  const rows = db.query<ArtistRow, typeof params>(
    `${filteredQuery} ORDER BY ${sortClause} LIMIT ${pageSize} OFFSET ${offset}`
  ).all(...params);

  const artists: Artist[] = rows.map(r => ({
    artist_slug: r.artist_slug,
    artist_name: r.artist_name,
    play_count: r.play_count,
    total_ms_played: r.total_ms_played,
    album_count: r.album_count,
    first_played: r.first_played,
    last_played: r.last_played,
    genre: parseOverrideValue(r.genre) as string | null,
    rating: parseOverrideValue(r.rating) as number | null,
    notes: parseOverrideValue(r.notes) as string | null,
    reviewed: r.reviewed_raw === "true",
  }));

  const body: GetArtistsResponse = { artists, total, page, page_size: pageSize };
  return Response.json(body);
}

export function handleGetArtist(db: Database, req: Request, slug: string): Response {
  const url = new URL(req.url);
  const datasetId = url.searchParams.get("dataset_id");

  const conditions: string[] = ["p.content_type = 'track'", "p.artist_slug = ?"];
  const params: (string | number)[] = [slug];

  if (datasetId) { conditions.push("p.dataset_id = ?"); params.push(Number(datasetId)); }

  const where = conditions.map(c => `(${c})`).join(" AND ");

  const getOverride = (field: string): string | null => {
    const row = db.query<{ value: string | null }, [string, string]>(
      `SELECT value FROM metadata_overrides WHERE entity_type = 'artist' AND entity_key = ? AND field = ?`
    ).get(slug, field);
    return row?.value ?? null;
  };

  const artistRow = db.query<{
    artist_name: string; play_count: number; total_ms_played: number;
    album_count: number; first_played: string; last_played: string;
  }, typeof params>(
    `SELECT p.artist_name,
      COUNT(*) AS play_count, SUM(p.ms_played) AS total_ms_played,
      COUNT(DISTINCT p.album_slug) AS album_count,
      MIN(p.ts) AS first_played, MAX(p.ts) AS last_played
    FROM plays p WHERE ${where} GROUP BY 1 LIMIT 1`
  ).get(...params);

  if (!artistRow) {
    return new Response("not found", { status: 404 });
  }

  const artist: Artist = {
    artist_slug: slug,
    artist_name: artistRow.artist_name,
    play_count: artistRow.play_count,
    total_ms_played: artistRow.total_ms_played,
    album_count: artistRow.album_count,
    first_played: artistRow.first_played,
    last_played: artistRow.last_played,
    genre: parseOverrideValue(getOverride("genre")) as string | null,
    rating: parseOverrideValue(getOverride("rating")) as number | null,
    notes: parseOverrideValue(getOverride("notes")) as string | null,
    reviewed: getOverride("reviewed") === "true",
  };

  return Response.json(artist);
}
