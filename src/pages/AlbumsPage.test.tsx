import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "bun:test";
import { AlbumsPage } from "./AlbumsPage";
import type { GetAlbumsResponse } from "@/types/api";

const mockAlbums: GetAlbumsResponse = {
  albums: [
    {
      album_key: "you won't like this||wolfs",
      album_name: "You Won't Like This",
      artist_name: "Wolfs",
      play_count: 42,
      total_ms_played: 5_000_000,
      track_count: 10,
      first_played: "2022-01-01T00:00:00Z",
      last_played: "2023-06-01T00:00:00Z",
      genre: "Rock",
      rating: 4,
      notes: null,
      art_url: null,
    },
  ],
  total: 1,
  page: 1,
  page_size: 50,
};

beforeEach(() => {
  globalThis.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => mockAlbums,
  } as any);
});

describe("AlbumsPage", () => {
  it("renders album cards after loading", async () => {
    render(<AlbumsPage onAlbumSelect={() => {}} />);
    await waitFor(() => expect(screen.getByText("You Won't Like This")).toBeInTheDocument());
    expect(screen.getByText("Wolfs")).toBeInTheDocument();
  });

  it("shows play count and duration", async () => {
    render(<AlbumsPage onAlbumSelect={() => {}} />);
    await waitFor(() => screen.getByText("You Won't Like This"));
    expect(screen.getByText("42 plays")).toBeInTheDocument();
    expect(screen.getByText("1h 23m")).toBeInTheDocument();
  });

  it("shows genre when present", async () => {
    render(<AlbumsPage onAlbumSelect={() => {}} />);
    await waitFor(() => screen.getByText("Rock"));
  });

  it("shows total album count", async () => {
    render(<AlbumsPage onAlbumSelect={() => {}} />);
    await waitFor(() => screen.getByText("1 album"));
  });

  it("shows empty state when no albums", async () => {
    (globalThis.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({ albums: [], total: 0, page: 1, page_size: 50 }),
    });
    render(<AlbumsPage onAlbumSelect={() => {}} />);
    await waitFor(() => screen.getByText("No albums found."));
  });

  it("calls onAlbumSelect with album_key when card clicked", async () => {
    const onSelect = vi.fn();
    render(<AlbumsPage onAlbumSelect={onSelect} />);
    await waitFor(() => screen.getByText("You Won't Like This"));
    fireEvent.click(screen.getByText("You Won't Like This"));
    expect(onSelect).toHaveBeenCalledWith("you won't like this||wolfs");
  });

  it("applies filters and resets to page 1 on Apply", async () => {
    render(<AlbumsPage onAlbumSelect={() => {}} />);
    await waitFor(() => screen.getByText("You Won't Like This"));
    fireEvent.change(screen.getByLabelText("Artist"), { target: { value: "Wolfs" } });
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));
    await waitFor(() => {
      const calls = (globalThis.fetch as any).mock.calls;
      const lastUrl: string = calls[calls.length - 1][0];
      expect(lastUrl).toContain("artist=Wolfs");
    });
  });
});
