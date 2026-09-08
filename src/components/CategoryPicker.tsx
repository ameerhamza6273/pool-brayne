import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { CategoryTaxonomyRow } from "@/lib/api/inventory";

// Client's configuration_categories.xlsx (2026-09-05, 351 rows): a 4-level product taxonomy
// (Category -> Subcategory -> Sub-subcategory -> Sub-sub-subcategory), seeded into
// category_taxonomy. Each level's options narrow to what's actually valid under the level above.
export default function CategoryPicker({
  taxonomy,
  category,
  subcategory,
  subSubcategory,
  subSubSubcategory,
  onChange,
}: {
  taxonomy: CategoryTaxonomyRow[];
  category: string;
  subcategory: string;
  subSubcategory: string;
  subSubSubcategory: string;
  onChange: (next: { category?: string; subcategory?: string; subSubcategory?: string; subSubSubcategory?: string }) => void;
}) {
  const categories = [...new Set(taxonomy.map((t) => t.category))].sort();
  const subcategories = [...new Set(taxonomy.filter((t) => t.category === category && t.subcategory).map((t) => t.subcategory as string))].sort();
  const subSubcategories = [...new Set(taxonomy.filter((t) => t.category === category && t.subcategory === subcategory && t.sub_subcategory).map((t) => t.sub_subcategory as string))].sort();
  const subSubSubcategories = [...new Set(taxonomy.filter((t) => t.category === category && t.subcategory === subcategory && t.sub_subcategory === subSubcategory && t.sub_sub_subcategory).map((t) => t.sub_sub_subcategory as string))].sort();

  return (
    <div className="grid grid-cols-2 gap-3">
      <div>
        <Label className="text-xs">Category</Label>
        <Select value={category || undefined} onValueChange={(v) => onChange({ category: v, subcategory: "", subSubcategory: "", subSubSubcategory: "" })}>
          <SelectTrigger className="mt-1 h-9"><SelectValue placeholder="Select category" /></SelectTrigger>
          <SelectContent>{categories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      {subcategories.length > 0 && (
        <div>
          <Label className="text-xs">Subcategory</Label>
          <Select value={subcategory || undefined} onValueChange={(v) => onChange({ subcategory: v, subSubcategory: "", subSubSubcategory: "" })}>
            <SelectTrigger className="mt-1 h-9"><SelectValue placeholder="Select subcategory" /></SelectTrigger>
            <SelectContent>{subcategories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      )}
      {subSubcategories.length > 0 && (
        <div>
          <Label className="text-xs">Sub-subcategory</Label>
          <Select value={subSubcategory || undefined} onValueChange={(v) => onChange({ subSubcategory: v, subSubSubcategory: "" })}>
            <SelectTrigger className="mt-1 h-9"><SelectValue placeholder="Select" /></SelectTrigger>
            <SelectContent>{subSubcategories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      )}
      {subSubSubcategories.length > 0 && (
        <div>
          <Label className="text-xs">Sub-sub-subcategory</Label>
          <Select value={subSubSubcategory || undefined} onValueChange={(v) => onChange({ subSubSubcategory: v })}>
            <SelectTrigger className="mt-1 h-9"><SelectValue placeholder="Select" /></SelectTrigger>
            <SelectContent>{subSubSubcategories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      )}
    </div>
  );
}
