import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import { Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/lib/language-context";

// Client videos (2026-09-23 SKU delete, 2026-10-18 dev note): every delete asks first, in the same
// popup style as Inventory's "Delete SKU permanently?" -- many trash icons used to delete on the
// first click. Buttons read "No" / "Yes" (client video 2026-10-18: "delete photo and then put yes or
// no there" instead of Cancel/Delete). Usage: `const confirm = useConfirm(); if (!(await confirm({ title, name }))) return;`
type ConfirmOptions = { title: string; name?: string | null; message?: string; confirmLabel?: string; tone?: "danger" | "default" };
const ConfirmContext = createContext<(o: ConfirmOptions) => Promise<boolean>>(async () => true);

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const { t } = useLanguage();
  const [opts, setOpts] = useState<ConfirmOptions | null>(null);
  const resolver = useRef<((ok: boolean) => void) | null>(null);
  const confirm = useCallback((o: ConfirmOptions) => new Promise<boolean>((resolve) => {
    resolver.current?.(false);
    resolver.current = resolve;
    setOpts(o);
  }), []);
  const close = (ok: boolean) => {
    resolver.current?.(ok);
    resolver.current = null;
    setOpts(null);
  };
  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Dialog open={!!opts} onOpenChange={(open) => { if (!open) close(false); }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{opts ? t(opts.title) : ""}</DialogTitle></DialogHeader>
          <div className="space-y-3 pt-1 text-sm">
            {opts?.name && (
              <div className="rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] p-3">
                <p className="font-medium text-[#0F172A] break-words">{opts.name}</p>
              </div>
            )}
            <p className="text-[#475569]">{t(opts?.message ?? "Are you sure? This cannot be undone.")}</p>
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" onClick={() => close(false)}>{t("No")}</Button>
              <Button className={opts?.tone === "default" ? "bg-[#0891B2] hover:bg-[#0E7490] text-white" : "bg-[#DC2626] hover:bg-[#B91C1C] text-white"} onClick={() => close(true)}>
                {opts?.tone !== "default" && <Trash2 className="w-4 h-4 mr-1.5" />}{t(opts?.confirmLabel ?? "Yes")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </ConfirmContext.Provider>
  );
}

export const useConfirm = () => useContext(ConfirmContext);
