import { useState } from "react";
import {
  DollarSign, ClipboardCheck, FileText, UserPlus, Download,
  TrendingUp, TrendingDown, AlertTriangle, ChevronDown,
  Flame, Award, Repeat, CalendarDays,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, PieChart, Pie, Cell, Legend, LineChart, Line,
} from "recharts";
import {
  dashboardKPIs, revenueByMonth, jobsPerWeek, revenueByService,
  techPerformance, inventoryAlerts, agedReceivables,
  burnRateData, topSellingProducts, customerRetention, seasonalTrends,
} from "@/lib/data";
import RouteMap from "@/components/RouteMap";
import RemindersCard from "@/components/RemindersCard";
import ShoppingList from "@/components/ShoppingList";

const dateRanges = ["Today", "This Week", "This Month", "This Year"];

export default function Dashboard() {
  const [range, setRange] = useState("This Month");
  const [rangeOpen, setRangeOpen] = useState(false);

  const kpis = [
    {
      label: "Revenue (This Month)",
      value: `$${dashboardKPIs.revenue.toLocaleString()}`,
      change: dashboardKPIs.revenueChange,
      icon: DollarSign,
      up: true,
    },
    {
      label: "Jobs Completed",
      value: dashboardKPIs.jobsCompleted.toString(),
      change: dashboardKPIs.jobsChange,
      icon: ClipboardCheck,
      up: true,
    },
    {
      label: "Outstanding Invoices",
      value: `$${dashboardKPIs.outstandingInvoices.toLocaleString()}`,
      sub: `${dashboardKPIs.outstandingCount} invoices`,
      change: dashboardKPIs.outstandingChange,
      icon: FileText,
      up: false,
    },
    {
      label: "New Customers",
      value: dashboardKPIs.newCustomers.toString(),
      change: dashboardKPIs.newCustomersChange,
      icon: UserPlus,
      up: true,
    },
  ];

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
          <Button variant="outline" className="h-10 gap-2 border-[#E2E8F0] text-[#0F172A]">
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline">Export PDF</span>
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {kpis.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <div key={kpi.label} className="bg-white rounded-xl p-5 border border-[#E2E8F0] shadow-sm">
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
            </div>
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
          </div>
        </div>
      </div>

      {/* Second Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Jobs per Week */}
        <div className="lg:col-span-2 bg-white rounded-xl p-5 border border-[#E2E8F0] shadow-sm">
          <h3 className="font-semibold text-[#0F172A] mb-4">Jobs Completed Per Week</h3>
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
                      style={{ width: `${(ar.amount / 34900) * 100}%` }}
                    />
                  </div>
                  <p className="text-xs text-[#64748B] mt-0.5">{ar.count} invoices</p>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 pt-3 border-t border-[#E2E8F0] flex items-center justify-between">
            <span className="text-sm font-medium text-[#0F172A]">Total Outstanding</span>
            <span className="text-lg font-bold text-[#0F172A]">$34,900</span>
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
                  <th className="text-right py-2 px-2 text-xs font-medium text-[#64748B] uppercase">Jobs/Day</th>
                  <th className="text-right py-2 px-2 text-xs font-medium text-[#64748B] uppercase">Revenue</th>
                  <th className="text-right py-2 px-2 text-xs font-medium text-[#64748B] uppercase">On-Time</th>
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
                    <td className="text-right py-3 px-2 font-medium text-[#0F172A]">{tech.jobsPerDay}</td>
                    <td className="text-right py-3 px-2 font-medium text-[#0F172A]">${tech.revenue.toLocaleString()}</td>
                    <td className="text-right py-3 px-2">
                      <Badge className={`${tech.onTime >= 97 ? "bg-[#16A34A]/10 text-[#16A34A] hover:bg-[#16A34A]/10" : "bg-[#F59E0B]/10 text-[#F59E0B] hover:bg-[#F59E0B]/10"}`}>
                        {tech.onTime}%
                      </Badge>
                    </td>
                  </tr>
                ))}
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
              <div key={alert.id} className="flex items-center gap-3 p-3 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0]">
                <AlertTriangle className={`w-5 h-5 shrink-0 ${alert.current === 0 ? "text-[#DC2626]" : "text-[#F59E0B]"}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[#0F172A] truncate">{alert.name}</p>
                  <p className="text-xs text-[#64748B]">{alert.location}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className={`text-sm font-bold ${alert.current === 0 ? "text-[#DC2626]" : "text-[#F59E0B]"}`}>
                    {alert.current} / {alert.threshold}
                  </p>
                  <p className="text-xs text-[#64748B]">qty / threshold</p>
                </div>
              </div>
            ))}
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
      <Tabs defaultValue="burn" className="w-full">
        <TabsList className="bg-white border border-[#E2E8F0] h-10 p-1 rounded-lg flex-wrap h-auto">
          <TabsTrigger value="burn" className="text-sm data-[state=active]:bg-[#0891B2] data-[state=active]:text-white rounded-md px-4 gap-1.5">
            <Flame className="w-4 h-4" /> Burn Rate
          </TabsTrigger>
          <TabsTrigger value="top" className="text-sm data-[state=active]:bg-[#0891B2] data-[state=active]:text-white rounded-md px-4 gap-1.5">
            <Award className="w-4 h-4" /> Top Sellers
          </TabsTrigger>
          <TabsTrigger value="retention" className="text-sm data-[state=active]:bg-[#0891B2] data-[state=active]:text-white rounded-md px-4 gap-1.5">
            <Repeat className="w-4 h-4" /> Retention
          </TabsTrigger>
          <TabsTrigger value="seasonal" className="text-sm data-[state=active]:bg-[#0891B2] data-[state=active]:text-white rounded-md px-4 gap-1.5">
            <CalendarDays className="w-4 h-4" /> Seasonal Trends
          </TabsTrigger>
        </TabsList>

        <TabsContent value="burn" className="mt-4">
          <div className="bg-white rounded-xl p-5 border border-[#E2E8F0] shadow-sm">
            <h3 className="font-semibold text-[#0F172A] mb-4">Inventory Burn Rate</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={burnRateData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                  <XAxis dataKey="week" tick={{ fontSize: 12, fill: "#64748B" }} />
                  <YAxis tick={{ fontSize: 12, fill: "#64748B" }} />
                  <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #E2E8F0", fontSize: 13 }} />
                  <Legend />
                  <Bar dataKey="chlorine" fill="#0891B2" radius={[4, 4, 0, 0]} name="Chlorine Tabs" />
                  <Bar dataKey="acid" fill="#67E8F9" radius={[4, 4, 0, 0]} name="Muriatic Acid" />
                  <Bar dataKey="deGrids" fill="#0E7490" radius={[4, 4, 0, 0]} name="DE Grids" />
                  <Bar dataKey="oRings" fill="#164E63" radius={[4, 4, 0, 0]} name="O-Rings" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="top" className="mt-4">
          <div className="bg-white rounded-xl p-5 border border-[#E2E8F0] shadow-sm">
            <h3 className="font-semibold text-[#0F172A] mb-4">Top Selling Products</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
                    <th className="text-left py-3 px-4 text-xs font-semibold text-[#64748B] uppercase">Product</th>
                    <th className="text-right py-3 px-4 text-xs font-semibold text-[#64748B] uppercase">Units Sold</th>
                    <th className="text-right py-3 px-4 text-xs font-semibold text-[#64748B] uppercase">Revenue</th>
                    <th className="text-center py-3 px-4 text-xs font-semibold text-[#64748B] uppercase">Trend</th>
                  </tr>
                </thead>
                <tbody>
                  {topSellingProducts.map((p) => (
                    <tr key={p.id} className="border-b border-[#F1F5F9] last:border-0 hover:bg-[#F8FAFC]">
                      <td className="py-3 px-4 font-medium text-[#0F172A]">{p.name}</td>
                      <td className="text-right py-3 px-4 text-[#0F172A]">{p.sales}</td>
                      <td className="text-right py-3 px-4 font-semibold text-[#0F172A]">${p.revenue.toLocaleString()}</td>
                      <td className="text-center py-3 px-4">
                        <Badge className={`${
                          p.trend === "up" ? "bg-[#16A34A]/10 text-[#16A34A]" :
                          p.trend === "down" ? "bg-[#DC2626]/10 text-[#DC2626]" :
                          "bg-[#F59E0B]/10 text-[#F59E0B]"
                        } text-[10px] px-1.5 py-0`}>
                          {p.trend === "up" ? "Trending Up" : p.trend === "down" ? "Trending Down" : "Flat"}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="retention" className="mt-4">
          <div className="bg-white rounded-xl p-5 border border-[#E2E8F0] shadow-sm">
            <h3 className="font-semibold text-[#0F172A] mb-4">Customer Retention & Acquisition</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={customerRetention}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                  <XAxis dataKey="month" tick={{ fontSize: 12, fill: "#64748B" }} />
                  <YAxis tick={{ fontSize: 12, fill: "#64748B" }} />
                  <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #E2E8F0", fontSize: 13 }} />
                  <Legend />
                  <Line type="monotone" dataKey="new" stroke="#0891B2" strokeWidth={2} dot={{ r: 4 }} name="New Customers" />
                  <Line type="monotone" dataKey="retained" stroke="#16A34A" strokeWidth={2} dot={{ r: 4 }} name="Retained" />
                  <Line type="monotone" dataKey="churned" stroke="#DC2626" strokeWidth={2} dot={{ r: 4 }} name="Churned" />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="grid grid-cols-3 gap-4 mt-4">
              <div className="p-3 rounded-lg bg-[#F8FAFC] text-center">
                <p className="text-xs text-[#64748B] uppercase">Repeat Rate</p>
                <p className="text-xl font-bold text-[#0891B2]">93%</p>
              </div>
              <div className="p-3 rounded-lg bg-[#F8FAFC] text-center">
                <p className="text-xs text-[#64748B] uppercase">Avg Lifetime</p>
                <p className="text-xl font-bold text-[#0F172A]">3.2 yrs</p>
              </div>
              <div className="p-3 rounded-lg bg-[#F8FAFC] text-center">
                <p className="text-xs text-[#64748B] uppercase">Churn Rate</p>
                <p className="text-xl font-bold text-[#DC2626]">4.8%</p>
              </div>
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
    </div>
  );
}
