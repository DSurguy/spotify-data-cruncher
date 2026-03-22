import { useState, useEffect, useMemo, useCallback } from "react";
import { Link } from "wouter";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { LinkButton, NavLabel } from "@/components/ui/link-button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Track, GetTracksResponse } from "@/types/api";

type TrackSort = "total_ms_desc" | "play_count_desc" | "name_asc" | "last_played_desc" | "first_played_asc";

interface GroupToggles { genre: boolean; artist: boolean; album: boolean; }

interface TreeNode {
  id: string;
  label: string;
  level: "genre" | "artist" | "album";
  navKey: string;
  children: Array<TreeNode | Track>;
  totalMs: number;
  trackCount: number;
}

function isTreeNode(x: TreeNode | Track): x is TreeNode {
  return "level" in x;
}

function formatDuration(ms: number): string {
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export function trackMatchesSearch(track: Track, q: string): boolean {
  const lower = q.toLowerCase();
  return (
    track.track_name.toLowerCase().includes(lower) ||
    track.artist_name.toLowerCase().includes(lower) ||
    (track.album_name?.toLowerCase().includes(lower) ?? false)
  );
}

function buildTreeLevel(
  tracks: Track[],
  levels: Array<"genre" | "artist" | "album">,
  depth: number,
): TreeNode[] {
  if (depth >= levels.length || tracks.length === 0) return [];
  const level = levels[depth];

  const groupMap = new Map<string, { label: string; tracks: Track[]; navKey: string }>();
  for (const track of tracks) {
    let key: string;
    let label: string;
    let navKey: string;
    if (level === "genre") {
      key = (track.genre ?? "").toLowerCase() || "__unknown__";
      label = track.genre || "Unknown Genre";
      navKey = "";
    } else if (level === "artist") {
      key = (track.artist_name ?? "").toLowerCase().trim();
      label = track.artist_name || "Unknown Artist";
      navKey = track.artist_slug ?? key;
    } else {
      key = (track.album_name ?? "").toLowerCase().trim() + "||" + (track.artist_name ?? "").toLowerCase().trim();
      label = track.album_name || "Unknown Album";
      navKey = track.album_slug ?? key;
    }
    if (!groupMap.has(key)) groupMap.set(key, { label, tracks: [], navKey });
    groupMap.get(key)!.tracks.push(track);
  }

  const nodes: TreeNode[] = [];
  for (const [, { label, tracks: gTracks, navKey }] of groupMap) {
    const totalMs = gTracks.reduce((s, t) => s + t.total_ms_played, 0);
    const children: Array<TreeNode | Track> =
      depth + 1 < levels.length
        ? buildTreeLevel(gTracks, levels, depth + 1)
        : [...gTracks];
    nodes.push({
      id: `${level}:${navKey || label}`,
      label, level, navKey,
      children, totalMs,
      trackCount: gTracks.length,
    });
  }
  return nodes.sort((a, b) => b.totalMs - a.totalMs);
}

export function buildTree(tracks: Track[], groups: GroupToggles): TreeNode[] {
  const levels: Array<"genre" | "artist" | "album"> = [];
  if (groups.genre) levels.push("genre");
  if (groups.artist) levels.push("artist");
  if (groups.album) levels.push("album");
  if (levels.length === 0) return [];
  return buildTreeLevel(tracks, levels, 0);
}

function sortTrackList(tracks: Track[], sort: TrackSort): Track[] {
  const arr = [...tracks];
  switch (sort) {
    case "play_count_desc": return arr.sort((a, b) => b.play_count - a.play_count);
    case "name_asc": return arr.sort((a, b) => a.track_name.localeCompare(b.track_name));
    case "last_played_desc": return arr.sort((a, b) => b.last_played.localeCompare(a.last_played));
    case "first_played_asc": return arr.sort((a, b) => (a.first_played ?? "").localeCompare(b.first_played ?? ""));
    default: return arr.sort((a, b) => b.total_ms_played - a.total_ms_played);
  }
}

function RatingBadge({ value }: { value: Track["rating"] }) {
  if (!value || value === "none") return null;
  return value === "like"
    ? <span className="text-xs text-green-600">♥</span>
    : <span className="text-xs text-red-500">✕</span>;
}

interface TrackRowProps {
  track: Track;
  hideArtist?: boolean;
  hideAlbum?: boolean;
  indent?: number;
}

function TrackRow({ track, hideArtist, hideAlbum, indent = 0 }: TrackRowProps) {
  return (
    <LinkButton
      href={`/tracks/${track.track_slug}`}
      className="gap-2 py-1.5 hover:bg-muted/40 rounded-md"
      style={{ paddingLeft: `${indent + 12}px`, paddingRight: "12px" }}
    >
      <NavLabel className="truncate flex-1 text-sm min-w-0 font-medium">{track.track_name}</NavLabel>
      {!hideArtist && (
        <span className="text-xs text-muted-foreground truncate max-w-[120px] hidden sm:block">{track.artist_name}</span>
      )}
      {!hideAlbum && track.album_name && (
        <span className="text-xs text-muted-foreground truncate max-w-[120px] hidden md:block">{track.album_name}</span>
      )}
      <RatingBadge value={track.rating} />
      {track.reviewed && <span className="text-xs text-green-600" title="Reviewed">✓</span>}
      <span className="text-xs text-muted-foreground tabular-nums shrink-0">{formatDuration(track.total_ms_played)}</span>
      <span className="text-xs text-muted-foreground tabular-nums shrink-0">{track.play_count}×</span>
    </LinkButton>
  );
}

interface TreeNodeViewProps {
  node: TreeNode;
  depth: number;
  hasSearch: boolean;
  userExpanded: Set<string>;
  onToggle: (id: string) => void;
  sort: TrackSort;
  activeGroupLevels: Array<"genre" | "artist" | "album">;
}

function TreeNodeView({
  node, depth, hasSearch, userExpanded, onToggle, sort, activeGroupLevels,
}: TreeNodeViewProps) {
  const isOpen = userExpanded.has(node.id) || hasSearch;
  const indentPx = depth * 16;

  const sortedChildren = useMemo(() => {
    const treeKids = node.children.filter(c => isTreeNode(c)) as TreeNode[];
    const trackKids = node.children.filter(c => !isTreeNode(c)) as Track[];
    return [...treeKids, ...sortTrackList(trackKids, sort)];
  }, [node.children, sort]);

  const showLabelAsLink = node.level === "artist" || node.level === "album";
  const levelsAbove = [...activeGroupLevels, node.level];

  return (
    <div>
      <div
        className="flex items-center gap-2 py-1.5 rounded-md hover:bg-muted/50 cursor-pointer select-none"
        style={{ paddingLeft: `${indentPx + 12}px`, paddingRight: "12px" }}
        onClick={() => onToggle(node.id)}
      >
        <span className="text-muted-foreground text-xs w-3 shrink-0">{isOpen ? "▾" : "▸"}</span>
        {showLabelAsLink ? (
          <Link
            href={node.level === "artist"
              ? `/artists/${node.navKey}`
              : `/albums/${node.navKey}`}
            className="flex-1 text-sm font-semibold underline underline-offset-2 truncate min-w-0"
            onClick={(e: React.MouseEvent) => e.stopPropagation()}
          >
            {node.label}
          </Link>
        ) : (
          <span className="flex-1 text-sm font-semibold truncate min-w-0">{node.label}</span>
        )}
        <span className="text-xs text-muted-foreground shrink-0">
          {node.trackCount} {node.trackCount === 1 ? "track" : "tracks"} · {formatDuration(node.totalMs)}
        </span>
      </div>
      {isOpen && (
        <div>
          {sortedChildren.map(child =>
            isTreeNode(child) ? (
              <TreeNodeView
                key={child.id}
                node={child}
                depth={depth + 1}
                hasSearch={hasSearch}
                userExpanded={userExpanded}
                onToggle={onToggle}
                sort={sort}
                activeGroupLevels={levelsAbove}
              />
            ) : (
              <TrackRow
                key={(child as Track).track_slug}
                track={child as Track}
                hideArtist={levelsAbove.includes("artist")}
                hideAlbum={levelsAbove.includes("album")}
                indent={(depth + 1) * 16}
              />
            )
          )}
        </div>
      )}
    </div>
  );
}

export function ExplorePage() {
  const [sort, setSort] = useState<TrackSort>("total_ms_desc");
  const [searchDraft, setSearchDraft] = useState("");
  const [search, setSearch] = useState("");
  const [groups, setGroups] = useState<GroupToggles>({ genre: false, artist: false, album: false });
  const [tracks, setTracks] = useState<Track[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [userExpanded, setUserExpanded] = useState<Set<string>>(new Set());

  const isGrouped = groups.genre || groups.artist || groups.album;
  const PAGE_SIZE = 50;

  const loadTracks = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({
      sort,
      page: isGrouped ? "1" : String(page),
      page_size: isGrouped ? "2000" : String(PAGE_SIZE),
    });
    if (!isGrouped && search) params.set("track", search);
    const res = await fetch(`/api/tracks?${params}`);
    const body: GetTracksResponse = await res.json();
    setTracks(body.tracks);
    setTotal(body.total);
    setLoading(false);
  }, [sort, page, isGrouped, search]);

  useEffect(() => { loadTracks(); }, [loadTracks]);

  // Clear tree expansion when group structure changes
  useEffect(() => { setUserExpanded(new Set()); }, [groups]);

  // In grouped mode, filter client-side when search is active
  const displayedTracks = useMemo(() => {
    if (!isGrouped || !search) return tracks;
    return tracks.filter(t => trackMatchesSearch(t, search));
  }, [tracks, isGrouped, search]);

  const tree = useMemo(
    () => isGrouped ? buildTree(displayedTracks, groups) : [],
    [isGrouped, displayedTracks, groups],
  );

  function toggleGroup(level: keyof GroupToggles) {
    setGroups(g => ({ ...g, [level]: !g[level] }));
    setPage(1);
  }

  function toggleNode(id: string) {
    setUserExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function applySearch() {
    setSearch(searchDraft);
    setPage(1);
  }

  function clearSearch() {
    setSearchDraft("");
    setSearch("");
    setPage(1);
  }

  const totalPages = Math.ceil(total / PAGE_SIZE);
  const hasSearch = search.trim().length > 0;

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">Explore</h2>

      {/* Controls */}
      <div className="flex flex-wrap gap-3 mb-4 items-end">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground font-medium">Search</label>
          <div className="flex gap-1">
            <Input
              className="w-52"
              placeholder="Track, artist, or album…"
              value={searchDraft}
              onChange={e => setSearchDraft(e.target.value)}
              onKeyDown={e => e.key === "Enter" && applySearch()}
            />
            <Button size="sm" variant="outline" onClick={applySearch}>Search</Button>
            {(searchDraft || hasSearch) && (
              <Button size="sm" variant="ghost" onClick={clearSearch} aria-label="Clear search">✕</Button>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground font-medium">Sort</label>
          <Select value={sort} onValueChange={v => { setSort(v as TrackSort); setPage(1); }}>
            <SelectTrigger className="w-44" aria-label="Sort order">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="total_ms_desc">Most playtime</SelectItem>
              <SelectItem value="play_count_desc">Most plays</SelectItem>
              <SelectItem value="name_asc">Name A–Z</SelectItem>
              <SelectItem value="last_played_desc">Recently played</SelectItem>
              <SelectItem value="first_played_asc">Oldest first</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground font-medium">Group by</label>
          <div className="flex gap-1.5">
            {(["genre", "artist", "album"] as const).map(level => (
              <button
                key={level}
                type="button"
                aria-pressed={groups[level]}
                onClick={() => toggleGroup(level)}
                className={`px-3 py-1 rounded-full text-sm border transition-colors capitalize ${
                  groups[level]
                    ? "bg-primary text-primary-foreground border-primary"
                    : "text-muted-foreground border-border hover:bg-muted"
                }`}
              >
                {level}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <p className="text-muted-foreground mt-8">Loading…</p>
      ) : isGrouped ? (
        <div className="border rounded-lg overflow-hidden">
          {tree.length === 0 ? (
            <p className="py-8 text-center text-muted-foreground text-sm">
              {hasSearch ? "No tracks match your search." : "No tracks found."}
            </p>
          ) : (
            <div className="py-1">
              {tree.map(node => (
                <TreeNodeView
                  key={node.id}
                  node={node}
                  depth={0}
                  hasSearch={hasSearch}
                  userExpanded={userExpanded}
                  onToggle={toggleNode}
                  sort={sort}
                  activeGroupLevels={[]}
                />
              ))}
            </div>
          )}
        </div>
      ) : (
        <>
          {tracks.length === 0 ? (
            <p className="text-muted-foreground mt-4 text-sm">No tracks found.</p>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <div className="py-1">
                {tracks.map(track => (
                  <TrackRow
                    key={track.track_key}
                    track={track}
                  />
                ))}
              </div>
            </div>
          )}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-3">
              <span className="text-sm text-muted-foreground">{total} tracks</span>
              <div className="flex items-center gap-3">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
                  Previous
                </Button>
                <span className="text-sm text-muted-foreground">{page} / {totalPages}</span>
                <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
                  Next
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
