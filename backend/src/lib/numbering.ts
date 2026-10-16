import type postgres from "postgres";

// Client SMS 2026-10-16: "Po, invoice, est, pos numbers should only be numbers only" -- every
// document type had grown its own ad-hoc client-side/date-based numbering scheme, the same bug
// class already found and fixed once for PO numbers alone (duplicate "PO-20260914-001", migration
// 20260930110000). A single per-tenant atomic counter (one row per tenant+prefix in
// `tenant_number_sequences`) replaces all of them: the upsert's increment happens inside Postgres'
// own row lock, so two concurrent requests for the same prefix can never get the same number.
export async function nextDocNumber(tx: postgres.TransactionSql, tenantId: string, prefix: string): Promise<string> {
  const [row] = (await tx`
    insert into tenant_number_sequences (tenant_id, prefix, next_value)
    values (${tenantId}, ${prefix}, 2)
    on conflict (tenant_id, prefix) do update set next_value = tenant_number_sequences.next_value + 1
    returning next_value - 1 as value
  `) as unknown as { value: number }[];
  return `${prefix}-${String(row.value).padStart(4, "0")}`;
}

// Peek-only preview of the next number for a prefix, shown in the UI before creation (e.g. PO's
// editable number field) -- does NOT reserve/consume it, so it's safe to call outside the create
// transaction. If two people open the dialog at once they may briefly see the same suggestion, but
// `nextDocNumber`'s real atomic increment at actual creation time still makes the two final numbers
// different (or, if someone typed the exact same custom number, the unique constraint + caller's
// retry-with-generated-number fallback handles it).
export async function peekNextDocNumber(tx: postgres.TransactionSql, tenantId: string, prefix: string): Promise<string> {
  const [row] = (await tx`
    select next_value as value from tenant_number_sequences where tenant_id = ${tenantId} and prefix = ${prefix} limit 1
  `) as unknown as { value: number }[];
  return `${prefix}-${String(row?.value ?? 1).padStart(4, "0")}`;
}
