import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "bun:test";
import { Router, Route } from "wouter";
import { memoryLocation } from "wouter/memory-location";
import { TrackDetail } from "./TrackDetail";
import type { GetTrackResponse } from "@/types/api";

const TRACK_SLUG = "paranoid-android";

const mockTrackResponse: GetTrackResponse = {
  track: {
    track_slug: TRACK_SLUG,
    track_name: "Paranoid Android",
    artist_name: "Radiohead",
    artist_slug: "radiohead",
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
    { album_slug: "ok-computer", album_name: "OK Computer", artist_name: "Radiohead", play_count: 80 },
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

function renderDetail(mockOverrides?: Partial<GetTrackResponse>) {
  if (mockOverrides) {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ...mockTrackResponse, ...mockOverrides }),
    } as any);
  }
  const { hook } = memoryLocation({ path: `/tracks/${TRACK_SLUG}` });
  return render(
    <Router hook={hook}>
      <Route path="/tracks/:key"><TrackDetail /></Route>
    </Router>
  );
}

beforeEach(() => {
  globalThis.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => mockTrackResponse,
  } as any);
});

describe("TrackDetail", () => {
  it("shows track name and artist after loading", async () => {
    renderDetail();
    await waitFor(() => screen.getByRole("heading", { name: "Paranoid Android" }));
    expect(screen.getByText("Radiohead")).toBeInTheDocument();
  });

  it("shows back breadcrumb button", async () => {
    renderDetail();
    await waitFor(() => screen.getByRole("button", { name: "← Back" }));
  });

  it("shows play stats", async () => {
    renderDetail();
    await waitFor(() => screen.getByRole("heading", { name: "Paranoid Android" }));
    expect(screen.getByText("55 plays")).toBeInTheDocument();
    expect(screen.getByText("3.6% skip rate")).toBeInTheDocument();
  });

  it("shows '✓ Reviewed' badge when track is reviewed", async () => {
    renderDetail({ track: { ...mockTrackResponse.track, reviewed: true } });
    await waitFor(() => screen.getByText("✓ Reviewed"));
  });

  it("shows the Review card section", async () => {
    renderDetail();
    await waitFor(() => screen.getByRole("heading", { name: "Review" }));
    expect(screen.getByRole("button", { name: "Edit Review" })).toBeInTheDocument();
  });

  it("shows album in 'Appears on' section as a link", async () => {
    renderDetail();
    await waitFor(() => screen.getByRole("link", { name: /OK Computer/ }));
  });

  it("album link has correct href", async () => {
    renderDetail();
    await waitFor(() => screen.getByRole("link", { name: /OK Computer/ }));
    const link = screen.getByRole("link", { name: /OK Computer/ });
    expect(link.getAttribute("href")).toBe(`/albums/ok-computer`);
  });

  it("renders artist name as a link", async () => {
    renderDetail();
    await waitFor(() => screen.getByRole("link", { name: /Radiohead/ }));
  });

  it("artist link has correct href", async () => {
    renderDetail();
    await waitFor(() => screen.getByRole("link", { name: /Radiohead/ }));
    const link = screen.getByRole("link", { name: /Radiohead/ });
    expect(link.getAttribute("href")).toBe(`/artists/radiohead`);
  });

  it("shows play history table", async () => {
    renderDetail();
    await waitFor(() => screen.getByText("Play history (1)"));
    expect(screen.getByText("Desktop")).toBeInTheDocument();
  });

  it("shows loading state before data arrives", () => {
    globalThis.fetch = vi.fn().mockReturnValue(new Promise(() => {}));
    const { hook } = memoryLocation({ path: `/tracks/${TRACK_SLUG}` });
    render(
      <Router hook={hook}>
        <Route path="/tracks/:key"><TrackDetail /></Route>
      </Router>
    );
    expect(screen.getByText("Loading…")).toBeInTheDocument();
  });
});
