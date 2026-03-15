import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { SummaryStats, GetSummaryResponse } from "@/routes/stats";

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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/stats/summary")
      .then(r => r.json())
      .then((body: GetSummaryResponse) => {
        setStats(body.summary);
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

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
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
    </div>
  );
}
