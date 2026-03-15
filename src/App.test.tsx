import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "bun:test";
import { App } from "./App";

// All pages make fetch calls on mount — stub with a response that works for all
beforeEach(() => {
  globalThis.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      // stats/summary
      summary: { total_plays: 0, total_ms_played: 0, unique_tracks: 0, unique_albums: 0, unique_artists: 0, first_played: null, last_played: null },
      // datasets
      datasets: [],
      // albums
      albums: [], total: 0, page: 1, page_size: 50,      // plays
      plays: [], page_size: 100,    }),
  } as any);
});

describe("App", () => {
  it("renders the sidebar and all nav items", async () => {
    render(<App />);
    await waitFor(() => expect(screen.getByRole("navigation", { name: "sidebar" })).toBeInTheDocument());
    expect(screen.getByText("Spotify Cruncher")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Dashboard" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Albums" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Artists" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Tracks" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "History" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Datasets" })).toBeInTheDocument();
  });

  it("shows the Dashboard page by default", async () => {
    render(<App />);
    await waitFor(() => expect(screen.getByRole("heading", { name: "Dashboard" })).toBeInTheDocument());
  });

  it("Dashboard nav item is marked active by default", async () => {
    render(<App />);
    await waitFor(() => screen.getByRole("button", { name: "Dashboard" }));
    const btn = screen.getByRole("button", { name: "Dashboard" });
    expect(btn.className).toContain("bg-accent");
  });

  it("navigates to Datasets page when Datasets nav is clicked", async () => {
    render(<App />);
    await waitFor(() => screen.getByRole("button", { name: "Datasets" }));
    fireEvent.click(screen.getByRole("button", { name: "Datasets" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Import Data" })).toBeInTheDocument());
  });
});
