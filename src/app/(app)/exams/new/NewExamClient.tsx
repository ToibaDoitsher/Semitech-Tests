"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import useSWR from "swr";
import { useAcademicYear, withYearQuery } from "@/components/academicYears/AcademicYearProvider";
import { Spinner } from "@/components/ui/Spinner";
import { TEACHING_TRACK_NAME } from "@/lib/students/fields";
import type { ExamTargetType, Teacher, TeachingTrackType } from "@/lib/types/db";

const fetcher = (url: string) => fetch(url).then((r) => {
  if (!r.ok) throw new Error("שגיאת טעינה");
  return r.json();
});

type AssignmentRow = {
  id: string;
  subject: string;
  year_group: number;
  grade_level: string;
  year_label?: string;
  target_type: ExamTargetType;
  target_id: string;
  target_label?: string;
  target_type_label?: string;
};

export function NewExamClient() {
  const router = useRouter();
  const { viewingYear, readOnly } = useAcademicYear();

  const { data: tData, isLoading: tLoad } = useSWR<{ teachers: Teacher[] }>("/api/teachers", fetcher);

  const [teacherId, setTeacherId] = useState("");
  const assignUrl = useMemo(() => {
    if (!teacherId) return null;
    const p = new URLSearchParams({ teacher_id: teacherId });
    return withYearQuery(`/api/teacher-assignments?${p.toString()}`, viewingYear?.id);
  }, [teacherId, viewingYear?.id]);

  const { data: aData, isLoading: aLoad } = useSWR<{ assignments: AssignmentRow[] }>(assignUrl, fetcher);

  const activeAssignments = useMemo(() => aData?.assignments ?? [], [aData]);

  const [assignmentId, setAssignmentId] = useState("");
  const [examDate, setExamDate] = useState("");
  const [teachingTrackType, setTeachingTrackType] = useState<TeachingTrackType | "">("");
  const [saving, setSaving] = useState(false);

  const selected = useMemo(
    () => activeAssignments.find((a) => a.id === assignmentId),
    [activeAssignments, assignmentId],
  );

  const isTeachingTarget =
    selected?.target_type === "track" &&
    (selected.target_label === TEACHING_TRACK_NAME || selected.target_label?.includes(TEACHING_TRACK_NAME));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (readOnly) return alert("שנה בארכיון — צפייה בלבד");
    if (!teacherId || !selected || !examDate) {
      alert("מלאי את כל השדות");
      return;
    }
    if (isTeachingTarget && !teachingTrackType) {
      alert("במסלול הוראה — בחרי סוג הוראה (מלא / מקוצר)");
      return;
    }
    setSaving(true);
    try {
      const r = await fetch(withYearQuery("/api/exams", viewingYear?.id), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teacher_id: teacherId,
          subject: selected.subject,
          exam_date: examDate,
          target_type: selected.target_type,
          target_id: selected.target_id,
          year_group: selected.year_group,
          grade_level: selected.grade_level,
          teacher_assignment_id: selected.id,
          teaching_track_type: isTeachingTarget ? teachingTrackType : null,
        }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error((j as { error?: string }).error ?? "שגיאה");
      const examId = (j as { exam?: { id: string } }).exam?.id;
      if (examId) router.push(`/exams/${examId}`);
      else router.push("/exams");
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">יצירת מבחן</h1>
          <p className="mt-1 text-sm text-zinc-600">
            בחירת מורה → שיבוץ → תאריך. שנתון ושכבה נלקחים מהשיבוץ.
            {viewingYear ? ` (${viewingYear.year_name})` : ""}
          </p>
        </div>
        <Link
          href="/exams"
          className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm hover:bg-zinc-50"
        >
          חזרה
        </Link>
      </div>

      <form onSubmit={submit} className="grid max-w-xl gap-4 rounded-xl border border-zinc-200 bg-white p-6">
        {selected ? (
          <p className="rounded-lg bg-violet-50 px-3 py-2 text-sm text-violet-900">
            {selected.year_label ?? `שנתון ${selected.year_group} — שכבה ${selected.grade_level}`}
          </p>
        ) : null}

        <label className="block">
          <span className="text-sm font-medium text-zinc-700">מורה</span>
          <select
            className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-400"
            value={teacherId}
            onChange={(e) => {
              setTeacherId(e.target.value);
              setAssignmentId("");
            }}
            required
            disabled={readOnly}
          >
            <option value="">— בחרי —</option>
            {tData?.teachers?.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          {tLoad ? (
            <div className="mt-1 flex items-center gap-2 text-xs text-zinc-500">
              <Spinner className="size-4" />
              טוען…
            </div>
          ) : null}
        </label>

        <label className="block">
          <span className="text-sm font-medium text-zinc-700">שיבוץ (מקצוע · יעד)</span>
          <select
            className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-400"
            value={assignmentId}
            onChange={(e) => {
              setAssignmentId(e.target.value);
              setTeachingTrackType("");
            }}
            required
            disabled={!teacherId || readOnly}
          >
            <option value="">— בחרי —</option>
            {activeAssignments.map((a) => (
              <option key={a.id} value={a.id}>
                {a.year_label ? `${a.year_label} · ` : ""}
                {a.subject} · {a.target_type_label ?? a.target_type}: {a.target_label ?? a.target_id}
              </option>
            ))}
          </select>
          {teacherId && aLoad ? (
            <div className="mt-1 flex items-center gap-2 text-xs text-zinc-500">
              <Spinner className="size-4" />
              טוען שיבוצים…
            </div>
          ) : teacherId && !aLoad && !activeAssignments.length ? (
            <p className="mt-1 text-xs text-amber-800">אין שיבוצים פעילים למורה בשנה זו</p>
          ) : null}
        </label>

        {isTeachingTarget ? (
          <label className="block">
            <span className="text-sm font-medium text-zinc-700">סוג הוראה *</span>
            <select
              className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm"
              value={teachingTrackType}
              onChange={(e) => setTeachingTrackType(e.target.value as TeachingTrackType | "")}
              required
            >
              <option value="">— בחרי —</option>
              <option value="full">מלא</option>
              <option value="short">מקוצר</option>
            </select>
          </label>
        ) : null}

        <label className="block">
          <span className="text-sm font-medium text-zinc-700">תאריך מבחן</span>
          <input
            type="date"
            className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-400"
            value={examDate}
            onChange={(e) => setExamDate(e.target.value)}
            required
            disabled={readOnly}
          />
        </label>

        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={saving || readOnly}
            className="rounded-lg border border-zinc-900 bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
          >
            {saving ? "יוצר…" : "יצירת מבחן ושיוך תלמידות"}
          </button>
        </div>
      </form>
    </div>
  );
}
