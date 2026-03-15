// Row types matching the SQLite schema exactly.
// All INTEGER booleans are 0/1/null as stored; API layer converts to boolean.

export type ContentType = "track" | "episode" | "audiobook" | "unknown";

export interface DatasetRow {
  id: number;
  name: string;
  description: string | null;
  created_at: string;
  source_path: string | null;
}

export interface PlayRow {
  id: number;
  dataset_id: number;
  ts: string;
  platform: string | null;
  ms_played: number;
  conn_country: string | null;
  ip_addr: string | null;
  content_type: ContentType;

  track_name: string | null;
  artist_name: string | null;
  album_name: string | null;
  spotify_track_uri: string | null;

  episode_name: string | null;
  episode_show_name: string | null;
  spotify_episode_uri: string | null;

  audiobook_title: string | null;
  audiobook_uri: string | null;
  audiobook_chapter_uri: string | null;
  audiobook_chapter_title: string | null;

  reason_start: string | null;
  reason_end: string | null;
  shuffle: number | null;
  skipped: number | null;
  offline: number | null;
  offline_timestamp: number | null;
  incognito_mode: number | null;
}

export interface MetadataOverrideRow {
  id: number;
  entity_type: string;
  entity_key: string;
  field: string;
  value: string | null;
  updated_at: string;
}
