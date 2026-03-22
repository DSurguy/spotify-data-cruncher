import type { Database } from "bun:sqlite";
import { readFileSync } from "fs";
import { unzipSync } from "fflate";
import type { ContentType } from "../types/db";
import { toSlug, SlugRegistry } from "../lib/slugs";

// Raw shape of one record from a Spotify streaming history JSON file
export interface SpotifyRecord {
  ts: string;
  platform?: string | null;
  ms_played?: number | null;
  conn_country?: string | null;
  ip_addr?: string | null;
  master_metadata_track_name?: string | null;
  master_metadata_album_artist_name?: string | null;
  master_metadata_album_album_name?: string | null;
  spotify_track_uri?: string | null;
  episode_name?: string | null;
  episode_show_name?: string | null;
  spotify_episode_uri?: string | null;
  audiobook_title?: string | null;
  audiobook_uri?: string | null;
  audiobook_chapter_uri?: string | null;
  audiobook_chapter_title?: string | null;
  reason_start?: string | null;
  reason_end?: string | null;
  shuffle?: boolean | null;
  skipped?: boolean | null;
  offline?: boolean | null;
  offline_timestamp?: number | null;
  incognito_mode?: boolean | null;
}

function detectContentType(record: SpotifyRecord): ContentType {
  if (record.spotify_track_uri) return "track";
  if (record.spotify_episode_uri) return "episode";
  if (record.audiobook_uri) return "audiobook";
  return "unknown";
}

function boolToInt(val: boolean | null | undefined): number | null {
  if (val === null || val === undefined) return null;
  return val ? 1 : 0;
}

export interface ImportResult {
  total_records: number;
  inserted_records: number;
}

export function importRecords(db: Database, datasetId: number, records: SpotifyRecord[]): ImportResult {
  // Build slug registries from existing data so new slugs don't collide
  const existingAlbumSlugs = db.query<{ slug: string; key: string }, []>(
    `SELECT DISTINCT album_slug AS slug,
      lower(trim(COALESCE(album_name,''))) || '||' || lower(trim(COALESCE(artist_name,''))) AS key
     FROM plays WHERE album_slug IS NOT NULL`
  ).all();
  const existingArtistSlugs = db.query<{ slug: string; key: string }, []>(
    `SELECT DISTINCT artist_slug AS slug, lower(trim(COALESCE(artist_name,''))) AS key
     FROM plays WHERE artist_slug IS NOT NULL`
  ).all();
  const existingTrackSlugs = db.query<{ slug: string; key: string }, []>(
    `SELECT DISTINCT track_slug AS slug, COALESCE(spotify_track_uri,
      lower(trim(COALESCE(track_name,''))) || '||' || lower(trim(COALESCE(artist_name,''))) || '||' || lower(trim(COALESCE(album_name,'')))
     ) AS key FROM plays WHERE track_slug IS NOT NULL`
  ).all();

  const albumRegistry = new SlugRegistry(existingAlbumSlugs);
  const artistRegistry = new SlugRegistry(existingArtistSlugs);
  const trackRegistry = new SlugRegistry(existingTrackSlugs);

  function albumSlug(albumName: string | null, artistName: string | null): string | null {
    if (!albumName) return null;
    const albumNorm = albumName.toLowerCase().trim();
    const artistNorm = (artistName ?? "").toLowerCase().trim();
    return albumRegistry.getOrAssign(`${albumNorm}||${artistNorm}`, toSlug(albumName));
  }

  function artistSlug(artistName: string | null): string | null {
    if (!artistName) return null;
    const norm = artistName.toLowerCase().trim();
    return artistRegistry.getOrAssign(norm, toSlug(artistName));
  }

  function trackSlug(record: SpotifyRecord): string | null {
    const uri = record.spotify_track_uri;
    const name = record.master_metadata_track_name;
    if (!uri && !name) return null;
    if (uri?.startsWith("spotify:track:")) {
      const id = uri.replace("spotify:track:", "").toLowerCase();
      trackRegistry.getOrAssign(uri, id); // register so dedup works
      return id;
    }
    if (!name) return null;
    const trackNorm = name.toLowerCase().trim();
    const artistNorm = (record.master_metadata_album_artist_name ?? "").toLowerCase().trim();
    const albumNorm = (record.master_metadata_album_album_name ?? "").toLowerCase().trim();
    return trackRegistry.getOrAssign(`${trackNorm}||${artistNorm}||${albumNorm}`, toSlug(name));
  }

  const insert = db.prepare(`
    INSERT INTO plays (
      dataset_id, ts, platform, ms_played, conn_country, ip_addr, content_type,
      track_name, artist_name, album_name, spotify_track_uri,
      episode_name, episode_show_name, spotify_episode_uri,
      audiobook_title, audiobook_uri, audiobook_chapter_uri, audiobook_chapter_title,
      reason_start, reason_end, shuffle, skipped, offline, offline_timestamp, incognito_mode,
      album_slug, artist_slug, track_slug
    ) VALUES (
      ?, ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?, ?, ?, ?, ?, ?,
      ?, ?, ?
    )
  `);

  let inserted = 0;

  const run = db.transaction(() => {
    for (const record of records) {
      if (!record.ts) continue; // skip malformed records without a timestamp

      const contentType = detectContentType(record);
      insert.run(
        datasetId,
        record.ts,
        record.platform ?? null,
        record.ms_played ?? 0,
        record.conn_country ?? null,
        record.ip_addr ?? null,
        contentType,
        record.master_metadata_track_name ?? null,
        record.master_metadata_album_artist_name ?? null,
        record.master_metadata_album_album_name ?? null,
        record.spotify_track_uri ?? null,
        record.episode_name ?? null,
        record.episode_show_name ?? null,
        record.spotify_episode_uri ?? null,
        record.audiobook_title ?? null,
        record.audiobook_uri ?? null,
        record.audiobook_chapter_uri ?? null,
        record.audiobook_chapter_title ?? null,
        record.reason_start ?? null,
        record.reason_end ?? null,
        boolToInt(record.shuffle),
        boolToInt(record.skipped),
        boolToInt(record.offline),
        record.offline_timestamp ?? null,
        boolToInt(record.incognito_mode),
        contentType === "track" ? albumSlug(record.master_metadata_album_album_name ?? null, record.master_metadata_album_artist_name ?? null) : null,
        contentType === "track" ? artistSlug(record.master_metadata_album_artist_name ?? null) : null,
        contentType === "track" ? trackSlug(record) : null,
      );
      inserted++;
    }
  });

  run();

  return { total_records: records.length, inserted_records: inserted };
}

export function importJsonFiles(
  db: Database,
  datasetId: number,
  filePaths: string[]
): ImportResult {
  let totalRecords = 0;
  let totalInserted = 0;

  for (const filePath of filePaths) {
    let records: SpotifyRecord[];
    try {
      records = JSON.parse(readFileSync(filePath, "utf8"));
    } catch {
      continue; // skip unparseable files
    }
    if (!Array.isArray(records)) continue;

    const result = importRecords(db, datasetId, records);
    totalRecords += result.total_records;
    totalInserted += result.inserted_records;
  }

  return { total_records: totalRecords, inserted_records: totalInserted };
}

export function importZip(
  db: Database,
  datasetId: number,
  zipBuffer: Uint8Array
): ImportResult {
  const files = unzipSync(zipBuffer);
  let totalRecords = 0;
  let totalInserted = 0;

  for (const [name, data] of Object.entries(files)) {
    const filename = name.split("/").pop() ?? name;
    if (!filename.startsWith("Streaming_History_") || !filename.endsWith(".json")) continue;

    let records: SpotifyRecord[];
    try {
      records = JSON.parse(new TextDecoder().decode(data));
    } catch {
      continue;
    }
    if (!Array.isArray(records)) continue;

    const result = importRecords(db, datasetId, records);
    totalRecords += result.total_records;
    totalInserted += result.inserted_records;
  }

  return { total_records: totalRecords, inserted_records: totalInserted };
}
