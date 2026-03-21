import { useEffect, useState } from "react";

type Setter<T> = (value: T | ((prev: T) => T)) => void;

export function useLocalStorageState<T>(key: string, initialValue: T): [T, Setter<T>] {
  const [value, setValue] = useState<T>(() => {
    if (typeof window === "undefined") {
      return initialValue;
    }
    try {
      const stored = window.localStorage.getItem(key);
      return stored ? (JSON.parse(stored) as T) : initialValue;
    } catch {
      return initialValue;
    }
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // Ignore write errors (e.g., private mode or storage full).
    }
  }, [key, value]);

  return [value, setValue];
}
