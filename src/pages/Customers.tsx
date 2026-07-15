import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Plus, Phone, MessageSquare, Mail, LayoutGrid, Table2, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { customers } from "@/lib/data";

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
  const [viewMode, setViewMode] = useState<"table" | "grid">("table");
  const [addOpen, setAddOpen] = useState(false);
  const navigate = useNavigate();

  const filtered = customers.filter((c) => {
    const matchesSearch =
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.address.toLowerCase().includes(search.toLowerCase());
    const matchesTag = tagFilter === "All" || c.tags.includes(tagFilter);
    return matchesSearch && matchesTag;
  });

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
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Add New Customer</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>First Name</Label>
                  <Input placeholder="First" className="mt-1" />
                </div>
                <div>
                  <Label>Last Name</Label>
                  <Input placeholder="Last" className="mt-1" />
                </div>
              </div>
              <div>
                <Label>Email</Label>
                <Input placeholder="customer@email.com" className="mt-1" />
              </div>
              <div>
                <Label>Phone</Label>
                <Input placeholder="(512) 555-0000" className="mt-1" />
              </div>
              <div>
                <Label>Property Address</Label>
                <Input placeholder="123 Main St, Austin, TX" className="mt-1" />
              </div>
              <div>
                <Label>Customer Type</Label>
                <div className="flex gap-2 mt-2">
                  <Badge className="cursor-pointer bg-[#0891B2]/10 text-[#0891B2]">Residential</Badge>
                  <Badge className="cursor-pointer bg-[#F59E0B]/10 text-[#F59E0B]">Commercial</Badge>
                </div>
              </div>
              <Button className="w-full bg-[#0891B2] hover:bg-[#0E7490] text-white" onClick={() => setAddOpen(false)}>
                Save Customer
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
        </div>
      </div>

      {/* Table View */}
      {viewMode === "table" && (
        <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
                  <th className="text-left py-3 px-4 text-xs font-semibold text-[#64748B] uppercase">Customer</th>
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
                    <td className="py-3 px-4 text-[#64748B]">{c.lastService}</td>
                    <td className="text-right py-3 px-4 font-semibold text-[#0F172A]">${c.lifetimeValue.toLocaleString()}</td>
                    <td className="text-center py-3 px-4">
                      <div className="flex items-center justify-center gap-1">
                        <button className="p-1.5 rounded hover:bg-[#F8FAFC] text-[#0891B2]" onClick={(e) => e.stopPropagation()}>
                          <Phone className="w-4 h-4" />
                        </button>
                        <button className="p-1.5 rounded hover:bg-[#F8FAFC] text-[#0891B2]" onClick={(e) => e.stopPropagation()}>
                          <MessageSquare className="w-4 h-4" />
                        </button>
                        <button className="p-1.5 rounded hover:bg-[#F8FAFC] text-[#0891B2]" onClick={(e) => e.stopPropagation()}>
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
      {viewMode === "grid" && (
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
                  <p className="text-lg font-bold text-[#0F172A]">${c.lifetimeValue.toLocaleString()}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-[#64748B]">Last Service</p>
                  <p className="text-sm font-medium text-[#0F172A]">{c.lastService}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
