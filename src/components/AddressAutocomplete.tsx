import { useState, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { searchAddressSuggestions } from "@/lib/geocode";
import { isSmartyConfigured, smartyAutocomplete } from "@/lib/smarty";

// Client request 2026-09-02: "auto populate the address when adding it for the first time".
export default function AddressAutocomplete({
  value,
  onChange,
  onSelectParts,
  placeholder,
  className,
}: {
  value: string;
  onChange: (value: string, coords?: { lat: number; lng: number }) => void;
  // Client bug report 2026-09-03: reports need street/city/state/zip as separate fields — callers that show those fields can pass this to
  onSelectParts?: (parts: { streetLine: string; city: string; state: string; zip: string }) => void;
  placeholder?: string;
  className?: string;
}) {
  const [suggestions, setSuggestions] = useState<
    { label: string; lat?: number; lng?: number; streetLine: string; city: string; state: string; zip: string }[]
  >([]);
  const [open, setOpen] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (value.trim().length < 3) {
      setSuggestions([]);
      return;
    }
    timerRef.current = setTimeout(async () => {
      if (isSmartyConfigured()) {
        const results = await smartyAutocomplete(value);
        setSuggestions(results.map((s) => ({ label: s.label, streetLine: [s.streetLine, s.secondary].filter(Boolean).join(" "), city: s.city, state: s.state, zip: s.zipcode })));
      } else {
        const results = await searchAddressSuggestions(value);
        setSuggestions(results);
      }
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
        <div data-dropdown-list className="absolute z-50 mt-1 w-full max-h-[150px] overflow-y-auto rounded-lg border border-[#E2E8F0] bg-white shadow-lg">
          {suggestions.map((s, i) => (
            <button
              key={i}
              type="button"
              className="w-full text-left px-3 py-2 text-sm hover:bg-[#F8FAFC] border-b border-[#F1F5F9] last:border-0"
              onMouseDown={(e) => {
                e.preventDefault();
                onChange(s.label, s.lat !== undefined && s.lng !== undefined ? { lat: s.lat, lng: s.lng } : undefined);
                onSelectParts?.({ streetLine: s.streetLine, city: s.city, state: s.state, zip: s.zip });
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
