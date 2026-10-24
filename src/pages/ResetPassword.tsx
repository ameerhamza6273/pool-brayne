import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Droplets, Eye, EyeOff } from "lucide-react";
import { getRememberedLogo } from "@/lib/remembered-logo";

// Client video 2026-10-23: landing page for the "Forgot password?" email (backend public.ts /forgot-password).
export default function ResetPassword() {
  const [params] = useSearchParams();
  const tokenHash = params.get("token_hash");
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [logo] = useState(getRememberedLogo);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (password.length < 6) return setError("Password must be at least 6 characters.");
    if (password !== confirmPassword) return setError("The two passwords don't match.");
    if (!tokenHash) return setError("This reset link is incomplete. Request a new one from the sign-in page.");
    setIsSubmitting(true);
    const { error: verifyError } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: "recovery" });
    if (verifyError) {
      setIsSubmitting(false);
      return setError("This reset link has expired or was already used. Request a new one from the sign-in page.");
    }
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setIsSubmitting(false);
    if (updateError) return setError(updateError.message);
    setDone(true);
  };

  return (
    <div className="min-h-screen flex flex-col justify-center items-center p-6 bg-[#F8FAFC]">
      <div className="w-full max-w-sm">
        {logo ? (
          <div className="flex justify-center mb-6">
            <img src={logo} alt="" className="block w-[187px] h-[60px] object-cover rounded-lg border border-[#E2E8F0]" />
          </div>
        ) : (
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="w-12 h-12 rounded-xl bg-[#0891B2] flex items-center justify-center">
            <Droplets className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-xl font-bold text-[#0F172A]">Clear Pool CRM</h1>
        </div>
        )}
        <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-lg p-6 sm:p-8">

        {done ? (
          <div className="space-y-4 text-center">
            <h2 className="text-2xl font-bold text-[#0F172A]">Password changed</h2>
            <p className="text-sm text-[#64748B]">You're signed in with your new password.</p>
            <Button className="w-full h-11 bg-[#0891B2] hover:bg-[#0E7490] text-white font-semibold" onClick={() => navigate("/dashboard")}>
              Continue
            </Button>
          </div>
        ) : (
          <>
            <h2 className="text-2xl font-bold text-[#0F172A] mb-2">Choose a new password</h2>
            <p className="text-sm text-[#64748B] mb-6">Enter it twice to make sure it's right.</p>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="new-password" className="text-sm font-medium text-[#0F172A]">New password</Label>
                <div className="relative mt-1">
                  <Input
                    id="new-password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="h-11 pr-10"
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
              <div>
                <Label htmlFor="confirm-password" className="text-sm font-medium text-[#0F172A]">Confirm new password</Label>
                <Input
                  id="confirm-password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="mt-1 h-11"
                />
              </div>
              {error && <p className="text-sm text-[#DC2626]">{error}</p>}
              <Button type="submit" disabled={isSubmitting} className="w-full h-11 bg-[#0891B2] hover:bg-[#0E7490] text-white font-semibold">
                {isSubmitting ? "Saving..." : "Save new password"}
              </Button>
            </form>
            <div className="mt-4 text-center">
              <button onClick={() => navigate("/login")} className="text-sm text-[#0891B2] hover:text-[#0E7490] font-medium">Back to sign in</button>
            </div>
          </>
        )}
        </div>
      </div>
    </div>
  );
}
