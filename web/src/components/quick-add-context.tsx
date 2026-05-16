"use client";

import { createContext, useContext } from "react";

type QuickAddContextValue = {
  openQuickAdd: () => void;
};

export const QuickAddContext = createContext<QuickAddContextValue | null>(null);

export function useQuickAdd() {
  const ctx = useContext(QuickAddContext);
  if (!ctx) {
    throw new Error("useQuickAdd must be used within QuickAddProvider");
  }
  return ctx;
}
