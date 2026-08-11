import { useParams, useNavigate } from "react-router-dom";
import { useEffect, useState, useCallback, useRef } from "react";
import {
  Phone, MessageSquare, Mail, ArrowLeft, MapPin,
  Wrench, FileText, Camera, Plus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { customersApi, type CustomerAttachment } from "@/lib/api/customers";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import type { Database } from "@/lib/database.types";

type Customer = Database["public"]["Tables"]["customers"]["Row"];
type ServiceHistory = Database["public"]["Tables"]["job_service_history"]["Row"];
type CustomerNote = Database["public"]["Tables"]["customer_notes"]["Row"];
type Invoice = Database["public"]["Tables"]["invoices"]["Row"];

const tagColors: Record<string, string> = {
  Residential: "bg-[#0891B2]/10 text-[#0891B2]",
  Commercial: "bg-[#F59E0B]/10 text-[#F59E0B]",
  VIP: "bg-[#16A34A]/10 text-[#16A34A]",
  Lapsed: "bg-[#DC2626]/10 text-[#DC2626]",
  Seasonal: "bg-[#8B5CF6]/10 text-[#8B5CF6]",
};

const statusColors: Record<string, string> = {
  Completed: "bg-[#16A34A]/10 text-[#16A34A]",
  Paid: "bg-[#16A34A]/10 text-[#16A34A]",
  Sent: "bg-[#0891B2]/10 text-[#0891B2]",
  Draft: "bg-[#F59E0B]/10 text-[#F59E0B]",
  Overdue: "bg-[#DC2626]/10 text-[#DC2626]",
};

export default function CustomerDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, tenantId } = useAuth();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [history, setHistory] = useState<ServiceHistory[]>([]);
  const [notes, setNotes] = useState<CustomerNote[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [photos, setPhotos] = useState<CustomerAttachment[]>([]);
  const [newNote, setNewNote] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [qboSyncing, setQboSyncing] = useState(false);
  const [qboError, setQboError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setIsLoading(true);
    try {
      const bundle = await customersApi.detail(id);
      setCustomer(bundle.customer);
      setHistory(bundle.history);
      setNotes(bundle.notes);
      setInvoices(bundle.invoices);
      const attachments = await customersApi.getAttachments(id);
      setPhotos(attachments);
    } catch {
      setCustomer(null);
    }
    setIsLoading(false);
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!id || !e.target.files) return;
    for (const file of Array.from(e.target.files)) {
      const path = `${tenantId}/${id}/photo-${Date.now()}-${file.name}`;
      const { error } = await supabase.storage.from("customer-attachments").upload(path, file);
      if (error) continue;
      const { data } = supabase.storage.from("customer-attachments").getPublicUrl(path);
      const attachment = await customersApi.addAttachment(id, data.publicUrl);
      setPhotos((prev) => [...prev, attachment]);
    }
    e.target.value = "";
  };

  const handleAddNote = async () => {
    if (!id || !newNote.trim()) return;
    await customersApi.addNote(id, { text: newNote.trim(), author: user?.name ?? "You" });
    setNewNote("");
    load();
  };

  const handleSyncToQuickbooks = async () => {
    if (!id) return;
    setQboSyncing(true);
    setQboError(null);
    try {
      await customersApi.syncToQuickbooks(id);
      await load();
    } catch (err) {
      setQboError(err instanceof Error ? err.message : "QuickBooks sync failed");
    }
    setQboSyncing(false);
  };

  if (isLoading) {
    return <div className="text-center py-20 text-[#64748B]">Loading customer...</div>;
  }

  if (!customer) {
    return (
      <div className="text-center py-20">
        <p className="text-[#64748B]">Customer not found</p>
        <Button onClick={() => navigate("/customers")} className="mt-4 bg-[#0891B2] text-white">Back to Customers</Button>
      </div>
    );
  }

  const initials = customer.name.split(" ").map((n) => n[0]).join("").slice(0, 2);
  const equipment = (customer.equipment ?? {}) as Record<string, string>;
  const gateCodes = (customer.gate_codes ?? {}) as Record<string, string>;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate("/customers")} className="p-2 rounded-lg hover:bg-[#F8FAFC] text-[#64748B]">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
            <h1 className="text-xl font-bold text-[#0F172A]">{customer.name}</h1>
            <div className="flex gap-1">
              {customer.tags.map((tag) => (
                <Badge key={tag} className={`${tagColors[tag] || ""} text-[10px] px-1.5 py-0`}>{tag}</Badge>
              ))}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            className="bg-[#0891B2] hover:bg-[#0E7490] text-white gap-1.5 h-9"
            disabled={!customer.phone}
            onClick={() => customer.phone && (window.location.href = `tel:${customer.phone}`)}
          >
            <Phone className="w-4 h-4" />
            <span className="hidden sm:inline">Call</span>
          </Button>
          <Button
            size="sm"
            className="bg-[#0891B2] hover:bg-[#0E7490] text-white gap-1.5 h-9"
            disabled={!customer.phone}
            onClick={() => customer.phone && (window.location.href = `sms:${customer.phone}`)}
          >
            <MessageSquare className="w-4 h-4" />
            <span className="hidden sm:inline">Text</span>
          </Button>
          <Button
            size="sm"
            className="bg-[#0891B2] hover:bg-[#0E7490] text-white gap-1.5 h-9"
            disabled={!customer.email}
            onClick={() => customer.email && (window.location.href = `mailto:${customer.email}`)}
          >
            <Mail className="w-4 h-4" />
            <span className="hidden sm:inline">Email</span>
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5 h-9 border-[#E2E8F0] text-[#0F172A]"
            onClick={handleSyncToQuickbooks}
            disabled={qboSyncing || !!customer.qbo_customer_id}
          >
            {customer.qbo_customer_id ? "Synced to QuickBooks" : qboSyncing ? "Syncing..." : "Sync to QuickBooks"}
          </Button>
        </div>
      </div>
      {qboError && <div className="text-xs text-red-600">{qboError}</div>}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left Column */}
        <div className="space-y-4">
          {/* Contact Info */}
          <Card className="border-[#E2E8F0] shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-[#0F172A]">Contact Info</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 pt-0">
              <div className="flex items-center gap-3">
                <Avatar className="w-14 h-14">
                  <AvatarFallback className="bg-[#0891B2] text-white text-lg font-semibold">{initials}</AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-semibold text-[#0F172A]">{customer.name}</p>
                  <p className="text-sm text-[#64748B]">{customer.type}</p>
                </div>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2 text-[#64748B]">
                  <Phone className="w-4 h-4 shrink-0 text-[#0891B2]" />
                  <span>{customer.phone}</span>
                </div>
                <div className="flex items-center gap-2 text-[#64748B]">
                  <Mail className="w-4 h-4 shrink-0 text-[#0891B2]" />
                  <span className="truncate">{customer.email}</span>
                </div>
                <div className="flex items-start gap-2 text-[#64748B]">
                  <MapPin className="w-4 h-4 shrink-0 text-[#0891B2] mt-0.5" />
                  <span>{customer.address}</span>
                </div>
              </div>
              {/* Map placeholder */}
              <div className="h-32 rounded-lg bg-[#F1F5F9] flex items-center justify-center">
                <div className="text-center">
                  <MapPin className="w-6 h-6 text-[#0891B2] mx-auto mb-1" />
                  <p className="text-xs text-[#64748B]">Map view</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Equipment on File */}
          <Card className="border-[#E2E8F0] shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-[#0F172A]">Equipment on File</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 pt-0">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-xs text-[#64748B] uppercase">Pump</p>
                  <p className="font-medium text-[#0F172A]">{equipment.pump}</p>
                </div>
                <div>
                  <p className="text-xs text-[#64748B] uppercase">Heater</p>
                  <p className="font-medium text-[#0F172A]">{equipment.heater}</p>
                </div>
                <div>
                  <p className="text-xs text-[#64748B] uppercase">Filter</p>
                  <p className="font-medium text-[#0F172A]">{equipment.filter}</p>
                </div>
                <div>
                  <p className="text-xs text-[#64748B] uppercase">Salt System</p>
                  <p className="font-medium text-[#0F172A]">{equipment.salt}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Gate Codes / Access Info */}
          <Card className="border-[#E2E8F0] shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-[#0F172A]">Gate Codes & Access</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 pt-0">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-[#64748B] uppercase mb-1">Front Gate Code</p>
                  <Input placeholder="e.g. #1234" className="h-9 text-sm" defaultValue={gateCodes.frontGate || ""} />
                </div>
                <div>
                  <p className="text-xs text-[#64748B] uppercase mb-1">House Gate Code</p>
                  <Input placeholder="e.g. #5678" className="h-9 text-sm" defaultValue={gateCodes.houseGate || ""} />
                </div>
                <div>
                  <p className="text-xs text-[#64748B] uppercase mb-1">Padlock Code</p>
                  <Input placeholder="e.g. 0000" className="h-9 text-sm" defaultValue={gateCodes.padlock || ""} />
                </div>
                <div>
                  <p className="text-xs text-[#64748B] uppercase mb-1">Gated Subdivision Entrance</p>
                  <Select defaultValue={gateCodes.subdivisionEntrance || "none"}>
                    <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No gated subdivision</SelectItem>
                      <SelectItem value="call">Call box at entrance</SelectItem>
                      <SelectItem value="code">Keypad code at entrance</SelectItem>
                      <SelectItem value="remote">Remote / transponder</SelectItem>
                      <SelectItem value="guard">Guard / attendant</SelectItem>
                      <SelectItem value="open">Open access (no code needed)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <p className="text-xs text-[#64748B] uppercase mb-1">Access Notes</p>
                <Textarea placeholder="e.g. Dog in backyard, key under mat, etc." className="text-sm" rows={2} defaultValue={gateCodes.notes || ""} />
              </div>
            </CardContent>
          </Card>
        </div>
        <div className="lg:col-span-2">
          <Tabs defaultValue="history" className="w-full">
            <TabsList className="bg-white border border-[#E2E8F0] w-full justify-start h-10 p-1 rounded-lg mb-4">
              <TabsTrigger value="history" className="text-sm data-[state=active]:bg-[#0891B2] data-[state=active]:text-white rounded-md px-4">Service History</TabsTrigger>
              <TabsTrigger value="purchases" className="text-sm data-[state=active]:bg-[#0891B2] data-[state=active]:text-white rounded-md px-4">Purchases</TabsTrigger>
              <TabsTrigger value="notes" className="text-sm data-[state=active]:bg-[#0891B2] data-[state=active]:text-white rounded-md px-4">Notes</TabsTrigger>
              <TabsTrigger value="invoices" className="text-sm data-[state=active]:bg-[#0891B2] data-[state=active]:text-white rounded-md px-4">Invoices</TabsTrigger>
            </TabsList>

            <TabsContent value="history" className="mt-0">
              <Card className="border-[#E2E8F0] shadow-sm">
                <CardContent className="p-0">
                  <div className="divide-y divide-[#F1F5F9]">
                    {history.map((h) => (
                      <div key={h.id} className="p-4 flex items-center gap-4">
                        <div className="w-12 h-12 rounded-lg bg-[#0891B2]/10 flex items-center justify-center shrink-0">
                          <Wrench className="w-5 h-5 text-[#0891B2]" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-[#0F172A]">{h.type}</p>
                            <Badge className={`${statusColors[h.status] || ""} text-[10px] px-1.5 py-0`}>{h.status}</Badge>
                          </div>
                          <p className="text-sm text-[#64748B]">{h.service_date} &middot; {h.tech}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="font-semibold text-[#0F172A]">${h.amount}</p>
                        </div>
                      </div>
                    ))}
                    {history.length === 0 && (
                      <div className="p-8 text-center text-[#64748B]">No service history yet</div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="purchases" className="mt-0">
              <Card className="border-[#E2E8F0] shadow-sm">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-4">
                    <Badge className="bg-[#16A34A]/10 text-[#16A34A]">Synced from QuickBooks</Badge>
                  </div>
                  <div className="space-y-3">
                    {history.map((h) => (
                      <div key={h.id} className="flex items-center justify-between p-3 rounded-lg bg-[#F8FAFC]">
                        <div>
                          <p className="font-medium text-[#0F172A]">{h.type}</p>
                          <p className="text-sm text-[#64748B]">{h.service_date} &middot; In-store + Service</p>
                        </div>
                        <p className="font-semibold text-[#0F172A]">${h.amount}</p>
                      </div>
                    ))}
                    {history.length === 0 && (
                      <p className="text-center text-[#64748B]">No purchase history</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="notes" className="mt-0">
              <Card className="border-[#E2E8F0] shadow-sm">
                <CardContent className="p-4 space-y-4">
                  <div className="flex items-center gap-2">
                    <Input placeholder="Add a note..." className="flex-1" value={newNote} onChange={(e) => setNewNote(e.target.value)} />
                    <Button size="sm" className="bg-[#0891B2] text-white gap-1" onClick={handleAddNote}>
                      <Plus className="w-4 h-4" /> Add
                    </Button>
                  </div>
                  <div className="space-y-3">
                    {notes.map((n) => (
                      <div key={n.id} className="p-3 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0]">
                        <p className="text-sm text-[#0F172A]">{n.text}</p>
                        <div className="flex items-center gap-2 mt-2 text-xs text-[#64748B]">
                          <span className="font-medium">{n.author}</span>
                          <span>&middot;</span>
                          <span>{n.created_at}</span>
                        </div>
                      </div>
                    ))}
                    {notes.length === 0 && (
                      <p className="text-center text-[#64748B] py-4">No notes yet</p>
                    )}
                  </div>
                  {/* Photos */}
                  <div>
                    <p className="text-sm font-medium text-[#0F172A] mb-2 flex items-center gap-2">
                      <Camera className="w-4 h-4" /> Photos
                    </p>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      onChange={handlePhotoSelect}
                    />
                    <div className="grid grid-cols-4 gap-2">
                      {photos.map((photo) => (
                        <div key={photo.id} className="aspect-square rounded-lg overflow-hidden bg-[#F1F5F9]">
                          <img src={photo.url} alt="Customer" className="w-full h-full object-cover" />
                        </div>
                      ))}
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className="aspect-square rounded-lg bg-[#F1F5F9] border border-dashed border-[#E2E8F0] flex items-center justify-center cursor-pointer hover:bg-[#E2E8F0]"
                      >
                        <Plus className="w-5 h-5 text-[#64748B]" />
                      </button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="invoices" className="mt-0">
              <Card className="border-[#E2E8F0] shadow-sm">
                <CardContent className="p-0">
                  <div className="divide-y divide-[#F1F5F9]">
                    {invoices.map((inv) => (
                      <div key={inv.id} className="p-4 flex items-center gap-4">
                        <div className="w-12 h-12 rounded-lg bg-[#F1F5F9] flex items-center justify-center shrink-0">
                          <FileText className="w-5 h-5 text-[#0891B2]" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-[#0F172A]">{inv.number}</p>
                            <Badge className={`${statusColors[inv.status] || ""} text-[10px] px-1.5 py-0`}>{inv.status}</Badge>
                          </div>
                          <p className="text-sm text-[#64748B]">Issued: {inv.issue_date}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="font-semibold text-[#0F172A]">${inv.amount}</p>
                        </div>
                      </div>
                    ))}
                    {invoices.length === 0 && (
                      <div className="p-8 text-center text-[#64748B]">No invoices yet</div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* Right Rail Summary - desktop */}
      <div className="lg:hidden mt-4">
        <Card className="border-[#E2E8F0] shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-[#0F172A]">Customer Summary</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-[#64748B] uppercase">Lifetime Value</p>
                <p className="text-lg font-bold text-[#0F172A]">${customer.lifetime_value.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-xs text-[#64748B] uppercase">Total Jobs</p>
                <p className="text-lg font-bold text-[#0F172A]">{history.length}</p>
              </div>
              <div>
                <p className="text-xs text-[#64748B] uppercase">Customer Since</p>
                <p className="text-sm font-medium text-[#0F172A]">{customer.customer_since}</p>
              </div>
              <div>
                <p className="text-xs text-[#64748B] uppercase">Last Contact</p>
                <p className="text-sm font-medium text-[#0F172A]">{customer.last_contact}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
