import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { LinkButton, NavLabel } from "@/components/ui/link-button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Artist, Album, Track, GetAlbumsResponse, GetTracksResponse } from "@/types/api";

function formatDuration(ms: number): string {
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

type AlbumSort = "total_ms_desc" | "play_count_desc" | "name_asc" | "last_played_desc";
type TrackSort = "total_ms_desc" | "play_count_desc" | "name_asc" | "last_played_desc";

interface ArtistDetailProps {
  artistKey: string;
  onClose: () => void;
  onAlbumSelect: (key: string) => void;
  onTrackSelect: (key: string) => void;
}

export function ArtistDetail({ artistKey, onClose, onAlbumSelect, onTrackSelect }: ArtistDetailProps) {
  const [artist, setArtist] = useState<Artist | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"albums" | "tracks">("albums");

  // Albums tab state
  const [albums, setAlbums] = useState<Album[]>([]);
  const [albumTotal, setAlbumTotal] = useState(0);
  const [albumSearchDraft, setAlbumSearchDraft] = useState("");
  const [albumSearch, setAlbumSearch] = useState("");
  const [albumSort, setAlbumSort] = useState<AlbumSort>("total_ms_desc");
  const [albumPage, setAlbumPage] = useState(1);
  const [albumLoading, setAlbumLoading] = useState(false);
  const ALBUM_PAGE_SIZE = 50;

  // Tracks tab state
  const [tracks, setTracks] = useState<Track[]>([]);
  const [trackTotal, setTrackTotal] = useState(0);
  const [trackSearchDraft, setTrackSearchDraft] = useState("");
  const [trackSearch, setTrackSearch] = useState("");
  const [trackSort, setTrackSort] = useState<TrackSort>("total_ms_desc");
  const [trackPage, setTrackPage] = useState(1);
  const [trackLoading, setTrackLoading] = useState(false);
  const TRACK_PAGE_SIZE = 50;

  useEffect(() => {
    setLoading(true);
    fetch(`/api/artists/${encodeURIComponent(artistKey)}`)
      .then(r => r.json())
      .then((body: Artist) => {
        setArtist(body);
        setLoading(false);
      });
  }, [artistKey]);

  const loadAlbums = useCallback(async (artistName: string) => {
    setAlbumLoading(true);
    const params = new URLSearchParams({
      artist: artistName,
      sort: albumSort,
      page: String(albumPage),
      page_size: String(ALBUM_PAGE_SIZE),
    });
    if (albumSearch) params.set("album", albumSearch);
    const res = await fetch(`/api/albums?${params}`);
    const body: GetAlbumsResponse = await res.json();
    setAlbums(body.albums);
    setAlbumTotal(body.total);
    setAlbumLoading(false);
  }, [albumSort, albumPage, albumSearch]);

  const loadTracks = useCallback(async (artistName: string) => {
    setTrackLoading(true);
    const params = new URLSearchParams({
      artist: artistName,
      sort: trackSort,
      page: String(trackPage),
      page_size: String(TRACK_PAGE_SIZE),
    });
    if (trackSearch) params.set("track", trackSearch);
    const res = await fetch(`/api/tracks?${params}`);
    const body: GetTracksResponse = await res.json();
    setTracks(body.tracks);
    setTrackTotal(body.total);
    setTrackLoading(false);
  }, [trackSort, trackPage, trackSearch]);

  useEffect(() => {
    if (artist) loadAlbums(artist.artist_name);
  }, [artist, loadAlbums]);

  useEffect(() => {
    if (artist) loadTracks(artist.artist_name);
  }, [artist, loadTracks]);

  if (loading) {
    return (
      <div>
        <Button variant="ghost" size="sm" onClick={onClose}>← Explore</Button>
        <p className="mt-6 text-muted-foreground">Loading…</p>
      </div>
    );
  }

  if (!artist) {
    return (
      <div>
        <Button variant="ghost" size="sm" onClick={onClose}>← Explore</Button>
        <p className="mt-6 text-destructive">Artist not found.</p>
      </div>
    );
  }

  const albumTotalPages = Math.ceil(albumTotal / ALBUM_PAGE_SIZE);
  const trackTotalPages = Math.ceil(trackTotal / TRACK_PAGE_SIZE);

  return (
    <div>
      <Button variant="ghost" size="sm" onClick={onClose} className="mb-4">
        ← Explore
      </Button>

      {/* Header */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold">{artist.artist_name}</h2>
        <div className="flex flex-wrap gap-5 mt-2 text-sm text-muted-foreground">
          <span>{artist.play_count} plays</span>
          <span>{formatDuration(artist.total_ms_played)}</span>
          <span>{artist.album_count} albums</span>
          <span>First: {formatDate(artist.first_played)}</span>
          <span>Last: {formatDate(artist.last_played)}</span>
        </div>
        {artist.genre && <p className="text-sm text-muted-foreground mt-1">{artist.genre}</p>}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b mb-4">
        {(["albums", "tracks"] as const).map(t => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors capitalize ${
              tab === t
                ? "border-foreground text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {t === "albums" ? `Albums (${albumTotal})` : `Tracks (${trackTotal})`}
          </button>
        ))}
      </div>

      {/* Albums tab */}
      {tab === "albums" && (
        <>
          <div className="flex gap-2 mb-3 items-end flex-wrap">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground">Album</label>
              <div className="flex gap-1">
                <Input
                  className="w-44"
                  placeholder="Filter by album…"
                  value={albumSearchDraft}
                  onChange={e => setAlbumSearchDraft(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === "Enter") { setAlbumSearch(albumSearchDraft); setAlbumPage(1); }
                  }}
                />
                <Button size="sm" variant="outline" onClick={() => { setAlbumSearch(albumSearchDraft); setAlbumPage(1); }}>
                  Search
                </Button>
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground">Sort</label>
              <Select value={albumSort} onValueChange={v => { setAlbumSort(v as AlbumSort); setAlbumPage(1); }}>
                <SelectTrigger className="w-40" aria-label="Album sort">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="total_ms_desc">Most playtime</SelectItem>
                  <SelectItem value="play_count_desc">Most plays</SelectItem>
                  <SelectItem value="name_asc">Name A–Z</SelectItem>
                  <SelectItem value="last_played_desc">Recently played</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {albumLoading ? (
            <p className="text-muted-foreground text-sm">Loading…</p>
          ) : albums.length === 0 ? (
            <p className="text-muted-foreground text-sm">No albums found.</p>
          ) : (
            <div className="border rounded-lg overflow-hidden mb-3">
              {albums.map((album, i) => (
                <LinkButton
                  key={album.album_key}
                  className={`gap-3 px-4 py-2 hover:bg-muted/50 ${i > 0 ? "border-t" : ""}`}
                  onClick={() => onAlbumSelect(album.album_key)}
                >
                  <NavLabel className="flex-1 text-sm font-medium truncate min-w-0">{album.album_name}</NavLabel>
                  {album.genre && (
                    <span className="text-xs text-muted-foreground hidden sm:block">{album.genre}</span>
                  )}
                  <span className="text-xs text-muted-foreground tabular-nums shrink-0">{formatDuration(album.total_ms_played)}</span>
                  <span className="text-xs text-muted-foreground tabular-nums shrink-0">{album.play_count}×</span>
                </LinkButton>
              ))}
            </div>
          )}
          {albumTotalPages > 1 && (
            <div className="flex items-center justify-center gap-4 text-sm">
              <Button variant="outline" size="sm" disabled={albumPage <= 1} onClick={() => setAlbumPage(p => p - 1)}>
                Previous
              </Button>
              <span className="text-muted-foreground">{albumPage} / {albumTotalPages}</span>
              <Button variant="outline" size="sm" disabled={albumPage >= albumTotalPages} onClick={() => setAlbumPage(p => p + 1)}>
                Next
              </Button>
            </div>
          )}
        </>
      )}

      {/* Tracks tab */}
      {tab === "tracks" && (
        <>
          <div className="flex gap-2 mb-3 items-end flex-wrap">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground">Track</label>
              <div className="flex gap-1">
                <Input
                  className="w-44"
                  placeholder="Filter by track…"
                  value={trackSearchDraft}
                  onChange={e => setTrackSearchDraft(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === "Enter") { setTrackSearch(trackSearchDraft); setTrackPage(1); }
                  }}
                />
                <Button size="sm" variant="outline" onClick={() => { setTrackSearch(trackSearchDraft); setTrackPage(1); }}>
                  Search
                </Button>
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground">Sort</label>
              <Select value={trackSort} onValueChange={v => { setTrackSort(v as TrackSort); setTrackPage(1); }}>
                <SelectTrigger className="w-40" aria-label="Track sort">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="total_ms_desc">Most playtime</SelectItem>
                  <SelectItem value="play_count_desc">Most plays</SelectItem>
                  <SelectItem value="name_asc">Name A–Z</SelectItem>
                  <SelectItem value="last_played_desc">Recently played</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {trackLoading ? (
            <p className="text-muted-foreground text-sm">Loading…</p>
          ) : tracks.length === 0 ? (
            <p className="text-muted-foreground text-sm">No tracks found.</p>
          ) : (
            <div className="border rounded-lg overflow-hidden mb-3">
              {tracks.map((track, i) => (
                <LinkButton
                  key={track.track_key}
                  className={`gap-3 px-4 py-2 hover:bg-muted/50 ${i > 0 ? "border-t" : ""}`}
                  onClick={() => onTrackSelect(track.track_key)}
                >
                  <NavLabel className="flex-1 text-sm font-medium truncate min-w-0">{track.track_name}</NavLabel>
                  {track.album_name && (
                    <span className="text-xs text-muted-foreground truncate max-w-[140px] hidden sm:block">{track.album_name}</span>
                  )}
                  {track.reviewed && <span className="text-xs text-green-600">✓</span>}
                  <span className="text-xs text-muted-foreground tabular-nums shrink-0">{formatDuration(track.total_ms_played)}</span>
                  <span className="text-xs text-muted-foreground tabular-nums shrink-0">{track.play_count}×</span>
                </LinkButton>
              ))}
            </div>
          )}
          {trackTotalPages > 1 && (
            <div className="flex items-center justify-center gap-4 text-sm">
              <Button variant="outline" size="sm" disabled={trackPage <= 1} onClick={() => setTrackPage(p => p - 1)}>
                Previous
              </Button>
              <span className="text-muted-foreground">{trackPage} / {trackTotalPages}</span>
              <Button variant="outline" size="sm" disabled={trackPage >= trackTotalPages} onClick={() => setTrackPage(p => p + 1)}>
                Next
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
