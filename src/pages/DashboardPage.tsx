import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type {
  SummaryStats, GetSummaryResponse,
  TopArtist, GetTopArtistsResponse,
  TopAlbum, GetTopAlbumsResponse,
  TopTrack, GetTopTracksResponse,
} from "@/routes/stats";

function formatDuration(ms: number): string {
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  if (h >= 1000) return `${(h / 1000).toFixed(1)}k hrs`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

interface StatCardProps {
  title: string;
  value: string;
  sub?: string;
}

function StatCard({ title, value, sub }: StatCardProps) {
  return (
    <Card>
      <CardHeader className="pb-1">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-3xl font-bold">{value}</p>
        {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
      </CardContent>
    </Card>
  );
}

export function DashboardPage() {
  const [stats, setStats] = useState<SummaryStats | null>(null);
  const [topArtists, setTopArtists] = useState<TopArtist[]>([]);
  const [topAlbums, setTopAlbums] = useState<TopAlbum[]>([]);
  const [topTracks, setTopTracks] = useState<TopTrack[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/stats/summary").then(r => r.json() as Promise<GetSummaryResponse>),
      fetch("/api/stats/top-artists?limit=10").then(r => r.json() as Promise<GetTopArtistsResponse>),
      fetch("/api/stats/top-albums?limit=10").then(r => r.json() as Promise<GetTopAlbumsResponse>),
      fetch("/api/stats/top-tracks?limit=10").then(r => r.json() as Promise<GetTopTracksResponse>),
    ]).then(([summary, artists, albums, tracks]) => {
      setStats(summary.summary);
      setTopArtists(artists.artists);
      setTopAlbums(albums.albums);
      setTopTracks(tracks.tracks);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return <p className="text-muted-foreground">Loading…</p>;
  }

  if (!stats) return null;

  const dateRange = stats.first_played
    ? `${formatDate(stats.first_played)} – ${formatDate(stats.last_played)}`
    : "No data";

  return (
    <div className="max-w-4xl mx-auto">
      <h2 className="text-2xl font-bold mb-6">Dashboard</h2>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
        <StatCard
          title="Total listening time"
          value={formatDuration(stats.total_ms_played)}
        />
        <StatCard
          title="Total plays"
          value={stats.total_plays.toLocaleString()}
        />
        <StatCard
          title="Unique tracks"
          value={stats.unique_tracks.toLocaleString()}
        />
        <StatCard
          title="Unique albums"
          value={stats.unique_albums.toLocaleString()}
        />
        <StatCard
          title="Unique artists"
          value={stats.unique_artists.toLocaleString()}
        />
        <StatCard
          title="Date range"
          value={formatDate(stats.first_played)}
          sub={`through ${formatDate(stats.last_played)}`}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Top Artists */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Top Artists</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <ol className="space-y-2">
              {topArtists.map((a, i) => (
                <li key={a.artist_key} className="flex items-center gap-2 text-sm">
                  <span className="w-5 shrink-0 text-muted-foreground text-xs text-right">{i + 1}.</span>
                  <span className="flex-1 truncate">{a.artist_name}</span>
                  <span className="shrink-0 text-muted-foreground text-xs">{formatDuration(a.total_ms_played)}</span>
                </li>
              ))}
              {topArtists.length === 0 && <li className="text-muted-foreground text-sm">No data</li>}
            </ol>
          </CardContent>
        </Card>

        {/* Top Albums */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Top Albums</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <ol className="space-y-2">
              {topAlbums.map((a, i) => (
                <li key={a.album_key} className="flex items-center gap-2 text-sm">
                  <span className="w-5 shrink-0 text-muted-foreground text-xs text-right">{i + 1}.</span>
                  <div className="flex-1 min-w-0">
                    <p className="truncate">{a.album_name}</p>
                    <p className="truncate text-xs text-muted-foreground">{a.artist_name}</p>
                  </div>
                  <span className="shrink-0 text-muted-foreground text-xs">{formatDuration(a.total_ms_played)}</span>
                </li>
              ))}
              {topAlbums.length === 0 && <li className="text-muted-foreground text-sm">No data</li>}
            </ol>
          </CardContent>
        </Card>

        {/* Top Tracks */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Top Tracks</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <ol className="space-y-2">
              {topTracks.map((t, i) => (
                <li key={t.track_key} className="flex items-center gap-2 text-sm">
                  <span className="w-5 shrink-0 text-muted-foreground text-xs text-right">{i + 1}.</span>
                  <div className="flex-1 min-w-0">
                    <p className="truncate">{t.track_name}</p>
                    <p className="truncate text-xs text-muted-foreground">{t.artist_name}</p>
                  </div>
                  <span className="shrink-0 text-muted-foreground text-xs">{t.play_count.toLocaleString()} plays</span>
                </li>
              ))}
              {topTracks.length === 0 && <li className="text-muted-foreground text-sm">No data</li>}
            </ol>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
