import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
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

function StarPicker({ value, onChange }: { value: number | null; onChange: (v: number | null) => void }) {
  return (
    <div className="flex gap-1" role="group" aria-label="Rating">
      {[1, 2, 3, 4, 5].map(n => (
        <button
          key={n}
          type="button"
          aria-label={`${n} star${n !== 1 ? "s" : ""}`}
          className={`text-2xl leading-none transition-colors ${n <= (value ?? 0) ? "text-yellow-500" : "text-muted-foreground"}`}
          onClick={() => onChange(n === value ? null : n)}
        >
          ★
        </button>
      ))}
    </div>
  );
}

interface TrackDetailProps {
  trackKey: string;
  onClose: () => void;
  onAlbumSelect?: (albumKey: string) => void;
}

export function TrackDetail({ trackKey, onClose, onAlbumSelect }: TrackDetailProps) {
  const [data, setData] = useState<GetTrackResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [playsPage, setPlaysPage] = useState(1);

  const [rating, setRating] = useState<number | null>(null);
  const [genre, setGenre] = useState("");
  const [notes, setNotes] = useState("");
  const [reviewed, setReviewed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/tracks/${encodeURIComponent(trackKey)}?page=${playsPage}`)
      .then(r => r.json())
      .then((body: GetTrackResponse) => {
        setData(body);
        if (playsPage === 1) {
          setRating(body.track.rating ?? null);
          setGenre(body.track.genre ?? "");
          setNotes(body.track.notes ?? "");
          setReviewed(body.track.reviewed);
        }
        setLoading(false);
      });
  }, [trackKey, playsPage]);

  async function saveOverrides() {
    setSaving(true);
    setSaved(false);
    await fetch(`/api/overrides/track/${encodeURIComponent(trackKey)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify([
        { field: "rating",   value: rating !== null ? String(rating) : null },
        { field: "genre",    value: genre.trim() ? JSON.stringify(genre.trim()) : null },
        { field: "notes",    value: notes.trim() ? JSON.stringify(notes.trim()) : null },
        { field: "reviewed", value: reviewed ? "true" : null },
      ]),
    });
    setSaving(false);
    setSaved(true);
  }

  if (loading && !data) {
    return (
      <div className="max-w-2xl mx-auto">
        <Button variant="ghost" size="sm" onClick={onClose}>← Back to Tracks</Button>
        <p className="mt-6 text-muted-foreground">Loading…</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="max-w-2xl mx-auto">
        <Button variant="ghost" size="sm" onClick={onClose}>← Back to Tracks</Button>
        <p className="mt-6 text-destructive">Track not found.</p>
      </div>
    );
  }

  const { track, albums, plays } = data;
  const totalPlaysPages = Math.ceil(plays.total / plays.page_size);

  return (
    <div className="max-w-2xl mx-auto">
      <Button variant="ghost" size="sm" onClick={onClose} className="mb-4">
        ← Back to Tracks
      </Button>

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
      </div>

      {/* Overrides form */}
      <div className="border rounded-lg p-5 flex flex-col gap-4 mb-6">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-sm">Your notes</h3>
          <button
            type="button"
            onClick={() => setReviewed(r => !r)}
            aria-label={reviewed ? "Mark unreviewed" : "Mark reviewed"}
            className={`flex items-center gap-1.5 text-sm px-2 py-1 rounded border transition-colors ${
              reviewed
                ? "bg-green-50 border-green-300 text-green-700 hover:bg-green-100"
                : "bg-muted border-border text-muted-foreground hover:bg-muted/80"
            }`}
          >
            {reviewed ? "✓ Reviewed" : "○ Not reviewed"}
          </button>
        </div>

        <div>
          <Label className="mb-1.5 block">Rating</Label>
          <StarPicker value={rating} onChange={setRating} />
        </div>

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
          <Button onClick={saveOverrides} disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </Button>
          {saved && <span className="text-sm text-muted-foreground">Saved!</span>}
        </div>
      </div>

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
