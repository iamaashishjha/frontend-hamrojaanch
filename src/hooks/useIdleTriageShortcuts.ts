import { useEffect } from "react";

interface IdleTriageShortcutsOptions {
  onCritical: () => void;
  onWarning: () => void;
  onHealthy: () => void;
  onClearIdle: () => void;
  onResetAll: () => void;
}

/**
 * Keyboard shortcuts:
 * 1 = critical, 2 = warning, 3 = healthy, 0 = clear idle filter, r = reset all filters.
 * Ignores keystrokes while user is typing in input fields.
 */
export function useIdleTriageShortcuts(options: IdleTriageShortcutsOptions) {
  const { onCritical, onWarning, onHealthy, onClearIdle, onResetAll } = options;

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      const typingInField =
        tag === "input" ||
        tag === "textarea" ||
        tag === "select" ||
        target?.isContentEditable;
      if (typingInField) return;

      const key = event.key.toLowerCase();
      if (key === "1") {
        onCritical();
      } else if (key === "2") {
        onWarning();
      } else if (key === "3") {
        onHealthy();
      } else if (key === "0") {
        onClearIdle();
      } else if (key === "r") {
        onResetAll();
      } else {
        return;
      }
      event.preventDefault();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onCritical, onWarning, onHealthy, onClearIdle, onResetAll]);
}

