import { useState } from "react";
import { DatasetsPage } from "./pages/DatasetsPage";
import { AlbumsPage } from "./pages/AlbumsPage";
import { AlbumDetail } from "./pages/AlbumDetail";
import { DashboardPage } from "./pages/DashboardPage";
import { HistoryPage } from "./pages/HistoryPage";
import { ArtistsPage } from "./pages/ArtistsPage";
import { TracksPage } from "./pages/TracksPage";
import { PodcastsPage } from "./pages/PodcastsPage";
import "./index.css";

type Page = "dashboard" | "albums" | "artists" | "tracks" | "podcasts" | "history" | "datasets";

export function App() {
  const [page, setPage] = useState<Page>("dashboard");
  const [selectedAlbumKey, setSelectedAlbumKey] = useState<string | null>(null);

  function navigateTo(p: Page) {
    setPage(p);
    setSelectedAlbumKey(null);
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
        <NavItem label="Dashboard" active={page === "dashboard"} onClick={() => navigateTo("dashboard")} />
        <NavItem label="Albums" active={page === "albums"} onClick={() => navigateTo("albums")} />
        <NavItem label="Artists" active={page === "artists"} onClick={() => navigateTo("artists")} />
        <NavItem label="Tracks" active={page === "tracks"} onClick={() => navigateTo("tracks")} />
        <NavItem label="Podcasts" active={page === "podcasts"} onClick={() => navigateTo("podcasts")} />
        <NavItem label="History" active={page === "history"} onClick={() => navigateTo("history")} />
        <NavItem label="Datasets" active={page === "datasets"} onClick={() => navigateTo("datasets")} />
      </nav>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto p-6">
        {page === "dashboard" && <DashboardPage />}
        {page === "albums" && selectedAlbumKey === null && (
          <AlbumsPage onAlbumSelect={key => setSelectedAlbumKey(key)} />
        )}
        {page === "albums" && selectedAlbumKey !== null && (
          <AlbumDetail albumKey={selectedAlbumKey} onClose={() => setSelectedAlbumKey(null)} />
        )}
        {page === "artists" && <ArtistsPage />}
        {page === "tracks" && <TracksPage />}
        {page === "podcasts" && <PodcastsPage />}
        {page === "history" && <HistoryPage />}
        {page === "datasets" && <DatasetsPage />}
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
