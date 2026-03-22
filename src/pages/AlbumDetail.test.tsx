import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "bun:test";
import { Router, Route } from "wouter";
import { memoryLocation } from "wouter/memory-location";
import { AlbumDetail } from "./AlbumDetail";
import type { Album } from "@/types/api";

const ALBUM_SLUG = "you-won-t-like-this";

const mockAlbum: Album = {
  album_slug: ALBUM_SLUG,
  album_name: "You Won't Like This",
  artist_name: "Wolfs",
  artist_slug: "wolfs",
  play_count: 42,
  total_ms_played: 5_000_000,
  track_count: 10,
  first_played: "2022-01-01T00:00:00Z",
  last_played: "2023-06-01T00:00:00Z",
  genre: "Rock",
  rating: 4,
  notes: "Great album",
  art_url: null,
};

function renderDetail() {
  const { hook } = memoryLocation({ path: `/albums/${ALBUM_SLUG}` });
  return render(
    <Router hook={hook}>
      <Route path="/albums/:key"><AlbumDetail /></Route>
    </Router>
  );
}

beforeEach(() => {
  globalThis.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ album: mockAlbum, tracks: [], total: 0, page: 1, page_size: 200 }),
  } as any);
});

describe("AlbumDetail", () => {
  it("renders album name and artist after loading", async () => {
    renderDetail();
    await waitFor(() => screen.getByText("You Won't Like This"));
    expect(screen.getByText("Wolfs")).toBeInTheDocument();
  });

  it("pre-fills rating, genre, and notes from loaded album", async () => {
    renderDetail();
    await waitFor(() => screen.getByLabelText("Genre"));
    expect((screen.getByLabelText("Genre") as HTMLInputElement).value).toBe("Rock");
    expect((screen.getByLabelText("Notes") as HTMLTextAreaElement).value).toBe("Great album");
  });

  it("shows back button", async () => {
    renderDetail();
    await waitFor(() => screen.getByText("You Won't Like This"));
    expect(screen.getByRole("button", { name: /Back/ })).toBeInTheDocument();
  });

  it("calls PUT overrides when Save clicked", async () => {
    (globalThis.fetch as any)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ album: mockAlbum }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ tracks: [], total: 0, page: 1, page_size: 200 }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ ok: true }) });

    renderDetail();
    await waitFor(() => screen.getByText("You Won't Like This"));
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => screen.getByText("Saved!"));

    const calls = (globalThis.fetch as any).mock.calls;
    const saveCall = calls[calls.length - 1];
    expect(saveCall[0]).toContain("/api/overrides/album/");
    expect(saveCall[1].method).toBe("PUT");
  });

  it("artist name is a link with correct href", async () => {
    renderDetail();
    await waitFor(() => screen.getByText("You Won't Like This"));
    const link = screen.getByRole("link", { name: "Wolfs" });
    expect(link.getAttribute("href")).toBe(`/artists/wolfs`);
  });

  it("shows tracks section with track list", async () => {
    const mockTrack = {
      track_slug: "aaa",
      track_name: "Song One",
      artist_name: "Wolfs",
      artist_slug: "wolfs",
      album_name: "You Won't Like This",
      album_slug: ALBUM_SLUG,
      play_count: 5,
      total_ms_played: 300_000,
      first_played: "2022-01-01T00:00:00Z",
      last_played: "2023-01-01T00:00:00Z",
      skip_rate: 0,
      genre: null,
      rating: null,
      notes: null,
      reviewed: false,
    };
    (globalThis.fetch as any)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ album: mockAlbum }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ tracks: [mockTrack], total: 1, page: 1, page_size: 200 }) });

    renderDetail();
    await waitFor(() => screen.getByText("Song One"));
  });

  it("track link has correct href", async () => {
    const mockTrack = {
      track_slug: "aaa",
      track_name: "Song One",
      artist_name: "Wolfs",
      artist_slug: "wolfs",
      album_name: "You Won't Like This",
      album_slug: ALBUM_SLUG,
      play_count: 5,
      total_ms_played: 300_000,
      first_played: "2022-01-01T00:00:00Z",
      last_played: "2023-01-01T00:00:00Z",
      skip_rate: 0,
      genre: null,
      rating: null,
      notes: null,
      reviewed: false,
    };
    (globalThis.fetch as any)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ album: mockAlbum }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ tracks: [mockTrack], total: 1, page: 1, page_size: 200 }) });

    renderDetail();
    await waitFor(() => screen.getByRole("link", { name: /Song One/ }));
    const link = screen.getByRole("link", { name: /Song One/ });
    expect(link.getAttribute("href")).toBe(`/tracks/aaa`);
  });
});
