export const MAX_TIMER_MS = 2_147_483_647;
export const mono = (): number => performance.now();
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
export function deadline(waitMs: number, callback: () => void): () => void {
  let cancelled = false;
  let timer: NodeJS.Timeout | undefined;
  const arm = (remaining: number): void => {
    if (cancelled) return;
    if (remaining <= 0) {
      callback();
      return;
    }
    timer = setTimeout(() => arm(remaining - Math.min(remaining, MAX_TIMER_MS)), Math.min(remaining, MAX_TIMER_MS));
    timer.unref();
  };
  arm(waitMs);
  return () => {
    cancelled = true;
    if (timer) clearTimeout(timer);
  };
}
export async function bounded<T>(promise: Promise<T>, waitMs: number, fallback: () => T): Promise<T> {
  if (waitMs <= 0) return fallback();
  return new Promise<T>((resolve) => {
    const cancel = deadline(waitMs, () => resolve(fallback()));
    promise.then(
      (value) => {
        cancel();
        resolve(value);
      },
      () => {
        cancel();
        resolve(fallback());
      },
    );
  });
}
