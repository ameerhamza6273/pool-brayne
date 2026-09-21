import { useState, useMemo, useEffect, useCallback } from "react";
import {
  Search, ShoppingCart, Plus, Minus, Trash2, X, CreditCard,
  Banknote, FileText, Receipt, Percent, User, Package,
  TrendingUp, DollarSign, CheckCircle2, Printer,
  ArrowRight, RotateCcw, PackagePlus, LayoutGrid, Table2, Star,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { posApi, type SalesReport } from "@/lib/api/pos";
import { customersApi } from "@/lib/api/customers";
import CardPaymentForm from "@/components/CardPaymentForm";
import { useLanguage } from "@/lib/language-context";
import { matchesQuery } from "@/lib/search";
import type { Database } from "@/lib/database.types";

type InventoryItem = Database["public"]["Tables"]["inventory_items"]["Row"];
type PosOrder = Database["public"]["Tables"]["pos_orders"]["Row"] & { customers: { name: string } | null; item_count: number };

type Product = InventoryItem & { stock: number };

type CartItem = {
  id: string | null;
  name: string;
  sku: string;
  price: number;
  qty: number;
  taxable: boolean;
  unit: string;
  serial?: string;
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
  const { t } = useLanguage();
  const [isLoading, setIsLoading] = useState(true);
  const [products, setProducts] = useState<Product[]>([]);
  const [transactions, setTransactions] = useState<PosOrder[]>([]);
  const [customers, setCustomers] = useState<{ id: string; name: string; address: string | null }[]>([]);

  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [manufacturer, setManufacturer] = useState("All");
  // Client PDF 2026-09-18: "make the spreadsheet look the default option in all fields" — list
  // (spreadsheet-like) is now the default everywhere this grid/list toggle exists; grid stays an
  // option for staff who prefer it.
  const [productView, setProductView] = useState<"grid" | "list">("list");
  // Client PDF 2026-09-18: star categories/manufacturers as favorites for quick one-click access
  // instead of scrolling the full dropdown every time. Persisted per-browser (localStorage) since
  // it's a personal UI convenience, not shared business data.
  const [favoriteCategories, setFavoriteCategories] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem("pos_favorite_categories") ?? "[]"); } catch { return []; }
  });
  const [favoriteManufacturers, setFavoriteManufacturers] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem("pos_favorite_manufacturers") ?? "[]"); } catch { return []; }
  });
  const toggleFavoriteCategory = (c: string) => {
    setFavoriteCategories((prev) => {
      const next = prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c];
      try { localStorage.setItem("pos_favorite_categories", JSON.stringify(next)); } catch { /* private-window storage block */ }
      return next;
    });
  };
  const toggleFavoriteManufacturer = (m: string) => {
    setFavoriteManufacturers((prev) => {
      const next = prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m];
      try { localStorage.setItem("pos_favorite_manufacturers", JSON.stringify(next)); } catch { /* private-window storage block */ }
      return next;
    });
  };
  // Client request 2026-09-04: the product grid rendered every catalog item at once (2,500+
  // after the real inventory import) -- same pagination fix applied to Inventory/Customers.
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 60;
  const [cart, setCart] = useState<CartItem[]>([]);
  const [saleNote, setSaleNote] = useState("");
  const [customerName, setCustomerName] = useState("Walk-in");
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [customerOpen, setCustomerOpen] = useState(false);
  const [customerSearch, setCustomerSearch] = useState("");
  const [paymentOpen, setPaymentOpen] = useState(false);
  // Client request 2026-09-03: "Allow us to use more than one payment type or multiple credit
  // card" — a sale can be tendered across several lines (e.g. part cash, part card) instead of
  // one single method.
  const [tenderLines, setTenderLines] = useState<{ method: "Cash" | "Card" | "ACH" | "Check"; amount: number; opaqueData?: { dataDescriptor: string; dataValue: string } }[]>([]);
  const [tenderMethod, setTenderMethod] = useState<"Cash" | "Card" | "ACH" | "Check">("Cash");
  const [tenderAmount, setTenderAmount] = useState("");
  const [discount, setDiscount] = useState(0);
  const [discountType, setDiscountType] = useState<"percent" | "amount">("percent");
  const [discountOpen, setDiscountOpen] = useState(false);
  const [receiptOpen, setReceiptOpen] = useState(false);
  // Client request 2026-09-02: sell items not in stock (inventory can go negative), sell a
  // negative quantity as a return, and ring up non-stock/material items that aren't in the
  // catalog at all.
  const [returnMode, setReturnMode] = useState(false);
  const [customItemOpen, setCustomItemOpen] = useState(false);
  const [customItem, setCustomItem] = useState({ description: "", price: "", qty: "1" });
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

  // Client PDF 2026-09-18: "set category on the pos section to match our inventory list" — this
  // used to be a hardcoded 6-value list; now derived from the real catalog, same pattern as
  // Inventory's dynamicCategories.
  const categories = ["All", ...Array.from(new Set(products.map((p) => p.category).filter(Boolean))).sort()];
  const manufacturers = ["All", ...Array.from(new Set(products.map((p) => p.manufacturer).filter((m): m is string => Boolean(m)))).sort()];

  const loadPos = useCallback(async () => {
    setIsLoading(true);
    const [productsData, transactionsData, customersData] = await Promise.all([
      posApi.catalog(),
      posApi.transactions(),
      customersApi.list(),
    ]);
    setProducts(productsData);
    setTransactions(transactionsData as PosOrder[]);
    setCustomers(customersData.map((c) => ({ id: c.id, name: c.name, address: c.address })));
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
    const matchesSearch = matchesQuery(search, [p.name, p.sku, p.item_number != null ? String(p.item_number) : null, p.short_description, p.long_description, p.manufacturer, p.category]);
    const matchesCat = category === "All" || p.category === category;
    const matchesManufacturer = manufacturer === "All" || p.manufacturer === manufacturer;
    return matchesSearch && matchesCat && matchesManufacturer;
  });
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginatedProducts = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  useEffect(() => {
    setPage(1);
  }, [search, category, manufacturer]);

  // Client request 2026-09-04: the Attach Customer dialog rendered all 3,600+ customer names as
  // buttons the moment it opened (before any search text was typed) -- capped to a manageable
  // result count, same issue class as the Catalog/Customers/Valuation pagination fixes above.
  const filteredCustomers = customerSearch.trim()
    ? ["Walk-in", ...customers.map((c) => c.name)].filter((n) => n.toLowerCase().includes(customerSearch.toLowerCase())).slice(0, 25)
    : ["Walk-in"];

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
    const direction = returnMode ? -1 : 1;
    setCart((prev) => {
      const existing = prev.find((i) => i.id === p.id);
      if (existing) return prev.map((i) => i.id === p.id ? { ...i, qty: i.qty + direction } : i);
      return [...prev, { id: p.id, name: p.name, sku: p.sku, price: p.price ?? 0, qty: direction, taxable: p.taxable, unit: p.unit ?? "ea" }];
    });
  };

  const addCustomItem = () => {
    const price = parseFloat(customItem.price) || 0;
    const qty = parseInt(customItem.qty, 10) || 1;
    if (!customItem.description || price <= 0) return;
    setCart((prev) => [...prev, { id: null, name: customItem.description, sku: "CUSTOM", price, qty: returnMode ? -Math.abs(qty) : qty, taxable: true, unit: "ea" }]);
    setCustomItem({ description: "", price: "", qty: "1" });
    setCustomItemOpen(false);
  };

  // No floor — a return line can go further negative, and a line hitting exactly 0 is removed.
  const updateQty = (id: string | null, index: number, delta: number) => {
    setCart((prev) => prev
      .map((i, idx) => (idx === index && i.id === id ? { ...i, qty: i.qty + delta } : i))
      .filter((i) => i.qty !== 0));
  };

  const removeItem = (index: number) => {
    setCart((prev) => prev.filter((_, idx) => idx !== index));
  };

  const clearCart = () => {
    setCart([]);
    setDiscount(0);
    setCustomerName("Walk-in");
    setCustomerId(null);
  };

  const remainingTender = total - tenderLines.reduce((s, t) => s + t.amount, 0);
  // Client SMS 2026-09-21: returns/exchanges (negative total) couldn't be closed out -- the
  // payment section was hidden and every amount check assumed a positive balance.
  const isRefund = total < -0.01;
  const round2 = (n: number) => Math.round(n * 100) / 100;
  const money = (n: number) => `${n < 0 ? "-" : ""}$${Math.abs(n).toFixed(2)}`;
  // Full payment is the default: with nothing "Add"ed yet, Complete Sale takes the whole total
  // with the selected method (Card still goes through its own form). Once a partial has been
  // added, the remainder must be covered explicitly, same as before.
  const canComplete = Math.abs(remainingTender) <= 0.01
    ? true
    : tenderLines.length === 0 && tenderMethod !== "Card";

  const addCashTender = () => {
    const amt = parseFloat(tenderAmount);
    if (!amt) return;
    // Capped at what's still due (sign follows the sale) so an over-typed amount can't strand
    // the sale with a negative "remaining" that never reaches zero.
    const capped = round2(Math.min(Math.abs(amt), Math.abs(remainingTender)));
    if (capped <= 0) return;
    setTenderLines((prev) => [...prev, { method: tenderMethod, amount: remainingTender < 0 ? -capped : capped }]);
    setTenderAmount("");
  };

  const addCardTender = (amount: number, opaqueData: { dataDescriptor: string; dataValue: string }) => {
    setTenderLines((prev) => [...prev, { method: "Card", amount, opaqueData }]);
    setTenderAmount("");
  };

  const removeTender = (index: number) => setTenderLines((prev) => prev.filter((_, i) => i !== index));

  const completeSale = async () => {
    if (!canComplete) return;
    let lines = tenderLines;
    if (Math.abs(remainingTender) > 0.01) {
      lines = [{ method: tenderMethod, amount: round2(total) }];
    } else if (lines.length === 0) {
      // Even exchange (net $0): the order still needs one payment row.
      lines = [{ method: "Cash", amount: 0 }];
    }
    const num = `POS-${new Date().toISOString().slice(2, 10).replace(/-/g, "")}-${String(transactions.length + 1).padStart(3, "0")}`;
    const paymentLabel = lines.length > 1 ? `Split (${lines.map((t) => t.method).join(" + ")})` : lines[0].method;

    await posApi.checkout({
      customerId,
      subtotal,
      tax,
      total,
      note: saleNote.trim() || null,
      payments: lines.map((t) => ({ method: t.method, amount: t.amount, opaqueData: t.opaqueData })),
      items: cart.map((item) => ({
        id: item.id,
        name: item.name,
        qty: item.qty,
        price: item.price,
        isService: products.find((p) => p.id === item.id)?.category === "Services",
        serialNumber: item.serial || null,
      })),
    });

    setCompletedSale({ number: num, total, payment: paymentLabel, items: cart.reduce((s, i) => s + i.qty, 0) });
    setPaymentOpen(false);
    setReceiptOpen(true);
    setCart([]);
    setDiscount(0);
    setCustomerName("Walk-in");
    setCustomerId(null);
    setTenderLines([]);
    setTenderAmount("");
    setSaleNote("");
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
          <h1 className="text-2xl font-bold text-[#0F172A]">{t("Point of Sale")}</h1>
          <p className="text-sm text-[#64748B] mt-0.5">{t("Register — linked to inventory in real time")}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            className={`h-10 gap-2 border-[#E2E8F0] bg-white ${returnMode ? "bg-[#DC2626]/10 border-[#DC2626] text-[#DC2626]" : "text-[#0F172A]"}`}
            onClick={() => setReturnMode((v) => !v)}
          >
            <RotateCcw className="w-4 h-4" />
            <span className="hidden sm:inline">{returnMode ? t("Return Mode: On") : t("Return Mode")}</span>
          </Button>
          <Dialog open={customItemOpen} onOpenChange={setCustomItemOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="h-10 gap-2 border-[#E2E8F0] text-[#0F172A] bg-white">
                <PackagePlus className="w-4 h-4" />
                <span className="hidden sm:inline">{t("Custom Item")}</span>
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-sm max-h-[90vh] overflow-y-auto">
              <DialogHeader><DialogTitle>{t("Add Non-Stock Item")}</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div><Label>{t("Description")}</Label><Input className="mt-1" placeholder={t("e.g. Special order material")} value={customItem.description} onChange={(e) => setCustomItem((p) => ({ ...p, description: e.target.value }))} /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>{t("Price")}</Label><Input type="number" className="mt-1" placeholder="0.00" value={customItem.price} onChange={(e) => setCustomItem((p) => ({ ...p, price: e.target.value }))} /></div>
                  <div><Label>{t("Qty")}</Label><Input type="number" className="mt-1" value={customItem.qty} onChange={(e) => setCustomItem((p) => ({ ...p, qty: e.target.value }))} /></div>
                </div>
                <Button className="w-full bg-[#0891B2] text-white" onClick={addCustomItem}>{t("Add to Cart")}</Button>
              </div>
            </DialogContent>
          </Dialog>
          <div className="flex items-center gap-2 px-3 h-10 rounded-lg bg-[#0891B2]/10 border border-[#0891B2]/20">
            <Receipt className="w-4 h-4 text-[#0891B2]" />
            <span className="text-sm font-medium text-[#0891B2]">{t("Register #1 — Open")}</span>
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
                <p className="text-xs text-[#64748B] font-medium">{t(k.label)}</p>
                <p className="text-lg font-bold text-[#0F172A]">{k.value}</p>
              </div>
            </div>
          );
        })}
      </div>

      {isLoading && <div className="text-center py-8 text-[#64748B]">{t("Loading register...")}</div>}

      {!isLoading && (
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Product Grid */}
        <div className="lg:col-span-3 bg-white rounded-xl border border-[#E2E8F0] shadow-sm overflow-hidden">
          <div className="p-4 border-b border-[#E2E8F0] space-y-3">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#64748B]" />
                <Input
                  placeholder={t("Search item #, name, SKU, description, category, or manufacturer...")}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9 h-10 bg-[#F8FAFC] border-[#E2E8F0]"
                />
              </div>
              <div className="flex items-center gap-1 border border-[#E2E8F0] rounded-lg p-1 shrink-0">
                <button
                  onClick={() => setProductView("grid")}
                  className={`p-1.5 rounded ${productView === "grid" ? "bg-[#0891B2]/10 text-[#0891B2]" : "text-[#64748B] hover:bg-[#F8FAFC]"}`}
                  title={t("Grid view")}
                >
                  <LayoutGrid className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setProductView("list")}
                  className={`p-1.5 rounded ${productView === "list" ? "bg-[#0891B2]/10 text-[#0891B2]" : "text-[#64748B] hover:bg-[#F8FAFC]"}`}
                  title={t("List view")}
                >
                  <Table2 className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="h-9 w-44 bg-white border-[#E2E8F0] shrink-0"><SelectValue placeholder={t("Category")} /></SelectTrigger>
                <SelectContent className="max-h-72">
                  {categories.map((c) => <SelectItem key={c} value={c}>{c === "All" ? t("All Categories") : c}</SelectItem>)}
                </SelectContent>
              </Select>
              {category !== "All" && (
                <button
                  type="button"
                  title={favoriteCategories.includes(category) ? t("Remove from favorites") : t("Star as favorite")}
                  onClick={() => toggleFavoriteCategory(category)}
                  className="p-1.5 rounded hover:bg-[#F8FAFC] shrink-0"
                >
                  <Star className={`w-4 h-4 ${favoriteCategories.includes(category) ? "fill-[#F59E0B] text-[#F59E0B]" : "text-[#64748B]"}`} />
                </button>
              )}
              {favoriteCategories.filter((c) => categories.includes(c)).map((c) => (
                <button
                  key={c}
                  onClick={() => setCategory(c)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-1 ${
                    category === c ? "bg-[#0891B2] text-white" : "bg-[#F8FAFC] text-[#64748B] hover:bg-[#E2E8F0] border border-[#E2E8F0]"
                  }`}
                >
                  <Star className="w-3 h-3 fill-current" /> {c}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Select value={manufacturer} onValueChange={setManufacturer}>
                <SelectTrigger className="h-9 w-44 bg-white border-[#E2E8F0] shrink-0"><SelectValue placeholder={t("Manufacturer")} /></SelectTrigger>
                <SelectContent className="max-h-72">
                  {manufacturers.map((m) => <SelectItem key={m} value={m}>{m === "All" ? t("All Manufacturers") : m}</SelectItem>)}
                </SelectContent>
              </Select>
              {manufacturer !== "All" && (
                <button
                  type="button"
                  title={favoriteManufacturers.includes(manufacturer) ? t("Remove from favorites") : t("Star as favorite")}
                  onClick={() => toggleFavoriteManufacturer(manufacturer)}
                  className="p-1.5 rounded hover:bg-[#F8FAFC] shrink-0"
                >
                  <Star className={`w-4 h-4 ${favoriteManufacturers.includes(manufacturer) ? "fill-[#F59E0B] text-[#F59E0B]" : "text-[#64748B]"}`} />
                </button>
              )}
              {favoriteManufacturers.filter((m) => manufacturers.includes(m)).map((m) => (
                <button
                  key={m}
                  onClick={() => setManufacturer(m)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-1 ${
                    manufacturer === m ? "bg-[#0891B2] text-white" : "bg-[#F8FAFC] text-[#64748B] hover:bg-[#E2E8F0] border border-[#E2E8F0]"
                  }`}
                >
                  <Star className="w-3 h-3 fill-current" /> {m}
                </button>
              ))}
            </div>
          </div>

          <div className="p-4 max-h-[560px] overflow-y-auto">
            {productView === "grid" ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {paginatedProducts.map((p) => {
                  const isService = p.category === "Services";
                  // Client request 2026-09-02: out-of-stock items are still sellable (inventory is
                  // allowed to go negative) rather than blocked.
                  const out = !isService && p.stock <= 0;
                  return (
                    <button
                      key={p.id}
                      onClick={() => addToCart(p)}
                      className="text-left p-3 rounded-xl border transition-all bg-white border-[#E2E8F0] hover:border-[#0891B2] hover:shadow-md active:scale-[0.98] cursor-pointer"
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <Badge className={`${categoryColors[p.category] || "bg-[#F8FAFC] text-[#64748B] border-[#E2E8F0]"} text-[10px] px-1.5 py-0`}>
                          {p.category}
                        </Badge>
                        {out ? (
                          <Badge className="bg-[#DC2626]/10 text-[#DC2626] text-[10px] px-1.5 py-0">{t("Out — will go negative")}</Badge>
                        ) : isService ? (
                          <Badge className="bg-[#7C3AED]/10 text-[#7C3AED] text-[10px] px-1.5 py-0">{t("Service")}</Badge>
                        ) : p.stock <= 5 ? (
                          <Badge className="bg-[#F59E0B]/10 text-[#F59E0B] text-[10px] px-1.5 py-0">{t("Low")}: {p.stock}</Badge>
                        ) : (
                          <span className="text-[10px] text-[#64748B] font-medium">{p.stock} {t("in stock")}</span>
                        )}
                      </div>
                      {p.item_number != null && <p className="text-[10px] text-[#64748B] font-mono mb-0.5">#{p.item_number}</p>}
                      <p className="text-sm font-semibold text-[#0F172A] leading-snug mb-1 line-clamp-2">{p.name}</p>
                      <p className="text-[10px] text-[#64748B] font-mono">{p.sku}</p>
                      <p className="text-base font-bold text-[#0891B2] mt-2">${(p.price ?? 0).toFixed(2)}</p>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="border border-[#E2E8F0] rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
                      <th className="text-left py-2 px-3 text-xs font-semibold text-[#64748B] uppercase">{t("Item #")}</th>
                      <th className="text-left py-2 px-3 text-xs font-semibold text-[#64748B] uppercase">{t("Product")}</th>
                      <th className="text-left py-2 px-3 text-xs font-semibold text-[#64748B] uppercase">{t("SKU")}</th>
                      <th className="text-left py-2 px-3 text-xs font-semibold text-[#64748B] uppercase">{t("Category")}</th>
                      <th className="text-right py-2 px-3 text-xs font-semibold text-[#64748B] uppercase">{t("Stock")}</th>
                      <th className="text-right py-2 px-3 text-xs font-semibold text-[#64748B] uppercase">{t("Price")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedProducts.map((p) => {
                      const isService = p.category === "Services";
                      const out = !isService && p.stock <= 0;
                      return (
                        <tr
                          key={p.id}
                          onClick={() => addToCart(p)}
                          className="border-b border-[#F1F5F9] last:border-0 hover:bg-[#F8FAFC] cursor-pointer"
                        >
                          <td className="py-2 px-3 text-[#64748B] text-xs">{p.item_number ?? "—"}</td>
                          <td className="py-2 px-3 font-medium text-[#0F172A]">{p.name}</td>
                          <td className="py-2 px-3 text-[#64748B] font-mono text-xs">{p.sku}</td>
                          <td className="py-2 px-3">
                            <Badge className={`${categoryColors[p.category] || "bg-[#F8FAFC] text-[#64748B] border-[#E2E8F0]"} text-[10px] px-1.5 py-0`}>
                              {p.category}
                            </Badge>
                          </td>
                          <td className="text-right py-2 px-3">
                            {isService ? (
                              <span className="text-[10px] text-[#7C3AED]">{t("Service")}</span>
                            ) : out ? (
                              <span className="text-[10px] text-[#DC2626]">{t("Out")}</span>
                            ) : (
                              <span className={`text-xs ${p.stock <= 5 ? "text-[#F59E0B]" : "text-[#64748B]"}`}>{p.stock}</span>
                            )}
                          </td>
                          <td className="text-right py-2 px-3 font-semibold text-[#0891B2]">${(p.price ?? 0).toFixed(2)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            {filtered.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 text-[#64748B]">
                <Package className="w-10 h-10 mb-3 opacity-40" />
                <p className="text-sm">{t("No products match your search")}</p>
              </div>
            )}
          </div>
          {filtered.length > 0 && (
            <div className="flex items-center justify-between px-4 py-2.5 border-t border-[#E2E8F0] text-sm">
              <p className="text-[#64748B] text-xs">
                {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} {t("of")} {filtered.length}
              </p>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" className="h-7 text-xs border-[#E2E8F0]" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                  {t("Previous")}
                </Button>
                <span className="text-[#64748B] text-xs">{t("Page")} {page} {t("of")} {totalPages}</span>
                <Button variant="outline" size="sm" className="h-7 text-xs border-[#E2E8F0]" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
                  {t("Next")}
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Cart Panel */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-[#E2E8F0] shadow-sm flex flex-col max-h-[660px]">
          {/* Cart Header */}
          <div className="p-4 border-b border-[#E2E8F0] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShoppingCart className="w-5 h-5 text-[#0891B2]" />
              <h3 className="font-semibold text-[#0F172A]">{t("Current Sale")}</h3>
              {cart.length > 0 && (
                <Badge className="bg-[#0891B2] text-white">{cart.reduce((s, i) => s + i.qty, 0)}</Badge>
              )}
            </div>
            {cart.length > 0 && (
              <button onClick={clearCart} className="text-xs text-[#DC2626] font-medium hover:underline flex items-center gap-1">
                <Trash2 className="w-3.5 h-3.5" /> {t("Clear")}
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
                <p className="text-sm font-medium">{t("Cart is empty")}</p>
                <p className="text-xs mt-1">{t("Click products to add them")}</p>
              </div>
            ) : (
              <div className="space-y-3">
                {cart.map((item, index) => (
                  <div key={index} className="flex items-center gap-2 py-2 border-b border-[#F1F5F9] last:border-0">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[#0F172A] truncate">{item.name}{item.qty < 0 ? ` (${t("Return")})` : ""}</p>
                      <p className="text-xs text-[#64748B]">
                        ${item.price.toFixed(2)} / {item.unit}
                        {" · "}
                        <button
                          type="button"
                          className="text-[#0891B2] hover:underline"
                          onClick={() => setCart((prev) => prev.map((c, i) => (i === index ? { ...c, qty: -c.qty } : c)))}
                        >
                          {item.qty < 0 ? t("Undo return") : t("Return this item")}
                        </button>
                      </p>
                      <input
                        placeholder={t("Serial # (optional)")}
                        className="mt-1 h-6 w-full text-xs border-0 border-b border-dashed border-[#E2E8F0] bg-transparent px-0 focus:outline-none focus:border-[#0891B2]"
                        value={item.serial ?? ""}
                        onChange={(e) => setCart((prev) => prev.map((c, i) => (i === index ? { ...c, serial: e.target.value } : c)))}
                      />
                    </div>
                    <div className="flex items-center gap-1">
                      <button onClick={() => updateQty(item.id, index, -1)} className="w-7 h-7 rounded-md bg-[#F8FAFC] border border-[#E2E8F0] flex items-center justify-center hover:bg-[#E2E8F0]">
                        <Minus className="w-3.5 h-3.5 text-[#0F172A]" />
                      </button>
                      <span className={`w-8 text-center text-sm font-semibold ${item.qty < 0 ? "text-[#DC2626]" : "text-[#0F172A]"}`}>{item.qty}</span>
                      <button onClick={() => updateQty(item.id, index, 1)} className="w-7 h-7 rounded-md bg-[#F8FAFC] border border-[#E2E8F0] flex items-center justify-center hover:bg-[#E2E8F0]">
                        <Plus className="w-3.5 h-3.5 text-[#0F172A]" />
                      </button>
                    </div>
                    <div className="w-20 text-right">
                      <p className={`text-sm font-bold ${item.qty < 0 ? "text-[#DC2626]" : "text-[#0F172A]"}`}>${(item.price * item.qty).toFixed(2)}</p>
                    </div>
                    <button onClick={() => removeItem(index)} className="text-[#DC2626] hover:bg-[#DC2626]/10 p-1 rounded">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Client PDF 2026-09-15: "need a notes section (freeform)" on a POS transaction. */}
          {cart.length > 0 && (
            <div className="px-4 pt-3">
              <Textarea
                placeholder={t("Notes (optional)...")}
                value={saleNote}
                onChange={(e) => setSaleNote(e.target.value)}
                className="text-sm min-h-[60px] bg-white border-[#E2E8F0]"
              />
            </div>
          )}

          {/* Totals & Checkout */}
          {cart.length > 0 && (
            <div className="border-t border-[#E2E8F0] p-4 space-y-3">
              <div className="space-y-1.5 text-sm">
                <div className="flex justify-between text-[#64748B]">
                  <span>{t("Subtotal")}</span>
                  <span className="font-medium text-[#0F172A]">${subtotal.toFixed(2)}</span>
                </div>
                {discountAmount > 0 && (
                  <div className="flex justify-between text-[#16A34A]">
                    <span>{t("Discount")} {discountType === "percent" ? `(${discount}%)` : ""}</span>
                    <span className="font-medium">-${discountAmount.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between text-[#64748B]">
                  <span>{t("Tax (8.25%)")}</span>
                  <span className="font-medium text-[#0F172A]">${tax.toFixed(2)}</span>
                </div>
                <div className="flex justify-between pt-2 border-t border-[#E2E8F0]">
                  <span className="font-semibold text-[#0F172A]">{t("Total")}</span>
                  <span className="text-xl font-bold text-[#0891B2]">{money(total)}</span>
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="h-9 gap-1.5 border-[#E2E8F0] text-[#0F172A] flex-1"
                  onClick={() => setDiscountOpen(true)}
                >
                  <Percent className="w-4 h-4" /> {t("Discount")}
                </Button>
                <Button
                  className="h-12 gap-2 bg-[#0891B2] hover:bg-[#0E7490] text-white flex-[2]"
                  onClick={() => {
                    setTenderLines([]);
                    setTenderAmount("");
                    // A refund can't be pushed to a card through Accept.js (that only charges).
                    if (isRefund && tenderMethod === "Card") setTenderMethod("Cash");
                    setPaymentOpen(true);
                  }}
                >
                  <CreditCard className="w-5 h-5" />
                  {isRefund ? t("Refund") : t("Charge")} {money(isRefund ? Math.abs(total) : total)}
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
          <h3 className="font-semibold text-[#0F172A]">{t("Recent Transactions")}</h3>
          <Badge className="bg-[#F8FAFC] text-[#64748B] border border-[#E2E8F0]">{t("Last 8")}</Badge>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
                <th className="text-left py-3 px-4 text-xs font-semibold text-[#64748B] uppercase">{t("Date")}</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-[#64748B] uppercase">{t("Customer")}</th>
                <th className="text-right py-3 px-4 text-xs font-semibold text-[#64728B] uppercase">{t("Items")}</th>
                <th className="text-right py-3 px-4 text-xs font-semibold text-[#64748B] uppercase">{t("Subtotal")}</th>
                <th className="text-right py-3 px-4 text-xs font-semibold text-[#64748B] uppercase">{t("Tax")}</th>
                <th className="text-right py-3 px-4 text-xs font-semibold text-[#64748B] uppercase">{t("Total")}</th>
                <th className="text-center py-3 px-4 text-xs font-semibold text-[#64748B] uppercase">{t("Payment")}</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((tx) => (
                <tr key={tx.id} className="border-b border-[#F1F5F9] last:border-0 hover:bg-[#F8FAFC]">
                  <td className="py-3 px-4 text-[#64748B]">{new Date(tx.created_at).toLocaleString([], { dateStyle: "short", timeStyle: "short" })}</td>
                  <td className="py-3 px-4 font-medium text-[#0F172A]">
                    {tx.customers?.name ?? "Walk-in"}
                    {tx.note && <span className="block text-xs font-normal text-[#94A3B8] truncate max-w-[220px]" title={tx.note}>{tx.note}</span>}
                  </td>
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
                <tr><td colSpan={7} className="py-8 text-center text-[#64748B]">{t("No transactions yet")}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Sales Reports (client request 2026-08-27): date-range qty sold + sales tax report */}
      <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-sm overflow-hidden">
        <div className="p-4 border-b border-[#E2E8F0] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h3 className="font-semibold text-[#0F172A]">{t("Sales Reports")}</h3>
          <div className="flex items-center gap-2">
            <Input type="date" className="h-9 w-auto" value={reportStart} onChange={(e) => setReportStart(e.target.value)} />
            <span className="text-[#64748B] text-sm">{t("to")}</span>
            <Input type="date" className="h-9 w-auto" value={reportEnd} onChange={(e) => setReportEnd(e.target.value)} />
          </div>
        </div>
        {reportLoading && <div className="p-4 text-center text-[#64748B] text-sm">{t("Loading report...")}</div>}
        {!reportLoading && report && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-0">
            <div className="lg:col-span-2 p-4 border-b lg:border-b-0 lg:border-r border-[#E2E8F0]">
              <p className="text-xs font-semibold text-[#64748B] uppercase mb-3">{t("Quantity Sold by Product")}</p>
              <div className="overflow-x-auto max-h-72 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[#E2E8F0]">
                      <th className="text-left py-2 text-xs font-semibold text-[#64748B] uppercase">{t("Product")}</th>
                      <th className="text-right py-2 text-xs font-semibold text-[#64748B] uppercase">{t("Qty Sold")}</th>
                      <th className="text-right py-2 text-xs font-semibold text-[#64748B] uppercase">{t("Revenue")}</th>
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
                      <tr><td colSpan={3} className="py-6 text-center text-[#64748B]">{t("No sales in this date range")}</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="p-4 space-y-3">
              <p className="text-xs font-semibold text-[#64748B] uppercase">{t("Sales Tax Report")}</p>
              <div className="flex justify-between text-sm"><span className="text-[#64748B]">{t("Orders")}</span><span className="font-medium text-[#0F172A]">{report.taxSummary.orderCount}</span></div>
              <div className="flex justify-between text-sm"><span className="text-[#64748B]">{t("Taxable Sales")}</span><span className="font-medium text-[#0F172A]">${report.taxSummary.taxableSales.toFixed(2)}</span></div>
              <div className="flex justify-between text-sm"><span className="text-[#64748B]">{t("Tax Collected")}</span><span className="font-medium text-[#0F172A]">${report.taxSummary.taxCollected.toFixed(2)}</span></div>
              <div className="flex justify-between text-sm pt-2 border-t border-[#E2E8F0]"><span className="font-semibold text-[#0F172A]">{t("Total Sales")}</span><span className="font-bold text-[#0891B2]">${report.taxSummary.totalSales.toFixed(2)}</span></div>
            </div>
          </div>
        )}
      </div>

      {/* Customer Dialog */}
      <Dialog open={customerOpen} onOpenChange={setCustomerOpen}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t("Attach Customer")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#64748B]" />
              <Input placeholder={t("Search customers...")} className="pl-9" autoFocus value={customerSearch} onChange={(e) => setCustomerSearch(e.target.value)} />
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
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-[#0F172A]">{name}</span>
                    {customers.find((c) => c.name === name)?.address && (
                      <span className="block text-xs text-[#64748B] truncate">{customers.find((c) => c.name === name)?.address}</span>
                    )}
                  </span>
                  {customerName === name && <CheckCircle2 className="w-4 h-4 text-[#16A34A] ml-auto" />}
                </button>
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Discount Dialog */}
      <Dialog open={discountOpen} onOpenChange={setDiscountOpen}>
        <DialogContent className="sm:max-w-sm max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t("Apply Discount")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setDiscountType("percent")}
                className={`py-2.5 rounded-lg border text-sm font-medium ${discountType === "percent" ? "border-[#0891B2] bg-[#0891B2]/10 text-[#0891B2]" : "border-[#E2E8F0] text-[#64748B]"}`}
              >
                {t("Percentage %")}
              </button>
              <button
                onClick={() => setDiscountType("amount")}
                className={`py-2.5 rounded-lg border text-sm font-medium ${discountType === "amount" ? "border-[#0891B2] bg-[#0891B2]/10 text-[#0891B2]" : "border-[#E2E8F0] text-[#64748B]"}`}
              >
                {t("Dollar $")}
              </button>
            </div>
            <div>
              <Label>{discountType === "percent" ? t("Percent off (%)") : t("Amount off ($)")}</Label>
              <Input
                type="number"
                value={discount || ""}
                onChange={(e) => setDiscount(Math.max(0, Number(e.target.value)))}
                placeholder="0"
                className="mt-1.5"
              />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => { setDiscount(0); setDiscountOpen(false); }}>{t("Clear")}</Button>
              <Button className="flex-1 bg-[#0891B2] hover:bg-[#0E7490] text-white" onClick={() => setDiscountOpen(false)}>{t("Apply")}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Payment Dialog */}
      <Dialog open={paymentOpen} onOpenChange={setPaymentOpen}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t("Take Payment")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="bg-[#F8FAFC] rounded-xl p-4 text-center">
              <p className="text-sm text-[#64748B] font-medium">{isRefund ? t("Refund Due") : remainingTender > 0.01 ? t("Remaining Due") : t("Amount Due")}</p>
              <p className="text-3xl font-bold text-[#0891B2] mt-1">${Math.abs(remainingTender).toFixed(2)}</p>
              <p className="text-xs text-[#64748B] mt-1">{cart.reduce((s, i) => s + i.qty, 0)} {t("items")} · {customerName} · {t("Total")} {money(total)}</p>
            </div>

            {/* Client request 2026-09-03: split tender — combine cash/card/ACH/check, or several
                cards, on one sale. Each line commits (and charges, for Card) individually. */}
            {tenderLines.length > 0 && (
              <div className="space-y-1.5">
                {tenderLines.map((tenderLine, i) => (
                  <div key={i} className="flex items-center justify-between rounded-lg border border-[#E2E8F0] px-3 py-2 text-sm">
                    <span className="font-medium text-[#0F172A]">{tenderLine.method}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-[#0F172A]">{money(tenderLine.amount)}</span>
                      <button onClick={() => removeTender(i)} className="text-[#DC2626] hover:bg-[#DC2626]/10 p-1 rounded">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {Math.abs(remainingTender) > 0.01 && (
              <div>
                <Label className="mb-2 block">{isRefund ? t("Refund Method") : t("Payment Method")}</Label>
                <div className={`grid ${isRefund ? "grid-cols-3" : "grid-cols-4"} gap-2 mb-2`}>
                  {([
                    { key: "Cash", icon: Banknote, label: "Cash" },
                    { key: "Card", icon: CreditCard, label: "Card" },
                    { key: "ACH", icon: FileText, label: "ACH" },
                    { key: "Check", icon: FileText, label: "Check" },
                  ] as const).filter((m) => !(isRefund && m.key === "Card")).map((m) => {
                    const Icon = m.icon;
                    return (
                      <button
                        key={m.key}
                        onClick={() => setTenderMethod(m.key)}
                        className={`flex flex-col items-center gap-1.5 py-3 rounded-xl border transition-all ${
                          tenderMethod === m.key
                            ? "border-[#0891B2] bg-[#0891B2]/10 text-[#0891B2]"
                            : "border-[#E2E8F0] text-[#64748B] hover:bg-[#F8FAFC]"
                        }`}
                      >
                        <Icon className="w-5 h-5" />
                        <span className="text-xs font-medium">{t(m.label)}</span>
                      </button>
                    );
                  })}
                </div>
                {tenderMethod === "Card" ? (
                  <CardPaymentForm
                    amount={remainingTender}
                    submitLabel={`${t("Add Card Tender")} · $${remainingTender.toFixed(2)}`}
                    onCharge={async (opaqueData) => addCardTender(remainingTender, opaqueData)}
                  />
                ) : (
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <Input
                        type="number"
                        placeholder={`${t("Up to")} $${Math.abs(remainingTender).toFixed(2)}`}
                        className="flex-1"
                        value={tenderAmount}
                        onChange={(e) => setTenderAmount(e.target.value)}
                      />
                      <Button variant="outline" className="border-[#E2E8F0]" onClick={addCashTender}>{t("Add")}</Button>
                      <Button variant="outline" className="border-[#E2E8F0]" onClick={() => setTenderAmount(Math.abs(remainingTender).toFixed(2))}>{t("Full")}</Button>
                    </div>
                    {tenderLines.length === 0 && (
                      <p className="text-xs text-[#64748B]">{t("Complete Sale takes the full amount with the method selected above. To split the payment, enter an amount and press Add.")}</p>
                    )}
                  </div>
                )}
              </div>
            )}

            <Button
              className="w-full h-12 bg-[#0891B2] hover:bg-[#0E7490] text-white gap-2"
              disabled={!canComplete}
              onClick={completeSale}
            >
              <CheckCircle2 className="w-5 h-5" />
              {t("Complete Sale")} · {money(total)}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Receipt Dialog */}
      <Dialog open={receiptOpen} onOpenChange={setReceiptOpen}>
        <DialogContent className="sm:max-w-sm max-h-[90vh] overflow-y-auto">
          <div className="text-center py-4">
            <div className="w-16 h-16 rounded-full bg-[#16A34A]/10 flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-9 h-9 text-[#16A34A]" />
            </div>
            <h2 className="text-xl font-bold text-[#0F172A]">{t("Sale Complete")}</h2>
            <p className="text-sm text-[#64748B] mt-1">{t("Receipt")} {completedSale?.number}</p>
            <div className="bg-[#F8FAFC] rounded-xl p-4 mt-4 space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-[#64748B]">{t("Items")}</span><span className="font-medium text-[#0F172A]">{completedSale?.items}</span></div>
              <div className="flex justify-between"><span className="text-[#64748B]">{t("Payment")}</span><span className="font-medium text-[#0F172A]">{completedSale?.payment}</span></div>
              <div className="flex justify-between pt-2 border-t border-[#E2E8F0]"><span className="font-semibold text-[#0F172A]">{t("Total")}</span><span className="font-bold text-[#0891B2]">{completedSale ? money(completedSale.total) : ""}</span></div>
            </div>
            <p className="text-xs text-[#64748B] mt-3">{t("Inventory levels updated automatically.")}</p>
            <div className="flex gap-2 mt-5">
              <Button variant="outline" className="flex-1 gap-2" onClick={() => setReceiptOpen(false)}>
                <Printer className="w-4 h-4" /> {t("Print")}
              </Button>
              <Button className="flex-1 bg-[#0891B2] hover:bg-[#0E7490] text-white gap-2" onClick={() => setReceiptOpen(false)}>
                {t("New Sale")} <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
