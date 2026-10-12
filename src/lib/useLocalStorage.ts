import { useCallback, useState } from 'react';

export function useLocalStorage<T extends string>(key: string, fallback: T, allowed: readonly T[]) {
  const [value, setValue] = useState<T>(() => {
    const stored = localStorage.getItem(key) as T | null;
    return stored && allowed.includes(stored) ? stored : fallback;
  });

  const update = useCallback(
    (next: T) => {
      localStorage.setItem(key, next);
      setValue(next);
    },
    [key],
  );

  return [value, update] as const;
}
