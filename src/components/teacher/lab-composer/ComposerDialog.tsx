"use client";

import {
  useEffect,
  useId,
  useRef,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode
} from "react";

import styles from "./LabComposer.module.css";

interface ComposerDialogProps {
  readonly open: boolean;
  readonly title: string;
  readonly description: string;
  readonly confirmLabel: string;
  readonly destructive?: boolean;
  readonly confirmDisabled?: boolean;
  readonly returnFocusTo?: HTMLElement | null;
  readonly children?: ReactNode;
  readonly onCancel: () => void;
  readonly onConfirm: () => void;
}

const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function ComposerDialog({
  open,
  title,
  description,
  confirmLabel,
  destructive = false,
  confirmDisabled = false,
  returnFocusTo,
  children,
  onCancel,
  onConfirm
}: ComposerDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    if (!open) return;
    const dialog = dialogRef.current;
    const first = dialog?.querySelector<HTMLElement>(FOCUSABLE);
    window.requestAnimationFrame(() => first?.focus());
    return () => returnFocusTo?.focus();
  }, [open, returnFocusTo]);

  if (!open) return null;

  function trapFocus(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      onCancel();
      return;
    }
    if (event.key !== "Tab") return;
    const focusable = [
      ...(dialogRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? [])
    ];
    if (focusable.length === 0) return;
    const first = focusable[0]!;
    const last = focusable.at(-1)!;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  return (
    <div className={styles.dialogBackdrop}>
      <div
        ref={dialogRef}
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        onKeyDown={trapFocus}
      >
        <header>
          <p>Before you remove this</p>
          <h2 id={titleId}>{title}</h2>
          <span id={descriptionId}>{description}</span>
        </header>
        {children}
        <footer>
          <button type="button" onClick={onCancel}>
            Cancel
          </button>
          <button
            type="button"
            className={
              destructive ? styles.confirmDanger : styles.primaryButton
            }
            disabled={confirmDisabled}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </footer>
      </div>
    </div>
  );
}
