"use client";

import { useEffect, useMemo, useState } from "react";
import {
  formatHebrewDateTraditional,
  gregorianYmdToHebrewParts,
  HEBREW_DAY_OPTIONS,
  HEBREW_MONTH_OPTIONS,
  hebrewPartsToGregorianYmd,
  hebrewYearOptions,
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
  const initial = useMemo(() => {
    if (value) {
      const parsed = gregorianYmdToHebrewParts(value);
      if (parsed) return parsed;
    }
    return todayHebrewParts();
  }, []);

  const [day, setDay] = useState(initial.day);
  const [month, setMonth] = useState(initial.month);
  const [year, setYear] = useState(initial.year);

  const yearOptions = useMemo(() => hebrewYearOptions(year), [year]);

  useEffect(() => {
    if (!value) return;
    const parsed = gregorianYmdToHebrewParts(value);
    if (parsed) {
      setDay(parsed.day);
      setMonth(parsed.month);
      setYear(parsed.year);
    }
  }, [value]);

  const preview = useMemo(() => {
    const ymd = hebrewPartsToGregorianYmd({ day, month, year });
    if (!ymd) return null;
    const d = new Date(`${ymd}T12:00:00`);
    return formatHebrewDateTraditional(d);
  }, [day, month, year]);

  function emit(parts: HebrewDateParts) {
    const ymd = hebrewPartsToGregorianYmd(parts);
    if (ymd) onChange(ymd);
  }

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
            value={day}
            onChange={(e) => {
              const next = Number(e.target.value);
              setDay(next);
              emit({ day: next, month, year });
            }}
            required={required}
          >
            {HEBREW_DAY_OPTIONS.map((d) => (
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
            value={month}
            onChange={(e) => {
              const next = Number(e.target.value);
              setMonth(next);
              emit({ day, month: next, year });
            }}
            required={required}
          >
            {HEBREW_MONTH_OPTIONS.map((m) => (
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
            value={year}
            onChange={(e) => {
              const next = Number(e.target.value);
              setYear(next);
              emit({ day, month, year: next });
            }}
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
        <p className="mt-2 text-xs text-amber-800">תאריך עברי לא תקין</p>
      )}
    </fieldset>
  );
}
