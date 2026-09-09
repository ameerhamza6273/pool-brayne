import type { FastifyInstance } from "fastify";
import { withTenantContext } from "../db.js";
import { withQuickbooksConnection, getChartOfAccounts } from "../lib/quickbooks.js";

type Location = { id: string; type: string };
type Stock = { item_id: string; location_id: string; quantity: number };
type Item = { id: string; reorder_threshold: number; name?: string };

export default async function inventoryRoutes(app: FastifyInstance) {
  app.get("/summary", async (req) => {
    return withTenantContext(req.userId, async (tx) => {
      const [itemsRaw, locationsRaw, stockRaw, suppliers, purchaseOrders, variance] = await Promise.all([
        tx`select * from inventory_items order by name`,
        tx`select * from inventory_locations`,
        tx`select * from inventory_stock`,
        tx`select * from suppliers order by name`,
        tx`select po.*, jsonb_build_object('name', s.name) as suppliers, jsonb_build_object('label', sl.label, 'address', sl.address) as locations
           from purchase_orders po
           left join suppliers s on s.id = po.supplier_id
           left join supplier_locations sl on sl.id = po.location_id
           order by po.order_date desc`,
        tx`select v.*, jsonb_build_object('name', ii.name) as inventory_items
           from inventory_variance v left join inventory_items ii on ii.id = v.item_id
           order by v.recorded_at desc`,
      ]);

      const items = itemsRaw as unknown as Item[];
      const locations = locationsRaw as unknown as Location[];
      const stock = stockRaw as unknown as Stock[];

      const storeLocationIds = new Set(locations.filter((l) => l.type === "store").map((l) => l.id));
      const mergedItems = items.map((item) => {
        const itemStock = stock.filter((s) => s.item_id === item.id);
        const storeQty = itemStock.filter((s) => storeLocationIds.has(s.location_id)).reduce((sum, s) => sum + s.quantity, 0);
        const vehicleQty = itemStock.filter((s) => !storeLocationIds.has(s.location_id)).reduce((sum, s) => sum + s.quantity, 0);
        const total = storeQty + vehicleQty;
        const status = total === 0 ? "Out" : total <= item.reorder_threshold ? "Low" : "In Stock";
        return { ...item, storeQty, vehicleQty, total, status };
      });

      return { items: mergedItems, suppliers, purchaseOrders, varianceData: variance };
    });
  });

  app.get("/low-stock", async (req) => {
    return withTenantContext(req.userId, async (tx) => {
      const [itemsRaw, stockRaw] = await Promise.all([
        tx`select id, name, reorder_threshold from inventory_items`,
        tx`select item_id, quantity from inventory_stock`,
      ]);
      const items = itemsRaw as unknown as Item[];
      const stock = stockRaw as unknown as { item_id: string; quantity: number }[];

      return items
        .map((item) => ({
          id: item.id,
          name: item.name,
          current: stock.filter((s) => s.item_id === item.id).reduce((sum, s) => sum + s.quantity, 0),
          threshold: item.reorder_threshold,
        }))
        .filter((i) => i.threshold > 0 && i.current <= i.threshold)
        .sort((a, b) => a.current - b.current);
    });
  });

  app.post<{
    Body: {
      name: string;
      sku: string;
      category: string;
      unitCost: number;
      price: number | null;
      shortDescription: string | null;
      longDescription: string | null;
      department: string | null;
      subDepartment: string | null;
      manufacturer: string | null;
      reorderThreshold: number;
      subcategory?: string | null;
      subSubcategory?: string | null;
      subSubSubcategory?: string | null;
    };
  }>("/items", async (req) => {
    const { name, sku, category, unitCost, price, shortDescription, longDescription, department, subDepartment, manufacturer, reorderThreshold, subcategory, subSubcategory, subSubSubcategory } = req.body;
    return withTenantContext(req.userId, async (tx) => {
      const [tenant] = await tx`select current_tenant_id() as id`;
      const [row] = await tx`
        insert into inventory_items
          (tenant_id, name, sku, category, unit_cost, price, short_description, long_description, department, sub_department, manufacturer, reorder_threshold, subcategory, sub_subcategory, sub_sub_subcategory)
        values
          (${tenant.id}, ${name}, ${sku}, ${category}, ${unitCost}, ${price}, ${shortDescription}, ${longDescription}, ${department}, ${subDepartment}, ${manufacturer}, ${reorderThreshold ?? 0}, ${subcategory ?? null}, ${subSubcategory ?? null}, ${subSubSubcategory ?? null})
        returning *
      `;
      return row;
    });
  });

  // Client request 2026-08-28: Price (customer-facing) needs to be editable separately from
  // Cost (internal-only) after an item has already been created.
  app.patch<{ Params: { id: string }; Body: { unitCost: number; price: number | null } }>("/items/:id/pricing", async (req) => {
    const { id } = req.params;
    const { unitCost, price } = req.body;
    return withTenantContext(req.userId, (tx) => tx`
      update inventory_items set unit_cost = ${unitCost}, price = ${price} where id = ${id} returning *
    `);
  });

  // Client request 2026-09-04: editing a product only ever let you change Cost/Price -- every
  // other field (name, SKU, category, descriptions, department, manufacturer, barcode,
  // distributor, unit, taxable) had no edit path once the item was created. Full-record edit,
  // same field set as "Add Product" plus the extra fields real imported items actually carry.
  app.patch<{
    Params: { id: string };
    Body: {
      name: string;
      sku: string;
      category: string;
      unitCost: number;
      price: number | null;
      shortDescription: string | null;
      longDescription: string | null;
      department: string | null;
      subDepartment: string | null;
      manufacturer: string | null;
      barcode: string | null;
      defaultDistributor: string | null;
      unit: string | null;
      taxable: boolean;
      reorderThreshold: number;
      storeQuantity: number | null;
      subcategory?: string | null;
      subSubcategory?: string | null;
      subSubSubcategory?: string | null;
    };
  }>("/items/:id", async (req) => {
    const { id } = req.params;
    const {
      name, sku, category, unitCost, price, shortDescription, longDescription,
      department, subDepartment, manufacturer, barcode, defaultDistributor, unit, taxable, reorderThreshold,
      storeQuantity, subcategory, subSubcategory, subSubSubcategory,
    } = req.body;
    return withTenantContext(req.userId, async (tx) => {
      const [tenant] = await tx`select current_tenant_id() as id`;
      const [row] = await tx`
        update inventory_items set
          name = ${name}, sku = ${sku}, category = ${category}, unit_cost = ${unitCost}, price = ${price},
          short_description = ${shortDescription}, long_description = ${longDescription},
          department = ${department}, sub_department = ${subDepartment}, manufacturer = ${manufacturer},
          barcode = ${barcode}, default_distributor = ${defaultDistributor}, unit = ${unit}, taxable = ${taxable},
          reorder_threshold = ${reorderThreshold ?? 0}, subcategory = ${subcategory ?? null},
          sub_subcategory = ${subSubcategory ?? null}, sub_sub_subcategory = ${subSubSubcategory ?? null}
        where id = ${id}
        returning *
      `;

      // Client request 2026-09-04: "if stock runs out, be able to mark it Out; if it's back, mark
      // it In Stock" from the same edit screen — status is computed live from real quantity
      // everywhere else in the app (Catalog, Dashboard, POS, notifications), so the honest way to
      // do this is to let the edit set the actual on-hand Store quantity, not a separate flag
      // that could disagree with it.
      if (storeQuantity !== null && storeQuantity !== undefined) {
        const [store] = await tx`select id from inventory_locations where type = 'store' limit 1`;
        if (store) {
          const [stockRow] = await tx`
            select id from inventory_stock where item_id = ${id} and location_id = ${store.id} limit 1
          ` as unknown as { id: string }[];
          if (stockRow) {
            await tx`update inventory_stock set quantity = ${storeQuantity} where id = ${stockRow.id}`;
          } else {
            await tx`insert into inventory_stock (tenant_id, item_id, location_id, quantity) values (${tenant.id}, ${id}, ${store.id}, ${storeQuantity})`;
          }
        }
      }

      return row;
    });
  });

  // Sidebar restructure (client PDF 2026-09-06, "Data > Manufacture list") — distinct
  // manufacturers already recorded on inventory_items, with an item count each.
  app.get("/manufacturers", async (req) => {
    return withTenantContext(req.userId, (tx) => tx`
      select manufacturer, count(*)::int as item_count
      from inventory_items
      where manufacturer is not null and manufacturer != ''
      group by manufacturer
      order by manufacturer
    `);
  });

  app.get("/suppliers", async (req) => withTenantContext(req.userId, (tx) => tx`select * from suppliers order by name`));

  app.post<{ Body: { name: string; contact: string | null; phone: string | null; leadTime: string | null; address: string | null } }>("/suppliers", async (req) => {
    const { name, contact, phone, leadTime, address } = req.body;
    return withTenantContext(req.userId, async (tx) => {
      const [tenant] = await tx`select current_tenant_id() as id`;
      const [row] = await tx`
        insert into suppliers (tenant_id, name, contact, phone, lead_time, address)
        values (${tenant.id}, ${name}, ${contact}, ${phone}, ${leadTime}, ${address ?? null})
        returning *
      `;
      return row;
    });
  });

  app.patch<{ Params: { id: string }; Body: { name: string; contact: string | null; phone: string | null; leadTime: string | null; address: string | null } }>(
    "/suppliers/:id",
    async (req) => {
      const { id } = req.params;
      const { name, contact, phone, leadTime, address } = req.body;
      return withTenantContext(req.userId, async (tx) => {
        const [row] = await tx`
          update suppliers set name = ${name}, contact = ${contact}, phone = ${phone}, lead_time = ${leadTime}, address = ${address ?? null}
          where id = ${id} returning *
        `;
        return row;
      });
    },
  );

  // Client PDF 2026-09-05: "Vendor list (with addresses, contact names, phone numbers — some
  // vendors have multiple locations we put from)". A supplier is the vendor identity; each
  // location is a separate address/contact a PO can be placed from.
  // Client SMS 2026-09-09: "able to edit and delete vendors from list" — cascades to that
  // vendor's locations and vendor bills (schema-level on-delete-cascade), and clears
  // purchase_orders.supplier_id (on-delete-set-null) rather than deleting past POs.
  app.delete<{ Params: { id: string } }>("/suppliers/:id", async (req) => {
    const { id } = req.params;
    return withTenantContext(req.userId, (tx) => tx`delete from suppliers where id = ${id}`);
  });

  app.get<{ Params: { id: string } }>("/suppliers/:id/locations", async (req) => {
    const { id } = req.params;
    return withTenantContext(req.userId, (tx) => tx`select * from supplier_locations where supplier_id = ${id} order by label`);
  });

  app.post<{ Params: { id: string }; Body: { label: string; address: string | null; contactName: string | null; phone: string | null } }>(
    "/suppliers/:id/locations",
    async (req) => {
      const { id } = req.params;
      const { label, address, contactName, phone } = req.body;
      return withTenantContext(req.userId, async (tx) => {
        const [tenant] = await tx`select current_tenant_id() as id`;
        const [row] = await tx`
          insert into supplier_locations (tenant_id, supplier_id, label, address, contact_name, phone)
          values (${tenant.id}, ${id}, ${label}, ${address}, ${contactName}, ${phone})
          returning *
        `;
        return row;
      });
    },
  );

  app.delete<{ Params: { locationId: string } }>("/supplier-locations/:locationId", async (req) => {
    const { locationId } = req.params;
    return withTenantContext(req.userId, (tx) => tx`delete from supplier_locations where id = ${locationId}`);
  });

  // Sidebar restructure / inventory: cascading category picker seeded from the client's own
  // configuration_categories.xlsx (351 rows). Reference data for the Add/Edit Product dialog,
  // not a per-tenant CRUD surface.
  app.get("/category-taxonomy", async (req) => {
    return withTenantContext(req.userId, (tx) => tx`select * from category_taxonomy order by category, subcategory, sub_subcategory, sub_sub_subcategory`);
  });

  // Client request 2026-08-27: map each inventory item to QuickBooks COGS/Income/Asset accounts.
  app.get("/qbo-accounts", async (req) => withQuickbooksConnection(req.userId, getChartOfAccounts));

  app.patch<{
    Params: { id: string };
    Body: { qboAccounts: Record<string, { id: string; name: string } | null> };
  }>("/items/:id/qbo-accounts", async (req) => {
    const { id } = req.params;
    const { qboAccounts } = req.body;
    return withTenantContext(req.userId, async (tx) => {
      const [row] = await tx`update inventory_items set qbo_accounts = ${tx.json(qboAccounts)} where id = ${id} returning *`;
      return row;
    });
  });

  // Client request 2026-09-02: write off SKUs for store use / truck use / shrinkage — deducts
  // store stock the same way a POS sale or job-parts-used does (allowed to go negative, same as
  // POS, since a write-off can be recording shrinkage discovered after the fact).
  app.get("/writeoffs", async (req) => {
    return withTenantContext(req.userId, (tx) => tx`
      select w.*, jsonb_build_object('name', ii.name, 'sku', ii.sku) as inventory_items
      from inventory_writeoffs w join inventory_items ii on ii.id = w.item_id
      order by w.created_at desc
    `);
  });

  app.post<{ Body: { itemId: string; quantity: number; reason: string; note: string | null } }>("/writeoffs", async (req) => {
    const { itemId, quantity, reason, note } = req.body;
    return withTenantContext(req.userId, async (tx) => {
      const [tenant] = await tx`select current_tenant_id() as id`;
      const [row] = await tx`
        insert into inventory_writeoffs (tenant_id, item_id, quantity, reason, note, created_by)
        values (${tenant.id}, ${itemId}, ${quantity}, ${reason}, ${note}, ${req.userId})
        returning *
      `;
      const [store] = await tx`select id from inventory_locations where type = 'store' limit 1`;
      if (store) {
        const [stockRow] = await tx`
          select id, quantity from inventory_stock where item_id = ${itemId} and location_id = ${store.id} limit 1
        ` as unknown as { id: string; quantity: number }[];
        if (stockRow) {
          await tx`update inventory_stock set quantity = ${stockRow.quantity - quantity} where id = ${stockRow.id}`;
        } else {
          await tx`insert into inventory_stock (tenant_id, item_id, location_id, quantity) values (${tenant.id}, ${itemId}, ${store.id}, ${-quantity})`;
        }
      }
      return row;
    });
  });

  app.post<{ Body: { supplierId: string; number: string; locationId?: string | null } }>("/purchase-orders", async (req) => {
    const { supplierId, number, locationId } = req.body;
    return withTenantContext(req.userId, async (tx) => {
      const [tenant] = await tx`select current_tenant_id() as id`;
      const [row] = await tx`
        insert into purchase_orders (tenant_id, number, supplier_id, status, location_id)
        values (${tenant.id}, ${number}, ${supplierId}, 'Draft', ${locationId ?? null})
        returning *
      `;
      return row;
    });
  });

  // Client request 2026-09-03: PO list had no way to view/edit an existing order.
  app.patch<{
    Params: { id: string };
    Body: { number: string; supplierId: string; status: string; itemCount: number; total: number; receivedDate: string | null; locationId?: string | null };
  }>("/purchase-orders/:id", async (req) => {
    const { id } = req.params;
    const { number, supplierId, status, itemCount, total, receivedDate, locationId } = req.body;
    return withTenantContext(req.userId, async (tx) => {
      const [row] = await tx`
        update purchase_orders
        set number = ${number}, supplier_id = ${supplierId}, status = ${status},
            item_count = ${itemCount}, total = ${total}, received_date = ${receivedDate}, location_id = ${locationId ?? null}
        where id = ${id}
        returning *
      `;
      return row;
    });
  });
}
