# Client-Side Routing Plan

## Router choice: Wouter

[Wouter](https://github.com/molefrog/wouter) is a tiny (~2.4 kb gzip), zero-dependency router with a hook-based API. It fits the project's "prefer simple" principle — no configuration, no providers beyond a single `<Router>` wrapper, and familiar `<Link>` / `<Route>` / `useLocation` / `useParams` primitives.

Alternative considered: React Router v6 — rejected for being much heavier with more boilerplate (loader/action patterns, nested route config, etc.) than the project needs.

---

## URL structure

| URL               | Component       |
| ----------------- | --------------- |
| `/`               | `DashboardPage` |
| `/explore`        | `ExplorePage`   |
| `/review`         | `ReviewPage`    |
| `/datasets`       | `DatasetsPage`  |
| `/tracks/:key`    | `TrackDetail`   |
| `/albums/:key`    | `AlbumDetail`   |
| `/artists/:key`   | `ArtistDetail`  |

Keys in the detail routes are the same opaque string keys already used as component props (`trackKey`, `albumKey`, `artistKey`). They must be URL-encoded when written into path segments.

---

## Implementation steps

Each step is one commit.

### Step 1 — Install Wouter

```bash
bun add wouter
```

No other config needed.

---

### Step 2 — Declare routes in `App.tsx`

Replace the two `useState` hooks and all navigation handlers with a `<Switch>` + `<Route>` tree. Remove the old `Page` / `DetailView` types.

Before (current):
```tsx
const [page, setPage] = useState<Page>("dashboard");
const [detail, setDetail] = useState<DetailView>(null);
// …navigateTo / openTrack / openAlbum / openArtist / closeDetail
```

After:
```tsx
import { Link, Route, Switch, useLocation } from "wouter";

// No state at all. Routes drive rendering.
<Switch>
  <Route path="/"         component={DashboardPage} />
  <Route path="/explore"  component={ExplorePage} />
  <Route path="/review"   component={ReviewPage} />
  <Route path="/datasets" component={DatasetsPage} />
  <Route path="/tracks/:key"  component={TrackDetail} />
  <Route path="/albums/:key"  component={AlbumDetail} />
  <Route path="/artists/:key" component={ArtistDetail} />
</Switch>
```

Active sidebar highlighting uses `useRoute("/explore")` (returns `[isActive, params]`) or `useLocation` comparison.

---

### Step 3 — Replace `NavItem` with router `<Link>`

`NavItem` is currently a `<button onClick={navigateTo(...)} >`. Replace it with a wouter `<Link>` rendered as the same styled element so the sidebar emits real `<a href>` tags.

```tsx
import { Link, useRoute } from "wouter";

function NavItem({ label, href }: { label: string; href: string }) {
  const [active] = useRoute(href === "/" ? "/" : `${href}*`);
  return (
    <Link href={href} className={`w-full text-left px-3 py-2 rounded text-sm transition-colors ${
      active ? "bg-accent text-accent-foreground font-medium"
              : "hover:bg-muted text-muted-foreground hover:text-foreground"
    }`}>
      {label}
    </Link>
  );
}
```

Sidebar usage becomes:
```tsx
<NavItem label="Dashboard" href="/" />
<NavItem label="Explore"   href="/explore" />
<NavItem label="Review"    href="/review" />
<NavItem label="Datasets"  href="/datasets" />
```

---

### Step 4 — Remove navigation callbacks from page components

Currently `ExplorePage` and `ReviewPage` receive `onTrackSelect`, `onAlbumSelect`, `onArtistSelect` as props. Replace every call-site with `useLocation` / `navigate`.

```tsx
// Before
onTrackSelect(key);

// After
import { useLocation } from "wouter";
const [, navigate] = useLocation();
navigate(`/tracks/${encodeURIComponent(key)}`);
```

Remove the callback props and their types from each component's props interface.

`LinkButton` in detail pages currently also calls the same callbacks. After this step it simply navigates.

---

### Step 5 — Convert detail pages to read route params

`TrackDetail`, `AlbumDetail`, `ArtistDetail` currently receive `*Key`, `onClose`, and cross-navigation callbacks as props. Replace with `useParams` / `useLocation`.

```tsx
// Before
export function TrackDetail({ trackKey, onClose, onAlbumSelect, onArtistSelect }) { … }

// After
import { useParams, useLocation } from "wouter";
export function TrackDetail() {
  const { key } = useParams<{ key: string }>();
  const [, navigate] = useLocation();
  const trackKey = decodeURIComponent(key);
  // onClose   → navigate(-1)  or  navigate("/explore")
  // onAlbumSelect(k) → navigate(`/albums/${encodeURIComponent(k)}`)
  // onArtistSelect(k) → navigate(`/artists/${encodeURIComponent(k)}`)
}
```

For the Back/Close button, `navigate(-1)` (history back) is the right behaviour — it returns to wherever the user came from, supporting both explore→track and review→track flows.

---

### Step 6 — Update `LinkButton` in `link-button.tsx`

`LinkButton` is a `<button>` with an `onClick`. Change it to a wouter `<Link>` (renders as `<a>`) so it's a real hyperlink (right-click → open in new tab, etc.).

```tsx
import { Link } from "wouter";

export function LinkButton({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="…existing styles…">
      {children} →
    </Link>
  );
}
```

Call-sites in detail pages pass an `href` string instead of an `onClick` callback.

---

### Step 7 — Update tests

- Wrap any component under test that uses wouter hooks in a `<Router>` (wouter exports a memory-based `Router` with `base` prop that works in JSDOM).
- Where tests previously asserted callback invocations (e.g. `expect(onTrackSelect).toHaveBeenCalledWith(key)`), assert navigation instead by checking the current location via a test helper or by asserting `<a href>` attributes.
- Remove obsolete mock callback props from test renders.

---

## What does NOT change

- Server code (`src/routes/`, `src/index.ts`) — the server already serves `index.html` for all non-API paths (or will need a one-line catch-all added if it doesn't; verify during Step 2).
- Component logic, data-fetching hooks, styling — none of that is affected by routing.
- All existing URL keys already work as path segments (they're URI-safe opaque strings).

---

## Order of commits

1. `bun add wouter` — dependency only
2. Rewrite App.tsx routing + NavItem
3. Remove callbacks from ExplorePage, ReviewPage
4. Convert TrackDetail, AlbumDetail, ArtistDetail to useParams
5. Update LinkButton to Link
6. Update all affected tests
