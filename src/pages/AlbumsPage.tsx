import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Album, GetAlbumsResponse } from "@/types/api";

type AlbumSort = "total_ms_desc" | "play_count_desc" | "name_asc" | "artist_asc" | "last_played_desc" | "rating_desc";

function formatDuration(ms: number): string {
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function StarRating({ value }: { value: number | null }) {
  if (value === null) return <span className="text-muted-foreground text-xs">—</span>;
  return (
    <span className="text-yellow-500 text-sm" aria-label={`${value} stars`}>
      {"★".repeat(value)}{"☆".repeat(5 - value)}
    </span>
  );
}

interface AlbumCardProps {
  album: Album;
  onClick: () => void;
}

function AlbumCard({ album, onClick }: AlbumCardProps) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left border rounded-lg p-4 hover:bg-muted/50 transition-colors flex gap-4 items-start"
    >
      {/* Art placeholder */}
      <div className="w-14 h-14 shrink-0 rounded bg-muted flex items-center justify-center text-muted-foreground text-xs">
        art
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium truncate">{album.album_name}</p>
        <p className="text-sm text-muted-foreground truncate">{album.artist_name}</p>
        {album.genre && <p className="text-xs text-muted-foreground">{album.genre}</p>}
      </div>
      <div className="shrink-0 text-right text-sm text-muted-foreground space-y-0.5">
        <p>{album.play_count} plays</p>
        <p>{formatDuration(album.total_ms_played)}</p>
        <StarRating value={album.rating} />
      </div>
    </button>
  );
}

interface FilterState {
  artist: string;
  album: string;
  sort: AlbumSort;
}

export function AlbumsPage({ onAlbumSelect }: { onAlbumSelect: (key: string) => void }) {
  const [filters, setFilters] = useState<FilterState>({ artist: "", album: "", sort: "total_ms_desc" });
  const [draftFilters, setDraftFilters] = useState<FilterState>(filters);
  const [albums, setAlbums] = useState<Album[]>([]);
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
    if (f.album) params.set("album", f.album);
    const res = await fetch(`/api/albums?${params}`);
    const body: GetAlbumsResponse = await res.json();
    setAlbums(body.albums);
    setTotal(body.total);
    setLoading(false);
  }, []);

  useEffect(() => { load(filters, page); }, [filters, page, load]);

  function applyFilters() {
    setFilters(draftFilters);
    setPage(1);
  }

  function clearFilters() {
    const cleared: FilterState = { artist: "", album: "", sort: "total_ms_desc" };
    setDraftFilters(cleared);
    setFilters(cleared);
    setPage(1);
  }

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="max-w-4xl mx-auto">
      <h2 className="text-2xl font-bold mb-6">Albums</h2>

      {/* Filter bar */}
      <div className="flex flex-wrap gap-3 mb-4 items-end">
        <div className="flex flex-col gap-1">
          <Label htmlFor="filter-artist">Artist</Label>
          <Input
            id="filter-artist"
            className="w-44"
            placeholder="Filter by artist…"
            value={draftFilters.artist}
            onChange={e => setDraftFilters(f => ({ ...f, artist: e.target.value }))}
            onKeyDown={e => e.key === "Enter" && applyFilters()}
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="filter-album">Album</Label>
          <Input
            id="filter-album"
            className="w-44"
            placeholder="Filter by album…"
            value={draftFilters.album}
            onChange={e => setDraftFilters(f => ({ ...f, album: e.target.value }))}
            onKeyDown={e => e.key === "Enter" && applyFilters()}
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="filter-sort">Sort</Label>
          <Select value={draftFilters.sort} onValueChange={v => setDraftFilters(f => ({ ...f, sort: v as AlbumSort }))}>
            <SelectTrigger id="filter-sort" className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="total_ms_desc">Most time listened</SelectItem>
              <SelectItem value="play_count_desc">Most plays</SelectItem>
              <SelectItem value="last_played_desc">Recently played</SelectItem>
              <SelectItem value="name_asc">Album name A–Z</SelectItem>
              <SelectItem value="artist_asc">Artist A–Z</SelectItem>
              <SelectItem value="rating_desc">Highest rated</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button onClick={applyFilters}>Apply</Button>
        <Button variant="outline" onClick={clearFilters}>Clear</Button>
      </div>

      {/* Results count */}
      <p className="text-sm text-muted-foreground mb-3">
        {loading ? "Loading…" : `${total.toLocaleString()} album${total !== 1 ? "s" : ""}`}
      </p>

      {/* List */}
      <div className="flex flex-col gap-2">
        {!loading && albums.length === 0 && (
          <p className="text-center py-16 text-muted-foreground">No albums found.</p>
        )}
        {albums.map(a => (
          <AlbumCard key={a.album_key} album={a} onClick={() => onAlbumSelect(a.album_key)} />
        ))}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 mt-6">
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
