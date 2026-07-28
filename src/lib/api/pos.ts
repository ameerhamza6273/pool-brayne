import { api } from "@/lib/apiClient";
import type { Database } from "@/lib/database.types";

type InventoryItem = Database["public"]["Tables"]["inventory_items"]["Row"];
type PosOrder = Database["public"]["Tables"]["pos_orders"]["Row"] & { customers: { name: string } | null; item_count: number };

export const posApi = {
  catalog: () => api.get<(InventoryItem & { stock: number })[]>("/api/pos/catalog"),

  transactions: () => api.get<PosOrder[]>("/api/pos/transactions"),

  checkout: (data: {
    customerId: string | null;
    subtotal: number;
    tax: number;
    total: number;
    paymentMethod: string;
    items: { id: string; name: string; qty: number; price: number; isService: boolean }[];
  }) => api.post<{ id: string }>("/api/pos/checkout", data),
};
