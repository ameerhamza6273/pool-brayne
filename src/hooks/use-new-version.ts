import { useEffect, useState } from "react";

// Client videos 2026-10-18: a phone tab still showed the old grey "Map view" box days after the real map shipped
const SCRIPT_RE = /\/assets\/index-[^"']+\.js/;
const CHECK_EVERY_MS = 5 * 60 * 1000;

export function useNewVersionAvailable() {
  const [available, setAvailable] = useState(false);
  useEffect(() => {
    if (import.meta.env.DEV) return;
    const current = Array.from(document.scripts).map((s) => s.src.match(SCRIPT_RE)?.[0]).find(Boolean);
    if (!current) return;
    let stopped = false;
    const check = async () => {
      if (stopped || document.visibilityState !== "visible") return;
      try {
        const html = await (await fetch(`/?v=${Date.now()}`, { cache: "no-store" })).text();
        const deployed = html.match(SCRIPT_RE)?.[0];
        if (deployed && deployed !== current) setAvailable(true);
      } catch { /* offline -- try again next time */ }
    };
    const timer = window.setInterval(check, CHECK_EVERY_MS);
    document.addEventListener("visibilitychange", check);
    return () => { stopped = true; window.clearInterval(timer); document.removeEventListener("visibilitychange", check); };
  }, []);
  return available;
}
