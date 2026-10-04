/** Profile galleries store at most this many photos. */
export const MAX_PROFILE_PHOTOS = 6;

function photoUrlFromUnknown(item: unknown): string {
  if (typeof item === 'string') return item.trim();
  if (item && typeof item === 'object') {
    const o = item as Record<string, unknown>;
    const u = o.public_url ?? o.publicUrl ?? o.url ?? o.uri;
    if (typeof u === 'string') return u.trim();
  }
  return '';
}

/** Drop blanks and duplicate URLs, then keep at most {@link MAX_PROFILE_PHOTOS}. */
export function capProfilePhotoList<T>(photos: readonly T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const item of photos) {
    const url = photoUrlFromUnknown(item);
    if (!url || seen.has(url)) continue;
    seen.add(url);
    out.push((typeof item === 'string' ? url : item) as T);
    if (out.length >= MAX_PROFILE_PHOTOS) break;
  }
  return out;
}
