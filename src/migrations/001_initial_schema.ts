import type { Database } from "bun:sqlite";

export const version = 1;

export function up(db: Database): void {
  db.run(`
    CREATE TABLE schema_version (
      version    INTEGER NOT NULL,
      applied_at TEXT NOT NULL
    )
  `);

  db.run(`
    CREATE TABLE datasets (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      name        TEXT NOT NULL,
      description TEXT,
      created_at  TEXT NOT NULL,
      source_path TEXT
    )
  `);

  db.run(`
    CREATE TABLE plays (
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      dataset_id       INTEGER NOT NULL REFERENCES datasets(id) ON DELETE CASCADE,
      ts               TEXT NOT NULL,
      platform         TEXT,
      ms_played        INTEGER NOT NULL DEFAULT 0,
      conn_country     TEXT,
      ip_addr          TEXT,
      content_type     TEXT NOT NULL,

      track_name       TEXT,
      artist_name      TEXT,
      album_name       TEXT,
      spotify_track_uri TEXT,

      episode_name      TEXT,
      episode_show_name TEXT,
      spotify_episode_uri TEXT,

      audiobook_title       TEXT,
      audiobook_uri         TEXT,
      audiobook_chapter_uri TEXT,
      audiobook_chapter_title TEXT,

      reason_start     TEXT,
      reason_end       TEXT,
      shuffle          INTEGER,
      skipped          INTEGER,
      offline          INTEGER,
      offline_timestamp INTEGER,
      incognito_mode   INTEGER,

      album_slug  TEXT,
      artist_slug TEXT,
      track_slug  TEXT
    )
  `);

  db.run(`CREATE INDEX plays_ts ON plays(ts)`);
  db.run(`CREATE INDEX plays_track_uri ON plays(spotify_track_uri)`);
  db.run(`CREATE INDEX plays_dataset ON plays(dataset_id)`);
  db.run(`CREATE INDEX plays_content_type ON plays(content_type)`);
  db.run(`CREATE INDEX plays_album_slug ON plays(album_slug)`);
  db.run(`CREATE INDEX plays_artist_slug ON plays(artist_slug)`);
  db.run(`CREATE INDEX plays_track_slug ON plays(track_slug)`);

  db.run(`
    CREATE TABLE metadata_overrides (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      entity_type TEXT NOT NULL,
      entity_key  TEXT NOT NULL,
      field       TEXT NOT NULL,
      value       TEXT,
      updated_at  TEXT NOT NULL,
      UNIQUE(entity_type, entity_key, field)
    )
  `);

  db.run(`CREATE INDEX overrides_lookup ON metadata_overrides(entity_type, entity_key, field)`);

  db.run(`
    CREATE TABLE album_art (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      entity_type TEXT NOT NULL,
      entity_key  TEXT NOT NULL,
      data        BLOB,
      mime_type   TEXT,
      source      TEXT,
      fetched_at  TEXT,
      UNIQUE(entity_type, entity_key)
    )
  `);
}
