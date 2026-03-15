import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "bun:test";
import { HistoryPage } from "./HistoryPage";
import type { GetPlaysResponse } from "@/types/api";

function makePlaysResponse(overrides: Partial<GetPlaysResponse> = {}): GetPlaysResponse {
  return {
    plays: [],
    total: 0,
    page: 1,
    page_size: 100,
    ...overrides,
  };
}

const samplePlay = {
  id: 1,
  dataset_id: 1,
  ts: "2024-06-15T14:30:00Z",
  platform: "android",
  ms_played: 240_000,
  content_type: "track" as const,
  track_name: "Test Track",
  artist_name: "Test Artist",
  album_name: "Test Album",
  spotify_track_uri: "spotify:track:abc",
  episode_name: null,
  episode_show_name: null,
  audiobook_title: null,
  reason_start: "clickrow",
  reason_end: "trackdone",
  shuffle: false,
  skipped: false,
  offline: false,
  incognito_mode: false,
};

beforeEach(() => {
  globalThis.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => makePlaysResponse({ plays: [samplePlay], total: 1 }),
  } as any);
});

describe("HistoryPage", () => {
  it("renders heading and filter bar", async () => {
    render(<HistoryPage />);
    await waitFor(() => screen.getByRole("heading", { name: "History" }));
    expect(screen.getByLabelText("Track")).toBeInTheDocument();
    expect(screen.getByLabelText("Artist")).toBeInTheDocument();
    expect(screen.getByLabelText("Album")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Apply" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Clear" })).toBeInTheDocument();
  });

  it("displays play row data", async () => {
    render(<HistoryPage />);
    await waitFor(() => screen.getByText("Test Track"));
    expect(screen.getByText("Test Artist")).toBeInTheDocument();
    expect(screen.getByText("Test Album")).toBeInTheDocument();
    expect(screen.getByText("android")).toBeInTheDocument();
    expect(screen.getByText("4m")).toBeInTheDocument();
  });

  it("shows total play count", async () => {
    render(<HistoryPage />);
    await waitFor(() => screen.getByText("1 plays"));
  });

  it("refetches with updated params when Apply is clicked", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => makePlaysResponse(),
    } as any);
    globalThis.fetch = fetchMock;

    render(<HistoryPage />);
    await waitFor(() => screen.getByRole("button", { name: "Apply" }));

    fireEvent.change(screen.getByLabelText("Artist"), { target: { value: "Radiohead" } });
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));

    await waitFor(() => {
      const lastCall = fetchMock.mock.calls[fetchMock.mock.calls.length - 1][0] as string;
      expect(lastCall).toContain("artist=Radiohead");
    });
  });

  it("clears all filters and refetches when Clear is clicked", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => makePlaysResponse(),
    } as any);
    globalThis.fetch = fetchMock;

    render(<HistoryPage />);
    await waitFor(() => screen.getByRole("button", { name: "Clear" }));

    fireEvent.change(screen.getByLabelText("Artist"), { target: { value: "someone" } });
    fireEvent.click(screen.getByRole("button", { name: "Clear" }));

    await waitFor(() => {
      const lastCall = fetchMock.mock.calls[fetchMock.mock.calls.length - 1][0] as string;
      expect(lastCall).not.toContain("artist=");
    });
  });

  it("renders empty state when no plays returned", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => makePlaysResponse(),
    } as any);
    render(<HistoryPage />);
    await waitFor(() => screen.getByText("No plays found."));
  });

  it("shows pagination when total exceeds page size", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => makePlaysResponse({ total: 250, plays: Array.from({ length: 100 }, (_, i) => ({ ...samplePlay, id: i + 1 })) }),
    } as any);
    render(<HistoryPage />);
    await waitFor(() => screen.getByText("Page 1 of 3"));
    expect(screen.getByRole("button", { name: "Next" })).toBeInTheDocument();
  });
});
