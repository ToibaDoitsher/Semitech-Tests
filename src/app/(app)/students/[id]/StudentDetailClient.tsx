"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import { ExamStudentStatusBadge, MakeupStatusBadge } from "@/components/ui/StatusBadge";
import { NotesButton } from "@/components/ui/NotesButton";
import { PrintButton } from "@/components/PrintButton";
import { Spinner } from "@/components/ui/Spinner";
import { formatCohortGradeLabel } from "@/lib/academic/studentGrade";
import { pickLookupName } from "@/lib/lookups/display";
import { teachingTrackTypeLabel } from "@/lib/students/fields";
import type { ExamStudentStatus, MakeupExamStatus, Student } from "@/lib/types/db";

const fetcher = (url: string) => fetch(url).then((r) => {
  if (!r.ok) throw new Error("שגיאת טעינה");
  return r.json();
});

type ExamRow = {
  id: string;
  status: ExamStudentStatus;
  updated_at: string;
  exam_id: string;
  exam: { subject: string; exam_date: string; teacher_name: string | null } | null;
};

type MakeupRow = {
  id: string;
  status: MakeupExamStatus;
  created_at: string;
  completed_at: string | null;
  exam_id: string;
  exam: { subject: string; exam_date: string } | null;
};

export function StudentDetailClient({ id }: { id: string }) {
  const router = useRouter();
  const { data, error, isLoading } = useSWR<{
    student: Student;
    exam_students: ExamRow[];
    makeups: MakeupRow[];
  }>(`/api/students/${id}`, fetcher);

  const { data: historyData } = useSWR<{ history: unknown[]; audit: unknown[] }>(
    `/api/students/${id}/history`,
    fetcher,
  );

  async function handleDelete() {
    if (
      !confirm(
        "מחיקת תלמידה תמחק גם נתונים קשורים (מבחנים, השלמות וכו'). פעולה זו אינה ניתנת לביטול. להמשיך?",
      )
    )
      return;
    const r = await fetch(`/api/students/${id}`, { method: "DELETE" });
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      alert((j as { error?: string }).error ?? "מחיקה נכשלה");
      return;
    }
    router.push("/students");
    router.refresh();
  }

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 py-16 text-zinc-600">
        <Spinner />
        טוען…
      </div>
    );
  }
  if (error || !data?.student) {
    return <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-red-800">לא נמצאה תלמידה</div>;
  }

  const s = data.student;

  return (
    <div className="space-y-6 print:space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between print:block">
        <div>
          <h1 className="text-2xl font-semibold">
            {s.last_name} {s.first_name}
          </h1>
          <p className="mt-1 text-sm text-zinc-600">
            ת״ז <span dir="ltr" className="font-mono">{s.tz}</span>
            {" · "}
            {(s as { year_label?: string }).year_label ??
              `שנתון ${s.year_group} — שכבה ${formatCohortGradeLabel(s.grade_level)}`}
            · כיתה {pickLookupName(s.classes)}
            {pickLookupName(s.tracks) !== "—" ? ` · מסלול ${pickLookupName(s.tracks)}` : ""}
            {pickLookupName(s.specializations) !== "—" ? ` · התמחות ${pickLookupName(s.specializations)}` : ""}
            {pickLookupName(s.secondary_specializations) !== "—"
              ? ` · התמחות נוספת ${pickLookupName(s.secondary_specializations)}`
              : ""}
            {s.is_psychology ? " · פסיכולוגיה" : ""}
            {s.teaching_track_type ? ` · הוראה ${teachingTrackTypeLabel(s.teaching_track_type)}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 print:hidden">
          <NotesButton entity="students" id={id} />
          <PrintButton />
          <Link
            href={`/students/${id}/edit`}
            className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm hover:bg-zinc-50"
          >
            עריכה
          </Link>
          <button
            type="button"
            onClick={() => void handleDelete()}
            className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 hover:bg-red-100"
          >
            מחיקה
          </button>
          <Link href="/students" className="rounded-xl bg-zinc-900 px-3 py-2 text-sm text-white hover:bg-zinc-800">
            חזרה לרשימה
          </Link>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold">מבחנים</h2>
          <ul className="mt-3 divide-y divide-zinc-100">
            {data.exam_students?.length ? (
              data.exam_students.map((row) => (
                <li key={row.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                  <div>
                    <div className="font-medium">{row.exam?.subject ?? "מבחן"}</div>
                    <div className="text-xs text-zinc-500">
                      {row.exam?.exam_date} {row.exam?.teacher_name ? `· ${row.exam.teacher_name}` : ""}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <ExamStudentStatusBadge status={row.status} />
                    {row.exam_id ? (
                      <Link href={`/exams/${row.exam_id}`} className="text-xs text-sky-700 hover:underline">
                        למבחן
                      </Link>
                    ) : null}
                  </div>
                </li>
              ))
            ) : (
              <li className="py-6 text-sm text-zinc-500">אין רישומי מבחנים</li>
            )}
          </ul>
        </section>

        <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold">השלמות</h2>
          <ul className="mt-3 divide-y divide-zinc-100">
            {data.makeups?.length ? (
              data.makeups.map((m) => (
                <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                  <div>
                    <div className="font-medium">{m.exam?.subject ?? "מבחן"}</div>
                    <div className="text-xs text-zinc-500">{m.exam?.exam_date}</div>
                  </div>
                  <MakeupStatusBadge status={m.status} />
                </li>
              ))
            ) : (
              <li className="py-6 text-sm text-zinc-500">אין השלמות</li>
            )}
          </ul>
        </section>
      </div>

      {(historyData?.history?.length ?? 0) > 0 || (historyData?.audit?.length ?? 0) > 0 ? (
        <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm print:hidden">
          <h2 className="text-lg font-semibold">היסטוריה</h2>
          <p className="mt-2 text-sm text-zinc-600">
            {historyData?.history?.length ?? 0} שינויי כיתה/מסלול · {historyData?.audit?.length ?? 0} רשומות ביקורת
          </p>
        </section>
      ) : null}
    </div>
  );
}
