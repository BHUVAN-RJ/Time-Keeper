/** Optional "focus session" length — prefer server `focusTargetMinutes` on the block; localStorage is optimistic fallback only. */
export const FOCUS_SESSION_STORAGE_KEY = "tk-focus-session-v1";

export type FocusSessionPayload = {
  blockId: string;
  targetMinutes: number;
};

export function readFocusSession(): FocusSessionPayload | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(FOCUS_SESSION_STORAGE_KEY);
    if (!raw) return null;
    const j = JSON.parse(raw) as FocusSessionPayload;
    if (
      typeof j.blockId === "string" &&
      typeof j.targetMinutes === "number" &&
      j.targetMinutes > 0
    ) {
      return j;
    }
    return null;
  } catch {
    return null;
  }
}

export function writeFocusSession(payload: FocusSessionPayload) {
  if (typeof window === "undefined") return;
  localStorage.setItem(FOCUS_SESSION_STORAGE_KEY, JSON.stringify(payload));
}

export function clearFocusSession() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(FOCUS_SESSION_STORAGE_KEY);
}
