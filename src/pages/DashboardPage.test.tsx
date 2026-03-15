import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "bun:test";
import { DashboardPage } from "./DashboardPage";
import type { GetSummaryResponse } from "@/routes/stats";

const mockSummary: GetSummaryResponse = {
  summary: {
    total_plays: 155784,
    total_ms_played: 40_000_000_000,  // ~11,111 hours
    unique_tracks: 8200,
    unique_albums: 950,
    unique_artists: 420,
    first_played: "2019-08-21T14:05:56Z",
    last_played: "2025-03-15T10:00:00Z",
  },
};

beforeEach(() => {
  globalThis.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => mockSummary,
  } as any);
});

describe("DashboardPage", () => {
  it("renders all stat cards after loading", async () => {
    render(<DashboardPage />);
    await waitFor(() => screen.getByText("Dashboard"));
    expect(screen.getByText("Total listening time")).toBeInTheDocument();
    expect(screen.getByText("Total plays")).toBeInTheDocument();
    expect(screen.getByText("Unique tracks")).toBeInTheDocument();
    expect(screen.getByText("Unique albums")).toBeInTheDocument();
    expect(screen.getByText("Unique artists")).toBeInTheDocument();
  });

  it("displays total plays count", async () => {
    render(<DashboardPage />);
    await waitFor(() => screen.getByText("155,784"));
  });

  it("displays unique artists count", async () => {
    render(<DashboardPage />);
    await waitFor(() => screen.getByText("420"));
  });

  it("displays first played date", async () => {
    render(<DashboardPage />);
    await waitFor(() => screen.getByText("Aug 21, 2019"));
  });
});
