"use client";

import Image from "next/image";
import type { EventInput } from "@fullcalendar/core";
import type { CalendarExamProps } from "@/lib/calendar/types";
import {
  buildFilterSummary,
  groupExamsByDate,
  type ActiveFilters,
} from "@/lib/calendar/schedulePrint";

type Props = {
  events: EventInput[];
  filters: ActiveFilters;
  academicYearName?: string;
  rangeLabel?: string;
};

export function ExamSchedulePrintSheet({ events, filters, academicYearName, rangeLabel }: Props) {
  const days = groupExamsByDate(events);
  const filterSummary = buildFilterSummary(filters);
  const totalExams = days.reduce((n, d) => n + d.exams.length, 0);

  return (
    <article className="exam-schedule-print mx-auto max-w-4xl bg-white text-zinc-900">
      <header className="exam-schedule-print-header border-b border-slate-200 pb-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-sky-800">לוח מבחנים</p>
            <h1 className="mt-1 text-2xl font-bold text-slate-900">מערכת מבחנים</h1>
            {academicYearName ? (
              <p className="mt-1 text-sm text-slate-600">שנת לימודים {academicYearName}</p>
            ) : null}
            {rangeLabel ? <p className="mt-0.5 text-sm text-slate-500">{rangeLabel}</p> : null}
          </div>
          <span className="relative hidden h-16 w-16 shrink-0 sm:block">
            <Image src="/logo.png" alt="" fill className="object-contain opacity-90" sizes="64px" />
          </span>
        </div>
        <p className="mt-4 rounded-xl bg-sky-50/80 px-3 py-2 text-sm text-slate-700">{filterSummary}</p>
        <p className="mt-2 text-xs text-slate-500">
          {totalExams} מבחנים · {days.length} ימים
        </p>
      </header>

      {days.length === 0 ? (
        <p className="py-12 text-center text-slate-500">אין מבחנים להצגה לפי המסננים והתקופה הנוכחית</p>
      ) : (
        <div className="mt-6 space-y-8">
          {days.map((day) => (
            <section key={day.date} className="exam-schedule-day break-inside-avoid">
              <div className="mb-3 border-s-4 border-sky-600 ps-3">
                <h2 className="text-lg font-bold text-slate-900">{day.gregorianLabel}</h2>
                {day.hebrewLabel ? (
                  <p className="text-sm text-slate-600">{day.hebrewLabel}</p>
                ) : null}
              </div>
              <ul className="grid gap-3 sm:grid-cols-2">
                {day.exams.map((exam) => (
                  <li key={exam.examId}>
                    <ExamCard exam={exam} />
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      <footer className="exam-schedule-print-footer mt-10 border-t border-slate-200 pt-4 text-center text-xs text-slate-500">
        הודפס ממערכת מבחנים · {new Date().toLocaleDateString("he-IL")}
      </footer>
    </article>
  );
}

function ExamCard({ exam }: { exam: CalendarExamProps }) {
  return (
    <div className="exam-schedule-card h-full rounded-2xl border border-slate-200/90 bg-gradient-to-bl from-white via-white to-sky-50/40 p-4 shadow-sm">
      <p className="text-lg font-bold leading-snug text-[var(--color-primary)]">{exam.subject}</p>
      <p className="mt-2 text-sm font-medium text-slate-800">{exam.teacherName || "—"}</p>
      <dl className="mt-3 space-y-1.5 text-sm">
        <Row label="יעד" value={`${exam.targetTypeLabel} · ${exam.targetLabel}`} />
        {exam.gradeLevelName ? <Row label="שכבה" value={exam.gradeLevelName} /> : null}
      </dl>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2">
      <dt className="shrink-0 font-semibold text-slate-500">{label}</dt>
      <dd className="min-w-0 font-medium text-slate-800">{value}</dd>
    </div>
  );
}
