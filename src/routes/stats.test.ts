import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { Database } from "bun:sqlite";
import { runMigrations } from "../db/migrations";
import { handleGetSummary, handleGetTopTracks, handleGetTopAlbums, handleGetTopArtists, handleGetTimeline } from "./stats";

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

describe("handleGetTopTracks", () => {
  let db: Database;

  beforeEach(() => {
    db = new Database(":memory:");
    db.run("PRAGMA foreign_keys=ON");
    runMigrations(db);
    db.run(`INSERT INTO datasets (name, created_at) VALUES ('Test', '2024-01-01')`);
    // Track A played 3 times, Track B played 2 times, Track C played 1 time
    db.run(`INSERT INTO plays
      (dataset_id, ts, ms_played, content_type, track_name, artist_name, album_name, spotify_track_uri)
      VALUES
      (1, '2024-01-01T10:00:00Z', 200000, 'track', 'Track A', 'Artist X', 'Album 1', 'spotify:track:aaa'),
      (1, '2024-01-02T10:00:00Z', 200000, 'track', 'Track A', 'Artist X', 'Album 1', 'spotify:track:aaa'),
      (1, '2024-01-03T10:00:00Z', 200000, 'track', 'Track A', 'Artist X', 'Album 1', 'spotify:track:aaa'),
      (1, '2024-01-04T10:00:00Z', 180000, 'track', 'Track B', 'Artist X', 'Album 1', 'spotify:track:bbb'),
      (1, '2024-01-05T10:00:00Z', 180000, 'track', 'Track B', 'Artist X', 'Album 1', 'spotify:track:bbb'),
      (1, '2024-01-06T10:00:00Z', 150000, 'track', 'Track C', 'Artist Y', 'Album 2', 'spotify:track:ccc')`);
    // podcast play — should be excluded
    db.run(`INSERT INTO plays (dataset_id, ts, ms_played, content_type, episode_name, episode_show_name, spotify_episode_uri)
      VALUES (1, '2024-01-07T08:00:00Z', 999999, 'episode', 'Ep 1', 'Show Z', 'spotify:episode:ep1')`);
  });

  afterEach(() => db.close());

  it("returns top tracks sorted by play count descending", async () => {
    const res = handleGetTopTracks(db, makeReq("/api/stats/top-tracks"));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.tracks[0].track_name).toBe("Track A");
    expect(body.tracks[0].play_count).toBe(3);
    expect(body.tracks[1].track_name).toBe("Track B");
    expect(body.tracks[1].play_count).toBe(2);
  });

  it("excludes non-track plays", async () => {
    const res = handleGetTopTracks(db, makeReq("/api/stats/top-tracks"));
    const body = await res.json();
    expect(body.tracks.every((t: any) => t.track_name !== undefined)).toBe(true);
    expect(body.tracks).toHaveLength(3);
  });

  it("respects limit param", async () => {
    const res = handleGetTopTracks(db, makeReq("/api/stats/top-tracks?limit=2"));
    const body = await res.json();
    expect(body.tracks).toHaveLength(2);
  });

  it("clamps limit to max 25", async () => {
    const res = handleGetTopTracks(db, makeReq("/api/stats/top-tracks?limit=999"));
    const body = await res.json();
    expect(body.tracks.length).toBeLessThanOrEqual(25);
  });

  it("includes total_ms_played per track", async () => {
    const res = handleGetTopTracks(db, makeReq("/api/stats/top-tracks"));
    const body = await res.json();
    const trackA = body.tracks.find((t: any) => t.track_name === "Track A");
    expect(trackA.total_ms_played).toBe(600000);
  });

  it("filters by dataset_id", async () => {
    db.run(`INSERT INTO datasets (name, created_at) VALUES ('Other', '2024-02-01')`);
    db.run(`INSERT INTO plays (dataset_id, ts, ms_played, content_type, track_name, artist_name, album_name, spotify_track_uri)
      VALUES (2, '2024-02-01T10:00:00Z', 100000, 'track', 'Exclusive', 'Artist Z', 'Album Z', 'spotify:track:zzz')`);
    const res = handleGetTopTracks(db, makeReq("/api/stats/top-tracks?dataset_id=2"));
    const body = await res.json();
    expect(body.tracks).toHaveLength(1);
    expect(body.tracks[0].track_name).toBe("Exclusive");
  });

  it("filters by date range", async () => {
    const res = handleGetTopTracks(db, makeReq("/api/stats/top-tracks?from=2024-01-06T00:00:00Z&to=2024-01-06T23:59:59Z"));
    const body = await res.json();
    expect(body.tracks).toHaveLength(1);
    expect(body.tracks[0].track_name).toBe("Track C");
  });
});

describe("handleGetTopAlbums", () => {
  let db: Database;

  beforeEach(() => {
    db = new Database(":memory:");
    db.run("PRAGMA foreign_keys=ON");
    runMigrations(db);
    db.run(`INSERT INTO datasets (name, created_at) VALUES ('Test', '2024-01-01')`);
    // Album 1: 3 plays, 600000ms; Album 2: 1 play, 500000ms; Album 3: 2 plays, 300000ms
    db.run(`INSERT INTO plays
      (dataset_id, ts, ms_played, content_type, track_name, artist_name, album_name, spotify_track_uri)
      VALUES
      (1, '2024-01-01T10:00:00Z', 200000, 'track', 'Track A', 'Artist X', 'Album 1', 'spotify:track:aaa'),
      (1, '2024-01-02T10:00:00Z', 200000, 'track', 'Track B', 'Artist X', 'Album 1', 'spotify:track:bbb'),
      (1, '2024-01-03T10:00:00Z', 200000, 'track', 'Track C', 'Artist X', 'Album 1', 'spotify:track:ccc'),
      (1, '2024-01-04T10:00:00Z', 500000, 'track', 'Track D', 'Artist Y', 'Album 2', 'spotify:track:ddd'),
      (1, '2024-01-05T10:00:00Z', 150000, 'track', 'Track E', 'Artist Z', 'Album 3', 'spotify:track:eee'),
      (1, '2024-01-06T10:00:00Z', 150000, 'track', 'Track F', 'Artist Z', 'Album 3', 'spotify:track:fff')`);
  });

  afterEach(() => db.close());

  it("returns top albums sorted by total_ms_played descending", async () => {
    const res = handleGetTopAlbums(db, makeReq("/api/stats/top-albums"));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.albums[0].album_name).toBe("Album 1");
    expect(body.albums[0].total_ms_played).toBe(600000);
    expect(body.albums[1].album_name).toBe("Album 2");
  });

  it("respects limit param", async () => {
    const res = handleGetTopAlbums(db, makeReq("/api/stats/top-albums?limit=2"));
    const body = await res.json();
    expect(body.albums).toHaveLength(2);
  });

  it("includes play_count per album", async () => {
    const res = handleGetTopAlbums(db, makeReq("/api/stats/top-albums"));
    const body = await res.json();
    const album1 = body.albums.find((a: any) => a.album_name === "Album 1");
    expect(album1.play_count).toBe(3);
  });
});

describe("handleGetTopArtists", () => {
  let db: Database;

  beforeEach(() => {
    db = new Database(":memory:");
    db.run("PRAGMA foreign_keys=ON");
    runMigrations(db);
    db.run(`INSERT INTO datasets (name, created_at) VALUES ('Test', '2024-01-01')`);
    // Artist X: 3 plays 600000ms, Artist Y: 1 play 500000ms, Artist Z: 2 plays 300000ms
    db.run(`INSERT INTO plays
      (dataset_id, ts, ms_played, content_type, track_name, artist_name, album_name, spotify_track_uri)
      VALUES
      (1, '2024-01-01T10:00:00Z', 200000, 'track', 'Track A', 'Artist X', 'Album 1', 'spotify:track:aaa'),
      (1, '2024-01-02T10:00:00Z', 200000, 'track', 'Track B', 'Artist X', 'Album 1', 'spotify:track:bbb'),
      (1, '2024-01-03T10:00:00Z', 200000, 'track', 'Track C', 'Artist X', 'Album 1', 'spotify:track:ccc'),
      (1, '2024-01-04T10:00:00Z', 500000, 'track', 'Track D', 'Artist Y', 'Album 2', 'spotify:track:ddd'),
      (1, '2024-01-05T10:00:00Z', 150000, 'track', 'Track E', 'Artist Z', 'Album 3', 'spotify:track:eee'),
      (1, '2024-01-06T10:00:00Z', 150000, 'track', 'Track F', 'Artist Z', 'Album 3', 'spotify:track:fff')`);
    // podcast — excluded
    db.run(`INSERT INTO plays (dataset_id, ts, ms_played, content_type, episode_name, episode_show_name, spotify_episode_uri)
      VALUES (1, '2024-01-07T08:00:00Z', 9999999, 'episode', 'Ep 1', 'Show Z', 'spotify:episode:ep1')`);
  });

  afterEach(() => db.close());

  it("returns top artists sorted by total_ms_played descending", async () => {
    const res = handleGetTopArtists(db, makeReq("/api/stats/top-artists"));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.artists[0].artist_name).toBe("Artist X");
    expect(body.artists[0].total_ms_played).toBe(600000);
    expect(body.artists[1].artist_name).toBe("Artist Y");
  });

  it("excludes non-track plays", async () => {
    const res = handleGetTopArtists(db, makeReq("/api/stats/top-artists"));
    const body = await res.json();
    expect(body.artists.every((a: any) => a.artist_name !== "Show Z")).toBe(true);
    expect(body.artists).toHaveLength(3);
  });

  it("respects limit param", async () => {
    const res = handleGetTopArtists(db, makeReq("/api/stats/top-artists?limit=2"));
    const body = await res.json();
    expect(body.artists).toHaveLength(2);
  });

  it("includes play_count per artist", async () => {
    const res = handleGetTopArtists(db, makeReq("/api/stats/top-artists"));
    const body = await res.json();
    const artistX = body.artists.find((a: any) => a.artist_name === "Artist X");
    expect(artistX.play_count).toBe(3);
  });

  it("filters by date range", async () => {
    const res = handleGetTopArtists(db, makeReq("/api/stats/top-artists?from=2024-01-04T00:00:00Z&to=2024-01-06T23:59:59Z"));
    const body = await res.json();
    expect(body.artists).toHaveLength(2);
    const names = body.artists.map((a: any) => a.artist_name);
    expect(names).toContain("Artist Y");
    expect(names).toContain("Artist Z");
  });
});

describe("handleGetTimeline", () => {
  let db: Database;

  beforeEach(() => {
    db = new Database(":memory:");
    db.run("PRAGMA foreign_keys=ON");
    runMigrations(db);
    db.run(`INSERT INTO datasets (name, created_at) VALUES ('Test', '2024-01-01')`);
    db.run(`INSERT INTO plays
      (dataset_id, ts, ms_played, content_type, track_name, artist_name, album_name, spotify_track_uri)
      VALUES
      (1, '2024-01-15T10:00:00Z', 200000, 'track', 'Track A', 'Artist X', 'Album 1', 'spotify:track:aaa'),
      (1, '2024-01-20T10:00:00Z', 180000, 'track', 'Track B', 'Artist X', 'Album 1', 'spotify:track:bbb'),
      (1, '2024-02-10T10:00:00Z', 150000, 'track', 'Track C', 'Artist Y', 'Album 2', 'spotify:track:ccc'),
      (1, '2025-03-05T10:00:00Z', 300000, 'track', 'Track D', 'Artist Z', 'Album 3', 'spotify:track:ddd')`);
    // podcast — must be excluded
    db.run(`INSERT INTO plays (dataset_id, ts, ms_played, content_type, episode_name, episode_show_name, spotify_episode_uri)
      VALUES (1, '2024-01-25T08:00:00Z', 9999999, 'episode', 'Ep 1', 'Show Z', 'spotify:episode:ep1')`);
  });

  afterEach(() => db.close());

  it("returns monthly periods by default sorted ASC", async () => {
    const res = handleGetTimeline(db, makeReq("/api/stats/timeline"));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.granularity).toBe("month");
    expect(body.points.map((p: any) => p.period)).toEqual(["2024-01", "2024-02", "2025-03"]);
  });

  it("aggregates ms_played correctly per period", async () => {
    const res = handleGetTimeline(db, makeReq("/api/stats/timeline"));
    const body = await res.json();
    const jan = body.points.find((p: any) => p.period === "2024-01");
    expect(jan.total_ms_played).toBe(380000);  // 200000 + 180000 (podcast excluded)
    const feb = body.points.find((p: any) => p.period === "2024-02");
    expect(feb.total_ms_played).toBe(150000);
  });

  it("granularity=week groups by week", async () => {
    const res = handleGetTimeline(db, makeReq("/api/stats/timeline?granularity=week"));
    const body = await res.json();
    expect(body.granularity).toBe("week");
    body.points.forEach((p: any) => expect(p.period).toMatch(/^\d{4}-W\d{2}$/));
    expect(body.points.length).toBeGreaterThan(0);
  });

  it("granularity=year groups by year", async () => {
    const res = handleGetTimeline(db, makeReq("/api/stats/timeline?granularity=year"));
    const body = await res.json();
    expect(body.granularity).toBe("year");
    expect(body.points.map((p: any) => p.period)).toEqual(["2024", "2025"]);
    const p2024 = body.points.find((p: any) => p.period === "2024");
    expect(p2024.total_ms_played).toBe(530000);
  });

  it("filters by year param", async () => {
    const res = handleGetTimeline(db, makeReq("/api/stats/timeline?year=2024"));
    const body = await res.json();
    expect(body.points.every((p: any) => p.period.startsWith("2024"))).toBe(true);
    expect(body.points.map((p: any) => p.period)).toEqual(["2024-01", "2024-02"]);
  });

  it("filters by dataset_id", async () => {
    db.run(`INSERT INTO datasets (name, created_at) VALUES ('Other', '2025-01-01')`);
    db.run(`INSERT INTO plays (dataset_id, ts, ms_played, content_type, track_name, artist_name, album_name, spotify_track_uri)
      VALUES (2, '2025-01-10T10:00:00Z', 500000, 'track', 'X', 'Z', 'AlbumZ', 'spotify:track:zzz')`);
    const res = handleGetTimeline(db, makeReq("/api/stats/timeline?dataset_id=2"));
    const body = await res.json();
    expect(body.points).toHaveLength(1);
    expect(body.points[0].period).toBe("2025-01");
  });

  it("returns 400 for invalid granularity", async () => {
    const res = handleGetTimeline(db, makeReq("/api/stats/timeline?granularity=decade"));
    expect(res.status).toBe(400);
  });

  it("returns empty array when no data", async () => {
    db.run("DELETE FROM plays");
    const res = handleGetTimeline(db, makeReq("/api/stats/timeline"));
    const body = await res.json();
    expect(body.points).toHaveLength(0);
  });
});

