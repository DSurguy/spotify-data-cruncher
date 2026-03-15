import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "bun:test";
import { TracksPage } from "./TracksPage";
import type { GetTracksResponse } from "@/types/api";

const sampleTrack = {
  track_key: "spotify:track:aaa",
  track_name: "Fake Plastic Trees",
  artist_name: "Radiohead",
  album_name: "The Bends",
  play_count: 47,
  total_ms_played: 14_100_000,
  last_played: "2025-03-01T10:00:00Z",
  skip_rate: 8.5,
  rating: 5,
  notes: null,
};

function makeResponse(overrides: Partial<GetTracksResponse> = {}): GetTracksResponse {
  return { tracks: [sampleTrack], total: 1, page: 1, page_size: 50, ...overrides };
}

beforeEach(() => {
  globalThis.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => makeResponse(),
  } as any);
});

describe("TracksPage", () => {
  it("renders heading and filter bar", async () => {
    render(<TracksPage />);
    await waitFor(() => screen.getByRole("heading", { name: "Tracks" }));
    expect(screen.getByLabelText("Track")).toBeInTheDocument();
    expect(screen.getByLabelText("Artist")).toBeInTheDocument();
    expect(screen.getByLabelText("Album")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Apply" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Clear" })).toBeInTheDocument();
  });

  it("displays track row data", async () => {
    render(<TracksPage />);
    await waitFor(() => screen.getByText("Fake Plastic Trees"));
    expect(screen.getByText("Radiohead")).toBeInTheDocument();
    expect(screen.getByText("The Bends")).toBeInTheDocument();
    expect(screen.getByText("47")).toBeInTheDocument();
    expect(screen.getByText("8.5%")).toBeInTheDocument();
  });

  it("shows total track count", async () => {
    render(<TracksPage />);
    await waitFor(() => screen.getByText("1 tracks"));
  });

  it("refetches with artist filter on Apply", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => makeResponse({ tracks: [], total: 0 }),
    } as any);
    globalThis.fetch = fetchMock;

    render(<TracksPage />);
    await waitFor(() => screen.getByRole("button", { name: "Apply" }));

    fireEvent.change(screen.getByLabelText("Artist"), { target: { value: "Portishead" } });
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));

    await waitFor(() => {
      const lastCall = fetchMock.mock.calls[fetchMock.mock.calls.length - 1][0] as string;
      expect(lastCall).toContain("artist=Portishead");
    });
  });

  it("shows empty state when no tracks returned", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => makeResponse({ tracks: [], total: 0 }),
    } as any);
    render(<TracksPage />);
    await waitFor(() => screen.getByText("No tracks found."));
  });

  it("shows pagination when total exceeds page size", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => makeResponse({
        total: 120,
        tracks: Array.from({ length: 50 }, (_, i) => ({ ...sampleTrack, track_key: `t${i}`, track_name: `Track ${i}` })),
      }),
    } as any);
    render(<TracksPage />);
    await waitFor(() => screen.getByText("Page 1 of 3"));
  });
});
