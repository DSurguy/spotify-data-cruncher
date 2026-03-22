// API request/response shapes used by both server routes and frontend fetch calls.

import type { ContentType } from "./db";

// --- Datasets ---

export interface Dataset {
  id: number;
  name: string;
  description: string | null;
  created_at: string;
  source_path: string | null;
}

export interface GetDatasetsResponse {
  datasets: Dataset[];
}

export interface CreateDatasetRequest {
  name: string;
  description?: string;
}

export interface UpdateDatasetRequest {
  name?: string;
  description?: string;
}

// --- Import ---

export type ImportStatus = "pending" | "running" | "done" | "error";

export interface ImportStatusResponse {
  status: ImportStatus;
  total_files: number;
  processed_files: number;
  total_records: number;
  inserted_records: number;
  error?: string;
}

// --- Plays ---

export interface Play {
  id: number;
  dataset_id: number;
  ts: string;
  platform: string | null;
  ms_played: number;
  content_type: ContentType;

  track_name: string | null;
  artist_name: string | null;
  album_name: string | null;
  spotify_track_uri: string | null;

  episode_name: string | null;
  episode_show_name: string | null;

  audiobook_title: string | null;

  reason_start: string | null;
  reason_end: string | null;
  shuffle: boolean | null;
  skipped: boolean | null;
  offline: boolean | null;
  incognito_mode: boolean | null;
}

export interface GetPlaysResponse {
  plays: Play[];
  total: number;
  page: number;
  page_size: number;
}

// --- Albums ---

export interface Album {
  album_slug: string;
  album_name: string;
  artist_name: string;
  artist_slug: string;
  play_count: number;
  total_ms_played: number;
  track_count: number;
  first_played: string;
  last_played: string;
  genre: string | null;
  rating: number | null;
  notes: string | null;
  art_url: string | null;
}

export interface GetAlbumsResponse {
  albums: Album[];
  total: number;
  page: number;
  page_size: number;
}

// --- Tracks ---

export interface Track {
  track_slug: string;
  track_name: string;
  artist_name: string;
  artist_slug: string;
  album_name: string | null;
  album_slug: string | null;
  play_count: number;
  total_ms_played: number;
  first_played: string;
  last_played: string;
  skip_rate: number;           // 0–100 (percentage)
  genre: string | null;
  rating: "like" | "dislike" | "none" | null;
  notes: string | null;
  reviewed: boolean;
}

export interface GetTracksResponse {
  tracks: Track[];
  total: number;
  page: number;
  page_size: number;
}

export interface TrackDetail {
  track_slug: string;
  track_name: string;
  artist_name: string;
  artist_slug: string;
  album_name: string | null;
  play_count: number;
  total_ms_played: number;
  first_played: string;
  last_played: string;
  skip_rate: number;
  skipped_count: number;
  genre: string | null;
  rating: "like" | "dislike" | "none" | null;
  notes: string | null;
  reviewed: boolean;
}

export interface TrackAlbumEntry {
  album_slug: string;
  album_name: string;
  artist_name: string;
  play_count: number;
}

export interface TrackPlayItem {
  ts: string;
  ms_played: number;
  skipped: boolean | null;
  platform: string | null;
  reason_start: string | null;
  reason_end: string | null;
  shuffle: boolean | null;
}

export interface GetTrackResponse {
  track: TrackDetail;
  albums: TrackAlbumEntry[];
  plays: {
    items: TrackPlayItem[];
    total: number;
    page: number;
    page_size: number;
  };
}

// --- Artists ---

export interface Artist {
  artist_slug: string;
  artist_name: string;
  play_count: number;
  total_ms_played: number;
  album_count: number;
  first_played: string;
  last_played: string;
  genre: string | null;
  rating: number | null;
  notes: string | null;
  reviewed: boolean;
}

export interface GetArtistsResponse {
  artists: Artist[];
  total: number;
  page: number;
  page_size: number;
}

// --- Podcasts ---

export interface PodcastShow {
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

export interface GetPodcastsResponse {
  shows: PodcastShow[];
  total: number;
  page: number;
  page_size: number;
}

// --- Metadata Overrides ---

export interface MetadataOverride {
  entity_type: string;
  entity_key: string;
  field: string;
  value: string | number | null;
  updated_at: string;
}

export interface SetOverridesRequest {
  overrides: Array<{ field: string; value: string | number | null }>;
}

// --- Update ---

export interface UpdateStatusResponse {
  current: string;
  latest: string | null;
  update_available: boolean;
  release_url: string | null;
  release_notes: string | null;
}
