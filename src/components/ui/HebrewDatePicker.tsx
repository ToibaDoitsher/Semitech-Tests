"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  clampHebrewParts,
  formatHebrewDateTraditional,
  formatHebrewDateWithYear,
  gregorianYmdToHebrewParts,
  HEBREW_DAY_OPTIONS,
  hebrewMonthsForYear,
  hebrewPartsToGregorianYmd,
  hebrewYearOptions,
  maxHebrewDayInMonth,
  todayHebrewParts,
  type HebrewDateParts,
} from "@/lib/hebrewDate";

type Props = {
  value: string;
  onChange: (gregorianYmd: string) => void;
  disabled?: boolean;
  required?: boolean;
  label?: string;
  /** כשמופעל — אין תאריך ברירת מחדל; המשתמשת בוחרת ידנית (מתאים לסינון) */
  allowEmpty?: boolean;
  emptyHint?: string;
};

const PLACEHOLDER = "—";

export function HebrewDatePicker({
  value,
  onChange,
  disabled,
  required,
  label = "תאריך (עברי)",
  allowEmpty = false,
  emptyHint = "לא נבחר תאריך — בחרי יום, חודש ושנה",
}: Props) {
  const [parts, setParts] = useState<HebrewDateParts | null>(() => {
    if (value) {
      const fromValue = gregorianYmdToHebrewParts(value);
      if (fromValue) return clampHebrewParts(fromValue);
    }
    return allowEmpty ? null : clampHebrewParts(todayHebrewParts());
  });

  const optionParts = parts ?? todayHebrewParts();
  const yearOptions = useMemo(() => hebrewYearOptions(optionParts.year), [optionParts.year]);
  const monthOptions = useMemo(() => hebrewMonthsForYear(optionParts.year), [optionParts.year]);
  const maxDay = useMemo(
    () => maxHebrewDayInMonth(optionParts.month, optionParts.year),
    [optionParts.month, optionParts.year],
  );
  const dayOptions = useMemo(
    () => HEBREW_DAY_OPTIONS.filter((d) => d.value <= maxDay),
    [maxDay],
  );

  useEffect(() => {
    if (!value) {
      if (allowEmpty) setParts(null);
      else setParts(clampHebrewParts(todayHebrewParts()));
      return;
    }
    const parsed = gregorianYmdToHebrewParts(value);
    if (parsed) setParts(clampHebrewParts(parsed));
  }, [value, allowEmpty]);

  const preview = useMemo(() => {
    if (!parts) return null;
    const ymd = hebrewPartsToGregorianYmd(parts);
    if (!ymd) return null;
    const d = new Date(`${ymd}T12:00:00`);
    return formatHebrewDateWithYear(d);
  }, [parts]);

  const onFieldChange = useCallback(
    (field: keyof HebrewDateParts, raw: string) => {
      if (allowEmpty && raw === "") {
        setParts(null);
        onChange("");
        return;
      }
      const num = Number(raw);
      const base = parts ?? todayHebrewParts();
      const next = clampHebrewParts({ ...base, [field]: num });
      setParts(next);
      const ymd = hebrewPartsToGregorianYmd(next);
      if (ymd) onChange(ymd);
    },
    [allowEmpty, onChange, parts],
  );

  return (
    <fieldset className="block" disabled={disabled}>
      <legend className="text-sm font-medium text-zinc-700">
        {label}
        {required ? " *" : ""}
      </legend>
      <div className="mt-2 grid grid-cols-3 gap-2">
        <label className="block text-xs text-zinc-600">
          יום
          <select
            className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-2 py-2 text-sm"
            value={parts?.day ?? ""}
            onChange={(e) => onFieldChange("day", e.target.value)}
            required={required && !allowEmpty}
          >
            {allowEmpty ? (
              <option value="">{PLACEHOLDER}</option>
            ) : null}
            {dayOptions.map((d) => (
              <option key={d.value} value={d.value}>
                {d.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-xs text-zinc-600">
          חודש
          <select
            className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-2 py-2 text-sm"
            value={parts?.month ?? ""}
            onChange={(e) => onFieldChange("month", e.target.value)}
            required={required && !allowEmpty}
          >
            {allowEmpty ? (
              <option value="">{PLACEHOLDER}</option>
            ) : null}
            {monthOptions.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-xs text-zinc-600">
          שנה
          <select
            className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-2 py-2 text-sm"
            value={parts?.year ?? ""}
            onChange={(e) => onFieldChange("year", e.target.value)}
            required={required && !allowEmpty}
          >
            {allowEmpty ? (
              <option value="">{PLACEHOLDER}</option>
            ) : null}
            {yearOptions.map((y) => (
              <option key={y.value} value={y.value}>
                {y.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      {!parts && allowEmpty ? (
        <p className="mt-2 text-xs text-zinc-500">{emptyHint}</p>
      ) : preview ? (
        <p className="mt-2 text-sm text-zinc-700">{preview}</p>
      ) : (
        <p className="mt-2 text-xs text-amber-800">תאריך עברי לא תקין — בחרי יום/חודש/שנה אחרים</p>
      )}
    </fieldset>
  );
}
