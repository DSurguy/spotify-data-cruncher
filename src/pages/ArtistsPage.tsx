import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Artist, GetArtistsResponse } from "@/types/api";

type ArtistSort = "total_ms_desc" | "play_count_desc" | "name_asc" | "last_played_desc" | "rating_desc";

function formatDuration(ms: number): string {
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function StarRating({ value }: { value: number | null }) {
  if (value === null) return <span className="text-muted-foreground text-xs">—</span>;
  return (
    <span className="text-yellow-500 text-sm" aria-label={`${value} stars`}>
      {"★".repeat(value)}{"☆".repeat(5 - value)}
    </span>
  );
}

interface FilterState {
  artist: string;
  sort: ArtistSort;
}

const DEFAULT_FILTERS: FilterState = { artist: "", sort: "total_ms_desc" };

export function ArtistsPage() {
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [draft, setDraft] = useState<FilterState>(DEFAULT_FILTERS);
  const [artists, setArtists] = useState<Artist[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const PAGE_SIZE = 50;

  const load = useCallback(async (f: FilterState, p: number) => {
    setLoading(true);
    const params = new URLSearchParams({
      sort: f.sort,
      page: String(p),
      page_size: String(PAGE_SIZE),
    });
    if (f.artist) params.set("artist", f.artist);
    const res = await fetch(`/api/artists?${params}`);
    const body: GetArtistsResponse = await res.json();
    setArtists(body.artists);
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
    <div className="max-w-4xl mx-auto">
      <h2 className="text-2xl font-bold mb-6">Artists</h2>

      {/* Filter bar */}
      <div className="flex flex-wrap gap-3 mb-4 items-end">
        <div className="flex flex-col gap-1">
          <Label htmlFor="filter-artist">Artist</Label>
          <Input
            id="filter-artist"
            className="w-52"
            placeholder="Filter by artist…"
            value={draft.artist}
            onChange={e => setDraft(f => ({ ...f, artist: e.target.value }))}
            onKeyDown={e => e.key === "Enter" && applyFilters()}
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label>Sort</Label>
          <Select value={draft.sort} onValueChange={v => setDraft(f => ({ ...f, sort: v as ArtistSort }))}>
            <SelectTrigger className="w-44" aria-label="Sort order">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="total_ms_desc">Most time</SelectItem>
              <SelectItem value="play_count_desc">Most played</SelectItem>
              <SelectItem value="name_asc">Name A–Z</SelectItem>
              <SelectItem value="last_played_desc">Recently played</SelectItem>
              <SelectItem value="rating_desc">Highest rated</SelectItem>
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
        {loading ? "Loading…" : `${total.toLocaleString()} artists`}
      </p>

      {/* Artist list */}
      <div className="flex flex-col gap-2">
        {artists.map(artist => (
          <div
            key={artist.artist_key}
            className="border rounded-lg p-4 flex items-center gap-4"
          >
            {/* Avatar placeholder */}
            <div className="w-12 h-12 shrink-0 rounded-full bg-muted flex items-center justify-center text-muted-foreground text-xs">
              art
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium truncate">{artist.artist_name}</p>
              {artist.genre && <p className="text-xs text-muted-foreground">{artist.genre}</p>}
              <p className="text-xs text-muted-foreground">
                {artist.album_count} album{artist.album_count !== 1 ? "s" : ""}
              </p>
            </div>
            <div className="shrink-0 text-right text-sm text-muted-foreground space-y-0.5">
              <p>{artist.play_count.toLocaleString()} plays</p>
              <p>{formatDuration(artist.total_ms_played)}</p>
              <StarRating value={artist.rating} />
            </div>
          </div>
        ))}
        {!loading && artists.length === 0 && (
          <p className="text-center text-muted-foreground py-8">No artists found.</p>
        )}
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
