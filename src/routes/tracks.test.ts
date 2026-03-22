import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { Database } from "bun:sqlite";
import { runMigrations } from "../db/migrations";
import { handleGetTracks, handleGetTrack } from "./tracks";

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
      (dataset_id, ts, ms_played, content_type, track_name, artist_name, album_name, spotify_track_uri, skipped, album_slug, artist_slug, track_slug)
      VALUES
      (1, '2024-01-01T10:00:00Z', 200000, 'track', 'Track A', 'Artist X', 'Album 1', 'spotify:track:aaa', 0, 'album-1', 'artist-x', 'aaa'),
      (1, '2024-01-02T10:00:00Z', 200000, 'track', 'Track A', 'Artist X', 'Album 1', 'spotify:track:aaa', 1, 'album-1', 'artist-x', 'aaa'),
      (1, '2024-01-03T10:00:00Z', 180000, 'track', 'Track B', 'Artist X', 'Album 1', 'spotify:track:bbb', 0, 'album-1', 'artist-x', 'bbb'),
      (1, '2024-01-04T10:00:00Z', 150000, 'track', 'Track C', 'Artist Y', 'Album 2', 'spotify:track:ccc', 0, 'album-2', 'artist-y', 'ccc')`);
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
    expect(a.track_slug).toBe("aaa");
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
    db.run(`INSERT INTO plays (dataset_id, ts, ms_played, content_type, track_name, artist_name, album_name, spotify_track_uri, album_slug, artist_slug, track_slug)
      VALUES (2, '2024-02-01T10:00:00Z', 100000, 'track', 'Track Z', 'Artist Z', 'Album Z', 'spotify:track:zzz', 'album-z', 'artist-z', 'zzz')`);
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
      VALUES ('track', 'aaa', 'rating', '"like"', '2024-01-01T00:00:00Z')`);
    const res = handleGetTracks(db, makeReq("/api/tracks"));
    const body = await res.json();
    const a = body.tracks.find((t: any) => t.track_name === "Track A");
    expect(a.rating).toBe("like");
  });

  it("includes genre override field", async () => {
    db.run(`INSERT INTO metadata_overrides (entity_type, entity_key, field, value, updated_at)
      VALUES ('track', 'aaa', 'genre', '"Indie Rock"', '2024-01-01T00:00:00Z')`);
    const res = handleGetTracks(db, makeReq("/api/tracks"));
    const body = await res.json();
    const a = body.tracks.find((t: any) => t.track_name === "Track A");
    expect(a.genre).toBe("Indie Rock");
  });

  it("includes first_played field", async () => {
    const res = handleGetTracks(db, makeReq("/api/tracks"));
    const body = await res.json();
    const a = body.tracks.find((t: any) => t.track_name === "Track A");
    expect(a.first_played).toBe("2024-01-01T10:00:00Z");
  });

  it("sort=first_played_asc orders by first play date ascending", async () => {
    const res = handleGetTracks(db, makeReq("/api/tracks?sort=first_played_asc"));
    const body = await res.json();
    expect(body.tracks[0].track_name).toBe("Track A"); // Track A first played 2024-01-01
  });

  it("sort=play_count_asc orders by play count ascending", async () => {
    const res = handleGetTracks(db, makeReq("/api/tracks?sort=play_count_asc"));
    const body = await res.json();
    // Track B and C have 1 play each, Track A has 2
    expect(body.tracks[body.tracks.length - 1].track_name).toBe("Track A");
  });

  it("sort=random returns all tracks", async () => {
    const res = handleGetTracks(db, makeReq("/api/tracks?sort=random"));
    const body = await res.json();
    expect(body.total).toBe(3);
    expect(body.tracks).toHaveLength(3);
  });

  it("reviewed defaults to false when no override", async () => {
    const res = handleGetTracks(db, makeReq("/api/tracks"));
    const body = await res.json();
    expect(body.tracks.every((t: any) => t.reviewed === false)).toBe(true);
  });

  it("reviewed is true when override set to 'true'", async () => {
    db.run(`INSERT INTO metadata_overrides (entity_type, entity_key, field, value, updated_at)
      VALUES ('track', 'aaa', 'reviewed', 'true', '2024-01-01T00:00:00Z')`);
    const res = handleGetTracks(db, makeReq("/api/tracks"));
    const body = await res.json();
    const a = body.tracks.find((t: any) => t.track_name === "Track A");
    expect(a.reviewed).toBe(true);
    const b = body.tracks.find((t: any) => t.track_name === "Track B");
    expect(b.reviewed).toBe(false);
  });

  it("filters reviewed=true returns only reviewed tracks", async () => {
    db.run(`INSERT INTO metadata_overrides (entity_type, entity_key, field, value, updated_at)
      VALUES ('track', 'aaa', 'reviewed', 'true', '2024-01-01T00:00:00Z')`);
    const res = handleGetTracks(db, makeReq("/api/tracks?reviewed=true"));
    const body = await res.json();
    expect(body.total).toBe(1);
    expect(body.tracks[0].track_name).toBe("Track A");
  });

  it("filters reviewed=false returns only unreviewed tracks", async () => {
    db.run(`INSERT INTO metadata_overrides (entity_type, entity_key, field, value, updated_at)
      VALUES ('track', 'aaa', 'reviewed', 'true', '2024-01-01T00:00:00Z')`);
    const res = handleGetTracks(db, makeReq("/api/tracks?reviewed=false"));
    const body = await res.json();
    expect(body.total).toBe(2); // Track B and Track C
    expect(body.tracks.every((t: any) => t.track_name !== "Track A")).toBe(true);
  });
});

describe("handleGetTrack", () => {
  let db: Database;

  beforeEach(() => {
    db = new Database(":memory:");
    db.run("PRAGMA foreign_keys=ON");
    runMigrations(db);
    db.run(`INSERT INTO datasets (name, created_at) VALUES ('Test', '2024-01-01')`);
    db.run(`INSERT INTO plays
      (dataset_id, ts, ms_played, content_type, track_name, artist_name, album_name, spotify_track_uri, skipped, album_slug, artist_slug, track_slug)
      VALUES
      (1, '2024-01-01T10:00:00Z', 200000, 'track', 'Track A', 'Artist X', 'Album 1', 'spotify:track:aaa', 0, 'album-1', 'artist-x', 'aaa'),
      (1, '2024-01-02T10:00:00Z', 180000, 'track', 'Track A', 'Artist X', 'Album 1', 'spotify:track:aaa', 1, 'album-1', 'artist-x', 'aaa'),
      (1, '2024-01-03T10:00:00Z', 150000, 'track', 'Track B', 'Artist X', 'Album 2', 'spotify:track:bbb', null, 'album-2', 'artist-x', 'bbb')`);
  });

  afterEach(() => db.close());

  it("returns track metadata for valid key", async () => {
    const res = handleGetTrack(db, makeReq("/api/tracks/aaa"), "aaa");
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.track.track_name).toBe("Track A");
    expect(body.track.play_count).toBe(2);
    expect(body.track.skipped_count).toBe(1);
  });

  it("returns 404 for unknown key", async () => {
    const res = handleGetTrack(db, makeReq("/api/tracks/unknown"), "unknown");
    expect(res.status).toBe(404);
  });

  it("returns albums containing track", async () => {
    const res = handleGetTrack(db, makeReq("/api/tracks/aaa"), "aaa");
    const body = await res.json();
    expect(body.albums.length).toBe(1);
    expect(body.albums[0].album_name).toBe("Album 1");
    expect(body.albums[0].play_count).toBe(2);
  });

  it("returns paginated play history in desc order", async () => {
    const res = handleGetTrack(db, makeReq("/api/tracks/aaa"), "aaa");
    const body = await res.json();
    expect(body.plays.total).toBe(2);
    expect(body.plays.items.length).toBe(2);
    expect(body.plays.items[0].ts).toBe("2024-01-02T10:00:00Z");
  });

  it("includes override fields", async () => {
    db.run(`INSERT INTO metadata_overrides (entity_type, entity_key, field, value, updated_at)
      VALUES ('track', 'aaa', 'rating', '"like"', '2024-01-01T00:00:00Z'),
             ('track', 'aaa', 'genre', '"Indie"', '2024-01-01T00:00:00Z')`);
    const res = handleGetTrack(db, makeReq("/api/tracks/aaa"), "aaa");
    const body = await res.json();
    expect(body.track.rating).toBe("like");
    expect(body.track.genre).toBe("Indie");
  });

  it("includes first_played field", async () => {
    const res = handleGetTrack(db, makeReq("/api/tracks/aaa"), "aaa");
    const body = await res.json();
    expect(body.track.first_played).toBe("2024-01-01T10:00:00Z");
  });
});
