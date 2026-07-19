import { z } from "zod";

const publicEnvironmentSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(20)
});

const serverEnvironmentSchema = publicEnvironmentSchema.extend({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20)
});

export type PublicEnvironment = z.infer<typeof publicEnvironmentSchema>;
export type ServerEnvironment = z.infer<typeof serverEnvironmentSchema>;
type EnvironmentSource = Readonly<Record<string, string | undefined>>;

/**
 * Next.js only inlines `process.env.NEXT_PUBLIC_*` on direct property access in
 * the browser bundle. Reading `process.env` as an object leaves those keys
 * undefined on the client, which breaks Google OAuth and other public clients.
 */
function defaultPublicEnvironmentSource(): EnvironmentSource {
  return {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  };
}

function defaultServerEnvironmentSource(): EnvironmentSource {
  return {
    ...defaultPublicEnvironmentSource(),
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    NODE_ENV: process.env.NODE_ENV
  };
}

export function getPublicEnvironment(
  environment: EnvironmentSource = defaultPublicEnvironmentSource()
): PublicEnvironment {
  return publicEnvironmentSchema.parse(environment);
}

export function getServerEnvironment(
  environment: EnvironmentSource = defaultServerEnvironmentSource()
): ServerEnvironment {
  return serverEnvironmentSchema.parse(environment);
}

export function hasPublicSupabaseEnvironment(
  environment: EnvironmentSource = defaultPublicEnvironmentSource()
): boolean {
  return publicEnvironmentSchema.safeParse(environment).success;
}

export function hasServerSupabaseEnvironment(
  environment: EnvironmentSource = defaultServerEnvironmentSource()
): boolean {
  return serverEnvironmentSchema.safeParse(environment).success;
}

/** Call from production entrypoints that require persistence. */
export function assertProductionEnvironment(
  environment: EnvironmentSource = defaultServerEnvironmentSource()
): void {
  if (environment.NODE_ENV !== "production") return;

  const parsed = serverEnvironmentSchema.safeParse(environment);
  if (parsed.success) return;

  const invalidVariables = Array.from(
    new Set(
      parsed.error.issues.map((issue) =>
        issue.path.length > 0 ? issue.path.join(".") : "environment"
      )
    )
  );
  throw new Error(
    `Invalid production environment: ${invalidVariables.join(", ")}. Configure the required server values documented in .env.example.`
  );
}
