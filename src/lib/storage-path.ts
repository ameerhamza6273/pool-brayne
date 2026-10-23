// Supabase Storage rejects object keys containing characters like # % [ ] { } or non-ASCII
// (e.g. "Logo – final #2.png"), and every upload here builds its key from the picked file's name.
// Keep letters, digits, dot, dash and underscore; everything else becomes "_".
export function safeFileName(name: string): string {
  const cleaned = name.normalize("NFKD").replace(/[^\w.-]+/g, "_").replace(/_+/g, "_").replace(/^_|_$/g, "");
  return cleaned || "file";
}
