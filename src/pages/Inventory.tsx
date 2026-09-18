import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import JsBarcode from "jsbarcode";
import { Search, Plus, Package, AlertTriangle, TrendingUp, Warehouse, Truck, ShoppingCart, BarChart3, Tag, Landmark, Pencil, ClipboardX, Barcode, Trash2, Receipt, Eye, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { SearchableSelect } from "@/components/SearchableSelect";
import CategoryPicker from "@/components/CategoryPicker";
import PoLineItemsEditor from "@/components/PoLineItemsEditor";
import { inventoryApi } from "@/lib/api/inventory";
import { useLanguage } from "@/lib/language-context";
import { matchesQuery } from "@/lib/search";
import { invoicingApi, type VendorBill } from "@/lib/api/invoicing";
import { reportsApi, type VendorBillDueRow } from "@/lib/api/reports";
import type { Database } from "@/lib/database.types";
import type { ItemWithStock, QboAccount, QboAccounts, InventoryWriteoff, SupplierLocation, CategoryTaxonomyRow, PoLineItemInput } from "@/lib/api/inventory";

type Supplier = Database["public"]["Tables"]["suppliers"]["Row"];
type PurchaseOrder = Database["public"]["Tables"]["purchase_orders"]["Row"] & { suppliers: { name: string } | null; locations: { label: string; address: string | null } | null };
type InventoryVariance = Database["public"]["Tables"]["inventory_variance"]["Row"] & { inventory_items: { name: string } | null };


const statusColors: Record<string, string> = {
  "In Stock": "bg-[#16A34A]/10 text-[#16A34A]",
  "Low": "bg-[#F59E0B]/10 text-[#F59E0B]",
  "Out": "bg-[#DC2626]/10 text-[#DC2626]",
};

const poStatusColors: Record<string, string> = {
  "Pending": "bg-[#F59E0B]/10 text-[#F59E0B]",
  "Sent - Email": "bg-[#0891B2]/10 text-[#0891B2]",
  "Sent - Portal": "bg-[#7C3AED]/10 text-[#7C3AED]",
  "Received": "bg-[#16A34A]/10 text-[#16A34A]",
  // Backward-compat for any PO row written by older code before the status vocabulary migrated
  // (Draft/Ordered -> Pending/Sent, then Sent -> Sent - Email 2026-09-15).
  "Draft": "bg-[#F59E0B]/10 text-[#F59E0B]",
  "Ordered": "bg-[#0891B2]/10 text-[#0891B2]",
  "Sent": "bg-[#0891B2]/10 text-[#0891B2]",
};

// Client PDF 2026-09-15: "Receive po with net 30 or customizable term".
const PAYMENT_TERMS_PRESETS = ["Due on Receipt", "Net 15", "Net 30", "Net 60"];

const vendorBillStatusColors: Record<string, string> = {
  "Draft": "bg-[#F59E0B]/10 text-[#F59E0B]",
  "Received": "bg-[#0891B2]/10 text-[#0891B2]",
  "Paid": "bg-[#16A34A]/10 text-[#16A34A]",
  "Overdue": "bg-[#DC2626]/10 text-[#DC2626]",
};

// Client request 2026-08-27: print price stickers on Avery-style label sheets (works on any
// label printer, incl. Zebra, since it's just a formatted print job — Avery 5160 layout:
// 3 columns x 10 rows of 2.625" x 1" labels per letter-size sheet.
const printLabels = (items: Pick<ItemWithStock, "name" | "sku" | "price" | "unit_cost">[]) => {
  const win = window.open("", "_blank");
  if (!win || !win.document) return;
  const labelsHtml = items
    .map(
      (item) => `
        <div class="label">
          <div class="name">${item.name}</div>
          <div class="row"><span class="sku">${item.sku}</span><span class="price">$${(item.price ?? item.unit_cost).toFixed(2)}</span></div>
        </div>`
    )
    .join("");
  win.document.write(`
    <html>
      <head>
        <title>Print Labels</title>
        <style>
          @page { size: letter; margin: 0.5in 0.1875in; }
          body { margin: 0; font-family: Arial, sans-serif; }
          .sheet { display: grid; grid-template-columns: repeat(3, 2.625in); grid-auto-rows: 1in; }
          .label { box-sizing: border-box; padding: 0.1in 0.15in; overflow: hidden; display: flex; flex-direction: column; justify-content: center; }
          .name { font-size: 10px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
          .row { display: flex; justify-content: space-between; margin-top: 4px; }
          .sku { font-size: 9px; color: #555; }
          .price { font-size: 13px; font-weight: 700; }
        </style>
      </head>
      <body>
        <div class="sheet">${labelsHtml}</div>
        <script>window.onload = () => window.print();</script>
      </body>
    </html>
  `);
  win.document.close();
};

// Client request 2026-09-02: a real scannable barcode (Code128, from the SKU) sized for a
// 2"x1" Zebra label printer, distinct from the text-only Avery sheet above.
// Client request 2026-09-03: "customize labels for barcode scanner using item #" — barcode can
// now encode either the SKU or the internal Item # (`inventory_items.item_number`).
const printZebraLabels = (
  items: Pick<ItemWithStock, "name" | "sku" | "price" | "unit_cost" | "item_number">[],
  barcodeSource: "sku" | "itemNumber" = "sku",
) => {
  const win = window.open("", "_blank");
  if (!win || !win.document) return;
  const labelsHtml = items
    .map((item) => {
      const code = barcodeSource === "itemNumber" && item.item_number != null ? String(item.item_number) : item.sku;
      const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      JsBarcode(svg, code, { format: "CODE128", width: 1.5, height: 32, displayValue: false, margin: 0 });
      return `
        <div class="label">
          <div class="name">${item.name}</div>
          ${svg.outerHTML}
          <div class="row"><span class="sku">${code}</span><span class="price">$${(item.price ?? item.unit_cost).toFixed(2)}</span></div>
        </div>`;
    })
    .join("");
  win.document.write(`
    <html>
      <head>
        <title>Print Barcode Labels</title>
        <style>
          @page { size: 2in 1in; margin: 0; }
          body { margin: 0; font-family: Arial, sans-serif; }
          .label { width: 2in; height: 1in; box-sizing: border-box; padding: 0.08in 0.12in; page-break-after: always; display: flex; flex-direction: column; justify-content: center; align-items: center; }
          .name { font-size: 10px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 1.75in; }
          svg { max-width: 1.75in; }
          .row { display: flex; justify-content: space-between; width: 1.75in; margin-top: 2px; }
          .sku { font-size: 9px; color: #555; }
          .price { font-size: 13px; font-weight: 700; }
        </style>
      </head>
      <body>
        ${labelsHtml}
        <script>window.onload = () => window.print();</script>
      </body>
    </html>
  `);
  win.document.close();
};

export default function Inventory() {
  const { t } = useLanguage();
  const [searchParams] = useSearchParams();
  const [search, setSearch] = useState(() => searchParams.get("search") ?? "");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [addOpen, setAddOpen] = useState(false);
  const [poOpen, setPoOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  // Client request 2026-09-04: editing a product previously only opened a 2-field Cost/Price
  // dialog -- now opens a full "Add Product"-shaped editor with every field.
  const [editProductItem, setEditProductItem] = useState<ItemWithStock | null>(null);
  const [editProductDraft, setEditProductDraft] = useState({
    name: "", sku: "", category: "Chemicals", unitCost: "", price: "",
    shortDescription: "", longDescription: "", department: "", subDepartment: "", manufacturer: "",
    barcode: "", defaultDistributor: "", unit: "", taxable: true, reorderThreshold: "", storeQuantity: "",
    subcategory: "", subSubcategory: "", subSubSubcategory: "",
  });
  const [categoryTaxonomy, setCategoryTaxonomy] = useState<CategoryTaxonomyRow[]>([]);
  // Client request 2026-09-04: the Catalog table had no pagination at all -- unusable once real
  // inventory (2,600+ items) was imported.
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 50;
  const inventoryTabs = ["catalog", "suppliers", "purchase", "vendor-bills", "variance", "writeoffs"];
  const [activeTab, setActiveTab] = useState(() => {
    const tab = searchParams.get("tab");
    return tab && inventoryTabs.includes(tab) ? tab : "catalog";
  });

  useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab && inventoryTabs.includes(tab)) setActiveTab(tab);
  }, [searchParams]);

  const [items, setItems] = useState<ItemWithStock[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [varianceData, setVarianceData] = useState<InventoryVariance[]>([]);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [qboAccountList, setQboAccountList] = useState<QboAccount[] | null>(null);
  const [qboError, setQboError] = useState<string | null>(null);
  const [qboDialogItem, setQboDialogItem] = useState<ItemWithStock | null>(null);
  const [qboSelection, setQboSelection] = useState<QboAccounts>({});
  const [newProduct, setNewProduct] = useState({
    name: "", sku: "", category: "Chemicals", unitCost: "", price: "",
    shortDescription: "", longDescription: "", department: "", subDepartment: "", manufacturer: "", reorderThreshold: "",
    subcategory: "", subSubcategory: "", subSubSubcategory: "",
  });
  const [barcodeSource, setBarcodeSource] = useState<"sku" | "itemNumber">("sku");
  const [newPo, setNewPo] = useState({ supplierId: "", number: `PO-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-001`, locationId: "", paymentTerms: "Net 30" });
  const [poError, setPoError] = useState("");
  const [newPoLocations, setNewPoLocations] = useState<SupplierLocation[]>([]);
  const [newPoLineItems, setNewPoLineItems] = useState<PoLineItemInput[]>([]);
  const [poDetailLineItems, setPoDetailLineItems] = useState<PoLineItemInput[]>([]);
  const [vendorSearch, setVendorSearch] = useState("");
  const [newSupplier, setNewSupplier] = useState({ name: "", contact: "", phone: "", leadTime: "", address: "" });
  const [supplierOpen, setSupplierOpen] = useState(false);
  const [editSupplier, setEditSupplier] = useState<Supplier | null>(null);

  // Client PDF 2026-09-05: "some vendors have multiple locations we put from".
  const [locationsSupplier, setLocationsSupplier] = useState<Supplier | null>(null);
  const [supplierLocations, setSupplierLocations] = useState<SupplierLocation[]>([]);
  const [newLocation, setNewLocation] = useState({ label: "", address: "", contactName: "", phone: "" });

  // Client request 2026-09-02: write off SKUs for store use / truck use / shrinkage etc.
  const [writeoffs, setWriteoffs] = useState<(InventoryWriteoff & { inventory_items: { name: string; sku: string } | null })[]>([]);
  const [writeoffOpen, setWriteoffOpen] = useState(false);
  const [writeoffDraft, setWriteoffDraft] = useState({ itemId: "", quantity: "", reason: "Store Use", note: "" });

  // Client SMS 2026-09-09: "under Estimates/Quote, move Vendor Bills under Purchase Orders" --
  // Vendor Bills used to live on the Invoicing page; it's now a tab here, next to Purchase Orders,
  // with none of the customer-invoicing header buttons/tabs that page carries.
  const [vendorBills, setVendorBills] = useState<VendorBill[]>([]);
  const [vendorBillsDue, setVendorBillsDue] = useState<VendorBillDueRow[]>([]);
  const [newBillOpen, setNewBillOpen] = useState(false);
  const [newBill, setNewBill] = useState({ supplierId: "", number: "", issueDate: "", dueDate: "", amount: "", poId: "" });
  // Client PDF 2026-09-15: "Ability to search by PO number" on the Pay Invoices / Vendor Bills tab.
  const [billSearch, setBillSearch] = useState("");
  const [billSort, setBillSort] = useState<{ key: "amount" | "vendor" | null; dir: "asc" | "desc" }>({ key: null, dir: "asc" });

  const loadInventory = useCallback(async () => {
    setIsLoading(true);
    const [data, writeoffData, taxonomyData, vendorBillsData, vendorBillsDueData] = await Promise.all([
      inventoryApi.summary(),
      inventoryApi.writeoffs(),
      inventoryApi.categoryTaxonomy(),
      invoicingApi.vendorBills(),
      reportsApi.vendorBillsDue(),
    ]);
    setItems(data.items);
    setSuppliers(data.suppliers);
    setPurchaseOrders(data.purchaseOrders);
    setVarianceData(data.varianceData);
    setWriteoffs(writeoffData);
    setCategoryTaxonomy(taxonomyData ?? []);
    setVendorBills(vendorBillsData ?? []);
    setVendorBillsDue(vendorBillsDueData ?? []);
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
      price: newProduct.price ? parseFloat(newProduct.price) : null,
      shortDescription: newProduct.shortDescription || null,
      longDescription: newProduct.longDescription || null,
      department: newProduct.department || null,
      subDepartment: newProduct.subDepartment || null,
      manufacturer: newProduct.manufacturer || null,
      reorderThreshold: parseInt(newProduct.reorderThreshold, 10) || 0,
      subcategory: newProduct.subcategory || null,
      subSubcategory: newProduct.subSubcategory || null,
      subSubSubcategory: newProduct.subSubSubcategory || null,
    });
    setNewProduct({ name: "", sku: "", category: "Chemicals", unitCost: "", price: "", shortDescription: "", longDescription: "", department: "", subDepartment: "", manufacturer: "", reorderThreshold: "", subcategory: "", subSubcategory: "", subSubSubcategory: "" });
    setAddOpen(false);
    loadInventory();
  };

  // Client request 2026-09-04: full product edit (every field, same shape as Add Product) —
  // replaces the old Cost/Price-only dialog.
  const openEditProduct = (item: ItemWithStock) => {
    setEditProductItem(item);
    setEditProductDraft({
      name: item.name,
      sku: item.sku,
      category: item.category,
      unitCost: String(item.unit_cost),
      price: item.price !== null ? String(item.price) : "",
      shortDescription: item.short_description ?? "",
      longDescription: item.long_description ?? "",
      department: item.department ?? "",
      subDepartment: item.sub_department ?? "",
      manufacturer: item.manufacturer ?? "",
      barcode: item.barcode ?? "",
      defaultDistributor: item.default_distributor ?? "",
      unit: item.unit ?? "",
      taxable: item.taxable,
      reorderThreshold: String(item.reorder_threshold),
      storeQuantity: String(item.storeQty),
      subcategory: item.subcategory ?? "",
      subSubcategory: item.sub_subcategory ?? "",
      subSubSubcategory: item.sub_sub_subcategory ?? "",
    });
  };

  const saveEditProduct = async () => {
    if (!editProductItem) return;
    await inventoryApi.updateItem(editProductItem.id, {
      name: editProductDraft.name,
      sku: editProductDraft.sku,
      category: editProductDraft.category,
      unitCost: parseFloat(editProductDraft.unitCost) || 0,
      price: editProductDraft.price ? parseFloat(editProductDraft.price) : null,
      shortDescription: editProductDraft.shortDescription || null,
      longDescription: editProductDraft.longDescription || null,
      department: editProductDraft.department || null,
      subDepartment: editProductDraft.subDepartment || null,
      manufacturer: editProductDraft.manufacturer || null,
      barcode: editProductDraft.barcode || null,
      defaultDistributor: editProductDraft.defaultDistributor || null,
      unit: editProductDraft.unit || null,
      taxable: editProductDraft.taxable,
      reorderThreshold: parseInt(editProductDraft.reorderThreshold, 10) || 0,
      storeQuantity: editProductDraft.storeQuantity === "" ? null : parseInt(editProductDraft.storeQuantity, 10) || 0,
      subcategory: editProductDraft.subcategory || null,
      subSubcategory: editProductDraft.subSubcategory || null,
      subSubSubcategory: editProductDraft.subSubSubcategory || null,
    });
    setEditProductItem(null);
    loadInventory();
  };

  const handleCreatePo = async () => {
    if (!newPo.supplierId) {
      setPoError("Pick a supplier first.");
      return;
    }
    if (!newPo.number.trim()) {
      setPoError("PO number can't be blank.");
      return;
    }
    setPoError("");
    await inventoryApi.createPurchaseOrder({
      supplierId: newPo.supplierId,
      number: newPo.number,
      locationId: newPo.locationId || null,
      lineItems: newPoLineItems.filter((li) => li.description.trim()),
      paymentTerms: newPo.paymentTerms,
    });
    setNewPo({ supplierId: "", number: `PO-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${String(purchaseOrders.length + 2).padStart(3, "0")}`, locationId: "", paymentTerms: "Net 30" });
    setNewPoLocations([]);
    setNewPoLineItems([]);
    setPoOpen(false);
    loadInventory();
  };

  const handlePoSupplierChange = async (supplierId: string) => {
    setNewPo((p) => ({ ...p, supplierId, locationId: "" }));
    setNewPoLocations(supplierId ? await inventoryApi.getSupplierLocations(supplierId) : []);
  };

  // Client request 2026-09-03: "Cannot add or edit -- suppliers / vendors".
  const openAddSupplier = () => {
    setEditSupplier(null);
    setNewSupplier({ name: "", contact: "", phone: "", leadTime: "", address: "" });
    setSupplierOpen(true);
  };

  const openEditSupplier = (s: Supplier) => {
    setEditSupplier(s);
    setNewSupplier({ name: s.name, contact: s.contact ?? "", phone: s.phone ?? "", leadTime: s.lead_time ?? "", address: (s as Supplier & { address: string | null }).address ?? "" });
    setSupplierOpen(true);
  };

  const handleSaveSupplier = async () => {
    if (!newSupplier.name.trim()) return;
    const data = {
      name: newSupplier.name,
      contact: newSupplier.contact || null,
      phone: newSupplier.phone || null,
      leadTime: newSupplier.leadTime || null,
      address: newSupplier.address || null,
    };
    if (editSupplier) {
      await inventoryApi.updateSupplier(editSupplier.id, data);
    } else {
      await inventoryApi.addSupplier(data);
    }
    setSupplierOpen(false);
    loadInventory();
  };

  // Client SMS 2026-09-09: "able to edit and delete vendors from list".
  const handleDeleteSupplier = async (s: Supplier) => {
    await inventoryApi.deleteSupplier(s.id);
    loadInventory();
  };

  const openSupplierLocations = async (s: Supplier) => {
    setLocationsSupplier(s);
    setSupplierLocations(await inventoryApi.getSupplierLocations(s.id));
  };

  const handleAddLocation = async () => {
    if (!locationsSupplier || !newLocation.label.trim()) return;
    await inventoryApi.addSupplierLocation(locationsSupplier.id, {
      label: newLocation.label,
      address: newLocation.address || null,
      contactName: newLocation.contactName || null,
      phone: newLocation.phone || null,
    });
    setNewLocation({ label: "", address: "", contactName: "", phone: "" });
    setSupplierLocations(await inventoryApi.getSupplierLocations(locationsSupplier.id));
  };

  const handleRemoveLocation = async (locationId: string) => {
    if (!locationsSupplier) return;
    await inventoryApi.removeSupplierLocation(locationId);
    setSupplierLocations(await inventoryApi.getSupplierLocations(locationsSupplier.id));
  };

  // Client request 2026-09-03: PO list needed a view/edit option.
  const [poDetail, setPoDetail] = useState<PurchaseOrder | null>(null);
  const [poDetailDraft, setPoDetailDraft] = useState({ number: "", supplierId: "", status: "Pending", receivedDate: "", paymentTerms: "Net 30" });

  const openPoDetail = async (po: PurchaseOrder) => {
    setPoDetail(po);
    setPoDetailDraft({
      number: po.number,
      supplierId: po.supplier_id ?? "",
      status: po.status,
      receivedDate: po.received_date ?? "",
      paymentTerms: po.payment_terms || "Net 30",
    });
    setPoDetailLineItems([]);
    const lines = await inventoryApi.getPurchaseOrderLineItems(po.id);
    setPoDetailLineItems(lines.map((li) => ({ description: li.description, sku: li.sku, quantity: li.quantity, unitCost: li.unit_cost })));
  };

  const handleSavePoDetail = async () => {
    if (!poDetail) return;
    await inventoryApi.updatePurchaseOrder(poDetail.id, {
      number: poDetailDraft.number,
      supplierId: poDetailDraft.supplierId,
      status: poDetailDraft.status,
      receivedDate: poDetailDraft.receivedDate || null,
      paymentTerms: poDetailDraft.paymentTerms,
    });
    await inventoryApi.savePurchaseOrderLineItems(poDetail.id, poDetailLineItems.filter((li) => li.description.trim()));
    setPoDetail(null);
    loadInventory();
  };

  // Client PDF 2026-09-15: "review or view purchase order on pdf screen (full screen)".
  const handleViewPoPdf = () => {
    if (!poDetail) return;
    const supplierName = suppliers.find((s) => s.id === poDetailDraft.supplierId)?.name ?? "—";
    const win = window.open("", "_blank");
    if (!win || !win.document) return;
    const rowsHtml = poDetailLineItems
      .filter((li) => li.description.trim())
      .map(
        (li) => `
          <tr>
            <td>${li.description}</td>
            <td>${li.sku ?? ""}</td>
            <td style="text-align:right">${li.quantity}</td>
            <td style="text-align:right">$${li.unitCost.toFixed(2)}</td>
            <td style="text-align:right">$${(li.quantity * li.unitCost).toFixed(2)}</td>
          </tr>`
      )
      .join("");
    const total = poDetailLineItems.reduce((sum, li) => sum + li.quantity * li.unitCost, 0);
    win.document.write(`
      <html>
        <head>
          <title>${poDetailDraft.number}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 40px; color: #0F172A; }
            h1 { font-size: 22px; margin-bottom: 4px; }
            .meta { color: #64748B; font-size: 13px; margin-bottom: 24px; }
            .meta div { margin-bottom: 2px; }
            table { width: 100%; border-collapse: collapse; margin-top: 16px; }
            th, td { border-bottom: 1px solid #E2E8F0; padding: 8px; font-size: 13px; text-align: left; }
            th { background: #F8FAFC; text-transform: uppercase; font-size: 11px; color: #64748B; }
            .total { text-align: right; font-size: 16px; font-weight: bold; margin-top: 16px; }
          </style>
        </head>
        <body>
          <h1>Purchase Order ${poDetailDraft.number}</h1>
          <div class="meta">
            <div><strong>Vendor:</strong> ${supplierName}</div>
            <div><strong>Status:</strong> ${poDetailDraft.status}</div>
            <div><strong>Payment Terms:</strong> ${poDetailDraft.paymentTerms}</div>
            ${poDetailDraft.receivedDate ? `<div><strong>Received:</strong> ${poDetailDraft.receivedDate}</div>` : ""}
          </div>
          <table>
            <thead><tr><th>Description</th><th>SKU</th><th>Qty</th><th>Unit Cost</th><th>Amount</th></tr></thead>
            <tbody>${rowsHtml}</tbody>
          </table>
          <div class="total">Total: $${total.toFixed(2)}</div>
          <script>window.onload = () => window.print();</script>
        </body>
      </html>
    `);
    win.document.close();
  };

  // Client request 2026-08-27: map each item to QuickBooks COGS/Income/Asset accounts, fetched
  // lazily (once) from the tenant's live QBO chart of accounts.
  const openQboDialog = async (item: ItemWithStock) => {
    setQboDialogItem(item);
    setQboSelection((item.qbo_accounts as QboAccounts | null) ?? {});
    if (qboAccountList || qboError) return;
    try {
      const accounts = await inventoryApi.getQboAccounts();
      setQboAccountList(accounts);
    } catch (err) {
      setQboError(err instanceof Error ? err.message : "Could not load QuickBooks accounts");
    }
  };

  const saveQboAccounts = async () => {
    if (!qboDialogItem) return;
    await inventoryApi.updateQboAccounts(qboDialogItem.id, qboSelection);
    setQboDialogItem(null);
    loadInventory();
  };

  const accountsByGroup = (group: "income" | "expense" | "asset") => {
    if (!qboAccountList) return [];
    if (group === "income") return qboAccountList.filter((a) => a.accountType === "Income" || a.classification === "Revenue");
    if (group === "expense") return qboAccountList.filter((a) => a.accountType === "Cost of Goods Sold" || a.accountType === "Expense");
    return qboAccountList.filter((a) => a.classification === "Asset");
  };

  const filtered = items.filter((p) => {
    const matchesSearch = matchesQuery(search, [p.name, p.sku, p.item_number != null ? String(p.item_number) : null, p.short_description, p.long_description, p.category, p.manufacturer]);
    const matchesCategory = categoryFilter === "All" || p.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  // Client bug report 2026-09-04: the filter dropdown (and the Add/Edit Product Category field,
  // which used to be this same fixed list) only had 5 hardcoded values -- real imported items
  // carry ~35 real categories (from the source ProductFamily field), so most items couldn't be
  // filtered and the Edit dialog showed the Category field blank for them. Filter dropdown is now
  // built from whatever categories actually exist; Add/Edit switched to free text (see below).
  const dynamicCategories = ["All", ...Array.from(new Set(items.map((i) => i.category))).sort()];

  // Client PDF 2026-09-15: "sort by amount or vendors" + "search by PO number" on Pay Invoices.
  const filteredVendorBills = vendorBills
    .filter((b) => matchesQuery(billSearch, [b.number, b.suppliers?.name, b.po_number]))
    .sort((a, b) => {
      if (billSort.key === "amount") return billSort.dir === "asc" ? a.amount - b.amount : b.amount - a.amount;
      if (billSort.key === "vendor") {
        const cmp = (a.suppliers?.name ?? "").localeCompare(b.suppliers?.name ?? "");
        return billSort.dir === "asc" ? cmp : -cmp;
      }
      return 0;
    });

  const toggleBillSort = (key: "amount" | "vendor") => {
    setBillSort((prev) => (prev.key === key ? { key, dir: prev.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" }));
  };

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  useEffect(() => {
    setPage(1);
  }, [search, categoryFilter]);

  const toggleSelected = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handlePrintLabels = () => {
    const toPrint = selectedIds.size > 0 ? filtered.filter((p) => selectedIds.has(p.id)) : filtered;
    if (toPrint.length === 0) return;
    printLabels(toPrint);
  };

  const handlePrintZebraLabels = () => {
    const toPrint = selectedIds.size > 0 ? filtered.filter((p) => selectedIds.has(p.id)) : filtered;
    if (toPrint.length === 0) return;
    printZebraLabels(toPrint, barcodeSource);
  };

  const handleCreateWriteoff = async () => {
    if (!writeoffDraft.itemId || !writeoffDraft.quantity) return;
    await inventoryApi.createWriteoff({
      itemId: writeoffDraft.itemId,
      quantity: parseFloat(writeoffDraft.quantity),
      reason: writeoffDraft.reason,
      note: writeoffDraft.note || null,
    });
    setWriteoffDraft({ itemId: "", quantity: "", reason: "Store Use", note: "" });
    setWriteoffOpen(false);
    loadInventory();
  };

  const handleCreateBill = async () => {
    if (!newBill.supplierId || !newBill.number || !newBill.issueDate) return;
    await invoicingApi.createVendorBill({
      supplierId: newBill.supplierId,
      number: newBill.number,
      issueDate: newBill.issueDate,
      dueDate: newBill.dueDate || null,
      amount: parseFloat(newBill.amount) || 0,
      poId: newBill.poId || null,
    });
    setNewBill({ supplierId: "", number: "", issueDate: "", dueDate: "", amount: "", poId: "" });
    setNewBillOpen(false);
    loadInventory();
  };

  const handleMarkBillPaid = async (id: string) => {
    await invoicingApi.markVendorBillPaid(id);
    loadInventory();
  };

  const totalValue = items.reduce((sum, p) => sum + p.total * p.unit_cost, 0);
  const lowStock = items.filter((p) => p.status === "Low").length;
  const outOfStock = items.filter((p) => p.status === "Out").length;

  return (
    <div className="space-y-4">
      <datalist id="inventory-categories">
        {dynamicCategories.filter((c) => c !== "All").map((c) => <option key={c} value={c} />)}
      </datalist>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h1 className="text-2xl font-bold text-[#0F172A]">{t("Inventory")}</h1>
        <div className="flex items-center gap-2">
          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <DialogTrigger asChild>
              <Button className="bg-[#0891B2] hover:bg-[#0E7490] text-white gap-2 h-10">
                <Plus className="w-4 h-4" /> {t("Add Product")}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[85vh] overflow-y-auto">
              <DialogHeader><DialogTitle>{t("Add Product")}</DialogTitle></DialogHeader>
              <div className="space-y-4 pt-2">
                <div><Label>{t("Name")}</Label><Input className="mt-1" placeholder={t("Product name")} value={newProduct.name} onChange={(e) => setNewProduct((p) => ({ ...p, name: e.target.value }))} /></div>
                <div><Label>{t("SKU")}</Label><Input className="mt-1" placeholder="SKU-123" value={newProduct.sku} onChange={(e) => setNewProduct((p) => ({ ...p, sku: e.target.value }))} /></div>
                {categoryTaxonomy.length > 0 ? (
                  <CategoryPicker
                    taxonomy={categoryTaxonomy}
                    category={newProduct.category}
                    subcategory={newProduct.subcategory}
                    subSubcategory={newProduct.subSubcategory}
                    subSubSubcategory={newProduct.subSubSubcategory}
                    onChange={(next) => setNewProduct((p) => ({ ...p, ...next }))}
                  />
                ) : (
                  <div><Label>{t("Category")}</Label><Input className="mt-1" placeholder={t("e.g. Chemicals")} list="inventory-categories" value={newProduct.category} onChange={(e) => setNewProduct((p) => ({ ...p, category: e.target.value }))} /></div>
                )}
                <div className="grid grid-cols-2 gap-4">
                  <div><Label>{t("Cost (internal)")}</Label><Input className="mt-1" type="number" placeholder="0.00" value={newProduct.unitCost} onChange={(e) => setNewProduct((p) => ({ ...p, unitCost: e.target.value }))} /></div>
                  <div><Label>{t("Price (customer-facing)")}</Label><Input className="mt-1" type="number" placeholder="0.00" value={newProduct.price} onChange={(e) => setNewProduct((p) => ({ ...p, price: e.target.value }))} /></div>
                </div>
                <div><Label>{t("Short Description")}</Label><Input className="mt-1" placeholder={t("One-line summary")} value={newProduct.shortDescription} onChange={(e) => setNewProduct((p) => ({ ...p, shortDescription: e.target.value }))} /></div>
                <div><Label>{t("Long Description")}</Label><Input className="mt-1" placeholder={t("Full details")} value={newProduct.longDescription} onChange={(e) => setNewProduct((p) => ({ ...p, longDescription: e.target.value }))} /></div>
                <div className="grid grid-cols-2 gap-4">
                  <div><Label>{t("Department")}</Label><Input className="mt-1" placeholder={t("e.g. Pool Care")} value={newProduct.department} onChange={(e) => setNewProduct((p) => ({ ...p, department: e.target.value }))} /></div>
                  <div><Label>{t("Sub-department")}</Label><Input className="mt-1" placeholder={t("e.g. Sanitizers")} value={newProduct.subDepartment} onChange={(e) => setNewProduct((p) => ({ ...p, subDepartment: e.target.value }))} /></div>
                </div>
                <div><Label>{t("Manufacturer")}</Label><Input className="mt-1" placeholder={t("e.g. Pentair")} value={newProduct.manufacturer} onChange={(e) => setNewProduct((p) => ({ ...p, manufacturer: e.target.value }))} /></div>
                <div>
                  <Label>{t("Reorder Threshold")}</Label>
                  <Input className="mt-1" type="number" placeholder="0" value={newProduct.reorderThreshold} onChange={(e) => setNewProduct((p) => ({ ...p, reorderThreshold: e.target.value }))} />
                  <p className="text-xs text-[#64748B] mt-1">{t('Shows as "Low Stock" once total quantity drops to this number or below.')}</p>
                </div>
                <Button className="w-full bg-[#0891B2] text-white" onClick={handleAddProduct}>{t("Save Product")}</Button>
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
                <p className="text-xs text-[#64748B]">{t(kpi.label)}</p>
                <p className="text-lg font-bold text-[#0F172A]">{kpi.value}</p>
              </div>
            </div>
          );
        })}
      </div>

      {isLoading && <div className="text-center py-8 text-[#64748B]">{t("Loading inventory...")}</div>}

      {!isLoading && (
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="bg-white border border-[#E2E8F0] h-10 p-1 rounded-lg">
          <TabsTrigger value="catalog" className="text-sm data-[state=active]:bg-[#0891B2] data-[state=active]:text-white rounded-md px-4 gap-1.5">
            <Package className="w-4 h-4" /> {t("Catalog")}
          </TabsTrigger>
          <TabsTrigger value="suppliers" className="text-sm data-[state=active]:bg-[#0891B2] data-[state=active]:text-white rounded-md px-4 gap-1.5">
            <Truck className="w-4 h-4" /> {t("Vendors")}
          </TabsTrigger>
          <TabsTrigger value="purchase" className="text-sm data-[state=active]:bg-[#0891B2] data-[state=active]:text-white rounded-md px-4 gap-1.5">
            <ShoppingCart className="w-4 h-4" /> {t("Purchase Orders")}
          </TabsTrigger>
          <TabsTrigger value="vendor-bills" className="text-sm data-[state=active]:bg-[#0891B2] data-[state=active]:text-white rounded-md px-4 gap-1.5">
            <Receipt className="w-4 h-4" /> {t("Vendor Bills")}
          </TabsTrigger>
          <TabsTrigger value="variance" className="text-sm data-[state=active]:bg-[#0891B2] data-[state=active]:text-white rounded-md px-4 gap-1.5">
            <BarChart3 className="w-4 h-4" /> {t("Variance")}
          </TabsTrigger>
          <TabsTrigger value="writeoffs" className="text-sm data-[state=active]:bg-[#0891B2] data-[state=active]:text-white rounded-md px-4 gap-1.5">
            <ClipboardX className="w-4 h-4" /> {t("Write-Offs")}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="catalog" className="mt-4 space-y-3">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#64748B]" />
              <Input placeholder={t("Search item #, name, SKU, description, category, or manufacturer...")} value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 h-10 bg-white border-[#E2E8F0]" />
            </div>
            <div className="flex gap-2">
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="h-10 w-40 bg-white border-[#E2E8F0]"><SelectValue placeholder={t("Category")} /></SelectTrigger>
                <SelectContent className="max-h-72">{dynamicCategories.map(c => <SelectItem key={c} value={c}>{c === "All" ? t("All") : c}</SelectItem>)}</SelectContent>
              </Select>
              <Button variant="outline" className="h-10 gap-2 border-[#E2E8F0]" onClick={handlePrintLabels}>
                <Tag className="w-4 h-4" /> {t("Print Labels")}{selectedIds.size > 0 ? ` (${selectedIds.size})` : ""}
              </Button>
              <Select value={barcodeSource} onValueChange={(v) => setBarcodeSource(v as "sku" | "itemNumber")}>
                <SelectTrigger className="h-10 w-32 bg-white border-[#E2E8F0]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="sku">{t("Barcode: SKU")}</SelectItem>
                  <SelectItem value="itemNumber">{t("Barcode: Item #")}</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" className="h-10 gap-2 border-[#E2E8F0]" onClick={handlePrintZebraLabels}>
                <Barcode className="w-4 h-4" /> {t("Zebra Barcode")}{selectedIds.size > 0 ? ` (${selectedIds.size})` : ""}
              </Button>
            </div>
          </div>
          <p className="text-xs text-[#64748B]">{t("Products consumed on a job are automatically deducted at close. Select rows below to print only those price labels (Avery 5160 sheet), otherwise all filtered products print.")}</p>
          <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
                    <th className="w-8 py-3 px-4"></th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-[#64748B] uppercase">{t("Item #")}</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-[#64748B] uppercase">{t("Product")}</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-[#64748B] uppercase">{t("SKU")}</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-[#64748B] uppercase">{t("Category")}</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-[#64748B] uppercase">{t("Manufacturer")}</th>
                    <th className="text-right py-3 px-4 text-xs font-semibold text-[#64748B] uppercase">{t("Store")}</th>
                    <th className="text-right py-3 px-4 text-xs font-semibold text-[#64748B] uppercase">{t("Vehicles")}</th>
                    <th className="text-right py-3 px-4 text-xs font-semibold text-[#64748B] uppercase">{t("Total")}</th>
                    <th className="text-right py-3 px-4 text-xs font-semibold text-[#64748B] uppercase">{t("Reorder")}</th>
                    <th className="text-right py-3 px-4 text-xs font-semibold text-[#64748B] uppercase">{t("Cost")}</th>
                    <th className="text-right py-3 px-4 text-xs font-semibold text-[#64748B] uppercase">{t("Price")}</th>
                    <th className="text-center py-3 px-4 text-xs font-semibold text-[#64748B] uppercase">{t("Status")}</th>
                    <th className="text-center py-3 px-4 text-xs font-semibold text-[#64748B] uppercase">QBO</th>
                    <th className="text-center py-3 px-4 text-xs font-semibold text-[#64748B] uppercase"></th>
                  </tr>
                </thead>
                <tbody>
                  {paginated.map((p) => (
                    <tr key={p.id} className={`border-b border-[#F1F5F9] last:border-0 hover:bg-[#F8FAFC] ${p.status === "Out" ? "bg-[#DC2626]/5" : p.status === "Low" ? "bg-[#F59E0B]/5" : ""}`}>
                      <td className="py-3 px-4">
                        <input type="checkbox" checked={selectedIds.has(p.id)} onChange={() => toggleSelected(p.id)} />
                      </td>
                      <td className="py-3 px-4 text-[#64748B]">{p.item_number ?? "—"}</td>
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
                      <td className="text-right py-3 px-4 text-[#0F172A]">{p.price !== null ? `$${p.price.toFixed(2)}` : "—"}</td>
                      <td className="text-center py-3 px-4">
                        <Badge className={`${statusColors[p.status]} text-[10px] px-1.5 py-0`}>{t(p.status)}</Badge>
                      </td>
                      <td className="text-center py-3 px-4">
                        <button
                          className="p-1.5 rounded hover:bg-[#F1F5F9] text-[#64748B]"
                          title={(p.qbo_accounts as QboAccounts | null)?.income ? t("QBO accounts mapped") : t("Map QBO accounts")}
                          onClick={() => openQboDialog(p)}
                        >
                          <Landmark className={`w-4 h-4 ${(p.qbo_accounts as QboAccounts | null)?.income ? "text-[#16A34A]" : ""}`} />
                        </button>
                      </td>
                      <td className="text-center py-3 px-4">
                        <button className="p-1.5 rounded hover:bg-[#F1F5F9] text-[#64748B]" title={t("Edit Product")} onClick={() => openEditProduct(p)}>
                          <Pencil className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {filtered.length > 0 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-[#E2E8F0] text-sm">
                <p className="text-[#64748B]">
                  {t("Showing")} {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} {t("of")} {filtered.length}
                </p>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" className="h-8 border-[#E2E8F0]" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                    {t("Previous")}
                  </Button>
                  <span className="text-[#64748B] text-xs">{t("Page")} {page} {t("of")} {totalPages}</span>
                  <Button variant="outline" size="sm" className="h-8 border-[#E2E8F0]" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
                    {t("Next")}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="suppliers" className="mt-4 space-y-3">
          <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#64748B]" />
              <Input placeholder={t("Search vendor, contact, address, or phone...")} value={vendorSearch} onChange={(e) => setVendorSearch(e.target.value)} className="pl-9 h-10 bg-white border-[#E2E8F0]" />
            </div>
            <Dialog open={supplierOpen} onOpenChange={setSupplierOpen}>
              <DialogTrigger asChild>
                <Button className="bg-[#0891B2] hover:bg-[#0E7490] text-white gap-2 h-10" onClick={openAddSupplier}>
                  <Plus className="w-4 h-4" /> {t("Add Vendor")}
                </Button>
              </DialogTrigger>
              <DialogContent className="max-h-[90vh] overflow-y-auto"><DialogHeader><DialogTitle>{editSupplier ? t("Edit Vendor") : t("Add Vendor")}</DialogTitle></DialogHeader>
                <div className="space-y-4 pt-2">
                  <div><Label>{t("Name")}</Label><Input className="mt-1" value={newSupplier.name} onChange={(e) => setNewSupplier((p) => ({ ...p, name: e.target.value }))} /></div>
                  <div><Label>{t("Contact")}</Label><Input className="mt-1" value={newSupplier.contact} onChange={(e) => setNewSupplier((p) => ({ ...p, contact: e.target.value }))} /></div>
                  <div><Label>{t("Phone")}</Label><Input className="mt-1" value={newSupplier.phone} onChange={(e) => setNewSupplier((p) => ({ ...p, phone: e.target.value }))} /></div>
                  <div><Label>{t("Address")}</Label><Input className="mt-1" value={newSupplier.address} onChange={(e) => setNewSupplier((p) => ({ ...p, address: e.target.value }))} /></div>
                  <div><Label>{t("Lead Time")}</Label><Input className="mt-1" placeholder={t("3-5 days")} value={newSupplier.leadTime} onChange={(e) => setNewSupplier((p) => ({ ...p, leadTime: e.target.value }))} /></div>
                  <Button className="w-full bg-[#0891B2] text-white" onClick={handleSaveSupplier}>{editSupplier ? t("Save Changes") : t("Add Vendor")}</Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
          <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
                    <th className="text-left py-3 px-4 text-xs font-semibold text-[#64748B] uppercase">{t("Vendor")}</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-[#64748B] uppercase">{t("Address")}</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-[#64748B] uppercase">{t("Contact")}</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-[#64748B] uppercase">{t("Phone")}</th>
                    <th className="text-right py-3 px-4 text-xs font-semibold text-[#64748B] uppercase">{t("Lead Time")}</th>
                    <th className="text-right py-3 px-4 text-xs font-semibold text-[#64748B] uppercase"></th>
                  </tr>
                </thead>
                <tbody>
                  {suppliers.filter((s) => {
                    const q = vendorSearch.toLowerCase();
                    if (!q) return true;
                    const address = (s as Supplier & { address: string | null }).address;
                    return [s.name, s.contact, s.phone, address].filter(Boolean).some((f) => (f as string).toLowerCase().includes(q));
                  }).map((s) => (
                    <tr key={s.id} className="border-b border-[#F1F5F9] last:border-0 hover:bg-[#F8FAFC]">
                      <td className="py-3 px-4 font-medium text-[#0F172A] cursor-pointer" onClick={() => openEditSupplier(s)}>{s.name}</td>
                      <td className="py-3 px-4 text-[#64748B] text-sm">{(s as Supplier & { address: string | null }).address}</td>
                      <td className="py-3 px-4 text-[#64748B] text-sm">{s.contact}</td>
                      <td className="py-3 px-4 text-[#64748B] text-sm">{s.phone}</td>
                      <td className="text-right py-3 px-4"><Badge className="bg-[#0891B2]/10 text-[#0891B2] text-[10px] px-1.5 py-0">{s.lead_time}</Badge></td>
                      <td className="text-right py-3 px-4">
                        <button className="text-xs text-[#0891B2] font-medium hover:underline mr-3" onClick={() => openSupplierLocations(s)}>{t("Locations")}</button>
                        <button onClick={() => openEditSupplier(s)} title={t("Edit Vendor")}><Pencil className="w-3.5 h-3.5 text-[#94A3B8] inline" /></button>
                        <button onClick={() => handleDeleteSupplier(s)} title={t("Delete Vendor")} className="ml-2"><Trash2 className="w-3.5 h-3.5 text-[#DC2626] inline" /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Client PDF 2026-09-05: "some vendors have multiple locations we put from". */}
          <Dialog open={!!locationsSupplier} onOpenChange={(open) => !open && setLocationsSupplier(null)}>
            <DialogContent className="max-h-[90vh] overflow-y-auto">
              <DialogHeader><DialogTitle>{locationsSupplier?.name} — {t("Locations")}</DialogTitle></DialogHeader>
              <div className="space-y-3 pt-2">
                {supplierLocations.map((loc) => (
                  <div key={loc.id} className="flex items-start justify-between p-3 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0]">
                    <div className="text-sm">
                      <p className="font-medium text-[#0F172A]">{loc.label}</p>
                      {loc.address && <p className="text-[#64748B]">{loc.address}</p>}
                      {(loc.contact_name || loc.phone) && <p className="text-[#64748B]">{[loc.contact_name, loc.phone].filter(Boolean).join(" · ")}</p>}
                    </div>
                    <button onClick={() => handleRemoveLocation(loc.id)} className="text-[#DC2626] text-xs">{t("Remove")}</button>
                  </div>
                ))}
                {supplierLocations.length === 0 && <p className="text-sm text-[#64748B]">{t("No additional locations yet.")}</p>}
                <div className="border-t border-[#E2E8F0] pt-3 space-y-2">
                  <p className="text-xs font-semibold text-[#64748B] uppercase">{t("Add Location")}</p>
                  <Input placeholder={t("Label (e.g. Warehouse B)")} value={newLocation.label} onChange={(e) => setNewLocation((p) => ({ ...p, label: e.target.value }))} />
                  <Input placeholder={t("Address")} value={newLocation.address} onChange={(e) => setNewLocation((p) => ({ ...p, address: e.target.value }))} />
                  <div className="grid grid-cols-2 gap-2">
                    <Input placeholder={t("Contact Name")} value={newLocation.contactName} onChange={(e) => setNewLocation((p) => ({ ...p, contactName: e.target.value }))} />
                    <Input placeholder={t("Phone")} value={newLocation.phone} onChange={(e) => setNewLocation((p) => ({ ...p, phone: e.target.value }))} />
                  </div>
                  <Button className="w-full bg-[#0891B2] text-white" onClick={handleAddLocation}>{t("Add Location")}</Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </TabsContent>

        <TabsContent value="purchase" className="mt-4 space-y-3">
          <div className="flex justify-end">
            <Dialog open={poOpen} onOpenChange={setPoOpen}>
              <DialogTrigger asChild>
                <Button className="bg-[#0891B2] hover:bg-[#0E7490] text-white gap-2 h-10"><Plus className="w-4 h-4" /> {t("New PO")}</Button>
              </DialogTrigger>
              <DialogContent className="max-h-[90vh] overflow-y-auto"><DialogHeader><DialogTitle>{t("New Purchase Order")}</DialogTitle></DialogHeader>
                <div className="space-y-4 pt-2">
                  <div><Label>{t("PO Number")}</Label><Input className="mt-1" placeholder="PO-2026-001" value={newPo.number} onChange={(e) => setNewPo((p) => ({ ...p, number: e.target.value }))} /></div>
                  <div><Label>{t("Vendor")}</Label>
                    <div className="mt-1">
                      <SearchableSelect
                        value={newPo.supplierId}
                        onChange={handlePoSupplierChange}
                        placeholder={t("Select vendor")}
                        searchPlaceholder={t("Search vendors...")}
                        options={suppliers.map((s) => ({ value: s.id, label: s.name }))}
                      />
                    </div>
                  </div>
                  {newPoLocations.length > 0 && (
                    <div><Label>{t("Order From (Location)")}</Label>
                      <Select value={newPo.locationId} onValueChange={(v) => setNewPo((p) => ({ ...p, locationId: v }))}>
                        <SelectTrigger className="mt-1"><SelectValue placeholder={t("Default / main location")} /></SelectTrigger>
                        <SelectContent>{newPoLocations.map(l => <SelectItem key={l.id} value={l.id}>{l.label}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                  )}
                  <div><Label>{t("Payment Terms")}</Label>
                    <Select
                      value={PAYMENT_TERMS_PRESETS.includes(newPo.paymentTerms) ? newPo.paymentTerms : "Custom"}
                      onValueChange={(v) => setNewPo((p) => ({ ...p, paymentTerms: v === "Custom" ? "" : v }))}
                    >
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {PAYMENT_TERMS_PRESETS.map((term) => <SelectItem key={term} value={term}>{t(term)}</SelectItem>)}
                        <SelectItem value="Custom">{t("Custom")}</SelectItem>
                      </SelectContent>
                    </Select>
                    {!PAYMENT_TERMS_PRESETS.includes(newPo.paymentTerms) && (
                      <Input className="mt-2" placeholder={t("e.g. Net 45, COD...")} value={newPo.paymentTerms} onChange={(e) => setNewPo((p) => ({ ...p, paymentTerms: e.target.value }))} />
                    )}
                  </div>
                  <div><Label>{t("Products")}</Label>
                    <div className="mt-1">
                      <PoLineItemsEditor items={newPoLineItems} onChange={setNewPoLineItems} inventoryItems={items} />
                    </div>
                  </div>
                  {poError && <p className="text-sm text-[#DC2626]">{t(poError)}</p>}
                  <Button className="w-full bg-[#0891B2] text-white" onClick={handleCreatePo}>{t("Create PO")}</Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          <Dialog open={!!poDetail} onOpenChange={(open) => !open && setPoDetail(null)}>
            <DialogContent className="max-h-[90vh] overflow-y-auto">
              <DialogHeader><DialogTitle>{t("Purchase Order")} {poDetail?.number}</DialogTitle></DialogHeader>
              <div className="space-y-4 pt-2">
                <div className="flex justify-end">
                  <Button type="button" size="sm" variant="outline" className="h-8 gap-1.5 border-[#E2E8F0]" onClick={handleViewPoPdf}>
                    <FileText className="w-3.5 h-3.5" /> {t("View PDF")}
                  </Button>
                </div>
                <div><Label>{t("PO Number")}</Label><Input className="mt-1" value={poDetailDraft.number} onChange={(e) => setPoDetailDraft((p) => ({ ...p, number: e.target.value }))} /></div>
                <div><Label>{t("Vendor")}</Label>
                  <div className="mt-1">
                    <SearchableSelect
                      value={poDetailDraft.supplierId}
                      onChange={(v) => setPoDetailDraft((p) => ({ ...p, supplierId: v }))}
                      placeholder={t("Select vendor")}
                      searchPlaceholder={t("Search vendors...")}
                      options={suppliers.map((s) => ({ value: s.id, label: s.name }))}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div><Label>{t("Status")}</Label>
                    <Select value={poDetailDraft.status} onValueChange={(v) => setPoDetailDraft((p) => ({ ...p, status: v }))}>
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Pending">{t("Pending")}</SelectItem>
                        <SelectItem value="Sent - Email">{t("Sent - Email")}</SelectItem>
                        <SelectItem value="Sent - Portal">{t("Sent - Portal")}</SelectItem>
                        <SelectItem value="Received">{t("Received")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div><Label>{t("Received Date")}</Label><Input type="date" className="mt-1" value={poDetailDraft.receivedDate} onChange={(e) => setPoDetailDraft((p) => ({ ...p, receivedDate: e.target.value }))} /></div>
                </div>
                {poDetailDraft.status === "Received" && (
                  <p className="text-xs text-[#0891B2] bg-[#0891B2]/10 rounded-lg px-3 py-2">{t("Saving as Received adds these quantities into store inventory (matched by SKU).")}</p>
                )}
                <div><Label>{t("Payment Terms")}</Label>
                  <Select
                    value={PAYMENT_TERMS_PRESETS.includes(poDetailDraft.paymentTerms) ? poDetailDraft.paymentTerms : "Custom"}
                    onValueChange={(v) => setPoDetailDraft((p) => ({ ...p, paymentTerms: v === "Custom" ? "" : v }))}
                  >
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {PAYMENT_TERMS_PRESETS.map((term) => <SelectItem key={term} value={term}>{t(term)}</SelectItem>)}
                      <SelectItem value="Custom">{t("Custom")}</SelectItem>
                    </SelectContent>
                  </Select>
                  {!PAYMENT_TERMS_PRESETS.includes(poDetailDraft.paymentTerms) && (
                    <Input className="mt-2" placeholder={t("e.g. Net 45, COD...")} value={poDetailDraft.paymentTerms} onChange={(e) => setPoDetailDraft((p) => ({ ...p, paymentTerms: e.target.value }))} />
                  )}
                </div>
                <div><Label>{t("Products")}</Label>
                  <div className="mt-1">
                    <PoLineItemsEditor items={poDetailLineItems} onChange={setPoDetailLineItems} inventoryItems={items} />
                  </div>
                </div>
                <Button className="w-full bg-[#0891B2] text-white" onClick={handleSavePoDetail}>{t("Save Changes")}</Button>
              </div>
            </DialogContent>
          </Dialog>
          <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
                    <th className="text-left py-3 px-4 text-xs font-semibold text-[#64748B] uppercase">{t("PO Number")}</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-[#64748B] uppercase">{t("Vendor")}</th>
                    <th className="text-right py-3 px-4 text-xs font-semibold text-[#64748B] uppercase">{t("Items")}</th>
                    <th className="text-right py-3 px-4 text-xs font-semibold text-[#64748B] uppercase">{t("Total")}</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-[#64748B] uppercase">{t("Date")}</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-[#64748B] uppercase">{t("Terms")}</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-[#64748B] uppercase">{t("Received")}</th>
                    <th className="text-center py-3 px-4 text-xs font-semibold text-[#64748B] uppercase">{t("Status")}</th>
                    <th className="text-center py-3 px-4 text-xs font-semibold text-[#64748B] uppercase"></th>
                  </tr>
                </thead>
                <tbody>
                  {purchaseOrders.map((po) => (
                    <tr key={po.id} className="border-b border-[#F1F5F9] last:border-0 hover:bg-[#F8FAFC] cursor-pointer" onClick={() => openPoDetail(po)}>
                      <td className="py-3 px-4 font-medium text-[#0F172A]">{po.number}</td>
                      <td className="py-3 px-4 text-[#64748B]">{po.suppliers?.name ?? "—"}{po.locations?.label ? <span className="text-xs text-[#94A3B8]"> · {po.locations.label}</span> : null}</td>
                      <td className="text-right py-3 px-4 text-[#0F172A]">{po.item_count}</td>
                      <td className="text-right py-3 px-4 font-semibold text-[#0F172A]">${po.total.toLocaleString()}</td>
                      <td className="py-3 px-4 text-[#64748B]">{po.order_date}</td>
                      <td className="py-3 px-4 text-[#64748B]">{t(po.payment_terms || "Net 30")}</td>
                      <td className="py-3 px-4 text-[#64748B]">{po.received_date || "—"}</td>
                      <td className="text-center py-3 px-4">
                        <Badge className={`${poStatusColors[po.status]} text-[10px] px-1.5 py-0`}>{t(po.status)}</Badge>
                      </td>
                      <td className="text-center py-3 px-4">
                        <button className="p-1.5 rounded hover:bg-[#E2E8F0] text-[#0891B2]" title={t("View / Edit PO")} onClick={(e) => { e.stopPropagation(); openPoDetail(po); }}>
                          <Eye className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="vendor-bills" className="mt-4 space-y-3">
          <div className="flex justify-end">
            <Dialog open={newBillOpen} onOpenChange={setNewBillOpen}>
              <DialogTrigger asChild>
                <Button className="bg-[#0891B2] hover:bg-[#0E7490] text-white gap-2 h-10"><Plus className="w-4 h-4" /> {t("New Vendor Bill")}</Button>
              </DialogTrigger>
              <DialogContent className="max-h-[90vh] overflow-y-auto"><DialogHeader><DialogTitle>{t("Create New Vendor Bill")}</DialogTitle></DialogHeader>
                <div className="space-y-4 pt-2">
                  <div><Label>{t("Vendor")}</Label>
                    <div className="mt-1">
                      <SearchableSelect
                        value={newBill.supplierId}
                        onChange={(v) => setNewBill((p) => ({ ...p, supplierId: v }))}
                        placeholder={t("Select vendor")}
                        searchPlaceholder={t("Search vendors...")}
                        options={suppliers.map((s) => ({ value: s.id, label: s.name }))}
                      />
                    </div>
                  </div>
                  <div><Label>{t("Bill Number")}</Label><Input className="mt-1" placeholder="BILL-1001" value={newBill.number} onChange={(e) => setNewBill((p) => ({ ...p, number: e.target.value }))} /></div>
                  {/* Client PDF 2026-09-15: link a bill back to the PO it's paying off, so it can be searched/found by PO number. */}
                  <div><Label>{t("Purchase Order (optional)")}</Label>
                    <div className="mt-1">
                      <SearchableSelect
                        value={newBill.poId}
                        onChange={(v) => setNewBill((p) => ({ ...p, poId: v }))}
                        placeholder={t("Link a PO (optional)")}
                        searchPlaceholder={t("Search PO number...")}
                        emptyText={t("No matching purchase orders.")}
                        options={purchaseOrders
                          .filter((po) => !newBill.supplierId || po.supplier_id === newBill.supplierId)
                          .map((po) => ({ value: po.id, label: po.number, sublabel: po.suppliers?.name ?? undefined }))}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div><Label>{t("Issue Date")}</Label><Input type="date" className="mt-1" value={newBill.issueDate} onChange={(e) => setNewBill((p) => ({ ...p, issueDate: e.target.value }))} /></div>
                    <div><Label>{t("Due Date")}</Label><Input type="date" className="mt-1" value={newBill.dueDate} onChange={(e) => setNewBill((p) => ({ ...p, dueDate: e.target.value }))} /></div>
                  </div>
                  <div><Label>{t("Amount")}</Label><Input type="number" className="mt-1" placeholder="0.00" value={newBill.amount} onChange={(e) => setNewBill((p) => ({ ...p, amount: e.target.value }))} /></div>
                  <Button className="w-full bg-[#0891B2] text-white" onClick={handleCreateBill}>{t("Create Vendor Bill")}</Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {vendorBillsDue.length > 0 && (
            <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-sm p-4">
              <p className="text-xs font-semibold text-[#64748B] uppercase mb-3">{t("Vendor Bills Due")}</p>
              <div className="flex flex-wrap gap-3">
                {vendorBillsDue.map((v) => (
                  <div key={v.supplier_id} className="flex items-center gap-2 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0] px-3 py-2">
                    <span className="text-sm font-medium text-[#0F172A]">{v.supplier_name}</span>
                    <span className="text-sm font-bold text-[#DC2626]">${v.total_due.toLocaleString()}</span>
                    <span className="text-xs text-[#64748B]">({v.bill_count} {v.bill_count === 1 ? t("bill") : t("bills")})</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#64748B]" />
            <Input placeholder={t("Search bill #, vendor, or PO number...")} value={billSearch} onChange={(e) => setBillSearch(e.target.value)} className="pl-9 h-10 bg-white border-[#E2E8F0]" />
          </div>
          <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
                    <th className="text-left py-3 px-4 text-xs font-semibold text-[#64748B] uppercase">{t("Bill #")}</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-[#64748B] uppercase">{t("PO #")}</th>
                    <th
                      className="text-left py-3 px-4 text-xs font-semibold text-[#64748B] uppercase cursor-pointer select-none hover:text-[#0891B2]"
                      onClick={() => toggleBillSort("vendor")}
                    >
                      <span className="inline-flex items-center gap-1">{t("Vendor")}{billSort.key === "vendor" && <span className="text-[10px]">{billSort.dir === "asc" ? "▲" : "▼"}</span>}</span>
                    </th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-[#64748B] uppercase">{t("Issue Date")}</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-[#64748B] uppercase">{t("Due Date")}</th>
                    <th
                      className="text-right py-3 px-4 text-xs font-semibold text-[#64748B] uppercase cursor-pointer select-none hover:text-[#0891B2]"
                      onClick={() => toggleBillSort("amount")}
                    >
                      <span className="inline-flex items-center gap-1 justify-end">{t("Amount")}{billSort.key === "amount" && <span className="text-[10px]">{billSort.dir === "asc" ? "▲" : "▼"}</span>}</span>
                    </th>
                    <th className="text-center py-3 px-4 text-xs font-semibold text-[#64748B] uppercase">{t("Status")}</th>
                    <th className="text-center py-3 px-4 text-xs font-semibold text-[#64748B] uppercase"></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredVendorBills.map((bill) => (
                    <tr key={bill.id} className="border-b border-[#F1F5F9] last:border-0 hover:bg-[#F8FAFC]">
                      <td className="py-3 px-4 font-medium text-[#0F172A]">{bill.number}</td>
                      <td className="py-3 px-4 text-[#64748B]">{bill.po_number ?? "—"}</td>
                      <td className="py-3 px-4 text-[#64748B]">{bill.suppliers?.name ?? "—"}</td>
                      <td className="py-3 px-4 text-[#64748B]">{bill.issue_date}</td>
                      <td className="py-3 px-4 text-[#64748B]">{bill.due_date ?? "—"}</td>
                      <td className="text-right py-3 px-4 font-semibold text-[#0F172A]">${bill.amount.toLocaleString()}</td>
                      <td className="text-center py-3 px-4">
                        <Badge className={`${vendorBillStatusColors[bill.status] ?? "bg-[#F1F5F9] text-[#64748B]"} text-[10px] px-1.5 py-0`}>{t(bill.status)}</Badge>
                      </td>
                      <td className="text-center py-3 px-4">
                        {bill.status !== "Paid" && (
                          <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => handleMarkBillPaid(bill.id)}>
                            {t("Mark Paid")}
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {filteredVendorBills.length === 0 && (
                    <tr><td colSpan={8} className="py-8 text-center text-[#64748B]">{t("No vendor bills yet")}</td></tr>
                  )}
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
                    <th className="text-left py-3 px-4 text-xs font-semibold text-[#64748B] uppercase">{t("Product")}</th>
                    <th className="text-right py-3 px-4 text-xs font-semibold text-[#64748B] uppercase">{t("Expected")}</th>
                    <th className="text-right py-3 px-4 text-xs font-semibold text-[#64748B] uppercase">{t("Actual")}</th>
                    <th className="text-right py-3 px-4 text-xs font-semibold text-[#64748B] uppercase">{t("Variance %")}</th>
                    <th className="text-center py-3 px-4 text-xs font-semibold text-[#64748B] uppercase">{t("Flag")}</th>
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
                        {v.flagged && <Badge className="bg-[#F59E0B]/10 text-[#F59E0B] text-[10px] px-1.5 py-0">{t("Flagged")}</Badge>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="writeoffs" className="mt-4 space-y-3">
          <div className="flex justify-end">
            <Dialog open={writeoffOpen} onOpenChange={setWriteoffOpen}>
              <DialogTrigger asChild>
                <Button className="bg-[#0891B2] hover:bg-[#0E7490] text-white gap-2 h-10"><Plus className="w-4 h-4" /> {t("Write Off SKU")}</Button>
              </DialogTrigger>
              <DialogContent className="max-h-[90vh] overflow-y-auto">
                <DialogHeader><DialogTitle>{t("Write Off SKU")}</DialogTitle></DialogHeader>
                <div className="space-y-4 pt-2">
                  <div>
                    <Label>{t("Product")}</Label>
                    <div className="mt-1">
                      <SearchableSelect
                        value={writeoffDraft.itemId}
                        onChange={(v) => setWriteoffDraft((p) => ({ ...p, itemId: v }))}
                        placeholder={t("Select product")}
                        searchPlaceholder={t("Search item #, SKU, name, or description...")}
                        emptyText={t("No matching items.")}
                        options={items.map((i) => ({
                          value: i.id,
                          label: `${i.item_number ?? i.sku} · ${i.sku} — ${i.name}`,
                          sublabel: [i.long_description, i.manufacturer].filter(Boolean).join(" · ") || undefined,
                        }))}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div><Label>{t("Quantity")}</Label><Input type="number" className="mt-1" value={writeoffDraft.quantity} onChange={(e) => setWriteoffDraft((p) => ({ ...p, quantity: e.target.value }))} /></div>
                    <div>
                      <Label>{t("Reason")}</Label>
                      <Select value={writeoffDraft.reason} onValueChange={(v) => setWriteoffDraft((p) => ({ ...p, reason: v }))}>
                        <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Store Use">{t("Store Use")}</SelectItem>
                          <SelectItem value="Truck Use">{t("Truck Use")}</SelectItem>
                          <SelectItem value="Weekly Service Use">{t("Weekly Service Use")}</SelectItem>
                          <SelectItem value="Shrinkage">{t("Shrinkage")}</SelectItem>
                          <SelectItem value="Other">{t("Other")}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div><Label>{t("Note (optional)")}</Label><Input className="mt-1" value={writeoffDraft.note} onChange={(e) => setWriteoffDraft((p) => ({ ...p, note: e.target.value }))} /></div>
                  <Button className="w-full bg-[#0891B2] text-white" onClick={handleCreateWriteoff}>{t("Save Write-Off")}</Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
          <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
                    <th className="text-left py-3 px-4 text-xs font-semibold text-[#64748B] uppercase">{t("Product")}</th>
                    <th className="text-right py-3 px-4 text-xs font-semibold text-[#64748B] uppercase">{t("Qty")}</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-[#64748B] uppercase">{t("Reason")}</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-[#64748B] uppercase">{t("Note")}</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-[#64748B] uppercase">{t("Date")}</th>
                  </tr>
                </thead>
                <tbody>
                  {writeoffs.map((w) => (
                    <tr key={w.id} className="border-b border-[#F1F5F9] last:border-0 hover:bg-[#F8FAFC]">
                      <td className="py-3 px-4 font-medium text-[#0F172A]">{w.inventory_items?.name ?? "—"}</td>
                      <td className="text-right py-3 px-4 text-[#0F172A]">{w.quantity}</td>
                      <td className="py-3 px-4"><Badge className="bg-[#F1F5F9] text-[#64748B] text-[10px] px-1.5 py-0">{t(w.reason)}</Badge></td>
                      <td className="py-3 px-4 text-[#64748B]">{w.note ?? "—"}</td>
                      <td className="py-3 px-4 text-[#64748B]">{new Date(w.created_at).toLocaleDateString()}</td>
                    </tr>
                  ))}
                  {writeoffs.length === 0 && (
                    <tr><td colSpan={5} className="py-8 text-center text-[#64748B]">{t("No write-offs yet")}</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>
      </Tabs>
      )}

      {/* QBO account mapping (client request 2026-08-27): COGS/Income/Asset accounts per item */}
      <Dialog open={!!qboDialogItem} onOpenChange={(open) => !open && setQboDialogItem(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{t("QuickBooks Accounts")} — {qboDialogItem?.name}</DialogTitle></DialogHeader>
          {qboError && <p className="text-sm text-red-600">{t(qboError)}</p>}
          {!qboError && !qboAccountList && <p className="text-sm text-[#64748B]">{t("Loading QuickBooks chart of accounts...")}</p>}
          {qboAccountList && (
            <div className="space-y-4 pt-2">
              {([
                { key: "income" as const, label: "Income Account" },
                { key: "expense" as const, label: "COGS / Expense Account" },
                { key: "asset" as const, label: "Asset Account" },
              ]).map(({ key, label }) => (
                <div key={key}>
                  <Label>{t(label)}</Label>
                  <Select
                    value={qboSelection[key]?.id ?? ""}
                    onValueChange={(v) => {
                      const account = qboAccountList.find((a) => a.id === v);
                      setQboSelection((p) => ({ ...p, [key]: account ? { id: account.id, name: account.name } : null }));
                    }}
                  >
                    <SelectTrigger className="mt-1"><SelectValue placeholder={t("Select account")} /></SelectTrigger>
                    <SelectContent>
                      {accountsByGroup(key).map((a) => (
                        <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
              <Button className="w-full bg-[#0891B2] text-white" onClick={saveQboAccounts}>{t("Save")}</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Client request 2026-09-04: full product edit, same shape as Add Product plus every
          other field a real item carries (barcode, distributor, unit, taxable). */}
      <Dialog open={!!editProductItem} onOpenChange={(open) => !open && setEditProductItem(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{t("Edit Product")} — {editProductItem?.name}</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            {/* Client request 2026-09-04: "if stock runs out, be able to mark it Out; if it's
                back, mark it In Stock" — status is computed live from real quantity everywhere
                else in the app, so this edits the actual Store quantity + reorder threshold that
                drive it, with quick buttons for the common cases. */}
            {editProductItem && (() => {
              const storeQty = parseInt(editProductDraft.storeQuantity, 10) || 0;
              const threshold = parseInt(editProductDraft.reorderThreshold, 10) || 0;
              const total = storeQty + editProductItem.vehicleQty;
              const previewStatus = total === 0 ? "Out" : total <= threshold ? "Low" : "In Stock";
              return (
                <div className="rounded-lg border border-[#E2E8F0] p-3 space-y-3 bg-[#F8FAFC]">
                  <div className="flex items-center justify-between">
                    <Label>{t("Store Stock Quantity")}</Label>
                    <Badge className={`${statusColors[previewStatus]} text-[10px] px-1.5 py-0`}>{t(previewStatus)}</Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <Input
                      type="number"
                      value={editProductDraft.storeQuantity}
                      onChange={(e) => setEditProductDraft((p) => ({ ...p, storeQuantity: e.target.value }))}
                    />
                    <div className="flex gap-2">
                      <Button type="button" size="sm" variant="outline" className="flex-1 border-[#E2E8F0]" onClick={() => setEditProductDraft((p) => ({ ...p, storeQuantity: "0" }))}>
                        {t("Mark Out")}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="flex-1 border-[#E2E8F0]"
                        onClick={() => setEditProductDraft((p) => ({ ...p, storeQuantity: String(Math.max(threshold + 1, 1)) }))}
                      >
                        {t("Mark In Stock")}
                      </Button>
                    </div>
                  </div>
                  <p className="text-xs text-[#64748B]">
                    {t("Vehicle stock")} ({editProductItem.vehicleQty}) {t("is managed separately and isn't editable here.")}
                  </p>
                </div>
              );
            })()}
            <div><Label>{t("Name")}</Label><Input className="mt-1" value={editProductDraft.name} onChange={(e) => setEditProductDraft((p) => ({ ...p, name: e.target.value }))} /></div>
            <div><Label>{t("SKU")}</Label><Input className="mt-1" value={editProductDraft.sku} onChange={(e) => setEditProductDraft((p) => ({ ...p, sku: e.target.value }))} /></div>
            {categoryTaxonomy.length > 0 ? (
              <CategoryPicker
                taxonomy={categoryTaxonomy}
                category={editProductDraft.category}
                subcategory={editProductDraft.subcategory}
                subSubcategory={editProductDraft.subSubcategory}
                subSubSubcategory={editProductDraft.subSubSubcategory}
                onChange={(next) => setEditProductDraft((p) => ({ ...p, ...next }))}
              />
            ) : (
              <div><Label>{t("Category")}</Label><Input className="mt-1" list="inventory-categories" value={editProductDraft.category} onChange={(e) => setEditProductDraft((p) => ({ ...p, category: e.target.value }))} /></div>
            )}
            <div><Label>{t("Unit")}</Label><Input className="mt-1" placeholder="ea" value={editProductDraft.unit} onChange={(e) => setEditProductDraft((p) => ({ ...p, unit: e.target.value }))} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>{t("Cost (internal)")}</Label><Input className="mt-1" type="number" value={editProductDraft.unitCost} onChange={(e) => setEditProductDraft((p) => ({ ...p, unitCost: e.target.value }))} /></div>
              <div><Label>{t("Price (customer-facing)")}</Label><Input className="mt-1" type="number" value={editProductDraft.price} onChange={(e) => setEditProductDraft((p) => ({ ...p, price: e.target.value }))} /></div>
            </div>
            <div><Label>{t("Short Description")}</Label><Input className="mt-1" value={editProductDraft.shortDescription} onChange={(e) => setEditProductDraft((p) => ({ ...p, shortDescription: e.target.value }))} /></div>
            <div><Label>{t("Long Description")}</Label><Input className="mt-1" value={editProductDraft.longDescription} onChange={(e) => setEditProductDraft((p) => ({ ...p, longDescription: e.target.value }))} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>{t("Department")}</Label><Input className="mt-1" value={editProductDraft.department} onChange={(e) => setEditProductDraft((p) => ({ ...p, department: e.target.value }))} /></div>
              <div><Label>{t("Sub-department")}</Label><Input className="mt-1" value={editProductDraft.subDepartment} onChange={(e) => setEditProductDraft((p) => ({ ...p, subDepartment: e.target.value }))} /></div>
            </div>
            <div><Label>{t("Manufacturer")}</Label><Input className="mt-1" value={editProductDraft.manufacturer} onChange={(e) => setEditProductDraft((p) => ({ ...p, manufacturer: e.target.value }))} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>{t("Barcode")}</Label><Input className="mt-1" value={editProductDraft.barcode} onChange={(e) => setEditProductDraft((p) => ({ ...p, barcode: e.target.value }))} /></div>
              <div><Label>{t("Default Distributor")}</Label><Input className="mt-1" value={editProductDraft.defaultDistributor} onChange={(e) => setEditProductDraft((p) => ({ ...p, defaultDistributor: e.target.value }))} /></div>
            </div>
            <div>
              <Label>{t("Reorder Threshold")}</Label>
              <Input className="mt-1" type="number" value={editProductDraft.reorderThreshold} onChange={(e) => setEditProductDraft((p) => ({ ...p, reorderThreshold: e.target.value }))} />
              <p className="text-xs text-[#64748B] mt-1">{t('Shows as "Low Stock" once total quantity drops to this number or below.')}</p>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-[#E2E8F0] px-3 py-2.5">
              <Label className="cursor-pointer" htmlFor="edit-taxable">{t("Taxable")}</Label>
              <Switch id="edit-taxable" checked={editProductDraft.taxable} onCheckedChange={(v) => setEditProductDraft((p) => ({ ...p, taxable: v }))} />
            </div>
            <Button className="w-full bg-[#0891B2] text-white" onClick={saveEditProduct}>{t("Save Changes")}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
