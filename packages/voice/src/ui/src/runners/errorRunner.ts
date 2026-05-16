import type { RunnerDeps } from "./types.js";

/**
 * Wires global error sinks. Ports the vanilla SPA's
 *   window.addEventListener("error", …) / ("unhandledrejection", …)
 * which dlog'd window.error / window.unhandledrejection. Here those become
 * typed actions that the wire-log middleware forwards as browser.debug.
 */
export function createErrorRunner({ dispatch }: RunnerDeps): () => void {
  const onError = (event: ErrorEvent): void => {
    dispatch({ type: "browser/window/error", message: event.message });
  };
  const onRejection = (event: PromiseRejectionEvent): void => {
    dispatch({
      type: "browser/window/unhandled-rejection",
      reason: String(event.reason),
    });
  };

  window.addEventListener("error", onError);
  window.addEventListener("unhandledrejection", onRejection);

  return () => {
    window.removeEventListener("error", onError);
    window.removeEventListener("unhandledrejection", onRejection);
  };
}
