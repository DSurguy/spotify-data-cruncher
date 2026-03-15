import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "bun:test";
import { App } from "./App";

// AlbumsPage (default) and DatasetsPage both make fetch calls on mount — stub them out
beforeEach(() => {
  globalThis.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ datasets: [], albums: [], total: 0, page: 1, page_size: 50 }),
  } as any);
});

describe("App", () => {
  it("renders the sidebar and nav items", async () => {
    render(<App />);
    await waitFor(() => expect(screen.getByRole("navigation", { name: "sidebar" })).toBeInTheDocument());
    expect(screen.getByText("Spotify Cruncher")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Albums" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Datasets" })).toBeInTheDocument();
  });

  it("shows the Albums page by default", async () => {
    render(<App />);
    await waitFor(() => expect(screen.getByRole("heading", { name: "Albums" })).toBeInTheDocument());
  });

  it("Albums nav item is marked active by default", async () => {
    render(<App />);
    await waitFor(() => screen.getByRole("button", { name: "Albums" }));
    const btn = screen.getByRole("button", { name: "Albums" });
    expect(btn.className).toContain("bg-accent");
  });

  it("navigates to Datasets page when Datasets nav is clicked", async () => {
    render(<App />);
    await waitFor(() => screen.getByRole("button", { name: "Datasets" }));
    fireEvent.click(screen.getByRole("button", { name: "Datasets" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Import Data" })).toBeInTheDocument());
  });
});
