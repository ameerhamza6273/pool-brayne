import { useState, useMemo, useEffect, useCallback } from "react";
import {
  Search, ShoppingCart, Plus, Minus, Trash2, X, CreditCard,
  Banknote, FileText, Receipt, Percent, User, Package,
  TrendingUp, DollarSign, ScanLine, CheckCircle2, Printer,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { posApi, type SalesReport } from "@/lib/api/pos";
import { customersApi } from "@/lib/api/customers";
import type { Database } from "@/lib/database.types";

type InventoryItem = Database["public"]["Tables"]["inventory_items"]["Row"];
type PosOrder = Database["public"]["Tables"]["pos_orders"]["Row"] & { customers: { name: string } | null; item_count: number };

type Product = InventoryItem & { stock: number };

type CartItem = {
  id: string;
  name: string;
  sku: string;
  price: number;
  qty: number;
  taxable: boolean;
  unit: string;
};

const categoryColors: Record<string, string> = {
  "Chemicals": "bg-[#0891B2]/10 text-[#0891B2] border-[#0891B2]/20",
  "Test Kits": "bg-[#0E7490]/10 text-[#0E7490] border-[#0E7490]/20",
  "Accessories": "bg-[#16A34A]/10 text-[#16A34A] border-[#16A34A]/20",
  "Parts": "bg-[#F59E0B]/10 text-[#F59E0B] border-[#F59E0B]/20",
  "Equipment": "bg-[#F97316]/10 text-[#F97316] border-[#F97316]/20",
  "Services": "bg-[#7C3AED]/10 text-[#7C3AED] border-[#7C3AED]/20",
};

const TAX_RATE = 0.0825;

export default function PointOfSale() {
  const [isLoading, setIsLoading] = useState(true);
  const [products, setProducts] = useState<Product[]>([]);
  const [transactions, setTransactions] = useState<PosOrder[]>([]);
  const [customers, setCustomers] = useState<{ id: string; name: string }[]>([]);

  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [customerName, setCustomerName] = useState("Walk-in");
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [customerOpen, setCustomerOpen] = useState(false);
  const [customerSearch, setCustomerSearch] = useState("");
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<"Cash" | "Card" | "ACH" | null>(null);
  const [discount, setDiscount] = useState(0);
  const [discountType, setDiscountType] = useState<"percent" | "amount">("percent");
  const [discountOpen, setDiscountOpen] = useState(false);
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [completedSale, setCompletedSale] = useState<{
    number: string; total: number; payment: string; items: number;
  } | null>(null);

  const [reportStart, setReportStart] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().slice(0, 10);
  });
  const [reportEnd, setReportEnd] = useState(() => new Date().toISOString().slice(0, 10));
  const [report, setReport] = useState<SalesReport | null>(null);
  const [reportLoading, setReportLoading] = useState(false);

  const categories = ["All", "Chemicals", "Test Kits", "Accessories", "Parts", "Equipment", "Services"];

  const loadPos = useCallback(async () => {
    setIsLoading(true);
    const [productsData, transactionsData, customersData] = await Promise.all([
      posApi.catalog(),
      posApi.transactions(),
      customersApi.list(),
    ]);
    setProducts(productsData);
    setTransactions(transactionsData as PosOrder[]);
    setCustomers(customersData.map((c) => ({ id: c.id, name: c.name })));
    setIsLoading(false);
  }, []);

  const runReport = useCallback(async () => {
    setReportLoading(true);
    const data = await posApi.reports(reportStart, reportEnd);
    setReport(data);
    setReportLoading(false);
  }, [reportStart, reportEnd]);

  useEffect(() => {
    loadPos();
  }, [loadPos]);

  useEffect(() => {
    runReport();
  }, [runReport]);

  const filtered = products.filter((p) => {
    const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase()) || p.sku.toLowerCase().includes(search.toLowerCase());
    const matchesCat = category === "All" || p.category === category;
    return matchesSearch && matchesCat;
  });

  const filteredCustomers = ["Walk-in", ...customers.map((c) => c.name)].filter((n) => n.toLowerCase().includes(customerSearch.toLowerCase()));

  const subtotal = useMemo(() => cart.reduce((s, i) => s + i.price * i.qty, 0), [cart]);
  const discountAmount = useMemo(() => {
    if (discountType === "percent") return subtotal * (discount / 100);
    return Math.min(discount, subtotal);
  }, [subtotal, discount, discountType]);
  const taxableAmount = useMemo(() =>
    cart.filter((i) => i.taxable).reduce((s, i) => s + i.price * i.qty, 0) - (discountAmount * cart.filter((i) => i.taxable).length / Math.max(cart.length, 1)),
    [cart, discountAmount],
  );
  const tax = useMemo(() => Math.max(0, taxableAmount * TAX_RATE), [taxableAmount]);
  const total = useMemo(() => subtotal - discountAmount + tax, [subtotal, discountAmount, tax]);

  const addToCart = (p: Product) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.id === p.id);
      if (existing) return prev.map((i) => i.id === p.id ? { ...i, qty: i.qty + 1 } : i);
      return [...prev, { id: p.id, name: p.name, sku: p.sku, price: p.price ?? 0, qty: 1, taxable: p.taxable, unit: p.unit ?? "ea" }];
    });
  };

  const updateQty = (id: string, delta: number) => {
    setCart((prev) => prev.map((i) => i.id === id ? { ...i, qty: Math.max(1, i.qty + delta) } : i));
  };

  const removeItem = (id: string) => {
    setCart((prev) => prev.filter((i) => i.id !== id));
  };

  const clearCart = () => {
    setCart([]);
    setDiscount(0);
    setCustomerName("Walk-in");
    setCustomerId(null);
  };

  const completeSale = async () => {
    if (!paymentMethod) return;
    const num = `POS-${new Date().toISOString().slice(2, 10).replace(/-/g, "")}-${String(transactions.length + 1).padStart(3, "0")}`;

    await posApi.checkout({
      customerId,
      subtotal,
      tax,
      total,
      paymentMethod,
      items: cart.map((item) => ({
        id: item.id,
        name: item.name,
        qty: item.qty,
        price: item.price,
        isService: products.find((p) => p.id === item.id)?.category === "Services",
      })),
    });

    setCompletedSale({ number: num, total, payment: paymentMethod, items: cart.reduce((s, i) => s + i.qty, 0) });
    setPaymentOpen(false);
    setReceiptOpen(true);
    setCart([]);
    setDiscount(0);
    setCustomerName("Walk-in");
    setCustomerId(null);
    setPaymentMethod(null);
    loadPos();
  };

  const today = new Date().toISOString().slice(0, 10);
  const todaySales = transactions.filter((t) => t.created_at.slice(0, 10) === today).reduce((s, t) => s + t.total, 0);
  const weekSales = transactions.reduce((s, t) => s + t.total, 0);
  const avgTicket = transactions.length > 0 ? transactions.reduce((s, t) => s + t.total, 0) / transactions.length : 0;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#0F172A]">Point of Sale</h1>
          <p className="text-sm text-[#64748B] mt-0.5">Register — linked to inventory in real time</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" className="h-10 gap-2 border-[#E2E8F0] text-[#0F172A] bg-white">
            <FileText className="w-4 h-4" />
            <span className="hidden sm:inline">New Estimate (No Job)</span>
          </Button>
          <Button variant="outline" className="h-10 gap-2 border-[#E2E8F0] text-[#0F172A] bg-white">
            <ScanLine className="w-4 h-4" />
            <span className="hidden sm:inline">Scan Barcode</span>
          </Button>
          <div className="flex items-center gap-2 px-3 h-10 rounded-lg bg-[#0891B2]/10 border border-[#0891B2]/20">
            <Receipt className="w-4 h-4 text-[#0891B2]" />
            <span className="text-sm font-medium text-[#0891B2]">Register #1 — Open</span>
          </div>
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "Today's Sales", value: `$${todaySales.toFixed(2)}`, icon: DollarSign, color: "#0891B2" },
          { label: "Week Sales", value: `$${weekSales.toFixed(2)}`, icon: TrendingUp, color: "#16A34A" },
          { label: "Avg Ticket", value: `$${avgTicket.toFixed(2)}`, icon: Receipt, color: "#F59E0B" },
          { label: "Transactions", value: transactions.length.toString(), icon: ShoppingCart, color: "#7C3AED" },
        ].map((k) => {
          const Icon = k.icon;
          return (
            <div key={k.label} className="bg-white rounded-xl p-4 border border-[#E2E8F0] shadow-sm flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${k.color}1a` }}>
                <Icon className="w-5 h-5" style={{ color: k.color }} />
              </div>
              <div>
                <p className="text-xs text-[#64748B] font-medium">{k.label}</p>
                <p className="text-lg font-bold text-[#0F172A]">{k.value}</p>
              </div>
            </div>
          );
        })}
      </div>

      {isLoading && <div className="text-center py-8 text-[#64748B]">Loading register...</div>}

      {!isLoading && (
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Product Grid */}
        <div className="lg:col-span-3 bg-white rounded-xl border border-[#E2E8F0] shadow-sm overflow-hidden">
          <div className="p-4 border-b border-[#E2E8F0] space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#64748B]" />
              <Input
                placeholder="Search by name or SKU..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-10 bg-[#F8FAFC] border-[#E2E8F0]"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              {categories.map((c) => (
                <button
                  key={c}
                  onClick={() => setCategory(c)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    category === c
                      ? "bg-[#0891B2] text-white"
                      : "bg-[#F8FAFC] text-[#64748B] hover:bg-[#E2E8F0] border border-[#E2E8F0]"
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          <div className="p-4 max-h-[560px] overflow-y-auto">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {filtered.map((p) => {
                const isService = p.category === "Services";
                const out = !isService && p.stock === 0;
                return (
                  <button
                    key={p.id}
                    onClick={() => !out && addToCart(p)}
                    disabled={out}
                    className={`text-left p-3 rounded-xl border transition-all ${
                      out
                        ? "bg-[#F1F5F9] border-[#E2E8F0] opacity-50 cursor-not-allowed"
                        : "bg-white border-[#E2E8F0] hover:border-[#0891B2] hover:shadow-md active:scale-[0.98] cursor-pointer"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <Badge className={`${categoryColors[p.category] || "bg-[#F8FAFC] text-[#64748B] border-[#E2E8F0]"} text-[10px] px-1.5 py-0`}>
                        {p.category}
                      </Badge>
                      {out ? (
                        <Badge className="bg-[#DC2626]/10 text-[#DC2626] text-[10px] px-1.5 py-0">Out</Badge>
                      ) : isService ? (
                        <Badge className="bg-[#7C3AED]/10 text-[#7C3AED] text-[10px] px-1.5 py-0">Service</Badge>
                      ) : p.stock <= 5 ? (
                        <Badge className="bg-[#F59E0B]/10 text-[#F59E0B] text-[10px] px-1.5 py-0">Low: {p.stock}</Badge>
                      ) : (
                        <span className="text-[10px] text-[#64748B] font-medium">{p.stock} in stock</span>
                      )}
                    </div>
                    <p className="text-sm font-semibold text-[#0F172A] leading-snug mb-1 line-clamp-2">{p.name}</p>
                    <p className="text-[10px] text-[#64748B] font-mono">{p.sku}</p>
                    <p className="text-base font-bold text-[#0891B2] mt-2">${(p.price ?? 0).toFixed(2)}</p>
                  </button>
                );
              })}
            </div>
            {filtered.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 text-[#64748B]">
                <Package className="w-10 h-10 mb-3 opacity-40" />
                <p className="text-sm">No products match your search</p>
              </div>
            )}
          </div>
        </div>

        {/* Cart Panel */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-[#E2E8F0] shadow-sm flex flex-col max-h-[660px]">
          {/* Cart Header */}
          <div className="p-4 border-b border-[#E2E8F0] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShoppingCart className="w-5 h-5 text-[#0891B2]" />
              <h3 className="font-semibold text-[#0F172A]">Current Sale</h3>
              {cart.length > 0 && (
                <Badge className="bg-[#0891B2] text-white">{cart.reduce((s, i) => s + i.qty, 0)}</Badge>
              )}
            </div>
            {cart.length > 0 && (
              <button onClick={clearCart} className="text-xs text-[#DC2626] font-medium hover:underline flex items-center gap-1">
                <Trash2 className="w-3.5 h-3.5" /> Clear
              </button>
            )}
          </div>

          {/* Customer selector */}
          <div className="px-4 py-3 border-b border-[#E2E8F0]">
            <button
              onClick={() => setCustomerOpen(true)}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0] hover:bg-[#F1F5F9] text-left"
            >
              <User className="w-4 h-4 text-[#64748B]" />
              <span className="text-sm font-medium text-[#0F172A] flex-1 truncate">{customerName}</span>
              <Plus className="w-4 h-4 text-[#0891B2]" />
            </button>
          </div>

          {/* Cart Items */}
          <div className="flex-1 overflow-y-auto p-4">
            {cart.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-[#64748B] py-12">
                <ShoppingCart className="w-12 h-12 mb-3 opacity-30" />
                <p className="text-sm font-medium">Cart is empty</p>
                <p className="text-xs mt-1">Click products to add them</p>
              </div>
            ) : (
              <div className="space-y-3">
                {cart.map((item) => (
                  <div key={item.id} className="flex items-center gap-2 py-2 border-b border-[#F1F5F9] last:border-0">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[#0F172A] truncate">{item.name}</p>
                      <p className="text-xs text-[#64748B]">${item.price.toFixed(2)} / {item.unit}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button onClick={() => updateQty(item.id, -1)} className="w-7 h-7 rounded-md bg-[#F8FAFC] border border-[#E2E8F0] flex items-center justify-center hover:bg-[#E2E8F0]">
                        <Minus className="w-3.5 h-3.5 text-[#0F172A]" />
                      </button>
                      <span className="w-8 text-center text-sm font-semibold text-[#0F172A]">{item.qty}</span>
                      <button onClick={() => updateQty(item.id, 1)} className="w-7 h-7 rounded-md bg-[#F8FAFC] border border-[#E2E8F0] flex items-center justify-center hover:bg-[#E2E8F0]">
                        <Plus className="w-3.5 h-3.5 text-[#0F172A]" />
                      </button>
                    </div>
                    <div className="w-20 text-right">
                      <p className="text-sm font-bold text-[#0F172A]">${(item.price * item.qty).toFixed(2)}</p>
                    </div>
                    <button onClick={() => removeItem(item.id)} className="text-[#DC2626] hover:bg-[#DC2626]/10 p-1 rounded">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Totals & Checkout */}
          {cart.length > 0 && (
            <div className="border-t border-[#E2E8F0] p-4 space-y-3">
              <div className="space-y-1.5 text-sm">
                <div className="flex justify-between text-[#64748B]">
                  <span>Subtotal</span>
                  <span className="font-medium text-[#0F172A]">${subtotal.toFixed(2)}</span>
                </div>
                {discountAmount > 0 && (
                  <div className="flex justify-between text-[#16A34A]">
                    <span>Discount {discountType === "percent" ? `(${discount}%)` : ""}</span>
                    <span className="font-medium">-${discountAmount.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between text-[#64748B]">
                  <span>Tax (8.25%)</span>
                  <span className="font-medium text-[#0F172A]">${tax.toFixed(2)}</span>
                </div>
                <div className="flex justify-between pt-2 border-t border-[#E2E8F0]">
                  <span className="font-semibold text-[#0F172A]">Total</span>
                  <span className="text-xl font-bold text-[#0891B2]">${total.toFixed(2)}</span>
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="h-9 gap-1.5 border-[#E2E8F0] text-[#0F172A] flex-1"
                  onClick={() => setDiscountOpen(true)}
                >
                  <Percent className="w-4 h-4" /> Discount
                </Button>
                <Button
                  className="h-12 gap-2 bg-[#0891B2] hover:bg-[#0E7490] text-white flex-[2]"
                  onClick={() => setPaymentOpen(true)}
                >
                  <CreditCard className="w-5 h-5" />
                  Charge ${total.toFixed(2)}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
      )}

      {/* Recent Transactions */}
      <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-sm overflow-hidden">
        <div className="p-4 border-b border-[#E2E8F0] flex items-center justify-between">
          <h3 className="font-semibold text-[#0F172A]">Recent Transactions</h3>
          <Badge className="bg-[#F8FAFC] text-[#64748B] border border-[#E2E8F0]">Last 8</Badge>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
                <th className="text-left py-3 px-4 text-xs font-semibold text-[#64748B] uppercase">Date</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-[#64748B] uppercase">Customer</th>
                <th className="text-right py-3 px-4 text-xs font-semibold text-[#64728B] uppercase">Items</th>
                <th className="text-right py-3 px-4 text-xs font-semibold text-[#64748B] uppercase">Subtotal</th>
                <th className="text-right py-3 px-4 text-xs font-semibold text-[#64748B] uppercase">Tax</th>
                <th className="text-right py-3 px-4 text-xs font-semibold text-[#64748B] uppercase">Total</th>
                <th className="text-center py-3 px-4 text-xs font-semibold text-[#64748B] uppercase">Payment</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((tx) => (
                <tr key={tx.id} className="border-b border-[#F1F5F9] last:border-0 hover:bg-[#F8FAFC]">
                  <td className="py-3 px-4 text-[#64748B]">{new Date(tx.created_at).toLocaleString([], { dateStyle: "short", timeStyle: "short" })}</td>
                  <td className="py-3 px-4 font-medium text-[#0F172A]">{tx.customers?.name ?? "Walk-in"}</td>
                  <td className="py-3 px-4 text-right text-[#0F172A]">{tx.item_count}</td>
                  <td className="py-3 px-4 text-right text-[#0F172A]">${tx.subtotal.toFixed(2)}</td>
                  <td className="py-3 px-4 text-right text-[#0F172A]">${tx.tax.toFixed(2)}</td>
                  <td className="py-3 px-4 text-right font-semibold text-[#0F172A]">${tx.total.toFixed(2)}</td>
                  <td className="py-3 px-4 text-center">
                    <Badge className={`text-[10px] px-2 py-0 ${tx.payment_method === "Cash" ? "bg-[#16A34A]/10 text-[#16A34A]" : tx.payment_method === "Card" ? "bg-[#0891B2]/10 text-[#0891B2]" : "bg-[#7C3AED]/10 text-[#7C3AED]"}`}>{tx.payment_method}</Badge>
                  </td>
                </tr>
              ))}
              {transactions.length === 0 && (
                <tr><td colSpan={7} className="py-8 text-center text-[#64748B]">No transactions yet</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Sales Reports (client request 2026-08-27): date-range qty sold + sales tax report */}
      <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-sm overflow-hidden">
        <div className="p-4 border-b border-[#E2E8F0] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h3 className="font-semibold text-[#0F172A]">Sales Reports</h3>
          <div className="flex items-center gap-2">
            <Input type="date" className="h-9 w-auto" value={reportStart} onChange={(e) => setReportStart(e.target.value)} />
            <span className="text-[#64748B] text-sm">to</span>
            <Input type="date" className="h-9 w-auto" value={reportEnd} onChange={(e) => setReportEnd(e.target.value)} />
          </div>
        </div>
        {reportLoading && <div className="p-4 text-center text-[#64748B] text-sm">Loading report...</div>}
        {!reportLoading && report && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-0">
            <div className="lg:col-span-2 p-4 border-b lg:border-b-0 lg:border-r border-[#E2E8F0]">
              <p className="text-xs font-semibold text-[#64748B] uppercase mb-3">Quantity Sold by Product</p>
              <div className="overflow-x-auto max-h-72 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[#E2E8F0]">
                      <th className="text-left py-2 text-xs font-semibold text-[#64748B] uppercase">Product</th>
                      <th className="text-right py-2 text-xs font-semibold text-[#64748B] uppercase">Qty Sold</th>
                      <th className="text-right py-2 text-xs font-semibold text-[#64748B] uppercase">Revenue</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.qtyByProduct.map((row) => (
                      <tr key={row.description} className="border-b border-[#F1F5F9] last:border-0">
                        <td className="py-2 text-[#0F172A]">{row.description}</td>
                        <td className="py-2 text-right text-[#0F172A]">{row.qty}</td>
                        <td className="py-2 text-right text-[#0F172A]">${Number(row.revenue).toFixed(2)}</td>
                      </tr>
                    ))}
                    {report.qtyByProduct.length === 0 && (
                      <tr><td colSpan={3} className="py-6 text-center text-[#64748B]">No sales in this date range</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="p-4 space-y-3">
              <p className="text-xs font-semibold text-[#64748B] uppercase">Sales Tax Report</p>
              <div className="flex justify-between text-sm"><span className="text-[#64748B]">Orders</span><span className="font-medium text-[#0F172A]">{report.taxSummary.orderCount}</span></div>
              <div className="flex justify-between text-sm"><span className="text-[#64748B]">Taxable Sales</span><span className="font-medium text-[#0F172A]">${report.taxSummary.taxableSales.toFixed(2)}</span></div>
              <div className="flex justify-between text-sm"><span className="text-[#64748B]">Tax Collected</span><span className="font-medium text-[#0F172A]">${report.taxSummary.taxCollected.toFixed(2)}</span></div>
              <div className="flex justify-between text-sm pt-2 border-t border-[#E2E8F0]"><span className="font-semibold text-[#0F172A]">Total Sales</span><span className="font-bold text-[#0891B2]">${report.taxSummary.totalSales.toFixed(2)}</span></div>
            </div>
          </div>
        )}
      </div>

      {/* Customer Dialog */}
      <Dialog open={customerOpen} onOpenChange={setCustomerOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Attach Customer</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#64748B]" />
              <Input placeholder="Search customers..." className="pl-9" autoFocus value={customerSearch} onChange={(e) => setCustomerSearch(e.target.value)} />
            </div>
            <div className="space-y-1 max-h-60 overflow-y-auto">
              {filteredCustomers.map((name) => (
                <button
                  key={name}
                  onClick={() => {
                    setCustomerName(name);
                    setCustomerId(name === "Walk-in" ? null : customers.find((c) => c.name === name)?.id ?? null);
                    setCustomerOpen(false);
                    setCustomerSearch("");
                  }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-[#F8FAFC] text-left"
                >
                  <Avatar className="w-8 h-8">
                    <AvatarFallback className="bg-[#0891B2] text-white text-xs">
                      {name === "Walk-in" ? "WI" : name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-sm font-medium text-[#0F172A]">{name}</span>
                  {customerName === name && <CheckCircle2 className="w-4 h-4 text-[#16A34A] ml-auto" />}
                </button>
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Discount Dialog */}
      <Dialog open={discountOpen} onOpenChange={setDiscountOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Apply Discount</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setDiscountType("percent")}
                className={`py-2.5 rounded-lg border text-sm font-medium ${discountType === "percent" ? "border-[#0891B2] bg-[#0891B2]/10 text-[#0891B2]" : "border-[#E2E8F0] text-[#64748B]"}`}
              >
                Percentage %
              </button>
              <button
                onClick={() => setDiscountType("amount")}
                className={`py-2.5 rounded-lg border text-sm font-medium ${discountType === "amount" ? "border-[#0891B2] bg-[#0891B2]/10 text-[#0891B2]" : "border-[#E2E8F0] text-[#64748B]"}`}
              >
                Dollar $
              </button>
            </div>
            <div>
              <Label>{discountType === "percent" ? "Percent off (%)" : "Amount off ($)"}</Label>
              <Input
                type="number"
                value={discount || ""}
                onChange={(e) => setDiscount(Math.max(0, Number(e.target.value)))}
                placeholder="0"
                className="mt-1.5"
              />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => { setDiscount(0); setDiscountOpen(false); }}>Clear</Button>
              <Button className="flex-1 bg-[#0891B2] hover:bg-[#0E7490] text-white" onClick={() => setDiscountOpen(false)}>Apply</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Payment Dialog */}
      <Dialog open={paymentOpen} onOpenChange={setPaymentOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Take Payment</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="bg-[#F8FAFC] rounded-xl p-4 text-center">
              <p className="text-sm text-[#64748B] font-medium">Amount Due</p>
              <p className="text-3xl font-bold text-[#0891B2] mt-1">${total.toFixed(2)}</p>
              <p className="text-xs text-[#64748B] mt-1">{cart.reduce((s, i) => s + i.qty, 0)} items · {customerName}</p>
            </div>
            <div>
              <Label className="mb-2 block">Payment Method</Label>
              <div className="grid grid-cols-3 gap-2">
                {([
                  { key: "Cash", icon: Banknote, label: "Cash" },
                  { key: "Card", icon: CreditCard, label: "Card" },
                  { key: "ACH", icon: FileText, label: "ACH" },
                ] as const).map((m) => {
                  const Icon = m.icon;
                  return (
                    <button
                      key={m.key}
                      onClick={() => setPaymentMethod(m.key)}
                      className={`flex flex-col items-center gap-1.5 py-4 rounded-xl border transition-all ${
                        paymentMethod === m.key
                          ? "border-[#0891B2] bg-[#0891B2]/10 text-[#0891B2]"
                          : "border-[#E2E8F0] text-[#64748B] hover:bg-[#F8FAFC]"
                      }`}
                    >
                      <Icon className="w-6 h-6" />
                      <span className="text-sm font-medium">{m.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
            <Button
              className="w-full h-12 bg-[#0891B2] hover:bg-[#0E7490] text-white gap-2"
              disabled={!paymentMethod}
              onClick={completeSale}
            >
              <CheckCircle2 className="w-5 h-5" />
              Complete Sale · ${total.toFixed(2)}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Receipt Dialog */}
      <Dialog open={receiptOpen} onOpenChange={setReceiptOpen}>
        <DialogContent className="sm:max-w-sm">
          <div className="text-center py-4">
            <div className="w-16 h-16 rounded-full bg-[#16A34A]/10 flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-9 h-9 text-[#16A34A]" />
            </div>
            <h2 className="text-xl font-bold text-[#0F172A]">Sale Complete</h2>
            <p className="text-sm text-[#64748B] mt-1">Receipt {completedSale?.number}</p>
            <div className="bg-[#F8FAFC] rounded-xl p-4 mt-4 space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-[#64748B]">Items</span><span className="font-medium text-[#0F172A]">{completedSale?.items}</span></div>
              <div className="flex justify-between"><span className="text-[#64748B]">Payment</span><span className="font-medium text-[#0F172A]">{completedSale?.payment}</span></div>
              <div className="flex justify-between pt-2 border-t border-[#E2E8F0]"><span className="font-semibold text-[#0F172A]">Total</span><span className="font-bold text-[#0891B2]">${completedSale?.total.toFixed(2)}</span></div>
            </div>
            <p className="text-xs text-[#64748B] mt-3">Inventory levels updated automatically.</p>
            <div className="flex gap-2 mt-5">
              <Button variant="outline" className="flex-1 gap-2" onClick={() => setReceiptOpen(false)}>
                <Printer className="w-4 h-4" /> Print
              </Button>
              <Button className="flex-1 bg-[#0891B2] hover:bg-[#0E7490] text-white gap-2" onClick={() => setReceiptOpen(false)}>
                New Sale <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
