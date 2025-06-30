import { useEffect, useRef } from "react";

export function usePrevious<T>(value: T, ignoreFalsy = false): [value: T | undefined, time: number] {
  const ref = useRef<T>();
  const refTime = useRef<number>(0);

  useEffect(() => {
    if (!ignoreFalsy || !!value) {
      ref.current = value;
      refTime.current = Date.now();
    }
  }, [value, ignoreFalsy]);

  // eslint-disable-next-line react-compiler/react-compiler
  return [ref.current, refTime.current];
}
