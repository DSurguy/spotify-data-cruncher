import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { Database } from "bun:sqlite";
import { runMigrations } from "../db/migrations";
import { handleGetPlays } from "./plays";

function makeReq(path: string) {
  return new Request(`http://localhost${path}`);
}

describe("handleGetPlays", () => {
  let db: Database;

  beforeEach(() => {
    db = new Database(":memory:");
    db.run("PRAGMA foreign_keys=ON");
    runMigrations(db);

    db.run(`INSERT INTO datasets (name, created_at) VALUES ('Test', '2024-01-01')`);
    // dataset id = 1
    db.run(`INSERT INTO plays
      (dataset_id, ts, ms_played, content_type, track_name, artist_name, album_name, spotify_track_uri, skipped, shuffle, offline, incognito_mode)
      VALUES
      (1, '2024-01-03T12:00:00Z', 240000, 'track', 'Track C', 'Artist Y', 'Album 2', 'spotify:track:ccc', 0, 0, 0, 0),
      (1, '2024-01-02T10:00:00Z', 180000, 'track', 'Track B', 'Artist X', 'Album 1', 'spotify:track:bbb', 1, 0, 0, 0),
      (1, '2024-01-01T10:00:00Z', 200000, 'track', 'Track A', 'Artist X', 'Album 1', 'spotify:track:aaa', 0, 1, 0, 0)`);
    db.run(`INSERT INTO plays
      (dataset_id, ts, ms_played, content_type, episode_name, episode_show_name, spotify_episode_uri)
      VALUES
      (1, '2024-01-04T08:00:00Z', 10000, 'episode', 'Ep 1', 'Show Z', 'spotify:episode:ep1')`);
  });

  afterEach(() => db.close());

  it("returns plays with correct shape", async () => {
    const res = handleGetPlays(db, makeReq("/api/plays?page_size=10"));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.total).toBe(4);
    expect(body.page).toBe(1);
    expect(body.page_size).toBe(10);
    const play = body.plays[0];
    expect(play).toMatchObject({
      id: expect.any(Number),
      dataset_id: 1,
      ts: expect.any(String),
      ms_played: expect.any(Number),
      content_type: expect.any(String),
    });
  });

  it("default sort is ts_desc (most recent first)", async () => {
    const res = handleGetPlays(db, makeReq("/api/plays"));
    const body = await res.json();
    expect(body.plays[0].ts).toBe("2024-01-04T08:00:00Z");
    expect(body.plays[3].ts).toBe("2024-01-01T10:00:00Z");
  });

  it("sorts ts_asc", async () => {
    const res = handleGetPlays(db, makeReq("/api/plays?sort=ts_asc"));
    const body = await res.json();
    expect(body.plays[0].ts).toBe("2024-01-01T10:00:00Z");
  });

  it("returns 400 for invalid sort value", async () => {
    const res = handleGetPlays(db, makeReq("/api/plays?sort=bad_sort"));
    expect(res.status).toBe(400);
  });

  it("paginates correctly", async () => {
    const res = handleGetPlays(db, makeReq("/api/plays?page=2&page_size=2"));
    const body = await res.json();
    expect(body.plays).toHaveLength(2);
    expect(body.total).toBe(4);
    expect(body.page).toBe(2);
    expect(body.page_size).toBe(2);
  });

  it("filters by dataset_id", async () => {
    db.run(`INSERT INTO datasets (name, created_at) VALUES ('Other', '2024-02-01')`);
    db.run(`INSERT INTO plays (dataset_id, ts, ms_played, content_type, track_name, artist_name, album_name, spotify_track_uri)
      VALUES (2, '2024-02-01T10:00:00Z', 100000, 'track', 'X', 'Artist Z', 'Album 3', 'spotify:track:zzz')`);
    const res = handleGetPlays(db, makeReq("/api/plays?dataset_id=2"));
    const body = await res.json();
    expect(body.total).toBe(1);
    expect(body.plays[0].artist_name).toBe("Artist Z");
  });

  it("filters by content_type", async () => {
    const res = handleGetPlays(db, makeReq("/api/plays?content_type=episode"));
    const body = await res.json();
    expect(body.total).toBe(1);
    expect(body.plays[0].episode_name).toBe("Ep 1");
  });

  it("filters by artist substring", async () => {
    const res = handleGetPlays(db, makeReq("/api/plays?artist=Artist+X"));
    const body = await res.json();
    expect(body.total).toBe(2);
    expect(body.plays.every((p: any) => p.artist_name === "Artist X")).toBe(true);
  });

  it("filters by track name substring", async () => {
    const res = handleGetPlays(db, makeReq("/api/plays?track=Track+C"));
    const body = await res.json();
    expect(body.total).toBe(1);
    expect(body.plays[0].track_name).toBe("Track C");
  });

  it("filters by skipped=true", async () => {
    const res = handleGetPlays(db, makeReq("/api/plays?skipped=true"));
    const body = await res.json();
    expect(body.total).toBe(1);
    expect(body.plays[0].track_name).toBe("Track B");
    expect(body.plays[0].skipped).toBe(true);
  });

  it("filters by min_ms", async () => {
    const res = handleGetPlays(db, makeReq("/api/plays?min_ms=200000"));
    const body = await res.json();
    // Track A (200000) and Track C (240000) qualify; Track B (180000) and Ep (10000) do not
    expect(body.total).toBe(2);
    expect(body.plays.every((p: any) => p.ms_played >= 200000)).toBe(true);
  });

  it("converts sqlite integers to booleans", async () => {
    const res = handleGetPlays(db, makeReq("/api/plays?content_type=track&sort=ts_asc"));
    const body = await res.json();
    // Track A: skipped=0 → false, shuffle=1 → true
    const trackA = body.plays.find((p: any) => p.track_name === "Track A");
    expect(trackA.skipped).toBe(false);
    expect(trackA.shuffle).toBe(true);
  });

  it("filters by date range", async () => {
    const res = handleGetPlays(db, makeReq("/api/plays?from=2024-01-02T00:00:00Z&to=2024-01-02T23:59:59Z"));
    const body = await res.json();
    expect(body.total).toBe(1);
    expect(body.plays[0].track_name).toBe("Track B");
  });
});
