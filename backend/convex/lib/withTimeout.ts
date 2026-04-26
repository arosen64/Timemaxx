const TIMEOUT_MS = 60_000;

export function withTimeout<T>(promise: Promise<T>, label: string): Promise<T> {
  let timerId: ReturnType<typeof setTimeout>;
  return Promise.race([
    promise.finally(() => clearTimeout(timerId)),
    new Promise<never>((_, reject) => {
      timerId = setTimeout(
        () => reject(new Error(`${label} timed out after 60s`)),
        TIMEOUT_MS
      );
    }),
  ]);
}
