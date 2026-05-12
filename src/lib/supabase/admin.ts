import { createClient } from "@supabase/supabase-js";
import { requireServiceRoleEnv, requireSupabasePublicEnv } from "@/lib/env";

export function createSupabaseAdminClient() {
  const { SUPABASE_URL } = requireSupabasePublicEnv();
  const { SUPABASE_SERVICE_ROLE_KEY } = requireServiceRoleEnv();

  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
}

