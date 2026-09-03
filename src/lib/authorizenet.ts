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

function loadAcceptJs(): Promise<void> {
  if (window.Accept) return Promise.resolve();
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = SCRIPT_URL;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Authorize.net Accept.js"));
    document.head.appendChild(script);
  });
  return scriptPromise;
}

export type CardInput = { cardNumber: string; expMonth: string; expYear: string; cvv: string };

export async function tokenizeCard(card: CardInput): Promise<{ dataDescriptor: string; dataValue: string }> {
  if (!API_LOGIN_ID || !PUBLIC_CLIENT_KEY) throw new Error("Authorize.net is not configured");
  await loadAcceptJs();
  return new Promise((resolve, reject) => {
    window.Accept!.dispatchData(
      {
        authData: { clientKey: PUBLIC_CLIENT_KEY, apiLoginID: API_LOGIN_ID },
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
