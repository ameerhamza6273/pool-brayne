// Real card payment collection via Authorize.net Accept.js (client's confirmed real processor,
// sandbox developer account created 2026-09-03). Accept.js tokenizes the card client-side into
// an opaque payment nonce — the raw card number/CVV never reach our own server, only the
// resulting dataDescriptor/dataValue do.
const API_LOGIN_ID = import.meta.env.VITE_AUTHORIZENET_API_LOGIN_ID as string | undefined;
const PUBLIC_CLIENT_KEY = import.meta.env.VITE_AUTHORIZENET_PUBLIC_CLIENT_KEY as string | undefined;
const ENVIRONMENT = (import.meta.env.VITE_AUTHORIZENET_ENVIRONMENT as string | undefined) ?? "sandbox";
const SCRIPT_URL = ENVIRONMENT === "production"
  ? "https://js.authorize.net/v1/Accept.js"
  : "https://jstest.authorize.net/v1/Accept.js";

export function isAuthorizeNetConfigured(): boolean {
  return !!API_LOGIN_ID && !!PUBLIC_CLIENT_KEY;
}

declare global {
  interface Window {
    Accept?: {
      dispatchData: (
        data: { authData: { clientKey: string; apiLoginID: string }; cardData: CardData },
        callback: (response: AcceptResponse) => void,
      ) => void;
    };
  }
}

type CardData = { cardNumber: string; month: string; year: string; cardCode: string };
type AcceptResponse = {
  messages: { resultCode: "Ok" | "Error"; message: { code: string; text: string }[] };
  opaqueData?: { dataDescriptor: string; dataValue: string };
};

let scriptPromise: Promise<void> | null = null;

// Accept.js's onload fires before it's actually finished initializing internally (it loads a
// second script and does device-fingerprinting setup after that), so calling dispatchData
// immediately after onload can fail with "Accept.js is not loaded correctly" even though the
// script is present. A short grace period after onload avoids that race.
const ACCEPT_JS_INIT_DELAY_MS = 1200;

function loadAcceptJs(): Promise<void> {
  if (window.Accept) return Promise.resolve();
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = SCRIPT_URL;
    script.onload = () => setTimeout(resolve, ACCEPT_JS_INIT_DELAY_MS);
    script.onerror = () => reject(new Error("Failed to load Authorize.net Accept.js"));
    document.head.appendChild(script);
  });
  return scriptPromise;
}

// Kick off the load as soon as this module is imported (well before the user opens a payment
// dialog and clicks Charge), rather than waiting for the first tokenizeCard() call — the biggest
// factor in avoiding the race above is simply giving Accept.js more head start.
if (typeof window !== "undefined" && API_LOGIN_ID && PUBLIC_CLIENT_KEY) {
  loadAcceptJs().catch(() => {});
}

export type CardInput = { cardNumber: string; expMonth: string; expYear: string; cvv: string };

function dispatchToAccept(card: CardInput): Promise<{ dataDescriptor: string; dataValue: string }> {
  return new Promise((resolve, reject) => {
    window.Accept!.dispatchData(
      {
        authData: { clientKey: PUBLIC_CLIENT_KEY!, apiLoginID: API_LOGIN_ID! },
        cardData: {
          cardNumber: card.cardNumber.replace(/\s/g, ""),
          month: card.expMonth,
          year: card.expYear,
          cardCode: card.cvv,
        },
      },
      (response) => {
        if (response.messages.resultCode === "Ok" && response.opaqueData) {
          resolve(response.opaqueData);
        } else {
          reject(new Error(response.messages.message[0]?.text ?? "Card tokenization failed"));
        }
      },
    );
  });
}

export async function tokenizeCard(card: CardInput): Promise<{ dataDescriptor: string; dataValue: string }> {
  if (!API_LOGIN_ID || !PUBLIC_CLIENT_KEY) throw new Error("Authorize.net is not configured");
  await loadAcceptJs();
  try {
    return await dispatchToAccept(card);
  } catch (err) {
    // Transparently retry once — "not loaded correctly" on the very first attempt is the known
    // Accept.js init race, not a real card/config problem, and a second attempt reliably works.
    if (err instanceof Error && err.message.includes("not loaded correctly")) {
      await new Promise((r) => setTimeout(r, 500));
      return dispatchToAccept(card);
    }
    throw err;
  }
}
