import { useRef, useState } from "react";
import { Download, Upload, FileSpreadsheet, Users, Package, Boxes, Layers, Factory, BookOpen, CheckCircle2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { customersApi } from "@/lib/api/customers";
import { inventoryApi } from "@/lib/api/inventory";
import { configListsApi } from "@/lib/api/configLists";
import { dataTransferApi, type ImportResult } from "@/lib/api/dataTransfer";
import { downloadCsv, normalizeHeader, parseCsv, toCsv } from "@/lib/csv";
import { useLanguage } from "@/lib/language-context";

// Client SMS 2026-09-21: "Under Data: need import and export fields with csv file -- Customer list,
// Inventory list, Vendor list, Inventory Categories, Inventory Manufacture list, Library Category list,
// Library Manufacture list". Exports are built here from the existing list endpoints; imports send the
// parsed rows to /api/data/import/:dataset in chunks. Re-importing a file is safe (rows are matched to what
// exists and only changed fields are updated).

type Dataset = {
  key: string;
  title: string;
  description: string;
  icon: React.ElementType;
  columns: string[];
  // Each entry is a set of columns of which ALL must be present; the file needs at least one satisfied set.
  required: string[][];
  filename: string;
  sample: Record<string, string>;
  fetchRows: () => Promise<Record<string, unknown>[]>;
};

const ALIASES: Record<string, string> = {
  item: "item_number", item_no: "item_number", item_num: "item_number",
  cost: "unit_cost", unitcost: "unit_cost", retail_price: "price", sell_price: "price",
  sub_category: "subcategory", sub_sub_category: "sub_subcategory", sub_sub_sub_category: "sub_sub_subcategory",
  customer_name: "name", customer: "name", vendor: "name", vendor_name: "name", phone_number: "phone", e_mail: "email",
  lead_time_days: "lead_time", reorder: "reorder_threshold", reorder_point: "reorder_threshold",
};

const datasets: Dataset[] = [
  {
    key: "customers",
    title: "Customer List",
    description: "Customers with contact details. Matched by name + address, so re-importing updates instead of duplicating.",
    icon: Users,
    // Client 2026-09-23 (customers-template new.csv): gate/access columns = the customer page's Gate Codes card (customers.gate_codes).
    columns: ["name", "first_name", "last_name", "type", "email", "phone", "address", "front_gate_code", "house_gate_code", "padlock_code", "access_notes"],
    required: [["name"], ["first_name", "last_name"]],
    filename: "customers.csv",
    sample: { name: "Jane Smith", first_name: "Jane", last_name: "Smith", type: "Residential", email: "jane@example.com", phone: "(555) 123-4567", address: "123 Main St, Alpharetta, GA 30022", front_gate_code: "#1234", house_gate_code: "#5678", padlock_code: "0000", access_notes: "Dog in backyard" },
    fetchRows: async () =>
      (await customersApi.list()).map((c) => {
        const gc = (c.gate_codes ?? {}) as Record<string, string>;
        return { ...c, front_gate_code: gc.frontGate ?? "", house_gate_code: gc.houseGate ?? "", padlock_code: gc.padlock ?? "", access_notes: gc.notes ?? "" } as unknown as Record<string, unknown>;
      }),
  },
  {
    key: "inventory",
    title: "Inventory List",
    description: "Products / SKUs. Matched by SKU: existing items are updated, new ones (name + category needed) are added. Stock counts are not imported.",
    icon: Package,
    columns: ["sku", "name", "category", "subcategory", "sub_subcategory", "sub_sub_subcategory", "manufacturer", "unit_cost", "price", "taxable", "unit", "reorder_threshold", "barcode", "short_description", "long_description", "department", "sub_department", "default_distributor", "pos_enabled", "item_number"],
    required: [["sku"]],
    filename: "inventory.csv",
    sample: { sku: "FILTER-100", name: "Cartridge Filter 100 sq ft", category: "FILTER PART", manufacturer: "Pentair", unit_cost: "45.00", price: "79.99", taxable: "true", unit: "ea", reorder_threshold: "2" },
    fetchRows: async () => ((await inventoryApi.summary()).items as unknown as Record<string, unknown>[]),
  },
  {
    key: "vendors",
    title: "Vendor List",
    description: "Suppliers you buy from. Matched by vendor name.",
    icon: Boxes,
    columns: ["name", "contact", "phone", "lead_time", "address"],
    required: [["name"]],
    filename: "vendors.csv",
    sample: { name: "Pool Supply Wholesale", contact: "Sam Rep", phone: "(555) 987-6543", lead_time: "2 days", address: "100 Supply Rd, Atlanta, GA 30301" },
    fetchRows: async () => (await inventoryApi.suppliers()) as unknown as Record<string, unknown>[],
  },
  {
    key: "inventory-categories",
    title: "Inventory Categories",
    description: "The 4-level category tree used by Inventory (category > subcategory > ...). Rows that already exist are skipped.",
    icon: Layers,
    columns: ["category", "subcategory", "sub_subcategory", "sub_sub_subcategory"],
    required: [["category"]],
    filename: "inventory-categories.csv",
    sample: { category: "PUMP PART", subcategory: "IMPELLER", sub_subcategory: "", sub_sub_subcategory: "" },
    fetchRows: async () => (await inventoryApi.categoryTaxonomy()) as unknown as Record<string, unknown>[],
  },
  {
    key: "inventory-manufacturers",
    title: "Inventory Manufacturer List",
    description: "Manufacturer names. Export lists every manufacturer in your catalog with its item count; import adds names to the list.",
    icon: Factory,
    columns: ["manufacturer", "item_count"],
    required: [["manufacturer"]],
    filename: "inventory-manufacturers.csv",
    sample: { manufacturer: "Pentair", item_count: "" },
    fetchRows: async () => {
      const [fromCatalog, lists] = await Promise.all([inventoryApi.manufacturers(), configListsApi.all()]);
      const rows = fromCatalog.map((m) => ({ manufacturer: m.manufacturer, item_count: m.item_count }));
      const have = new Set(rows.map((r) => r.manufacturer.toLowerCase()));
      for (const m of lists.inventory_manufacturers) if (!have.has(m.label.toLowerCase())) rows.push({ manufacturer: m.label, item_count: 0 });
      return rows.sort((a, b) => a.manufacturer.localeCompare(b.manufacturer));
    },
  },
  {
    key: "library-categories",
    title: "Library Category List",
    description: "The categories offered when tagging Library documents.",
    icon: BookOpen,
    columns: ["category"],
    required: [["category"]],
    filename: "library-categories.csv",
    sample: { category: "Pumps / Motors" },
    fetchRows: async () => (await configListsApi.all()).library_categories.map((i) => ({ category: i.label })),
  },
  {
    key: "library-manufacturers",
    title: "Library Manufacturer List",
    description: "The manufacturers offered when tagging Library documents.",
    icon: BookOpen,
    columns: ["manufacturer"],
    required: [["manufacturer"]],
    filename: "library-manufacturers.csv",
    sample: { manufacturer: "Pentair" },
    fetchRows: async () => (await configListsApi.all()).library_manufacturers.map((i) => ({ manufacturer: i.label })),
  },
];

type Pending = { fileName: string; rows: Record<string, string>[]; problem: string | null };
const CHUNK = 300;

export default function DataTransfer() {
  const { t } = useLanguage();
  const [busy, setBusy] = useState<string | null>(null);
  const [pending, setPending] = useState<Record<string, Pending | undefined>>({});
  const [results, setResults] = useState<Record<string, ImportResult | undefined>>({});
  const [progress, setProgress] = useState<Record<string, string | undefined>>({});
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const fileInputs = useRef<Record<string, HTMLInputElement | null>>({});

  const handleExport = async (d: Dataset) => {
    setBusy(`export-${d.key}`);
    setErrors((p) => ({ ...p, [d.key]: undefined }));
    try {
      downloadCsv(d.filename, toCsv(await d.fetchRows(), d.columns));
    } catch (err) {
      setErrors((p) => ({ ...p, [d.key]: err instanceof Error ? err.message : "Export failed" }));
    }
    setBusy(null);
  };

  // The template leaves out read-only export columns (item_number / item_count).
  const handleTemplate = (d: Dataset) =>
    downloadCsv(`${d.filename.replace(".csv", "")}-template.csv`, toCsv([d.sample], d.columns.filter((c) => c !== "item_number" && c !== "item_count")));

  const handleFile = async (d: Dataset, file: File | undefined) => {
    if (!file) return;
    setResults((p) => ({ ...p, [d.key]: undefined }));
    setErrors((p) => ({ ...p, [d.key]: undefined }));
    const parsed = parseCsv(await file.text());
    // Map loose headers/aliases onto the expected column names.
    const rows = parsed.rows.map((r) => {
      const out: Record<string, string> = {};
      for (const [h, v] of Object.entries(r)) out[ALIASES[normalizeHeader(h)] ?? normalizeHeader(h)] = v;
      return out;
    });
    const headers = new Set(parsed.headers.map((h) => ALIASES[h] ?? h));
    const satisfied = d.required.some((set) => set.every((c) => headers.has(c)));
    setPending((p) => ({
      ...p,
      [d.key]: {
        fileName: file.name,
        rows,
        problem: rows.length === 0
          ? "The file has no data rows."
          : satisfied ? null : `Missing required column: ${d.required.map((s) => s.join(" + ")).join(" or ")}.`,
      },
    }));
    const input = fileInputs.current[d.key];
    if (input) input.value = "";
  };

  const runImport = async (d: Dataset) => {
    const p = pending[d.key];
    if (!p || p.problem) return;
    setBusy(`import-${d.key}`);
    const total: ImportResult = { created: 0, updated: 0, skipped: 0, errors: [] };
    try {
      for (let i = 0; i < p.rows.length; i += CHUNK) {
        setProgress((prev) => ({ ...prev, [d.key]: `${Math.min(i + CHUNK, p.rows.length)} / ${p.rows.length}` }));
        const r = await dataTransferApi.importRows(d.key, p.rows.slice(i, i + CHUNK));
        total.created += r.created;
        total.updated += r.updated;
        total.skipped += r.skipped;
        total.errors.push(...r.errors.map((e) => e.replace(/^Row (\d+)/, (_m, n) => `Row ${Number(n) + i}`)));
      }
      setResults((prev) => ({ ...prev, [d.key]: total }));
      setPending((prev) => ({ ...prev, [d.key]: undefined }));
    } catch (err) {
      setErrors((prev) => ({ ...prev, [d.key]: err instanceof Error ? err.message : "Import failed" }));
      if (total.created + total.updated > 0) setResults((prev) => ({ ...prev, [d.key]: total }));
    }
    setProgress((prev) => ({ ...prev, [d.key]: undefined }));
    setBusy(null);
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-[#0F172A]">{t("Import / Export")}</h1>
        <p className="text-sm text-[#64748B] mt-0.5">{t("Download any list as a CSV file, or upload a CSV to add and update records. Start from the template if you're unsure of the columns.")}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {datasets.map((d) => {
          const Icon = d.icon;
          const p = pending[d.key];
          const res = results[d.key];
          return (
            <Card key={d.key} className="border-[#E2E8F0] shadow-sm">
              <CardContent className="p-5 space-y-3">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-[#0891B2]/10 flex items-center justify-center shrink-0"><Icon className="w-5 h-5 text-[#0891B2]" /></div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-[#0F172A]">{t(d.title)}</h3>
                    <p className="text-xs text-[#64748B] mt-0.5">{t(d.description)}</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1">
                  {d.columns.map((c) => <span key={c} className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#F1F5F9] text-[#64748B]">{c}</span>)}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" className="h-9 gap-2 border-[#E2E8F0]" disabled={busy !== null} onClick={() => handleExport(d)}>
                    <Download className="w-4 h-4 text-[#0891B2]" /> {busy === `export-${d.key}` ? t("Preparing...") : t("Export CSV")}
                  </Button>
                  <input ref={(el) => { fileInputs.current[d.key] = el; }} type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => handleFile(d, e.target.files?.[0])} />
                  <Button variant="outline" className="h-9 gap-2 border-[#E2E8F0]" disabled={busy !== null} onClick={() => fileInputs.current[d.key]?.click()}>
                    <Upload className="w-4 h-4 text-[#0891B2]" /> {t("Import CSV")}
                  </Button>
                  <Button variant="ghost" className="h-9 gap-2 text-[#64748B]" onClick={() => handleTemplate(d)}>
                    <FileSpreadsheet className="w-4 h-4" /> {t("Template")}
                  </Button>
                </div>

                {p && (
                  <div className={`rounded-lg border p-3 text-sm ${p.problem ? "border-[#DC2626]/30 bg-[#DC2626]/5" : "border-[#0891B2]/30 bg-[#0891B2]/5"}`}>
                    <p className="font-medium text-[#0F172A] flex items-center gap-2">
                      {p.problem ? <AlertCircle className="w-4 h-4 text-[#DC2626]" /> : <FileSpreadsheet className="w-4 h-4 text-[#0891B2]" />}
                      {p.fileName}
                    </p>
                    {p.problem ? (
                      <p className="text-[#DC2626] mt-1">{t(p.problem)}</p>
                    ) : (
                      <div className="flex items-center justify-between gap-3 mt-1">
                        <span className="text-[#64748B]">{p.rows.length} {t("rows ready to import")}</span>
                        <Button className="h-8 bg-[#0891B2] hover:bg-[#0E7490] text-white" disabled={busy !== null} onClick={() => runImport(d)}>
                          {busy === `import-${d.key}` ? `${t("Importing...")} ${progress[d.key] ?? ""}` : t("Import")}
                        </Button>
                      </div>
                    )}
                  </div>
                )}

                {res && (
                  <div className="rounded-lg border border-[#16A34A]/30 bg-[#16A34A]/5 p-3 text-sm">
                    <p className="font-medium text-[#0F172A] flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-[#16A34A]" /> {t("Import finished")}</p>
                    <div className="flex flex-wrap gap-2 mt-1.5">
                      <Badge className="bg-[#16A34A]/10 text-[#16A34A] text-[10px]">{res.created} {t("added")}</Badge>
                      <Badge className="bg-[#0891B2]/10 text-[#0891B2] text-[10px]">{res.updated} {t("updated")}</Badge>
                      <Badge className="bg-[#F1F5F9] text-[#64748B] text-[10px]">{res.skipped} {t("skipped")}</Badge>
                    </div>
                    {res.errors.length > 0 && (
                      <ul className="mt-2 text-xs text-[#DC2626] space-y-0.5 list-disc pl-4">
                        {res.errors.slice(0, 8).map((e, i) => <li key={i}>{e}</li>)}
                        {res.errors.length > 8 && <li>… {res.errors.length - 8} {t("more")}</li>}
                      </ul>
                    )}
                  </div>
                )}
                {errors[d.key] && <p className="text-sm text-[#DC2626]">{errors[d.key]}</p>}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
