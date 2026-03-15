import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { Database } from "bun:sqlite";
import { runMigrations } from "../db/migrations";
import { handleGetArtists, handleGetArtist } from "./artists";

function makeReq(path: string) {
  return new Request(`http://localhost${path}`);
}

describe("handleGetArtists", () => {
  let db: Database;

  beforeEach(() => {
    db = new Database(":memory:");
    db.run("PRAGMA foreign_keys=ON");
    runMigrations(db);

    db.run(`INSERT INTO datasets (name, created_at) VALUES ('Test', '2024-01-01')`);
    db.run(`INSERT INTO plays
      (dataset_id, ts, ms_played, content_type, track_name, artist_name, album_name, spotify_track_uri)
      VALUES
      (1, '2024-01-01T10:00:00Z', 200000, 'track', 'Track A', 'Artist X', 'Album 1', 'spotify:track:aaa'),
      (1, '2024-01-02T10:00:00Z', 180000, 'track', 'Track B', 'Artist X', 'Album 2', 'spotify:track:bbb'),
      (1, '2024-01-03T10:00:00Z', 150000, 'track', 'Track C', 'Artist Y', 'Album 3', 'spotify:track:ccc')`);
    db.run(`INSERT INTO plays
      (dataset_id, ts, ms_played, content_type, episode_name, episode_show_name, spotify_episode_uri)
      VALUES
      (1, '2024-01-04T08:00:00Z', 10000, 'episode', 'Ep 1', 'Show Z', 'spotify:episode:ep1')`);
  });

  afterEach(() => db.close());

  it("returns artists grouped, excluding non-track plays", async () => {
    const res = handleGetArtists(db, makeReq("/api/artists"));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.artists).toHaveLength(2);     // Artist X, Artist Y — not Show Z
    expect(body.total).toBe(2);
  });

  it("default sort is total_ms_desc", async () => {
    const res = handleGetArtists(db, makeReq("/api/artists"));
    const body = await res.json();
    // Artist X: 380000ms, Artist Y: 150000ms
    expect(body.artists[0].artist_name).toBe("Artist X");
  });

  it("reports aggregate stats per artist", async () => {
    const res = handleGetArtists(db, makeReq("/api/artists?sort=name_asc"));
    const body = await res.json();
    const x = body.artists.find((a: any) => a.artist_name === "Artist X");
    expect(x.play_count).toBe(2);
    expect(x.total_ms_played).toBe(380000);
    expect(x.album_count).toBe(2);
    expect(x.first_played).toBe("2024-01-01T10:00:00Z");
    expect(x.last_played).toBe("2024-01-02T10:00:00Z");
  });

  it("paginates correctly", async () => {
    const res = handleGetArtists(db, makeReq("/api/artists?page=1&page_size=1"));
    const body = await res.json();
    expect(body.artists).toHaveLength(1);
    expect(body.total).toBe(2);
  });

  it("filters by artist substring", async () => {
    const res = handleGetArtists(db, makeReq("/api/artists?artist=Artist+X"));
    const body = await res.json();
    expect(body.artists).toHaveLength(1);
    expect(body.artists[0].artist_name).toBe("Artist X");
  });

  it("filters by dataset_id", async () => {
    db.run(`INSERT INTO datasets (name, created_at) VALUES ('Other', '2024-02-01')`);
    db.run(`INSERT INTO plays (dataset_id, ts, ms_played, content_type, track_name, artist_name, album_name, spotify_track_uri)
      VALUES (2, '2024-02-01T10:00:00Z', 100000, 'track', 'X', 'Artist Z', 'Album Z', 'spotify:track:zzz')`);
    const res = handleGetArtists(db, makeReq("/api/artists?dataset_id=2"));
    const body = await res.json();
    expect(body.artists).toHaveLength(1);
    expect(body.artists[0].artist_name).toBe("Artist Z");
  });

  it("returns 400 for invalid sort value", async () => {
    const res = handleGetArtists(db, makeReq("/api/artists?sort=bad_sort"));
    expect(res.status).toBe(400);
  });

  it("includes override fields (genre, rating, notes)", async () => {
    const key = "artist x";
    db.run(`INSERT INTO metadata_overrides (entity_type, entity_key, field, value, updated_at)
      VALUES ('artist', '${key}', 'rating', '4', '2024-01-01T00:00:00Z')`);
    const res = handleGetArtists(db, makeReq("/api/artists"));
    const body = await res.json();
    const x = body.artists.find((a: any) => a.artist_name === "Artist X");
    expect(x.rating).toBe(4);
  });
});

describe("handleGetArtist", () => {
  let db: Database;

  beforeEach(() => {
    db = new Database(":memory:");
    db.run("PRAGMA foreign_keys=ON");
    runMigrations(db);
    db.run(`INSERT INTO datasets (name, created_at) VALUES ('Test', '2024-01-01')`);
    db.run(`INSERT INTO plays
      (dataset_id, ts, ms_played, content_type, track_name, artist_name, album_name, spotify_track_uri)
      VALUES
      (1, '2024-01-01T10:00:00Z', 200000, 'track', 'Track A', 'Artist X', 'Album 1', 'spotify:track:aaa'),
      (1, '2024-01-02T10:00:00Z', 180000, 'track', 'Track B', 'Artist X', 'Album 2', 'spotify:track:bbb')`);
  });

  afterEach(() => db.close());

  it("returns single artist by key", async () => {
    const res = handleGetArtist(db, makeReq("/api/artists/artist+x"), "artist x");
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.artist_name).toBe("Artist X");
    expect(body.play_count).toBe(2);
    expect(body.album_count).toBe(2);
  });

  it("returns 404 for unknown key", async () => {
    const res = handleGetArtist(db, makeReq("/api/artists/nobody"), "nobody");
    expect(res.status).toBe(404);
  });
});
