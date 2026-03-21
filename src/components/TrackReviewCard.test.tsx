import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "bun:test";
import { TrackReviewCard } from "./TrackReviewCard";

beforeEach(() => {
  globalThis.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ ok: true }),
  } as any);
});

describe("TrackReviewCard", () => {
  it("shows Review heading, rating, genre, and notes in view mode", async () => {
    render(<TrackReviewCard trackKey="t:abc" rating="like" genre="Art Rock" notes="A classic." />);
    expect(screen.getByRole("heading", { name: "Review" })).toBeInTheDocument();
    expect(screen.getByText("♥ Like")).toBeInTheDocument();
    expect(screen.getByText("Art Rock")).toBeInTheDocument();
    expect(screen.getByText("A classic.")).toBeInTheDocument();
  });

  it("shows 'No rating' and '—' placeholders when all fields are null", () => {
    render(<TrackReviewCard trackKey="t:abc" rating={null} genre={null} notes={null} />);
    expect(screen.getByText("No rating")).toBeInTheDocument();
    expect(screen.getAllByText("—").length).toBeGreaterThanOrEqual(2);
  });

  it("shows dislike rating display", () => {
    render(<TrackReviewCard trackKey="t:abc" rating="dislike" genre={null} notes={null} />);
    expect(screen.getByText("✕ Dislike")).toBeInTheDocument();
  });

  it("'Edit Review' link switches to edit mode", () => {
    render(<TrackReviewCard trackKey="t:abc" rating="like" genre="Rock" notes="Good." />);
    fireEvent.click(screen.getByRole("button", { name: "Edit Review" }));
    expect(screen.getByRole("group", { name: "Rating" })).toBeInTheDocument();
    expect(screen.getByLabelText(/Genre/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Notes/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Save Review/ })).toBeInTheDocument();
  });

  it("edit form is pre-filled with current values", () => {
    render(<TrackReviewCard trackKey="t:abc" rating="like" genre="Rock" notes="Good." />);
    fireEvent.click(screen.getByRole("button", { name: "Edit Review" }));
    expect((screen.getByLabelText(/Genre/) as HTMLInputElement).value).toBe("Rock");
    expect((screen.getByLabelText(/Notes/) as HTMLTextAreaElement).value).toBe("Good.");
    expect(screen.getByRole("button", { name: "♥ Like" })).toHaveAttribute("aria-pressed", "true");
  });

  it("'Save Review' is disabled until a rating is selected", () => {
    render(<TrackReviewCard trackKey="t:abc" rating={null} genre={null} notes={null} />);
    fireEvent.click(screen.getByRole("button", { name: "Edit Review" }));
    expect(screen.getByRole("button", { name: /Save Review/ })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "♥ Like" }));
    expect(screen.getByRole("button", { name: /Save Review/ })).not.toBeDisabled();
  });

  it("saving calls PUT with rating, genre, notes, reviewed=true", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) } as any);
    globalThis.fetch = fetchMock;

    render(<TrackReviewCard trackKey="t:abc" rating={null} genre={null} notes={null} />);
    fireEvent.click(screen.getByRole("button", { name: "Edit Review" }));
    fireEvent.click(screen.getByRole("button", { name: "♥ Like" }));
    fireEvent.change(screen.getByLabelText(/Genre/), { target: { value: "Indie" } });
    fireEvent.change(screen.getByLabelText(/Notes/), { target: { value: "Great track" } });
    fireEvent.click(screen.getByRole("button", { name: /Save Review/ }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [url, opts] = fetchMock.mock.calls[0];
    expect(url).toContain("/api/overrides/track/t%3Aabc");
    expect(opts.method).toBe("PUT");
    const body = JSON.parse(opts.body);
    expect(body.some((f: any) => f.field === "rating" && f.value === '"like"')).toBe(true);
    expect(body.some((f: any) => f.field === "genre" && f.value === '"Indie"')).toBe(true);
    expect(body.some((f: any) => f.field === "notes" && f.value === '"Great track"')).toBe(true);
    expect(body.some((f: any) => f.field === "reviewed" && f.value === "true")).toBe(true);
  });

  it("returns to view mode after successful save and shows updated values", async () => {
    render(<TrackReviewCard trackKey="t:abc" rating={null} genre={null} notes={null} />);
    fireEvent.click(screen.getByRole("button", { name: "Edit Review" }));
    fireEvent.click(screen.getByRole("button", { name: "♥ Like" }));
    fireEvent.change(screen.getByLabelText(/Genre/), { target: { value: "Indie" } });
    fireEvent.click(screen.getByRole("button", { name: /Save Review/ }));

    await waitFor(() => screen.getByRole("button", { name: "Edit Review" }));
    expect(screen.getByText("♥ Like")).toBeInTheDocument();
    expect(screen.getByText("Indie")).toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "Rating" })).not.toBeInTheDocument();
  });

  it("Cancel returns to view mode without saving", () => {
    const fetchMock = vi.fn();
    globalThis.fetch = fetchMock;

    render(<TrackReviewCard trackKey="t:abc" rating="like" genre="Rock" notes="Good." />);
    fireEvent.click(screen.getByRole("button", { name: "Edit Review" }));
    fireEvent.change(screen.getByLabelText(/Genre/), { target: { value: "Changed" } });
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.getByText("Rock")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Edit Review" })).toBeInTheDocument();
  });
});
