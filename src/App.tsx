import { Route, Switch, Link, useRoute } from "wouter";
import { DatasetsPage } from "./pages/DatasetsPage";
import { AlbumDetail } from "./pages/AlbumDetail";
import { DashboardPage } from "./pages/DashboardPage";
import { ArtistDetail } from "./pages/ArtistDetail";
import { TrackDetail } from "./pages/TrackDetail";
import { ExplorePage } from "./pages/ExplorePage";
import { ReviewPage } from "./pages/ReviewPage";
import "./index.css";

export function App() {
  return (
    <div className="grid h-screen bg-background text-foreground max-w-6xl w-screen" style={{ gridTemplateColumns: "13rem 1fr" }}>
      {/* Sidebar */}
      <nav aria-label="sidebar" className="border-r flex flex-col gap-1 p-3 overflow-y-auto">
        <div className="px-2 py-3 mb-2">
          <h1 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            Spotify Cruncher
          </h1>
        </div>
        <NavItem label="Dashboard" href="/" />
        <NavItem label="Explore"   href="/explore" />
        <NavItem label="Review"    href="/review" />
        <NavItem label="Datasets"  href="/datasets" />
      </nav>

      {/* Main content */}
      <main className="flex-1 overflow-y-scroll p-6">
        <div className="w-full max-w-5xl mx-auto">
          <Switch>
            <Route path="/" component={DashboardPage} />
            <Route path="/explore" component={ExplorePage} />
            <Route path="/review" component={ReviewPage} />
            <Route path="/datasets" component={DatasetsPage} />
            <Route path="/tracks/:key"><TrackDetail /></Route>
            <Route path="/albums/:key"><AlbumDetail /></Route>
            <Route path="/artists/:key"><ArtistDetail /></Route>
          </Switch>
        </div>
      </main>
    </div>
  );
}

function NavItem({ label, href }: { label: string; href: string }) {
  const [active] = useRoute(href);
  return (
    <Link
      href={href}
      className={`w-full text-left px-3 py-2 rounded text-sm transition-colors ${
        active ? "bg-accent text-accent-foreground font-medium" : "hover:bg-muted text-muted-foreground hover:text-foreground"
      }`}
    >
      {label}
    </Link>
  );
}

export default App;
