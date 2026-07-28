import { useState, useEffect, useCallback } from "react";
import { Upload, Users, Plus, BookOpen, MapPin, CreditCard, Mail, MessageSquare, Shield, Bell, CheckCircle2, Globe, Forward, Trash2, Filter, Inbox, AlertCircle, Wrench, Settings2, Tag, Phone, RotateCw, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { settingsApi } from "@/lib/api/settings";
import { profilesApi } from "@/lib/api/profiles";
import type { Database } from "@/lib/database.types";
import { jobTypes, jobStatuses, estimateStatuses, cancellationReasons, callTypes, callSources, rescheduleTypes, contentCategories } from "@/lib/data";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];
type Integration = Database["public"]["Tables"]["integrations"]["Row"];
type SubscriptionPlan = Database["public"]["Tables"]["subscription_plans"]["Row"];
type BillingHistoryRow = Database["public"]["Tables"]["billing_history"]["Row"];

const roleColors: Record<string, string> = {
  Owner: "bg-[#0891B2]/10 text-[#0891B2]",
  Manager: "bg-[#F59E0B]/10 text-[#F59E0B]",
  Technician: "bg-[#16A34A]/10 text-[#16A34A]",
  Contractor: "bg-[#F59E0B]/10 text-[#F59E0B]",
  "Office Manager": "bg-[#7C3AED]/10 text-[#7C3AED]",
};

const formatRole = (role: string) => role.split("_").map((w) => w[0].toUpperCase() + w.slice(1)).join(" ");

const iconMap: Record<string, React.ElementType> = {
  BookOpen: BookOpen,
  MapPin: MapPin,
  Users: Users,
  MessageSquare: MessageSquare,
  Mail: Mail,
  CreditCard: CreditCard,
};

export default function Settings() {
  const [inviteOpen, setInviteOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [teamMembers, setTeamMembers] = useState<Profile[]>([]);
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [subscriptionPlans, setSubscriptionPlans] = useState<SubscriptionPlan[]>([]);
  const [billingHistory, setBillingHistory] = useState<BillingHistoryRow[]>([]);
  const [tenantName, setTenantName] = useState("");
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);

  const loadSettings = useCallback(async () => {
    setIsLoading(true);
    const data = await settingsApi.all();
    setTeamMembers(data.teamMembers);
    setIntegrations(data.integrations);
    setSubscriptionPlans(data.subscriptionPlans);
    setBillingHistory(data.billingHistory);
    setTenantName(data.tenantName);
    setSelectedPlan(data.planId);
    setIsLoading(false);
  }, []);

  const handleEmploymentTypeChange = async (profileId: string, employmentType: "Employee" | "Contractor") => {
    await profilesApi.updateEmploymentType(profileId, employmentType);
    setTeamMembers((prev) => prev.map((m) => (m.id === profileId ? { ...m, employment_type: employmentType } : m)));
  };

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const handleSaveCompany = async () => {
    await settingsApi.saveCompany(tenantName);
  };

  const handleSelectPlan = async (planId: string) => {
    setSelectedPlan(planId);
    await settingsApi.selectPlan(planId);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-[#0F172A]">Settings</h1>
      </div>

      {isLoading && <div className="text-center py-8 text-[#64748B]">Loading settings...</div>}

      {!isLoading && (
      <Tabs defaultValue="company" className="w-full">
        <TabsList className="bg-white border border-[#E2E8F0] h-10 p-1 rounded-lg flex-wrap h-auto">
          <TabsTrigger value="company" className="text-sm data-[state=active]:bg-[#0891B2] data-[state=active]:text-white rounded-md px-4 gap-1.5">
            <Globe className="w-4 h-4" /> Company
          </TabsTrigger>
          <TabsTrigger value="team" className="text-sm data-[state=active]:bg-[#0891B2] data-[state=active]:text-white rounded-md px-4 gap-1.5">
            <Users className="w-4 h-4" /> Team
          </TabsTrigger>
          <TabsTrigger value="integrations" className="text-sm data-[state=active]:bg-[#0891B2] data-[state=active]:text-white rounded-md px-4 gap-1.5">
            <Shield className="w-4 h-4" /> Integrations
          </TabsTrigger>
          <TabsTrigger value="billing" className="text-sm data-[state=active]:bg-[#0891B2] data-[state=active]:text-white rounded-md px-4 gap-1.5">
            <CreditCard className="w-4 h-4" /> Billing
          </TabsTrigger>
          <TabsTrigger value="notifications" className="text-sm data-[state=active]:bg-[#0891B2] data-[state=active]:text-white rounded-md px-4 gap-1.5">
            <Bell className="w-4 h-4" /> Notifications
          </TabsTrigger>
          <TabsTrigger value="email" className="text-sm data-[state=active]:bg-[#0891B2] data-[state=active]:text-white rounded-md px-4 gap-1.5">
            <Forward className="w-4 h-4" /> Email Forwarding
          </TabsTrigger>
          <TabsTrigger value="jobs" className="text-sm data-[state=active]:bg-[#0891B2] data-[state=active]:text-white rounded-md px-4 gap-1.5">
            <Wrench className="w-4 h-4" /> Job Settings
          </TabsTrigger>
        </TabsList>

        {/* Company Profile */}
        <TabsContent value="company" className="mt-4">
          <Card className="border-[#E2E8F0] shadow-sm">
            <CardContent className="p-5 space-y-6">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-xl bg-[#0891B2] flex items-center justify-center">
                  <span className="text-xl font-bold text-white">{tenantName.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()}</span>
                </div>
                <div>
                  <Button variant="outline" className="h-9 border-[#E2E8F0] text-[#0F172A] gap-2">
                    <Upload className="w-4 h-4" /> Upload Logo
                  </Button>
                  <p className="text-xs text-[#64748B] mt-1">Recommended: 200x200px PNG</p>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium text-[#0F172A]">Company Name</Label>
                  <Input value={tenantName} onChange={(e) => setTenantName(e.target.value)} className="mt-1 h-10" />
                </div>
                <div>
                  <Label className="text-sm font-medium text-[#0F172A]">Phone</Label>
                  <Input defaultValue="(512) 555-1000" className="mt-1 h-10" />
                </div>
                <div className="sm:col-span-2">
                  <Label className="text-sm font-medium text-[#0F172A]">Address</Label>
                  <Input defaultValue="1200 Warehouse Blvd, Austin, TX 78701" className="mt-1 h-10" />
                </div>
                <div>
                  <Label className="text-sm font-medium text-[#0F172A]">Business Hours</Label>
                  <Input defaultValue="Mon-Fri 7:00 AM - 6:00 PM" className="mt-1 h-10" />
                </div>
                <div>
                  <Label className="text-sm font-medium text-[#0F172A]">Service Area</Label>
                  <Input defaultValue="Austin, Cedar Park, Round Rock, Pflugerville" className="mt-1 h-10" />
                </div>
              </div>
              <Button className="bg-[#0891B2] hover:bg-[#0E7490] text-white h-10" onClick={handleSaveCompany}>Save Changes</Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Team */}
        <TabsContent value="team" className="mt-4 space-y-4">
          <div className="flex justify-end">
            <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
              <DialogTrigger asChild>
                <Button className="bg-[#0891B2] hover:bg-[#0E7490] text-white gap-2 h-10">
                  <Plus className="w-4 h-4" /> Invite User
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Invite Team Member</DialogTitle></DialogHeader>
                <div className="space-y-4 pt-2">
                  <div>
                    <Label>Email</Label>
                    <Input className="mt-1" placeholder="team@poolbrayne.com" />
                  </div>
                  <div>
                    <Label>Role</Label>
                    <div className="flex gap-2 mt-2">
                      <Badge className="cursor-pointer bg-[#0891B2]/10 text-[#0891B2]">Owner</Badge>
                      <Badge className="cursor-pointer bg-[#F59E0B]/10 text-[#F59E0B]">Manager</Badge>
                      <Badge className="cursor-pointer bg-[#16A34A]/10 text-[#16A34A]">Technician</Badge>
                    </div>
                  </div>
                  <Button className="w-full bg-[#0891B2] text-white" onClick={() => setInviteOpen(false)}>Send Invite</Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
          <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
                    <th className="text-left py-3 px-4 text-xs font-semibold text-[#64748B] uppercase">User</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-[#64748B] uppercase">Email</th>
                    <th className="text-center py-3 px-4 text-xs font-semibold text-[#64748B] uppercase">Role</th>
                    <th className="text-center py-3 px-4 text-xs font-semibold text-[#64748B] uppercase">Type</th>
                    <th className="text-center py-3 px-4 text-xs font-semibold text-[#64748B] uppercase">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {teamMembers.map((u) => (
                    <tr key={u.id} className="border-b border-[#F1F5F9] last:border-0 hover:bg-[#F8FAFC]">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <Avatar className="w-8 h-8">
                            <AvatarFallback className="bg-[#0891B2] text-white text-xs">{u.avatar ?? u.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}</AvatarFallback>
                          </Avatar>
                          <span className="font-medium text-[#0F172A]">{u.name}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-[#64748B] text-sm">{u.email}</td>
                      <td className="text-center py-3 px-4">
                        <Badge className={`${roleColors[formatRole(u.role)] || "bg-[#E2E8F0] text-[#64748B]"} text-[10px] px-1.5 py-0`}>{formatRole(u.role)}</Badge>
                      </td>
                      <td className="text-center py-3 px-4">
                        <Select value={u.employment_type} onValueChange={(v) => handleEmploymentTypeChange(u.id, v as "Employee" | "Contractor")}>
                          <SelectTrigger className="h-8 w-[110px] text-xs mx-auto"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Employee">Employee</SelectItem>
                            <SelectItem value="Contractor">Contractor</SelectItem>
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="text-center py-3 px-4">
                        <Badge className="bg-[#16A34A]/10 text-[#16A34A] text-[10px] px-1.5 py-0">{u.status}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>

        {/* Integrations */}
        <TabsContent value="integrations" className="mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {integrations.map((int) => {
              const Icon = iconMap[int.icon ?? ""] || Shield;
              return (
                <Card key={int.id} className="border-[#E2E8F0] shadow-sm">
                  <CardContent className="p-5">
                    <div className="flex items-start gap-3">
                      <div className="w-12 h-12 rounded-xl bg-[#F1F5F9] flex items-center justify-center shrink-0">
                        <Icon className="w-6 h-6 text-[#0891B2]" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-[#0F172A]">{int.name}</h3>
                          <Badge className={`${int.status === "Connected" ? "bg-[#16A34A]/10 text-[#16A34A]" : "bg-[#F59E0B]/10 text-[#F59E0B]"} text-[10px] px-1.5 py-0`}>
                            {int.status}
                          </Badge>
                        </div>
                        <p className="text-sm text-[#64748B] mt-1">{int.description}</p>
                        <Button variant="outline" size="sm" className="mt-3 h-8 border-[#E2E8F0] text-[#0F172A]">
                          {int.status === "Connected" ? "Manage" : "Connect"}
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
          <div className="mt-4 p-4 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0] text-sm text-[#64748B]">
            Each client connects their own QuickBooks account — fully isolated per tenant.
          </div>
        </TabsContent>

        {/* Billing */}
        <TabsContent value="billing" className="mt-4 space-y-4">
          {/* Current Plan */}
          <Card className="border-[#E2E8F0] shadow-sm">
            <CardContent className="p-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-lg font-bold text-[#0F172A]">{subscriptionPlans.find((p) => p.id === selectedPlan)?.name ?? "No plan selected"}</h3>
                    <Badge className="bg-[#0891B2]/10 text-[#0891B2] text-[10px] px-1.5 py-0">Current</Badge>
                  </div>
                  <p className="text-sm text-[#64748B]">${subscriptionPlans.find((p) => p.id === selectedPlan)?.price ?? 0}/month via Stripe</p>
                </div>
                <div className="flex items-center gap-2">
                  <CreditCard className="w-5 h-5 text-[#64748B]" />
                  <span className="text-sm text-[#0F172A]">Visa ending in 4242</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Plans */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {subscriptionPlans.map((plan) => (
              <Card
                key={plan.id}
                className={`border-[#E2E8F0] shadow-sm cursor-pointer transition-all ${
                  selectedPlan === plan.id ? "ring-2 ring-[#0891B2] border-[#0891B2]" : "hover:shadow-md"
                }`}
                onClick={() => handleSelectPlan(plan.id)}
              >
                <CardContent className="p-5">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-semibold text-[#0F172A]">{plan.name}</h3>
                    {plan.recommended && <Badge className="bg-[#0891B2] text-white text-[10px] px-1.5 py-0">Recommended</Badge>}
                  </div>
                  <p className="text-2xl font-bold text-[#0F172A]">${plan.price}<span className="text-sm font-normal text-[#64748B]">/mo</span></p>
                  <p className="text-sm text-[#64748B] mt-1">{plan.description}</p>
                  <ul className="mt-3 space-y-1.5">
                    {plan.features.map((f, i) => (
                      <li key={i} className="flex items-center gap-2 text-sm text-[#0F172A]">
                        <CheckCircle2 className="w-4 h-4 text-[#16A34A] shrink-0" />
                        {f}
                      </li>
                    ))}
                  </ul>
                  <Button
                    className={`w-full mt-4 h-10 ${
                      selectedPlan === plan.id ? "bg-[#0891B2] text-white" : "bg-[#F8FAFC] text-[#0F172A] border border-[#E2E8F0]"
                    }`}
                  >
                    {selectedPlan === plan.id ? "Current Plan" : "Select Plan"}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Billing History */}
          <Card className="border-[#E2E8F0] shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-[#0F172A]">Billing History</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
                      <th className="text-left py-3 px-4 text-xs font-semibold text-[#64748B] uppercase">Date</th>
                      <th className="text-left py-3 px-4 text-xs font-semibold text-[#64748B] uppercase">Description</th>
                      <th className="text-right py-3 px-4 text-xs font-semibold text-[#64748B] uppercase">Amount</th>
                      <th className="text-center py-3 px-4 text-xs font-semibold text-[#64748B] uppercase">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {billingHistory.map((bh) => (
                      <tr key={bh.id} className="border-b border-[#F1F5F9] last:border-0 hover:bg-[#F8FAFC]">
                        <td className="py-3 px-4 text-[#64748B]">{bh.billed_date}</td>
                        <td className="py-3 px-4 text-[#0F172A]">{bh.description}</td>
                        <td className="text-right py-3 px-4 font-semibold text-[#0F172A]">${bh.amount}</td>
                        <td className="text-center py-3 px-4">
                          <Badge className="bg-[#16A34A]/10 text-[#16A34A] text-[10px] px-1.5 py-0">{bh.status}</Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Email Forwarding */}
        <TabsContent value="email" className="mt-4 space-y-4">
          <Card className="border-[#E2E8F0] shadow-sm">
            <CardContent className="p-5 space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-[#0891B2]/10 flex items-center justify-center shrink-0">
                  <Forward className="w-5 h-5 text-[#0891B2]" />
                </div>
                <div>
                  <h3 className="font-semibold text-[#0F172A]">Email Forwarding</h3>
                  <p className="text-sm text-[#64748B] mt-0.5">Forward incoming emails from Bryan automatically to the right people based on rules below.</p>
                </div>
              </div>
              <div className="rounded-lg bg-[#0891B2]/5 border border-[#0891B2]/20 p-3 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-[#0891B2] shrink-0 mt-0.5" />
                <p className="text-xs text-[#0E7490]">Your forwarding address is <span className="font-mono font-semibold">bryan@poolbrayne.com</span>. All inbound mail is scanned and routed by the rules below before hitting the inbox.</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium text-[#0F172A]">Primary forward-to</Label>
                  <Input defaultValue="dispatch@poolbrayne.com" className="mt-1 h-10" />
                  <p className="text-xs text-[#64748B] mt-1">Default destination when no rule matches.</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-[#0F172A]">CC on all forwards</Label>
                  <Input defaultValue="owner@poolbrayne.com" className="mt-1 h-10" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-[#E2E8F0] shadow-sm">
            <CardContent className="p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Filter className="w-5 h-5 text-[#0891B2]" />
                  <h3 className="font-semibold text-[#0F172A]">Forwarding Rules</h3>
                </div>
                <Button className="bg-[#0891B2] hover:bg-[#0E7490] text-white gap-2 h-9">
                  <Plus className="w-4 h-4" /> Add Rule
                </Button>
              </div>
              <div className="space-y-3">
                {[
                  { id: 1, keyword: "invoice OR payment", forward: "billing@poolbrayne.com", action: "Forward + mark read", active: true },
                  { id: 2, keyword: "appointment OR schedule", forward: "dispatch@poolbrayne.com", action: "Forward + keep unread", active: true },
                  { id: 3, keyword: "complaint OR urgent", forward: "owner@poolbrayne.com", action: "Forward + flag", active: true },
                  { id: 4, keyword: "resume OR job application", forward: "hr@poolbrayne.com", action: "Forward + archive", active: false },
                ].map((r) => (
                  <div key={r.id} className="flex flex-col sm:flex-row sm:items-center gap-3 p-3 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0]">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Inbox className="w-4 h-4 text-[#64748B] shrink-0" />
                        <span className="text-xs font-mono text-[#0F172A] bg-white border border-[#E2E8F0] rounded px-1.5 py-0.5">{r.keyword}</span>
                      </div>
                      <p className="text-sm text-[#0F172A]">
                        <span className="text-[#64748B]">to</span>{" "}
                        <span className="font-medium">{r.forward}</span>
                      </p>
                      <p className="text-xs text-[#64748B] mt-0.5">{r.action}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge className={`${r.active ? "bg-[#16A34A]/10 text-[#16A34A]" : "bg-[#E2E8F0] text-[#64748B]"} text-[10px] px-2 py-0`}>
                        {r.active ? "Active" : "Paused"}
                      </Badge>
                      <Switch defaultChecked={r.active} />
                      <button className="text-[#DC2626] hover:bg-[#DC2626]/10 p-1.5 rounded-md">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="border-[#E2E8F0] shadow-sm">
            <CardContent className="p-5">
              <h3 className="font-semibold text-[#0F172A] mb-3">Forwarding Log (Last 24h)</h3>
              <div className="space-y-2">
                {[
                  { from: "jthompson@gmail.com", subject: "Question about my invoice #1042", to: "billing@poolbrayne.com", time: "2:14 PM", status: "Forwarded" },
                  { from: "sarah@austinpools.com", subject: "Need to reschedule Thursday", to: "dispatch@poolbrayne.com", time: "11:02 AM", status: "Forwarded" },
                  { from: "unknown@spam.com", subject: "URGENT: pool overflow", to: "owner@poolbrayne.com", time: "9:38 AM", status: "Forwarded + flagged" },
                  { from: "mike.chen@gmail.com", subject: "Thanks for the great service", to: "dispatch@poolbrayne.com", time: "8:15 AM", status: "Forwarded" },
                ].map((log, i) => (
                  <div key={i} className="flex items-center gap-3 py-2 border-b border-[#F1F5F9] last:border-0 text-sm">
                    <Mail className="w-4 h-4 text-[#64748B] shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-[#0F172A] truncate">{log.subject}</p>
                      <p className="text-xs text-[#64748B]">From {log.from} → {log.to}</p>
                    </div>
                    <span className="text-xs text-[#64748B] shrink-0">{log.time}</span>
                    <Badge className="bg-[#16A34A]/10 text-[#16A34A] text-[10px] px-1.5 py-0 shrink-0">{log.status}</Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Job Settings */}
        <TabsContent value="jobs" className="mt-4 space-y-4">
          {/* Job Types */}
          <Card className="border-[#E2E8F0] shadow-sm">
            <CardContent className="p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Tag className="w-5 h-5 text-[#0891B2]" />
                  <h3 className="font-semibold text-[#0F172A]">Job Types</h3>
                </div>
                <Button className="bg-[#0891B2] hover:bg-[#0E7490] text-white gap-2 h-9">
                  <Plus className="w-4 h-4" /> Add Job Type
                </Button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {jobTypes.map((t) => (
                  <div key={t.id} className="flex items-center gap-3 p-3 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0]">
                    <span className="w-3 h-3 rounded-full shrink-0" style={{ background: t.color }} />
                    <span className="text-sm font-medium text-[#0F172A] flex-1">{t.label}</span>
                    <button className="text-[#64748B] hover:text-[#DC2626]"><Trash2 className="w-4 h-4" /></button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Job Statuses */}
          <Card className="border-[#E2E8F0] shadow-sm">
            <CardContent className="p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Settings2 className="w-5 h-5 text-[#0891B2]" />
                  <h3 className="font-semibold text-[#0F172A]">Job Statuses</h3>
                </div>
                <Button className="bg-[#0891B2] hover:bg-[#0E7490] text-white gap-2 h-9">
                  <Plus className="w-4 h-4" /> Add Status
                </Button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {jobStatuses.map((s) => (
                  <div key={s.id} className="flex items-center gap-3 p-3 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0]">
                    <span className="w-3 h-3 rounded-full shrink-0" style={{ background: s.color }} />
                    <span className="text-sm font-medium text-[#0F172A] flex-1">{s.label}</span>
                    <button className="text-[#64748B] hover:text-[#DC2626]"><Trash2 className="w-4 h-4" /></button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Estimate Statuses */}
          <Card className="border-[#E2E8F0] shadow-sm">
            <CardContent className="p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileText className="w-5 h-5 text-[#0891B2]" />
                  <h3 className="font-semibold text-[#0F172A]">Estimate Statuses</h3>
                </div>
                <Button className="bg-[#0891B2] hover:bg-[#0E7490] text-white gap-2 h-9">
                  <Plus className="w-4 h-4" /> Add Status
                </Button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {estimateStatuses.map((s) => (
                  <div key={s.id} className="flex items-center gap-3 p-3 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0]">
                    <span className="w-3 h-3 rounded-full shrink-0" style={{ background: s.color }} />
                    <span className="text-sm font-medium text-[#0F172A] flex-1">{s.label}</span>
                    <button className="text-[#64748B] hover:text-[#DC2626]"><Trash2 className="w-4 h-4" /></button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Call Types & Sources */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card className="border-[#E2E8F0] shadow-sm">
              <CardContent className="p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Phone className="w-5 h-5 text-[#0891B2]" />
                    <h3 className="font-semibold text-[#0F172A]">Call Types</h3>
                  </div>
                  <Button size="sm" variant="outline" className="h-8 gap-1"><Plus className="w-3.5 h-3.5" /> Add</Button>
                </div>
                <div className="space-y-2">
                  {callTypes.map((c) => (
                    <div key={c} className="flex items-center gap-2 p-2.5 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0]">
                      <span className="text-sm text-[#0F172A] flex-1">{c}</span>
                      <button className="text-[#64748B] hover:text-[#DC2626]"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
            <Card className="border-[#E2E8F0] shadow-sm">
              <CardContent className="p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Globe className="w-5 h-5 text-[#0891B2]" />
                    <h3 className="font-semibold text-[#0F172A]">Call Sources</h3>
                  </div>
                  <Button size="sm" variant="outline" className="h-8 gap-1"><Plus className="w-3.5 h-3.5" /> Add</Button>
                </div>
                <div className="space-y-2">
                  {callSources.map((c) => (
                    <div key={c} className="flex items-center gap-2 p-2.5 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0]">
                      <span className="text-sm text-[#0F172A] flex-1">{c}</span>
                      <button className="text-[#64748B] hover:text-[#DC2626]"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Reschedule Types */}
          <Card className="border-[#E2E8F0] shadow-sm">
            <CardContent className="p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <RotateCw className="w-5 h-5 text-[#0891B2]" />
                  <h3 className="font-semibold text-[#0F172A]">Reschedule Types</h3>
                </div>
                <Button size="sm" variant="outline" className="h-8 gap-1"><Plus className="w-3.5 h-3.5" /> Add</Button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {rescheduleTypes.map((r) => (
                  <div key={r} className="flex items-center gap-2 p-2.5 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0]">
                    <span className="text-sm text-[#0F172A] flex-1">{r}</span>
                    <button className="text-[#64748B] hover:text-[#DC2626]"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Cancellation Reasons */}
          <Card className="border-[#E2E8F0] shadow-sm">
            <CardContent className="p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-[#0891B2]" />
                  <h3 className="font-semibold text-[#0F172A]">Cancellation Reasons</h3>
                </div>
                <Button className="bg-[#0891B2] hover:bg-[#0E7490] text-white gap-2 h-9">
                  <Plus className="w-4 h-4" /> Add Reason
                </Button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {cancellationReasons.map((r) => (
                  <div key={r} className="flex items-start gap-2 p-3 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0]">
                    <span className="text-sm text-[#0F172A] flex-1">{r}</span>
                    <button className="text-[#64748B] hover:text-[#DC2626] shrink-0"><Trash2 className="w-4 h-4" /></button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Content Categories */}
          <Card className="border-[#E2E8F0] shadow-sm">
            <CardContent className="p-5 space-y-4">
              <div className="flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-[#0891B2]" />
                <h3 className="font-semibold text-[#0F172A]">Content Categories</h3>
              </div>
              <p className="text-sm text-[#64748B]">Tabs available on each job detail page. Toggle which categories are visible to your team.</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                {contentCategories.map((c) => (
                  <div key={c.id} className="flex flex-col items-center gap-2 p-3 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0]">
                    <span className="text-xs font-medium text-[#0F172A] text-center">{c.label}</span>
                    <Switch defaultChecked />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Notifications */}
        <TabsContent value="notifications" className="mt-4">
          <Card className="border-[#E2E8F0] shadow-sm">
            <CardContent className="p-5 space-y-4">
              <h3 className="font-semibold text-[#0F172A] mb-2">Customer Notifications</h3>
              {[
                { label: "Booking confirmation", desc: "Send when a job is scheduled" },
                { label: "Technician en route", desc: "Send when tech is dispatched" },
                { label: "Job completion summary", desc: "Send after job is marked complete" },
                { label: "Payment receipt", desc: "Send when payment is received" },
                { label: "Overdue invoice reminder", desc: "Send before invoice due date" },
                { label: "Seasonal campaign", desc: "Send pool opening/closing reminders" },
              ].map((n) => (
                <div key={n.label} className="flex items-center justify-between py-2 border-b border-[#F1F5F9] last:border-0">
                  <div>
                    <p className="text-sm font-medium text-[#0F172A]">{n.label}</p>
                    <p className="text-xs text-[#64748B]">{n.desc}</p>
                  </div>
                  <Switch defaultChecked />
                </div>
              ))}

              <h3 className="font-semibold text-[#0F172A] mb-2 mt-6">Staff Notifications</h3>
              {[
                { label: "New job assigned", desc: "Notify technician when assigned" },
                { label: "Job overdue alert", desc: "Alert when job exceeds scheduled time" },
                { label: "Low inventory alert", desc: "Alert when stock falls below threshold" },
                { label: "Customer review received", desc: "Notify when new review is posted" },
              ].map((n) => (
                <div key={n.label} className="flex items-center justify-between py-2 border-b border-[#F1F5F9] last:border-0">
                  <div>
                    <p className="text-sm font-medium text-[#0F172A]">{n.label}</p>
                    <p className="text-xs text-[#64748B]">{n.desc}</p>
                  </div>
                  <Switch defaultChecked />
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      )}
    </div>
  );
}
