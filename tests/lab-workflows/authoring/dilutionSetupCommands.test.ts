import { describe, expect, it } from "vitest";

import {
  applyLabDraftTransaction,
  type LabDraftCommand
} from "../../../src/lab-workflows/authoring";
import { createBlankLabDraftV2 } from "../../../src/lab-workflows/definitions/blank-lab";

const EQUIPMENT = [
  {
    instanceId: "stock_bottle",
    equipmentDefinitionId: "component.reagent_bottle.v1",
    configurationPresetId: "component_config.reagent_bottle.stock_solution.v1",
    label: "Sodium chloride stock",
    required: true
  },
  {
    instanceId: "transfer_pipette",
    equipmentDefinitionId: "component.volumetric_pipette.v1",
    configurationPresetId: "component_config.volumetric_pipette.10ml.v1",
    label: "10 mL pipette",
    required: true
  },
  {
    instanceId: "preparation_flask",
    equipmentDefinitionId: "component.volumetric_flask.v1",
    configurationPresetId: "component_config.volumetric_flask.100ml.v1",
    label: "100 mL volumetric flask",
    required: true
  },
  {
    instanceId: "water_bottle",
    equipmentDefinitionId: "component.wash_bottle.v1",
    configurationPresetId: "component_config.wash_bottle.250ml.v1",
    label: "Distilled water",
    required: true
  }
] as const;

describe("LC2-500 human Composer setup commands", () => {
  it("assembles the registered physical setup atomically through shared commands", () => {
    const initial = createBlankLabDraftV2();
    const commands: LabDraftCommand[] = [
      ...EQUIPMENT.map(
        (equipment) => ({ type: "add_equipment", equipment }) as const
      ),
      {
        type: "set_layout",
        layout: {
          configurationSchemaId:
            "schema.layout_configuration.solution_preparation_bench.v1",
          placements: [
            {
              equipmentInstanceId: "stock_bottle",
              placementSlotId: "placement.solution_stock_right.v1"
            },
            {
              equipmentInstanceId: "transfer_pipette",
              placementSlotId: "placement.solution_pipette_stand.v1"
            },
            {
              equipmentInstanceId: "preparation_flask",
              placementSlotId: "placement.solution_flask_center.v1"
            },
            {
              equipmentInstanceId: "water_bottle",
              placementSlotId: "placement.solution_wash_left.v1"
            }
          ]
        }
      },
      {
        type: "bind_material",
        binding: {
          instanceId: "stock_solution",
          materialProfileId: "reagent.sodium_chloride_1_000m.v1",
          containerInstanceId: "stock_bottle",
          quantityPresetId: "quantity-preset.sodium_chloride_1_000m_50ml.v1"
        }
      },
      {
        type: "bind_material",
        binding: {
          instanceId: "diluent_water",
          materialProfileId: "reagent.distilled_water.v1",
          containerInstanceId: "water_bottle",
          quantityPresetId: "quantity-preset.distilled_water_250ml.v1"
        }
      },
      ...[
        {
          id: "permission_condition_pipette",
          actionId: "action.rinse_transfer_device.v1",
          sourceEquipmentInstanceId: "stock_bottle",
          targetEquipmentInstanceIds: ["transfer_pipette"]
        },
        {
          id: "permission_aspirate_stock",
          actionId: "action.transfer_liquid.v1",
          sourceEquipmentInstanceId: "stock_bottle",
          targetEquipmentInstanceIds: ["transfer_pipette"]
        },
        {
          id: "permission_deliver_aliquot",
          actionId: "action.transfer_liquid.v1",
          sourceEquipmentInstanceId: "transfer_pipette",
          targetEquipmentInstanceIds: ["preparation_flask"]
        },
        {
          id: "permission_fill_to_mark",
          actionId: "action.fill_to_mark.v1",
          sourceEquipmentInstanceId: "water_bottle",
          targetEquipmentInstanceIds: ["preparation_flask"]
        },
        {
          id: "permission_mix_solution",
          actionId: "action.mix_solution.v1",
          sourceEquipmentInstanceId: "preparation_flask",
          targetEquipmentInstanceIds: []
        }
      ].map(
        (action) =>
          ({
            type: "permit_action",
            action: {
              ...action,
              availability: {
                allSatisfiedRuleIds: [],
                allUnsatisfiedRuleIds: []
              }
            }
          }) as LabDraftCommand
      )
    ];

    const result = applyLabDraftTransaction(
      initial,
      commands,
      initial.revision
    );
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.error.message);
    expect(result.edit).toMatchObject({
      commandCount: 12,
      revisionBefore: 1,
      revisionAfter: 2
    });
    expect(result.draft.equipment).toHaveLength(4);
    expect(result.draft.materials).toHaveLength(2);
    expect(result.draft.permittedActions).toHaveLength(5);
    expect(result.draft.layout.configurationSchemaId).toBe(
      "schema.layout_configuration.solution_preparation_bench.v1"
    );
    expect(result.draft.validation).toBeNull();
    expect(result.draft.judgeCritique).toBeNull();
  });
});
