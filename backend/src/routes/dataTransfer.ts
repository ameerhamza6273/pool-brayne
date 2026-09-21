import type { FastifyInstance } from "fastify";
import { withTenantContext } from "../db.js";

// Client SMS 2026-09-21 ("Under Data: need import and export fields with CSV file"): bulk import for
// Customers, Inventory, Vendors, Inventory Categories, Inventory Manufacturers and the two Library lists.
// Exports are built in the browser from the existing list endpoints; imports come here (the frontend sends
// parsed rows in chunks). Every import is safe to re-run: rows are matched to what's already there
// (customers by name+address, inventory by SKU, vendors by name, ...) and only changed fields are updated.

type Row = Record<string, string | undefined>;
type Result = { created: number; updated: number; skipped: number; errors: string[] };

const MAX_ERRORS = 25;

const str = (v: string | undefined): string | null => {
  const t = (v ?? "").trim();
  return t === "" ? null : t;
};
// null = blank, NaN = present but not a number
const num = (v: string | undefined): number | null => {
  const t = (v ?? "").replace(/[$,\s]/g, "");
  if (t === "") return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : NaN;
};
const bool = (v: string | undefined): boolean | null => {
  const t = (v ?? "").trim().toLowerCase();
  if (!t) return null;
  if (["true", "yes", "y", "1", "taxable"].includes(t)) return true;
  if (["false", "no", "n", "0", "non-taxable", "nontaxable"].includes(t)) return false;
  return null;
};
const lc = (v: string | null | undefined) => (v ?? "").trim().toLowerCase();
const slugify = (label: string) => label.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "") || "item";
const newResult = (): Result => ({ created: 0, updated: 0, skipped: 0, errors: [] });
const addError = (r: Result, msg: string) => { if (r.errors.length < MAX_ERRORS) r.errors.push(msg); r.skipped++; };

// Config lists (tenant_config_lists) that CSV import can add to.
const CONFIG_LIST_DATASETS: Record<string, { listKey: string; column: string }> = {
  "inventory-manufacturers": { listKey: "inventory_manufacturers", column: "manufacturer" },
  "library-categories": { listKey: "library_categories", column: "category" },
  "library-manufacturers": { listKey: "library_manufacturers", column: "manufacturer" },
};

export default async function dataTransferRoutes(app: FastifyInstance) {
  app.post<{ Params: { dataset: string }; Body: { rows: Row[] } }>("/import/:dataset", async (req, reply) => {
    const { dataset } = req.params;
    const rows = Array.isArray(req.body?.rows) ? req.body.rows : [];
    if (rows.length > 1000) return reply.code(400).send({ error: "Send at most 1000 rows per request" });
    const result = newResult();

    return withTenantContext(req.userId, async (tx) => {
      const [tenant] = await tx`select current_tenant_id() as id`;
      const tenantId = (tenant as { id: string }).id;

      // ---------------------------------------------------------------- customers
      if (dataset === "customers") {
        const existing = (await tx`select id, name, address, phone, email, type, first_name, last_name from customers`) as unknown as {
          id: string; name: string; address: string | null; phone: string | null; email: string | null; type: string | null; first_name: string | null; last_name: string | null;
        }[];
        const byKey = new Map(existing.map((c) => [`${lc(c.name)}|${lc(c.address)}`, c]));
        const toInsert: Record<string, unknown>[] = [];
        const seen = new Set<string>();
        rows.forEach((row, i) => {
          const first = str(row.first_name);
          const last = str(row.last_name);
          const name = str(row.name) ?? [first, last].filter(Boolean).join(" ");
          if (!name) return addError(result, `Row ${i + 2}: a name (or first + last name) is required`);
          const address = str(row.address);
          const key = `${lc(name)}|${lc(address)}`;
          const typeRaw = lc(str(row.type));
          const type = typeRaw === "commercial" ? "Commercial" : typeRaw === "residential" ? "Residential" : null;
          const patch: Record<string, unknown> = {};
          const found = byKey.get(key);
          if (found) {
            const cand: Record<string, string | null> = { phone: str(row.phone), email: str(row.email), type, first_name: first, last_name: last };
            for (const [col, val] of Object.entries(cand)) {
              if (val !== null && val !== (found as unknown as Record<string, string | null>)[col]) patch[col] = val;
            }
            if (Object.keys(patch).length === 0) { result.skipped++; return; }
            toInsert.push({ __update: found.id, ...patch });
          } else if (seen.has(key)) {
            result.skipped++;
          } else {
            seen.add(key);
            toInsert.push({ tenant_id: tenantId, name, first_name: first, last_name: last, type: type ?? "Residential", email: str(row.email), phone: str(row.phone), address });
          }
        });
        const news = toInsert.filter((r) => !("__update" in r));
        for (let i = 0; i < news.length; i += 300) {
          await tx`insert into customers ${tx(news.slice(i, i + 300), "tenant_id", "name", "first_name", "last_name", "type", "email", "phone", "address")}`;
        }
        result.created += news.length;
        for (const u of toInsert.filter((r) => "__update" in r)) {
          const { __update, ...patch } = u as { __update: string } & Record<string, unknown>;
          await tx`update customers set ${tx(patch)} where id = ${__update}`;
          result.updated++;
        }
        return result;
      }

      // ---------------------------------------------------------------- inventory
      if (dataset === "inventory") {
        const existing = (await tx`select * from inventory_items`) as unknown as Record<string, unknown>[];
        const bySku = new Map(existing.map((it) => [lc(it.sku as string), it]));
        const textCols = ["name", "category", "subcategory", "sub_subcategory", "sub_sub_subcategory", "manufacturer", "unit", "barcode", "short_description", "long_description", "department", "sub_department", "default_distributor"] as const;
        const news: Record<string, unknown>[] = [];
        const seen = new Set<string>();
        const updates: { id: string; patch: Record<string, unknown> }[] = [];
        rows.forEach((row, i) => {
          const sku = str(row.sku);
          if (!sku) return addError(result, `Row ${i + 2}: SKU is required`);
          const values: Record<string, unknown> = {};
          for (const c of textCols) { const v = str(row[c]); if (v !== null) values[c] = v; }
          for (const c of ["unit_cost", "price", "reorder_threshold"] as const) {
            const n = num(row[c]);
            if (n === null) continue;
            if (Number.isNaN(n)) return addError(result, `Row ${i + 2} (${sku}): ${c} isn't a number`);
            values[c] = c === "reorder_threshold" ? Math.round(n) : n;
          }
          const tax = bool(row.taxable); if (tax !== null) values.taxable = tax;
          const pos = bool(row.pos_enabled); if (pos !== null) values.pos_enabled = pos;
          const found = bySku.get(lc(sku));
          if (found) {
            const patch: Record<string, unknown> = {};
            for (const [col, val] of Object.entries(values)) {
              const cur = found[col];
              const same = typeof val === "number" ? Number(cur) === val : cur === val;
              if (!same) patch[col] = val;
            }
            if (Object.keys(patch).length === 0) { result.skipped++; return; }
            updates.push({ id: found.id as string, patch });
          } else {
            if (seen.has(lc(sku))) { result.skipped++; return; }
            if (!values.name) return addError(result, `Row ${i + 2} (${sku}): a name is required for a new item`);
            if (!values.category) return addError(result, `Row ${i + 2} (${sku}): a category is required for a new item`);
            seen.add(lc(sku));
            news.push({
              tenant_id: tenantId, sku, name: values.name, category: values.category,
              subcategory: values.subcategory ?? null, sub_subcategory: values.sub_subcategory ?? null, sub_sub_subcategory: values.sub_sub_subcategory ?? null,
              manufacturer: values.manufacturer ?? null, unit: values.unit ?? "ea", barcode: values.barcode ?? null,
              short_description: values.short_description ?? null, long_description: values.long_description ?? null,
              department: values.department ?? null, sub_department: values.sub_department ?? null, default_distributor: values.default_distributor ?? null,
              unit_cost: values.unit_cost ?? 0, price: values.price ?? null, reorder_threshold: values.reorder_threshold ?? 0,
              taxable: values.taxable ?? true, pos_enabled: values.pos_enabled ?? false,
            });
          }
        });
        const cols = ["tenant_id", "sku", "name", "category", "subcategory", "sub_subcategory", "sub_sub_subcategory", "manufacturer", "unit", "barcode", "short_description", "long_description", "department", "sub_department", "default_distributor", "unit_cost", "price", "reorder_threshold", "taxable", "pos_enabled"];
        for (let i = 0; i < news.length; i += 200) {
          await tx`insert into inventory_items ${tx(news.slice(i, i + 200), ...cols)}`;
        }
        result.created += news.length;
        for (const u of updates) {
          await tx`update inventory_items set ${tx(u.patch)} where id = ${u.id}`;
          result.updated++;
        }
        return result;
      }

      // ---------------------------------------------------------------- vendors
      if (dataset === "vendors") {
        const existing = (await tx`select id, name, contact, phone, lead_time, address from suppliers`) as unknown as Record<string, string | null>[];
        const byName = new Map(existing.map((v) => [lc(v.name), v]));
        const news: Record<string, unknown>[] = [];
        const seen = new Set<string>();
        for (const [i, row] of rows.entries()) {
          const name = str(row.name);
          if (!name) { addError(result, `Row ${i + 2}: a vendor name is required`); continue; }
          const cand: Record<string, string | null> = { contact: str(row.contact), phone: str(row.phone), lead_time: str(row.lead_time), address: str(row.address) };
          const found = byName.get(lc(name));
          if (found) {
            const patch: Record<string, unknown> = {};
            for (const [col, val] of Object.entries(cand)) if (val !== null && val !== found[col]) patch[col] = val;
            if (Object.keys(patch).length === 0) { result.skipped++; continue; }
            await tx`update suppliers set ${tx(patch)} where id = ${found.id as string}`;
            result.updated++;
          } else if (seen.has(lc(name))) {
            result.skipped++;
          } else {
            seen.add(lc(name));
            news.push({ tenant_id: tenantId, name, ...cand });
          }
        }
        for (let i = 0; i < news.length; i += 300) {
          await tx`insert into suppliers ${tx(news.slice(i, i + 300), "tenant_id", "name", "contact", "phone", "lead_time", "address")}`;
        }
        result.created += news.length;
        return result;
      }

      // ---------------------------------------------------------------- inventory categories
      if (dataset === "inventory-categories") {
        const existing = (await tx`select category, subcategory, sub_subcategory, sub_sub_subcategory from category_taxonomy`) as unknown as Record<string, string | null>[];
        const keyOf = (r: Record<string, string | null>) => [r.category, r.subcategory, r.sub_subcategory, r.sub_sub_subcategory].map(lc).join("|");
        const have = new Set(existing.map(keyOf));
        const news: Record<string, unknown>[] = [];
        for (const [i, row] of rows.entries()) {
          const rec = { category: str(row.category), subcategory: str(row.subcategory), sub_subcategory: str(row.sub_subcategory), sub_sub_subcategory: str(row.sub_sub_subcategory) };
          if (!rec.category) { addError(result, `Row ${i + 2}: a category is required`); continue; }
          const key = keyOf(rec);
          if (have.has(key)) { result.skipped++; continue; }
          have.add(key);
          news.push({ tenant_id: tenantId, ...rec });
        }
        for (let i = 0; i < news.length; i += 300) {
          await tx`insert into category_taxonomy ${tx(news.slice(i, i + 300), "tenant_id", "category", "subcategory", "sub_subcategory", "sub_sub_subcategory")}`;
        }
        result.created += news.length;
        return result;
      }

      // ---------------------------------------------------------------- simple name lists (config lists)
      const listSpec = CONFIG_LIST_DATASETS[dataset];
      if (listSpec) {
        const existing = (await tx`select label, sort_order from tenant_config_lists where list_key = ${listSpec.listKey}`) as unknown as { label: string; sort_order: number }[];
        const have = new Set(existing.map((e) => lc(e.label)));
        let next = existing.reduce((m, e) => Math.max(m, e.sort_order), -1) + 1;
        for (const [i, row] of rows.entries()) {
          const label = str(row[listSpec.column]) ?? str(row.name);
          if (!label) { addError(result, `Row ${i + 2}: "${listSpec.column}" is required`); continue; }
          if (have.has(lc(label))) { result.skipped++; continue; }
          have.add(lc(label));
          await tx`
            insert into tenant_config_lists (tenant_id, list_key, item_id, label, color, sort_order)
            values (${tenantId}, ${listSpec.listKey}, ${slugify(label)}, ${label}, ${null}, ${next++})
            on conflict (tenant_id, list_key, item_id) do nothing
          `;
          result.created++;
        }
        return result;
      }

      return reply.code(400).send({ error: `Unknown dataset "${dataset}"` });
    });
  });
}
