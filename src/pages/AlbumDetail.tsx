import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import type { Album } from "@/types/api";

function formatDuration(ms: number): string {
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

interface StarPickerProps {
  value: number | null;
  onChange: (v: number | null) => void;
}

function StarPicker({ value, onChange }: StarPickerProps) {
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

interface AlbumDetailProps {
  albumKey: string;
  onClose: () => void;
}

export function AlbumDetail({ albumKey, onClose }: AlbumDetailProps) {
  const [album, setAlbum] = useState<Album | null>(null);
  const [loading, setLoading] = useState(true);

  // Editable override fields
  const [rating, setRating] = useState<number | null>(null);
  const [genre, setGenre] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/albums/${encodeURIComponent(albumKey)}`)
      .then(r => r.json())
      .then(body => {
        setAlbum(body.album);
        setRating(body.album.rating ?? null);
        setGenre(body.album.genre ?? "");
        setNotes(body.album.notes ?? "");
        setLoading(false);
      });
  }, [albumKey]);

  async function saveOverrides() {
    setSaving(true);
    setSaved(false);
    await fetch(`/api/overrides/album/${encodeURIComponent(albumKey)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify([
        { field: "rating", value: rating !== null ? String(rating) : null },
        { field: "genre",  value: genre.trim() ? JSON.stringify(genre.trim()) : null },
        { field: "notes",  value: notes.trim() ? JSON.stringify(notes.trim()) : null },
      ]),
    });
    setSaving(false);
    setSaved(true);
  }

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto">
        <Button variant="ghost" size="sm" onClick={onClose}>← Back to Albums</Button>
        <p className="mt-6 text-muted-foreground">Loading…</p>
      </div>
    );
  }

  if (!album) {
    return (
      <div className="max-w-2xl mx-auto">
        <Button variant="ghost" size="sm" onClick={onClose}>← Back to Albums</Button>
        <p className="mt-6 text-destructive">Album not found.</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <Button variant="ghost" size="sm" onClick={onClose} className="mb-4">
        ← Back to Albums
      </Button>

      {/* Header */}
      <div className="flex gap-5 mb-6">
        <div className="w-24 h-24 shrink-0 rounded-lg bg-muted flex items-center justify-center text-muted-foreground text-xs">
          art
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-2xl font-bold truncate">{album.album_name}</h2>
          <p className="text-muted-foreground">{album.artist_name}</p>
          <div className="flex gap-6 mt-2 text-sm text-muted-foreground">
            <span>{album.play_count} plays</span>
            <span>{formatDuration(album.total_ms_played)}</span>
            <span>{album.track_count} tracks</span>
          </div>
          <div className="flex gap-6 mt-1 text-xs text-muted-foreground">
            <span>First: {formatDate(album.first_played)}</span>
            <span>Last: {formatDate(album.last_played)}</span>
          </div>
        </div>
      </div>

      {/* Overrides form */}
      <div className="border rounded-lg p-5 flex flex-col gap-4">
        <h3 className="font-semibold text-sm">Your notes</h3>

        <div>
          <Label className="mb-1.5 block">Rating</Label>
          <StarPicker value={rating} onChange={setRating} />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="album-genre">Genre</Label>
          <Input
            id="album-genre"
            placeholder="e.g. Indie Rock"
            value={genre}
            onChange={e => setGenre(e.target.value)}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="album-notes">Notes</Label>
          <Textarea
            id="album-notes"
            placeholder="Your thoughts on this album…"
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
    </div>
  );
}
