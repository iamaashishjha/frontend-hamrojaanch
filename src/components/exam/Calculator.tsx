import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function Calculator() {
  const [display, setDisplay] = useState("0");
  const [previousValue, setPreviousValue] = useState<number | null>(null);
  const [operator, setOperator] = useState<string | null>(null);
  const [waitingForOperand, setWaitingForOperand] = useState(false);

  const inputDigit = (digit: string) => {
    if (waitingForOperand) {
      setDisplay(digit);
      setWaitingForOperand(false);
    } else {
      setDisplay(display === "0" ? digit : display + digit);
    }
  };

  const inputDot = () => {
    if (waitingForOperand) {
      setDisplay("0.");
      setWaitingForOperand(false);
      return;
    }
    if (!display.includes(".")) {
      setDisplay(display + ".");
    }
  };

  const clear = () => {
    setDisplay("0");
    setPreviousValue(null);
    setOperator(null);
    setWaitingForOperand(false);
  };

  const toggleSign = () => {
    const value = parseFloat(display);
    setDisplay(String(value * -1));
  };

  const inputPercent = () => {
    const value = parseFloat(display);
    setDisplay(String(value / 100));
  };

  const performOperation = (nextOperator: string) => {
    const inputValue = parseFloat(display);

    if (previousValue == null) {
      setPreviousValue(inputValue);
    } else if (operator) {
      const result = calculate(previousValue, inputValue, operator);
      setDisplay(String(result));
      setPreviousValue(result);
    }

    setWaitingForOperand(true);
    setOperator(nextOperator);
  };

  const calculate = (a: number, b: number, op: string): number => {
    switch (op) {
      case "+": return a + b;
      case "-": return a - b;
      case "×": return a * b;
      case "÷": return b !== 0 ? a / b : 0;
      default: return b;
    }
  };

  const handleEquals = () => {
    if (operator && previousValue != null) {
      const inputValue = parseFloat(display);
      const result = calculate(previousValue, inputValue, operator);
      setDisplay(String(result));
      setPreviousValue(null);
      setOperator(null);
      setWaitingForOperand(true);
    }
  };

  const buttonClass = "h-12 text-base font-medium rounded-lg transition-colors";

  return (
    <div className="space-y-3">
      {/* Display */}
      <div className="bg-secondary rounded-lg p-4 text-right">
        <div className="text-xs text-muted-foreground h-5">
          {previousValue != null && operator ? `${previousValue} ${operator}` : ""}
        </div>
        <div className="text-3xl font-mono font-bold truncate">{display}</div>
      </div>

      {/* Buttons */}
      <div className="grid grid-cols-4 gap-2">
        <Button variant="secondary" className={buttonClass} onClick={clear}>AC</Button>
        <Button variant="secondary" className={buttonClass} onClick={toggleSign}>±</Button>
        <Button variant="secondary" className={buttonClass} onClick={inputPercent}>%</Button>
        <Button variant="outline" className={cn(buttonClass, "bg-accent text-accent-foreground")} onClick={() => performOperation("÷")}>÷</Button>

        {["7", "8", "9"].map((d) => (
          <Button key={d} variant="outline" className={buttonClass} onClick={() => inputDigit(d)}>{d}</Button>
        ))}
        <Button variant="outline" className={cn(buttonClass, "bg-accent text-accent-foreground")} onClick={() => performOperation("×")}>×</Button>

        {["4", "5", "6"].map((d) => (
          <Button key={d} variant="outline" className={buttonClass} onClick={() => inputDigit(d)}>{d}</Button>
        ))}
        <Button variant="outline" className={cn(buttonClass, "bg-accent text-accent-foreground")} onClick={() => performOperation("-")}>−</Button>

        {["1", "2", "3"].map((d) => (
          <Button key={d} variant="outline" className={buttonClass} onClick={() => inputDigit(d)}>{d}</Button>
        ))}
        <Button variant="outline" className={cn(buttonClass, "bg-accent text-accent-foreground")} onClick={() => performOperation("+")}>+</Button>

        <Button variant="outline" className={cn(buttonClass, "col-span-2")} onClick={() => inputDigit("0")}>0</Button>
        <Button variant="outline" className={buttonClass} onClick={inputDot}>.</Button>
        <Button className={buttonClass} onClick={handleEquals}>=</Button>
      </div>
    </div>
  );
}
