import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "bun:test";
import { App } from "./App";

// All pages make fetch calls on mount — stub with URL-aware responses
beforeEach(() => {
  globalThis.fetch = vi.fn().mockImplementation((url: string) => {
    let data: object;
    if (url.includes("top-artists")) {
      data = { artists: [] };
    } else if (url.includes("top-albums")) {
      data = { albums: [] };
    } else if (url.includes("top-tracks")) {
      data = { tracks: [] };
    } else if (url.includes("timeline")) {
      data = { points: [], granularity: "month" };
    } else if (url.includes("stats/summary")) {
      data = { summary: { total_plays: 0, total_ms_played: 0, unique_tracks: 0, unique_albums: 0, unique_artists: 0, first_played: null, last_played: null } };
    } else {
      // generic fallback covers datasets, albums, artists, tracks, plays, podcasts
      data = { datasets: [], albums: [], artists: [], tracks: [], plays: [], shows: [], total: 0, page: 1, page_size: 50 };
    }
    return Promise.resolve({ ok: true, json: async () => data } as any);
  });
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
    expect(screen.getByRole("button", { name: "Podcasts" })).toBeInTheDocument();
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
