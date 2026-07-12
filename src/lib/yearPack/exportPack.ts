import type { SupabaseClient } from "@supabase/supabase-js";
import JSZip from "jszip";
import { rowToMultiTarget } from "@/lib/assignments/multiTarget";
import { ASSIGNMENT_WITH_LOOKUPS } from "@/lib/db/assignmentSelect";
import { notDeleted } from "@/lib/db/softDelete";
import { asStudentRows, type StudentWithLookupsRow } from "@/lib/db/studentRow";
import { getStudentWithLookupsSelect } from "@/lib/db/studentSelect";
import { LOOKUP_EXCEL_HEADER } from "@/lib/lookups/excelTemplate";
import { pickLookupName } from "@/lib/lookups/display";
import { ASSIGNMENT_EXCEL_HEADERS } from "@/lib/assignments/excelTemplate";
import { STUDENT_EXCEL_HEADERS } from "@/lib/students/excelTemplate";
import { teachingTrackTypeLabel } from "@/lib/students/fields";
import { TEACHER_EXCEL_HEADERS } from "@/lib/teachers/excelTemplate";
import { teachingModeSelectionLabel } from "@/lib/teachers/display";
import { YEAR_PACK_PARTS, yearPackZipName } from "@/lib/yearPack/manifest";
import { aoaToXlsxBuffer, paginateSelect } from "@/lib/yearPack/excelIo";

function lookupNameForExport(v: unknown): string {
  const n = pickLookupName(v);
  return n === "—" ? "" : n;
}

function unwrapOne<T>(v: T | T[] | null | undefined): T | null {
  if (v == null) return null;
  if (Array.isArray(v)) return (v[0] as T | undefined) ?? null;
  return v;
}

function namesByIdMap(rows: { id: string; name: string }[] | null | undefined): Map<string, string> {
  const m = new Map<string, string>();
  for (const r of rows ?? []) m.set(r.id, r.name);
  return m;
}

function joinNames(ids: string[], byId: Map<string, string>): string {
  return ids
    .map((id) => byId.get(id) ?? "")
    .filter(Boolean)
    .join(", ");
}

async function exportLookupNames(
  supabase: SupabaseClient,
  table: "classes" | "specializations" | "tracks",
  yearId: string,
): Promise<(string | number | boolean | null)[][]> {
  const rows = await paginateSelect<{ name: string }>((from, to) =>
    notDeleted(supabase.from(table).select("name"))
      .eq("academic_year_id", yearId)
      .eq("is_active", true)
      .order("name")
      .range(from, to),
  );
  return [[LOOKUP_EXCEL_HEADER], ...rows.map((r) => [r.name])];
}

async function exportTeachers(
  supabase: SupabaseClient,
  yearId: string,
): Promise<(string | number | boolean | null)[][]> {
  const rows = await paginateSelect<{
    first_name: string;
    last_name: string;
    tz: string | null;
    email: string | null;
    notes: string | null;
  }>((from, to) =>
    notDeleted(supabase.from("teachers").select("first_name, last_name, tz, email, notes"))
      .eq("academic_year_id", yearId)
      .order("last_name")
      .order("first_name")
      .range(from, to),
  );
  return [
    [...TEACHER_EXCEL_HEADERS],
    ...rows.map((t) => [t.first_name ?? "", t.last_name ?? "", t.tz ?? "", t.email ?? "", t.notes ?? ""]),
  ];
}

async function exportStudents(
  supabase: SupabaseClient,
  yearId: string,
): Promise<(string | number | boolean | null)[][]> {
  const studentSelect = await getStudentWithLookupsSelect();
  const data = await paginateSelect<StudentWithLookupsRow>(async (from, to) => {
    const res = await supabase
      .from("students")
      .select(studentSelect)
      .eq("academic_year_id", yearId)
      .order("last_name")
      .order("first_name")
      .range(from, to);
    return { data: asStudentRows(res.data), error: res.error };
  });
  const students = asStudentRows(data);
  return [
    [...STUDENT_EXCEL_HEADERS],
    ...students.map((s) => [
      s.first_name ?? "",
      s.last_name ?? "",
      s.tz ?? "",
      lookupNameForExport(s.classes),
      lookupNameForExport(s.specializations),
      lookupNameForExport(s.tracks),
      lookupNameForExport(s.secondary_specializations),
      s.is_psychology ? "כן" : "לא",
      teachingTrackTypeLabel(s.teaching_track_type) === "—"
        ? ""
        : teachingTrackTypeLabel(s.teaching_track_type),
      s.grade_level ?? "",
    ]),
  ];
}

async function exportAssignments(
  supabase: SupabaseClient,
  yearId: string,
): Promise<(string | number | boolean | null)[][]> {
  const raw = await paginateSelect((from, to) =>
    notDeleted(supabase.from("teacher_assignments").select(ASSIGNMENT_WITH_LOOKUPS))
      .eq("academic_year_id", yearId)
      .order("subject")
      .range(from, to),
  );

  const classIds = new Set<string>();
  const specIds = new Set<string>();
  const trackIds = new Set<string>();
  for (const a of raw) {
    const mt = rowToMultiTarget(a as Parameters<typeof rowToMultiTarget>[0]);
    mt.class_ids.forEach((id) => classIds.add(id));
    mt.specialization_ids.forEach((id) => specIds.add(id));
    mt.track_ids.forEach((id) => trackIds.add(id));
  }

  const [classesRes, specsRes, tracksRes] = await Promise.all([
    classIds.size
      ? supabase.from("classes").select("id,name").in("id", [...classIds])
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
    specIds.size
      ? supabase.from("specializations").select("id,name").in("id", [...specIds])
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
    trackIds.size
      ? supabase.from("tracks").select("id,name").in("id", [...trackIds])
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
  ]);

  const classById = namesByIdMap(classesRes.data as { id: string; name: string }[]);
  const specById = namesByIdMap(specsRes.data as { id: string; name: string }[]);
  const trackById = namesByIdMap(tracksRes.data as { id: string; name: string }[]);

  const rows: (string | number | boolean | null)[][] = [[...ASSIGNMENT_EXCEL_HEADERS]];
  for (const a of raw) {
    const row = a as {
      subject?: string | null;
      lesson_name?: string | null;
      teaching_mode?: string | null;
      assignment_category?: string | null;
      teachers?:
        | { first_name?: string; last_name?: string }
        | { first_name?: string; last_name?: string }[]
        | null;
    };
    const mt = rowToMultiTarget(a as Parameters<typeof rowToMultiTarget>[0]);
    const teacher = unwrapOne(row.teachers);
    const classCell = mt.applies_to_all_in_grade ? "כל השכבה" : joinNames(mt.class_ids, classById);
    rows.push([
      teacher?.first_name ?? "",
      teacher?.last_name ?? "",
      row.subject ?? "",
      row.lesson_name ?? "",
      mt.grade_levels.join(", "),
      row.assignment_category ?? "",
      classCell,
      joinNames(mt.specialization_ids, specById),
      joinNames(mt.track_ids, trackById),
      mt.psychology_enabled ? "כן" : "לא",
      teachingModeSelectionLabel(row.teaching_mode) === "—"
        ? ""
        : teachingModeSelectionLabel(row.teaching_mode),
    ]);
  }
  return rows;
}

export async function buildYearPackZip(
  supabase: SupabaseClient,
  yearId: string,
  yearName: string,
): Promise<{ buffer: Buffer; filename: string }> {
  const zip = new JSZip();

  const builders: Record<string, () => Promise<(string | number | boolean | null)[][]>> = {
    classes: () => exportLookupNames(supabase, "classes", yearId),
    specializations: () => exportLookupNames(supabase, "specializations", yearId),
    tracks: () => exportLookupNames(supabase, "tracks", yearId),
    teachers: () => exportTeachers(supabase, yearId),
    students: () => exportStudents(supabase, yearId),
    assignments: () => exportAssignments(supabase, yearId),
  };

  for (const part of YEAR_PACK_PARTS) {
    const aoa = await builders[part.key]!();
    zip.file(part.filename, aoaToXlsxBuffer(part.sheetName, aoa));
  }

  const buffer = Buffer.from(await zip.generateAsync({ type: "uint8array" }));
  return { buffer, filename: yearPackZipName(yearName) };
}
