"use client";

import { useState } from "react";
import { HebrewDatePicker } from "@/components/ui/HebrewDatePicker";

type Props = {
  value: string | null;
  onChange: (iso: string | null) => void;
  disabled?: boolean;
  label?: string;
  /** כשמופעל — אין כפתור «נקה תאריך» (לשדות חובה) */
  required?: boolean;
};

function isoToParts(iso: string | null): { ymd: string; time: string } {
  if (!iso?.trim()) return { ymd: "", time: "12:00" };
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return { ymd: "", time: "12:00" };
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    ymd: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
  };
}

function partsToIso(ymd: string, time: string): string | null {
  if (!ymd.trim()) return null;
  const t = /^(\d{2}):(\d{2})$/.exec(time.trim()) ?? ["", "12", "00"];
  const d = new Date(`${ymd.trim()}T${t[1]}:${t[2]}:00`);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

export function HebrewDateTimePicker({
  value,
  onChange,
  disabled,
  label = "תאריך ושעה (עברי)",
  required = false,
}: Props) {
  const [ymd, setYmd] = useState(() => isoToParts(value).ymd);
  const [time, setTime] = useState(() => isoToParts(value).time);

  function emit(nextYmd: string, nextTime: string) {
    setYmd(nextYmd);
    setTime(nextTime);
    onChange(partsToIso(nextYmd, nextTime));
  }

  return (
    <div className="space-y-2">
      <HebrewDatePicker
        label={label}
        value={ymd}
        disabled={disabled}
        required={required}
        allowEmpty={required && !ymd}
        emptyHint="בחרי תאריך הגשה"
        onChange={(nextYmd) => emit(nextYmd, time)}
      />
      <label className="block text-xs text-zinc-600">
        שעה
        <input
          type="time"
          value={time}
          disabled={disabled || !ymd}
          onChange={(e) => emit(ymd, e.target.value || "12:00")}
          className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-2 py-2 text-sm"
          dir="ltr"
        />
      </label>
      {ymd && !required ? (
        <button
          type="button"
          disabled={disabled}
          className="text-[11px] text-zinc-500 underline-offset-2 hover:underline"
          onClick={() => {
            setYmd("");
            setTime("12:00");
            onChange(null);
          }}
        >
          נקה תאריך
        </button>
      ) : null}
    </div>
  );
}
