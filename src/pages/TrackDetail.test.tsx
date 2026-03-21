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
    render(<TrackDetail trackKey="spotify:track:abc" onClose={() => {}} />);
    await waitFor(() => screen.getByRole("heading", { name: "Paranoid Android" }));
    expect(screen.getByText("Radiohead")).toBeInTheDocument();
  });

  it("shows '← Explore' breadcrumb", async () => {
    render(<TrackDetail trackKey="spotify:track:abc" onClose={() => {}} />);
    await waitFor(() => screen.getByRole("button", { name: "← Explore" }));
  });

  it("calls onClose when breadcrumb clicked", async () => {
    const onClose = vi.fn();
    render(<TrackDetail trackKey="spotify:track:abc" onClose={onClose} />);
    await waitFor(() => screen.getByRole("button", { name: "← Explore" }));
    fireEvent.click(screen.getByRole("button", { name: "← Explore" }));
    expect(onClose).toHaveBeenCalled();
  });

  it("shows play stats", async () => {
    render(<TrackDetail trackKey="spotify:track:abc" onClose={() => {}} />);
    await waitFor(() => screen.getByRole("heading", { name: "Paranoid Android" }));
    expect(screen.getByText("55 plays")).toBeInTheDocument();
    expect(screen.getByText("3.6% skip rate")).toBeInTheDocument();
  });

  it("shows '✓ Reviewed' badge when track is reviewed", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        ...mockTrackResponse,
        track: { ...mockTrackResponse.track, reviewed: true },
      }),
    } as any);
    render(<TrackDetail trackKey="spotify:track:abc" onClose={() => {}} />);
    await waitFor(() => screen.getByText("✓ Reviewed"));
  });

  it("shows the Review card section", async () => {
    render(<TrackDetail trackKey="spotify:track:abc" onClose={() => {}} />);
    await waitFor(() => screen.getByRole("heading", { name: "Review" }));
    expect(screen.getByRole("button", { name: "Edit Review" })).toBeInTheDocument();
  });

  it("shows album in 'Appears on' section", async () => {
    render(<TrackDetail trackKey="spotify:track:abc" onClose={() => {}} />);
    await waitFor(() => screen.getByRole("button", { name: /OK Computer/ }));
  });

  it("calls onAlbumSelect when album is clicked", async () => {
    const onAlbumSelect = vi.fn();
    render(<TrackDetail trackKey="spotify:track:abc" onClose={() => {}} onAlbumSelect={onAlbumSelect} />);
    await waitFor(() => screen.getByRole("button", { name: /OK Computer/ }));
    fireEvent.click(screen.getByRole("button", { name: /OK Computer/ }));
    expect(onAlbumSelect).toHaveBeenCalledWith("ok computer||radiohead");
  });

  it("shows play history table", async () => {
    render(<TrackDetail trackKey="spotify:track:abc" onClose={() => {}} />);
    await waitFor(() => screen.getByText("Play history (1)"));
    expect(screen.getByText("Desktop")).toBeInTheDocument();
  });

  it("shows loading state before data arrives", () => {
    globalThis.fetch = vi.fn().mockReturnValue(new Promise(() => {}));
    render(<TrackDetail trackKey="spotify:track:abc" onClose={() => {}} />);
    expect(screen.getByText("Loading…")).toBeInTheDocument();
  });
});
