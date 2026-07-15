import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Droplets, CheckCircle } from "lucide-react";

export default function Signup() {
  const [company, setCompany] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!company || !name || !email || !password) {
      setError("Please fill in all fields");
      return;
    }
    const success = login(email, password, { name, company });
    if (success) {
      navigate("/dashboard");
    }
  };

  return (
    <div className="min-h-screen flex">
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-[#0891B2] via-[#0E7490] to-[#164E63] flex-col justify-center items-center text-white p-12 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
            <path d="M0 50 Q25 30 50 50 T100 50" fill="none" stroke="white" strokeWidth="0.5" />
            <path d="M0 60 Q25 40 50 60 T100 60" fill="none" stroke="white" strokeWidth="0.3" />
          </svg>
        </div>
        <div className="relative z-10 text-center max-w-md">
          <div className="w-20 h-20 rounded-2xl bg-white/20 backdrop-blur flex items-center justify-center mx-auto mb-8">
            <Droplets className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-4xl font-bold mb-4">PoolBrayne</h1>
          <p className="text-xl text-white/90 mb-8 font-medium">Built by a tradesman. Built for the trades.</p>
          <div className="space-y-3 text-left bg-white/10 backdrop-blur rounded-xl p-6">
            <div className="flex items-center gap-3">
              <CheckCircle className="w-5 h-5 text-[#67E8F9] shrink-0" />
              <span className="text-sm">One login. One app. Everything in one place.</span>
            </div>
            <div className="flex items-center gap-3">
              <CheckCircle className="w-5 h-5 text-[#67E8F9] shrink-0" />
              <span className="text-sm">Dispatch, invoice, and track from your phone.</span>
            </div>
            <div className="flex items-center gap-3">
              <CheckCircle className="w-5 h-5 text-[#67E8F9] shrink-0" />
              <span className="text-sm">QuickBooks, fleet, and payroll — all connected.</span>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col justify-center items-center p-6 lg:p-12 bg-[#F8FAFC]">
        <div className="w-full max-w-sm">
          <div className="lg:hidden flex items-center justify-center gap-3 mb-8">
            <div className="w-12 h-12 rounded-xl bg-[#0891B2] flex items-center justify-center">
              <Droplets className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-[#0F172A]">PoolBrayne</h1>
              <p className="text-xs text-[#64748B]">Built by a tradesman. Built for the trades.</p>
            </div>
          </div>

          <h2 className="text-2xl font-bold text-[#0F172A] mb-2">Create your account</h2>
          <p className="text-sm text-[#64748B] mb-6">Start your free 14-day trial of PoolBrayne Pro</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="company" className="text-sm font-medium text-[#0F172A]">Company name</Label>
              <Input id="company" value={company} onChange={(e) => setCompany(e.target.value)} className="mt-1 h-11" placeholder="Bryan's Pool Co" />
            </div>
            <div>
              <Label htmlFor="name" className="text-sm font-medium text-[#0F172A]">Your name</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} className="mt-1 h-11" placeholder="Bryan Smith" />
            </div>
            <div>
              <Label htmlFor="email" className="text-sm font-medium text-[#0F172A]">Email</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1 h-11" placeholder="you@company.com" />
            </div>
            <div>
              <Label htmlFor="password" className="text-sm font-medium text-[#0F172A]">Password</Label>
              <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="mt-1 h-11" placeholder="Min 8 characters" />
            </div>
            {error && <p className="text-sm text-[#DC2626]">{error}</p>}
            <Button type="submit" className="w-full h-11 bg-[#0891B2] hover:bg-[#0E7490] text-white font-semibold">Get started</Button>
          </form>

          <div className="mt-6 pt-6 border-t border-[#E2E8F0] text-center">
            <p className="text-sm text-[#64748B]">
              Already have an account?{" "}
              <button onClick={() => navigate("/login")} className="text-[#0891B2] hover:text-[#0E7490] font-medium">Sign in</button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
