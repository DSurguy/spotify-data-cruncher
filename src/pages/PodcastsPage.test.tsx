import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "bun:test";
import { PodcastsPage } from "./PodcastsPage";
import type { GetPodcastsResponse } from "@/types/api";

const sampleShow = {
  show_key: "99% invisible",
  show_name: "99% Invisible",
  episode_count: 42,
  play_count: 55,
  total_ms_played: 75_600_000,
  first_played: "2020-03-01T12:00:00Z",
  last_played: "2025-01-15T08:00:00Z",
  genre: "Design",
  notes: null,
};

function makeResponse(overrides: Partial<GetPodcastsResponse> = {}): GetPodcastsResponse {
  return { shows: [sampleShow], total: 1, page: 1, page_size: 50, ...overrides };
}

beforeEach(() => {
  globalThis.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => makeResponse(),
  } as any);
});

describe("PodcastsPage", () => {
  it("renders heading and filter bar", async () => {
    render(<PodcastsPage />);
    await waitFor(() => screen.getByRole("heading", { name: "Podcasts" }));
    expect(screen.getByLabelText("Show")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Apply" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Clear" })).toBeInTheDocument();
  });

  it("displays show row data", async () => {
    render(<PodcastsPage />);
    await waitFor(() => screen.getByText("99% Invisible"));
    expect(screen.getByText("Design")).toBeInTheDocument();
    expect(screen.getByText("42 episodes")).toBeInTheDocument();
    expect(screen.getByText("55 plays")).toBeInTheDocument();
    expect(screen.getByText("21h 0m")).toBeInTheDocument();
  });

  it("shows total show count", async () => {
    render(<PodcastsPage />);
    await waitFor(() => screen.getByText("1 shows"));
  });

  it("refetches with updated show filter on Apply", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => makeResponse({ shows: [], total: 0 }),
    } as any);
    globalThis.fetch = fetchMock;

    render(<PodcastsPage />);
    await waitFor(() => screen.getByRole("button", { name: "Apply" }));

    fireEvent.change(screen.getByLabelText("Show"), { target: { value: "Radiolab" } });
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));

    await waitFor(() => {
      const lastCall = fetchMock.mock.calls[fetchMock.mock.calls.length - 1][0] as string;
      expect(lastCall).toContain("show=Radiolab");
    });
  });

  it("shows empty state when no shows found", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => makeResponse({ shows: [], total: 0 }),
    } as any);
    render(<PodcastsPage />);
    await waitFor(() => screen.getByText("No podcasts found."));
  });

  it("shows pagination when total exceeds page size", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => makeResponse({
        total: 120,
        shows: Array.from({ length: 50 }, (_, i) => ({ ...sampleShow, show_key: `show_${i}`, show_name: `Show ${i}` })),
      }),
    } as any);
    render(<PodcastsPage />);
    await waitFor(() => screen.getByText("Page 1 of 3"));
  });
});
