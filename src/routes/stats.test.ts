import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { Database } from "bun:sqlite";
import { runMigrations } from "../db/migrations";
import { handleGetSummary } from "./stats";

function makeReq(path: string) {
  return new Request(`http://localhost${path}`);
}

describe("handleGetSummary", () => {
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
      (1, '2024-01-02T10:00:00Z', 180000, 'track', 'Track B', 'Artist X', 'Album 1', 'spotify:track:bbb'),
      (1, '2024-01-03T10:00:00Z', 150000, 'track', 'Track A', 'Artist Y', 'Album 2', 'spotify:track:aaa'),
      (1, '2024-01-03T12:00:00Z', 10000,  'episode', 'Ep 1',   'Show Z',  null,      null)`);
  });

  afterEach(() => db.close());

  it("returns correct aggregate counts", async () => {
    const res = handleGetSummary(db, makeReq("/api/stats/summary"));
    const body = await res.json();
    expect(res.status).toBe(200);
    const s = body.summary;
    expect(s.total_plays).toBe(3);           // 3 tracks (episode excluded)
    expect(s.total_ms_played).toBe(530000);
    expect(s.unique_tracks).toBe(2);         // aaa + bbb
    expect(s.unique_albums).toBe(2);         // Album 1 + Album 2
    expect(s.unique_artists).toBe(2);        // Artist X + Artist Y
    expect(s.first_played).toBe("2024-01-01T10:00:00Z");
    expect(s.last_played).toBe("2024-01-03T10:00:00Z");
  });

  it("returns zeros when no data", async () => {
    db.run("DELETE FROM plays");
    const res = handleGetSummary(db, makeReq("/api/stats/summary"));
    const body = await res.json();
    expect(body.summary.total_plays).toBe(0);
  });

  it("filters by dataset_id", async () => {
    db.run(`INSERT INTO datasets (name, created_at) VALUES ('Other', '2024-02-01')`);
    db.run(`INSERT INTO plays (dataset_id, ts, ms_played, content_type, track_name, artist_name, album_name, spotify_track_uri)
      VALUES (2, '2024-02-01T10:00:00Z', 100000, 'track', 'X', 'Z', 'AlbumZ', 'spotify:track:zzz')`);
    const res = handleGetSummary(db, makeReq("/api/stats/summary?dataset_id=2"));
    const body = await res.json();
    expect(body.summary.total_plays).toBe(1);
  });

  it("filters by date range", async () => {
    const res = handleGetSummary(db, makeReq("/api/stats/summary?from=2024-01-02&to=2024-01-02T23:59:59Z"));
    const body = await res.json();
    expect(body.summary.total_plays).toBe(1);
  });
});
