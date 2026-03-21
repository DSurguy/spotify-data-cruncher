import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

type Rating = "like" | "dislike" | "none";

function RatingPicker({ value, onChange }: { value: Rating | null; onChange: (v: Rating | null) => void }) {
  const options: { value: Rating; label: string; activeClass: string }[] = [
    { value: "like", label: "♥ Like", activeClass: "bg-green-600 text-white border-green-600" },
    { value: "none", label: "— No opinion", activeClass: "bg-muted text-foreground border-border" },
    { value: "dislike", label: "✕ Dislike", activeClass: "bg-red-600 text-white border-red-600" },
  ];
  return (
    <div className="flex gap-2 flex-wrap" role="group" aria-label="Rating">
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

interface TrackReviewCardProps {
  trackKey: string;
  rating: Rating | null;
  genre: string | null;
  notes: string | null;
}

export function TrackReviewCard({ trackKey, rating: initialRating, genre: initialGenre, notes: initialNotes }: TrackReviewCardProps) {
  const [mode, setMode] = useState<"view" | "edit">("view");

  // Current saved values (updated after a successful save)
  const [rating, setRating] = useState<Rating | null>(initialRating);
  const [genre, setGenre] = useState(initialGenre ?? "");
  const [notes, setNotes] = useState(initialNotes ?? "");

  // In-progress edit values
  const [editRating, setEditRating] = useState<Rating | null>(initialRating);
  const [editGenre, setEditGenre] = useState(initialGenre ?? "");
  const [editNotes, setEditNotes] = useState(initialNotes ?? "");
  const [saving, setSaving] = useState(false);

  function openEdit() {
    setEditRating(rating);
    setEditGenre(genre);
    setEditNotes(notes);
    setMode("edit");
  }

  function cancelEdit() {
    setMode("view");
  }

  async function save() {
    if (!editRating) return;
    setSaving(true);
    await fetch(`/api/overrides/track/${encodeURIComponent(trackKey)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify([
        { field: "rating", value: JSON.stringify(editRating) },
        { field: "genre", value: editGenre.trim() ? JSON.stringify(editGenre.trim()) : null },
        { field: "notes", value: editNotes.trim() ? JSON.stringify(editNotes.trim()) : null },
        { field: "reviewed", value: "true" },
      ]),
    });
    setRating(editRating);
    setGenre(editGenre.trim());
    setNotes(editNotes.trim());
    setSaving(false);
    setMode("view");
  }

  return (
    <div className="border rounded-lg mb-6 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <h3 className="font-semibold text-sm">Review</h3>
        {mode === "view" && <RatingDisplay value={rating} />}
      </div>

      {/* Body */}
      {mode === "view" ? (
        <div className="px-4 py-3 flex flex-col gap-3">
          <div>
            <p className="text-xs text-muted-foreground mb-0.5">Genre</p>
            <p className="text-sm">{genre || <span className="text-muted-foreground">—</span>}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-0.5">Notes</p>
            <p className="text-sm">{notes || <span className="text-muted-foreground">—</span>}</p>
          </div>
        </div>
      ) : (
        <div className="px-4 py-4 flex flex-col gap-4">
          <div>
            <Label className="mb-2 block">
              Rating <span className="text-destructive">*</span>
            </Label>
            <RatingPicker value={editRating} onChange={setEditRating} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="review-genre">Genre <span className="text-muted-foreground font-normal">(optional)</span></Label>
            <Input
              id="review-genre"
              placeholder="e.g. Indie Rock"
              value={editGenre}
              onChange={e => setEditGenre(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="review-notes">Notes <span className="text-muted-foreground font-normal">(optional)</span></Label>
            <Textarea
              id="review-notes"
              placeholder="Your thoughts on this track…"
              rows={3}
              value={editNotes}
              onChange={e => setEditNotes(e.target.value)}
            />
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="px-4 py-3 border-t flex items-center gap-4">
        {mode === "view" ? (
          <button
            type="button"
            className="text-sm text-primary hover:underline"
            onClick={openEdit}
          >
            Edit Review
          </button>
        ) : (
          <>
            <Button onClick={save} disabled={saving || !editRating} size="sm">
              {saving ? "Saving…" : "Save Review"}
            </Button>
            {!editRating && <span className="text-xs text-muted-foreground">Rating is required</span>}
            <button
              type="button"
              className="text-sm text-muted-foreground hover:underline ml-auto"
              onClick={cancelEdit}
            >
              Cancel
            </button>
          </>
        )}
      </div>
    </div>
  );
}
