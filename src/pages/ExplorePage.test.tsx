import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "bun:test";
import { ExplorePage } from "./ExplorePage";
import type { GetTracksResponse } from "@/types/api";

const sampleTrack = {
  track_key: "spotify:track:aaa",
  track_name: "Fake Plastic Trees",
  artist_name: "Radiohead",
  album_name: "The Bends",
  play_count: 47,
  total_ms_played: 14_100_000,
  first_played: "2020-01-01T00:00:00Z",
  last_played: "2025-03-01T10:00:00Z",
  skip_rate: 8.5,
  genre: "Alternative",
  rating: null as "like" | "dislike" | "none" | null,
  notes: null,
  reviewed: false,
};

function makeTracksResponse(overrides: Partial<GetTracksResponse> = {}): GetTracksResponse {
  return { tracks: [sampleTrack], total: 1, page: 1, page_size: 50, ...overrides };
}

beforeEach(() => {
  globalThis.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => makeTracksResponse(),
  } as any);
});

describe("ExplorePage", () => {
  it("renders heading and controls", async () => {
    render(<ExplorePage onTrackSelect={() => {}} onAlbumSelect={() => {}} onArtistSelect={() => {}} />);
    await waitFor(() => screen.getByRole("heading", { name: "Explore" }));
    expect(screen.getByPlaceholderText("Track, artist, or album…")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Search" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /genre/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /artist/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /album/i })).toBeInTheDocument();
  });

  it("shows flat track list after loading", async () => {
    render(<ExplorePage onTrackSelect={() => {}} onAlbumSelect={() => {}} onArtistSelect={() => {}} />);
    await waitFor(() => screen.getByText("Fake Plastic Trees"));
    expect(screen.getByText("Radiohead")).toBeInTheDocument();
  });

  it("shows empty state when no tracks", async () => {
    (globalThis.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => makeTracksResponse({ tracks: [], total: 0 }),
    } as any);
    render(<ExplorePage onTrackSelect={() => {}} onAlbumSelect={() => {}} onArtistSelect={() => {}} />);
    await waitFor(() => screen.getByText("No tracks found."));
  });

  it("calls onTrackSelect when track row is clicked", async () => {
    const onTrackSelect = vi.fn();
    render(<ExplorePage onTrackSelect={onTrackSelect} onAlbumSelect={() => {}} onArtistSelect={() => {}} />);
    await waitFor(() => screen.getByText("Fake Plastic Trees"));
    fireEvent.click(screen.getByText("Fake Plastic Trees"));
    expect(onTrackSelect).toHaveBeenCalledWith("spotify:track:aaa");
  });

  it("toggling artist group re-fetches with large page_size", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => makeTracksResponse(),
    } as any);
    globalThis.fetch = fetchMock;

    render(<ExplorePage onTrackSelect={() => {}} onAlbumSelect={() => {}} onArtistSelect={() => {}} />);
    await waitFor(() => screen.getByText("Fake Plastic Trees"));

    fireEvent.click(screen.getByRole("button", { name: /artist/i }));

    await waitFor(() => {
      const calls = fetchMock.mock.calls as string[][];
      const lastUrl = calls[calls.length - 1][0] as string;
      expect(lastUrl).toContain("page_size=2000");
    });
  });

  it("shows grouped tree view with artist group header after toggle", async () => {
    render(<ExplorePage onTrackSelect={() => {}} onAlbumSelect={() => {}} onArtistSelect={() => {}} />);
    await waitFor(() => screen.getByText("Fake Plastic Trees"));

    fireEvent.click(screen.getByRole("button", { name: /artist/i }));

    await waitFor(() => {
      // Artist group node label should appear
      expect(screen.getByText("Radiohead")).toBeInTheDocument();
    });
  });

  it("calls onArtistSelect when artist group label is clicked in grouped view", async () => {
    const onArtistSelect = vi.fn();
    render(<ExplorePage onTrackSelect={() => {}} onAlbumSelect={() => {}} onArtistSelect={onArtistSelect} />);
    await waitFor(() => screen.getByText("Fake Plastic Trees"));

    fireEvent.click(screen.getByRole("button", { name: /artist/i }));

    await waitFor(() => screen.getByText("Radiohead"));

    // Expand the group first
    const artistRow = screen.getByText("Radiohead").closest("div")!;
    fireEvent.click(artistRow);

    // Now click the Radiohead button (artist label link)
    const artistBtn = screen.getAllByRole("button", { name: "Radiohead" })[0];
    fireEvent.click(artistBtn);
    expect(onArtistSelect).toHaveBeenCalledWith("radiohead");
  });

  it("shows search clear button when search is active", async () => {
    render(<ExplorePage onTrackSelect={() => {}} onAlbumSelect={() => {}} onArtistSelect={() => {}} />);
    await waitFor(() => screen.getByText("Fake Plastic Trees"));

    fireEvent.change(screen.getByPlaceholderText("Track, artist, or album…"), { target: { value: "test" } });
    expect(screen.getByRole("button", { name: "Clear search" })).toBeInTheDocument();
  });
});
