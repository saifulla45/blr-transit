/**
 * Links that open turn-by-turn directions in whatever maps app the person has.
 *
 * Google's universal `/maps/dir/` URL is the right default here: it opens the
 * Google Maps app when installed, falls back to the web otherwise, and works on
 * Android, iOS and desktop from one link. Omitting `origin` makes Maps use the
 * device's current location, which is what "navigate me there" means.
 *
 * A `geo:` URI would be more neutral but is Android-only, and Apple Maps links
 * do nothing on Android — one link that works everywhere beats two that each
 * work half the time.
 */
export function directionsUrl(lat: number, lon: number, label?: string): string {
  const params = new URLSearchParams({
    api: '1',
    destination: `${lat},${lon}`,
  });
  // Shows the place's name in Maps rather than bare coordinates.
  if (label) params.set('destination_place_id', '');
  return `https://www.google.com/maps/dir/?${params.toString()}`
    + (label ? `&destination_name=${encodeURIComponent(label)}` : '');
}

/** A pin rather than a route — for "show me exactly where this is". */
export function mapPinUrl(lat: number, lon: number): string {
  return `https://www.google.com/maps/search/?api=1&query=${lat},${lon}`;
}
