/** שמות קבצים משותפים לייצוא ולייבוא (פעולות הפוכות). */
export const YEAR_PACK_PARTS = [
  { key: "classes", filename: "כיתות.xlsx", sheetName: "כיתות", label: "כיתות" },
  { key: "specializations", filename: "התמחויות.xlsx", sheetName: "התמחויות", label: "התמחויות" },
  { key: "tracks", filename: "מסלולים.xlsx", sheetName: "מסלולים", label: "מסלולים" },
  { key: "teachers", filename: "מורות.xlsx", sheetName: "מורות", label: "מורות" },
  { key: "students", filename: "תלמידות.xlsx", sheetName: "תלמידות", label: "תלמידות" },
  { key: "assignments", filename: "שיבוצים.xlsx", sheetName: "שיבוצים", label: "שיבוצים" },
] as const;

export type YearPackPartKey = (typeof YEAR_PACK_PARTS)[number]["key"];

const ALIASES: Record<YearPackPartKey, readonly string[]> = {
  classes: ["כיתות.xlsx", "classes.xlsx"],
  specializations: ["התמחויות.xlsx", "specializations.xlsx"],
  tracks: ["מסלולים.xlsx", "tracks.xlsx"],
  teachers: ["מורות.xlsx", "teachers.xlsx"],
  students: ["תלמידות.xlsx", "students.xlsx"],
  assignments: ["שיבוצים.xlsx", "שיבוצי-מורות.xlsx", "assignments.xlsx"],
};

export function basenameOfPath(path: string): string {
  const parts = path.replace(/\\/g, "/").split("/");
  return (parts[parts.length - 1] ?? path).trim();
}

export function matchYearPackPart(filename: string): YearPackPartKey | null {
  const base = basenameOfPath(filename).toLowerCase();
  for (const part of YEAR_PACK_PARTS) {
    if (ALIASES[part.key].some((a) => a.toLowerCase() === base)) return part.key;
  }
  return null;
}

export function yearPackZipName(yearName: string): string {
  const safe = yearName.replace(/[^\w\u0590-\u05FF\-]+/g, "_").slice(0, 40) || "year";
  return `year-pack-${safe}.zip`;
}
