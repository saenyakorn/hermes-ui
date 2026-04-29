import { useSyncExternalStore } from "react";

function subscribeToWindowEvent(eventName: string) {
  return (onStoreChange: () => void): (() => void) => {
    const handler = () => onStoreChange();
    window.addEventListener(eventName, handler);
    return () => window.removeEventListener(eventName, handler);
  };
}

/**
 * React-safe event pulse without lifecycle hooks in consumers.
 * Value increments whenever the event fires.
 */
export function useEventSignal(eventName: string): number {
  const subscribe = subscribeToWindowEvent(eventName);
  return useSyncExternalStore(
    subscribe,
    () => Date.now(),
    () => 0,
  );
}
