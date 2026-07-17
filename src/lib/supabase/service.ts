import { createClient } from "@supabase/supabase-js";

import { getServerEnvironment } from "../env";

/** Server-only administrative client for validated guest/demo route writes. */
export function createServiceRoleSupabaseClient() {
  const environment = getServerEnvironment();
  return createClient(
    environment.NEXT_PUBLIC_SUPABASE_URL,
    environment.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}
