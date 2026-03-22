/**
 * Converts a display name to a URL-safe slug.
 * "OK Computer" → "ok-computer", "AC/DC" → "ac-dc"
 */
export function toSlug(name: string): string {
  return (
    name
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "") // strip diacritics
      .replace(/[^a-z0-9]+/g, "-")     // non-alphanum → hyphen
      .replace(/^-+|-+$/g, "")         // trim leading/trailing hyphens
  ) || "unknown";
}

/**
 * Tracks slug assignments to ensure uniqueness.
 * Uses the business key (e.g. "album_name||artist_name") as the identity,
 * separate from the slug (e.g. "ok-computer").
 */
export class SlugRegistry {
  private slugToKey = new Map<string, string>();
  private keyToSlug = new Map<string, string>();

  constructor(existing: Array<{ slug: string; key: string }> = []) {
    for (const { slug, key } of existing) {
      this.slugToKey.set(slug, key);
      this.keyToSlug.set(key, slug);
    }
  }

  /** Returns the existing slug for this key, or assigns a new one (with dedup). */
  getOrAssign(key: string, slugBase: string): string {
    const existing = this.keyToSlug.get(key);
    if (existing !== undefined) return existing;

    let candidate = slugBase;
    let n = 1;
    while (this.slugToKey.has(candidate)) {
      candidate = `${slugBase}-${n++}`;
    }
    this.slugToKey.set(candidate, key);
    this.keyToSlug.set(key, candidate);
    return candidate;
  }
}
