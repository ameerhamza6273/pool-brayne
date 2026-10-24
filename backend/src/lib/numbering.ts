import type postgres from "postgres";

// Client SMS 2026-10-16: "Po, invoice, est, pos numbers should only be numbers only" -- every document type had grown its
export async function nextDocNumber(tx: postgres.TransactionSql, tenantId: string, prefix: string): Promise<string> {
  const [row] = (await tx`
    insert into tenant_number_sequences (tenant_id, prefix, next_value)
    values (${tenantId}, ${prefix}, 2)
    on conflict (tenant_id, prefix) do update set next_value = tenant_number_sequences.next_value + 1
    returning next_value - 1 as value
  `) as unknown as { value: number }[];
  return `${prefix}-${String(row.value).padStart(4, "0")}`;
}

// Peek-only preview of the next number for a prefix, shown in the UI before creation (e.g.
export async function peekNextDocNumber(tx: postgres.TransactionSql, tenantId: string, prefix: string): Promise<string> {
  const [row] = (await tx`
    select next_value as value from tenant_number_sequences where tenant_id = ${tenantId} and prefix = ${prefix} limit 1
  `) as unknown as { value: number }[];
  return `${prefix}-${String(row?.value ?? 1).padStart(4, "0")}`;
}
