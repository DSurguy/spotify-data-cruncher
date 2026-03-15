import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { PodcastShow, GetPodcastsResponse } from "@/types/api";

type PodcastSort = "total_ms_desc" | "play_count_desc" | "name_asc" | "last_played_desc";

function formatDuration(ms: number): string {
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

interface FilterState {
  show: string;
  sort: PodcastSort;
}

const DEFAULT_FILTERS: FilterState = { show: "", sort: "total_ms_desc" };

export function PodcastsPage() {
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [draft, setDraft] = useState<FilterState>(DEFAULT_FILTERS);
  const [shows, setShows] = useState<PodcastShow[]>([]);
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
    if (f.show) params.set("show", f.show);
    const res = await fetch(`/api/podcasts?${params}`);
    const body: GetPodcastsResponse = await res.json();
    setShows(body.shows);
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
      <h2 className="text-2xl font-bold mb-6">Podcasts</h2>

      {/* Filter bar */}
      <div className="flex flex-wrap gap-3 mb-4 items-end">
        <div className="flex flex-col gap-1">
          <Label htmlFor="filter-show">Show</Label>
          <Input
            id="filter-show"
            className="w-52"
            placeholder="Filter by show…"
            value={draft.show}
            onChange={e => setDraft(f => ({ ...f, show: e.target.value }))}
            onKeyDown={e => e.key === "Enter" && applyFilters()}
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label>Sort</Label>
          <Select value={draft.sort} onValueChange={v => setDraft(f => ({ ...f, sort: v as PodcastSort }))}>
            <SelectTrigger className="w-44" aria-label="Sort order">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="total_ms_desc">Most time</SelectItem>
              <SelectItem value="play_count_desc">Most played</SelectItem>
              <SelectItem value="name_asc">Name A–Z</SelectItem>
              <SelectItem value="last_played_desc">Recently played</SelectItem>
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
        {loading ? "Loading…" : `${total.toLocaleString()} shows`}
      </p>

      {/* Show list */}
      <div className="flex flex-col gap-2">
        {shows.map(show => (
          <div
            key={show.show_key}
            className="border rounded-lg p-4 flex items-center gap-4"
          >
            <div className="flex-1 min-w-0">
              <p className="font-medium truncate">{show.show_name}</p>
              {show.genre && <p className="text-xs text-muted-foreground">{show.genre}</p>}
              <p className="text-xs text-muted-foreground">
                {show.episode_count} episode{show.episode_count !== 1 ? "s" : ""}
              </p>
            </div>
            <div className="shrink-0 text-right text-sm text-muted-foreground space-y-0.5">
              <p>{show.play_count.toLocaleString()} plays</p>
              <p>{formatDuration(show.total_ms_played)}</p>
            </div>
          </div>
        ))}
        {!loading && shows.length === 0 && (
          <p className="text-center text-muted-foreground py-8">No podcasts found.</p>
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
