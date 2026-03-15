import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type {
  SummaryStats, GetSummaryResponse,
  TopArtist, GetTopArtistsResponse,
  TopAlbum, GetTopAlbumsResponse,
  TopTrack, GetTopTracksResponse,
  TimelinePoint, TimelineGranularity, GetTimelineResponse,
  PlatformStat, GetPlatformsResponse,
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

function formatPeriodLabel(period: string, granularity: TimelineGranularity): string {
  if (granularity === "year") return period;
  if (granularity === "month") {
    const [year, month] = period.split("-");
    const d = new Date(Number(year), Number(month) - 1, 1);
    return d.toLocaleDateString(undefined, { month: "short", year: "2-digit" });
  }
  // week: "2024-W03" -> "W3 '24"
  const [yearPart, weekPart] = period.split("-W");
  return `W${parseInt(weekPart)} '${yearPart.slice(2)}`;
}

function TimelineChart({ points, granularity }: { points: TimelinePoint[]; granularity: TimelineGranularity }) {
  if (points.length === 0) {
    return <p className="text-center text-muted-foreground text-sm py-10">No data</p>;
  }
  const maxMs = Math.max(...points.map(p => p.total_ms_played));
  return (
    <div className="space-y-1">
      <div className="h-32 flex items-end gap-px" aria-label="Listening timeline chart">
        {points.map(p => {
          const pct = maxMs > 0 ? (p.total_ms_played / maxMs) * 100 : 0;
          const mins = Math.round(p.total_ms_played / 60_000);
          return (
            <div
              key={p.period}
              className="flex-1 bg-primary rounded-t-sm min-h-px"
              style={{ height: `${pct}%`, opacity: 0.75 }}
              title={`${formatPeriodLabel(p.period, granularity)}: ${mins} min`}
            />
          );
        })}
      </div>
      <div className="flex justify-between text-xs text-muted-foreground px-px">
        <span>{formatPeriodLabel(points[0].period, granularity)}</span>
        <span>{formatPeriodLabel(points[points.length - 1].period, granularity)}</span>
      </div>
    </div>
  );
}

function PlatformChart({ platforms }: { platforms: PlatformStat[] }) {
  if (platforms.length === 0) {
    return <p className="text-center text-muted-foreground text-sm py-4">No data</p>;
  }
  const max = platforms[0].total_ms_played;
  return (
    <div className="space-y-2" aria-label="Platform breakdown chart">
      {platforms.map(p => {
        const pct = max > 0 ? (p.total_ms_played / max) * 100 : 0;
        return (
          <div key={p.platform} className="flex items-center gap-3 text-sm">
            <span className="w-20 shrink-0 text-right text-muted-foreground text-xs">{p.platform}</span>
            <div className="flex-1 bg-muted rounded-full h-2.5 overflow-hidden">
              <div
                className="h-full bg-primary rounded-full"
                style={{ width: `${pct}%` }}
                title={`${p.platform}: ${p.play_count.toLocaleString()} plays, ${formatDuration(p.total_ms_played)}`}
              />
            </div>
            <span className="w-16 shrink-0 text-xs text-muted-foreground">{formatDuration(p.total_ms_played)}</span>
          </div>
        );
      })}
    </div>
  );
}

export function DashboardPage() {
  const [stats, setStats] = useState<SummaryStats | null>(null);
  const [topArtists, setTopArtists] = useState<TopArtist[]>([]);
  const [topAlbums, setTopAlbums] = useState<TopAlbum[]>([]);
  const [topTracks, setTopTracks] = useState<TopTrack[]>([]);
  const [platforms, setPlatforms] = useState<PlatformStat[]>([]);
  const [timeline, setTimeline] = useState<TimelinePoint[]>([]);
  const [tlGranularity, setTlGranularity] = useState<TimelineGranularity>("month");
  const [tlYear, setTlYear] = useState<string>("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/stats/summary").then(r => r.json() as Promise<GetSummaryResponse>),
      fetch("/api/stats/top-artists?limit=10").then(r => r.json() as Promise<GetTopArtistsResponse>),
      fetch("/api/stats/top-albums?limit=10").then(r => r.json() as Promise<GetTopAlbumsResponse>),
      fetch("/api/stats/top-tracks?limit=10").then(r => r.json() as Promise<GetTopTracksResponse>),
      fetch("/api/stats/platforms").then(r => r.json() as Promise<GetPlatformsResponse>),
    ]).then(([summary, artists, albums, tracks, plat]) => {
      setStats(summary.summary);
      setTopArtists(artists.artists);
      setTopAlbums(albums.albums);
      setTopTracks(tracks.tracks);
      setPlatforms(plat.platforms);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    const params = new URLSearchParams({ granularity: tlGranularity });
    if (tlYear) params.set("year", tlYear);
    fetch(`/api/stats/timeline?${params}`)
      .then(r => r.json() as Promise<GetTimelineResponse>)
      .then(body => setTimeline(body.points));
  }, [tlGranularity, tlYear]);

  if (loading) {
    return <p className="text-muted-foreground">Loading…</p>;
  }

  if (!stats) return null;

  // Derive available years from data range for the year filter
  const availableYears: string[] = [];
  if (stats.first_played && stats.last_played) {
    const firstYear = new Date(stats.first_played).getFullYear();
    const lastYear = new Date(stats.last_played).getFullYear();
    for (let y = lastYear; y >= firstYear; y--) availableYears.push(String(y));
  }

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

      <Card className="mb-6">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <CardTitle className="text-base">Listening Timeline</CardTitle>
            <div className="flex items-center gap-2">
              {/* Year filter */}
              {availableYears.length > 1 && (
                <Select value={tlYear || "all"} onValueChange={v => setTlYear(v === "all" ? "" : v)}>
                  <SelectTrigger className="h-7 text-xs w-28" aria-label="Filter by year">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All time</SelectItem>
                    {availableYears.map(y => (
                      <SelectItem key={y} value={y}>{y}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {/* Granularity toggle */}
              <div className="flex rounded-md border overflow-hidden text-xs" role="group" aria-label="Granularity">
                {(["week", "month", "year"] as TimelineGranularity[]).map(g => (
                  <button
                    key={g}
                    onClick={() => setTlGranularity(g)}
                    className={`px-2 py-1 capitalize ${
                      tlGranularity === g
                        ? "bg-primary text-primary-foreground"
                        : "hover:bg-muted"
                    }`}
                  >
                    {g}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <TimelineChart points={timeline} granularity={tlGranularity} />
        </CardContent>
      </Card>

      {/* Platform breakdown */}
      <Card className="mb-8">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Platform Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <PlatformChart platforms={platforms} />
        </CardContent>
      </Card>

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
