// Client meeting feedback: staff type search words in whatever order they think of them
// ("spa shock oxidizing" vs. the stored "spa oxidizing shock") and expect a match either way.
// Joins every searchable field into one haystack and requires each query word to appear
// somewhere in it, independent of order.
export function matchesQuery(query: string, fields: (string | null | undefined)[]): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const haystack = fields.filter(Boolean).join(" ").toLowerCase();
  return q.split(/\s+/).every((word) => haystack.includes(word));
}
