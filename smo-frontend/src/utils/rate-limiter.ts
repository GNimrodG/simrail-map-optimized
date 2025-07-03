export interface RateLimiterOptions {
  /**
   * Minimum interval between requests in milliseconds
   * @default 1000
   */
  minInterval?: number;

  /**
   * Maximum number of concurrent requests allowed
   * @default 1
   */
  maxConcurrent?: number;

  /**
   * Whether to enable debug logging
   * @default false
   */
  debug?: boolean;
}

/**
 * Rate limiter to control the frequency of requests
 */
export class RateLimiter {
  private lastRequestTime = 0;
  private readonly minInterval: number;
  private readonly maxConcurrent: number;
  private readonly debug: boolean;
  private activeRequests = 0;
  private requestQueue: Array<() => void> = [];

  constructor(options: RateLimiterOptions = {}) {
    this.minInterval = options.minInterval ?? 1000;
    this.maxConcurrent = options.maxConcurrent ?? 1;
    this.debug = options.debug ?? false;
  }
  /**
   * Throttle requests to respect rate limits
   * @param abortSignal - Optional AbortSignal to cancel the throttling
   */
  async throttle(abortSignal?: AbortSignal): Promise<void> {
    return new Promise((resolve, reject) => {
      // Check if already aborted
      if (abortSignal?.aborted) {
        if (this.debug) {
          console.debug("Rate limiter: request was already aborted");
        }
        reject(new Error("Operation was aborted"));
        return;
      }

      const executeRequest = async () => {
        // Wait for concurrent limit
        while (this.activeRequests >= this.maxConcurrent) {
          if (abortSignal?.aborted) {
            if (this.debug) {
              console.debug("Rate limiter: request aborted while waiting for concurrent slot");
            }
            reject(new Error("Operation was aborted"));
            return;
          }
          await new Promise((resolve) => setTimeout(resolve, 10));
        }

        this.activeRequests++;

        try {
          // Apply time-based throttling
          const now = Date.now();
          const timeSinceLastRequest = now - this.lastRequestTime;

          if (timeSinceLastRequest < this.minInterval) {
            const waitTime = this.minInterval - timeSinceLastRequest;

            if (this.debug) {
              console.debug(`Rate limiter: waiting ${waitTime}ms before next request`);
            }

            // Wait with abort signal support
            await new Promise<void>((resolveWait, rejectWait) => {
              const timeoutId = setTimeout(() => {
                resolveWait();
              }, waitTime);

              // Handle abort during wait
              if (abortSignal) {
                const abortHandler = () => {
                  clearTimeout(timeoutId);
                  if (this.debug) {
                    console.debug("Rate limiter: request aborted during throttle wait");
                  }
                  rejectWait(new Error("Operation was aborted"));
                };

                if (abortSignal.aborted) {
                  clearTimeout(timeoutId);
                  rejectWait(new Error("Operation was aborted"));
                  return;
                }

                abortSignal.addEventListener("abort", abortHandler, { once: true });
              }
            });
          }

          this.lastRequestTime = Date.now();

          if (this.debug) {
            console.debug(`Rate limiter: request allowed at ${new Date().toISOString()}`);
          }
        } finally {
          this.activeRequests--;
          // Process next request in queue
          const nextRequest = this.requestQueue.shift();
          if (nextRequest) {
            nextRequest();
          }
        }

        resolve();
      };

      if (this.activeRequests < this.maxConcurrent) {
        executeRequest().catch(reject);
      } else {
        // Queue the request
        this.requestQueue.push(() => executeRequest().catch(reject));
      }
    });
  }

  /**
   * Get current rate limiter statistics
   */
  getStats() {
    return {
      activeRequests: this.activeRequests,
      queuedRequests: this.requestQueue.length,
      minInterval: this.minInterval,
      maxConcurrent: this.maxConcurrent,
      lastRequestTime: this.lastRequestTime,
    };
  }

  /**
   * Reset the rate limiter state
   */
  reset() {
    this.lastRequestTime = 0;
    this.activeRequests = 0;
    this.requestQueue = [];
  }
}
