export function normalizeTeacherTz(raw: string | null | undefined): string | null {
  const v = (raw ?? "").trim();
  if (!v) return null;
  if (!/^\d{1,9}$/.test(v)) {
    return null;
  }
  return v;
}

export function validateTeacherTz(raw: string | null | undefined): string | null {
  const v = (raw ?? "").trim();
  if (!v) return null;
  if (!/^\d{1,9}$/.test(v)) {
    return "ת״ז — רק ספרות, עד 9 ספרות";
  }
  return null;
}

export function normalizeTeacherEmail(raw: string | null | undefined): string | null {
  const v = (raw ?? "").trim().toLowerCase();
  return v || null;
}

export function validateTeacherEmail(raw: string | null | undefined): string | null {
  const v = (raw ?? "").trim();
  if (!v) return null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) {
    return "כתובת מייל לא תקינה";
  }
  return null;
}

export function parseTeacherBody(body: Record<string, unknown>): {
  first_name: string;
  last_name: string;
  tz: string | null;
  email: string | null;
  notes: string | null;
  error: string | null;
} {
  const first_name = String(body.first_name ?? "").trim();
  const last_name = String(body.last_name ?? "").trim();
  const notesRaw = String(body.notes ?? "").trim();

  if (!first_name && !last_name) {
    return {
      first_name,
      last_name,
      tz: null,
      email: null,
      notes: null,
      error: "חובה להזין שם פרטי או שם משפחה (לפחות אחד)",
    };
  }

  const tzErr = validateTeacherTz(body.tz as string | undefined);
  if (tzErr) {
    return { first_name, last_name, tz: null, email: null, notes: null, error: tzErr };
  }

  const emailErr = validateTeacherEmail(body.email as string | undefined);
  if (emailErr) {
    return { first_name, last_name, tz: null, email: null, notes: null, error: emailErr };
  }

  return {
    first_name,
    last_name,
    tz: normalizeTeacherTz(body.tz as string | undefined),
    email: normalizeTeacherEmail(body.email as string | undefined),
    notes: notesRaw || null,
    error: null,
  };
}
