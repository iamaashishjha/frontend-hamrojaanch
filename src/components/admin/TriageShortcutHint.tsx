interface TriageShortcutHintProps {
  className?: string;
}

export default function TriageShortcutHint({ className }: TriageShortcutHintProps) {
  return (
    <p className={className ?? "mt-1 text-xs text-muted-foreground"}>
      Shortcuts: 1 Critical, 2 Warning, 3 Healthy, 0 Clear idle, R Reset all
    </p>
  );
}

