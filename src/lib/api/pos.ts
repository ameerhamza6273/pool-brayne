import { api } from "@/lib/apiClient";
import type { Database } from "@/lib/database.types";

type InventoryItem = Database["public"]["Tables"]["inventory_items"]["Row"];
type PosOrder = Database["public"]["Tables"]["pos_orders"]["Row"] & { customers: { name: string } | null; item_count: number };

export type PosOrderDetail = {
  order: Database["public"]["Tables"]["pos_orders"]["Row"] & { customer_name: string | null; cashier_name: string | null };
  items: { id: string; item_id: string | null; description: string; quantity: number; unit_price: number; amount: number; serial_number: string | null; sku: string | null }[];
  payments: { method: string; amount: number }[];
};

// Same receipt number everywhere (POS, customer page, reprints).
export const receiptNumber = (orderId: string) => `POS-${orderId.replace(/-/g, "").slice(0, 8).toUpperCase()}`;

export type SalesReport = {
  qtyByProduct: { description: string; qty: number; revenue: number }[];
  taxSummary: { orderCount: number; totalSales: number; taxableSales: number; taxCollected: number };
};

export const posApi = {
  catalog: () => api.get<(InventoryItem & { stock: number })[]>("/api/pos/catalog"),

  transactions: (limit?: number) => api.get<PosOrder[]>(`/api/pos/transactions${limit ? `?limit=${limit}` : ""}`),

  order: (id: string) => api.get<PosOrderDetail>(`/api/pos/orders/${id}`),

  saveOrderNote: (id: string, note: string | null) => api.patch<{ id: string; note: string | null }>(`/api/pos/orders/${id}/note`, { note }),

  reports: (start: string, end: string) => api.get<SalesReport>(`/api/pos/reports?start=${start}&end=${end}`),

  checkout: (data: {
    customerId: string | null;
    subtotal: number;
    tax: number;
    total: number;
    note?: string | null;
    payments: { method: string; amount: number; opaqueData?: { dataDescriptor: string; dataValue: string } }[];
    items: { id: string | null; name: string; qty: number; price: number; isService: boolean; serialNumber?: string | null }[];
  }) => api.post<{ id: string }>("/api/pos/checkout", data),
};
