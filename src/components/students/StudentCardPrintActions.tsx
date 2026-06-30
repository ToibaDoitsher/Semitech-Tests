"use client";

import { Printer } from "lucide-react";
import { openPrintDocument } from "@/lib/export/printClient";
import {
  STUDENT_CARD_PRINT_CSS,
  buildStudentCardsPrintHtml,
} from "@/lib/export/studentCardPrint";
import type { StudentCardData } from "@/lib/students/loadStudentCardData";

export function printStudentCards(cards: StudentCardData[]) {
  if (!cards.length) {
    alert("אין נתונים להדפסה");
    return;
  }
  const logoUrl = `${window.location.origin}/logo.png`;
  const title =
    cards.length === 1
      ? `כרטיס ${cards[0].student.last_name} ${cards[0].student.first_name}`
      : `כרטיסי תלמידות (${cards.length})`;
  openPrintDocument({
    title,
    styles: STUDENT_CARD_PRINT_CSS,
    bodyHtml: buildStudentCardsPrintHtml(cards, logoUrl),
  });
}

type PrintButtonProps = {
  label?: string;
  className?: string;
  onPrint: () => void;
  disabled?: boolean;
};

export function StudentCardPrintButton({
  label = "הדפסת כרטיס",
  className,
  onPrint,
  disabled,
}: PrintButtonProps) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onPrint}
      className={
        className ??
        "inline-flex items-center gap-1.5 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm hover:bg-zinc-50 disabled:opacity-50"
      }
    >
      <Printer className="size-4 shrink-0 opacity-80" strokeWidth={2} />
      {label}
    </button>
  );
}
