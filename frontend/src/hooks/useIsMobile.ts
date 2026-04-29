import { useSyncExternalStore } from "react";

export const MOBILE_BREAKPOINT = "(max-width: 767px)";

const mq = typeof window !== "undefined" ? window.matchMedia(MOBILE_BREAKPOINT) : null;

export function useIsMobile() {
  return useSyncExternalStore(
    (cb) => {
      mq?.addEventListener("change", cb);
      return () => mq?.removeEventListener("change", cb);
    },
    () => mq?.matches ?? false,
    () => false
  );
}
