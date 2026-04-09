/* ============================================================
   Korean number / won / count formatters
   ============================================================ */

/** Format a number as Korean won (e.g. 1,234만원, 3.2억원) */
export function formatWon(value: number | undefined | null): string {
  if (value == null) return "-";
  const abs = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  if (abs >= 1_0000_0000) {
    return `${sign}${(abs / 1_0000_0000).toFixed(1)}억원`;
  }
  if (abs >= 1_0000) {
    return `${sign}${(abs / 1_0000).toFixed(0)}만원`;
  }
  return `${sign}${abs.toLocaleString("ko-KR")}원`;
}

/** Format a count (e.g. 1.2만명, 345명) */
export function formatCount(value: number | undefined | null): string {
  if (value == null) return "-";
  const abs = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  if (abs >= 1_0000) {
    return `${sign}${(abs / 1_0000).toFixed(1)}만`;
  }
  return `${sign}${abs.toLocaleString("ko-KR")}`;
}

/** Format percentage */
export function formatPercent(value: number | undefined | null): string {
  if (value == null) return "-";
  return `${value.toFixed(1)}%`;
}

/** Compact number for chart axes */
export function compactNumber(value: number): string {
  if (value >= 1_0000_0000) return `${(value / 1_0000_0000).toFixed(1)}억`;
  if (value >= 1_0000) return `${(value / 1_0000).toFixed(0)}만`;
  return value.toLocaleString("ko-KR");
}
