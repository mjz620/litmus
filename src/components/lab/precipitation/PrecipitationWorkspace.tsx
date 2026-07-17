"use client";

import { type FormEvent, useState } from "react";

import {
  listSolutions,
  type PrecipitateId,
  type SolutionId
} from "../../../experiments/precipitation/precipitation";
import { isPrecipitationState, useLabStore } from "../../../stores/labStore";

import styles from "./PrecipitationWorkspace.module.css";

const precipitateOptions: Array<{
  value: PrecipitateId | "none";
  label: string;
}> = [
  { value: "none", label: "No precipitate" },
  { value: "silver_chloride", label: "Silver chloride" },
  { value: "barium_sulfate", label: "Barium sulfate" },
  { value: "copper_ii_hydroxide", label: "Copper(II) hydroxide" },
  { value: "iron_iii_hydroxide", label: "Iron(III) hydroxide" }
];

export function PrecipitationWorkspace() {
  const state = useLabStore((store) =>
    isPrecipitationState(store.state) ? store.state : null
  );
  const events = useLabStore((store) => store.eventQueue);
  const dispatch = useLabStore((store) => store.dispatch);
  const [prediction, setPrediction] = useState<PrecipitateId | "none">("none");
  const [equation, setEquation] = useState("");
  const [error, setError] = useState<string | null>(null);
  if (!state) return null;
  const solutions = listSolutions().filter((solution) =>
    state.config.availableSolutionIds.includes(solution.id)
  );
  const predictionEvent = events.findLast(
    ({ type }) => type === "submit_precipitate_prediction"
  );
  const equationEvent = events.findLast(
    ({ type }) => type === "submit_net_ionic_equation"
  );

  function choose(slot: "A" | "B", solutionId: string) {
    setError(null);
    dispatch({
      type: "select_solution",
      slot,
      solutionId: solutionId as SolutionId
    });
  }

  function mix() {
    try {
      setError(null);
      dispatch({ type: "mix_solutions" });
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Could not mix solutions."
      );
    }
  }

  function submitEquation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    dispatch({ type: "submit_net_ionic_equation", equation });
  }

  return (
    <section
      className={styles.workspace}
      aria-labelledby="precipitation-heading"
    >
      <div>
        <p>Deterministic solubility lab</p>
        <h2 id="precipitation-heading">Mix two ionic solutions</h2>
        <p>
          Select two verified solutions, observe the mixture, then identify the
          product and write the net ionic equation.
        </p>
      </div>
      <div className={styles.solutions}>
        {(["A", "B"] as const).map((slot) => (
          <label key={slot}>
            Solution {slot}
            <select
              aria-label={`Solution ${slot}`}
              value={
                slot === "A" ? (state.solutionA ?? "") : (state.solutionB ?? "")
              }
              onChange={(event) => choose(slot, event.currentTarget.value)}
            >
              <option value="" disabled>
                Select a solution
              </option>
              {solutions.map((solution) => (
                <option value={solution.id} key={solution.id}>
                  {solution.label}
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>
      <button
        type="button"
        onClick={mix}
        disabled={
          !state.solutionA ||
          !state.solutionB ||
          state.solutionA === state.solutionB
        }
      >
        Mix solutions
      </button>
      {state.result && (
        <div className={styles.observation} role="status">
          <strong>Observation:</strong>{" "}
          {state.result.formsPrecipitate
            ? `A ${state.result.color} solid forms.`
            : "The mixture remains clear; no solid forms."}
        </div>
      )}
      {error && <p role="alert">{error}</p>}
      {state.result && (
        <div className={styles.actions}>
          <div>
            <label>
              Predicted precipitate
              <select
                value={prediction}
                onChange={(event) =>
                  setPrediction(
                    event.currentTarget.value as PrecipitateId | "none"
                  )
                }
              >
                {precipitateOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              onClick={() =>
                dispatch({
                  type: "submit_precipitate_prediction",
                  precipitateId: prediction
                })
              }
            >
              Check prediction
            </button>
            {predictionEvent && (
              <p role="status">
                {predictionEvent.flags.length
                  ? "Review the solubility rules and try again."
                  : "Prediction supported by the engine evidence."}
              </p>
            )}
          </div>
          <form onSubmit={submitEquation}>
            <label>
              Net ionic equation
              <input
                value={equation}
                onChange={(event) => setEquation(event.currentTarget.value)}
                placeholder="Ag+(aq) + Cl-(aq) → AgCl(s)"
                required
              />
            </label>
            <button type="submit">Check equation</button>
            {equationEvent && (
              <p role="status">
                {equationEvent.flags.length
                  ? "The equation is not yet balanced or still includes an incorrect species."
                  : "Equation supported by the engine evidence."}
              </p>
            )}
          </form>
        </div>
      )}
    </section>
  );
}
