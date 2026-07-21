/**
 * The labs the judge demo puts forward.
 *
 * Chosen to span the product's distinct measurement techniques rather than to
 * be exhaustive: a burette titration, a volumetric dilution, a thermochemical
 * measurement, and a gravimetric one. Each is a validated native workflow that
 * students can already run, so the demo shows shipped labs, not fixtures built
 * for an audience.
 */
export interface DemoLab {
  readonly href: string;
  readonly title: string;
  readonly technique: string;
  readonly description: string;
  readonly icon: string;
}

export const DEMO_LABS: readonly DemoLab[] = Object.freeze([
  Object.freeze({
    href: "/demo/lab/titration",
    title: "Acid–base titration",
    technique: "Volumetric analysis",
    description:
      "Condition and fill a burette, add indicator, then control the endpoint drop by drop while the pH curve builds.",
    icon: "⚗"
  }),
  Object.freeze({
    href: "/demo/lab/solution-preparation",
    title: "Solution preparation",
    technique: "Dilution",
    description:
      "Condition a volumetric pipette, transfer an exact aliquot, and dilute to the mark to reach a target concentration.",
    icon: "◑"
  }),
  Object.freeze({
    href: "/demo/lab/calorimetry",
    title: "Dissolution calorimetry",
    technique: "Thermochemistry",
    description:
      "Weigh a solid on the balance, dissolve it in a coffee-cup calorimeter, and measure the molar enthalpy of solution.",
    icon: "◈"
  }),
  Object.freeze({
    href: "/demo/lab/silver-chloride",
    title: "Gravimetric precipitation",
    technique: "Gravimetric analysis",
    description:
      "Precipitate silver chloride, then filter, dry, and weigh it to determine the amount from mass alone.",
    icon: "◉"
  })
]);
