import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { Database } from "bun:sqlite";
import { runMigrations } from "../db/migrations";
import { handleGetPodcasts } from "./podcasts";

function makeReq(path: string) {
  return new Request(`http://localhost${path}`);
}

describe("handleGetPodcasts", () => {
  let db: Database;

  beforeEach(() => {
    db = new Database(":memory:");
    db.run("PRAGMA foreign_keys=ON");
    runMigrations(db);

    db.run(`INSERT INTO datasets (name, created_at) VALUES ('Test', '2024-01-01')`);
    db.run(`INSERT INTO plays
      (dataset_id, ts, ms_played, content_type, episode_name, episode_show_name, spotify_episode_uri)
      VALUES
      (1, '2024-01-01T10:00:00Z', 1800000, 'episode', 'Ep 1', 'Show A', 'spotify:episode:ep1'),
      (1, '2024-01-02T10:00:00Z', 2400000, 'episode', 'Ep 2', 'Show A', 'spotify:episode:ep2'),
      (1, '2024-01-03T10:00:00Z', 3000000, 'episode', 'Ep 1', 'Show B', 'spotify:episode:ep3')`);
    // also insert a track play to verify it's excluded
    db.run(`INSERT INTO plays
      (dataset_id, ts, ms_played, content_type, track_name, artist_name, album_name, spotify_track_uri)
      VALUES
      (1, '2024-01-04T08:00:00Z', 200000, 'track', 'Track X', 'Artist X', 'Album Y', 'spotify:track:t1')`);
  });

  afterEach(() => db.close());

  it("returns shows grouped, excluding non-episode plays", async () => {
    const res = handleGetPodcasts(db, makeReq("/api/podcasts"));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.shows).toHaveLength(2);
    expect(body.total).toBe(2);
  });

  it("default sort is total_ms_desc", async () => {
    const res = handleGetPodcasts(db, makeReq("/api/podcasts"));
    const body = await res.json();
    // Show A: 4200000ms, Show B: 3000000ms
    expect(body.shows[0].show_name).toBe("Show A");
    expect(body.shows[1].show_name).toBe("Show B");
  });

  it("reports aggregate stats per show", async () => {
    const res = handleGetPodcasts(db, makeReq("/api/podcasts?sort=name_asc"));
    const body = await res.json();
    const showA = body.shows.find((s: any) => s.show_name === "Show A");
    expect(showA.episode_count).toBe(2);
    expect(showA.play_count).toBe(2);
    expect(showA.total_ms_played).toBe(4200000);
    expect(showA.first_played).toBe("2024-01-01T10:00:00Z");
    expect(showA.last_played).toBe("2024-01-02T10:00:00Z");
  });

  it("counts replays of same episode as one unique episode", async () => {
    // Add a second play of ep1 for Show A
    db.run(`INSERT INTO plays
      (dataset_id, ts, ms_played, content_type, episode_name, episode_show_name, spotify_episode_uri)
      VALUES (1, '2024-01-05T10:00:00Z', 1800000, 'episode', 'Ep 1', 'Show A', 'spotify:episode:ep1')`);
    const res = handleGetPodcasts(db, makeReq("/api/podcasts?sort=name_asc"));
    const body = await res.json();
    const showA = body.shows.find((s: any) => s.show_name === "Show A");
    expect(showA.episode_count).toBe(2);  // still 2 unique episodes
    expect(showA.play_count).toBe(3);     // 3 total plays
  });

  it("paginates correctly", async () => {
    const res = handleGetPodcasts(db, makeReq("/api/podcasts?page=1&page_size=1"));
    const body = await res.json();
    expect(body.shows).toHaveLength(1);
    expect(body.total).toBe(2);
  });

  it("filters by show substring", async () => {
    const res = handleGetPodcasts(db, makeReq("/api/podcasts?show=Show+A"));
    const body = await res.json();
    expect(body.shows).toHaveLength(1);
    expect(body.shows[0].show_name).toBe("Show A");
  });

  it("filters by dataset_id", async () => {
    db.run(`INSERT INTO datasets (name, created_at) VALUES ('Other', '2024-02-01')`);
    db.run(`INSERT INTO plays
      (dataset_id, ts, ms_played, content_type, episode_name, episode_show_name, spotify_episode_uri)
      VALUES (2, '2024-02-01T10:00:00Z', 1000000, 'episode', 'EP100', 'Show C', 'spotify:episode:ep100')`);
    const res = handleGetPodcasts(db, makeReq("/api/podcasts?dataset_id=2"));
    const body = await res.json();
    expect(body.shows).toHaveLength(1);
    expect(body.shows[0].show_name).toBe("Show C");
  });

  it("filters by date range", async () => {
    const res = handleGetPodcasts(db, makeReq("/api/podcasts?from=2024-01-03T00:00:00Z&to=2024-01-03T23:59:59Z"));
    const body = await res.json();
    expect(body.shows).toHaveLength(1);
    expect(body.shows[0].show_name).toBe("Show B");
  });

  it("returns 400 for invalid sort value", async () => {
    const res = handleGetPodcasts(db, makeReq("/api/podcasts?sort=bad_sort"));
    expect(res.status).toBe(400);
  });

  it("includes override fields (genre, notes)", async () => {
    const key = "show a";
    db.run(`INSERT INTO metadata_overrides (entity_type, entity_key, field, value, updated_at)
      VALUES ('show', '${key}', 'genre', '"Comedy"', '2024-01-01T00:00:00Z')`);
    db.run(`INSERT INTO metadata_overrides (entity_type, entity_key, field, value, updated_at)
      VALUES ('show', '${key}', 'notes', '"Great show"', '2024-01-01T00:00:00Z')`);
    const res = handleGetPodcasts(db, makeReq("/api/podcasts?sort=name_asc"));
    const body = await res.json();
    const showA = body.shows.find((s: any) => s.show_name === "Show A");
    expect(showA.genre).toBe("Comedy");
    expect(showA.notes).toBe("Great show");
  });

  it("returns empty list when no podcast plays exist", async () => {
    const freshDb = new Database(":memory:");
    freshDb.run("PRAGMA foreign_keys=ON");
    runMigrations(freshDb);
    freshDb.run(`INSERT INTO datasets (name, created_at) VALUES ('Empty', '2024-01-01')`);
    const res = handleGetPodcasts(freshDb, makeReq("/api/podcasts"));
    const body = await res.json();
    expect(body.shows).toHaveLength(0);
    expect(body.total).toBe(0);
    freshDb.close();
  });
});
