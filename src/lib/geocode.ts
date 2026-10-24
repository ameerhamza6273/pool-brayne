import { api } from "@/lib/apiClient";

// Free geocoding via OpenStreetMap's Nominatim (no API key/billing account available for Google Maps/Places).
const cache = new Map<string, { lat: number; lng: number } | null>();
let queue: Promise<unknown> = Promise.resolve();

// Client video 2026-09-29: several real subdivision addresses (e.g.
async function geocodeCensus(address: string): Promise<{ lat: number; lng: number } | null> {
  try {
    return await api.get<{ lat: number; lng: number } | null>(`/api/geocode/census?address=${encodeURIComponent(address)}`);
  } catch {
    return null;
  }
}

export function geocodeAddress(address: string): Promise<{ lat: number; lng: number } | null> {
  if (cache.has(address)) return Promise.resolve(cache.get(address) ?? null);

  const task = queue.then(async () => {
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=us&q=${encodeURIComponent(address)}`,
      );
      const results = (await res.json()) as { lat: string; lon: string }[];
      let result = results[0] ? { lat: parseFloat(results[0].lat), lng: parseFloat(results[0].lon) } : null;
      if (!result) result = await geocodeCensus(address);
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

// Address autocomplete (client request 2026-09-02: "auto populate the address when adding it for the first time"; client bug report 2026-09-03
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

// Fallback when the full street address can't be found (messy/legacy addresses): try the street without its house number (street-level, still
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
