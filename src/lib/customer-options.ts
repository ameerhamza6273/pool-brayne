import type { SearchableSelectOption } from "@/components/SearchableSelect";

// Client SMS 2026-09-21: "when selecting a customer show the address under their name" -- with
// thousands of customers (and repeat names) the address is what tells two of them apart.
export const customerOption = (c: { id: string; name: string; address?: string | null; phone?: string | null }): SearchableSelectOption => ({
  value: c.id,
  label: c.name,
  sublabel: [c.address, c.phone].filter(Boolean).join(" · ") || undefined,
});
