export type SafetyRegistryId =
  | "safety.no_open_flame_mvp.v1"
  | "safety.virtual_titration_ppe_notice.v1"
  | "safety.virtual_solution_preparation_ppe_notice.v1";

export interface SafetyRegistryEntry {
  readonly id: SafetyRegistryId;
  readonly version: "1.0.0";
  readonly severity: "prohibited" | "required";
  readonly availability: "restricted" | "verified";
  readonly prohibited: boolean;
  readonly compatibleFamilyIds: readonly string[];
  readonly studentFacingText: string;
  readonly teacherFacingText: string;
}
