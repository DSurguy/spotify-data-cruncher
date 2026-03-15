import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "bun:test";
import { DatasetsPage } from "./DatasetsPage";
import type { Dataset } from "@/types/api";

const mockDataset: Dataset = {
  id: 1,
  name: "My 2024 Export",
  description: null,
  created_at: "2024-06-01T12:00:00Z",
  source_path: "/home/user/spotify/unzipped",
};

beforeEach(() => {
  globalThis.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ datasets: [] }),
    text: async () => "",
  } as any);
});

describe("DatasetsPage", () => {
  it("shows empty state message when no datasets exist", async () => {
    render(<DatasetsPage />);
    await waitFor(() => expect(screen.getByText(/No datasets yet/)).toBeInTheDocument());
  });

  it("renders a dataset card when datasets are loaded", async () => {
    (globalThis.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({ datasets: [mockDataset] }),
    });
    render(<DatasetsPage />);
    await waitFor(() => expect(screen.getByText("My 2024 Export")).toBeInTheDocument());
    expect(screen.getByText("/home/user/spotify/unzipped")).toBeInTheDocument();
  });

  it("shows the import form when Import Data is clicked", async () => {
    render(<DatasetsPage />);
    await waitFor(() => screen.getByRole("button", { name: "Import Data" }));
    fireEvent.click(screen.getByRole("button", { name: "Import Data" }));
    expect(screen.getByLabelText("Path to folder")).toBeInTheDocument();
  });

  it("hides the import form when Cancel is clicked", async () => {
    render(<DatasetsPage />);
    await waitFor(() => screen.getByRole("button", { name: "Import Data" }));
    fireEvent.click(screen.getByRole("button", { name: "Import Data" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByLabelText("Path to folder")).not.toBeInTheDocument();
  });

  it("submit button is disabled when path is empty", async () => {
    render(<DatasetsPage />);
    await waitFor(() => screen.getByRole("button", { name: "Import Data" }));
    fireEvent.click(screen.getByRole("button", { name: "Import Data" }));
    const submit = screen.getByRole("button", { name: "Import" });
    expect(submit).toBeDisabled();
  });

  it("submit button enables when path is filled", async () => {
    render(<DatasetsPage />);
    await waitFor(() => screen.getByRole("button", { name: "Import Data" }));
    fireEvent.click(screen.getByRole("button", { name: "Import Data" }));
    fireEvent.change(screen.getByLabelText("Path to folder"), {
      target: { value: "/some/path" },
    });
    expect(screen.getByRole("button", { name: "Import" })).not.toBeDisabled();
  });

  it("shows error message when import request fails", async () => {
    (globalThis.fetch as any)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ datasets: [] }) })
      .mockResolvedValueOnce({ ok: false, text: async () => "path does not exist" });

    render(<DatasetsPage />);
    await waitFor(() => screen.getByRole("button", { name: "Import Data" }));
    fireEvent.click(screen.getByRole("button", { name: "Import Data" }));
    fireEvent.change(screen.getByLabelText("Path to folder"), {
      target: { value: "/bad/path" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Import" }));
    await waitFor(() => expect(screen.getByText("path does not exist")).toBeInTheDocument());
  });

  it("shows delete confirmation on Delete click", async () => {
    (globalThis.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({ datasets: [mockDataset] }),
    });
    render(<DatasetsPage />);
    await waitFor(() => screen.getByText("My 2024 Export"));
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
  });
});
