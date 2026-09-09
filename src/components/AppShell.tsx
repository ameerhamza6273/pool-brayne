import { useState } from "react";
import { Outlet, useLocation, useNavigate, Link } from "react-router-dom";
import {
  LayoutDashboard, Users, Wrench, Package, Truck, Clock, Receipt, Megaphone, Settings,
  Search, ChevronDown, ChevronRight, Menu, MoreHorizontal, X, Droplets, Phone, ScanLine, ClipboardList, Calendar, Copy,
  BookUser, BarChart3, ListChecks, Handshake, Boxes, Briefcase, Database, BookOpen, Factory, FileStack, Wand2,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import NotificationsPanel from "@/components/NotificationsPanel";
import LanguageToggle from "@/components/LanguageToggle";

import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";

type NavLink = { path: string; label: string; icon: typeof LayoutDashboard };
type NavGroup = { label: string; icon: typeof LayoutDashboard; items: NavLink[] };

// Sidebar restructure requested by client (PDF "crm 9-6-2026 updates.pdf", 2026-09-06):
// collapsible category groups on the left instead of one long flat list. Every entry still
// deep-links to an existing page/tab rather than duplicating that page's data-fetching in a new
// route (same pattern as the earlier "Purchase Order"/"Schedule"/"Estimation" shortcuts,
// 2026-08-28). Two of the client's literal sub-items don't map to a distinct destination and were
// deliberately folded into their neighbor rather than duplicated: "Receive PO's" opens the same
// Purchase Orders tab as "New PO's" (its own edit dialog is how a PO gets marked Received), and
// "Send invoices" is an action inside Customer Invoices, not a separate page.
const navSections: (NavLink | NavGroup)[] = [
  { path: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { path: "/pos", label: "POS", icon: ScanLine },
  {
    label: "Scheduling Tools",
    icon: Calendar,
    items: [
      { path: "/field", label: "Technician Field", icon: Phone },
      { path: "/jobs", label: "Jobs", icon: Wrench },
      { path: "/jobs?tab=schedule", label: "Recurring", icon: ListChecks },
      { path: "/invoicing?tab=tasks", label: "Tasks", icon: ClipboardList },
      { path: "/jobs?tab=dispatch", label: "Dispatch", icon: Truck },
      { path: "/fleet", label: "Fleet", icon: Truck },
    ],
  },
  {
    label: "Customer Tools",
    icon: Handshake,
    items: [
      { path: "/invoicing?tab=estimates", label: "Estimates / Quotes", icon: Copy },
      { path: "/invoicing", label: "Customer Invoices", icon: Receipt },
    ],
  },
  {
    label: "Vendor Tools",
    icon: Boxes,
    items: [
      { path: "/inventory?tab=purchase", label: "Purchase Orders", icon: ClipboardList },
      { path: "/inventory?tab=vendor-bills", label: "Pay POs (Vendor Bills)", icon: Receipt },
    ],
  },
  {
    label: "Employee Section",
    icon: Briefcase,
    items: [
      { path: "/timesheets", label: "Timesheets", icon: Clock },
      { path: "/directory", label: "Directory", icon: BookUser },
      { path: "/library", label: "Library", icon: BookOpen },
      { path: "/forms", label: "Forms", icon: FileStack },
      { path: "/form-builder", label: "Form Builder", icon: Wand2 },
    ],
  },
  {
    label: "Data",
    icon: Database,
    items: [
      { path: "/customers", label: "Customers List", icon: Users },
      { path: "/inventory", label: "Inventory List", icon: Package },
      { path: "/inventory?tab=suppliers", label: "Vendor List", icon: Boxes },
      { path: "/manufacturers", label: "Manufacture List", icon: Factory },
    ],
  },
  {
    label: "Marketing",
    icon: Megaphone,
    items: [
      { path: "/campaigns", label: "Campaigns", icon: Megaphone },
      { path: "/reports?tab=reminders", label: "Reminders", icon: BarChart3 },
    ],
  },
  { path: "/reports", label: "Reports", icon: BarChart3 },
  { path: "/settings", label: "Settings", icon: Settings },
];

const isGroup = (entry: NavLink | NavGroup): entry is NavGroup => "items" in entry;
const flatNavLinks: NavLink[] = navSections.flatMap((entry) => (isGroup(entry) ? entry.items : [entry]));

const mobileTabs = [
  { path: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { path: "/jobs", label: "Jobs", icon: Wrench },
  { path: "/customers", label: "Customers", icon: Users },
  { path: "/invoicing", label: "Invoicing", icon: Receipt },
  { path: "more", label: "More", icon: MoreHorizontal },
];

export default function AppShell() {
  const { pathname, search } = useLocation();
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const [searchOpen, setSearchOpen] = useState(false);
  const [mobileMoreOpen, setMobileMoreOpen] = useState(false);
  // Groups default open ("(collapsible fields)" per the client's spec — collapsible, not
  // collapsed-by-default).
  const [closedGroups, setClosedGroups] = useState<Set<string>>(new Set());
  const toggleGroup = (label: string) => {
    setClosedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  };

  const isActive = (path: string) => {
    const [p, query] = path.split("?");
    if (query) return pathname === p && search === `?${query}`;
    return (pathname === p || pathname.startsWith(p + "/")) && !search;
  };
  const isGroupActive = (group: NavGroup) => group.items.some((item) => isActive(item.path));

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex flex-col w-64 bg-[#0C2A3A] text-white fixed h-screen z-40">
        <div className="p-6 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[#0891B2] flex items-center justify-center">
              <Droplets className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-lg tracking-tight">Clear Pool CRM</h1>
              <p className="text-[10px] text-white/50 uppercase tracking-wider">Powered by Brayne AI</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto sidebar-scroll">
          {navSections.map((entry) => {
            if (!isGroup(entry)) {
              const Icon = entry.icon;
              const active = isActive(entry.path);
              return (
                <Link
                  key={entry.path}
                  to={entry.path}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    active ? "bg-[#0891B2]/20 text-[#67E8F9]" : "text-white/70 hover:text-white hover:bg-white/5"
                  }`}
                >
                  <Icon className="w-5 h-5 shrink-0" />
                  <span>{entry.label}</span>
                </Link>
              );
            }
            const groupActive = isGroupActive(entry);
            const open = !closedGroups.has(entry.label);
            const GroupIcon = entry.icon;
            return (
              <Collapsible key={entry.label} open={open} onOpenChange={() => toggleGroup(entry.label)}>
                <CollapsibleTrigger asChild>
                  <button
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                      groupActive ? "text-[#67E8F9]" : "text-white/70 hover:text-white hover:bg-white/5"
                    }`}
                  >
                    <GroupIcon className="w-5 h-5 shrink-0" />
                    <span className="flex-1 text-left">{entry.label}</span>
                    {open ? <ChevronDown className="w-3.5 h-3.5 shrink-0" /> : <ChevronRight className="w-3.5 h-3.5 shrink-0" />}
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent className="pl-4 space-y-1 mt-1">
                  {entry.items.map((item) => {
                    const Icon = item.icon;
                    const active = isActive(item.path);
                    return (
                      <Link
                        key={item.path}
                        to={item.path}
                        className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
                          active ? "bg-[#0891B2]/20 text-[#67E8F9] font-medium" : "text-white/60 hover:text-white hover:bg-white/5"
                        }`}
                      >
                        <Icon className="w-4 h-4 shrink-0" />
                        <span>{item.label}</span>
                      </Link>
                    );
                  })}
                </CollapsibleContent>
              </Collapsible>
            );
          })}
        </nav>

        <div className="p-4 border-t border-white/10">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-white/5 transition-colors text-left">
                <Avatar className="w-8 h-8 border border-white/20">
                  <AvatarFallback className="bg-[#0891B2] text-white text-xs">{user?.avatar || "BR"}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{user?.company || "Bryan's Pool Co"}</p>
                  <p className="text-xs text-white/50">{user?.tenantId || "Tenant 001"}</p>
                </div>
                <ChevronDown className="w-4 h-4 text-white/50" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem onClick={() => navigate("/settings")}>Company Settings</DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate("/onboarding")}>New Tenant</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </aside>

      {/* Main Content Area */}
      {/* Client bug report 2026-09-04: a wide table (e.g. Inventory's Catalog) could stretch this
          flex item past the viewport, dragging the whole page (sidebar included) into a
          horizontal scroll -- min-w-0 lets it shrink so page-internal tables scroll within their
          own overflow-x-auto instead of blowing out the layout. */}
      <div className="flex-1 lg:ml-64 flex flex-col min-h-screen min-w-0">
        {/* Desktop Top Bar */}
        <header className="hidden lg:flex items-center gap-4 px-6 py-3 bg-white border-b border-[#E2E8F0] sticky top-0 z-30">
          <div className="flex-1 max-w-md relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#64748B]" />
            <Input
              placeholder="Search customers, jobs, invoices..."
              className="pl-9 h-9 bg-[#F8FAFC] border-[#E2E8F0] text-sm"
            />
          </div>
          <div className="flex items-center gap-3 ml-auto">
            <LanguageToggle />
            <NotificationsPanel />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2 px-2 py-1 rounded-lg hover:bg-[#F8FAFC] transition-colors">
                  <Avatar className="w-8 h-8">
                    <AvatarFallback className="bg-[#0891B2] text-white text-xs">{user?.avatar || "BR"}</AvatarFallback>
                  </Avatar>
                  <ChevronDown className="w-4 h-4 text-[#64748B]" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => navigate("/settings")}>Profile</DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate("/settings")}>Settings</DropdownMenuItem>
                <DropdownMenuItem onClick={() => signOut()}>Log out</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* Mobile Header */}
        <header className="lg:hidden flex items-center justify-between px-4 py-3 bg-white border-b border-[#E2E8F0] sticky top-0 z-30">
          <div className="flex items-center gap-2">
            <Sheet open={searchOpen} onOpenChange={setSearchOpen}>
              <SheetTrigger asChild>
                <button className="p-2 rounded-lg hover:bg-[#F8FAFC]">
                  <Menu className="w-5 h-5 text-[#0F172A]" />
                </button>
              </SheetTrigger>
              <SheetContent side="left" className="w-72 bg-[#0C2A3A] text-white p-0">
                <div className="p-6 border-b border-white/10">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-[#0891B2] flex items-center justify-center">
                      <Droplets className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h1 className="font-bold text-lg tracking-tight">Clear Pool CRM</h1>
                    </div>
                  </div>
                </div>
                <nav className="py-4 px-3 space-y-1 overflow-y-auto max-h-[calc(100vh-6rem)] sidebar-scroll">
                  {flatNavLinks.map((item) => {
                    const Icon = item.icon;
                    const active = isActive(item.path);
                    return (
                      <Link
                        key={item.path}
                        to={item.path}
                        onClick={() => setSearchOpen(false)}
                        className={`flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium transition-colors ${
                          active ? "bg-[#0891B2]/20 text-[#67E8F9]" : "text-white/70 hover:text-white hover:bg-white/5"
                        }`}
                      >
                        <Icon className="w-5 h-5 shrink-0" />
                        <span>{item.label}</span>
                      </Link>
                    );
                  })}
                </nav>
              </SheetContent>
            </Sheet>
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-md bg-[#0891B2] flex items-center justify-center">
                <Droplets className="w-4 h-4 text-white" />
              </div>
              <span className="font-semibold text-sm text-[#0F172A]">{user?.company || "New Pool Company"}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <LanguageToggle />
            <NotificationsPanel />
            <Avatar className="w-8 h-8">
              <AvatarFallback className="bg-[#0891B2] text-white text-xs">{user?.avatar || "BR"}</AvatarFallback>
            </Avatar>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 p-4 lg:p-6 pb-24 lg:pb-6 min-w-0">
          <Outlet />
        </main>

        {/* Mobile Bottom Tab Bar */}
        <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-[#E2E8F0] z-50 flex justify-around items-center h-16 px-2">
          {mobileTabs.map((tab) => {
            const Icon = tab.icon;
            const active = tab.path === "more" ? false : isActive(tab.path);
            if (tab.path === "more") {
              return (
                <Sheet key={tab.path} open={mobileMoreOpen} onOpenChange={setMobileMoreOpen}>
                  <SheetTrigger asChild>
                    <button className={`flex flex-col items-center gap-0.5 py-2 px-3 rounded-lg ${active ? "text-[#0891B2]" : "text-[#64748B]"}`}>
                      <Icon className="w-5 h-5" />
                      <span className="text-[10px] font-medium">{tab.label}</span>
                    </button>
                  </SheetTrigger>
                  <SheetContent side="bottom" className="h-[70vh] rounded-t-xl">
                    <div className="flex items-center justify-between py-2">
                      <h3 className="font-semibold text-lg">More</h3>
                      <button onClick={() => setMobileMoreOpen(false)}>
                        <X className="w-5 h-5 text-[#64748B]" />
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-3 mt-4">
                      {flatNavLinks.filter((n) => !mobileTabs.some((m) => m.path === n.path)).map((item) => {
                        const ItemIcon = item.icon;
                        return (
                          <Link
                            key={item.path}
                            to={item.path}
                            onClick={() => setMobileMoreOpen(false)}
                            className="flex flex-col items-center gap-2 p-4 rounded-xl bg-[#F8FAFC] hover:bg-[#E2E8F0] transition-colors"
                          >
                            <ItemIcon className="w-6 h-6 text-[#0891B2]" />
                            <span className="text-sm font-medium text-[#0F172A]">{item.label}</span>
                          </Link>
                        );
                      })}
                    </div>
                    <div className="mt-6 pt-4 border-t border-[#E2E8F0]">
                      <button onClick={() => signOut()} className="w-full py-3 text-[#DC2626] font-medium text-sm">
                        Log Out
                      </button>
                    </div>
                  </SheetContent>
                </Sheet>
              );
            }
            return (
              <Link
                key={tab.path}
                to={tab.path}
                className={`flex flex-col items-center gap-0.5 py-2 px-3 rounded-lg ${active ? "text-[#0891B2]" : "text-[#64748B]"}`}
              >
                <Icon className="w-5 h-5" />
                <span className="text-[10px] font-medium">{tab.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
