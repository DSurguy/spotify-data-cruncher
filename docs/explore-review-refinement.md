For this session, I want to refine how users interact with the application. This may require changes to the database, API or application structure.

Create and push a branch before beginning this work, and follow commit rules from the repo instructions.

## Overview
Separate the app into two workflows: Explore and Review.

Explode should allow the user to freely navigate through the dataset, using filtering, grouping and searching to organically discover the data.

Review should allow the user to process the dataset by reviewing each track so they can remember what music they liked or did not like, and carry that information into other applications.

Explore should include the data captured in Review.

## Explore Details
The default view should be tracks, sorted by playtime. The user should be able to group the tracks by genre, artist and album, resulting in a tree view of the dataset. Each of those is optional (hierarchy is genre -> artist -> album -> track). If one of the pieces of data is unknown, it can go in an "Unknown" grouping.

Selecting an artist, album or track should take the user to the detailed view for that piece of data. Each of these views should display metadata and child data, and the child data should allow simple searching, sorting and filtering. Artist view should have two tabs for child data, albums and tracks. The track view should have a link to enter review mode for that track.

Artist, Album and track should have breadcrumbs back to the main explore view.

## Review Details
Review should guide the user to the next un-reviewed track in the dataset through a variety of methods. These methods should include: "oldest/newest", "most/least played", "random", and each should show 5 tracks.

Once the user selects a track, the track view should be presented in review mode. Review mode should prompt the user for "rating", "notes" and "genre". Rating should capture "like", "dislike" or "no opinion". Only rating should be required. Once rating and other data is entered, the user should be able to complete the "review" and mark the track reviewed. The user should then be prompted "review another track?", which will return them to the main review page is confirmed.

## Making Decisions
If you do not have enough information to make a decision, explore the codebase or prompt the user for feedback.

If you encounter friction when reasoning, prompt the user for guidance to avoid circular thinking logic.

If you can gain useful information from gathering data from the web or a skill, attempt to retrieve it, asking the user for confirmation first.

---

## Decisions (recorded from session feedback)

### Navigation
The standalone Albums and Artists nav items are **replaced entirely by Explore**. The sidebar becomes: Dashboard, Explore, Review, Podcasts, History, Datasets.

### Data / Migrations
The app is in pre-release development mode. Old data can be discarded — no migrations are required. Schema changes are made directly to the initial migration.

### Explore — Grouping collapse state
- All group levels are **collapsed by default**.
- The user can manually expand or collapse any level (user override).
- When a **search is active**, all matching groups are **force-expanded**, overriding the user's manual state.
- Priority hierarchy: `default collapsed` → `user expand/collapse` → `search match forces expand`.

### Review — Breadcrumbs
When a track is entered from the **Review** page, the breadcrumb reads `← Review`. When entered from **Explore**, the breadcrumb reads `← Explore`.

### Track Rating
Rating changes from a 1–5 star integer to one of three values: `"like"`, `"dislike"`, or `"none"` (no opinion). This is a breaking change and existing star ratings on tracks are discarded (acceptable in pre-release mode).