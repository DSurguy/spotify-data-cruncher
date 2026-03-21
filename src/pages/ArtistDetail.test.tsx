import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "bun:test";
import { Router, Route } from "wouter";import { memoryLocation } from "wouter/memory-location";import { ArtistDetail } from "./ArtistDetail";
import type { Artist, GetAlbumsResponse, GetTracksResponse } from "@/types/api";

const ARTIST_KEY = "radiohead";

const mockArtist: Artist = {
  artist_key: ARTIST_KEY,
  artist_name: "Radiohead",
  play_count: 200,
  total_ms_played: 60_000_000,
  album_count: 5,
  first_played: "2019-01-01T00:00:00Z",
  last_played: "2025-01-01T00:00:00Z",
  genre: "Alternative",
  rating: null,
  notes: null,
  reviewed: false,
};

const mockAlbumsResponse: GetAlbumsResponse = {
  albums: [
    {
      album_key: "ok computer||radiohead",
      album_name: "OK Computer",
      artist_name: "Radiohead",
      play_count: 80,
      total_ms_played: 25_000_000,
      track_count: 12,
      first_played: "2019-01-01T00:00:00Z",
      last_played: "2025-01-01T00:00:00Z",
      genre: "Alternative",
      rating: null,
      notes: null,
      art_url: null,
    },
  ],
  total: 1,
  page: 1,
  page_size: 50,
};

const mockTracksResponse: GetTracksResponse = {
  tracks: [
    {
      track_key: "spotify:track:paranoid",
      track_name: "Paranoid Android",
      artist_name: "Radiohead",
      album_name: "OK Computer",
      play_count: 30,
      total_ms_played: 9_000_000,
      first_played: "2019-01-01T00:00:00Z",
      last_played: "2025-01-01T00:00:00Z",
      skip_rate: 2,
      genre: null,
      rating: null,
      notes: null,
      reviewed: false,
    },
  ],
  total: 1,
  page: 1,
  page_size: 50,
};

function renderDetail(artistKey = ARTIST_KEY) {
  const { hook } = memoryLocation({ path: `/artists/${encodeURIComponent(artistKey)}` });
  return render(
    <Router hook={hook}>
      <Route path="/artists/:key"><ArtistDetail /></Route>
    </Router>
  );
}

beforeEach(() => {
  globalThis.fetch = vi.fn().mockImplementation((url: string) => {
    if (url.includes("/api/artists/")) {
      return Promise.resolve({ ok: true, json: async () => mockArtist } as any);
    } else if (url.includes("/api/albums")) {
      return Promise.resolve({ ok: true, json: async () => mockAlbumsResponse } as any);
    } else {
      return Promise.resolve({ ok: true, json: async () => mockTracksResponse } as any);
    }
  });
});

afterEach(() => {
  window.history.replaceState({}, "", "/");
});

describe("ArtistDetail", () => {
  it("renders artist name and stats after loading", async () => {
    renderDetail();
    await waitFor(() => screen.getByRole("heading", { name: "Radiohead" }));
    expect(screen.getByText("200 plays")).toBeInTheDocument();
    expect(screen.getByText("5 albums")).toBeInTheDocument();
    expect(screen.getAllByText("Alternative").length).toBeGreaterThan(0);
  });

  it("shows back button", async () => {
    renderDetail();
    await waitFor(() => screen.getByRole("heading", { name: "Radiohead" }));
    expect(screen.getByRole("button", { name: /Back/ })).toBeInTheDocument();
  });

  it("shows albums tab by default with album rows", async () => {
    renderDetail();
    await waitFor(() => screen.getByText("OK Computer"));
  });

  it("album link has correct href", async () => {
    renderDetail();
    await waitFor(() => screen.getByRole("link", { name: /OK Computer/ }));
    const link = screen.getByRole("link", { name: /OK Computer/ });
    expect(link.getAttribute("href")).toBe(`/albums/${encodeURIComponent("ok computer||radiohead")}`);
  });

  it("switches to tracks tab and shows tracks", async () => {
    renderDetail();
    await waitFor(() => screen.getByRole("heading", { name: "Radiohead" }));
    fireEvent.click(screen.getByRole("button", { name: /Tracks/ }));
    await waitFor(() => screen.getByText("Paranoid Android"));
  });

  it("track link has correct href", async () => {
    renderDetail();
    await waitFor(() => screen.getByRole("heading", { name: "Radiohead" }));
    fireEvent.click(screen.getByRole("button", { name: /Tracks/ }));
    await waitFor(() => screen.getByRole("link", { name: /Paranoid Android/ }));
    const link = screen.getByRole("link", { name: /Paranoid Android/ });
    expect(link.getAttribute("href")).toBe(`/tracks/${encodeURIComponent("spotify:track:paranoid")}`);
  });

  it("shows 404 state for unknown artist", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      json: async () => null,
    } as any);
    renderDetail("unknown-key");
    await waitFor(() => screen.getByText("Artist not found."));
  });
});
