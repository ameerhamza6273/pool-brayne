import { useState, useEffect, useCallback } from "react";
import { Search, Plus, Package, AlertTriangle, TrendingUp, Warehouse, Truck, ShoppingCart, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { inventoryApi } from "@/lib/api/inventory";
import type { Database } from "@/lib/database.types";
import type { ItemWithStock } from "@/lib/api/inventory";

type Supplier = Database["public"]["Tables"]["suppliers"]["Row"];
type PurchaseOrder = Database["public"]["Tables"]["purchase_orders"]["Row"] & { suppliers: { name: string } | null };
type InventoryVariance = Database["public"]["Tables"]["inventory_variance"]["Row"] & { inventory_items: { name: string } | null };

const categories = ["All", "Chemicals", "Parts", "Equipment", "Accessories"];

const statusColors: Record<string, string> = {
  "In Stock": "bg-[#16A34A]/10 text-[#16A34A]",
  "Low": "bg-[#F59E0B]/10 text-[#F59E0B]",
  "Out": "bg-[#DC2626]/10 text-[#DC2626]",
};

const poStatusColors: Record<string, string> = {
  "Draft": "bg-[#F59E0B]/10 text-[#F59E0B]",
  "Ordered": "bg-[#0891B2]/10 text-[#0891B2]",
  "Received": "bg-[#16A34A]/10 text-[#16A34A]",
};

export default function Inventory() {
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [addOpen, setAddOpen] = useState(false);
  const [poOpen, setPoOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const [items, setItems] = useState<ItemWithStock[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [varianceData, setVarianceData] = useState<InventoryVariance[]>([]);

  const [newProduct, setNewProduct] = useState({
    name: "", sku: "", category: "Chemicals", unitCost: "",
    shortDescription: "", longDescription: "", department: "", subDepartment: "", manufacturer: "",
  });
  const [newPo, setNewPo] = useState({ supplierId: "", number: "" });

  const loadInventory = useCallback(async () => {
    setIsLoading(true);
    const data = await inventoryApi.summary();
    setItems(data.items);
    setSuppliers(data.suppliers);
    setPurchaseOrders(data.purchaseOrders);
    setVarianceData(data.varianceData);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    loadInventory();
  }, [loadInventory]);

  const handleAddProduct = async () => {
    if (!newProduct.name || !newProduct.sku) return;
    await inventoryApi.addItem({
      name: newProduct.name,
      sku: newProduct.sku,
      category: newProduct.category,
      unitCost: parseFloat(newProduct.unitCost) || 0,
      shortDescription: newProduct.shortDescription || null,
      longDescription: newProduct.longDescription || null,
      department: newProduct.department || null,
      subDepartment: newProduct.subDepartment || null,
      manufacturer: newProduct.manufacturer || null,
    });
    setNewProduct({ name: "", sku: "", category: "Chemicals", unitCost: "", shortDescription: "", longDescription: "", department: "", subDepartment: "", manufacturer: "" });
    setAddOpen(false);
    loadInventory();
  };

  const handleCreatePo = async () => {
    if (!newPo.supplierId || !newPo.number) return;
    await inventoryApi.createPurchaseOrder({ supplierId: newPo.supplierId, number: newPo.number });
    setNewPo({ supplierId: "", number: "" });
    setPoOpen(false);
    loadInventory();
  };

  const filtered = items.filter((p) => {
    const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase()) || p.sku.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = categoryFilter === "All" || p.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  const totalValue = items.reduce((sum, p) => sum + p.total * p.unit_cost, 0);
  const lowStock = items.filter((p) => p.status === "Low").length;
  const outOfStock = items.filter((p) => p.status === "Out").length;

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h1 className="text-2xl font-bold text-[#0F172A]">Inventory</h1>
        <div className="flex items-center gap-2">
          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <DialogTrigger asChild>
              <Button className="bg-[#0891B2] hover:bg-[#0E7490] text-white gap-2 h-10">
                <Plus className="w-4 h-4" /> Add Product
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[85vh] overflow-y-auto">
              <DialogHeader><DialogTitle>Add Product</DialogTitle></DialogHeader>
              <div className="space-y-4 pt-2">
                <div><Label>Name</Label><Input className="mt-1" placeholder="Product name" value={newProduct.name} onChange={(e) => setNewProduct((p) => ({ ...p, name: e.target.value }))} /></div>
                <div><Label>SKU</Label><Input className="mt-1" placeholder="SKU-123" value={newProduct.sku} onChange={(e) => setNewProduct((p) => ({ ...p, sku: e.target.value }))} /></div>
                <div className="grid grid-cols-2 gap-4">
                  <div><Label>Category</Label>
                    <Select value={newProduct.category} onValueChange={(v) => setNewProduct((p) => ({ ...p, category: v }))}>
                      <SelectTrigger className="mt-1"><SelectValue placeholder="Select" /></SelectTrigger>
                      <SelectContent>{categories.filter(c => c !== "All").map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div><Label>Unit Cost</Label><Input className="mt-1" type="number" placeholder="0.00" value={newProduct.unitCost} onChange={(e) => setNewProduct((p) => ({ ...p, unitCost: e.target.value }))} /></div>
                </div>
                <div><Label>Short Description</Label><Input className="mt-1" placeholder="One-line summary" value={newProduct.shortDescription} onChange={(e) => setNewProduct((p) => ({ ...p, shortDescription: e.target.value }))} /></div>
                <div><Label>Long Description</Label><Input className="mt-1" placeholder="Full details" value={newProduct.longDescription} onChange={(e) => setNewProduct((p) => ({ ...p, longDescription: e.target.value }))} /></div>
                <div className="grid grid-cols-2 gap-4">
                  <div><Label>Department</Label><Input className="mt-1" placeholder="e.g. Pool Care" value={newProduct.department} onChange={(e) => setNewProduct((p) => ({ ...p, department: e.target.value }))} /></div>
                  <div><Label>Sub-department</Label><Input className="mt-1" placeholder="e.g. Sanitizers" value={newProduct.subDepartment} onChange={(e) => setNewProduct((p) => ({ ...p, subDepartment: e.target.value }))} /></div>
                </div>
                <div><Label>Manufacturer</Label><Input className="mt-1" placeholder="e.g. Pentair" value={newProduct.manufacturer} onChange={(e) => setNewProduct((p) => ({ ...p, manufacturer: e.target.value }))} /></div>
                <Button className="w-full bg-[#0891B2] text-white" onClick={handleAddProduct}>Save Product</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "Total SKUs", value: items.length, icon: Package, color: "text-[#0891B2]", bg: "bg-[#0891B2]/10" },
          { label: "Low Stock", value: lowStock, icon: AlertTriangle, color: "text-[#F59E0B]", bg: "bg-[#F59E0B]/10" },
          { label: "Inventory Value", value: `$${totalValue.toLocaleString()}`, icon: TrendingUp, color: "text-[#16A34A]", bg: "bg-[#16A34A]/10" },
          { label: "Out of Stock", value: outOfStock, icon: Warehouse, color: "text-[#DC2626]", bg: "bg-[#DC2626]/10" },
        ].map((kpi) => {
          const Icon = kpi.icon;
          return (
            <div key={kpi.label} className="bg-white rounded-xl p-4 border border-[#E2E8F0] shadow-sm flex items-center gap-3">
              <div className={`w-10 h-10 rounded-lg ${kpi.bg} flex items-center justify-center shrink-0`}>
                <Icon className={`w-5 h-5 ${kpi.color}`} />
              </div>
              <div>
                <p className="text-xs text-[#64748B]">{kpi.label}</p>
                <p className="text-lg font-bold text-[#0F172A]">{kpi.value}</p>
              </div>
            </div>
          );
        })}
      </div>

      {isLoading && <div className="text-center py-8 text-[#64748B]">Loading inventory...</div>}

      {!isLoading && (
      <Tabs defaultValue="catalog" className="w-full">
        <TabsList className="bg-white border border-[#E2E8F0] h-10 p-1 rounded-lg">
          <TabsTrigger value="catalog" className="text-sm data-[state=active]:bg-[#0891B2] data-[state=active]:text-white rounded-md px-4 gap-1.5">
            <Package className="w-4 h-4" /> Catalog
          </TabsTrigger>
          <TabsTrigger value="suppliers" className="text-sm data-[state=active]:bg-[#0891B2] data-[state=active]:text-white rounded-md px-4 gap-1.5">
            <Truck className="w-4 h-4" /> Suppliers
          </TabsTrigger>
          <TabsTrigger value="purchase" className="text-sm data-[state=active]:bg-[#0891B2] data-[state=active]:text-white rounded-md px-4 gap-1.5">
            <ShoppingCart className="w-4 h-4" /> Purchase Orders
          </TabsTrigger>
          <TabsTrigger value="variance" className="text-sm data-[state=active]:bg-[#0891B2] data-[state=active]:text-white rounded-md px-4 gap-1.5">
            <BarChart3 className="w-4 h-4" /> Variance
          </TabsTrigger>
        </TabsList>

        <TabsContent value="catalog" className="mt-4 space-y-3">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#64748B]" />
              <Input placeholder="Search products..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 h-10 bg-white border-[#E2E8F0]" />
            </div>
            <div className="flex gap-2">
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="h-10 w-40 bg-white border-[#E2E8F0]"><SelectValue placeholder="Category" /></SelectTrigger>
                <SelectContent>{categories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <p className="text-xs text-[#64748B]">Products consumed on a job are automatically deducted at close.</p>
          <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
                    <th className="text-left py-3 px-4 text-xs font-semibold text-[#64748B] uppercase">Product</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-[#64748B] uppercase">SKU</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-[#64748B] uppercase">Category</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-[#64748B] uppercase">Manufacturer</th>
                    <th className="text-right py-3 px-4 text-xs font-semibold text-[#64748B] uppercase">Store</th>
                    <th className="text-right py-3 px-4 text-xs font-semibold text-[#64748B] uppercase">Vehicles</th>
                    <th className="text-right py-3 px-4 text-xs font-semibold text-[#64748B] uppercase">Total</th>
                    <th className="text-right py-3 px-4 text-xs font-semibold text-[#64748B] uppercase">Reorder</th>
                    <th className="text-right py-3 px-4 text-xs font-semibold text-[#64748B] uppercase">Cost</th>
                    <th className="text-center py-3 px-4 text-xs font-semibold text-[#64748B] uppercase">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((p) => (
                    <tr key={p.id} className={`border-b border-[#F1F5F9] last:border-0 hover:bg-[#F8FAFC] ${p.status === "Out" ? "bg-[#DC2626]/5" : p.status === "Low" ? "bg-[#F59E0B]/5" : ""}`}>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3" title={p.short_description ?? undefined}>
                          <div className="w-8 h-8 rounded-lg bg-[#F1F5F9] flex items-center justify-center shrink-0">
                            <Package className="w-4 h-4 text-[#64748B]" />
                          </div>
                          <div>
                            <span className="font-medium text-[#0F172A]">{p.name}</span>
                            {(p.department || p.sub_department) && (
                              <p className="text-xs text-[#64748B]">{[p.department, p.sub_department].filter(Boolean).join(" / ")}</p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-[#64748B]">{p.sku}</td>
                      <td className="py-3 px-4"><Badge className="bg-[#F1F5F9] text-[#64748B] text-[10px] px-1.5 py-0">{p.category}</Badge></td>
                      <td className="py-3 px-4 text-[#64748B]">{p.manufacturer || "—"}</td>
                      <td className="text-right py-3 px-4 font-medium text-[#0F172A]">{p.storeQty}</td>
                      <td className="text-right py-3 px-4 text-[#64748B]">{p.vehicleQty}</td>
                      <td className="text-right py-3 px-4 font-semibold text-[#0F172A]">{p.total}</td>
                      <td className="text-right py-3 px-4 text-[#64748B]">{p.reorder_threshold}</td>
                      <td className="text-right py-3 px-4 text-[#0F172A]">${p.unit_cost.toFixed(2)}</td>
                      <td className="text-center py-3 px-4">
                        <Badge className={`${statusColors[p.status]} text-[10px] px-1.5 py-0`}>{p.status}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="suppliers" className="mt-4">
          <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
                    <th className="text-left py-3 px-4 text-xs font-semibold text-[#64748B] uppercase">Supplier</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-[#64748B] uppercase">Contact</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-[#64748B] uppercase">Phone</th>
                    <th className="text-right py-3 px-4 text-xs font-semibold text-[#64748B] uppercase">Lead Time</th>
                  </tr>
                </thead>
                <tbody>
                  {suppliers.map((s) => (
                    <tr key={s.id} className="border-b border-[#F1F5F9] last:border-0 hover:bg-[#F8FAFC]">
                      <td className="py-3 px-4 font-medium text-[#0F172A]">{s.name}</td>
                      <td className="py-3 px-4 text-[#64748B] text-sm">{s.contact}</td>
                      <td className="py-3 px-4 text-[#64748B] text-sm">{s.phone}</td>
                      <td className="text-right py-3 px-4"><Badge className="bg-[#0891B2]/10 text-[#0891B2] text-[10px] px-1.5 py-0">{s.lead_time}</Badge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="purchase" className="mt-4 space-y-3">
          <div className="flex justify-end">
            <Dialog open={poOpen} onOpenChange={setPoOpen}>
              <DialogTrigger asChild>
                <Button className="bg-[#0891B2] hover:bg-[#0E7490] text-white gap-2 h-10"><Plus className="w-4 h-4" /> New PO</Button>
              </DialogTrigger>
              <DialogContent><DialogHeader><DialogTitle>New Purchase Order</DialogTitle></DialogHeader>
                <div className="space-y-4 pt-2">
                  <div><Label>PO Number</Label><Input className="mt-1" placeholder="PO-2026-001" value={newPo.number} onChange={(e) => setNewPo((p) => ({ ...p, number: e.target.value }))} /></div>
                  <div><Label>Supplier</Label>
                    <Select value={newPo.supplierId} onValueChange={(v) => setNewPo((p) => ({ ...p, supplierId: v }))}>
                      <SelectTrigger className="mt-1"><SelectValue placeholder="Select supplier" /></SelectTrigger>
                      <SelectContent>{suppliers.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <Button className="w-full bg-[#0891B2] text-white" onClick={handleCreatePo}>Create PO</Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
          <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
                    <th className="text-left py-3 px-4 text-xs font-semibold text-[#64748B] uppercase">PO Number</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-[#64748B] uppercase">Supplier</th>
                    <th className="text-right py-3 px-4 text-xs font-semibold text-[#64748B] uppercase">Items</th>
                    <th className="text-right py-3 px-4 text-xs font-semibold text-[#64748B] uppercase">Total</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-[#64748B] uppercase">Date</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-[#64748B] uppercase">Received</th>
                    <th className="text-center py-3 px-4 text-xs font-semibold text-[#64748B] uppercase">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {purchaseOrders.map((po) => (
                    <tr key={po.id} className="border-b border-[#F1F5F9] last:border-0 hover:bg-[#F8FAFC]">
                      <td className="py-3 px-4 font-medium text-[#0F172A]">{po.number}</td>
                      <td className="py-3 px-4 text-[#64748B]">{po.suppliers?.name ?? "—"}</td>
                      <td className="text-right py-3 px-4 text-[#0F172A]">{po.item_count}</td>
                      <td className="text-right py-3 px-4 font-semibold text-[#0F172A]">${po.total.toLocaleString()}</td>
                      <td className="py-3 px-4 text-[#64748B]">{po.order_date}</td>
                      <td className="py-3 px-4 text-[#64748B]">{po.received_date || "—"}</td>
                      <td className="text-center py-3 px-4">
                        <Badge className={`${poStatusColors[po.status]} text-[10px] px-1.5 py-0`}>{po.status}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="variance" className="mt-4">
          <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
                    <th className="text-left py-3 px-4 text-xs font-semibold text-[#64748B] uppercase">Product</th>
                    <th className="text-right py-3 px-4 text-xs font-semibold text-[#64748B] uppercase">Expected</th>
                    <th className="text-right py-3 px-4 text-xs font-semibold text-[#64748B] uppercase">Actual</th>
                    <th className="text-right py-3 px-4 text-xs font-semibold text-[#64748B] uppercase">Variance %</th>
                    <th className="text-center py-3 px-4 text-xs font-semibold text-[#64748B] uppercase">Flag</th>
                  </tr>
                </thead>
                <tbody>
                  {varianceData.map((v) => (
                    <tr key={v.id} className={`border-b border-[#F1F5F9] last:border-0 hover:bg-[#F8FAFC] ${v.flagged ? "bg-[#F59E0B]/5" : ""}`}>
                      <td className="py-3 px-4 font-medium text-[#0F172A]">{v.inventory_items?.name ?? "—"}</td>
                      <td className="text-right py-3 px-4 text-[#0F172A]">{v.expected}</td>
                      <td className="text-right py-3 px-4 text-[#0F172A]">{v.actual}</td>
                      <td className={`text-right py-3 px-4 font-semibold ${v.variance_pct < -20 ? "text-[#DC2626]" : v.variance_pct < 0 ? "text-[#F59E0B]" : "text-[#16A34A]"}`}>
                        {v.variance_pct}%
                      </td>
                      <td className="text-center py-3 px-4">
                        {v.flagged && <Badge className="bg-[#F59E0B]/10 text-[#F59E0B] text-[10px] px-1.5 py-0">Flagged</Badge>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>
      </Tabs>
      )}
    </div>
  );
}
