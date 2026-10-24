import postgres from "postgres";

// Match Supabase/PostgREST's JSON shape so frontend code (written against PostgREST responses) doesn't need to change: `date` columns as plain "YYYY-MM-DD"
const sql = postgres(process.env.DATABASE_URL!, {
  // Default 10 (unchanged for production).
  max: Number(process.env.DB_POOL_MAX) || 10,
  prepare: false,
  types: {
    date: {
      to: 1082,
      from: [1082],
      serialize: (x: string) => x,
      parse: (x: string) => x,
    },
    numeric: {
      to: 1700,
      from: [1700],
      serialize: (x: number) => String(x),
      parse: (x: string) => Number(x),
    },
  },
});

/** Runs `fn` inside a transaction where Postgres RLS sees the same session context that Supabase's own PostgREST sets for a */
export async function withTenantContext<T>(userId: string, fn: (tx: postgres.TransactionSql) => Promise<T>): Promise<T> {
  const result = await sql.begin(async (tx) => {
    await tx`select set_config('request.jwt.claims', ${JSON.stringify({ sub: userId, role: "authenticated" })}, true)`;
    await tx`set local role authenticated`;
    return fn(tx);
  });
  return result as T;
}

export default sql;
