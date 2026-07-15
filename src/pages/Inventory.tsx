import { useState } from "react";
import { Search, Plus, Package, AlertTriangle, TrendingUp, Warehouse, Truck, ShoppingCart, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { inventory, suppliers, purchaseOrders, varianceData } from "@/lib/data";

const categories = ["All", "Chemicals", "Parts", "Equipment", "Accessories"];
const locations = ["All", "Store", "Vehicle 1", "Vehicle 2", "Vehicle 3"];

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
  const [locationFilter, setLocationFilter] = useState("All");
  const [addOpen, setAddOpen] = useState(false);
  const [poOpen, setPoOpen] = useState(false);

  const filtered = inventory.filter((p) => {
    const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase()) || p.sku.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = categoryFilter === "All" || p.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  const totalValue = inventory.reduce((sum, p) => sum + p.total * p.unitCost, 0);
  const lowStock = inventory.filter((p) => p.status === "Low").length;
  const outOfStock = inventory.filter((p) => p.status === "Out").length;

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
            <DialogContent>
              <DialogHeader><DialogTitle>Add Product</DialogTitle></DialogHeader>
              <div className="space-y-4 pt-2">
                <div><Label>Name</Label><Input className="mt-1" placeholder="Product name" /></div>
                <div><Label>SKU</Label><Input className="mt-1" placeholder="SKU-123" /></div>
                <div className="grid grid-cols-2 gap-4">
                  <div><Label>Category</Label>
                    <Select><SelectTrigger className="mt-1"><SelectValue placeholder="Select" /></SelectTrigger>
                      <SelectContent>{categories.filter(c => c !== "All").map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div><Label>Unit Cost</Label><Input className="mt-1" type="number" placeholder="0.00" /></div>
                </div>
                <Button className="w-full bg-[#0891B2] text-white" onClick={() => setAddOpen(false)}>Save Product</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "Total SKUs", value: inventory.length, icon: Package, color: "text-[#0891B2]", bg: "bg-[#0891B2]/10" },
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
              <Select value={locationFilter} onValueChange={setLocationFilter}>
                <SelectTrigger className="h-10 w-40 bg-white border-[#E2E8F0]"><SelectValue placeholder="Location" /></SelectTrigger>
                <SelectContent>{locations.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}</SelectContent>
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
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-[#F1F5F9] flex items-center justify-center">
                            <Package className="w-4 h-4 text-[#64748B]" />
                          </div>
                          <span className="font-medium text-[#0F172A]">{p.name}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-[#64748B]">{p.sku}</td>
                      <td className="py-3 px-4"><Badge className="bg-[#F1F5F9] text-[#64748B] text-[10px] px-1.5 py-0">{p.category}</Badge></td>
                      <td className="text-right py-3 px-4 font-medium text-[#0F172A]">{p.storeQty}</td>
                      <td className="text-right py-3 px-4 text-[#64748B]">{p.v1Qty + p.v2Qty + p.v3Qty}</td>
                      <td className="text-right py-3 px-4 font-semibold text-[#0F172A]">{p.total}</td>
                      <td className="text-right py-3 px-4 text-[#64748B]">{p.reorder}</td>
                      <td className="text-right py-3 px-4 text-[#0F172A]">${p.unitCost.toFixed(2)}</td>
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
                    <th className="text-right py-3 px-4 text-xs font-semibold text-[#64748B] uppercase">Products</th>
                    <th className="text-right py-3 px-4 text-xs font-semibold text-[#64748B] uppercase">Lead Time</th>
                  </tr>
                </thead>
                <tbody>
                  {suppliers.map((s) => (
                    <tr key={s.id} className="border-b border-[#F1F5F9] last:border-0 hover:bg-[#F8FAFC]">
                      <td className="py-3 px-4 font-medium text-[#0F172A]">{s.name}</td>
                      <td className="py-3 px-4 text-[#64748B] text-sm">{s.contact}</td>
                      <td className="py-3 px-4 text-[#64748B] text-sm">{s.phone}</td>
                      <td className="text-right py-3 px-4 text-[#0F172A]">{s.products}</td>
                      <td className="text-right py-3 px-4"><Badge className="bg-[#0891B2]/10 text-[#0891B2] text-[10px] px-1.5 py-0">{s.leadTime}</Badge></td>
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
                  <div><Label>Supplier</Label>
                    <Select><SelectTrigger className="mt-1"><SelectValue placeholder="Select supplier" /></SelectTrigger>
                      <SelectContent>{suppliers.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <Button className="w-full bg-[#0891B2] text-white" onClick={() => setPoOpen(false)}>Create PO</Button>
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
                      <td className="py-3 px-4 text-[#64748B]">{po.supplier}</td>
                      <td className="text-right py-3 px-4 text-[#0F172A]">{po.items}</td>
                      <td className="text-right py-3 px-4 font-semibold text-[#0F172A]">${po.total.toLocaleString()}</td>
                      <td className="py-3 px-4 text-[#64748B]">{po.date}</td>
                      <td className="py-3 px-4 text-[#64748B]">{po.receivedDate || "—"}</td>
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
                      <td className="py-3 px-4 font-medium text-[#0F172A]">{v.product}</td>
                      <td className="text-right py-3 px-4 text-[#0F172A]">{v.expected}</td>
                      <td className="text-right py-3 px-4 text-[#0F172A]">{v.actual}</td>
                      <td className={`text-right py-3 px-4 font-semibold ${v.variance < -20 ? "text-[#DC2626]" : v.variance < 0 ? "text-[#F59E0B]" : "text-[#16A34A]"}`}>
                        {v.variance}%
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
    </div>
  );
}
