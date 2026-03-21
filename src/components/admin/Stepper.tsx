import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface StepperProps {
  steps: string[];
  currentStep: number;
}

export default function Stepper({ steps, currentStep }: StepperProps) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
      {steps.map((step, index) => {
        const isComplete = index < currentStep;
        const isActive = index === currentStep;
        return (
          <div key={step} className="flex flex-1 items-center gap-3">
            <div
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-full border text-sm font-semibold",
                isComplete && "border-success bg-success text-success-foreground",
                isActive && "border-primary bg-primary text-primary-foreground",
                !isComplete && !isActive && "border-border bg-card text-muted-foreground"
              )}
            >
              {isComplete ? <Check className="h-4 w-4" /> : index + 1}
            </div>
            <div className="min-w-0">
              <p className={cn("text-sm font-medium", isActive ? "text-foreground" : "text-muted-foreground")}>
                {step}
              </p>
            </div>
            {index < steps.length - 1 ? (
              <div className="hidden h-px flex-1 bg-border sm:block" />
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
