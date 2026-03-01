function pad2(n) {
  return String(n).padStart(2, "0");
}

export function getNowDateKey(tz) {
  // Uses server timezone env if provided. If invalid, falls back to UTC-ish formatting.
  try {
    const d = new Date();
    const fmt = new Intl.DateTimeFormat("en-CA", {
      timeZone: tz || "UTC",
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    });
    return fmt.format(d); // YYYY-MM-DD
  } catch {
    const d = new Date();
    return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
  }
}

export function getIsoWeekKey(date = new Date()) {
  // ISO week key like 2026-W09
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  return `${d.getUTCFullYear()}-W${pad2(weekNo)}`;
}

export function daysBetweenDateKeys(a, b) {
  // a and b are YYYY-MM-DD
  const pa = String(a || "").split("-").map((x) => Number(x));
  const pb = String(b || "").split("-").map((x) => Number(x));
  if (pa.length !== 3 || pb.length !== 3) return null;
  const da = Date.UTC(pa[0], pa[1] - 1, pa[2]);
  const db = Date.UTC(pb[0], pb[1] - 1, pb[2]);
  const diff = Math.round((db - da) / 86400000);
  return diff;
}
