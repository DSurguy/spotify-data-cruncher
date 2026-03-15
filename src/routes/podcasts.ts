import type { Database } from "bun:sqlite";
import type { PodcastShow, GetPodcastsResponse } from "../types/api";

type PodcastSort =
  | "name_asc"
  | "name_desc"
  | "play_count_desc"
  | "total_ms_desc"
  | "last_played_desc";

const SORT_CLAUSES: Record<PodcastSort, string> = {
  name_asc: "show_name ASC",
  name_desc: "show_name DESC",
  play_count_desc: "play_count DESC",
  total_ms_desc: "total_ms_played DESC",
  last_played_desc: "last_played DESC",
};

interface ShowRow {
  show_key: string;
  show_name: string;
  episode_count: number;
  play_count: number;
  total_ms_played: number;
  first_played: string;
  last_played: string;
  genre: string | null;
  notes: string | null;
}

function parseOverrideValue(raw: string | null): string | number | null {
  if (raw === null) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

const showKeySql = `lower(trim(COALESCE(p.episode_show_name,'')))`;

export function handleGetPodcasts(db: Database, req: Request): Response {
  const url = new URL(req.url);
  const p = url.searchParams;

  const datasetId = p.get("dataset_id");
  const show = p.get("show");
  const from = p.get("from");
  const to = p.get("to");
  const sort: PodcastSort = (p.get("sort") as PodcastSort) || "total_ms_desc";
  const page = Math.max(1, parseInt(p.get("page") ?? "1", 10));
  const pageSize = Math.min(200, Math.max(1, parseInt(p.get("page_size") ?? "50", 10)));

  if (!SORT_CLAUSES[sort]) {
    return new Response("invalid sort value", { status: 400 });
  }

  const conditions: string[] = ["p.content_type = 'episode'"];
  const params: (string | number)[] = [];

  if (datasetId) { conditions.push("p.dataset_id = ?");         params.push(Number(datasetId)); }
  if (from)      { conditions.push("p.ts >= ?");                params.push(from); }
  if (to)        { conditions.push("p.ts <= ?");                params.push(to); }
  if (show)      { conditions.push("p.episode_show_name LIKE ?"); params.push(`%${show}%`); }

  const where = conditions.map(c => `(${c})`).join(" AND ");

  const baseQuery = `
    SELECT
      ${showKeySql} AS show_key,
      p.episode_show_name AS show_name,
      COUNT(DISTINCT COALESCE(p.spotify_episode_uri, lower(trim(COALESCE(p.episode_name,''))))) AS episode_count,
      COUNT(*) AS play_count,
      SUM(p.ms_played) AS total_ms_played,
      MIN(p.ts) AS first_played,
      MAX(p.ts) AS last_played,
      (SELECT o.value FROM metadata_overrides o
        WHERE o.entity_type = 'show'
          AND o.entity_key = ${showKeySql}
          AND o.field = 'genre' LIMIT 1) AS genre,
      (SELECT o.value FROM metadata_overrides o
        WHERE o.entity_type = 'show'
          AND o.entity_key = ${showKeySql}
          AND o.field = 'notes' LIMIT 1) AS notes
    FROM plays p
    WHERE ${where}
    GROUP BY show_key
  `;

  const sortClause = SORT_CLAUSES[sort];
  const offset = (page - 1) * pageSize;

  const countRow = db.query<{ n: number }, typeof params>(
    `SELECT COUNT(*) AS n FROM (${baseQuery}) sub`
  ).get(...params);
  const total = countRow?.n ?? 0;

  const rows = db.query<ShowRow, typeof params>(
    `${baseQuery} ORDER BY ${sortClause} LIMIT ${pageSize} OFFSET ${offset}`
  ).all(...params);

  const shows: PodcastShow[] = rows.map(r => ({
    show_key: r.show_key,
    show_name: r.show_name,
    episode_count: r.episode_count,
    play_count: r.play_count,
    total_ms_played: r.total_ms_played,
    first_played: r.first_played,
    last_played: r.last_played,
    genre: parseOverrideValue(r.genre) as string | null,
    notes: parseOverrideValue(r.notes) as string | null,
  }));

  const body: GetPodcastsResponse = { shows, total, page, page_size: pageSize };
  return Response.json(body);
}
