# 9. Experiment specifications
## 9.1 Shared experiment plugin contract

The existing `ExperimentDefinition<TConfig, TState, TAction>` is the architectural foundation. The 3D shell, tutor, evaluator, persistence layer, report flow, teacher analytics, and eval harness are each implemented once against this contract.

### Required invariants

1. `TConfig`, `TState`, `TAction`, events, and ground truth are serializable.
2. `step(state, action)` is pure and deterministic.
3. Identical state and action produce identical next state and events.
4. The engine emits only pedagogically meaningful `SemanticEvent` objects.
5. Events are both tutor inputs and persisted event records.
6. The LLM never computes or overrides scientific state.
7. `createInitialState(config, seed)` supports valid intermediate state seeding.
8. Every semantic flag is backed by at least one unit/eval scenario.
9. Every positive behavior that should remain silent has a false-intervention test.
10. Display precision is separate from internal full-precision state.

### Canonical interface

```ts
export interface ExperimentDefinition<TConfig, TState, TAction> {
  id: string;
  title: string;
  skills: SkillDefinition[];
  reportRubric: RubricCriterion[];

  createInitialState(config: TConfig, seed?: Partial<TState>): TState;
  step(state: TState, action: TAction): StepResult<TState>;
  getGroundTruth(state: TState): GroundTruth;
}
```

### Recommended metadata extension

Add metadata without changing the core reducer:

```ts
export interface ExperimentMetadata<TState> {
  description: string;
  estimatedMinutes: number;
  difficulty: "intro" | "intermediate" | "advanced";
  thumbnail: string;
  readinessWeights: Record<string, number>;
  stages: ExperimentStage[];
  retryTemplates: RetryTemplate<TState>[];
  ui: ExperimentUIManifest;
}
```

Keep metadata declarative and serializable.

## 9.2 Hero experiment — acid–base titration

### Scientific scope

- Monoprotic strong acid or weak acid.
- Strong-base titrant.
- 25 °C.
- Activity approximated by concentration.
- 50.00 mL burette readable to ±0.05 mL.
- Internal values retain full precision.
- Display layer applies equipment precision.

### Existing config

```ts
interface TitrationConfig {
  analyte: {
    name: string;
    type: "strong_acid" | "weak_acid";
    concentrationM: number;
    volumeML: number;
    pKa?: number;
  };
  titrant: {
    name: string;
    concentrationM: number;
  };
  indicator: "phenolphthalein" | "bromothymol_blue" | "methyl_orange";
  buretteCapacityML: number;
}
```

### Existing state

```ts
interface TitrationState {
  config: TitrationConfig;
  titrantAddedML: number;
  buretteConditioned: boolean;
  titrantDilutionFactor: number;
  tSim: number;
  curve: { volumeML: number; pH: number }[];
  submitted: boolean;
}
```

### Existing actions

```ts
type TitrationAction =
  | { type: "rinse_burette"; solvent: "water" | "titrant" }
  | { type: "select_indicator"; indicator: IndicatorId }
  | { type: "add_titrant"; volumeML: number; durationS: number }
  | { type: "read_meniscus"; reportedML: number }
  | { type: "submit_report"; reportedMolarityM: number; explanation: string };
```

### Skills

- `burette_conditioning`
- `endpoint_control`
- `volumetric_reading`
- `stoichiometry`

### Core mistake scenarios

| Scenario | Deterministic effect | Event flag | Tutor goal |
|---|---|---|---|
| Rinses burette with water | Effective titrant dilution, endpoint volume runs long | `burette_not_conditioned` | Elicit why residual water changes concentration |
| Adds quickly near endpoint | Reduced control | `flow_rate_high_near_endpoint` | Prompt student to reduce rate |
| Overshoots endpoint | Delivered volume exceeds tolerance | `endpoint_overshoot` | Connect excess volume to calculated concentration |
| Misreads meniscus | Measurement error exceeds ±0.05 mL | `meniscus_reading_error` | Prompt eye-level reading and precision |
| Incorrect molarity | Calculation differs from ground truth | `molarity_calculation_error` | Identify incorrect quantity or mole ratio |
| Sig-fig abuse | Report precision exceeds instrument support | `sig_fig_error` | Connect reporting precision to glassware |

### Required visual behavior

- Burette liquid level decreases as delivered volume increases.
- Flask color uses deterministic indicator/pH mapping.
- Endpoint color should be subtle and not exaggerated.
- Stopcock control maps to a deterministic rate and volume update.
- Live pH plot uses engine curve data.
- Meniscus view includes parallax/eye-level cue but reading correctness is deterministic.

### Required tests

Existing truth tests must remain green:

- equivalence volume correctness,
- monotonic strong-acid titration pH,
- neutral strong–strong equivalence,
- weak-acid half-equivalence pH equals pKa,
- weak-acid equivalence is basic,
- indicator color behavior,
- water-conditioned burette bias,
- valid intermediate seeding,
- fast near-endpoint addition creates negative evidence,
- controlled dropwise addition remains unflagged.

Add tests for:

- meniscus tolerance boundaries,
- report molarity tolerance,
- sig-fig checks,
- maximum burette capacity,
- no negative volume,
- retry success criteria,
- event serialization round trip.

## 9.3 Experiment 2 — precipitation and solubility

### Purpose
Prove plugin extensibility with visually striking chemistry and low engine complexity.

### Core interactions

- Select two aqueous ionic solutions.
- Measure and pour chosen volumes.
- Mix in a test tube or beaker.
- Observe precipitate formation/color or no visible reaction.
- Identify spectator ions.
- Write molecular, complete ionic, and net ionic equations.

### Deterministic engine

- Solubility-rule lookup.
- Ion dissociation map.
- Stoichiometric limiting-ion calculation.
- Precipitate identity and amount.
- Color lookup for supported precipitates.

### Example skills

- `predict_precipitate`
- `apply_solubility_rules`
- `identify_spectator_ions`
- `write_net_ionic_equation`
- `measurement_control`

### Useful misconception events

- predicts reaction when all products remain soluble,
- omits charges,
- fails to dissociate strong electrolytes,
- includes spectator ions in net ionic equation,
- chooses incorrect precipitate formula.

## 9.4 Experiment 3 — calorimetry

### Core interactions

- Measure mass/volume.
- Record initial temperature.
- Mix sample in coffee-cup calorimeter.
- Observe temperature curve.
- Choose or estimate specific heat.
- Calculate `q = mcΔT`.
- Apply sign convention.
- Account for optional calorimeter heat capacity or heat-loss term.

### Skills

- `temperature_measurement`
- `heat_calculation`
- `sign_convention`
- `energy_conservation`
- `sig_figs`

### Engine requirement

The heat-loss model must be deterministic and documented. Do not use a visually plausible but unexplained temperature curve.

---
