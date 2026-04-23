import { logger } from "../infrastructure/logger";

export type CircuitBreakerState = "CLOSED" | "HALF_OPEN" | "OPEN";

export type CircuitBreakerConfig = {
  onClose?: () => void;
  onHalfOpen?: () => void;
  onOpen?: () => void;
  threshold: number; // Number of failures before opening
  timeout: number; // Milliseconds to stay open
};

/**
 * Circuit breaker pattern for external API calls (GitHub API)
 * Prevents cascading failures
 */
export class CircuitBreaker {
  private state: CircuitBreakerState = "CLOSED";
  private failureCount = 0;
  private lastFailureTime: null | number = null;
  private successCount = 0;

  constructor(private config: CircuitBreakerConfig) {}

  /**
   * Execute function with circuit breaker protection
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === "OPEN") {
      if (this.isTimeoutExpired()) {
        this.transitionTo("HALF_OPEN");
      } else {
        throw new Error(`Circuit breaker is OPEN (${this.config.timeout}ms timeout)`);
      }
    }

    try {
      const result = await fn();

      if (this.state === "HALF_OPEN") {
        this.successCount++;
        if (this.successCount >= 2) {
          this.transitionTo("CLOSED");
        }
      } else if (this.state === "CLOSED") {
        this.failureCount = 0;
      }

      return result;
    } catch (error) {
      this.failureCount++;
      this.lastFailureTime = Date.now();

      logger.warn({
        failureCount: this.failureCount,
        msg: "circuit_breaker_failure",
        state: this.state,
        threshold: this.config.threshold,
      });

      if (this.failureCount >= this.config.threshold) {
        this.transitionTo("OPEN");
      }

      throw error;
    }
  }

  private isTimeoutExpired(): boolean {
    if (this.lastFailureTime == null) return false;
    return Date.now() - this.lastFailureTime > this.config.timeout;
  }

  private transitionTo(newState: CircuitBreakerState): void {
    if (this.state === newState) return;

    logger.info({
      from: this.state,
      msg: "circuit_breaker_state_change",
      to: newState,
    });

    this.state = newState;

    if (newState === "OPEN") {
      this.config.onOpen?.();
    } else if (newState === "CLOSED") {
      this.failureCount = 0;
      this.successCount = 0;
      this.lastFailureTime = null;
      this.config.onClose?.();
    } else {
      this.successCount = 0;
      this.config.onHalfOpen?.();
    }
  }

  getState(): CircuitBreakerState {
    return this.state;
  }

  reset(): void {
    this.transitionTo("CLOSED");
  }
}
