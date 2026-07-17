import { hasServerSupabaseEnvironment } from "../env";
import { createServiceRoleSupabaseClient } from "../supabase/service";

const SEEDED_SESSION_IDS = [
  "00000000-0000-4000-8000-000000000301",
  "00000000-0000-4000-8000-000000000302",
  "00000000-0000-4000-8000-000000000303"
];

export interface DemoResetter {
  reset(): Promise<{ clearedSessions: number }>;
}

export class NoopDemoResetter implements DemoResetter {
  async reset() {
    return { clearedSessions: 0 };
  }
}

export class SupabaseDemoResetter implements DemoResetter {
  async reset() {
    const client = createServiceRoleSupabaseClient();
    const { data, error } = await client
      .from("sessions")
      .delete()
      .eq("is_demo", true)
      .not("id", "in", `(${SEEDED_SESSION_IDS.join(",")})`)
      .select("id");
    if (error) throw new Error(error.message);
    return { clearedSessions: data?.length ?? 0 };
  }
}

export function getDemoResetter(): DemoResetter {
  return hasServerSupabaseEnvironment()
    ? new SupabaseDemoResetter()
    : new NoopDemoResetter();
}
