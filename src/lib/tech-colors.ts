import type { CSSProperties } from "react";

// Color identification by technician (not job type) across the Jobs & Dispatch views, per
// client request 2026-08-27 — each tech gets a stable color from this palette based on their id.
// (Moved out of Jobs.tsx 2026-09-21 so the Schedule calendar can share it.)
// Client SMS 2026-09-21: colors are editable -- a color saved on the profile (`profiles.color`) wins over
// the automatic one; the Jobs page registers the loaded profiles here so every helper below picks it up.
export const techColorPalette = ["#0891B2", "#F59E0B", "#8B5CF6", "#3B82F6", "#16A34A", "#DC2626", "#EC4899", "#F97316"];
export const unassignedColor = "#64748B";

let overrides: Record<string, string> = {};

export const registerTechColors = (profiles: { id: string; color?: string | null }[]) => {
  overrides = {};
  for (const p of profiles) if (p.color) overrides[p.id] = p.color;
};

export const autoTechColor = (techId: string): string => {
  let hash = 0;
  for (let i = 0; i < techId.length; i++) hash = (hash * 31 + techId.charCodeAt(i)) >>> 0;
  return techColorPalette[hash % techColorPalette.length];
};

export const techDotColor = (techId: string): string => overrides[techId] ?? autoTechColor(techId);

export const techStyle = (techId: string | null): CSSProperties => {
  const color = techId ? techDotColor(techId) : unassignedColor;
  return { backgroundColor: `${color}1A`, color };
};
