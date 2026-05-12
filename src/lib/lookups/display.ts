/** PostgREST לפעמים מחזיר יחס יחיד כאובייקט או מערך — אחידות לתצוגה */
export function pickLookupName(v: unknown): string {
  if (v == null) return "—";
  if (Array.isArray(v)) {
    const first = v[0] as { name?: string } | undefined;
    return first?.name ?? "—";
  }
  if (typeof v === "object" && v !== null && "name" in v) {
    return String((v as { name: string }).name);
  }
  return "—";
}
