import { useState, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { searchAddressSuggestions } from "@/lib/geocode";
import { isSmartyConfigured, smartyAutocomplete } from "@/lib/smarty";

// Client request 2026-09-02: "auto populate the address when adding it for the first time".
// Uses Smarty's real US Autocomplete Pro (client sent smarty.com/pricing) once
// VITE_SMARTY_EMBEDDED_KEY is configured; until then, falls back to free Nominatim suggestions
// (no Google Places billing account available), debounced so it respects Nominatim's
// ~1 request/sec usage policy. Smarty's suggestions don't include lat/lng (that's a separate
// Smarty product) — only the Nominatim path returns coords, which is fine since map-pin
// geocoding elsewhere in the app runs independently off the saved address text.
export default function AddressAutocomplete({
  value,
  onChange,
  placeholder,
  className,
}: {
  value: string;
  onChange: (value: string, coords?: { lat: number; lng: number }) => void;
  placeholder?: string;
  className?: string;
}) {
  const [suggestions, setSuggestions] = useState<{ label: string; lat?: number; lng?: number }[]>([]);
  const [open, setOpen] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (value.trim().length < 3) {
      setSuggestions([]);
      return;
    }
    timerRef.current = setTimeout(async () => {
      const results = isSmartyConfigured() ? await smartyAutocomplete(value) : await searchAddressSuggestions(value);
      setSuggestions(results);
    }, 500);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [value]);

  return (
    <div className="relative">
      <Input
        placeholder={placeholder}
        className={className}
        value={value}
        onChange={(e) => { onChange(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
      />
      {open && suggestions.length > 0 && (
        <div className="absolute z-50 mt-1 w-full max-h-56 overflow-y-auto rounded-lg border border-[#E2E8F0] bg-white shadow-lg">
          {suggestions.map((s, i) => (
            <button
              key={i}
              type="button"
              className="w-full text-left px-3 py-2 text-sm hover:bg-[#F8FAFC] border-b border-[#F1F5F9] last:border-0"
              onMouseDown={(e) => {
                e.preventDefault();
                onChange(s.label, s.lat !== undefined && s.lng !== undefined ? { lat: s.lat, lng: s.lng } : undefined);
                setSuggestions([]);
                setOpen(false);
              }}
            >
              {s.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
