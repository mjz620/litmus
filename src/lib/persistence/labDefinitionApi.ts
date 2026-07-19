import { createServerSupabaseClient } from "../supabase/server";
import { createServiceRoleSupabaseClient } from "../supabase/service";
import {
  LabAssignmentService,
  SupabaseLabAssignmentRepository
} from "./labAssignmentRepository";
import {
  LabDefinitionPersistenceService,
  SupabaseLabDefinitionRepository
} from "./labDefinitionRepository";

export interface ComposerAuthPrincipal {
  readonly userId: string;
  readonly role: "student" | "teacher";
}

export async function authenticateComposerPrincipal(): Promise<ComposerAuthPrincipal | null> {
  const client = await createServerSupabaseClient();
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) return null;
  const profile = await client
    .from("profiles")
    .select("role")
    .eq("id", data.user.id)
    .maybeSingle();
  if (
    profile.error ||
    (profile.data?.role !== "teacher" && profile.data?.role !== "student")
  ) {
    return null;
  }
  return { userId: data.user.id, role: profile.data.role };
}

export function createLabDefinitionPersistenceService(): LabDefinitionPersistenceService {
  return new LabDefinitionPersistenceService(
    new SupabaseLabDefinitionRepository(createServiceRoleSupabaseClient())
  );
}

export function createLabAssignmentService(): LabAssignmentService {
  const client = createServiceRoleSupabaseClient();
  const definitions = new SupabaseLabDefinitionRepository(client);
  return new LabAssignmentService(
    new SupabaseLabAssignmentRepository(client, definitions)
  );
}
