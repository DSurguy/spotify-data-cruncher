import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "bun:test";
import { TrackDetail } from "./TrackDetail";
import type { GetTrackResponse } from "@/types/api";

const mockTrackResponse: GetTrackResponse = {
  track: {
    track_key: "spotify:track:abc",
    track_name: "Paranoid Android",
    artist_name: "Radiohead",
    album_name: "OK Computer",
    play_count: 55,
    total_ms_played: 16_500_000,
    first_played: "2019-03-01T00:00:00Z",
    last_played: "2025-01-15T00:00:00Z",
    skip_rate: 3.6,
    skipped_count: 2,
    genre: "Alternative",
    rating: null,
    notes: null,
    reviewed: false,
  },
  albums: [
    { album_key: "ok computer||radiohead", album_name: "OK Computer", artist_name: "Radiohead", play_count: 80 },
  ],
  plays: {
    items: [
      { ts: "2025-01-15T10:00:00Z", ms_played: 380_000, skipped: false, platform: "Desktop", reason_start: null, reason_end: null, shuffle: false },
    ],
    total: 1,
    page: 1,
    page_size: 50,
  },
};

beforeEach(() => {
  globalThis.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => mockTrackResponse,
  } as any);
});

describe("TrackDetail", () => {
  it("shows track name and artist after loading", async () => {
    render(<TrackDetail trackKey="spotify:track:abc" from="explore" onClose={() => {}} />);
    await waitFor(() => screen.getByRole("heading", { hidden: false, name: /Paranoid Android/ }));
    expect(screen.getByText("Radiohead")).toBeInTheDocument();
  });

  it("shows '← Explore' breadcrumb when from=explore", async () => {
    render(<TrackDetail trackKey="spotify:track:abc" from="explore" onClose={() => {}} />);
    await waitFor(() => screen.getByRole("button", { name: "← Explore" }));
  });

  it("shows '← Review' breadcrumb when from=review", async () => {
    render(<TrackDetail trackKey="spotify:track:abc" from="review" onClose={() => {}} />);
    await waitFor(() => screen.getByRole("button", { name: "← Review" }));
  });

  it("calls onClose when breadcrumb button clicked", async () => {
    const onClose = vi.fn();
    render(<TrackDetail trackKey="spotify:track:abc" from="explore" onClose={onClose} />);
    await waitFor(() => screen.getByRole("button", { name: "← Explore" }));
    fireEvent.click(screen.getByRole("button", { name: "← Explore" }));
    expect(onClose).toHaveBeenCalled();
  });

  it("starts in view mode when from=explore", async () => {
    render(<TrackDetail trackKey="spotify:track:abc" from="explore" onClose={() => {}} />);
    await waitFor(() => screen.getByLabelText("Genre"));
    expect(screen.queryByRole("group", { name: "Rating" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Review this track/ })).toBeInTheDocument();
  });

  it("shows rating in view-mode notes section", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        ...mockTrackResponse,
        track: { ...mockTrackResponse.track, rating: "like", reviewed: true },
      }),
    } as any);
    render(<TrackDetail trackKey="spotify:track:abc" from="explore" onClose={() => {}} />);
    await waitFor(() => screen.getByLabelText("Genre"));
    expect(screen.getByText("♥ Like")).toBeInTheDocument();
  });

  it("shows 'Edit Review' button when track is already reviewed", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        ...mockTrackResponse,
        track: { ...mockTrackResponse.track, rating: "like", reviewed: true },
      }),
    } as any);
    render(<TrackDetail trackKey="spotify:track:abc" from="explore" onClose={() => {}} />);
    await waitFor(() => screen.getByRole("button", { name: "Edit Review" }));
    expect(screen.queryByRole("button", { name: /Review this track/ })).not.toBeInTheDocument();
  });

  it("starts in review mode when from=review", async () => {
    render(<TrackDetail trackKey="spotify:track:abc" from="review" onClose={() => {}} />);
    await waitFor(() => screen.getByRole("group", { name: "Rating" }));
    expect(screen.getByRole("button", { name: /Complete Review/ })).toBeInTheDocument();
  });

  it("shows like/dislike/none buttons in review mode", async () => {
    render(<TrackDetail trackKey="spotify:track:abc" from="review" onClose={() => {}} />);
    await waitFor(() => screen.getByRole("group", { name: "Rating" }));
    expect(screen.getByRole("button", { name: "♥ Like" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "— No opinion" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "✕ Dislike" })).toBeInTheDocument();
  });

  it("'Complete Review' is disabled until a rating is selected", async () => {
    render(<TrackDetail trackKey="spotify:track:abc" from="review" onClose={() => {}} />);
    await waitFor(() => screen.getByRole("button", { name: /Complete Review/ }));
    expect(screen.getByRole("button", { name: /Complete Review/ })).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "♥ Like" }));
    expect(screen.getByRole("button", { name: /Complete Review/ })).not.toBeDisabled();
  });

  it("entering review mode from explore shows 'Exit review mode' button", async () => {
    render(<TrackDetail trackKey="spotify:track:abc" from="explore" onClose={() => {}} />);
    await waitFor(() => screen.getByRole("button", { name: /Review this track/ }));
    fireEvent.click(screen.getByRole("button", { name: /Review this track/ }));
    expect(screen.getByRole("button", { name: "Exit review mode" })).toBeInTheDocument();
  });

  it("'Exit review mode' returns to view mode", async () => {
    render(<TrackDetail trackKey="spotify:track:abc" from="explore" onClose={() => {}} />);
    await waitFor(() => screen.getByRole("button", { name: /Review this track/ }));
    fireEvent.click(screen.getByRole("button", { name: /Review this track/ }));
    expect(screen.getByRole("button", { name: "Exit review mode" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Exit review mode" }));
    expect(screen.queryByRole("button", { name: "Exit review mode" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Review this track/ })).toBeInTheDocument();
  });

  it("completing review from=review shows 'Review another?' prompt", async () => {
    (globalThis.fetch as any)
      .mockResolvedValueOnce({ ok: true, json: async () => mockTrackResponse })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ ok: true }) });

    render(<TrackDetail trackKey="spotify:track:abc" from="review" onClose={() => {}} />);
    await waitFor(() => screen.getByRole("group", { name: "Rating" }));

    fireEvent.click(screen.getByRole("button", { name: "♥ Like" }));
    fireEvent.click(screen.getByRole("button", { name: /Complete Review/ }));

    await waitFor(() => screen.getByText("Review another track?"));
    expect(screen.getByRole("button", { name: /Yes/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /No/ })).toBeInTheDocument();
  });

  it("'Yes, back to Review' calls onClose after completing review", async () => {
    const onClose = vi.fn();
    (globalThis.fetch as any)
      .mockResolvedValueOnce({ ok: true, json: async () => mockTrackResponse })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ ok: true }) });

    render(<TrackDetail trackKey="spotify:track:abc" from="review" onClose={onClose} />);
    await waitFor(() => screen.getByRole("group", { name: "Rating" }));

    fireEvent.click(screen.getByRole("button", { name: "♥ Like" }));
    fireEvent.click(screen.getByRole("button", { name: /Complete Review/ }));

    await waitFor(() => screen.getByRole("button", { name: /Yes/ }));
    fireEvent.click(screen.getByRole("button", { name: /Yes/ }));
    expect(onClose).toHaveBeenCalled();
  });

  it("sends PUT to overrides with correct fields on Complete Review", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => mockTrackResponse })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ ok: true }) });
    globalThis.fetch = fetchMock;

    render(<TrackDetail trackKey="spotify:track:abc" from="review" onClose={() => {}} />);
    await waitFor(() => screen.getByRole("group", { name: "Rating" }));

    fireEvent.click(screen.getByRole("button", { name: "♥ Like" }));
    fireEvent.click(screen.getByRole("button", { name: /Complete Review/ }));

    await waitFor(() => screen.getByText("Review another track?"));

    const putCall = fetchMock.mock.calls[1];
    expect(putCall[0]).toContain("/api/overrides/track/");
    expect(putCall[1].method).toBe("PUT");
    const body = JSON.parse(putCall[1].body);
    expect(body.some((f: any) => f.field === "rating" && f.value === '"like"')).toBe(true);
    expect(body.some((f: any) => f.field === "reviewed" && f.value === "true")).toBe(true);
  });

  it("shows album entry in 'Appears on' section", async () => {
    render(<TrackDetail trackKey="spotify:track:abc" from="explore" onClose={() => {}} />);
    await waitFor(() => screen.getByRole("button", { name: "OK Computer" }));
    expect(screen.getByRole("button", { name: "OK Computer" })).toBeInTheDocument();
  });

  it("calls onAlbumSelect when album is clicked", async () => {
    const onAlbumSelect = vi.fn();
    render(<TrackDetail trackKey="spotify:track:abc" from="explore" onClose={() => {}} onAlbumSelect={onAlbumSelect} />);
    await waitFor(() => screen.getByRole("button", { name: "OK Computer" }));
    fireEvent.click(screen.getByRole("button", { name: "OK Computer" }));
    expect(onAlbumSelect).toHaveBeenCalledWith("ok computer||radiohead");
  });
});
