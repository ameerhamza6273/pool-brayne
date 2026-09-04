import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Plus, Phone, MessageSquare, Mail, LayoutGrid, Table2, MapPin, X, Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { customersApi } from "@/lib/api/customers";
import { formatPhoneInput } from "@/lib/phone";
import AddressAutocomplete from "@/components/AddressAutocomplete";
import type { Database } from "@/lib/database.types";

type Customer = Database["public"]["Tables"]["customers"]["Row"];

const tagFilters = ["All", "Residential", "Commercial", "VIP", "Lapsed", "Seasonal"];
const tagColors: Record<string, string> = {
  Residential: "bg-[#0891B2]/10 text-[#0891B2]",
  Commercial: "bg-[#F59E0B]/10 text-[#F59E0B]",
  VIP: "bg-[#16A34A]/10 text-[#16A34A]",
  Lapsed: "bg-[#DC2626]/10 text-[#DC2626]",
  Seasonal: "bg-[#8B5CF6]/10 text-[#8B5CF6]",
};

export default function Customers() {
  const [search, setSearch] = useState("");
  const [tagFilter, setTagFilter] = useState("All");
  const [viewMode, setViewMode] = useState<"table" | "grid" | "reminders">("table");
  const [addOpen, setAddOpen] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const emptyContact = { firstName: "", lastName: "", email: "", phone: "" };
  const [newCustomer, setNewCustomer] = useState({ address: "", type: "Residential", contacts: [{ ...emptyContact }] });
  const navigate = useNavigate();

  const loadCustomers = useCallback(async () => {
    setIsLoading(true);
    const data = await customersApi.list();
    setCustomers(data ?? []);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    loadCustomers();
  }, [loadCustomers]);

  const handleAddCustomer = async () => {
    const validContacts = newCustomer.contacts.filter((c) => c.firstName && c.lastName);
    if (validContacts.length === 0) return;
    await customersApi.create({
      contacts: validContacts.map((c) => ({
        firstName: c.firstName,
        lastName: c.lastName,
        email: c.email || null,
        phone: c.phone || null,
      })),
      type: newCustomer.type,
      tags: [newCustomer.type],
      address: newCustomer.address || null,
    });
    setNewCustomer({ address: "", type: "Residential", contacts: [{ ...emptyContact }] });
    setAddOpen(false);
    loadCustomers();
  };

  const updateContact = (index: number, field: keyof typeof emptyContact, value: string) => {
    setNewCustomer((p) => ({
      ...p,
      contacts: p.contacts.map((c, i) => (i === index ? { ...c, [field]: value } : c)),
    }));
  };

  const addContactRow = () => {
    setNewCustomer((p) => ({ ...p, contacts: [...p.contacts, { ...emptyContact }] }));
  };

  const removeContactRow = (index: number) => {
    setNewCustomer((p) => ({ ...p, contacts: p.contacts.filter((_, i) => i !== index) }));
  };

  const filtered = customers.filter((c) => {
    const matchesSearch =
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      (c.address ?? "").toLowerCase().includes(search.toLowerCase());
    const matchesTag = tagFilter === "All" || c.tags.includes(tagFilter);
    return matchesSearch && matchesTag;
  });

  // Client request 2026-08-28: periodic service reminders (repeat jobs 2-3x/year) — no real
  // notification channel is wired up, so "auto-remind" surfaces here as a due/overdue list with
  // a badge count, rather than an actual push/SMS/email.
  const today = new Date().toISOString().slice(0, 10);
  const withReminders = customers
    .filter((c) => c.next_reminder_date)
    .sort((a, b) => (a.next_reminder_date! < b.next_reminder_date! ? -1 : 1));
  const dueReminders = withReminders.filter((c) => c.next_reminder_date! <= today);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h1 className="text-2xl font-bold text-[#0F172A]">Customers</h1>
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger asChild>
            <Button className="bg-[#0891B2] hover:bg-[#0E7490] text-white gap-2 h-10">
              <Plus className="w-4 h-4" />
              Add Customer
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Add New Customer</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div>
                <Label>Customer Type</Label>
                <div className="flex gap-2 mt-2">
                  <Badge
                    className={`cursor-pointer ${newCustomer.type === "Residential" ? "bg-[#0891B2] text-white" : "bg-[#0891B2]/10 text-[#0891B2]"}`}
                    onClick={() => setNewCustomer((p) => ({ ...p, type: "Residential" }))}
                  >
                    Residential
                  </Badge>
                  <Badge
                    className={`cursor-pointer ${newCustomer.type === "Commercial" ? "bg-[#F59E0B] text-white" : "bg-[#F59E0B]/10 text-[#F59E0B]"}`}
                    onClick={() => setNewCustomer((p) => ({ ...p, type: "Commercial" }))}
                  >
                    Commercial
                  </Badge>
                </div>
              </div>
              <div>
                <Label>Property Address</Label>
                <AddressAutocomplete
                  placeholder="123 Main St, Austin, TX"
                  className="mt-1"
                  value={newCustomer.address}
                  onChange={(address) => setNewCustomer((p) => ({ ...p, address }))}
                />
                <p className="text-xs text-[#64748B] mt-1">Shared by every contact added below.</p>
              </div>

              <div className="space-y-3">
                {newCustomer.contacts.map((contact, index) => (
                  <div key={index} className="rounded-lg border border-[#E2E8F0] p-3 space-y-3 relative">
                    {newCustomer.contacts.length > 1 && (
                      <button
                        type="button"
                        className="absolute top-2 right-2 p-1 rounded hover:bg-[#F1F5F9] text-[#64748B]"
                        onClick={() => removeContactRow(index)}
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <p className="text-xs font-semibold text-[#64748B] uppercase">
                      {newCustomer.contacts.length > 1 ? `Customer ${index + 1}` : "Customer"}
                    </p>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label>First Name</Label>
                        <Input placeholder="First" className="mt-1" value={contact.firstName} onChange={(e) => updateContact(index, "firstName", e.target.value)} />
                      </div>
                      <div>
                        <Label>Last Name</Label>
                        <Input placeholder="Last" className="mt-1" value={contact.lastName} onChange={(e) => updateContact(index, "lastName", e.target.value)} />
                      </div>
                    </div>
                    <div>
                      <Label>Phone</Label>
                      <Input placeholder="(512) 555-0000" className="mt-1" value={contact.phone} onChange={(e) => updateContact(index, "phone", formatPhoneInput(e.target.value))} />
                    </div>
                    <div>
                      <Label>Email</Label>
                      <Input placeholder="customer@email.com" className="mt-1" value={contact.email} onChange={(e) => updateContact(index, "email", e.target.value)} />
                    </div>
                  </div>
                ))}
              </div>

              <Button variant="outline" className="w-full gap-2 border-dashed border-[#0891B2] text-[#0891B2]" onClick={addContactRow}>
                <Plus className="w-4 h-4" />
                Add Another Customer at This Address
              </Button>

              <Button className="w-full bg-[#0891B2] hover:bg-[#0E7490] text-white" onClick={handleAddCustomer}>
                Save Customer{newCustomer.contacts.length > 1 ? "s" : ""}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#64748B]" />
          <Input
            placeholder="Search customers..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-10 bg-white border-[#E2E8F0]"
          />
        </div>
        <div className="flex items-center gap-2 overflow-x-auto">
          {tagFilters.map((tag) => (
            <button
              key={tag}
              onClick={() => setTagFilter(tag)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                tagFilter === tag
                  ? "bg-[#0891B2] text-white"
                  : "bg-white text-[#64748B] border border-[#E2E8F0] hover:bg-[#F8FAFC]"
              }`}
            >
              {tag}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1 ml-auto">
          <button
            onClick={() => setViewMode("table")}
            className={`p-2 rounded-lg ${viewMode === "table" ? "bg-[#0891B2]/10 text-[#0891B2]" : "text-[#64748B] hover:bg-[#F8FAFC]"}`}
          >
            <Table2 className="w-4 h-4" />
          </button>
          <button
            onClick={() => setViewMode("grid")}
            className={`p-2 rounded-lg ${viewMode === "grid" ? "bg-[#0891B2]/10 text-[#0891B2]" : "text-[#64748B] hover:bg-[#F8FAFC]"}`}
          >
            <LayoutGrid className="w-4 h-4" />
          </button>
          <button
            onClick={() => setViewMode("reminders")}
            title="Service Reminders"
            className={`p-2 rounded-lg relative ${viewMode === "reminders" ? "bg-[#0891B2]/10 text-[#0891B2]" : "text-[#64748B] hover:bg-[#F8FAFC]"}`}
          >
            <Bell className="w-4 h-4" />
            {dueReminders.length > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[#DC2626] text-white text-[9px] flex items-center justify-center">
                {dueReminders.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {isLoading && <div className="text-center py-8 text-[#64748B]">Loading customers...</div>}

      {/* Table View */}
      {!isLoading && viewMode === "table" && (
        <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
                  <th className="text-left py-3 px-4 text-xs font-semibold text-[#64748B] uppercase">Customer</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-[#64748B] uppercase">Phone</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-[#64748B] uppercase">Type</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-[#64748B] uppercase">Address</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-[#64748B] uppercase">Last Service</th>
                  <th className="text-right py-3 px-4 text-xs font-semibold text-[#64748B] uppercase">LTV</th>
                  <th className="text-center py-3 px-4 text-xs font-semibold text-[#64748B] uppercase">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => (
                  <tr
                    key={c.id}
                    className="border-b border-[#F1F5F9] last:border-0 hover:bg-[#F8FAFC] cursor-pointer transition-colors"
                    onClick={() => navigate(`/customers/${c.id}`)}
                  >
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <Avatar className="w-8 h-8">
                          <AvatarFallback className="bg-[#0891B2]/10 text-[#0891B2] text-xs font-semibold">
                            {c.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="font-medium text-[#0F172A]">{c.name}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-[#64748B]">{c.phone || "—"}</td>
                    <td className="py-3 px-4">
                      <div className="flex gap-1 flex-wrap">
                        {c.tags.map((tag) => (
                          <Badge key={tag} className={`${tagColors[tag] || "bg-[#E2E8F0] text-[#64748B]"} text-[10px] px-1.5 py-0`}>
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-[#64748B] max-w-[200px] truncate">{c.address}</td>
                    <td className="py-3 px-4 text-[#64748B]">{c.last_service}</td>
                    <td className="text-right py-3 px-4 font-semibold text-[#0F172A]">${c.lifetime_value.toLocaleString()}</td>
                    <td className="text-center py-3 px-4">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          className="p-1.5 rounded hover:bg-[#F8FAFC] text-[#0891B2] disabled:opacity-30"
                          disabled={!c.phone}
                          onClick={(e) => { e.stopPropagation(); if (c.phone) window.location.href = `tel:${c.phone}`; }}
                        >
                          <Phone className="w-4 h-4" />
                        </button>
                        <button
                          className="p-1.5 rounded hover:bg-[#F8FAFC] text-[#0891B2] disabled:opacity-30"
                          disabled={!c.phone}
                          onClick={(e) => { e.stopPropagation(); if (c.phone) window.location.href = `sms:${c.phone}`; }}
                        >
                          <MessageSquare className="w-4 h-4" />
                        </button>
                        <button
                          className="p-1.5 rounded hover:bg-[#F8FAFC] text-[#0891B2] disabled:opacity-30"
                          disabled={!c.email}
                          onClick={(e) => { e.stopPropagation(); if (c.email) window.location.href = `mailto:${c.email}`; }}
                        >
                          <Mail className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-3 border-t border-[#E2E8F0] text-sm text-[#64748B]">
            Showing {filtered.length} of {customers.length} customers
          </div>
        </div>
      )}

      {/* Grid View */}
      {!isLoading && viewMode === "grid" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((c) => (
            <div
              key={c.id}
              className="bg-white rounded-xl p-5 border border-[#E2E8F0] shadow-sm hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => navigate(`/customers/${c.id}`)}
            >
              <div className="flex items-start gap-3">
                <Avatar className="w-12 h-12">
                  <AvatarFallback className="bg-[#0891B2]/10 text-[#0891B2] text-sm font-semibold">
                    {c.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-[#0F172A] truncate">{c.name}</h3>
                  <div className="flex gap-1 mt-1 flex-wrap">
                    {c.tags.map((tag) => (
                      <Badge key={tag} className={`${tagColors[tag] || "bg-[#E2E8F0] text-[#64748B]"} text-[10px] px-1.5 py-0`}>
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
              <div className="mt-3 space-y-1.5">
                <div className="flex items-center gap-2 text-sm text-[#64748B]">
                  <MapPin className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">{c.address}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-[#64748B]">
                  <Phone className="w-3.5 h-3.5 shrink-0" />
                  <span>{c.phone}</span>
                </div>
              </div>
              <div className="mt-3 pt-3 border-t border-[#F1F5F9] flex items-center justify-between">
                <div>
                  <p className="text-xs text-[#64748B]">Lifetime Value</p>
                  <p className="text-lg font-bold text-[#0F172A]">${c.lifetime_value.toLocaleString()}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-[#64748B]">Last Service</p>
                  <p className="text-sm font-medium text-[#0F172A]">{c.last_service}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Service Reminders View */}
      {!isLoading && viewMode === "reminders" && (
        <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-sm overflow-hidden">
          <div className="divide-y divide-[#F1F5F9]">
            {withReminders.map((c) => {
              const overdue = c.next_reminder_date! <= today;
              return (
                <button
                  key={c.id}
                  className="w-full text-left p-4 flex items-center gap-4 hover:bg-[#F8FAFC]"
                  onClick={() => navigate(`/customers/${c.id}`)}
                >
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${overdue ? "bg-[#DC2626]/10" : "bg-[#F59E0B]/10"}`}>
                    <Bell className={`w-5 h-5 ${overdue ? "text-[#DC2626]" : "text-[#F59E0B]"}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-[#0F172A]">{c.name}</p>
                    <p className="text-xs text-[#64748B]">{c.address}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className={`text-sm font-semibold ${overdue ? "text-[#DC2626]" : "text-[#0F172A]"}`}>
                      {overdue ? "Overdue" : "Due"} {c.next_reminder_date}
                    </p>
                    <p className="text-xs text-[#64748B]">every {c.reminder_frequency_months ?? "—"} months</p>
                  </div>
                </button>
              );
            })}
            {withReminders.length === 0 && (
              <div className="p-8 text-center text-[#64748B]">
                No service reminders set yet — set one from a customer's detail page.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
