import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Play, GetPlaysResponse } from "@/types/api";

type PlaySort = "ts_desc" | "ts_asc" | "ms_played_desc";

function formatDuration(ms: number): string {
  if (ms < 60_000) return `${Math.round(ms / 1000)}s`;
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    year: "numeric", month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function titleFor(play: Play): string {
  return play.track_name ?? play.episode_name ?? play.audiobook_title ?? "—";
}

function artistFor(play: Play): string {
  return play.artist_name ?? play.episode_show_name ?? "—";
}

interface FilterState {
  track: string;
  artist: string;
  album: string;
  contentType: string;
  skipped: string;
  sort: PlaySort;
}

const DEFAULT_FILTERS: FilterState = {
  track: "", artist: "", album: "", contentType: "", skipped: "", sort: "ts_desc",
};

export function HistoryPage() {
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [draft, setDraft] = useState<FilterState>(DEFAULT_FILTERS);
  const [plays, setPlays] = useState<Play[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const PAGE_SIZE = 100;

  const load = useCallback(async (f: FilterState, p: number) => {
    setLoading(true);
    const params = new URLSearchParams({
      sort: f.sort,
      page: String(p),
      page_size: String(PAGE_SIZE),
    });
    if (f.track)       params.set("track", f.track);
    if (f.artist)      params.set("artist", f.artist);
    if (f.album)       params.set("album", f.album);
    if (f.contentType) params.set("content_type", f.contentType);
    if (f.skipped)     params.set("skipped", f.skipped);
    const res = await fetch(`/api/plays?${params}`);
    const body: GetPlaysResponse = await res.json();
    setPlays(body.plays);
    setTotal(body.total);
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
      <h2 className="text-2xl font-bold mb-6">History</h2>

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
          <Label>Type</Label>
          <Select value={draft.contentType || "all"} onValueChange={v => setDraft(f => ({ ...f, contentType: v === "all" ? "" : v }))}>
            <SelectTrigger className="w-32" aria-label="Content type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="track">Tracks</SelectItem>
              <SelectItem value="episode">Episodes</SelectItem>
              <SelectItem value="audiobook">Audiobooks</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1">
          <Label>Skipped</Label>
          <Select value={draft.skipped || "all"} onValueChange={v => setDraft(f => ({ ...f, skipped: v === "all" ? "" : v }))}>
            <SelectTrigger className="w-28" aria-label="Skipped filter">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Any</SelectItem>
              <SelectItem value="true">Skipped</SelectItem>
              <SelectItem value="false">Not skipped</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1">
          <Label>Sort</Label>
          <Select value={draft.sort} onValueChange={v => setDraft(f => ({ ...f, sort: v as PlaySort }))}>
            <SelectTrigger className="w-40" aria-label="Sort order">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ts_desc">Newest first</SelectItem>
              <SelectItem value="ts_asc">Oldest first</SelectItem>
              <SelectItem value="ms_played_desc">Longest played</SelectItem>
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
        {loading ? "Loading…" : `${total.toLocaleString()} plays`}
      </p>

      {/* Table */}
      <div className="rounded-lg border overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="text-left px-3 py-2 font-medium">Date/Time</th>
              <th className="text-left px-3 py-2 font-medium">Title</th>
              <th className="text-left px-3 py-2 font-medium">Artist</th>
              <th className="text-left px-3 py-2 font-medium">Album</th>
              <th className="text-left px-3 py-2 font-medium">Duration</th>
              <th className="text-left px-3 py-2 font-medium">Platform</th>
              <th className="text-left px-3 py-2 font-medium">Skipped</th>
              <th className="text-left px-3 py-2 font-medium">Shuffle</th>
            </tr>
          </thead>
          <tbody>
            {plays.map(play => (
              <tr key={play.id} className="border-b last:border-0 hover:bg-muted/30">
                <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">{formatDateTime(play.ts)}</td>
                <td className="px-3 py-2 max-w-xs truncate">{titleFor(play)}</td>
                <td className="px-3 py-2 max-w-[10rem] truncate text-muted-foreground">{artistFor(play)}</td>
                <td className="px-3 py-2 max-w-[10rem] truncate text-muted-foreground">{play.album_name ?? "—"}</td>
                <td className="px-3 py-2 whitespace-nowrap">{formatDuration(play.ms_played)}</td>
                <td className="px-3 py-2 text-muted-foreground">{play.platform ?? "—"}</td>
                <td className="px-3 py-2">{play.skipped === true ? "Yes" : play.skipped === false ? "No" : "—"}</td>
                <td className="px-3 py-2">{play.shuffle === true ? "Yes" : play.shuffle === false ? "No" : "—"}</td>
              </tr>
            ))}
            {!loading && plays.length === 0 && (
              <tr>
                <td colSpan={8} className="px-3 py-8 text-center text-muted-foreground">No plays found.</td>
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
