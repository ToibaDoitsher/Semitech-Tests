export type TeacherNameFields = {
  first_name?: string | null;
  last_name?: string | null;
  full_name_generated?: string | null;
};

export function teacherDisplayName(t: TeacherNameFields | null | undefined): string {
  if (!t) return "—";
  const generated = (t.full_name_generated ?? "").trim();
  if (generated) return generated;
  const parts = [(t.first_name ?? "").trim(), (t.last_name ?? "").trim()].filter(Boolean);
  return parts.length ? parts.join(" ") : "—";
}

export function pickTeacherFromEmbed(
  embed: TeacherNameFields | TeacherNameFields[] | null | undefined,
): TeacherNameFields | null {
  if (!embed) return null;
  if (Array.isArray(embed)) return embed[0] ?? null;
  return embed;
}

export function teacherEmbedDisplayName(
  embed: TeacherNameFields | TeacherNameFields[] | null | undefined,
): string {
  return teacherDisplayName(pickTeacherFromEmbed(embed));
}

export function teachingModeLabel(mode: string | null | undefined): string {
  return teachingModeSelectionLabel(mode);
}

export function teachingModeSelectionLabel(mode: string | null | undefined): string {
  if (mode === "full") return "מלא";
  if (mode === "short") return "מקוצר";
  if (mode === "both") return "מלא + מקוצר";
  return "—";
}
