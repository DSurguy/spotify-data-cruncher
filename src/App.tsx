import { useState } from "react";
import { DatasetsPage } from "./pages/DatasetsPage";
import { AlbumsPage } from "./pages/AlbumsPage";
import "./index.css";

type Page = "datasets" | "albums";

export function App() {
  const [page, setPage] = useState<Page>("datasets");

  return (
    <div className="flex h-screen bg-background text-foreground">
      {/* Sidebar */}
      <nav aria-label="sidebar" className="w-52 shrink-0 border-r flex flex-col gap-1 p-3">
        <div className="px-2 py-3 mb-2">
          <h1 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            Spotify Cruncher
          </h1>
        </div>
        <NavItem label="Albums" active={page === "albums"} onClick={() => setPage("albums")} />
        <NavItem label="Datasets" active={page === "datasets"} onClick={() => setPage("datasets")} />
      </nav>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto p-6">
        {page === "albums" && <AlbumsPage onAlbumSelect={() => {}} />}
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
