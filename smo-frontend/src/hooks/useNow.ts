import { useEffect, useState } from "react";

/**
 * The current time, updated every `intervalMs`, so relative times ("in 5 minutes") stay current.
 */
export default function useNow(intervalMs = 30_000): number {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(interval);
  }, [intervalMs]);

  return now;
}
