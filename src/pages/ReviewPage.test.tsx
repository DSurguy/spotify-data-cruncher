import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "bun:test";
import { Router } from "wouter";
import { memoryLocation } from "wouter/memory-location";
import { ReviewPage } from "./ReviewPage";
import type { GetTracksResponse } from "@/types/api";

const sampleTrack = {
  track_slug: "fake-plastic-trees",
  track_name: "Fake Plastic Trees",
  artist_name: "Radiohead",
  artist_slug: "radiohead",
  album_name: "The Bends",
  album_slug: "the-bends",
  play_count: 47,
  total_ms_played: 14_100_000,
  first_played: "2019-01-01T00:00:00Z",
  last_played: "2025-03-01T10:00:00Z",
  skip_rate: 8.5,
  genre: null,
  rating: null as "like" | "dislike" | "none" | null,
  notes: null,
  reviewed: false,
};

function makeResponse(overrides: Partial<GetTracksResponse> = {}): GetTracksResponse {
  return { tracks: [sampleTrack], total: 1, page: 1, page_size: 5, ...overrides };
}

beforeEach(() => {
  globalThis.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => makeResponse(),
  } as any);
});

function renderPage() {
  const { hook } = memoryLocation({ path: "/review" });
  return render(<Router hook={hook}><ReviewPage /></Router>);
}

describe("ReviewPage", () => {
  it("renders page heading", async () => {
    renderPage();
    await waitFor(() => screen.getByRole("heading", { name: "Review" }));
  });

  it("renders all 5 panel titles", async () => {
    renderPage();
    await waitFor(() => screen.getAllByText("Fake Plastic Trees"));
    expect(screen.getByText("Oldest unreviewed")).toBeInTheDocument();
    expect(screen.getByText("Newest unreviewed")).toBeInTheDocument();
    expect(screen.getByText("Most played")).toBeInTheDocument();
    expect(screen.getByText("Least played")).toBeInTheDocument();
    expect(screen.getByText("Random selection")).toBeInTheDocument();
  });

  it("fetches tracks for all 5 panels on mount", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => makeResponse(),
    } as any);
    globalThis.fetch = fetchMock;

    renderPage();
    await waitFor(() => {
      expect(fetchMock.mock.calls.length).toBeGreaterThanOrEqual(5);
    });

    const urls = (fetchMock.mock.calls as string[][]).map(c => c[0] as string);
    expect(urls.some(u => u.includes("first_played_asc"))).toBe(true);
    expect(urls.some(u => u.includes("first_played_desc"))).toBe(true);
    expect(urls.some(u => u.includes("play_count_desc"))).toBe(true);
    expect(urls.some(u => u.includes("play_count_asc"))).toBe(true);
    expect(urls.some(u => u.includes("random"))).toBe(true);
  });

  it("all panel fetches use reviewed=false and page_size=5", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => makeResponse(),
    } as any);
    globalThis.fetch = fetchMock;

    renderPage();
    await waitFor(() => {
      expect(fetchMock.mock.calls.length).toBeGreaterThanOrEqual(5);
    });

    const urls = (fetchMock.mock.calls as string[][]).map(c => c[0] as string);
    urls.forEach(url => {
      expect(url).toContain("reviewed=false");
      expect(url).toContain("page_size=5");
    });
  });

  it("shows track rows after loading", async () => {
    renderPage();
    await waitFor(() => screen.getAllByText("Fake Plastic Trees"));
    expect(screen.getAllByText("Fake Plastic Trees").length).toBe(5);
  });

  it("track rows are rendered as links with correct href", async () => {
    renderPage();
    await waitFor(() => screen.getAllByText("Fake Plastic Trees"));
    const links = screen.getAllByRole("link", { name: /Fake Plastic Trees/ });
    expect(links.length).toBeGreaterThan(0);
    expect(links[0].getAttribute("href")).toBe(`/tracks/fake-plastic-trees`);
  });

  it("shows empty state when no unreviewed tracks", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => makeResponse({ tracks: [], total: 0 }),
    } as any);
    renderPage();
    await waitFor(() => screen.getAllByText("No unreviewed tracks."));
    expect(screen.getAllByText("No unreviewed tracks.").length).toBe(5);
  });

  it("refresh button reloads the panel", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => makeResponse(),
    } as any);
    globalThis.fetch = fetchMock;

    renderPage();
    await waitFor(() => screen.getAllByText("Fake Plastic Trees"));

    const callsBefore = fetchMock.mock.calls.length;
    fireEvent.click(screen.getAllByRole("button", { name: /Refresh/ })[0]);

    await waitFor(() => {
      expect(fetchMock.mock.calls.length).toBeGreaterThan(callsBefore);
    });
  });
});
