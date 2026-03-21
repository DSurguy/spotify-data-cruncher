import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import type { Track, GetTracksResponse } from "@/types/api";

function formatDuration(ms: number): string {
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

interface Panel {
  title: string;
  sort: string;
}

const PANELS: Panel[] = [
  { title: "Oldest unreviewed", sort: "first_played_asc" },
  { title: "Newest unreviewed", sort: "first_played_desc" },
  { title: "Most played", sort: "play_count_desc" },
  { title: "Least played", sort: "play_count_asc" },
  { title: "Random selection", sort: "random" },
];

interface ReviewPanelData {
  tracks: Track[];
  loading: boolean;
}

interface ReviewPanelProps {
  panel: Panel;
  data: ReviewPanelData;
  onRefresh: () => void;
  onTrackSelect: (key: string) => void;
}

function ReviewPanel({ panel, data, onRefresh, onTrackSelect }: ReviewPanelProps) {
  return (
    <div className="border rounded-lg overflow-hidden flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 bg-muted/30 border-b">
        <h3 className="text-sm font-semibold">{panel.title}</h3>
        <Button variant="ghost" size="sm" onClick={onRefresh} aria-label={`Refresh ${panel.title}`}>
          ↺
        </Button>
      </div>
      <div className="flex-1">
        {data.loading ? (
          <p className="px-4 py-6 text-muted-foreground text-sm">Loading…</p>
        ) : data.tracks.length === 0 ? (
          <p className="px-4 py-6 text-muted-foreground text-sm">No unreviewed tracks.</p>
        ) : (
          <div>
            {data.tracks.map((track, i) => (
              <button
                key={track.track_key}
                type="button"
                className={`w-full text-left px-4 py-3 hover:bg-muted/50 transition-colors ${i > 0 ? "border-t" : ""}`}
                onClick={() => onTrackSelect(track.track_key)}
              >
                <div className="font-medium text-sm truncate">{track.track_name}</div>
                <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground">
                  <span className="truncate max-w-[160px]">{track.artist_name}</span>
                  <span className="shrink-0">{track.play_count} plays</span>
                  <span className="shrink-0">{formatDuration(track.total_ms_played)}</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

interface ReviewPageProps {
  onTrackSelect: (key: string) => void;
}

export function ReviewPage({ onTrackSelect }: ReviewPageProps) {
  const [panelData, setPanelData] = useState<ReviewPanelData[]>(
    PANELS.map(() => ({ tracks: [], loading: true })),
  );

  async function loadPanel(index: number) {
    setPanelData(prev => prev.map((d, i) => i === index ? { ...d, loading: true } : d));
    const params = new URLSearchParams({
      reviewed: "false",
      sort: PANELS[index].sort,
      page_size: "5",
    });
    const res = await fetch(`/api/tracks?${params}`);
    const body: GetTracksResponse = await res.json();
    setPanelData(prev => prev.map((d, i) => i === index ? { tracks: body.tracks, loading: false } : d));
  }

  useEffect(() => {
    PANELS.forEach((_, i) => loadPanel(i));
  }, []);

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-6">
        <h2 className="text-2xl font-bold">Review</h2>
        <p className="text-muted-foreground text-sm mt-1">
          Select a track to review it — rate it, add notes, and mark it done.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {PANELS.map((panel, i) => (
          <ReviewPanel
            key={panel.sort}
            panel={panel}
            data={panelData[i]}
            onRefresh={() => loadPanel(i)}
            onTrackSelect={onTrackSelect}
          />
        ))}
      </div>
    </div>
  );
}
