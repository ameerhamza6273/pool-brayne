// Free geocoding via OpenStreetMap's Nominatim (no API key/billing account available for
// Google Maps/Places). Nominatim's usage policy caps unauthenticated requests at ~1/sec, so
// lookups are queued sequentially and cached in memory for the life of the tab.
const cache = new Map<string, { lat: number; lng: number } | null>();
let queue: Promise<unknown> = Promise.resolve();

export function geocodeAddress(address: string): Promise<{ lat: number; lng: number } | null> {
  if (cache.has(address)) return Promise.resolve(cache.get(address) ?? null);

  const task = queue.then(async () => {
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(address)}`);
      const results = (await res.json()) as { lat: string; lon: string }[];
      const result = results[0] ? { lat: parseFloat(results[0].lat), lng: parseFloat(results[0].lon) } : null;
      cache.set(address, result);
      await new Promise((r) => setTimeout(r, 1000));
      return result;
    } catch {
      cache.set(address, null);
      return null;
    }
  });
  queue = task;
  return task as Promise<{ lat: number; lng: number } | null>;
}
