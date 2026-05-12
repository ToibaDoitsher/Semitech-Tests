import type { ExamStudentStatus, MakeupExamStatus } from "@/lib/types/db";

const examLabels: Record<ExamStudentStatus, string> = {
  pending: "ממתין",
  took: "נבחנה במועד",
  missing: "לא נבחנה",
  makeup: "בהשלמה",
  completed: "הושלמה בהשלמה",
};

const makeupLabels: Record<MakeupExamStatus, string> = {
  open: "פתוח",
  completed: "הושלם",
};

type Tone = "ok" | "bad" | "info" | "neutral";

function toneForExamStatus(s: ExamStudentStatus): Tone {
  if (s === "took") return "ok";
  if (s === "completed") return "info";
  if (s === "missing") return "bad";
  if (s === "makeup") return "neutral";
  return "neutral";
}

function toneForMakeup(s: MakeupExamStatus): Tone {
  if (s === "completed") return "ok";
  return "info";
}

const toneClass: Record<Tone, string> = {
  ok: "badge-ok",
  bad: "badge-bad",
  info: "badge-info",
  neutral: "badge-neutral",
};

export function ExamStudentStatusBadge({ status }: { status: ExamStudentStatus }) {
  const tone = toneForExamStatus(status);
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${toneClass[tone]}`}
    >
      {examLabels[status]}
    </span>
  );
}

export function MakeupStatusBadge({ status }: { status: MakeupExamStatus }) {
  const tone = toneForMakeup(status);
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${toneClass[tone]}`}
    >
      {makeupLabels[status]}
    </span>
  );
}

export function BoolBadge({ value, yes, no }: { value: boolean; yes: string; no: string }) {
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${value ? toneClass.ok : toneClass.neutral}`}
    >
      {value ? yes : no}
    </span>
  );
}
