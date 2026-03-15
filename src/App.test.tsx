import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "bun:test";
import { App } from "./App";

// DatasetsPage makes a fetch call on mount — stub it out
beforeEach(() => {
  globalThis.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ datasets: [] }),
  } as any);
});

describe("App", () => {
  it("renders the sidebar and Datasets nav item", async () => {
    render(<App />);
    await waitFor(() => expect(screen.getByRole("navigation", { name: "sidebar" })).toBeInTheDocument());
    expect(screen.getByText("Spotify Cruncher")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Datasets" })).toBeInTheDocument();
  });

  it("shows the datasets page by default", async () => {
    render(<App />);
    await waitFor(() => expect(screen.getByText("Import Data")).toBeInTheDocument());
  });

  it("nav item is marked active on the current page", async () => {
    render(<App />);
    await waitFor(() => screen.getByRole("button", { name: "Datasets" }));
    const btn = screen.getByRole("button", { name: "Datasets" });
    expect(btn.className).toContain("bg-accent");
  });
});
