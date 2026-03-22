import type { Database } from "bun:sqlite";
import { toSlug, SlugRegistry } from "../lib/slugs";

export const version = 2;

export function up(db: Database): void {
  db.run(`ALTER TABLE plays ADD COLUMN album_slug TEXT`);
  db.run(`ALTER TABLE plays ADD COLUMN artist_slug TEXT`);
  db.run(`ALTER TABLE plays ADD COLUMN track_slug TEXT`);

  // ---- Album slugs (based on album_name only, not artist) ----
  interface AlbumRecord {
    album_norm: string;
    artist_norm: string;
    album_raw: string;
  }
  const albumRows = db.query<AlbumRecord, []>(`
    SELECT
      lower(trim(COALESCE(album_name,''))) AS album_norm,
      lower(trim(COALESCE(artist_name,''))) AS artist_norm,
      MIN(album_name) AS album_raw
    FROM plays
    WHERE content_type = 'track'
      AND album_name IS NOT NULL AND album_name != ''
    GROUP BY album_norm, artist_norm
    ORDER BY MIN(id)
  `).all();

  const albumRegistry = new SlugRegistry();
  const albumKeyToSlug = new Map<string, string>();
  const albumUpdate = db.prepare(
    `UPDATE plays SET album_slug = ?
     WHERE lower(trim(COALESCE(album_name,''))) = ?
       AND lower(trim(COALESCE(artist_name,''))) = ?`
  );

  db.transaction(() => {
    for (const row of albumRows) {
      const key = `${row.album_norm}||${row.artist_norm}`;
      const slug = albumRegistry.getOrAssign(key, toSlug(row.album_raw));
      albumKeyToSlug.set(key, slug);
      albumUpdate.run(slug, row.album_norm, row.artist_norm);
    }
  })();

  // ---- Artist slugs ----
  interface ArtistRecord {
    artist_norm: string;
    artist_raw: string;
  }
  const artistRows = db.query<ArtistRecord, []>(`
    SELECT
      lower(trim(COALESCE(artist_name,''))) AS artist_norm,
      MIN(artist_name) AS artist_raw
    FROM plays
    WHERE content_type = 'track'
      AND artist_name IS NOT NULL AND artist_name != ''
    GROUP BY artist_norm
    ORDER BY MIN(id)
  `).all();

  const artistRegistry = new SlugRegistry();
  const artistKeyToSlug = new Map<string, string>();
  const artistUpdate = db.prepare(
    `UPDATE plays SET artist_slug = ?
     WHERE lower(trim(COALESCE(artist_name,''))) = ?`
  );

  db.transaction(() => {
    for (const row of artistRows) {
      const slug = artistRegistry.getOrAssign(row.artist_norm, toSlug(row.artist_raw));
      artistKeyToSlug.set(row.artist_norm, slug);
      artistUpdate.run(slug, row.artist_norm);
    }
  })();

  // ---- Track slugs ----
  // URI tracks: slug = lowercased Spotify track ID (strip "spotify:track:" prefix)
  db.run(`
    UPDATE plays
    SET track_slug = lower(replace(spotify_track_uri, 'spotify:track:', ''))
    WHERE spotify_track_uri IS NOT NULL AND spotify_track_uri LIKE 'spotify:track:%'
  `);

  // Non-URI tracks: name-based slugs (deduplicated separately from URI tracks)
  interface NonUriRecord {
    track_norm: string;
    artist_norm: string;
    album_norm: string;
    track_raw: string;
  }
  const nonUriRows = db.query<NonUriRecord, []>(`
    SELECT
      lower(trim(COALESCE(track_name,''))) AS track_norm,
      lower(trim(COALESCE(artist_name,''))) AS artist_norm,
      lower(trim(COALESCE(album_name,''))) AS album_norm,
      MIN(track_name) AS track_raw
    FROM plays
    WHERE spotify_track_uri IS NULL
      AND content_type = 'track'
      AND track_name IS NOT NULL AND track_name != ''
    GROUP BY track_norm, artist_norm, album_norm
    ORDER BY MIN(id)
  `).all();

  const trackRegistry = new SlugRegistry();
  const trackKeyToSlug = new Map<string, string>();
  const trackUpdate = db.prepare(
    `UPDATE plays SET track_slug = ?
     WHERE spotify_track_uri IS NULL
       AND lower(trim(COALESCE(track_name,''))) = ?
       AND lower(trim(COALESCE(artist_name,''))) = ?
       AND lower(trim(COALESCE(album_name,''))) = ?`
  );

  db.transaction(() => {
    for (const row of nonUriRows) {
      const key = `${row.track_norm}||${row.artist_norm}||${row.album_norm}`;
      const slug = trackRegistry.getOrAssign(key, toSlug(row.track_raw));
      trackKeyToSlug.set(key, slug);
      trackUpdate.run(slug, row.track_norm, row.artist_norm, row.album_norm);
    }
  })();

  // ---- Migrate metadata_overrides to use slugs as entity_key ----
  db.transaction(() => {
    for (const [oldKey, newSlug] of albumKeyToSlug) {
      db.run(
        `UPDATE metadata_overrides SET entity_key = ? WHERE entity_type = 'album' AND entity_key = ?`,
        [newSlug, oldKey],
      );
    }
    for (const [oldKey, newSlug] of artistKeyToSlug) {
      db.run(
        `UPDATE metadata_overrides SET entity_key = ? WHERE entity_type = 'artist' AND entity_key = ?`,
        [newSlug, oldKey],
      );
    }
    // URI track overrides: strip "spotify:track:" prefix and lowercase
    db.run(`
      UPDATE metadata_overrides
      SET entity_key = lower(replace(entity_key, 'spotify:track:', ''))
      WHERE entity_type = 'track' AND entity_key LIKE 'spotify:track:%'
    `);
    for (const [oldKey, newSlug] of trackKeyToSlug) {
      db.run(
        `UPDATE metadata_overrides SET entity_key = ? WHERE entity_type = 'track' AND entity_key = ?`,
        [newSlug, oldKey],
      );
    }
  })();

  db.run(`CREATE INDEX plays_album_slug ON plays(album_slug)`);
  db.run(`CREATE INDEX plays_artist_slug ON plays(artist_slug)`);
  db.run(`CREATE INDEX plays_track_slug ON plays(track_slug)`);
}
