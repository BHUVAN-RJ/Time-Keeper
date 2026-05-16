/** Client-only display preferences (default OFF per ADHD score-visibility spec). */
const SHOW_SCORE_KEY = "tk-show-score-on-today";

export function getShowScoreOnToday(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(SHOW_SCORE_KEY) === "1";
}

export function setShowScoreOnToday(on: boolean): void {
  window.localStorage.setItem(SHOW_SCORE_KEY, on ? "1" : "0");
  window.dispatchEvent(new CustomEvent("tk-display-settings"));
}
