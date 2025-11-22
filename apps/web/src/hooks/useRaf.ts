import { useCallback, useRef } from "react";

export function useRaf<T extends (...args: any[]) => void>(fn: T): T {
  const frameRef = useRef<number | null>(null);
  const argsRef = useRef<any[] | null>(null);

  return useCallback(
    (...args: any[]) => {
      argsRef.current = args;
      if (frameRef.current != null) return;
      frameRef.current = requestAnimationFrame(() => {
        frameRef.current = null;
        fn(...(argsRef.current ?? []));
      });
    },
    [fn],
  ) as T;
}
