import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { Database } from "bun:sqlite";
import { runMigrations } from "../db/migrations";
import { importRecords, type SpotifyRecord } from "./import";

function makeDataset(db: Database, name = "Test"): number {
  db.run(`INSERT INTO datasets (name, created_at) VALUES (?, ?)`, [name, new Date().toISOString()]);
  return db.query<{ id: number }, []>(`SELECT last_insert_rowid() as id`).get()!.id;
}

const trackRecord: SpotifyRecord = {
  ts: "2024-03-01T12:00:00Z",
  platform: "android",
  ms_played: 180000,
  conn_country: "US",
  ip_addr: "1.2.3.4",
  master_metadata_track_name: "Song A",
  master_metadata_album_artist_name: "Artist X",
  master_metadata_album_album_name: "Album Y",
  spotify_track_uri: "spotify:track:abc123",
  reason_start: "trackdone",
  reason_end: "trackdone",
  shuffle: false,
  skipped: false,
  offline: false,
  incognito_mode: false,
};

const episodeRecord: SpotifyRecord = {
  ts: "2024-03-02T08:00:00Z",
  platform: "web_player",
  ms_played: 2400000,
  spotify_episode_uri: "spotify:episode:ep999",
  episode_name: "Episode 1",
  episode_show_name: "My Podcast",
};

describe("importRecords", () => {
  let db: Database;
  let datasetId: number;

  beforeEach(() => {
    db = new Database(":memory:");
    db.run("PRAGMA foreign_keys=ON");
    runMigrations(db);
    datasetId = makeDataset(db);
  });

  afterEach(() => db.close());

  it("inserts track records and returns correct counts", () => {
    const result = importRecords(db, datasetId, [trackRecord]);
    expect(result.total_records).toBe(1);
    expect(result.inserted_records).toBe(1);

    const row = db.query<any, []>(`SELECT * FROM plays LIMIT 1`).get();
    expect(row.track_name).toBe("Song A");
    expect(row.artist_name).toBe("Artist X");
    expect(row.content_type).toBe("track");
    expect(row.track_slug).toBe("song-a");
    expect(row.artist_slug).toBe("artist-x");
    expect(row.album_slug).toBe("album-y");
  });

  it("detects content_type correctly for episodes", () => {
    importRecords(db, datasetId, [episodeRecord]);
    const row = db.query<any, []>(`SELECT content_type, episode_name FROM plays LIMIT 1`).get();
    expect(row.content_type).toBe("episode");
    expect(row.episode_name).toBe("Episode 1");
  });

  it("stores boolean fields as integers", () => {
    importRecords(db, datasetId, [trackRecord]);
    const row = db.query<any, []>(`SELECT shuffle, skipped, offline FROM plays LIMIT 1`).get();
    expect(row.shuffle).toBe(0);
    expect(row.skipped).toBe(0);
    expect(row.offline).toBe(0);
  });

  it("handles null boolean fields", () => {
    importRecords(db, datasetId, [{ ...trackRecord, shuffle: null, skipped: null }]);
    const row = db.query<any, []>(`SELECT shuffle, skipped FROM plays LIMIT 1`).get();
    expect(row.shuffle).toBeNull();
    expect(row.skipped).toBeNull();
  });

  it("skips records without a ts field", () => {
    const result = importRecords(db, datasetId, [
      trackRecord,
      { ts: "" } as SpotifyRecord,
      { ...trackRecord, ts: "2024-04-01T00:00:00Z" },
    ]);
    expect(result.total_records).toBe(3);
    expect(result.inserted_records).toBe(2);
  });

  it("inserts multiple records in one call", () => {
    const records = Array.from({ length: 5 }, (_, i) => ({
      ...trackRecord,
      ts: `2024-0${i + 1}-01T00:00:00Z`,
      spotify_track_uri: `spotify:track:${i}`,
    }));
    const result = importRecords(db, datasetId, records);
    expect(result.inserted_records).toBe(5);
    const count = db.query<{ c: number }, []>(`SELECT COUNT(*) as c FROM plays`).get();
    expect(count?.c).toBe(5);
  });

  it("falls back to ms_played=0 when field is absent", () => {
    importRecords(db, datasetId, [{ ts: "2024-01-01T00:00:00Z" }]);
    const row = db.query<any, []>(`SELECT ms_played FROM plays LIMIT 1`).get();
    expect(row.ms_played).toBe(0);
  });
});
