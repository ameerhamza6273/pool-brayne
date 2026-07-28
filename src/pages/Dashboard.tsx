import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  DollarSign, ClipboardCheck, FileText, UserPlus, Download,
  TrendingUp, TrendingDown, AlertTriangle, ChevronDown,
  Award, Repeat, CalendarDays, BarChart3,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, PieChart, Pie, Cell, Legend, LineChart, Line,
} from "recharts";
import { dashboardApi } from "@/lib/api/dashboard";
import RouteMap from "@/components/RouteMap";
import RemindersCard from "@/components/RemindersCard";
import ShoppingList from "@/components/ShoppingList";

const dateRanges = ["Today", "This Week", "This Month", "This Year"];
const serviceColors: Record<string, string> = {
  Maintenance: "#0891B2", Repair: "#0E7490", Install: "#164E63",
  "Install / New Build": "#164E63", "Pool Open / Close": "#67E8F9",
  Inspection: "#F97316", "Equipment Service": "#14B8A6",
};
const seasonalLabels: Record<string, string> = {
  Jan: "Off-season", Feb: "Late winter", Mar: "Opening rush", Apr: "Spring peak",
  May: "Peak season", Jun: "Mid-season", Jul: "Summer peak", Aug: "Late summer",
  Sep: "Wind-down", Oct: "Closing season", Nov: "Off-season", Dec: "Off-season",
};

const monthKey = (d: Date) => d.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
const monthOf = (dateStr: string) => dateStr.slice(0, 7);

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

function parseScheduledDateTime(date: string, time: string): Date | null {
  const match = time.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
  if (!match) return null;
  let hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  const meridiem = match[3]?.toUpperCase();
  if (meridiem === "PM" && hours !== 12) hours += 12;
  if (meridiem === "AM" && hours === 12) hours = 0;
  const [y, m, d] = date.split("-").map(Number);
  return new Date(y, m - 1, d, hours, minutes, 0, 0);
}

function getPeriodBounds(range: string, now: Date) {
  if (range === "Today") {
    const curStart = startOfDay(now);
    const curEnd = new Date(curStart); curEnd.setDate(curEnd.getDate() + 1);
    const prevStart = new Date(curStart); prevStart.setDate(prevStart.getDate() - 1);
    return { curStart, curEnd, prevStart, prevEnd: curStart };
  }
  if (range === "This Week") {
    const day = now.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    const curStart = startOfDay(now); curStart.setDate(curStart.getDate() + diff);
    const curEnd = new Date(curStart); curEnd.setDate(curEnd.getDate() + 7);
    const prevStart = new Date(curStart); prevStart.setDate(prevStart.getDate() - 7);
    return { curStart, curEnd, prevStart, prevEnd: curStart };
  }
  if (range === "This Year") {
    const curStart = new Date(now.getFullYear(), 0, 1);
    const curEnd = new Date(now.getFullYear() + 1, 0, 1);
    const prevStart = new Date(now.getFullYear() - 1, 0, 1);
    return { curStart, curEnd, prevStart, prevEnd: curStart };
  }
  const curStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const curEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const prevStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  return { curStart, curEnd, prevStart, prevEnd: curStart };
}

const inRange = (dateStr: string | null, start: Date, end: Date) => {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  return d >= start && d < end;
};

export default function Dashboard() {
  const navigate = useNavigate();
  const [range, setRange] = useState("This Month");
  const [rangeOpen, setRangeOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const [invoices, setInvoices] = useState<{ amount: number; status: string; issue_date: string }[]>([]);
  const [jobs, setJobs] = useState<{
    type: string; amount: number; status: string; scheduled_date: string | null; scheduled_time: string | null;
    tech_id: string | null; arrived_at: string | null; completed_at: string | null;
    profiles: { name: string; avatar: string | null } | null;
  }[]>([]);
  const [customers, setCustomers] = useState<{ customer_since: string | null }[]>([]);
  const [inventoryAlerts, setInventoryAlerts] = useState<{ id: string; name: string; current: number; threshold: number }[]>([]);
  const [variance, setVariance] = useState<{ id: string; name: string; expected: number; actual: number; variance_pct: number }[]>([]);
  const [topSellers, setTopSellers] = useState<{ id: string; name: string; sales: number; revenue: number }[]>([]);

  const loadDashboard = useCallback(async () => {
    setIsLoading(true);
    const data = await dashboardApi.all();

    setInvoices(data.invoices);
    setJobs(data.jobs);
    setCustomers(data.customers);
    setInventoryAlerts(data.inventoryAlerts);
    setVariance(data.variance);
    setTopSellers(data.topSellers);

    setIsLoading(false);
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const now = new Date();

  const pctChange = (curr: number, prev: number) => (prev === 0 ? 0 : Math.round(((curr - prev) / prev) * 1000) / 10);

  const { curStart, curEnd, prevStart, prevEnd } = getPeriodBounds(range, now);

  const revenueThisPeriod = invoices.filter((i) => inRange(i.issue_date, curStart, curEnd)).reduce((s, i) => s + i.amount, 0);
  const revenueLastPeriod = invoices.filter((i) => inRange(i.issue_date, prevStart, prevEnd)).reduce((s, i) => s + i.amount, 0);

  const jobsThisPeriod = jobs.filter((j) => j.status === "Completed" && inRange(j.scheduled_date, curStart, curEnd)).length;
  const jobsLastPeriod = jobs.filter((j) => j.status === "Completed" && inRange(j.scheduled_date, prevStart, prevEnd)).length;

  const outstandingInvoices = invoices.filter((i) => i.status !== "Paid");
  const outstandingTotal = outstandingInvoices.reduce((s, i) => s + i.amount, 0);

  const newCustomersThisPeriod = customers.filter((c) => inRange(c.customer_since, curStart, curEnd)).length;
  const newCustomersLastPeriod = customers.filter((c) => inRange(c.customer_since, prevStart, prevEnd)).length;

  const kpis = [
    { label: `Revenue (${range})`, value: `$${revenueThisPeriod.toLocaleString()}`, change: pctChange(revenueThisPeriod, revenueLastPeriod), icon: DollarSign, up: revenueThisPeriod >= revenueLastPeriod, path: "/invoicing" },
    { label: "Jobs Completed", value: jobsThisPeriod.toString(), change: pctChange(jobsThisPeriod, jobsLastPeriod), icon: ClipboardCheck, up: jobsThisPeriod >= jobsLastPeriod, path: "/jobs" },
    { label: "Outstanding Invoices", value: `$${outstandingTotal.toLocaleString()}`, sub: `${outstandingInvoices.length} invoices`, change: 0, icon: FileText, up: false, path: "/invoicing" },
    { label: "New Customers", value: newCustomersThisPeriod.toString(), change: pctChange(newCustomersThisPeriod, newCustomersLastPeriod), icon: UserPlus, up: newCustomersThisPeriod >= newCustomersLastPeriod, path: "/customers" },
  ];

  const last6Months = Array.from({ length: 6 }, (_, i) => new Date(now.getFullYear(), now.getMonth() - 5 + i, 1));
  const revenueByMonth = last6Months.map((d) => ({
    month: monthKey(d),
    revenue: invoices.filter((inv) => monthOf(inv.issue_date) === d.toISOString().slice(0, 7)).reduce((s, inv) => s + inv.amount, 0),
  }));

  const serviceMap: Record<string, number> = {};
  for (const j of jobs) serviceMap[j.type] = (serviceMap[j.type] ?? 0) + j.amount;
  const totalJobRevenue = Object.values(serviceMap).reduce((s, v) => s + v, 0);
  const revenueByService = Object.entries(serviceMap).map(([name, amount]) => ({
    name, value: totalJobRevenue > 0 ? Math.round((amount / totalJobRevenue) * 100) : 0, color: serviceColors[name] ?? "#94A3B8",
  }));

  const last8Weeks = Array.from({ length: 8 }, (_, i) => {
    const end = new Date(now);
    end.setDate(end.getDate() - (7 - i) * 7);
    const start = new Date(end);
    start.setDate(start.getDate() - 6);
    return { label: `W${i + 1}`, start, end };
  });
  const jobsPerWeek = last8Weeks.map((w) => ({
    week: w.label,
    jobs: jobs.filter((j) => j.scheduled_date && new Date(j.scheduled_date) >= w.start && new Date(j.scheduled_date) <= w.end).length,
  }));

  const today = new Date();
  const buckets = [
    { bucket: "Current", min: -Infinity, max: 0 }, { bucket: "1-30", min: 1, max: 30 },
    { bucket: "31-60", min: 31, max: 60 }, { bucket: "61-90", min: 61, max: 90 }, { bucket: "90+", min: 91, max: Infinity },
  ];
  const agedReceivables = buckets.map((b) => {
    const matching = outstandingInvoices.filter((i) => {
      const daysPastDue = Math.round((today.getTime() - new Date(i.issue_date).getTime()) / 86400000);
      return daysPastDue > b.min - 1 && daysPastDue <= b.max;
    });
    return { bucket: b.bucket, amount: matching.reduce((s, i) => s + i.amount, 0), count: matching.length };
  });
  const maxBucket = Math.max(...agedReceivables.map((a) => a.amount), 1);

  const techMap: Record<string, { name: string; avatar: string; jobs: number; revenue: number; onTimeCount: number; trackedCount: number }> = {};
  for (const j of jobs) {
    if (!j.tech_id || !j.profiles) continue;
    const key = j.tech_id;
    if (!techMap[key]) {
      techMap[key] = { name: j.profiles.name, avatar: j.profiles.avatar ?? j.profiles.name.slice(0, 2).toUpperCase(), jobs: 0, revenue: 0, onTimeCount: 0, trackedCount: 0 };
    }
    if (j.status === "Completed") {
      techMap[key].jobs += 1;
      techMap[key].revenue += j.amount;
      if (j.arrived_at && j.scheduled_date && j.scheduled_time) {
        const scheduled = parseScheduledDateTime(j.scheduled_date, j.scheduled_time);
        if (scheduled) {
          const graceMs = 15 * 60 * 1000;
          techMap[key].trackedCount += 1;
          if (new Date(j.arrived_at).getTime() <= scheduled.getTime() + graceMs) techMap[key].onTimeCount += 1;
        }
      }
    }
  }
  const techPerformance = Object.values(techMap)
    .map((t) => ({ ...t, onTimePct: t.trackedCount > 0 ? Math.round((t.onTimeCount / t.trackedCount) * 100) : null }))
    .sort((a, b) => b.revenue - a.revenue);

  const last6MonthsCustomers = last6Months.map((d) => ({
    month: d.toLocaleDateString("en-US", { month: "short" }),
    new: customers.filter((c) => c.customer_since && monthOf(c.customer_since) === d.toISOString().slice(0, 7)).length,
  }));

  const yearMonths = Array.from({ length: 12 }, (_, i) => new Date(now.getFullYear(), i, 1));
  const seasonalTrends = yearMonths.map((d) => {
    const key = d.toISOString().slice(0, 7);
    const monthLabel = d.toLocaleDateString("en-US", { month: "short" });
    return {
      month: monthLabel,
      revenue: invoices.filter((inv) => monthOf(inv.issue_date) === key).reduce((s, inv) => s + inv.amount, 0),
      jobs: jobs.filter((j) => j.scheduled_date && monthOf(j.scheduled_date) === key).length,
      label: seasonalLabels[monthLabel] ?? "",
    };
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#0F172A]">Dashboard</h1>
          <p className="text-sm text-[#64748B] mt-0.5">Overview of your pool business</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <button
              onClick={() => setRangeOpen(!rangeOpen)}
              className="flex items-center gap-2 px-3 py-2 h-10 rounded-lg bg-white border border-[#E2E8F0] text-sm font-medium text-[#0F172A] hover:bg-[#F8FAFC]"
            >
              {range}
              <ChevronDown className="w-4 h-4 text-[#64748B]" />
            </button>
            {rangeOpen && (
              <div className="absolute right-0 mt-1 w-40 bg-white rounded-lg border border-[#E2E8F0] shadow-lg z-20 overflow-hidden">
                {dateRanges.map((r) => (
                  <button
                    key={r}
                    onClick={() => { setRange(r); setRangeOpen(false); }}
                    className={`w-full text-left px-3 py-2 text-sm hover:bg-[#F8FAFC] ${range === r ? "text-[#0891B2] font-medium bg-[#0891B2]/5" : "text-[#0F172A]"}`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            )}
          </div>
          <Button variant="outline" className="h-10 gap-2 border-[#E2E8F0] text-[#0F172A]" onClick={() => window.print()}>
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline">Export PDF</span>
          </Button>
        </div>
      </div>

      {isLoading && <div className="text-center py-8 text-[#64748B]">Loading dashboard...</div>}

      {!isLoading && (
      <>
      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {kpis.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <button
              key={kpi.label}
              onClick={() => navigate(kpi.path)}
              className="bg-white rounded-xl p-5 border border-[#E2E8F0] shadow-sm text-left hover:border-[#0891B2] hover:shadow-md transition-all cursor-pointer"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="text-sm text-[#64748B] font-medium">{kpi.label}</p>
                  <p className="text-2xl font-bold text-[#0F172A] mt-1">{kpi.value}</p>
                  {kpi.sub && <p className="text-xs text-[#64748B] mt-0.5">{kpi.sub}</p>}
                  <div className={`flex items-center gap-1 mt-2 text-sm font-medium ${kpi.up ? "text-[#16A34A]" : "text-[#DC2626]"}`}>
                    {kpi.up ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                    {Math.abs(kpi.change)}%
                    <span className="text-xs text-[#64748B] font-normal">vs last period</span>
                  </div>
                </div>
                <div className="w-10 h-10 rounded-lg bg-[#0891B2]/10 flex items-center justify-center shrink-0">
                  <Icon className="w-5 h-5 text-[#0891B2]" />
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Revenue Trend */}
        <div className="lg:col-span-2 bg-white rounded-xl p-5 border border-[#E2E8F0] shadow-sm">
          <h3 className="font-semibold text-[#0F172A] mb-4">Revenue Trend</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={revenueByMonth}>
                <defs>
                  <linearGradient id="revGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0891B2" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#0891B2" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                <XAxis dataKey="month" tick={{ fontSize: 12, fill: "#64748B" }} />
                <YAxis tick={{ fontSize: 12, fill: "#64748B" }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                <Tooltip
                  formatter={(value: number) => [`$${value.toLocaleString()}`, "Revenue"]}
                  contentStyle={{ borderRadius: 8, border: "1px solid #E2E8F0", fontSize: 13 }}
                />
                <Area type="monotone" dataKey="revenue" stroke="#0891B2" strokeWidth={2} fill="url(#revGradient)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Revenue by Service */}
        <div className="bg-white rounded-xl p-5 border border-[#E2E8F0] shadow-sm">
          <h3 className="font-semibold text-[#0F172A] mb-4">Revenue by Service</h3>
          <div className="h-56">
            {revenueByService.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={revenueByService} cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={3} dataKey="value">
                    {revenueByService.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => `${value}%`} />
                  <Legend iconType="circle" />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-sm text-[#64748B]">No job revenue yet</div>
            )}
          </div>
        </div>
      </div>

      {/* Second Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Jobs per Week */}
        <div className="lg:col-span-2 bg-white rounded-xl p-5 border border-[#E2E8F0] shadow-sm">
          <h3 className="font-semibold text-[#0F172A] mb-4">Jobs Scheduled Per Week (last 8 weeks)</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={jobsPerWeek}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                <XAxis dataKey="week" tick={{ fontSize: 12, fill: "#64748B" }} />
                <YAxis tick={{ fontSize: 12, fill: "#64748B" }} />
                <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #E2E8F0", fontSize: 13 }} />
                <Bar dataKey="jobs" fill="#0891B2" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Aged Receivables */}
        <div className="bg-white rounded-xl p-5 border border-[#E2E8F0] shadow-sm">
          <h3 className="font-semibold text-[#0F172A] mb-4">Aged Receivables</h3>
          <div className="space-y-3">
            {agedReceivables.map((ar) => (
              <div key={ar.bucket} className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-[#0F172A]">{ar.bucket}</span>
                    <span className="text-sm font-semibold text-[#0F172A]">${ar.amount.toLocaleString()}</span>
                  </div>
                  <div className="w-full h-2 bg-[#F1F5F9] rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        ar.bucket === "Current" ? "bg-[#16A34A]" :
                        ar.bucket === "1-30" ? "bg-[#0891B2]" :
                        ar.bucket === "31-60" ? "bg-[#F59E0B]" :
                        ar.bucket === "61-90" ? "bg-[#F97316]" : "bg-[#DC2626]"
                      }`}
                      style={{ width: `${(ar.amount / maxBucket) * 100}%` }}
                    />
                  </div>
                  <p className="text-xs text-[#64748B] mt-0.5">{ar.count} invoices</p>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 pt-3 border-t border-[#E2E8F0] flex items-center justify-between">
            <span className="text-sm font-medium text-[#0F172A]">Total Outstanding</span>
            <span className="text-lg font-bold text-[#0F172A]">${outstandingTotal.toLocaleString()}</span>
          </div>
        </div>
      </div>

      {/* Bottom Tables Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Tech Performance */}
        <div className="bg-white rounded-xl p-5 border border-[#E2E8F0] shadow-sm">
          <h3 className="font-semibold text-[#0F172A] mb-4">Technician Performance</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#E2E8F0]">
                  <th className="text-left py-2 px-2 text-xs font-medium text-[#64748B] uppercase">Tech</th>
                  <th className="text-right py-2 px-2 text-xs font-medium text-[#64748B] uppercase">Completed Jobs</th>
                  <th className="text-right py-2 px-2 text-xs font-medium text-[#64748B] uppercase">On-Time %</th>
                  <th className="text-right py-2 px-2 text-xs font-medium text-[#64748B] uppercase">Revenue</th>
                </tr>
              </thead>
              <tbody>
                {techPerformance.map((tech) => (
                  <tr key={tech.name} className="border-b border-[#F1F5F9] last:border-0">
                    <td className="py-3 px-2">
                      <div className="flex items-center gap-2">
                        <Avatar className="w-8 h-8">
                          <AvatarFallback className="bg-[#0891B2] text-white text-xs">{tech.avatar}</AvatarFallback>
                        </Avatar>
                        <span className="font-medium text-[#0F172A]">{tech.name}</span>
                      </div>
                    </td>
                    <td className="text-right py-3 px-2 font-medium text-[#0F172A]">{tech.jobs}</td>
                    <td className="text-right py-3 px-2 font-medium text-[#0F172A]">{tech.onTimePct !== null ? `${tech.onTimePct}%` : "—"}</td>
                    <td className="text-right py-3 px-2 font-medium text-[#0F172A]">${tech.revenue.toLocaleString()}</td>
                  </tr>
                ))}
                {techPerformance.length === 0 && (
                  <tr><td colSpan={4} className="py-6 text-center text-[#64748B]">No completed jobs yet</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Inventory Alerts */}
        <div className="bg-white rounded-xl p-5 border border-[#E2E8F0] shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <h3 className="font-semibold text-[#0F172A]">Inventory Alerts</h3>
            <Badge className="bg-[#F59E0B]/10 text-[#F59E0B] hover:bg-[#F59E0B]/10">{inventoryAlerts.length} items</Badge>
          </div>
          <div className="space-y-3">
            {inventoryAlerts.map((alert) => (
              <button
                key={alert.id}
                onClick={() => navigate("/inventory")}
                className="w-full flex items-center gap-3 p-3 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0] hover:border-[#0891B2] text-left transition-colors"
              >
                <AlertTriangle className={`w-5 h-5 shrink-0 ${alert.current === 0 ? "text-[#DC2626]" : "text-[#F59E0B]"}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[#0F172A] truncate">{alert.name}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className={`text-sm font-bold ${alert.current === 0 ? "text-[#DC2626]" : "text-[#F59E0B]"}`}>
                    {alert.current} / {alert.threshold}
                  </p>
                  <p className="text-xs text-[#64748B]">qty / threshold</p>
                </div>
              </button>
            ))}
            {inventoryAlerts.length === 0 && (
              <p className="text-center text-[#64748B] py-4">No low-stock items</p>
            )}
          </div>
        </div>
      </div>

      {/* Route Map & Reminders Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <RouteMap />
        </div>
        <div>
          <RemindersCard />
        </div>
      </div>

      {/* Shopping List */}
      <div className="max-w-md">
        <ShoppingList />
      </div>

      {/* New Dashboard Sections */}
      <Tabs defaultValue="variance" className="w-full">
        <TabsList className="bg-white border border-[#E2E8F0] h-10 p-1 rounded-lg flex-wrap h-auto">
          <TabsTrigger value="variance" className="text-sm data-[state=active]:bg-[#0891B2] data-[state=active]:text-white rounded-md px-4 gap-1.5">
            <BarChart3 className="w-4 h-4" /> Inventory Variance
          </TabsTrigger>
          <TabsTrigger value="top" className="text-sm data-[state=active]:bg-[#0891B2] data-[state=active]:text-white rounded-md px-4 gap-1.5">
            <Award className="w-4 h-4" /> Top Sellers
          </TabsTrigger>
          <TabsTrigger value="retention" className="text-sm data-[state=active]:bg-[#0891B2] data-[state=active]:text-white rounded-md px-4 gap-1.5">
            <Repeat className="w-4 h-4" /> New Customers
          </TabsTrigger>
          <TabsTrigger value="seasonal" className="text-sm data-[state=active]:bg-[#0891B2] data-[state=active]:text-white rounded-md px-4 gap-1.5">
            <CalendarDays className="w-4 h-4" /> Seasonal Trends
          </TabsTrigger>
        </TabsList>

        <TabsContent value="variance" className="mt-4">
          <div className="bg-white rounded-xl p-5 border border-[#E2E8F0] shadow-sm">
            <h3 className="font-semibold text-[#0F172A] mb-4">Inventory Variance (Expected vs Actual)</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={variance}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#64748B" }} interval={0} angle={-20} textAnchor="end" height={60} />
                  <YAxis tick={{ fontSize: 12, fill: "#64748B" }} />
                  <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #E2E8F0", fontSize: 13 }} />
                  <Legend />
                  <Bar dataKey="expected" fill="#0891B2" radius={[4, 4, 0, 0]} name="Expected" />
                  <Bar dataKey="actual" fill="#67E8F9" radius={[4, 4, 0, 0]} name="Actual" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="top" className="mt-4">
          <div className="bg-white rounded-xl p-5 border border-[#E2E8F0] shadow-sm">
            <h3 className="font-semibold text-[#0F172A] mb-4">Top Selling Products (POS)</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
                    <th className="text-left py-3 px-4 text-xs font-semibold text-[#64748B] uppercase">Product</th>
                    <th className="text-right py-3 px-4 text-xs font-semibold text-[#64748B] uppercase">Units Sold</th>
                    <th className="text-right py-3 px-4 text-xs font-semibold text-[#64748B] uppercase">Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {topSellers.map((p) => (
                    <tr key={p.id} className="border-b border-[#F1F5F9] last:border-0 hover:bg-[#F8FAFC]">
                      <td className="py-3 px-4 font-medium text-[#0F172A]">{p.name}</td>
                      <td className="text-right py-3 px-4 text-[#0F172A]">{p.sales}</td>
                      <td className="text-right py-3 px-4 font-semibold text-[#0F172A]">${p.revenue.toLocaleString()}</td>
                    </tr>
                  ))}
                  {topSellers.length === 0 && (
                    <tr><td colSpan={3} className="py-6 text-center text-[#64748B]">No POS sales yet</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="retention" className="mt-4">
          <div className="bg-white rounded-xl p-5 border border-[#E2E8F0] shadow-sm">
            <h3 className="font-semibold text-[#0F172A] mb-4">New Customers by Month (last 6 months)</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={last6MonthsCustomers}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                  <XAxis dataKey="month" tick={{ fontSize: 12, fill: "#64748B" }} />
                  <YAxis tick={{ fontSize: 12, fill: "#64748B" }} />
                  <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #E2E8F0", fontSize: 13 }} />
                  <Legend />
                  <Line type="monotone" dataKey="new" stroke="#0891B2" strokeWidth={2} dot={{ r: 4 }} name="New Customers" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="seasonal" className="mt-4">
          <div className="bg-white rounded-xl p-5 border border-[#E2E8F0] shadow-sm">
            <h3 className="font-semibold text-[#0F172A] mb-4">Seasonal Trends — Full Year</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={seasonalTrends}>
                  <defs>
                    <linearGradient id="seaRev" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#0891B2" stopOpacity={1} />
                      <stop offset="95%" stopColor="#0891B2" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="seaJobs" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#16A34A" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#16A34A" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                  <XAxis dataKey="month" tick={{ fontSize: 12, fill: "#64748B" }} />
                  <YAxis yAxisId="left" tick={{ fontSize: 12, fill: "#64748B" }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                  <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12, fill: "#64748B" }} />
                  <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #E2E8F0", fontSize: 13 }} />
                  <Legend />
                  <Area yAxisId="left" type="monotone" dataKey="revenue" stroke="#0891B2" strokeWidth={2} fill="url(#seaRev)" name="Revenue" />
                  <Area yAxisId="right" type="monotone" dataKey="jobs" stroke="#16A34A" strokeWidth={2} fill="url(#seaJobs)" name="Jobs" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <div className="flex flex-wrap gap-2 mt-4">
              {seasonalTrends.map((s) => (
                <Badge key={s.month} className="bg-[#F8FAFC] text-[#64748B] border border-[#E2E8F0] text-[10px] px-2 py-1">
                  {s.month}: {s.label}
                </Badge>
              ))}
            </div>
          </div>
        </TabsContent>
      </Tabs>
      </>
      )}
    </div>
  );
}
