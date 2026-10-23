// Dev ask 2026-10-23: show the company's logo instead of "Clear Pool CRM" on the sign-in, forgot
// and reset screens. Those screens run before we know which tenant is signing in (the app is
// multi-tenant), so the logo is remembered per device after a sign-in (AppShell) and only shown
// there; a new device, or a tenant with no logo, keeps the Clear Pool CRM mark.
const KEY = "remembered-tenant-logo";

export function getRememberedLogo(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function rememberLogo(url: string | null) {
  try {
    if (url) localStorage.setItem(KEY, url);
    else localStorage.removeItem(KEY);
  } catch {
    // storage blocked (private window etc.) -- the sign-in page just keeps the default mark
  }
}
