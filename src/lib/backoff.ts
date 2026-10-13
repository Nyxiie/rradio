/** Exponential backoff with jitter: ~1s, 2s, 4s, 8s ... capped at `max` ms. */
export function backoffDelay(attempt: number, base = 1000, max = 30_000): number {
  const exp = Math.min(max, base * 2 ** Math.max(0, attempt))
  return exp * (0.8 + Math.random() * 0.4)
}
