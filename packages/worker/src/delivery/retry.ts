/**
 * Retry delay calculation strategies.
 *
 * Strategies:
 * - exponential: delay doubles each attempt (with jitter). Best for unknown failure duration.
 * - linear: constant interval between retries. Best for predictable recovery times.
 * - fixed: predefined schedule. Best for specific SLA requirements.
 *
 * Default exponential schedule (10 retries, 1 min base, 24h cap):
 *   Attempt 1:  immediate
 *   Attempt 2:  ~1 minute
 *   Attempt 3:  ~2 minutes
 *   Attempt 4:  ~4 minutes
 *   Attempt 5:  ~8 minutes
 *   Attempt 6:  ~16 minutes
 *   Attempt 7:  ~32 minutes
 *   Attempt 8:  ~1 hour
 *   Attempt 9:  ~2 hours
 *   Attempt 10: ~4 hours
 *   Total span: ~8 hours
 */

export type RetryStrategy = "exponential" | "linear" | "fixed";

export interface RetryConfig {
  strategy: RetryStrategy;
  maxRetries: number;
  intervalMs: number;     // base interval
  maxIntervalMs: number;  // cap for exponential
}

/**
 * Calculate the delay in ms before the next retry attempt.
 */
export function calculateRetryDelay(
  config: RetryConfig,
  attempt: number,
): number {
  let delay: number;

  switch (config.strategy) {
    case "exponential":
      delay = Math.min(
        config.intervalMs * Math.pow(2, attempt - 1),
        config.maxIntervalMs,
      );
      // Add 20% jitter to avoid thundering herd
      delay += delay * 0.2 * Math.random();
      break;

    case "linear":
      delay = config.intervalMs;
      break;

    case "fixed":
      delay = config.intervalMs;
      break;

    default:
      delay = config.intervalMs;
  }

  return Math.round(delay);
}

/**
 * Check if an HTTP status code should trigger a retry based on the configured filter.
 *
 * Filter format (JSON array):
 * - "5xx" → matches 500-599
 * - "429" → matches exactly 429
 * - "4xx" → matches 400-499
 * - null/undefined → any non-2xx triggers retry
 */
export function shouldRetryStatus(
  statusCode: number,
  retryOnStatus: string | null,
): boolean {
  // Network error (status 0) always retries
  if (statusCode === 0) return true;

  // Success — never retry
  if (statusCode >= 200 && statusCode < 300) return false;

  // No filter configured — retry any non-2xx
  if (!retryOnStatus) return true;

  try {
    const filters: string[] = JSON.parse(retryOnStatus);
    return filters.some((filter) => {
      if (filter.endsWith("xx")) {
        const prefix = parseInt(filter[0], 10);
        return statusCode >= prefix * 100 && statusCode < (prefix + 1) * 100;
      }
      return statusCode === parseInt(filter, 10);
    });
  } catch {
    return true;
  }
}
