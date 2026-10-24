// The client's 67 labor SKUs (service-1 ...
export const isLaborCategory = (category: string | null | undefined) =>
  category === "Labor" || category === "Services";

// Labor lines first, materials after (stable within each group). Display-only: doesn't reorder what is stored.
export function laborFirst<T extends { item_type?: string | null }>(items: T[]): T[] {
  return [...items.filter((i) => i.item_type === "labor"), ...items.filter((i) => i.item_type !== "labor")];
}
