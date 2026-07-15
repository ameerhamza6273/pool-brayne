import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  CheckCircle2, ChevronRight, Building2, BookOpen, Truck, CreditCard,
  Shield, Check, Droplets, Users, MessageSquare,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/auth-context";

const steps = [
  { id: 1, label: "Company", icon: Building2 },
  { id: 2, label: "QuickBooks", icon: BookOpen },
  { id: 3, label: "Integrations", icon: Truck },
  { id: 4, label: "Plan", icon: CreditCard },
];

const plans = [
  { id: "starter", name: "Starter", price: 149, description: "For small teams up to 3 users", features: ["Up to 3 technicians", "Basic dispatch", "Invoicing", "Email support"], recommended: false },
  { id: "pro", name: "Pro", price: 299, description: "For growing businesses", features: ["Up to 10 technicians", "Advanced dispatch", "Fleet tracking", "SMS campaigns", "QuickBooks sync", "Priority support"], recommended: true },
  { id: "enterprise", name: "Enterprise", price: 599, description: "For multi-location operations", features: ["Unlimited technicians", "Multi-location", "Custom workflows", "API access", "Dedicated account manager", "White-glove onboarding"], recommended: false },
];

export default function Onboarding() {
  const [step, setStep] = useState(1);
  const [selectedPlan, setSelectedPlan] = useState("pro");
  const [completed, setCompleted] = useState(false);
  const [companyName, setCompanyName] = useState("Bryan's Pool Co");
  const [email, setEmail] = useState("bryan@poolbrayne.com");
  const [name, setName] = useState("Bryan");
  const { login } = useAuth();
  const navigate = useNavigate();

  const getPlanName = () => {
    const plan = plans.find((p) => p.id === selectedPlan);
    return plan ? `PoolBrayne ${plan.name}` : "PoolBrayne";
  };

  const getTenantId = () => {
    const existing = localStorage.getItem("poolbrayne_tenant_count");
    const count = existing ? parseInt(existing, 10) : 1;
    return `Tenant ${String(count).padStart(3, "0")}`;
  };

  const nextStep = () => {
    if (step < 4) setStep(step + 1);
    else {
      setCompleted(true);
    }
  };

  if (completed) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC] p-6">
        <div className="text-center max-w-md">
          <div className="w-20 h-20 rounded-full bg-[#16A34A]/10 flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 className="w-10 h-10 text-[#16A34A]" />
          </div>
          <h1 className="text-2xl font-bold text-[#0F172A] mb-2">Welcome to PoolBrayne!</h1>
          <p className="text-[#64748B] mb-2">You're now {getTenantId()}</p>
          <p className="text-sm text-[#64748B] mb-8">Your company is set up and ready to go. Let's start managing your pool business.</p>
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-xl bg-[#0891B2] flex items-center justify-center">
              <Droplets className="w-6 h-6 text-white" />
            </div>
            <div className="text-left">
              <p className="font-semibold text-[#0F172A]">{companyName}</p>
              <p className="text-xs text-[#64748B]">{getTenantId()} &middot; {getPlanName()}</p>
            </div>
          </div>
          <Button
            className="bg-[#0891B2] hover:bg-[#0E7490] text-white h-12 px-8"
            onClick={() => {
              login(email, "password", { name, company: companyName, tenantId: getTenantId() });
              navigate("/dashboard");
            }}
          >
            Go to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-[#E2E8F0] px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#0891B2] flex items-center justify-center">
            <Droplets className="w-4 h-4 text-white" />
          </div>
          <h1 className="font-bold text-[#0F172A]">PoolBrayne</h1>
        </div>
      </header>

      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-2xl">
          {/* Stepper */}
          <div className="flex items-center justify-center mb-8">
            {steps.map((s, i) => {
              const Icon = s.icon;
              const isActive = s.id === step;
              const isDone = s.id < step;
              return (
                <div key={s.id} className="flex items-center">
                  <div className={`flex flex-col items-center gap-1.5`}>
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
                      isDone ? "bg-[#16A34A] text-white" : isActive ? "bg-[#0891B2] text-white" : "bg-[#F1F5F9] text-[#64748B]"
                    }`}>
                      {isDone ? <CheckCircle2 className="w-5 h-5" /> : <Icon className="w-5 h-5" />}
                    </div>
                    <span className={`text-xs font-medium ${isActive ? "text-[#0891B2]" : isDone ? "text-[#16A34A]" : "text-[#64748B]"}`}>
                      {s.label}
                    </span>
                  </div>
                  {i < steps.length - 1 && (
                    <div className={`w-16 h-0.5 mx-2 ${s.id < step ? "bg-[#16A34A]" : "bg-[#E2E8F0]"}`} />
                  )}
                </div>
              );
            })}
          </div>

          {/* Step Content */}
          <Card className="border-[#E2E8F0] shadow-sm">
            <CardContent className="p-6">
              {step === 1 && (
                <div className="space-y-4">
                  <h2 className="text-xl font-bold text-[#0F172A]">Company Details</h2>
                  <p className="text-sm text-[#64748B]">Tell us about your pool business.</p>
                  <div className="space-y-4">
                    <div>
                      <Label>Company Name</Label>
                      <Input value={companyName} onChange={(e) => setCompanyName(e.target.value)} className="mt-1 h-11" placeholder="Your company name" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Your Name</Label>
                        <Input value={name} onChange={(e) => setName(e.target.value)} className="mt-1 h-11" placeholder="Full name" />
                      </div>
                      <div>
                        <Label>Email</Label>
                        <Input value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1 h-11" placeholder="you@company.com" />
                      </div>
                    </div>
                    <div>
                      <Label>Address</Label>
                      <Input defaultValue="1200 Warehouse Blvd" className="mt-1 h-11" placeholder="Business address" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>City</Label>
                        <Input defaultValue="Austin" className="mt-1 h-11" />
                      </div>
                      <div>
                        <Label>State</Label>
                        <Input defaultValue="TX" className="mt-1 h-11" />
                      </div>
                    </div>
                    <div>
                      <Label>Phone</Label>
                      <Input defaultValue="(512) 555-1000" className="mt-1 h-11" placeholder="(000) 000-0000" />
                    </div>
                  </div>
                </div>
              )}

              {step === 2 && (
                <div className="space-y-4">
                  <h2 className="text-xl font-bold text-[#0F172A]">Connect QuickBooks</h2>
                  <p className="text-sm text-[#64748B]">Sync your invoices and payments automatically.</p>
                  <div className="p-6 rounded-xl border-2 border-dashed border-[#E2E8F0] bg-[#F8FAFC] text-center">
                    <div className="w-16 h-16 rounded-xl bg-[#16A34A]/10 flex items-center justify-center mx-auto mb-4">
                      <BookOpen className="w-8 h-8 text-[#16A34A]" />
                    </div>
                    <h3 className="font-semibold text-[#0F172A] mb-2">QuickBooks Online</h3>
                    <p className="text-sm text-[#64748B] mb-4">Connect your QuickBooks account for two-way sync. Your data stays secure and isolated.</p>
                    <Button className="bg-[#0891B2] hover:bg-[#0E7490] text-white gap-2 h-10">
                      <Shield className="w-4 h-4" /> Connect QuickBooks
                    </Button>
                    <p className="text-xs text-[#64748B] mt-3">You can skip this and connect later in Settings.</p>
                  </div>
                </div>
              )}

              {step === 3 && (
                <div className="space-y-4">
                  <h2 className="text-xl font-bold text-[#0F172A]">Connect Integrations</h2>
                  <p className="text-sm text-[#64748B]">Link your fleet and payroll providers.</p>
                  <div className="space-y-3">
                    {[
                      { name: "Fleet/GPS Provider", desc: "Live vehicle tracking and dispatch optimization", icon: Truck, status: "Connected" },
                      { name: "Gusto Payroll", desc: "Export timesheets directly to payroll", icon: Users, status: "Connected" },
                      { name: "Twilio (SMS)", desc: "Send and receive customer messages", icon: MessageSquare, status: "Connected" },
                      { name: "Stripe (Billing)", desc: "Process payments and subscriptions", icon: CreditCard, status: "Connected" },
                    ].map((int) => {
                      const Icon = int.icon;
                      return (
                        <div key={int.name} className="flex items-center gap-4 p-4 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0]">
                          <div className="w-12 h-12 rounded-xl bg-[#0891B2]/10 flex items-center justify-center shrink-0">
                            <Icon className="w-6 h-6 text-[#0891B2]" />
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <h3 className="font-medium text-[#0F172A]">{int.name}</h3>
                              <Badge className="bg-[#16A34A]/10 text-[#16A34A] text-[10px] px-1.5 py-0">{int.status}</Badge>
                            </div>
                            <p className="text-sm text-[#64748B]">{int.desc}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <p className="text-sm text-[#64748B]">Vendor-agnostic — swappable providers anytime from Settings.</p>
                </div>
              )}

              {step === 4 && (
                <div className="space-y-4">
                  <h2 className="text-xl font-bold text-[#0F172A]">Choose Your Plan</h2>
                  <p className="text-sm text-[#64748B]">Select the plan that fits your business. Upgrade anytime.</p>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {plans.map((plan) => (
                      <div
                        key={plan.id}
                        className={`rounded-xl border p-4 cursor-pointer transition-all ${
                          selectedPlan === plan.id ? "border-[#0891B2] ring-2 ring-[#0891B2] bg-[#0891B2]/5" : "border-[#E2E8F0] hover:bg-[#F8FAFC]"
                        }`}
                        onClick={() => setSelectedPlan(plan.id)}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <h3 className="font-semibold text-[#0F172A]">{plan.name}</h3>
                          {plan.recommended && <Badge className="bg-[#0891B2] text-white text-[10px] px-1.5 py-0">Best</Badge>}
                        </div>
                        <p className="text-2xl font-bold text-[#0F172A]">${plan.price}<span className="text-sm font-normal text-[#64748B]">/mo</span></p>
                        <p className="text-xs text-[#64748B] mt-1">{plan.description}</p>
                        <ul className="mt-3 space-y-1">
                          {plan.features.map((f, i) => (
                            <li key={i} className="flex items-center gap-1.5 text-xs text-[#0F172A]">
                              <Check className="w-3 h-3 text-[#16A34A]" /> {f}
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
                      </div>
                    ))}
                  </div>
                  <div className="p-4 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0]">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-[#16A34A]/10 flex items-center justify-center">
                        <CreditCard className="w-5 h-5 text-[#16A34A]" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-[#0F172A]">Stripe Checkout</p>
                        <p className="text-xs text-[#64748B]">Secure payment via Stripe. No card details stored.</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Navigation */}
              <div className="flex items-center justify-between mt-6 pt-4 border-t border-[#E2E8F0]">
                <Button
                  variant="outline"
                  className="h-10 border-[#E2E8F0] text-[#0F172A]"
                  onClick={() => step > 1 && setStep(step - 1)}
                  disabled={step === 1}
                >
                  Back
                </Button>
                <Button
                  className="bg-[#0891B2] hover:bg-[#0E7490] text-white h-10 gap-2"
                  onClick={nextStep}
                >
                  {step === 4 ? "Complete Setup" : "Continue"}
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
