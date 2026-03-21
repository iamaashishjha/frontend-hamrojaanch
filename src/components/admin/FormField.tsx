import { Label } from "@/components/ui/label";
import type { ReactNode } from "react";

interface FormFieldProps {
  label: string;
  required?: boolean;
  hint?: string;
  children: ReactNode;
}

export default function FormField({ label, required, hint, children }: FormFieldProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium">
          {label}
          {required ? <span className="ml-1 text-xs text-danger">*</span> : null}
        </Label>
        {required ? <span className="text-xs text-muted-foreground">Required</span> : null}
      </div>
      {children}
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
