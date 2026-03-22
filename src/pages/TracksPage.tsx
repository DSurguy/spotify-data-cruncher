import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Track, GetTracksResponse } from "@/types/api";

type TrackSort = "play_count_desc" | "total_ms_desc" | "name_asc" | "last_played_desc" | "skip_rate_desc" | "rating_desc";
type ReviewedFilter = "all" | "reviewed" | "unreviewed";

function formatDuration(ms: number): string {
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function RatingBadge({ value }: { value: "like" | "dislike" | "none" | null }) {
  if (!value || value === "none") return <span className="text-muted-foreground">—</span>;
  return value === "like"
    ? <span className="text-green-600 text-sm">♥</span>
    : <span className="text-red-500 text-sm">✕</span>;
}

interface FilterState {
  track: string;
  artist: string;
  album: string;
  sort: TrackSort;
  reviewed: ReviewedFilter;
}

const DEFAULT_FILTERS: FilterState = { track: "", artist: "", album: "", sort: "play_count_desc", reviewed: "all" };

export function TracksPage({ onTrackSelect }: { onTrackSelect?: (key: string) => void }) {
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [draft, setDraft] = useState<FilterState>(DEFAULT_FILTERS);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const PAGE_SIZE = 50;

  async function toggleReviewed(track: Track) {
    const newVal = !track.reviewed;
    setTracks(prev => prev.map(t =>
      t.track_key === track.track_key ? { ...t, reviewed: newVal } : t
    ));
    if (newVal) {
      await fetch(`/api/overrides/track/${encodeURIComponent(track.track_key)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify([{ field: "reviewed", value: "true" }]),
      });
    } else {
      await fetch(`/api/overrides/track/${encodeURIComponent(track.track_key)}/reviewed`, {
        method: "DELETE",
      });
    }
  }

  const load = useCallback(async (f: FilterState, p: number) => {
    setLoading(true);
    const params = new URLSearchParams({
      sort: f.sort,
      page: String(p),
      page_size: String(PAGE_SIZE),
    });
    if (f.track)  params.set("track", f.track);
    if (f.artist) params.set("artist", f.artist);
    if (f.album)  params.set("album", f.album);
    if (f.reviewed !== "all") params.set("reviewed", f.reviewed === "reviewed" ? "true" : "false");
    const res = await fetch(`/api/tracks?${params}`);
    const body: GetTracksResponse = await res.json();
    setTracks(body.tracks);
    setTotal(body.total ?? 0);
    setLoading(false);
  }, []);

  useEffect(() => { load(filters, page); }, [filters, page, load]);

  function applyFilters() {
    setFilters(draft);
    setPage(1);
  }

  function clearFilters() {
    setDraft(DEFAULT_FILTERS);
    setFilters(DEFAULT_FILTERS);
    setPage(1);
  }

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="max-w-6xl mx-auto">
      <h2 className="text-2xl font-bold mb-6">Tracks</h2>

      {/* Filter bar */}
      <div className="flex flex-wrap gap-3 mb-4 items-end">
        <div className="flex flex-col gap-1">
          <Label htmlFor="filter-track">Track</Label>
          <Input
            id="filter-track"
            className="w-40"
            placeholder="Track name…"
            value={draft.track}
            onChange={e => setDraft(f => ({ ...f, track: e.target.value }))}
            onKeyDown={e => e.key === "Enter" && applyFilters()}
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="filter-artist">Artist</Label>
          <Input
            id="filter-artist"
            className="w-40"
            placeholder="Artist…"
            value={draft.artist}
            onChange={e => setDraft(f => ({ ...f, artist: e.target.value }))}
            onKeyDown={e => e.key === "Enter" && applyFilters()}
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="filter-album">Album</Label>
          <Input
            id="filter-album"
            className="w-40"
            placeholder="Album…"
            value={draft.album}
            onChange={e => setDraft(f => ({ ...f, album: e.target.value }))}
            onKeyDown={e => e.key === "Enter" && applyFilters()}
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label>Sort</Label>
          <Select value={draft.sort} onValueChange={v => setDraft(f => ({ ...f, sort: v as TrackSort }))}>
            <SelectTrigger className="w-44" aria-label="Sort order">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="play_count_desc">Most played</SelectItem>
              <SelectItem value="total_ms_desc">Most time</SelectItem>
              <SelectItem value="name_asc">Name A–Z</SelectItem>
              <SelectItem value="last_played_desc">Recently played</SelectItem>
              <SelectItem value="skip_rate_desc">Highest skip rate</SelectItem>
              <SelectItem value="rating_desc">Highest rated</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1">
          <Label>Reviewed</Label>
          <Select value={draft.reviewed} onValueChange={v => setDraft(f => ({ ...f, reviewed: v as ReviewedFilter }))}>
            <SelectTrigger className="w-36" aria-label="Reviewed filter">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="unreviewed">Unreviewed</SelectItem>
              <SelectItem value="reviewed">Reviewed</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex gap-2">
          <Button onClick={applyFilters}>Apply</Button>
          <Button variant="outline" onClick={clearFilters}>Clear</Button>
        </div>
      </div>

      {/* Results count */}
      <p className="text-sm text-muted-foreground mb-3">
        {loading ? "Loading…" : `${total.toLocaleString()} tracks`}
      </p>

      {/* Table */}
      <div className="rounded-lg border overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="text-left px-3 py-2 font-medium">Track</th>
              <th className="text-left px-3 py-2 font-medium">Artist</th>
              <th className="text-left px-3 py-2 font-medium">Album</th>
              <th className="text-right px-3 py-2 font-medium">Plays</th>
              <th className="text-right px-3 py-2 font-medium">Time</th>
              <th className="text-left px-3 py-2 font-medium">Last played</th>
              <th className="text-right px-3 py-2 font-medium">Skip %</th>
              <th className="text-left px-3 py-2 font-medium">Rating</th>
              <th className="text-center px-3 py-2 font-medium">Reviewed</th>
            </tr>
          </thead>
          <tbody>
            {tracks.map(track => (
              <tr key={track.track_key} className="border-b last:border-0 hover:bg-muted/30">
                <td className="px-3 py-2 max-w-[12rem] truncate font-medium">
                  {onTrackSelect ? (
                    <button
                      type="button"
                      className="hover:underline text-left truncate max-w-full"
                      onClick={() => onTrackSelect(track.track_key)}
                    >
                      {track.track_name}
                    </button>
                  ) : track.track_name}
                </td>
                <td className="px-3 py-2 max-w-[10rem] truncate text-muted-foreground">{track.artist_name}</td>
                <td className="px-3 py-2 max-w-[10rem] truncate text-muted-foreground">{track.album_name ?? "—"}</td>
                <td className="px-3 py-2 text-right tabular-nums">{track.play_count}</td>
                <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap">{formatDuration(track.total_ms_played)}</td>
                <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">{formatDate(track.last_played)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{track.skip_rate}%</td>
                <td className="px-3 py-2"><RatingBadge value={track.rating} /></td>
                <td className="px-3 py-2 text-center">
                  <button
                    aria-label={track.reviewed ? "Mark unreviewed" : "Mark reviewed"}
                    onClick={() => toggleReviewed(track)}
                    className={`text-base leading-none transition-colors ${
                      track.reviewed ? "text-green-500 hover:text-muted-foreground" : "text-muted-foreground hover:text-green-500"
                    }`}
                  >
                    {track.reviewed ? "✓" : "○"}
                  </button>
                </td>
              </tr>
            ))}
            {!loading && tracks.length === 0 && (
              <tr>
                <td colSpan={9} className="px-3 py-8 text-center text-muted-foreground">No tracks found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center gap-3 mt-4">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
            Previous
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {page} of {totalPages}
          </span>
          <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
