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

export function getPublicEnvironment(
  environment: EnvironmentSource = process.env
): PublicEnvironment {
  return publicEnvironmentSchema.parse(environment);
}

export function getServerEnvironment(
  environment: EnvironmentSource = process.env
): ServerEnvironment {
  return serverEnvironmentSchema.parse(environment);
}

export function hasPublicSupabaseEnvironment(
  environment: EnvironmentSource = process.env
): boolean {
  return publicEnvironmentSchema.safeParse(environment).success;
}

export function hasServerSupabaseEnvironment(
  environment: EnvironmentSource = process.env
): boolean {
  return serverEnvironmentSchema.safeParse(environment).success;
}

/** Call from production entrypoints that require persistence. */
export function assertProductionEnvironment(
  environment: EnvironmentSource = process.env
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
