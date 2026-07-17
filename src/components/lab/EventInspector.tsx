import type { SemanticEvent, StudentModel } from "../../experiments/shared";

import styles from "./EventInspector.module.css";

interface EventInspectorProps {
  sessionSeed: string | null;
  events: readonly SemanticEvent[];
  studentModel: StudentModel | null;
  engineState: unknown;
}

/** Development-only view. Callers must never mount this on a student route. */
export function EventInspector({
  sessionSeed,
  events,
  studentModel,
  engineState
}: EventInspectorProps) {
  const config = getEngineConfig(engineState);

  return (
    <details className={styles.inspector} data-testid="event-inspector" open>
      <summary>Open raw event inspector</summary>
      <div className={styles.content}>
        <section aria-labelledby="event-inspector-events">
          <h3 id="event-inspector-events">Recent semantic events</h3>
          {events.length === 0 ? (
            <p>No events emitted yet.</p>
          ) : (
            <ol className={styles.events}>
              {events.slice(-12).map((event, index) => (
                <li
                  className={styles.event}
                  key={`${event.type}-${event.tSim}-${index}`}
                >
                  <strong>{event.type}</strong> · t={event.tSim}
                  <p>
                    Flags:{" "}
                    {event.flags.length ? event.flags.join(", ") : "none"}
                  </p>
                  <p>
                    Evidence:{" "}
                    {event.evidence.length
                      ? event.evidence
                          .map(
                            (item) =>
                              `${item.skillId}:${item.reason} (${item.delta})`
                          )
                          .join(", ")
                      : "none"}
                  </p>
                  <pre className={styles.raw}>
                    {JSON.stringify(event.observation, null, 2)}
                  </pre>
                </li>
              ))}
            </ol>
          )}
        </section>

        <section aria-labelledby="event-inspector-model">
          <h3 id="event-inspector-model">StudentModel</h3>
          <pre className={styles.raw} data-testid="event-inspector-model">
            {studentModel ? JSON.stringify(studentModel, null, 2) : "—"}
          </pre>
        </section>

        <section aria-labelledby="event-inspector-seed">
          <h3 id="event-inspector-seed">Session seed</h3>
          <pre className={styles.raw} data-testid="event-inspector-seed">
            {sessionSeed ?? "—"}
          </pre>
        </section>

        <section aria-labelledby="event-inspector-state">
          <h3>Generated configuration</h3>
          <pre className={styles.raw} data-testid="dev-config">
            {config === undefined ? "—" : JSON.stringify(config, null, 2)}
          </pre>
          <h3 id="event-inspector-state">Raw engine state</h3>
          <pre className={styles.raw} data-testid="dev-raw-state">
            {JSON.stringify(engineState, null, 2)}
          </pre>
        </section>
      </div>
    </details>
  );
}

function getEngineConfig(engineState: unknown): unknown {
  if (
    typeof engineState === "object" &&
    engineState !== null &&
    "config" in engineState
  ) {
    return engineState.config;
  }
  return undefined;
}
