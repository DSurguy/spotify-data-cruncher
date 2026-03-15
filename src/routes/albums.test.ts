import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { Database } from "bun:sqlite";
import { runMigrations } from "../db/migrations";
import { handleGetAlbums, handleGetAlbum } from "./albums";

function makeReq(path: string) {
  return new Request(`http://localhost${path}`);
}

describe("handleGetAlbums", () => {
  let db: Database;

  beforeEach(() => {
    db = new Database(":memory:");
    db.run("PRAGMA foreign_keys=ON");
    runMigrations(db);

    db.run(`INSERT INTO datasets (name, created_at) VALUES ('Test', '2024-01-01')`);
    // dataset id = 1
    db.run(`INSERT INTO plays
      (dataset_id, ts, ms_played, content_type, track_name, artist_name, album_name, spotify_track_uri)
      VALUES
      (1, '2024-01-01T10:00:00Z', 200000, 'track', 'Track A', 'Artist X', 'Album 1', 'spotify:track:aaa'),
      (1, '2024-01-02T10:00:00Z', 180000, 'track', 'Track B', 'Artist X', 'Album 1', 'spotify:track:bbb'),
      (1, '2024-01-03T10:00:00Z', 150000, 'track', 'Track C', 'Artist Y', 'Album 2', 'spotify:track:ccc'),
      (1, '2024-01-03T12:00:00Z', 10000,  'episode', 'Ep 1',   'Show Z',  null,      null)`);
  });

  afterEach(() => db.close());

  it("returns only track plays grouped by album", async () => {
    const res = handleGetAlbums(db, makeReq("/api/albums"));
    const body = await res.json();
    expect(res.status).toBe(200);
    // 2 albums (Album 1, Album 2); episode excluded
    expect(body.albums).toHaveLength(2);
    expect(body.total).toBe(2);
  });

  it("default sort is total_ms_desc", async () => {
    const res = handleGetAlbums(db, makeReq("/api/albums"));
    const body = await res.json();
    expect(body.albums[0].album_name).toBe("Album 1"); // 380000ms vs 150000ms
  });

  it("paginates correctly", async () => {
    const res = handleGetAlbums(db, makeReq("/api/albums?page=1&page_size=1"));
    const body = await res.json();
    expect(body.albums).toHaveLength(1);
    expect(body.total).toBe(2);
    expect(body.page).toBe(1);
    expect(body.page_size).toBe(1);
  });

  it("filters by dataset_id", async () => {
    // insert second dataset
    db.run(`INSERT INTO datasets (name, created_at) VALUES ('Other', '2024-02-01')`);
    db.run(`INSERT INTO plays (dataset_id, ts, ms_played, content_type, track_name, artist_name, album_name, spotify_track_uri)
      VALUES (2, '2024-02-01T10:00:00Z', 100000, 'track', 'X', 'Art Z', 'Album 3', 'spotify:track:zzz')`);
    const res = handleGetAlbums(db, makeReq("/api/albums?dataset_id=2"));
    const body = await res.json();
    expect(body.albums).toHaveLength(1);
    expect(body.albums[0].album_name).toBe("Album 3");
  });

  it("filters by artist substring", async () => {
    const res = handleGetAlbums(db, makeReq("/api/albums?artist=Artist+X"));
    const body = await res.json();
    expect(body.albums).toHaveLength(1);
    expect(body.albums[0].artist_name).toBe("Artist X");
  });

  it("returns 400 for invalid sort value", async () => {
    const res = handleGetAlbums(db, makeReq("/api/albums?sort=bad_sort"));
    expect(res.status).toBe(400);
  });

  it("reports aggregate stats per album", async () => {
    const res = handleGetAlbums(db, makeReq("/api/albums?sort=name_asc"));
    const body = await res.json();
    const album1 = body.albums.find((a: any) => a.album_name === "Album 1");
    expect(album1.play_count).toBe(2);
    expect(album1.total_ms_played).toBe(380000);
    expect(album1.track_count).toBe(2);
    expect(album1.first_played).toBe("2024-01-01T10:00:00Z");
    expect(album1.last_played).toBe("2024-01-02T10:00:00Z");
  });

  it("includes override values when present", async () => {
    // encode album_key: lowercase album name || artist
    const key = "album 1||artist x";
    db.run(`INSERT INTO metadata_overrides (entity_type, entity_key, field, value, updated_at)
      VALUES ('album', ?, 'rating', '4', '2024-01-01')`, [key]);
    db.run(`INSERT INTO metadata_overrides (entity_type, entity_key, field, value, updated_at)
      VALUES ('album', ?, 'genre', '"Rock"', '2024-01-01')`, [key]);

    const res = handleGetAlbums(db, makeReq("/api/albums"));
    const body = await res.json();
    const album1 = body.albums.find((a: any) => a.album_name === "Album 1");
    expect(album1.rating).toBe(4);
    expect(album1.genre).toBe("Rock");
  });
});

describe("handleGetAlbum", () => {
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
      (1, '2024-01-02T10:00:00Z', 180000, 'track', 'Track B', 'Artist X', 'Album 1', 'spotify:track:bbb')`);
  });

  afterEach(() => db.close());

  it("returns the album for a valid key", async () => {
    const key = encodeURIComponent("album 1||artist x");
    const res = handleGetAlbum(db, makeReq(`/api/albums/${key}`), "album 1||artist x");
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.album.album_name).toBe("Album 1");
    expect(body.album.play_count).toBe(2);
  });

  it("returns 404 for unknown album key", async () => {
    const res = handleGetAlbum(db, makeReq("/api/albums/unknown"), "unknown");
    expect(res.status).toBe(404);
  });
});
