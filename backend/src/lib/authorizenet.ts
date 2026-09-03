// Real card payment collection via Authorize.net (client's confirmed real processor,
// 2026-08-27). Sandbox developer account created 2026-09-03 for testing before the client
// connects their own production merchant account. Card data itself is tokenized client-side by
// Accept.js (src/lib/authorizenet.ts on the frontend) — this server only ever sees the opaque
// payment nonce (dataDescriptor/dataValue), never a raw card number.
const API_LOGIN_ID = process.env.AUTHORIZENET_API_LOGIN_ID!;
const TRANSACTION_KEY = process.env.AUTHORIZENET_TRANSACTION_KEY!;
const ENVIRONMENT = process.env.AUTHORIZENET_ENVIRONMENT ?? "sandbox";
const API_URL = ENVIRONMENT === "production"
  ? "https://api.authorize.net/xml/v1/request.api"
  : "https://apitest.authorize.net/xml/v1/request.api";

export type ChargeResult = { success: true; transactionId: string } | { success: false; error: string };

type AuthorizeNetResponse = {
  transactionResponse?: {
    responseCode?: string;
    transId?: string;
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
    return { success: true, transactionId: txn.transId };
  }
  const errorText = txn?.errors?.[0]?.errorText ?? data.messages?.message?.[0]?.text ?? "Payment declined";
  return { success: false, error: errorText };
}
