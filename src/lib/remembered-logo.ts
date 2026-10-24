// Dev ask 2026-10-23: show the company's logo instead of "Clear Pool CRM" on the sign-in, forgot and reset screens.
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
