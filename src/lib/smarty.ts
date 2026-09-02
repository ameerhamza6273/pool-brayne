// Real US address autocomplete via Smarty (client sent smarty.com/pricing, 2026-09-02, as a
// paid alternative to the free Nominatim lookup in geocode.ts). Needs an "embedded" API key
// restricted by HTTP referrer (Settings > embedded keys on smarty.com), set as
// VITE_SMARTY_EMBEDDED_KEY. Until that key exists, isSmartyConfigured() is false and
// AddressAutocomplete falls back to Nominatim automatically — nothing else needs to change once
// the key is added.
const SMARTY_KEY = import.meta.env.VITE_SMARTY_EMBEDDED_KEY as string | undefined;

export function isSmartyConfigured(): boolean {
  return !!SMARTY_KEY;
}

export type SmartySuggestion = {
  label: string;
  streetLine: string;
  secondary: string;
  city: string;
  state: string;
  zipcode: string;
};

// US Autocomplete Pro: https://www.smarty.com/docs/cloud/us-autocomplete-pro-api
// `search` is capped at 32 chars by the API itself.
export async function smartyAutocomplete(query: string): Promise<SmartySuggestion[]> {
  if (!SMARTY_KEY || query.trim().length < 3) return [];
  const search = query.slice(0, 32);
  try {
    const res = await fetch(
      `https://us-autocomplete-pro.api.smarty.com/lookup?key=${SMARTY_KEY}&search=${encodeURIComponent(search)}`,
    );
    if (!res.ok) return [];
    const data = (await res.json()) as {
      suggestions?: { street_line: string; secondary: string; city: string; state: string; zipcode: string }[];
    };
    return (data.suggestions ?? []).map((s) => ({
      label: `${[s.street_line, s.secondary].filter(Boolean).join(" ")}, ${s.city}, ${s.state} ${s.zipcode}`,
      streetLine: s.street_line,
      secondary: s.secondary,
      city: s.city,
      state: s.state,
      zipcode: s.zipcode,
    }));
  } catch {
    return [];
  }
}
