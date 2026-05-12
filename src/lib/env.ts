function stripBom(s: string): string {
  return s.replace(/^\uFEFF/, "");
}

/** טעינה מ־.env — trim + הסרת BOM (העתקה מ־Excel/מסמך) */
function requireEnv(name: string): string {
  const raw = process.env[name];
  if (raw == null || !String(raw).trim()) throw new Error(`Missing required env var: ${name}`);
  return stripBom(String(raw).trim());
}

/** מפתחות sb_secret_* לפעמים מועתקים כ־ssb_secret — תיקון שכיח */
function normalizeServiceRoleKey(v: string): string {
  if (v.startsWith("ssb_secret_")) return `sb_secret_${v.slice("ssb_secret_".length)}`;
  return v;
}

export function requireSupabasePublicEnv() {
  return {
    SUPABASE_URL: requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    SUPABASE_ANON_KEY: requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
  } as const;
}

export function requireServiceRoleEnv() {
  return {
    SUPABASE_SERVICE_ROLE_KEY: normalizeServiceRoleKey(requireEnv("SUPABASE_SERVICE_ROLE_KEY")),
    APP_PASSWORD: requireEnv("APP_PASSWORD"),
  } as const;
}

