import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/apiClient";
import { getRememberedLogo } from "@/lib/remembered-logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Droplets, CheckCircle, Eye, EyeOff } from "lucide-react";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  // Client video 2026-10-23: "Forgot password?" was a bare button with no handler -- it now emails a
  // reset link (backend public.ts /forgot-password -> /reset-password).
  const [forgotMode, setForgotMode] = useState(false);
  const [forgotSending, setForgotSending] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);
  const { signIn } = useAuth();
  // Dev 2026-10-23: the company logo replaces the droplet + "Clear Pool CRM" in the brand panel, on a
  // device that has signed in before (remembered-logo.ts); the form itself is unchanged.
  const [logo] = useState(getRememberedLogo);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsSubmitting(true);
    const signInError = await signIn(email, password);
    setIsSubmitting(false);
    if (!signInError) {
      navigate("/dashboard");
    } else {
      setError(signInError);
    }
  };

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!email.trim()) return setError("Enter your email address.");
    setForgotSending(true);
    try {
      await api.post("/api/public/forgot-password", { email: email.trim() });
      setForgotSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't send the reset email. Please try again.");
    }
    setForgotSending(false);
  };

  const showForgot = (on: boolean) => {
    setForgotMode(on);
    setForgotSent(false);
    setError("");
  };

  return (
    <div className="min-h-screen flex">
      {/* Left Brand Panel */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-[#0891B2] via-[#0E7490] to-[#164E63] flex-col justify-center items-center text-white p-12 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
            <path d="M0 50 Q25 30 50 50 T100 50" fill="none" stroke="white" strokeWidth="0.5" />
            <path d="M0 60 Q25 40 50 60 T100 60" fill="none" stroke="white" strokeWidth="0.3" />
            <path d="M0 40 Q25 20 50 40 T100 40" fill="none" stroke="white" strokeWidth="0.3" />
          </svg>
        </div>
        <div className="relative z-10 text-center max-w-md">
          {logo ? (
            <div className="w-[300px] mx-auto mb-8 rounded-lg border-2 border-white/40 overflow-hidden">
              <img src={logo} alt="" className="block w-full h-[96px] object-cover" />
            </div>
          ) : (
            <>
              <div className="w-20 h-20 rounded-2xl bg-white/20 backdrop-blur flex items-center justify-center mx-auto mb-8">
                <Droplets className="w-10 h-10 text-white" />
              </div>
              <h1 className="text-4xl font-bold mb-4">Clear Pool CRM</h1>
            </>
          )}
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

      {/* Right Form Panel */}
      <div className="flex-1 flex flex-col justify-center items-center p-6 lg:p-12 bg-[#F8FAFC]">
        <div className="w-full max-w-sm">
          <div className="lg:hidden flex items-center justify-center gap-3 mb-8">
            <div className="w-12 h-12 rounded-xl bg-[#0891B2] flex items-center justify-center">
              <Droplets className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-[#0F172A]">Clear Pool CRM</h1>
              <p className="text-xs text-[#64748B]">Built by a tradesman. Built for the trades.</p>
            </div>
          </div>

          {forgotMode ? (
            <>
              <h2 className="text-2xl font-bold text-[#0F172A] mb-2">Reset your password</h2>
              {forgotSent ? (
                <div className="space-y-4">
                  <div className="rounded-lg border border-[#16A34A]/30 bg-[#16A34A]/10 p-3 text-sm text-[#15803D]">
                    Reset link sent. If <span className="font-semibold break-all">{email.trim()}</span> has a Clear Pool CRM login, an email is on its way. Check your Junk folder if it isn't in your inbox within a few minutes.
                  </div>
                  <Button type="button" variant="outline" className="w-full h-11" onClick={() => setForgotSent(false)}>Send again</Button>
                </div>
              ) : (
                <>
                  <p className="text-sm text-[#64748B] mb-6">Enter your login email and we'll send you a link to choose a new password.</p>
                  <form onSubmit={handleForgot} className="space-y-4">
                    <div>
                      <Label htmlFor="forgot-email" className="text-sm font-medium text-[#0F172A]">Email</Label>
                      <Input id="forgot-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1 h-11" placeholder="you@company.com" />
                    </div>
                    {error && <p className="text-sm text-[#DC2626]">{error}</p>}
                    <Button type="submit" disabled={forgotSending} className="w-full h-11 bg-[#0891B2] hover:bg-[#0E7490] text-white font-semibold">
                      {forgotSending ? "Sending..." : "Send reset link"}
                    </Button>
                  </form>
                </>
              )}
              <div className="mt-4 text-center">
                <button type="button" onClick={() => showForgot(false)} className="text-sm text-[#0891B2] hover:text-[#0E7490] font-medium">Back to sign in</button>
              </div>
            </>
          ) : (
          <>
          <h2 className="text-2xl font-bold text-[#0F172A] mb-2">Sign in</h2>
          <p className="text-sm text-[#64748B] mb-6">Welcome back to Clear Pool CRM</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="email" className="text-sm font-medium text-[#0F172A]">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 h-11"
                placeholder="you@company.com"
              />
            </div>
            <div>
              <Label htmlFor="password" className="text-sm font-medium text-[#0F172A]">Password</Label>
              <div className="relative mt-1">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-11 pr-10"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#64748B] hover:text-[#0F172A]"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            {error && <p className="text-sm text-[#DC2626]">{error}</p>}
            <Button type="submit" disabled={isSubmitting} className="w-full h-11 bg-[#0891B2] hover:bg-[#0E7490] text-white font-semibold">
              {isSubmitting ? "Signing in..." : "Sign in"}
            </Button>
          </form>

          <div className="mt-4 text-center">
            <button type="button" onClick={() => showForgot(true)} className="text-sm text-[#0891B2] hover:text-[#0E7490] font-medium">Forgot password?</button>
          </div>
          </>
          )}

          <div className="mt-6 pt-6 border-t border-[#E2E8F0] text-center">
            <p className="text-sm text-[#64748B]">
              Don't have an account?{" "}
              <button onClick={() => navigate("/signup")} className="text-[#0891B2] hover:text-[#0E7490] font-medium">
                Sign up
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
