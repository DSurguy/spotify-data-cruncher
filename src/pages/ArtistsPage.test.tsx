import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "bun:test";
import { ArtistsPage } from "./ArtistsPage";
import type { GetArtistsResponse } from "@/types/api";

const sampleArtist = {
  artist_key: "radiohead",
  artist_name: "Radiohead",
  play_count: 423,
  total_ms_played: 90_000_000,
  album_count: 9,
  first_played: "2019-09-01T12:00:00Z",
  last_played: "2025-03-10T08:00:00Z",
  genre: "Alternative",
  rating: 5,
  notes: null,
};

function makeResponse(overrides: Partial<GetArtistsResponse> = {}): GetArtistsResponse {
  return { artists: [sampleArtist], total: 1, page: 1, page_size: 50, ...overrides };
}

beforeEach(() => {
  globalThis.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => makeResponse(),
  } as any);
});

describe("ArtistsPage", () => {
  it("renders heading and filter bar", async () => {
    render(<ArtistsPage />);
    await waitFor(() => screen.getByRole("heading", { name: "Artists" }));
    expect(screen.getByLabelText("Artist")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Apply" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Clear" })).toBeInTheDocument();
  });

  it("displays artist row data", async () => {
    render(<ArtistsPage />);
    await waitFor(() => screen.getByText("Radiohead"));
    expect(screen.getByText("Alternative")).toBeInTheDocument();
    expect(screen.getByText("9 albums")).toBeInTheDocument();
    expect(screen.getByText("423 plays")).toBeInTheDocument();
    expect(screen.getByText("25h 0m")).toBeInTheDocument();
  });

  it("shows total artist count", async () => {
    render(<ArtistsPage />);
    await waitFor(() => screen.getByText("1 artists"));
  });

  it("refetches with updated artist filter on Apply", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => makeResponse({ artists: [], total: 0 }),
    } as any);
    globalThis.fetch = fetchMock;

    render(<ArtistsPage />);
    await waitFor(() => screen.getByRole("button", { name: "Apply" }));

    fireEvent.change(screen.getByLabelText("Artist"), { target: { value: "Portishead" } });
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));

    await waitFor(() => {
      const lastCall = fetchMock.mock.calls[fetchMock.mock.calls.length - 1][0] as string;
      expect(lastCall).toContain("artist=Portishead");
    });
  });

  it("shows empty state when no artists", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => makeResponse({ artists: [], total: 0 }),
    } as any);
    render(<ArtistsPage />);
    await waitFor(() => screen.getByText("No artists found."));
  });

  it("shows pagination when total exceeds page size", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => makeResponse({
        total: 110,
        artists: Array.from({ length: 50 }, (_, i) => ({ ...sampleArtist, artist_key: `artist_${i}`, artist_name: `Artist ${i}` })),
      }),
    } as any);
    render(<ArtistsPage />);
    await waitFor(() => screen.getByText("Page 1 of 3"));
  });
});
