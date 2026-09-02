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

// Address autocomplete (client request 2026-09-02: "auto populate the address when adding it
// for the first time") — same free Nominatim endpoint, queued the same way so it shares the
// ~1/sec rate limit with geocodeAddress above.
export function searchAddressSuggestions(query: string): Promise<{ label: string; lat: number; lng: number }[]> {
  if (query.trim().length < 3) return Promise.resolve([]);

  const task = queue.then(async () => {
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=5&q=${encodeURIComponent(query)}`);
      const results = (await res.json()) as { display_name: string; lat: string; lon: string }[];
      await new Promise((r) => setTimeout(r, 1000));
      return results.map((r) => ({ label: r.display_name, lat: parseFloat(r.lat), lng: parseFloat(r.lon) }));
    } catch {
      return [];
    }
  });
  queue = task;
  return task as Promise<{ label: string; lat: number; lng: number }[]>;
}
