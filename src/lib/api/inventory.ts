import { api } from "@/lib/apiClient";
import type { Database } from "@/lib/database.types";

type InventoryItem = Database["public"]["Tables"]["inventory_items"]["Row"];
type Supplier = Database["public"]["Tables"]["suppliers"]["Row"];
type PurchaseOrder = Database["public"]["Tables"]["purchase_orders"]["Row"] & { suppliers: { name: string } | null };
type InventoryVariance = Database["public"]["Tables"]["inventory_variance"]["Row"] & { inventory_items: { name: string } | null };

export type ItemWithStock = InventoryItem & { storeQty: number; vehicleQty: number; total: number; status: "In Stock" | "Low" | "Out" };

export type InventorySummary = {
  items: ItemWithStock[];
  suppliers: Supplier[];
  purchaseOrders: PurchaseOrder[];
  varianceData: InventoryVariance[];
};

export const inventoryApi = {
  summary: () => api.get<InventorySummary>("/api/inventory/summary"),

  lowStock: () => api.get<{ id: string; name: string; current: number; threshold: number }[]>("/api/inventory/low-stock"),

  addItem: (data: {
    name: string;
    sku: string;
    category: string;
    unitCost: number;
    shortDescription: string | null;
    longDescription: string | null;
    department: string | null;
    subDepartment: string | null;
    manufacturer: string | null;
  }) => api.post<InventoryItem>("/api/inventory/items", data),

  createPurchaseOrder: (data: { supplierId: string; number: string }) =>
    api.post<PurchaseOrder>("/api/inventory/purchase-orders", data),
};
