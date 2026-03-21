import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import type { GetTrackResponse } from "@/types/api";

type Rating = "like" | "dislike" | "none";

function formatDuration(ms: number): string {
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function RatingPicker({ value, onChange }: { value: Rating | null; onChange: (v: Rating | null) => void }) {
  const options: { value: Rating; label: string; activeClass: string }[] = [
    { value: "like", label: "♥ Like", activeClass: "bg-green-600 text-white border-green-600" },
    { value: "none", label: "— No opinion", activeClass: "bg-muted text-foreground border-border" },
    { value: "dislike", label: "✕ Dislike", activeClass: "bg-red-600 text-white border-red-600" },
  ];
  return (
    <div className="flex gap-2" role="group" aria-label="Rating">
      {options.map(opt => (
        <button
          key={opt.value}
          type="button"
          aria-pressed={value === opt.value}
          onClick={() => onChange(value === opt.value ? null : opt.value)}
          className={`px-3 py-1.5 rounded border text-sm transition-colors ${
            value === opt.value ? opt.activeClass : "border-border text-muted-foreground hover:bg-muted"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function RatingDisplay({ value }: { value: Rating | null }) {
  if (!value || value === "none") return <span className="text-muted-foreground text-sm">No rating</span>;
  return value === "like"
    ? <span className="text-green-600 text-sm font-medium">♥ Like</span>
    : <span className="text-red-500 text-sm font-medium">✕ Dislike</span>;
}

interface TrackDetailProps {
  trackKey: string;
  from: "explore" | "review";
  onClose: () => void;
  onAlbumSelect?: (albumKey: string) => void;
}

export function TrackDetail({ trackKey, from, onClose, onAlbumSelect }: TrackDetailProps) {
  const [data, setData] = useState<GetTrackResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [playsPage, setPlaysPage] = useState(1);

  // View-mode notes form
  const [genre, setGenre] = useState("");
  const [notes, setNotes] = useState("");
  const [viewSaving, setViewSaving] = useState(false);
  const [viewSaved, setViewSaved] = useState(false);

  // Review mode state
  const [mode, setMode] = useState<"view" | "review">(from === "review" ? "review" : "view");
  const [reviewRating, setReviewRating] = useState<Rating | null>(null);
  const [reviewNotes, setReviewNotes] = useState("");
  const [reviewGenre, setReviewGenre] = useState("");
  const [reviewSaving, setReviewSaving] = useState(false);
  const [reviewComplete, setReviewComplete] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/tracks/${encodeURIComponent(trackKey)}?page=${playsPage}`)
      .then(r => r.json())
      .then((body: GetTrackResponse) => {
        setData(body);
        if (playsPage === 1) {
          setGenre(body.track.genre ?? "");
          setNotes(body.track.notes ?? "");
          setReviewRating((body.track.rating as Rating | null) ?? null);
          setReviewNotes(body.track.notes ?? "");
          setReviewGenre(body.track.genre ?? "");
        }
        setLoading(false);
      });
  }, [trackKey, playsPage]);

  async function saveViewNotes() {
    setViewSaving(true);
    setViewSaved(false);
    await fetch(`/api/overrides/track/${encodeURIComponent(trackKey)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify([
        { field: "genre", value: genre.trim() ? JSON.stringify(genre.trim()) : null },
        { field: "notes", value: notes.trim() ? JSON.stringify(notes.trim()) : null },
      ]),
    });
    setViewSaving(false);
    setViewSaved(true);
  }

  async function completeReview() {
    if (!reviewRating) return;
    setReviewSaving(true);
    await fetch(`/api/overrides/track/${encodeURIComponent(trackKey)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify([
        { field: "rating", value: JSON.stringify(reviewRating) },
        { field: "genre", value: reviewGenre.trim() ? JSON.stringify(reviewGenre.trim()) : null },
        { field: "notes", value: reviewNotes.trim() ? JSON.stringify(reviewNotes.trim()) : null },
        { field: "reviewed", value: "true" },
      ]),
    });
    setReviewSaving(false);
    setReviewComplete(true);
  }

  const backLabel = from === "review" ? "← Review" : "← Explore";

  if (loading && !data) {
    return (
      <div className="max-w-2xl mx-auto">
        <Button variant="ghost" size="sm" onClick={onClose}>{backLabel}</Button>
        <p className="mt-6 text-muted-foreground">Loading…</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="max-w-2xl mx-auto">
        <Button variant="ghost" size="sm" onClick={onClose}>{backLabel}</Button>
        <p className="mt-6 text-destructive">Track not found.</p>
      </div>
    );
  }

  const { track, albums, plays } = data;
  const totalPlaysPages = Math.ceil(plays.total / plays.page_size);

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <Button variant="ghost" size="sm" onClick={onClose}>{backLabel}</Button>
        {mode === "view" && (
          <Button variant="outline" size="sm" onClick={() => { setMode("review"); setReviewComplete(false); }}>
            Review this track →
          </Button>
        )}
        {mode === "review" && from === "explore" && (
          <Button variant="ghost" size="sm" onClick={() => setMode("view")}>Exit review mode</Button>
        )}
      </div>

      {/* Review mode */}
      {mode === "review" && (
        <div className="border-2 border-primary/20 rounded-lg p-5 flex flex-col gap-4 mb-6 bg-primary/5">
          <h3 className="font-semibold">Review: {track.track_name}</h3>
          <p className="text-sm text-muted-foreground -mt-2">{track.artist_name}</p>

          {reviewComplete ? (
            <div className="flex flex-col gap-3">
              <p className="text-sm font-medium text-green-700">Review complete!</p>
              <p className="text-sm text-muted-foreground">Review another track?</p>
              <div className="flex gap-2">
                <Button onClick={onClose}>Yes, back to Review</Button>
                <Button variant="outline" onClick={() => { setMode("view"); setReviewComplete(false); }}>
                  No, stay here
                </Button>
              </div>
            </div>
          ) : (
            <>
              <div>
                <Label className="mb-2 block">
                  Rating <span className="text-destructive">*</span>
                </Label>
                <RatingPicker value={reviewRating} onChange={setReviewRating} />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="review-genre">Genre <span className="text-muted-foreground font-normal">(optional)</span></Label>
                <Input
                  id="review-genre"
                  placeholder="e.g. Indie Rock"
                  value={reviewGenre}
                  onChange={e => setReviewGenre(e.target.value)}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="review-notes">Notes <span className="text-muted-foreground font-normal">(optional)</span></Label>
                <Textarea
                  id="review-notes"
                  placeholder="Your thoughts on this track…"
                  rows={3}
                  value={reviewNotes}
                  onChange={e => setReviewNotes(e.target.value)}
                />
              </div>

              <div className="flex items-center gap-3">
                <Button onClick={completeReview} disabled={reviewSaving || !reviewRating}>
                  {reviewSaving ? "Saving…" : "Complete Review"}
                </Button>
                {!reviewRating && (
                  <span className="text-xs text-muted-foreground">Rating is required</span>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* Header */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold">{track.track_name}</h2>
        <p className="text-muted-foreground">{track.artist_name}</p>
        {track.album_name && <p className="text-sm text-muted-foreground">{track.album_name}</p>}
        <div className="flex flex-wrap gap-6 mt-2 text-sm text-muted-foreground">
          <span>{track.play_count} plays</span>
          <span>{formatDuration(track.total_ms_played)}</span>
          <span>{track.skip_rate}% skip rate</span>
          <span>Last: {formatDate(track.last_played)}</span>
        </div>
        {track.rating && (
          <div className="mt-2">
            <RatingDisplay value={track.rating as Rating | null} />
          </div>
        )}
        {track.reviewed && (
          <span className="inline-flex items-center gap-1 text-xs text-green-700 mt-1">✓ Reviewed</span>
        )}
      </div>

      {/* View-mode notes */}
      {mode === "view" && (
        <div className="border rounded-lg p-5 flex flex-col gap-4 mb-6">
          <h3 className="font-semibold text-sm">Your notes</h3>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="track-genre">Genre</Label>
            <Input
              id="track-genre"
              placeholder="e.g. Indie Rock"
              value={genre}
              onChange={e => setGenre(e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="track-notes">Notes</Label>
            <Textarea
              id="track-notes"
              placeholder="Your thoughts on this track…"
              rows={4}
              value={notes}
              onChange={e => setNotes(e.target.value)}
            />
          </div>

          <div className="flex items-center gap-3">
            <Button onClick={saveViewNotes} disabled={viewSaving}>
              {viewSaving ? "Saving…" : "Save"}
            </Button>
            {viewSaved && <span className="text-sm text-muted-foreground">Saved!</span>}
          </div>
        </div>
      )}

      {/* Albums */}
      {albums.length > 0 && (
        <div className="mb-6">
          <h3 className="font-semibold text-sm mb-2">Appears on</h3>
          <div className="flex flex-col gap-1">
            {albums.map(album => (
              <div key={album.album_key} className="flex items-center justify-between px-3 py-2 rounded border text-sm">
                <button
                  type="button"
                  className="text-left hover:underline font-medium"
                  onClick={() => onAlbumSelect?.(album.album_key)}
                >
                  {album.album_name || "Unknown Album"}
                </button>
                <span className="text-muted-foreground">{album.play_count} plays</span>
              </div>
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


