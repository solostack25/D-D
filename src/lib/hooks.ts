"use client";

import { useSyncExternalStore } from "react";

const noop = () => () => {};

/** false during SSR and hydration, true once running in the browser. */
export function useHydrated() {
  return useSyncExternalStore(noop, () => true, () => false);
}
