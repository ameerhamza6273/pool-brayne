import { api } from "@/lib/apiClient";
import type { Database } from "@/lib/database.types";

type InventoryItem = Database["public"]["Tables"]["inventory_items"]["Row"];
type PosOrder = Database["public"]["Tables"]["pos_orders"]["Row"] & { customers: { name: string } | null; item_count: number };

export type SalesReport = {
  qtyByProduct: { description: string; qty: number; revenue: number }[];
  taxSummary: { orderCount: number; totalSales: number; taxableSales: number; taxCollected: number };
};

export const posApi = {
  catalog: () => api.get<(InventoryItem & { stock: number })[]>("/api/pos/catalog"),

  transactions: () => api.get<PosOrder[]>("/api/pos/transactions"),

  reports: (start: string, end: string) => api.get<SalesReport>(`/api/pos/reports?start=${start}&end=${end}`),

  checkout: (data: {
    customerId: string | null;
    subtotal: number;
    tax: number;
    total: number;
    paymentMethod: string;
    items: { id: string | null; name: string; qty: number; price: number; isService: boolean }[];
  }) => api.post<{ id: string }>("/api/pos/checkout", data),
};
