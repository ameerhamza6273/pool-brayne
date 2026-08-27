import { useNavigate } from "react-router-dom";
import {
  Droplets, Wrench, Users, Package, Truck, Clock, Receipt, Megaphone, BarChart3,
  CheckCircle2, ArrowRight, Star, Shield, Zap, MapPin, CreditCard, BookOpen,
  MessageSquare,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

const features = [
  { icon: Users, title: "Customer CRM", desc: "Full profiles, equipment history, purchase tracking, and one-tap communication" },
  { icon: Wrench, title: "Job & Dispatch", desc: "Pipeline from lead to completion, recurring routes, real-time dispatch" },
  { icon: Package, title: "Inventory", desc: "Store + vehicle stock tracking, low-stock alerts, auto-deduction on job close" },
  { icon: Truck, title: "Fleet Tracking", desc: "Live GPS inside the app — no separate login, vendor-agnostic API layer" },
  { icon: Clock, title: "Time & Payroll", desc: "GPS-verified clock in/out, job costing, one-click export to Gusto or ADP" },
  { icon: Receipt, title: "Invoicing & Payments", desc: "Generate from jobs, collect in-app, two-way QuickBooks sync" },
  { icon: Megaphone, title: "Follow-Up & Campaigns", desc: "Automated SMS/email, seasonal reactivation, review requests, two-way SMS inbox" },
  { icon: BarChart3, title: "Reporting Dashboard", desc: "Real-time revenue, technician performance, inventory burn, customer retention" },
];

const integrations = [
  { name: "QuickBooks Online", icon: BookOpen, status: "Two-way sync" },
  { name: "Stripe", icon: CreditCard, status: "Payments & billing" },
  { name: "Gusto / ADP", icon: Clock, status: "Payroll export" },
  { name: "Twilio", icon: MessageSquare, status: "SMS campaigns" },
  { name: "Fleet GPS", icon: MapPin, status: "Live tracking" },
];

export default function SalesPortal() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      {/* Hero */}
      <div className="bg-gradient-to-br from-[#0C2A3A] via-[#0C2A3A] to-[#0891B2] text-white">
        <div className="max-w-6xl mx-auto px-6 py-16 lg:py-24">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-xl bg-[#0891B2] flex items-center justify-center">
              <Droplets className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">PoolBrayne</h1>
              <p className="text-xs text-white/60 uppercase tracking-wider">Powered by Brayne AI</p>
            </div>
          </div>
          <h2 className="text-4xl lg:text-5xl font-bold mb-4 max-w-2xl">
            One login. One app. Everything in one place.
          </h2>
          <p className="text-lg text-white/80 mb-8 max-w-xl">
            The first business operating system built exclusively for pool supply, repair, and service companies.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button
              className="bg-[#0891B2] hover:bg-[#0E7490] text-white h-12 px-6 gap-2"
              onClick={() => navigate("/signup")}
            >
              Start Free Trial <ArrowRight className="w-4 h-4" />
            </Button>
            <Button
              variant="outline"
              className="h-12 px-6 border-white/30 text-white hover:bg-white/10"
              onClick={() => navigate("/login")}
            >
              Sign In
            </Button>
          </div>
          <div className="flex items-center gap-6 mt-8 text-sm text-white/70">
            <span className="flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-[#67E8F9]" /> 14-day free trial</span>
            <span className="flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-[#67E8F9]" /> No credit card required</span>
            <span className="flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-[#67E8F9]" /> Cancel anytime</span>
          </div>
        </div>
      </div>

      {/* Tagline Banner */}
      <div className="bg-[#0891B2] py-4">
        <div className="max-w-6xl mx-auto px-6 text-center">
          <p className="text-white font-medium text-lg">
            Built by a tradesman. Built for the trades.
          </p>
        </div>
      </div>

      {/* Problem Section */}
      <div className="max-w-6xl mx-auto px-6 py-16">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div>
            <Badge className="bg-[#F59E0B]/10 text-[#F59E0B] mb-4">The Problem</Badge>
            <h3 className="text-3xl font-bold text-[#0F172A] mb-4">
              Running a pool business shouldn't require five different logins
            </h3>
            <p className="text-[#64748B] mb-6">
              Pool businesses at the $1M–$5M level are running on friction. Owners log into separate tools for scheduling, inventory, payroll, CRM, fleet tracking, and accounting. None of them talk to each other.
            </p>
            <div className="space-y-3">
              {[
                "QuickBooks POS discontinued — no more updates",
                "Fleet tracking via separate Chinese vendor login",
                "No unified customer history or follow-up",
                "No time tracking tied to payroll",
                "No reactivation system for lapsed customers",
                "No single view of business health",
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-3 text-[#0F172A]">
                  <div className="w-5 h-5 rounded-full bg-[#DC2626]/10 flex items-center justify-center shrink-0">
                    <div className="w-2 h-2 rounded-full bg-[#DC2626]" />
                  </div>
                  <span className="text-sm">{item}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="bg-[#0C2A3A] rounded-2xl p-6 lg:p-8 text-white">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-lg bg-[#0891B2] flex items-center justify-center">
                <Droplets className="w-5 h-5" />
              </div>
              <div>
                <p className="font-bold">PoolBrayne</p>
                <p className="text-xs text-white/60">All modules, one screen</p>
              </div>
            </div>
            <div className="space-y-3">
              {features.map((f, i) => {
                const Icon = f.icon;
                return (
                  <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-white/5 hover:bg-white/10 transition-colors cursor-pointer">
                    <Icon className="w-5 h-5 text-[#67E8F9] shrink-0" />
                    <span className="text-sm font-medium">{f.title}</span>
                    <CheckCircle2 className="w-4 h-4 text-[#16A34A] ml-auto shrink-0" />
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Features Grid */}
      <div className="bg-white py-16">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-12">
            <Badge className="bg-[#0891B2]/10 text-[#0891B2] mb-3">Platform Modules</Badge>
            <h3 className="text-3xl font-bold text-[#0F172A] mb-2">Everything your pool business needs</h3>
            <p className="text-[#64748B] max-w-xl mx-auto">
              Not a generic CRM with pool settings. Every feature is designed around how pool businesses actually operate.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {features.map((f, i) => {
              const Icon = f.icon;
              return (
                <Card key={i} className="border-[#E2E8F0] shadow-sm hover:shadow-md transition-shadow">
                  <CardContent className="p-5">
                    <div className="w-10 h-10 rounded-lg bg-[#0891B2]/10 flex items-center justify-center mb-3">
                      <Icon className="w-5 h-5 text-[#0891B2]" />
                    </div>
                    <h4 className="font-semibold text-[#0F172A] mb-1">{f.title}</h4>
                    <p className="text-sm text-[#64748B]">{f.desc}</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </div>

      {/* Integrations */}
      <div className="max-w-6xl mx-auto px-6 py-16">
        <div className="text-center mb-10">
          <Badge className="bg-[#16A34A]/10 text-[#16A34A] mb-3">Connected</Badge>
          <h3 className="text-3xl font-bold text-[#0F172A] mb-2">Works with the tools you already use</h3>
          <p className="text-[#64748B]">Each client connects their own account — fully isolated per tenant.</p>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          {integrations.map((int, i) => {
            const Icon = int.icon;
            return (
              <div key={i} className="p-4 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-center">
                <div className="w-12 h-12 rounded-xl bg-[#0891B2]/10 flex items-center justify-center mx-auto mb-3">
                  <Icon className="w-6 h-6 text-[#0891B2]" />
                </div>
                <p className="font-medium text-sm text-[#0F172A]">{int.name}</p>
                <p className="text-xs text-[#64748B] mt-1">{int.status}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Pricing */}
      <div className="bg-white py-16">
        <div className="max-w-4xl mx-auto px-6">
          <div className="text-center mb-10">
            <h3 className="text-3xl font-bold text-[#0F172A] mb-2">Simple pricing</h3>
            <p className="text-[#64748B]">Start with a 14-day free trial. No credit card required.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { name: "Starter", price: 149, desc: "For small teams up to 3 users", features: ["Up to 3 technicians", "Basic dispatch", "Invoicing", "Email support"] },
              { name: "Pro", price: 299, desc: "For growing businesses", features: ["Up to 10 technicians", "Fleet tracking", "SMS campaigns", "QuickBooks sync", "Priority support"], popular: true },
              { name: "Enterprise", price: 599, desc: "For multi-location operations", features: ["Unlimited technicians", "Multi-location", "API access", "Dedicated account manager", "White-glove onboarding"] },
            ].map((plan, i) => (
              <div key={i} className={`rounded-xl border p-6 ${plan.popular ? "border-[#0891B2] ring-2 ring-[#0891B2] bg-[#0891B2]/5" : "border-[#E2E8F0]"}`}>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-semibold text-[#0F172A]">{plan.name}</h4>
                  {plan.popular && <Badge className="bg-[#0891B2] text-white">Most Popular</Badge>}
                </div>
                <p className="text-3xl font-bold text-[#0F172A]">${plan.price}<span className="text-sm font-normal text-[#64748B]">/mo</span></p>
                <p className="text-sm text-[#64748B] mt-1 mb-4">{plan.desc}</p>
                <ul className="space-y-2 mb-6">
                  {plan.features.map((f, j) => (
                    <li key={j} className="flex items-center gap-2 text-sm text-[#0F172A]">
                      <CheckCircle2 className="w-4 h-4 text-[#16A34A]" /> {f}
                    </li>
                  ))}
                </ul>
                <Button
                  className={`w-full h-10 ${plan.popular ? "bg-[#0891B2] hover:bg-[#0E7490] text-white" : "bg-[#F8FAFC] text-[#0F172A] border border-[#E2E8F0]"}`}
                  onClick={() => navigate("/signup")}
                >
                  {plan.popular ? "Start Free Trial" : "Select Plan"}
                </Button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* CTA */}
      <div className="bg-[#0C2A3A] py-16">
        <div className="max-w-2xl mx-auto px-6 text-center">
          <h3 className="text-3xl font-bold text-white mb-4">
            Ready to stop logging into five different apps?
          </h3>
          <p className="text-white/70 mb-8">
            Join pool business owners who are replacing their fragmented stack with one purpose-built platform.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Button
              className="bg-[#0891B2] hover:bg-[#0E7490] text-white h-12 px-8 gap-2"
              onClick={() => navigate("/signup")}
            >
              Start Free Trial <ArrowRight className="w-4 h-4" />
            </Button>
            <Button
              variant="outline"
              className="h-12 px-8 border-white/30 text-white hover:bg-white/10"
              onClick={() => navigate("/login")}
            >
              Sign In
            </Button>
          </div>
          <div className="flex items-center justify-center gap-6 mt-8 text-sm text-white/50">
            <span className="flex items-center gap-1.5"><Star className="w-4 h-4 text-[#F59E0B]" /> Built by a pool pro</span>
            <span className="flex items-center gap-1.5"><Shield className="w-4 h-4 text-[#67E8F9]" /> Secure & isolated</span>
            <span className="flex items-center gap-1.5"><Zap className="w-4 h-4 text-[#67E8F9]" /> 14-day trial</span>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-[#0C2A3A] border-t border-white/10 py-8">
        <div className="max-w-6xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#0891B2] flex items-center justify-center">
              <Droplets className="w-4 h-4 text-white" />
            </div>
            <div>
              <p className="font-bold text-white text-sm">PoolBrayne</p>
              <p className="text-xs text-white/50">Powered by Brayne AI</p>
            </div>
          </div>
          <p className="text-sm text-white/50">
            Built by a tradesman. Built for the trades.
          </p>
          <div className="flex items-center gap-4 text-sm text-white/50">
            <button onClick={() => navigate("/login")} className="hover:text-white transition-colors">Sign In</button>
            <button onClick={() => navigate("/signup")} className="hover:text-white transition-colors">Sign Up</button>
          </div>
        </div>
      </footer>
    </div>
  );
}
