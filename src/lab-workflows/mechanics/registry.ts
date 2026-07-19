import type { GenericMechanicalAdapterPort } from "../runtime/generic/types";
import {
  BURETTE_MECHANICAL_ADAPTER,
  ERLENMEYER_FLASK_MECHANICAL_ADAPTER,
  INDICATOR_BOTTLE_MECHANICAL_ADAPTER,
  REAGENT_BOTTLE_MECHANICAL_ADAPTER,
  VOLUMETRIC_FLASK_MECHANICAL_ADAPTER,
  VOLUMETRIC_PIPETTE_MECHANICAL_ADAPTER,
  WASH_BOTTLE_MECHANICAL_ADAPTER
} from "./adapters";
import {
  LIQUID_MECHANICS_ERROR_CODES as ERROR,
  LiquidMechanicsError
} from "./errors";

export const LIQUID_MECHANICAL_ADAPTERS = Object.freeze([
  BURETTE_MECHANICAL_ADAPTER,
  ERLENMEYER_FLASK_MECHANICAL_ADAPTER,
  REAGENT_BOTTLE_MECHANICAL_ADAPTER,
  INDICATOR_BOTTLE_MECHANICAL_ADAPTER,
  VOLUMETRIC_PIPETTE_MECHANICAL_ADAPTER,
  VOLUMETRIC_FLASK_MECHANICAL_ADAPTER,
  WASH_BOTTLE_MECHANICAL_ADAPTER
] as const satisfies readonly GenericMechanicalAdapterPort[]);

const ADAPTER_BY_ID = new Map(
  LIQUID_MECHANICAL_ADAPTERS.map((adapter) => [adapter.adapterId, adapter])
);

export function getLiquidMechanicalAdapter(
  adapterId: string
): GenericMechanicalAdapterPort {
  const adapter = ADAPTER_BY_ID.get(adapterId);
  if (!adapter) {
    throw new LiquidMechanicsError(
      ERROR.unknownAdapter,
      `Unknown executable mechanical adapter ${adapterId}.`,
      { adapterId }
    );
  }
  return adapter;
}
