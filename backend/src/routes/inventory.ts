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
        tx`select po.*, jsonb_build_object('name', s.name) as suppliers
           from purchase_orders po left join suppliers s on s.id = po.supplier_id
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
    };
  }>("/items", async (req) => {
    const { name, sku, category, unitCost, price, shortDescription, longDescription, department, subDepartment, manufacturer } = req.body;
    return withTenantContext(req.userId, async (tx) => {
      const [tenant] = await tx`select current_tenant_id() as id`;
      const [row] = await tx`
        insert into inventory_items
          (tenant_id, name, sku, category, unit_cost, price, short_description, long_description, department, sub_department, manufacturer)
        values
          (${tenant.id}, ${name}, ${sku}, ${category}, ${unitCost}, ${price}, ${shortDescription}, ${longDescription}, ${department}, ${subDepartment}, ${manufacturer})
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

  app.get("/suppliers", async (req) => withTenantContext(req.userId, (tx) => tx`select * from suppliers order by name`));

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

  app.post<{ Body: { supplierId: string; number: string } }>("/purchase-orders", async (req) => {
    const { supplierId, number } = req.body;
    return withTenantContext(req.userId, async (tx) => {
      const [tenant] = await tx`select current_tenant_id() as id`;
      const [row] = await tx`
        insert into purchase_orders (tenant_id, number, supplier_id, status)
        values (${tenant.id}, ${number}, ${supplierId}, 'Draft')
        returning *
      `;
      return row;
    });
  });
}
