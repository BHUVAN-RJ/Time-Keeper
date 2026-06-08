/** Block quality after stop (stored on `time_blocks.quality`). */
export type Quality = "useful" | "meh" | "wasted";

export const QUALITY_OPTIONS: { value: Quality; label: string }[] = [
  { value: "useful", label: "Useful" },
  { value: "meh", label: "Meh" },
  { value: "wasted", label: "Wasted" },
];

export const MEH_HINT =
  "Low-focus time — not deep work, not fully wasted.";

/** Credit multiplier per spec (useful 1×, meh 0.5×, wasted 0×). */
export function qualityCreditMultiplier(q: Quality): number {
  switch (q) {
    case "useful":
      return 1;
    case "meh":
      return 0.5;
    case "wasted":
      return 0;
  }
}

export function normalizeQuality(
  q: string | null | undefined,
): Quality | null {
  if (!q) return null;
  // Legacy: chores was a quality before it became a category.
  if (q === "chores") return "meh";
  if (q === "useful" || q === "meh" || q === "wasted") return q;
  return null;
}

export function isQuality(q: string | null | undefined): q is Quality {
  return normalizeQuality(q) != null;
}

export function qualityLabel(q: string | null | undefined): string {
  if (q === "chores") return "Chores";
  const n = normalizeQuality(q);
  if (!n) return q ?? "";
  return QUALITY_OPTIONS.find((o) => o.value === n)?.label ?? n;
}
