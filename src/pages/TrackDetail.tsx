import { useState, useEffect } from "react";
import { useParams, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { LinkButton, NavLabel } from "@/components/ui/link-button";
import { TrackReviewCard } from "@/components/TrackReviewCard";
import type { GetTrackResponse } from "@/types/api";

function formatDuration(ms: number): string {
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export function TrackDetail() {
  const { key } = useParams<{ key: string }>();
  const trackSlug = key;
  const [data, setData] = useState<GetTrackResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [playsPage, setPlaysPage] = useState(1);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/tracks/${trackSlug}?page=${playsPage}`)
      .then(r => r.json())
      .then((body: GetTrackResponse) => {
        setData(body);
        setLoading(false);
      });
  }, [trackSlug, playsPage]);

  if (loading && !data) {
    return (
      <div>
        <Button variant="ghost" size="sm" onClick={() => window.history.back()}>← Back</Button>
        <p className="mt-6 text-muted-foreground">Loading…</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div>
        <Button variant="ghost" size="sm" onClick={() => window.history.back()}>← Back</Button>
        <p className="mt-6 text-destructive">Track not found.</p>
      </div>
    );
  }

  const { track, albums, plays } = data;
  const totalPlaysPages = Math.ceil(plays.total / plays.page_size);

  return (
    <div>
      <Button variant="ghost" size="sm" onClick={() => window.history.back()} className="mb-4">← Back</Button>

      {/* Header */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold">{track.track_name}</h2>
        <p className="text-xs text-muted-foreground uppercase tracking-wide mt-1">Artist</p>
        <Link
          href={`/artists/${track.artist_slug}`}
          className="group/name flex items-center gap-1 text-muted-foreground"
        >
          <span className="underline underline-offset-2">{track.artist_name}</span>
          <span className="opacity-0 group-hover/name:opacity-100 text-xs transition-opacity" aria-hidden="true">→</span>
        </Link>
        <div className="flex flex-wrap gap-6 mt-2 text-sm text-muted-foreground">
          <span>{track.play_count} plays</span>
          <span>{formatDuration(track.total_ms_played)}</span>
          <span>{track.skip_rate}% skip rate</span>
          <span>Last: {formatDate(track.last_played)}</span>
        </div>
        {track.reviewed && (
          <span className="inline-flex items-center gap-1 text-xs text-green-700 mt-1">✓ Reviewed</span>
        )}
      </div>

      <TrackReviewCard
        trackKey={trackSlug}
        rating={track.rating as "like" | "dislike" | "none" | null}
        genre={track.genre}
        notes={track.notes}
      />

      {/* Albums */}
      {albums.length > 0 && (
        <div className="mb-6">
          <h3 className="font-semibold text-sm mb-2">Appears on</h3>
          <div className="flex flex-col gap-1">
            {albums.map(album => (
              <LinkButton
                key={album.album_slug}
                href={`/albums/${album.album_slug}`}
                className="gap-2 px-3 py-2 rounded border text-sm hover:bg-muted/50 transition-colors"
              >
                <NavLabel className="font-medium flex-1">{album.album_name || "Unknown Album"}</NavLabel>
                <span className="text-muted-foreground text-sm shrink-0">{album.play_count} plays</span>
              </LinkButton>
            ))}
          </div>
        </div>
      )}

      {/* Play history */}
      <div>
        <h3 className="font-semibold text-sm mb-2">Play history ({plays.total})</h3>
        <div className="rounded-lg border overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left px-3 py-2 font-medium">Date</th>
                <th className="text-right px-3 py-2 font-medium">Duration</th>
                <th className="text-left px-3 py-2 font-medium">Platform</th>
                <th className="text-center px-3 py-2 font-medium">Skipped</th>
              </tr>
            </thead>
            <tbody>
              {plays.items.map((play, i) => (
                <tr key={i} className="border-b last:border-0">
                  <td className="px-3 py-1.5 whitespace-nowrap">{formatDate(play.ts)}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{formatDuration(play.ms_played)}</td>
                  <td className="px-3 py-1.5 text-muted-foreground">{play.platform ?? "—"}</td>
                  <td className="px-3 py-1.5 text-center text-muted-foreground">{play.skipped ? "✕" : ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {totalPlaysPages > 1 && (
          <div className="flex items-center justify-center gap-4 mt-3 text-sm">
            <Button
              variant="outline"
              size="sm"
              disabled={playsPage <= 1}
              onClick={() => setPlaysPage(p => p - 1)}
            >
              Previous
            </Button>
            <span className="text-muted-foreground">{playsPage} / {totalPlaysPages}</span>
            <Button
              variant="outline"
              size="sm"
              disabled={playsPage >= totalPlaysPages}
              onClick={() => setPlaysPage(p => p + 1)}
            >
              Next
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
