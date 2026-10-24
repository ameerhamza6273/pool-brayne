// Real card payment collection via Authorize.net (client's confirmed real processor, 2026-08-27).
const API_LOGIN_ID = process.env.AUTHORIZENET_API_LOGIN_ID!;
const TRANSACTION_KEY = process.env.AUTHORIZENET_TRANSACTION_KEY!;
const ENVIRONMENT = process.env.AUTHORIZENET_ENVIRONMENT ?? "sandbox";
const API_URL = ENVIRONMENT === "production"
  ? "https://api.authorize.net/xml/v1/request.api"
  : "https://apitest.authorize.net/xml/v1/request.api";

// cardBrand/cardLast4: Authorize.net's accountType ("Visa", "MasterCard", ...) and the last 4 of accountNumber ("XXXX1111") -- shown in the Sales Analysis report's
export type ChargeResult = { success: true; transactionId: string; cardBrand: string | null; cardLast4: string | null } | { success: false; error: string };

type AuthorizeNetResponse = {
  transactionResponse?: {
    responseCode?: string;
    transId?: string;
    accountType?: string;
    accountNumber?: string;
    errors?: { errorText: string }[];
  };
  messages?: { resultCode: string; message?: { code: string; text: string }[] };
};

export async function chargeOpaqueData(
  amount: number,
  opaqueData: { dataDescriptor: string; dataValue: string },
): Promise<ChargeResult> {
  const body = {
    createTransactionRequest: {
      merchantAuthentication: { name: API_LOGIN_ID, transactionKey: TRANSACTION_KEY },
      transactionRequest: {
        transactionType: "authCaptureTransaction",
        amount: amount.toFixed(2),
        payment: { opaqueData },
      },
    },
  };

  const res = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  // Authorize.net's JSON responses are sometimes prefixed with a UTF-8 BOM.
  const data = JSON.parse(text.replace(/^﻿/, "")) as AuthorizeNetResponse;

  const txn = data.transactionResponse;
  if (txn?.responseCode === "1" && txn.transId) {
    const last4 = (txn.accountNumber ?? "").replace(/D/g, "").slice(-4);
    return { success: true, transactionId: txn.transId, cardBrand: txn.accountType || null, cardLast4: last4 || null };
  }
  const errorText = txn?.errors?.[0]?.errorText ?? data.messages?.message?.[0]?.text ?? "Payment declined";
  return { success: false, error: errorText };
}
