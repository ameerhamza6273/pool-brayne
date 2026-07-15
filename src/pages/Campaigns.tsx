import { useState } from "react";
import { Search, Plus, MessageSquare, Star, Calendar, BarChart3, Send, Zap, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { automations, seasonalCampaigns, smsConversations, reviews, campaignPerformance } from "@/lib/data";

const iconMap: Record<string, React.ElementType> = {
  MessageSquare: MessageSquare,
  UserPlus: UserPlus,
  Star: Star,
  Calendar: Calendar,
  CreditCard: Send,
};

const campaignStatusColors: Record<string, string> = {
  Active: "bg-[#16A34A]/10 text-[#16A34A]",
  Scheduled: "bg-[#0891B2]/10 text-[#0891B2]",
  Draft: "bg-[#F59E0B]/10 text-[#F59E0B]",
};

export default function Campaigns() {
  const [activeConv, setActiveConv] = useState(smsConversations[0]);
  const [replyText, setReplyText] = useState("");
  const [campaignOpen, setCampaignOpen] = useState(false);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h1 className="text-2xl font-bold text-[#0F172A]">Campaigns & Follow-Up</h1>
      </div>

      <Tabs defaultValue="automations" className="w-full">
        <TabsList className="bg-white border border-[#E2E8F0] h-10 p-1 rounded-lg flex-wrap h-auto">
          <TabsTrigger value="automations" className="text-sm data-[state=active]:bg-[#0891B2] data-[state=active]:text-white rounded-md px-4 gap-1.5">
            <Zap className="w-4 h-4" /> Automations
          </TabsTrigger>
          <TabsTrigger value="seasonal" className="text-sm data-[state=active]:bg-[#0891B2] data-[state=active]:text-white rounded-md px-4 gap-1.5">
            <Calendar className="w-4 h-4" /> Seasonal
          </TabsTrigger>
          <TabsTrigger value="sms" className="text-sm data-[state=active]:bg-[#0891B2] data-[state=active]:text-white rounded-md px-4 gap-1.5">
            <MessageSquare className="w-4 h-4" /> SMS Inbox
          </TabsTrigger>
          <TabsTrigger value="reviews" className="text-sm data-[state=active]:bg-[#0891B2] data-[state=active]:text-white rounded-md px-4 gap-1.5">
            <Star className="w-4 h-4" /> Reviews
          </TabsTrigger>
          <TabsTrigger value="performance" className="text-sm data-[state=active]:bg-[#0891B2] data-[state=active]:text-white rounded-md px-4 gap-1.5">
            <BarChart3 className="w-4 h-4" /> Performance
          </TabsTrigger>
        </TabsList>

        {/* Automations */}
        <TabsContent value="automations" className="mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {automations.map((a) => {
              const Icon = iconMap[a.icon] || Zap;
              return (
                <Card key={a.id} className="border-[#E2E8F0] shadow-sm">
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-[#0891B2]/10 flex items-center justify-center">
                          <Icon className="w-5 h-5 text-[#0891B2]" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-[#0F172A]">{a.name}</h3>
                          <p className="text-xs text-[#64748B]">{a.trigger}</p>
                        </div>
                      </div>
                      <Switch checked={a.active} />
                    </div>
                    <p className="text-sm text-[#64748B] mb-3">{a.description}</p>
                    <div className="flex items-center gap-4 text-sm">
                      <div>
                        <p className="text-xs text-[#64748B]">Channel</p>
                        <p className="font-medium text-[#0F172A]">{a.channel}</p>
                      </div>
                      <div>
                        <p className="text-xs text-[#64748B]">Enrolled</p>
                        <p className="font-medium text-[#0F172A]">{a.enrolled}</p>
                      </div>
                      <div>
                        <p className="text-xs text-[#64748B]">Conversion</p>
                        <p className="font-medium text-[#16A34A]">{a.conversions}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        {/* Seasonal Campaigns */}
        <TabsContent value="seasonal" className="mt-4 space-y-4">
          <div className="flex justify-end">
            <Dialog open={campaignOpen} onOpenChange={setCampaignOpen}>
              <DialogTrigger asChild>
                <Button className="bg-[#0891B2] hover:bg-[#0E7490] text-white gap-2 h-10">
                  <Plus className="w-4 h-4" /> New Campaign
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>New Campaign</DialogTitle></DialogHeader>
                <div className="space-y-4 pt-2">
                  <div><Label>Name</Label><Input className="mt-1" placeholder="Campaign name" /></div>
                  <div><Label>Audience</Label><Input className="mt-1" type="number" placeholder="Number of customers" /></div>
                  <Button className="w-full bg-[#0891B2] text-white" onClick={() => setCampaignOpen(false)}>Create Campaign</Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            {seasonalCampaigns.map((c) => (
              <Card key={c.id} className="border-[#E2E8F0] shadow-sm">
                <CardContent className="p-5">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-semibold text-[#0F172A]">{c.name}</h3>
                    <Badge className={`${campaignStatusColors[c.status]} text-[10px] px-1.5 py-0`}>{c.status}</Badge>
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-[#64748B]">Audience</span>
                      <span className="font-medium text-[#0F172A]">{c.audience}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#64748B]">Scheduled</span>
                      <span className="font-medium text-[#0F172A]">{c.scheduledDate}</span>
                    </div>
                    {c.sentDate && (
                      <>
                        <div className="flex justify-between">
                          <span className="text-[#64748B]">Sent</span>
                          <span className="font-medium text-[#0F172A]">{c.sentDate}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-[#64748B]">Open Rate</span>
                          <span className="font-medium text-[#0891B2]">{c.openRate}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-[#64748B]">Bookings</span>
                          <span className="font-medium text-[#16A34A]">{c.bookings}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-[#64748B]">Revenue</span>
                          <span className="font-medium text-[#16A34A]">${c.revenue?.toLocaleString()}</span>
                        </div>
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* SMS Inbox */}
        <TabsContent value="sms" className="mt-4">
          <div className="bg-[#0891B2] rounded-t-xl p-3 text-white flex items-center gap-2">
            <MessageSquare className="w-4 h-4" />
            <span className="text-sm font-medium">Customers reply inside PoolBrayne — not to a technician's personal phone.</span>
          </div>
          <div className="bg-white rounded-b-xl border border-[#E2E8F0] border-t-0 shadow-sm grid grid-cols-1 lg:grid-cols-3 h-[500px]">
            {/* Conversation List */}
            <div className="border-r border-[#E2E8F0] overflow-y-auto">
              <div className="p-3 border-b border-[#E2E8F0]">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#64748B]" />
                  <Input placeholder="Search conversations..." className="pl-9 h-9 bg-[#F8FAFC] border-[#E2E8F0]" />
                </div>
              </div>
              {smsConversations.map((conv) => (
                <button
                  key={conv.id}
                  onClick={() => setActiveConv(conv)}
                  className={`w-full text-left p-3 border-b border-[#F1F5F9] hover:bg-[#F8FAFC] transition-colors ${activeConv.id === conv.id ? "bg-[#0891B2]/5" : ""}`}
                >
                  <div className="flex items-center justify-between">
                    <p className="font-medium text-sm text-[#0F172A]">{conv.customer}</p>
                    {conv.unread > 0 && (
                      <Badge className="bg-[#DC2626] text-white text-[10px] px-1.5 py-0 h-4 min-w-4 flex items-center justify-center">{conv.unread}</Badge>
                    )}
                  </div>
                  <p className="text-xs text-[#64748B] truncate mt-0.5">{conv.lastMessage}</p>
                </button>
              ))}
            </div>

            {/* Chat Thread */}
            <div className="lg:col-span-2 flex flex-col">
              <div className="p-3 border-b border-[#E2E8F0] flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-[#0891B2] flex items-center justify-center">
                  <span className="text-xs text-white font-semibold">{activeConv.customer.split(" ").map(n => n[0]).join("").slice(0, 2)}</span>
                </div>
                <div>
                  <p className="font-medium text-sm text-[#0F172A]">{activeConv.customer}</p>
                  <p className="text-xs text-[#64748B]">SMS Conversation</p>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {activeConv.messages.map((msg) => (
                  <div key={msg.id} className={`flex ${msg.from === "business" ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[70%] rounded-2xl px-4 py-2.5 text-sm ${
                      msg.from === "business"
                        ? "bg-[#0891B2] text-white rounded-br-md"
                        : "bg-[#F1F5F9] text-[#0F172A] rounded-bl-md"
                    }`}>
                      <p>{msg.text}</p>
                      <p className={`text-[10px] mt-1 ${msg.from === "business" ? "text-white/70" : "text-[#64748B]"}`}>
                        {msg.time.split(" ")[1]}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="p-3 border-t border-[#E2E8F0] flex items-center gap-2">
                <Input
                  placeholder="Type a message..."
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  className="flex-1 h-10 bg-[#F8FAFC] border-[#E2E8F0]"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && replyText.trim()) {
                      setReplyText("");
                    }
                  }}
                />
                <Button
                  size="sm"
                  className="bg-[#0891B2] hover:bg-[#0E7490] text-white h-10 px-4"
                  onClick={() => {
                    if (replyText.trim()) {
                      setReplyText("");
                    }
                  }}
                >
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* Reviews */}
        <TabsContent value="reviews" className="mt-4">
          <div className="space-y-3">
            {reviews.map((r) => (
              <Card key={r.id} className="border-[#E2E8F0] shadow-sm">
                <CardContent className="p-5">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-full bg-[#F59E0B]/10 flex items-center justify-center shrink-0">
                      <Star className="w-6 h-6 text-[#F59E0B]" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-[#0F172A]">{r.customer}</h3>
                        <Badge className="bg-[#F1F5F9] text-[#64748B] text-[10px] px-1.5 py-0">{r.platform}</Badge>
                      </div>
                      <div className="flex items-center gap-0.5 mb-2">
                        {Array.from({ length: 5 }, (_, i) => (
                          <Star key={i} className={`w-4 h-4 ${i < r.rating ? "text-[#F59E0B] fill-[#F59E0B]" : "text-[#E2E8F0]"}`} />
                        ))}
                      </div>
                      <p className="text-sm text-[#0F172A]">{r.text}</p>
                      <div className="mt-2 flex items-center gap-2 text-xs text-[#64748B]">
                        <span>{r.date}</span>
                        <span>&middot;</span>
                        <span className="text-[#0891B2]">Response: {r.response}</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Performance */}
        <TabsContent value="performance" className="mt-4 space-y-4">
          <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-sm p-5">
            <h3 className="font-semibold text-[#0F172A] mb-4">Campaign Performance</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={campaignPerformance}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                  <XAxis dataKey="campaign" tick={{ fontSize: 12, fill: "#64748B" }} />
                  <YAxis tick={{ fontSize: 12, fill: "#64748B" }} />
                  <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #E2E8F0", fontSize: 13 }} />
                  <Bar dataKey="openRate" name="Open Rate" fill="#0891B2" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="replyRate" name="Reply Rate" fill="#67E8F9" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="bookings" name="Bookings" fill="#16A34A" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
                    <th className="text-left py-3 px-4 text-xs font-semibold text-[#64748B] uppercase">Campaign</th>
                    <th className="text-right py-3 px-4 text-xs font-semibold text-[#64748B] uppercase">Sent</th>
                    <th className="text-right py-3 px-4 text-xs font-semibold text-[#64748B] uppercase">Opened</th>
                    <th className="text-right py-3 px-4 text-xs font-semibold text-[#64748B] uppercase">Open Rate</th>
                    <th className="text-right py-3 px-4 text-xs font-semibold text-[#64748B] uppercase">Replies</th>
                    <th className="text-right py-3 px-4 text-xs font-semibold text-[#64748B] uppercase">Reply Rate</th>
                    <th className="text-right py-3 px-4 text-xs font-semibold text-[#64748B] uppercase">Bookings</th>
                    <th className="text-right py-3 px-4 text-xs font-semibold text-[#64748B] uppercase">Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {campaignPerformance.map((cp) => (
                    <tr key={cp.id} className="border-b border-[#F1F5F9] last:border-0 hover:bg-[#F8FAFC]">
                      <td className="py-3 px-4 font-medium text-[#0F172A]">{cp.campaign}</td>
                      <td className="text-right py-3 px-4 text-[#0F172A]">{cp.sent}</td>
                      <td className="text-right py-3 px-4 text-[#0F172A]">{cp.opened}</td>
                      <td className="text-right py-3 px-4 font-semibold text-[#0891B2]">{cp.openRate}</td>
                      <td className="text-right py-3 px-4 text-[#0F172A]">{cp.replies}</td>
                      <td className="text-right py-3 px-4 text-[#0F172A]">{cp.replyRate}</td>
                      <td className="text-right py-3 px-4 font-semibold text-[#16A34A]">{cp.bookings}</td>
                      <td className="text-right py-3 px-4 font-semibold text-[#16A34A]">${cp.revenue.toLocaleString()}</td>
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
