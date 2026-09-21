// Free geocoding via OpenStreetMap's Nominatim (no API key/billing account available for
// Google Maps/Places). Nominatim's usage policy caps unauthenticated requests at ~1/sec, so
// lookups are queued sequentially and cached in memory for the life of the tab.
const cache = new Map<string, { lat: number; lng: number } | null>();
let queue: Promise<unknown> = Promise.resolve();

export function geocodeAddress(address: string): Promise<{ lat: number; lng: number } | null> {
  if (cache.has(address)) return Promise.resolve(cache.get(address) ?? null);

  const task = queue.then(async () => {
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=us&q=${encodeURIComponent(address)}`,
      );
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

export type AddressSuggestion = {
  label: string;
  lat: number;
  lng: number;
  streetLine: string;
  city: string;
  state: string;
  zip: string;
};

// Address autocomplete (client request 2026-09-02: "auto populate the address when adding it
// for the first time"; client bug report 2026-09-03: results were coming up worldwide and
// included county/country cruft — restricted to the US via `countrycodes=us` and rebuilt a
// clean label from `addressdetails` instead of Nominatim's raw `display_name`) — same free
// Nominatim endpoint, queued the same way so it shares the ~1/sec rate limit with geocodeAddress.
export function searchAddressSuggestions(query: string): Promise<AddressSuggestion[]> {
  if (query.trim().length < 3) return Promise.resolve([]);

  const task = queue.then(async () => {
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&limit=5&countrycodes=us&addressdetails=1&q=${encodeURIComponent(query)}`,
      );
      const results = (await res.json()) as {
        lat: string;
        lon: string;
        address: {
          house_number?: string;
          road?: string;
          city?: string;
          town?: string;
          village?: string;
          state?: string;
          postcode?: string;
        };
      }[];
      await new Promise((r) => setTimeout(r, 1000));
      return results
        .map((r) => {
          const streetLine = [r.address.house_number, r.address.road].filter(Boolean).join(" ");
          const city = r.address.city ?? r.address.town ?? r.address.village ?? "";
          const state = r.address.state ?? "";
          const zip = r.address.postcode ?? "";
          const label = [streetLine, [city, state].filter(Boolean).join(", "), zip].filter(Boolean).join(", ");
          return { label, lat: parseFloat(r.lat), lng: parseFloat(r.lon), streetLine, city, state, zip };
        })
        .filter((r) => r.label);
    } catch {
      return [];
    }
  });
  queue = task;
  return task as Promise<AddressSuggestion[]>;
}

// Fallback when the full street address can't be found (messy/legacy addresses): try the street
// without its house number (street-level, still close), then city + state + zip, then just the zip,
// so the job still shows on the map -- approximately, and flagged as such by the caller. Results are
// remembered in localStorage so the same addresses aren't re-searched on every page load.
export async function geocodeApproximate(address: string): Promise<{ lat: number; lng: number } | null> {
  const storeKey = `geo-approx:${address}`;
  try {
    const saved = localStorage.getItem(storeKey);
    if (saved) return JSON.parse(saved) as { lat: number; lng: number };
  } catch { /* storage unavailable */ }

  let found: { lat: number; lng: number } | null = null;
  const withoutNumber = address.replace(/^\s*\d+[\w-]*\s+/, "");
  if (withoutNumber !== address) found = await geocodeAddress(withoutNumber);
  if (!found) {
    const cityStateZip = address.match(/([^,]+),\s*([A-Za-z]{2})\.?,?\s*(\d{5})/);
    if (cityStateZip) found = await geocodeAddress(`${cityStateZip[1].trim()}, ${cityStateZip[2]} ${cityStateZip[3]}`);
  }
  if (!found) {
    const zip = address.match(/\b(\d{5})\b/);
    if (zip) found = await geocodeAddress(zip[1]);
  }
  if (found) {
    try { localStorage.setItem(storeKey, JSON.stringify(found)); } catch { /* storage unavailable */ }
  }
  return found;
}
