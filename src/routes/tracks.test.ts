import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { Database } from "bun:sqlite";
import { runMigrations } from "../db/migrations";
import { handleGetTracks } from "./tracks";

function makeReq(path: string) {
  return new Request(`http://localhost${path}`);
}

describe("handleGetTracks", () => {
  let db: Database;

  beforeEach(() => {
    db = new Database(":memory:");
    db.run("PRAGMA foreign_keys=ON");
    runMigrations(db);

    db.run(`INSERT INTO datasets (name, created_at) VALUES ('Test', '2024-01-01')`);
    db.run(`INSERT INTO plays
      (dataset_id, ts, ms_played, content_type, track_name, artist_name, album_name, spotify_track_uri, skipped)
      VALUES
      (1, '2024-01-01T10:00:00Z', 200000, 'track', 'Track A', 'Artist X', 'Album 1', 'spotify:track:aaa', 0),
      (1, '2024-01-02T10:00:00Z', 200000, 'track', 'Track A', 'Artist X', 'Album 1', 'spotify:track:aaa', 1),
      (1, '2024-01-03T10:00:00Z', 180000, 'track', 'Track B', 'Artist X', 'Album 1', 'spotify:track:bbb', 0),
      (1, '2024-01-04T10:00:00Z', 150000, 'track', 'Track C', 'Artist Y', 'Album 2', 'spotify:track:ccc', 0)`);
    db.run(`INSERT INTO plays
      (dataset_id, ts, ms_played, content_type, episode_name, episode_show_name, spotify_episode_uri)
      VALUES
      (1, '2024-01-05T08:00:00Z', 10000, 'episode', 'Ep 1', 'Show Z', 'spotify:episode:ep1')`);
  });

  afterEach(() => db.close());

  it("returns tracks grouped by URI, excluding non-track plays", async () => {
    const res = handleGetTracks(db, makeReq("/api/tracks"));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.total).toBe(3);          // Track A, B, C — episode excluded
    expect(body.tracks).toHaveLength(3);
  });

  it("default sort is play_count_desc", async () => {
    const res = handleGetTracks(db, makeReq("/api/tracks"));
    const body = await res.json();
    // Track A played twice
    expect(body.tracks[0].track_name).toBe("Track A");
  });

  it("reports aggregate stats per track", async () => {
    const res = handleGetTracks(db, makeReq("/api/tracks"));
    const body = await res.json();
    const a = body.tracks.find((t: any) => t.track_name === "Track A");
    expect(a.play_count).toBe(2);
    expect(a.total_ms_played).toBe(400000);
    expect(a.last_played).toBe("2024-01-02T10:00:00Z");
    expect(a.track_key).toBe("spotify:track:aaa");
  });

  it("calculates skip_rate correctly", async () => {
    const res = handleGetTracks(db, makeReq("/api/tracks"));
    const body = await res.json();
    // Track A: 1 skipped out of 2 plays = 50%
    const a = body.tracks.find((t: any) => t.track_name === "Track A");
    expect(a.skip_rate).toBe(50);
    // Track B: 0 skipped
    const b = body.tracks.find((t: any) => t.track_name === "Track B");
    expect(b.skip_rate).toBe(0);
  });

  it("paginates correctly", async () => {
    const res = handleGetTracks(db, makeReq("/api/tracks?page=1&page_size=2"));
    const body = await res.json();
    expect(body.tracks).toHaveLength(2);
    expect(body.total).toBe(3);
    expect(body.page).toBe(1);
    expect(body.page_size).toBe(2);
  });

  it("filters by track name", async () => {
    const res = handleGetTracks(db, makeReq("/api/tracks?track=Track+A"));
    const body = await res.json();
    expect(body.total).toBe(1);
    expect(body.tracks[0].track_name).toBe("Track A");
  });

  it("filters by artist name", async () => {
    const res = handleGetTracks(db, makeReq("/api/tracks?artist=Artist+Y"));
    const body = await res.json();
    expect(body.total).toBe(1);
    expect(body.tracks[0].track_name).toBe("Track C");
  });

  it("filters by album name", async () => {
    const res = handleGetTracks(db, makeReq("/api/tracks?album=Album+1"));
    const body = await res.json();
    expect(body.total).toBe(2);  // Track A and Track B are both on Album 1
  });

  it("filters by dataset_id", async () => {
    db.run(`INSERT INTO datasets (name, created_at) VALUES ('Other', '2024-02-01')`);
    db.run(`INSERT INTO plays (dataset_id, ts, ms_played, content_type, track_name, artist_name, album_name, spotify_track_uri)
      VALUES (2, '2024-02-01T10:00:00Z', 100000, 'track', 'Track Z', 'Artist Z', 'Album Z', 'spotify:track:zzz')`);
    const res = handleGetTracks(db, makeReq("/api/tracks?dataset_id=2"));
    const body = await res.json();
    expect(body.total).toBe(1);
    expect(body.tracks[0].track_name).toBe("Track Z");
  });

  it("returns 400 for invalid sort", async () => {
    const res = handleGetTracks(db, makeReq("/api/tracks?sort=bogus"));
    expect(res.status).toBe(400);
  });

  it("includes override fields (rating, notes)", async () => {
    db.run(`INSERT INTO metadata_overrides (entity_type, entity_key, field, value, updated_at)
      VALUES ('track', 'spotify:track:aaa', 'rating', '5', '2024-01-01T00:00:00Z')`);
    const res = handleGetTracks(db, makeReq("/api/tracks"));
    const body = await res.json();
    const a = body.tracks.find((t: any) => t.track_name === "Track A");
    expect(a.rating).toBe(5);
  });
});
