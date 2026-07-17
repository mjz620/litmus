import type { SafetyRegistryEntry } from "./types";

export const SAFETY_REGISTRY_ENTRIES = [
  {
    id: "safety.virtual_titration_ppe_notice.v1",
    version: "1.0.0",
    severity: "required",
    availability: "verified",
    prohibited: false,
    compatibleFamilyIds: ["family.acid_base_titration.v1"],
    studentFacingText:
      "Wear assigned PPE and follow teacher instructions in a physical lab.",
    teacherFacingText:
      "Virtual completion does not replace local lab safety instruction."
  },
  {
    id: "safety.no_open_flame_mvp.v1",
    version: "1.0.0",
    severity: "prohibited",
    availability: "restricted",
    prohibited: true,
    compatibleFamilyIds: [],
    studentFacingText:
      "Open-flame equipment is not available in this virtual lab.",
    teacherFacingText:
      "Open-flame workflows are outside the verified Chromebook MVP safety and runtime capability."
  }
] as const satisfies readonly SafetyRegistryEntry[];
