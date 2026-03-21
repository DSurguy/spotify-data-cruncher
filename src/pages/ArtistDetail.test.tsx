import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "bun:test";
import { ArtistDetail } from "./ArtistDetail";
import type { Artist, GetAlbumsResponse, GetTracksResponse } from "@/types/api";

const mockArtist: Artist = {
  artist_key: "radiohead",
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

describe("ArtistDetail", () => {
  it("renders artist name and stats after loading", async () => {
    render(<ArtistDetail artistKey="radiohead" onClose={() => {}} onAlbumSelect={() => {}} onTrackSelect={() => {}} />);
    await waitFor(() => screen.getByRole("heading", { name: "Radiohead" }));
    expect(screen.getByText("200 plays")).toBeInTheDocument();
    expect(screen.getByText("5 albums")).toBeInTheDocument();
    expect(screen.getAllByText("Alternative").length).toBeGreaterThan(0);
  });

  it("shows breadcrumb back to Explore", async () => {
    const onClose = vi.fn();
    render(<ArtistDetail artistKey="radiohead" onClose={onClose} onAlbumSelect={() => {}} onTrackSelect={() => {}} />);
    await waitFor(() => screen.getByRole("heading", { name: "Radiohead" }));
    fireEvent.click(screen.getByRole("button", { name: /Explore/ }));
    expect(onClose).toHaveBeenCalled();
  });

  it("shows albums tab by default with album rows", async () => {
    render(<ArtistDetail artistKey="radiohead" onClose={() => {}} onAlbumSelect={() => {}} onTrackSelect={() => {}} />);
    await waitFor(() => screen.getByText("OK Computer"));
  });

  it("calls onAlbumSelect when an album is clicked", async () => {
    const onAlbumSelect = vi.fn();
    render(<ArtistDetail artistKey="radiohead" onClose={() => {}} onAlbumSelect={onAlbumSelect} onTrackSelect={() => {}} />);
    await waitFor(() => screen.getByText("OK Computer"));
    fireEvent.click(screen.getByRole("button", { name: /OK Computer/ }));
    expect(onAlbumSelect).toHaveBeenCalledWith("ok computer||radiohead");
  });

  it("switches to tracks tab and shows tracks", async () => {
    render(<ArtistDetail artistKey="radiohead" onClose={() => {}} onAlbumSelect={() => {}} onTrackSelect={() => {}} />);
    await waitFor(() => screen.getByRole("heading", { name: "Radiohead" }));
    fireEvent.click(screen.getByRole("button", { name: /Tracks/ }));
    await waitFor(() => screen.getByText("Paranoid Android"));
  });

  it("calls onTrackSelect when a track is clicked", async () => {
    const onTrackSelect = vi.fn();
    render(<ArtistDetail artistKey="radiohead" onClose={() => {}} onAlbumSelect={() => {}} onTrackSelect={onTrackSelect} />);
    await waitFor(() => screen.getByRole("heading", { name: "Radiohead" }));
    fireEvent.click(screen.getByRole("button", { name: /Tracks/ }));
    await waitFor(() => screen.getByText("Paranoid Android"));
    fireEvent.click(screen.getByRole("button", { name: /Paranoid Android/ }));
    expect(onTrackSelect).toHaveBeenCalledWith("spotify:track:paranoid");
  });

  it("shows 404 state for unknown artist", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      json: async () => null,
    } as any);
    render(<ArtistDetail artistKey="unknown-key" onClose={() => {}} onAlbumSelect={() => {}} onTrackSelect={() => {}} />);
    await waitFor(() => screen.getByText("Artist not found."));
  });
});
