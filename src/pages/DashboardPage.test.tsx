import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "bun:test";
import { DashboardPage } from "./DashboardPage";
import type { GetSummaryResponse, GetTopArtistsResponse, GetTopAlbumsResponse, GetTopTracksResponse, GetTimelineResponse, GetPlatformsResponse } from "@/routes/stats";

const mockSummary: GetSummaryResponse = {
  summary: {
    total_plays: 155784,
    total_ms_played: 40_000_000_000,  // ~11,111 hours
    unique_tracks: 8200,
    unique_albums: 950,
    unique_artists: 420,
    first_played: "2019-08-21T14:05:56Z",
    last_played: "2025-03-15T10:00:00Z",
  },
};

const mockTopArtists: GetTopArtistsResponse = {
  artists: [
    { artist_key: "radiohead", artist_name: "Radiohead", play_count: 500, total_ms_played: 90_000_000 },
    { artist_key: "portishead", artist_name: "Portishead", play_count: 200, total_ms_played: 40_000_000 },
  ],
};

const mockTopAlbums: GetTopAlbumsResponse = {
  albums: [
    { album_key: "ok computer||radiohead", album_name: "OK Computer", artist_name: "Radiohead", play_count: 120, total_ms_played: 22_000_000 },
    { album_key: "dummy||portishead", album_name: "Dummy", artist_name: "Portishead", play_count: 90, total_ms_played: 18_000_000 },
  ],
};

const mockTopTracks: GetTopTracksResponse = {
  tracks: [
    { track_key: "spotify:track:aaa", track_name: "Karma Police", artist_name: "Radiohead", album_name: "OK Computer", play_count: 55, total_ms_played: 5_000_000 },
    { track_key: "spotify:track:bbb", track_name: "Sour Times", artist_name: "Portishead", album_name: "Dummy", play_count: 42, total_ms_played: 4_000_000 },
  ],
};

const mockTimeline: GetTimelineResponse = {
  granularity: "month",
  points: [
    { period: "2024-01", total_ms_played: 3_600_000 },
    { period: "2024-02", total_ms_played: 7_200_000 },
    { period: "2024-03", total_ms_played: 1_800_000 },
  ],
};

const mockPlatforms: GetPlatformsResponse = {
  platforms: [
    { platform: "macOS",   play_count: 800, total_ms_played: 50_000_000 },
    { platform: "Android", play_count: 400, total_ms_played: 20_000_000 },
    { platform: "Windows", play_count: 150, total_ms_played: 8_000_000 },
  ],
};

function makeFetchMock() {
  return vi.fn().mockImplementation((url: string) => {
    if (url.includes("top-artists")) {
      return Promise.resolve({ ok: true, json: async () => mockTopArtists } as any);
    }
    if (url.includes("top-albums")) {
      return Promise.resolve({ ok: true, json: async () => mockTopAlbums } as any);
    }
    if (url.includes("top-tracks")) {
      return Promise.resolve({ ok: true, json: async () => mockTopTracks } as any);
    }
    if (url.includes("timeline")) {
      return Promise.resolve({ ok: true, json: async () => mockTimeline } as any);
    }
    if (url.includes("platforms")) {
      return Promise.resolve({ ok: true, json: async () => mockPlatforms } as any);
    }
    return Promise.resolve({ ok: true, json: async () => mockSummary } as any);
  });
}

beforeEach(() => {
  globalThis.fetch = makeFetchMock();
});

describe("DashboardPage", () => {
  it("renders all stat cards after loading", async () => {
    render(<DashboardPage />);
    await waitFor(() => screen.getByText("Dashboard"));
    expect(screen.getByText("Total listening time")).toBeInTheDocument();
    expect(screen.getByText("Total plays")).toBeInTheDocument();
    expect(screen.getByText("Unique tracks")).toBeInTheDocument();
    expect(screen.getByText("Unique albums")).toBeInTheDocument();
    expect(screen.getByText("Unique artists")).toBeInTheDocument();
  });

  it("displays total plays count", async () => {
    render(<DashboardPage />);
    await waitFor(() => screen.getByText("155,784"));
  });

  it("displays unique artists count", async () => {
    render(<DashboardPage />);
    await waitFor(() => screen.getByText("420"));
  });

  it("displays first played date", async () => {
    render(<DashboardPage />);
    await waitFor(() => screen.getByText("Aug 21, 2019"));
  });

  it("renders Top Artists panel with artist names", async () => {
    render(<DashboardPage />);
    await waitFor(() => screen.getByText("Top Artists"));
    expect(screen.getAllByText("Radiohead").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Portishead").length).toBeGreaterThanOrEqual(1);
  });

  it("renders Top Albums panel with album and artist names", async () => {
    render(<DashboardPage />);
    await waitFor(() => screen.getByText("Top Albums"));
    expect(screen.getByText("OK Computer")).toBeInTheDocument();
    expect(screen.getByText("Dummy")).toBeInTheDocument();
  });

  it("renders Top Tracks panel with track names and play counts", async () => {
    render(<DashboardPage />);
    await waitFor(() => screen.getByText("Top Tracks"));
    expect(screen.getByText("Karma Police")).toBeInTheDocument();
    expect(screen.getByText("55 plays")).toBeInTheDocument();
    expect(screen.getByText("Sour Times")).toBeInTheDocument();
    expect(screen.getByText("42 plays")).toBeInTheDocument();
  });

  it("shows Loading state initially", () => {
    render(<DashboardPage />);
    expect(screen.getByText("Loading…")).toBeInTheDocument();
  });

  it("renders Listening Timeline section", async () => {
    render(<DashboardPage />);
    await waitFor(() => screen.getByText("Listening Timeline"));
    expect(screen.getByLabelText("Listening timeline chart")).toBeInTheDocument();
  });

  it("renders granularity toggle buttons", async () => {
    render(<DashboardPage />);
    await waitFor(() => screen.getByRole("group", { name: "Granularity" }));
    expect(screen.getByRole("button", { name: "week" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "month" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "year" })).toBeInTheDocument();
  });

  it("refetches timeline when granularity changes", async () => {
    const fetchMock = makeFetchMock();
    globalThis.fetch = fetchMock;
    render(<DashboardPage />);
    await waitFor(() => screen.getByRole("button", { name: "week" }));
    fireEvent.click(screen.getByRole("button", { name: "week" }));
    await waitFor(() => {
      const calls = fetchMock.mock.calls.map((c: any[]) => c[0] as string);
      const timelineCalls = calls.filter(u => u.includes("timeline"));
      expect(timelineCalls.some(u => u.includes("granularity=week"))).toBe(true);
    });
  });

  it("renders year filter select when data spans multiple years", async () => {
    render(<DashboardPage />);
    await waitFor(() => screen.getByLabelText("Filter by year"));
    expect(screen.getByLabelText("Filter by year")).toBeInTheDocument();
  });

  it("renders Platform Breakdown section with platform labels", async () => {
    render(<DashboardPage />);
    await waitFor(() => screen.getByText("Platform Breakdown"));
    expect(screen.getByLabelText("Platform breakdown chart")).toBeInTheDocument();
    expect(screen.getByText("macOS")).toBeInTheDocument();
    expect(screen.getByText("Android")).toBeInTheDocument();
    expect(screen.getByText("Windows")).toBeInTheDocument();
  });
});
