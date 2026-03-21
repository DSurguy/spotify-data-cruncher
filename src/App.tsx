import { useState } from "react";
import { DatasetsPage } from "./pages/DatasetsPage";
import { AlbumDetail } from "./pages/AlbumDetail";
import { DashboardPage } from "./pages/DashboardPage";
import { ArtistDetail } from "./pages/ArtistDetail";
import { TrackDetail } from "./pages/TrackDetail";
import { ExplorePage } from "./pages/ExplorePage";
import { ReviewPage } from "./pages/ReviewPage";
import "./index.css";

type Page = "dashboard" | "explore" | "review" | "datasets";
type DetailView =
  | { type: "track"; key: string }
  | { type: "album"; key: string }
  | { type: "artist"; key: string }
  | null;

export function App() {
  const [page, setPage] = useState<Page>("dashboard");
  const [detail, setDetail] = useState<DetailView>(null);

  function navigateTo(p: Page) {
    setPage(p);
    setDetail(null);
  }

  function openTrack(key: string) {
    setDetail({ type: "track", key });
  }

  function openAlbum(key: string) {
    setDetail({ type: "album", key });
  }

  function openArtist(key: string) {
    setDetail({ type: "artist", key });
  }

  function closeDetail() {
    setDetail(null);
  }

  return (
    <div className="flex h-screen bg-background text-foreground">
      {/* Sidebar */}
      <nav aria-label="sidebar" className="w-52 shrink-0 border-r flex flex-col gap-1 p-3">
        <div className="px-2 py-3 mb-2">
          <h1 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            Spotify Cruncher
          </h1>
        </div>
        <NavItem label="Dashboard" active={page === "dashboard" && detail === null} onClick={() => navigateTo("dashboard")} />
        <NavItem label="Explore"   active={page === "explore"}   onClick={() => navigateTo("explore")} />
        <NavItem label="Review"    active={page === "review"}    onClick={() => navigateTo("review")} />
        <NavItem label="Datasets"  active={page === "datasets" && detail === null}  onClick={() => navigateTo("datasets")} />
      </nav>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto p-6">
        {detail?.type === "track" && (
          <TrackDetail
            trackKey={detail.key}
            onClose={closeDetail}
            onAlbumSelect={openAlbum}
          />
        )}
        {detail?.type === "album" && (
          <AlbumDetail
            albumKey={detail.key}
            onClose={closeDetail}
            onArtistSelect={openArtist}
            onTrackSelect={openTrack}
          />
        )}
        {detail?.type === "artist" && (
          <ArtistDetail
            artistKey={detail.key}
            onClose={closeDetail}
            onAlbumSelect={openAlbum}
            onTrackSelect={openTrack}
          />
        )}
        {detail === null && page === "dashboard" && <DashboardPage />}
        {detail === null && page === "explore" && (
          <ExplorePage
            onTrackSelect={openTrack}
            onAlbumSelect={openAlbum}
            onArtistSelect={openArtist}
          />
        )}
        {detail === null && page === "review" && (
          <ReviewPage onTrackSelect={openTrack} />
        )}
        {detail === null && page === "datasets" && <DatasetsPage />}
      </main>
    </div>
  );
}

function NavItem({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-3 py-2 rounded text-sm transition-colors ${
        active ? "bg-accent text-accent-foreground font-medium" : "hover:bg-muted text-muted-foreground hover:text-foreground"
      }`}
    >
      {label}
    </button>
  );
}

export default App;
