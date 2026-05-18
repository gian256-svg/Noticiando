import { useState, useEffect } from "react";

/**
 * Returns a tick counter that increments every `intervalMs` milliseconds.
 * Components that use this hook will re-render on each tick, causing
 * relative timestamps (e.g. "5min ago") to refresh automatically.
 */
export function useRelativeTimeTick(intervalMs = 60_000): number {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);

  return tick;
}
