# Spotify Data Cruncher — Application Plan

## Overview

Spotify provides downloadable historical listening data (via account privacy settings) in a set of JSON files that are not user-friendly. This application ingests that data into a local SQLite database and presents a rich UI for exploring and annotating listening history.

The primary use case is browsing through all-time listening history — especially by album — to rediscover and evaluate music the user has listened to. Additional use cases include stats/dashboards, filtering by date/artist/content type, and adding personal metadata (ratings, notes, genre corrections).

---

## Tech Stack

| Layer | Technology |
|---|---|
| Runtime & Server | Bun (v1.x) |
| Frontend | React 19 + TypeScript |
| Styling | Tailwind CSS v4 + Radix UI primitives |
| Component library | shadcn/ui (already scaffolded) |
| Database | SQLite via `bun:sqlite` |
| Build/Packaging | `bun build --compile` (single executable) |
| CI/CD | GitHub Actions |
| Release hosting | GitHub Releases (`DSurguy/spotify-data-cruncher`) |

The application is a full-stack local web app: Bun serves both the HTTP API and the compiled React frontend on `localhost`. There is no authentication — it is a single-user local tool.

---

## Architecture

```
spotify-data-cruncher (binary)
  ├── Bun HTTP server
  │     ├── Serves compiled React SPA (index.html + assets)
  │     └── REST API routes (/api/*)
  └── SQLite database
        └── Stored in OS user data directory
```

### Data Directory

The database file and any cached assets (e.g. album art) are stored in the OS user data directory:

- **Linux:** `~/.local/share/spotify-data-cruncher/`
- **Windows:** `%APPDATA%\spotify-data-cruncher\`

Resolved at runtime using environment variables (`HOME`, `APPDATA`).

The database filename is `data.db`. On first launch, the database is created and schema migrations are applied.

### Application Lifecycle

1. Binary launches, opens/creates SQLite database, runs any pending migrations.
2. Silently checks GitHub releases API for a newer version.
3. Starts Bun HTTP server on a configurable port (default: `4242`).
4. Opens the system browser (or prints the URL) pointing to the local server.
5. Frontend loads; if a newer version was found, a persistent update indicator appears in the navigation bar.

---

## Data Model

### Source Data Format

Spotify exports streaming history as one or more JSON files. Each file contains an array of play event objects. All files across an export share the same schema:

| Field | Type | Description |
|---|---|---|
| `ts` | string (ISO 8601 UTC) | Timestamp when playback ended |
| `platform` | string | Device/platform string (e.g. `"web_player osx 10.14;firefox 69.0;desktop"`, `"android"`, `"windows"`) |
| `ms_played` | number | Milliseconds of audio actually played (0 to ~13,000,000 in sample data) |
| `conn_country` | string | Two-letter country code |
| `ip_addr` | string | IP address at time of play |
| `master_metadata_track_name` | string\|null | Track name (non-null for music) |
| `master_metadata_album_artist_name` | string\|null | Album artist name (non-null for music) |
| `master_metadata_album_album_name` | string\|null | Album name (non-null for music) |
| `spotify_track_uri` | string\|null | Spotify URI (e.g. `spotify:track:abc123`) |
| `episode_name` | string\|null | Podcast episode name (non-null for podcasts) |
| `episode_show_name` | string\|null | Podcast show name (non-null for podcasts) |
| `spotify_episode_uri` | string\|null | Podcast episode URI |
| `audiobook_title` | string\|null | Audiobook title (non-null for audiobooks) |
| `audiobook_uri` | string\|null | Audiobook URI |
| `audiobook_chapter_uri` | string\|null | Chapter URI |
| `audiobook_chapter_title` | string\|null | Chapter title |
| `reason_start` | string\|null | Why playback started: `appload`, `backbtn`, `clickrow`, `fwdbtn`, `playbtn`, `remote`, `trackdone`, `trackerror`, `unknown` |
| `reason_end` | string\|null | Why playback ended: `backbtn`, `endplay`, `fwdbtn`, `logout`, `remote`, `trackdone`, `trackerror`, `unexpected-exit`, `unexpected-exit-while-paused`, `unknown` |
| `shuffle` | boolean | Whether shuffle was active |
| `skipped` | boolean\|null | Whether the track was skipped |
| `offline` | boolean\|null | Whether played offline |
| `offline_timestamp` | number\|null | Unix timestamp when track was cached for offline |
| `incognito_mode` | boolean | Whether private session was active |

### Content Type Detection

Determined at import time by checking which URI/name fields are non-null:

| Content Type | Condition |
|---|---|
| `track` | `spotify_track_uri` is non-null |
| `episode` | `spotify_episode_uri` is non-null |
| `audiobook` | `audiobook_uri` is non-null |
| `unknown` | All URIs are null |

---

## SQLite Schema

### `schema_version`
```sql
CREATE TABLE schema_version (
  version INTEGER NOT NULL,
  applied_at TEXT NOT NULL  -- ISO 8601
);
```
Tracks applied migrations. The current version is the MAX(version).

---

### `datasets`
```sql
CREATE TABLE datasets (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  name      TEXT NOT NULL,
  description TEXT,
  created_at TEXT NOT NULL,  -- ISO 8601
  source_path TEXT           -- original import path, informational only
);
```
Supports multiple named imports. The UI allows switching between datasets or viewing all combined.

---

### `plays`
Raw play events. One row per JSON record, preserving all source fields.

```sql
CREATE TABLE plays (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  dataset_id       INTEGER NOT NULL REFERENCES datasets(id) ON DELETE CASCADE,
  ts               TEXT NOT NULL,       -- ISO 8601 UTC, indexed
  platform         TEXT,
  ms_played        INTEGER NOT NULL DEFAULT 0,
  conn_country     TEXT,
  ip_addr          TEXT,
  content_type     TEXT NOT NULL,       -- 'track' | 'episode' | 'audiobook' | 'unknown'

  -- Track fields
  track_name       TEXT,
  artist_name      TEXT,
  album_name       TEXT,
  spotify_track_uri TEXT,               -- indexed

  -- Podcast fields
  episode_name     TEXT,
  episode_show_name TEXT,
  spotify_episode_uri TEXT,

  -- Audiobook fields
  audiobook_title  TEXT,
  audiobook_uri    TEXT,
  audiobook_chapter_uri TEXT,
  audiobook_chapter_title TEXT,

  -- Playback metadata
  reason_start     TEXT,
  reason_end       TEXT,
  shuffle          INTEGER,             -- 0/1
  skipped          INTEGER,            -- 0/1/NULL
  offline          INTEGER,            -- 0/1/NULL
  offline_timestamp INTEGER,
  incognito_mode   INTEGER             -- 0/1
);

CREATE INDEX plays_ts ON plays(ts);
CREATE INDEX plays_track_uri ON plays(spotify_track_uri);
CREATE INDEX plays_dataset ON plays(dataset_id);
CREATE INDEX plays_content_type ON plays(content_type);
```

---

### `metadata_overrides`
Non-destructive user-applied corrections. These override display values without altering raw play records. Applied at query time by joining on `entity_type` + `entity_key`.

```sql
CREATE TABLE metadata_overrides (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  entity_type  TEXT NOT NULL,  -- 'track' | 'album' | 'artist' | 'episode' | 'show'
  entity_key   TEXT NOT NULL,  -- URI for tracks/episodes, or normalized name for albums/artists
  field        TEXT NOT NULL,  -- 'name' | 'artist' | 'album' | 'genre' | 'rating' | 'notes' | 'art_path'
  value        TEXT,           -- JSON-encoded value (string, number, or null to clear)
  updated_at   TEXT NOT NULL,  -- ISO 8601
  UNIQUE(entity_type, entity_key, field)
);

CREATE INDEX overrides_lookup ON metadata_overrides(entity_type, entity_key);
```

**Supported override fields by entity type:**

| Entity Type | Overrideable Fields |
|---|---|
| `track` | `name`, `album`, `artist`, `genre`, `rating` (1–5 or null), `notes`, `art_path` |
| `album` | `name`, `artist`, `genre`, `rating`, `notes`, `art_path` |
| `artist` | `name`, `genre`, `notes` |
| `episode` | `name`, `notes`, `rating` |
| `show` | `name`, `genre`, `notes` |

Rating is a number 1–5 (optionally null = unrated). `art_path` is a relative path inside the data directory where a user-supplied image has been saved.

---

### `album_art`
Cached album art fetched from Spotify or uploaded by the user.

```sql
CREATE TABLE album_art (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  entity_type TEXT NOT NULL,   -- 'track' | 'album' | 'artist'
  entity_key  TEXT NOT NULL,   -- URI or normalized name
  data        BLOB,            -- raw image bytes (PNG/JPEG)
  mime_type   TEXT,
  source      TEXT,            -- 'spotify' | 'user_upload'
  fetched_at  TEXT,
  UNIQUE(entity_type, entity_key)
);
```

Album art is stored as BLOBs in the database. The API exposes them as `/api/art/:type/:key`.

---

## Data Ingestion

### Import Flow

1. User selects an import source in the UI: a `.zip` file or a directory path.
2. If a `.zip`, it is extracted to a temporary directory.
3. All files matching `Streaming_History_*.json` in the source are enumerated.
4. User is prompted to give the dataset a name (default: the folder/zip name and current date).
5. Files are parsed and validated. Any records with unrecognized structure are logged and skipped.
6. Records are inserted in a transaction. Progress is reported via a streaming API response or polling endpoint.
7. On success, the dataset record is created and the user is redirected to the dataset view.

### Deduplication

On re-import of an existing dataset (same name), the user is warned and given the option to:
- **Replace:** delete all existing plays for that dataset and re-import.
- **Append:** insert only new records (deduplicated by `ts` + `spotify_track_uri`/`spotify_episode_uri`).
- **Cancel.**

### Normalization

`artist_name` and `album_name` are stored as-is from the source JSON (raw strings). Normalized keys for metadata overrides are lowercased + trimmed versions of these strings. URIs (where present) are preferred as entity keys over names.

---

## API Routes

All routes are prefixed with `/api`.

### Datasets
| Method | Path | Description |
|---|---|---|
| `GET` | `/api/datasets` | List all datasets |
| `POST` | `/api/datasets/import` | Begin import (multipart: zip or path) |
| `GET` | `/api/datasets/:id/import-status` | Poll import progress |
| `PATCH` | `/api/datasets/:id` | Rename / update description |
| `DELETE` | `/api/datasets/:id` | Delete dataset and all its plays |

### Plays
| Method | Path | Description |
|---|---|---|
| `GET` | `/api/plays` | Paginated play list with filters (see below) |

**Query parameters for `/api/plays`:**
- `dataset_id` — filter to one dataset (omit for all)
- `content_type` — `track`, `episode`, `audiobook`
- `from` — ISO 8601 start date (inclusive)
- `to` — ISO 8601 end date (inclusive)
- `artist` — exact or partial match on artist name
- `album` — exact or partial match on album name
- `track` — partial match on track name
- `skipped` — `true`/`false`
- `min_ms` — minimum ms_played (e.g. `30000` to exclude short plays)
- `shuffle` — `true`/`false`
- `sort` — `ts_asc`, `ts_desc`, `ms_played_desc` (default: `ts_desc`)
- `page`, `page_size` (default 100)

### Albums
| Method | Path | Description |
|---|---|---|
| `GET` | `/api/albums` | List albums with aggregate stats |
| `GET` | `/api/albums/:key` | Single album detail + all plays |

**`/api/albums` query parameters:**
- `dataset_id`, `from`, `to`, `artist`, `content_type`
- `sort` — `name_asc`, `name_desc`, `play_count_desc`, `total_ms_desc`, `last_played_desc`, `artist_asc`, `rating_desc`
- `rated` — `true` (only albums with a rating)
- `page`, `page_size`

Response includes per-album: `album_name`, `artist_name`, `play_count`, `total_ms_played`, `first_played`, `last_played`, `track_count` (unique tracks), `genre` override if set, `rating`, `art_url`.

### Artists
| Method | Path | Description |
|---|---|---|
| `GET` | `/api/artists` | List artists with aggregate stats |
| `GET` | `/api/artists/:key` | Artist detail + all albums and plays |

### Stats / Dashboard
| Method | Path | Description |
|---|---|---|
| `GET` | `/api/stats/summary` | Top-level summary numbers |
| `GET` | `/api/stats/timeline` | Listening time grouped by day/week/month/year |
| `GET` | `/api/stats/top-tracks` | Top tracks by play count or total time |
| `GET` | `/api/stats/top-albums` | Top albums |
| `GET` | `/api/stats/top-artists` | Top artists |
| `GET` | `/api/stats/platforms` | Breakdown by platform |
| `GET` | `/api/stats/heatmap` | Play counts by hour-of-day × day-of-week |

All stats endpoints accept `dataset_id`, `from`, `to`, `content_type` filters.

### Metadata Overrides
| Method | Path | Description |
|---|---|---|
| `GET` | `/api/overrides/:type/:key` | Get all overrides for an entity |
| `PUT` | `/api/overrides/:type/:key` | Set one or more override fields (body: `{field, value}[]`) |
| `DELETE` | `/api/overrides/:type/:key/:field` | Remove a specific override |

### Album Art
| Method | Path | Description |
|---|---|---|
| `GET` | `/api/art/:type/:key` | Serve art image (from DB blob) |
| `POST` | `/api/art/:type/:key` | Upload user-provided image (multipart) |

### Updates
| Method | Path | Description |
|---|---|---|
| `GET` | `/api/update/status` | Returns `{ current, latest, update_available, release_url, release_notes }` |
| `POST` | `/api/update/apply` | Downloads and replaces the running binary, then restarts |

---

## Frontend — Pages & Views

The app is a single-page React application with a persistent sidebar/navigation.

### Navigation Structure

```
Sidebar
  ├── Dashboard
  ├── Browse
  │     ├── Albums
  │     ├── Artists
  │     ├── Tracks
  │     └── Podcasts
  ├── History (raw play log)
  ├── Datasets
  └── Settings
        └── [Update indicator badge if update available]
```

If an update is available, a small badge or dot appears on the Settings nav item (no modal popup).

---

### Dashboard

Displays a summary of the selected dataset (or all datasets combined):

- **Summary cards:** Total play time (hours), Total plays, Unique tracks, Unique albums, Unique artists, Date range of data
- **Listening timeline chart:** Total minutes listened per week or month (bar or area chart), filterable to year
- **Top 10 Artists** (by total listening time)
- **Top 10 Albums** (by total listening time)
- **Top 10 Tracks** (by play count)
- **Heatmap:** Hour-of-day × day-of-week listening intensity
- **Platform breakdown:** Pie chart of plays by platform category (mobile, desktop, web, cast, other)

---

### Albums View (Primary Use Case)

A full-page browseable grid or list of albums with powerful sorting and filtering — designed for the user to methodically crawl through their entire listening history.

**Columns / Card fields:**
- Album art (thumbnail, or placeholder if none)
- Album name
- Artist name
- Genre (override if set, else blank)
- Total plays
- Total listening time
- First listened / Last listened dates
- Rating (1–5 stars, inline editable)
- Notes indicator (paperclip icon if notes exist)

**Sort options:** Album name A–Z, Artist A–Z, Most played, Most time, Last played (recent first / oldest first), Rating (highest first), Unrated first

**Filter options:**
- Artist name (text search)
- Album name (text search)
- Genre
- Rating filter (≥ N stars, or "Unrated only")
- Date range (first or last played)
- Content type (track / podcast / audiobook)
- Dataset

**Album Detail Panel / Page:**
Opens when an album is clicked. Shows:
- Large album art (with upload button)
- Album name (editable via metadata override)
- Artist name (editable)
- Genre (editable)
- Rating (star widget)
- Notes (freeform text area)
- All tracks on this album with per-track play count + total time
- Full play history for this album (paginated, sortable by date)

---

### Artists View

Same pattern as Albums. Each artist row shows total plays, total time, number of albums, date range, rating, notes. Clicking opens artist detail with all their albums listed.

---

### Tracks View

Searchable, sortable table of all unique tracks:
- Track name, Artist, Album, Play count, Total time, Last played, Skip rate (skipped plays / total plays × 100%), Rating, Notes

---

### Podcasts View

Separate view for podcast episodes and shows, grouped by show. Shows: show name, episode count heard, total time, date range.

---

### History View (Raw Play Log)

Paginated table of all individual play events. Columns:
- Date/time, Track/episode name, Artist, Album, Duration played, Platform, Reason start, Reason end, Skipped, Shuffle, Offline

Full filter bar matching the `/api/plays` query parameters. Useful for detailed forensics.

---

### Datasets Page

- List all imported datasets with name, date imported, record count, date range.
- Import new dataset button (opens file picker for zip or directory).
- Rename / delete existing datasets.
- Import progress UI (progress bar + current file being processed).

---

### Settings Page

- **App version** and last update check timestamp.
- **Update status:** If an update is available, shows current vs. latest version, release notes excerpt, and an "Update Now" button. If up to date, shows "Up to date."
- **Data directory path** (read-only display).
- **Server port** configuration (requires restart).

---

## Metadata Override System

The override system is non-destructive: raw imported play records are never modified. Overrides are stored separately and applied at query time.

### How Overrides Are Applied

Backend query logic:
1. Raw data is fetched from `plays`.
2. For each unique entity (track URI, album name, artist name), left-join `metadata_overrides` on `(entity_type, entity_key)`.
3. Override values replace the raw field values in the response.

### Entity Key Strategy

- **Tracks:** `spotify_track_uri` (e.g. `spotify:track:abc123`) — stable and unambiguous.
- **Episodes:** `spotify_episode_uri`
- **Albums:** `lower(trim(album_name)) + '||' + lower(trim(artist_name))` — since Spotify export does not include album URIs.
- **Artists:** `lower(trim(artist_name))`
- **Shows:** `lower(trim(episode_show_name))`

### Editable Fields

| Field | Type | Notes |
|---|---|---|
| `name` | string | Corrected display name |
| `artist` | string | Corrected artist attribution |
| `album` | string | Corrected album name |
| `genre` | string | User-defined genre tag |
| `rating` | integer (1–5) or null | Personal rating |
| `notes` | string | Freeform personal notes |
| `art_path` | string | Key into `album_art` table |

---

## Multiple Dataset Support

- Each Spotify export import creates a new `dataset` record.
- All plays are tagged with `dataset_id`.
- The UI top-bar includes a dataset selector (`All Datasets` or a specific one).
- All API queries accept an optional `dataset_id` to scope results.
- Stats, browse views, and history all respect the selected dataset filter.
- Datasets can be individually deleted (cascades to plays).

---

## Build & Packaging

### Single Executable

Built with `bun build --compile`:

```bash
# Linux
bun build ./src/index.ts --compile --outfile dist/spotify-data-cruncher-linux

# Windows
bun build ./src/index.ts --compile --target=bun-windows-x64 --outfile dist/spotify-data-cruncher-windows.exe
```

The compiled binary includes the Bun runtime, all server code, and all bundled frontend assets (JS, CSS, HTML). No external dependencies required.

### Embedding Frontend Assets

Frontend assets are embedded using Bun's static file serving via `import` of `index.html` (already demonstrated in `src/index.ts`). All CSS and JS bundles are referenced from the HTML and bundled at build time.

### Version Embedding

The app version (`MAJOR.MINOR.PATCH`) is embedded at build time via a `--define` flag:

```bash
bun build ... --define 'APP_VERSION="1.0.0"'
```

Accessed in code as the global `APP_VERSION`. The CI pipeline sets this from the git tag.

---

## Self-Update Mechanism

### Update Check

On startup, the server makes a single GET request to:
```
https://api.github.com/repos/DSurguy/spotify-data-cruncher/releases/latest
```

The response is compared against the embedded `APP_VERSION`. If the latest tag version is greater (semver comparison), the update is noted in memory and returned by `/api/update/status`.

This check is non-blocking. If the request fails (no internet, rate limit, etc.), the app starts normally with no error shown.

### Update UI

- Settings page always shows current version + last check time.
- If an update is available: Settings nav item shows a small indicator dot. Settings page shows a "New version available" box with version number, release notes (from GitHub release body), and an "Update Now" button.
- No modal/popup interrupts the user.

### Update Apply

When the user clicks "Update Now":
1. The server downloads the appropriate binary artifact from the GitHub release assets (matched by platform: linux or windows).
2. The downloaded binary is verified (file size or checksum if provided in release assets).
3. The current executable is replaced with the new binary (using a rename/swap strategy to avoid Windows file-lock issues).
4. The server sends a response to the frontend, then exits.
5. The frontend shows a "Relaunch the application to complete the update" message.
6. On next launch, the new binary runs migrations if needed.

---

## Data Migrations

Schema changes between versions are handled by a sequential migration system.

### Migration Execution

1. On startup, read `MAX(version)` from `schema_version` (0 if table doesn't exist).
2. Execute all migration scripts with version > current in order.
3. Each migration runs in a transaction. On failure, roll back and surface an error.
4. On success, insert a row into `schema_version`.

### Migration Files

Migrations live in `src/migrations/` as numbered TypeScript files:

```
src/migrations/
  001_initial_schema.ts
  002_add_album_art.ts
  ...
```

Each migration exports:
```typescript
export const version = 1;
export function up(db: Database): void { ... }
```

---

## GitHub Actions CI/CD

On push of a version tag (`v*.*.*`):

1. Check out repo.
2. Install Bun.
3. Build Linux binary: `bun build --compile --define APP_VERSION=...`
4. Build Windows binary (cross-compile via Bun's `--target` flag).
5. Create a GitHub Release with the tag, auto-generated release notes.
6. Upload both binaries as release assets.

---

## Open Questions / Future Considerations

- **Album art fetching:** The current plan stores user-uploaded art only. Future: optionally fetch art from the Spotify Web API (requires OAuth), or from MusicBrainz/Cover Art Archive (no auth needed).
- **Export/report:** Allow exporting filtered data as CSV.
- **Comparison view:** Side-by-side comparison of two datasets (e.g. two different users' listening history).
- **Podcast browsing:** Podcasts are a small fraction of data in the sample (~0.1%), but a dedicated show/episode browser is included for completeness.
- **Short play filtering:** ~3,850 plays in sample data are under 30 seconds. The UI should offer a default filter toggle to hide or show these (likely accidental plays or skips).