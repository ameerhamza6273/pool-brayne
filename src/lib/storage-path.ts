// Supabase Storage rejects object keys containing characters like # % [ ] { } or non-ASCII (e.g.
export function safeFileName(name: string): string {
  const cleaned = name.normalize("NFKD").replace(/[^\w.-]+/g, "_").replace(/_+/g, "_").replace(/^_|_$/g, "");
  return cleaned || "file";
}
