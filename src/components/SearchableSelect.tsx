import { useState, useMemo } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";

export type SearchableSelectOption = { value: string; label: string; sublabel?: string };

const RESULT_CAP = 50;

// Client request 2026-09-03: plain <Select> dropdowns became unusable once the real
// customer (3,600+) and inventory (2,500+) lists were imported — needs type-to-filter search.
// Client request 2026-09-04: cmdk mounts every item it's given regardless of the filter text, so
// passing it the full 2,500-3,600-item array directly (as this component originally did) still
// meant thousands of DOM nodes on every open — filtering is done here in JS instead, and only a
// capped number of matches is ever rendered (same "unpaginated big list" issue as the Catalog/
// Customers/Valuation tables, just inside a combobox instead of a plain table).
export function SearchableSelect({
  options,
  value,
  onChange,
  placeholder = "Select...",
  searchPlaceholder = "Search...",
  emptyText = "No results.",
  className,
}: {
  options: SearchableSelectOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const selected = options.find((o) => o.value === value);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matches = q
      ? options.filter((o) => `${o.label} ${o.sublabel ?? ""}`.toLowerCase().includes(q))
      : options;
    return matches.slice(0, RESULT_CAP);
  }, [options, query]);
  const hiddenCount = (query.trim() ? options.filter((o) => `${o.label} ${o.sublabel ?? ""}`.toLowerCase().includes(query.trim().toLowerCase())).length : options.length) - visible.length;

  return (
    <Popover open={open} onOpenChange={(o) => { setOpen(o); if (!o) setQuery(""); }}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("w-full justify-between font-normal", !selected && "text-muted-foreground", className)}
        >
          <span className="truncate">{selected ? selected.label : placeholder}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput placeholder={searchPlaceholder} value={query} onValueChange={setQuery} />
          <CommandList>
            <CommandEmpty>{emptyText}</CommandEmpty>
            <CommandGroup>
              {visible.map((o) => (
                <CommandItem
                  key={o.value}
                  value={o.value}
                  onSelect={(v) => {
                    onChange(v === value ? "" : v);
                    setOpen(false);
                  }}
                >
                  <Check className={cn("mr-2 h-4 w-4", value === o.value ? "opacity-100" : "opacity-0")} />
                  <div className="flex flex-col">
                    <span>{o.label}</span>
                    {o.sublabel && <span className="text-xs text-muted-foreground">{o.sublabel}</span>}
                  </div>
                </CommandItem>
              ))}
              {hiddenCount > 0 && (
                <p className="px-2 py-1.5 text-xs text-muted-foreground">
                  +{hiddenCount} more — keep typing to narrow down
                </p>
              )}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
