import type { Database } from "bun:sqlite";
import type { ContentType } from "../types/db";

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
  const insert = db.prepare(`
    INSERT INTO plays (
      dataset_id, ts, platform, ms_played, conn_country, ip_addr, content_type,
      track_name, artist_name, album_name, spotify_track_uri,
      episode_name, episode_show_name, spotify_episode_uri,
      audiobook_title, audiobook_uri, audiobook_chapter_uri, audiobook_chapter_title,
      reason_start, reason_end, shuffle, skipped, offline, offline_timestamp, incognito_mode
    ) VALUES (
      ?, ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?, ?, ?, ?, ?, ?
    )
  `);

  let inserted = 0;

  const run = db.transaction(() => {
    for (const record of records) {
      if (!record.ts) continue; // skip malformed records without a timestamp

      insert.run(
        datasetId,
        record.ts,
        record.platform ?? null,
        record.ms_played ?? 0,
        record.conn_country ?? null,
        record.ip_addr ?? null,
        detectContentType(record),
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
        boolToInt(record.incognito_mode)
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
    const text = Bun.file(filePath).text();
    let records: SpotifyRecord[];
    try {
      records = JSON.parse(text as unknown as string);
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
