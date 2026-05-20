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
};

export function HebrewDatePicker({
  value,
  onChange,
  disabled,
  required,
  label = "תאריך (עברי)",
}: Props) {
  const [parts, setParts] = useState<HebrewDateParts>(() => {
    const fromValue = value ? gregorianYmdToHebrewParts(value) : null;
    return clampHebrewParts(fromValue ?? todayHebrewParts());
  });

  const yearOptions = useMemo(() => hebrewYearOptions(parts.year), [parts.year]);
  const monthOptions = useMemo(() => hebrewMonthsForYear(parts.year), [parts.year]);
  const maxDay = useMemo(
    () => maxHebrewDayInMonth(parts.month, parts.year),
    [parts.month, parts.year],
  );
  const dayOptions = useMemo(
    () => HEBREW_DAY_OPTIONS.filter((d) => d.value <= maxDay),
    [maxDay],
  );

  useEffect(() => {
    if (!value) return;
    const parsed = gregorianYmdToHebrewParts(value);
    if (parsed) setParts(clampHebrewParts(parsed));
  }, [value]);

  const preview = useMemo(() => {
    const ymd = hebrewPartsToGregorianYmd(parts);
    if (!ymd) return null;
    const d = new Date(`${ymd}T12:00:00`);
    return formatHebrewDateWithYear(d);
  }, [parts]);

  const apply = useCallback(
    (next: HebrewDateParts) => {
      const clamped = clampHebrewParts(next);
      setParts(clamped);
      const ymd = hebrewPartsToGregorianYmd(clamped);
      if (ymd) onChange(ymd);
    },
    [onChange],
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
            value={parts.day}
            onChange={(e) => apply({ ...parts, day: Number(e.target.value) })}
            required={required}
          >
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
            value={parts.month}
            onChange={(e) => apply({ ...parts, month: Number(e.target.value) })}
            required={required}
          >
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
            value={parts.year}
            onChange={(e) => apply({ ...parts, year: Number(e.target.value) })}
            required={required}
          >
            {yearOptions.map((y) => (
              <option key={y.value} value={y.value}>
                {y.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      {preview ? (
        <p className="mt-2 text-sm text-zinc-700">{preview}</p>
      ) : (
        <p className="mt-2 text-xs text-amber-800">תאריך עברי לא תקין — בחרי יום/חודש/שנה אחרים</p>
      )}
    </fieldset>
  );
}
