"use client";

import styles from "./WebGLRecoveryNotice.module.css";

interface WebGLRecoveryNoticeProps {
  /** Suppresses the pulse alongside the bench "Reduced graphics" toggle. */
  readonly reducedGraphics: boolean;
}

/**
 * Shown while the WebGL context is lost. The wording stays non-technical and
 * reassures that lab progress is intact — the student did nothing wrong and
 * loses nothing, so this is a status, not an error.
 */
export function WebGLRecoveryNotice({
  reducedGraphics
}: WebGLRecoveryNoticeProps) {
  return (
    <div className={styles.notice} role="status" aria-live="polite">
      {!reducedGraphics && <span className={styles.pulse} aria-hidden="true" />}
      <p className={styles.headline}>The 3D bench is reloading.</p>
      <p className={styles.detail}>
        Your lab progress is saved. Lab steps stay usable while the bench comes
        back.
      </p>
    </div>
  );
}
