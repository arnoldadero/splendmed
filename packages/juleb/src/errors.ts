/**
 * Juleb failure taxonomy.
 *
 * Each error is a distinct, handled path (§12: no silent catch, every external
 * call has a defined failure state). The sync worker and the order outbox branch
 * on these, so adding a case here means deciding what the product does about it.
 */

export abstract class JulebError extends Error {
  /** Whether a retry could plausibly succeed. Drives outbox backoff. */
  abstract readonly retryable: boolean;
}

/**
 * Thrown by the HTTP driver for any operation whose real contract we do not have.
 *
 * This is the enforcement point for guardrail §3.1. Juleb publishes no public API
 * documentation, so until a specification and sandbox credentials exist there is
 * no honest implementation — and a fabricated request is worse than none, because
 * it fails at integration time instead of now.
 */
export class JulebSpecUnavailableError extends JulebError {
  readonly retryable = false;

  constructor(operation: string) {
    super(
      `Juleb API specification unavailable for ${operation}(). No endpoint has been ` +
        `published for this operation, so none may be guessed. Run with JULEB_DRIVER=mock. ` +
        `See docs/integrations/juleb.md for the swap-in checklist.`,
    );
    this.name = 'JulebSpecUnavailableError';
  }
}

/** Network failure, timeout, or 5xx. Safe to retry with backoff. */
export class JulebTransportError extends JulebError {
  readonly retryable = true;

  // Uses the native ES2022 `cause` option rather than declaring a field, which
  // would shadow Error.cause and lose it from stack output.
  constructor(operation: string, options?: { cause?: unknown }) {
    super(`Juleb transport failure during ${operation}()`, options);
    this.name = 'JulebTransportError';
  }
}

/** Throttled. Retry after the advertised delay, never immediately. */
export class JulebRateLimitError extends JulebError {
  readonly retryable = true;

  constructor(
    operation: string,
    readonly retryAfterSeconds: number | null,
  ) {
    super(`Juleb rate limit hit during ${operation}()`);
    this.name = 'JulebRateLimitError';
  }
}

/**
 * A payload failed schema validation.
 *
 * Not retryable: the same request returns the same bad shape. This surfaces an
 * upstream schema change as a clean, attributable error instead of a crash deep
 * in the UI (§8.3).
 */
export class JulebSchemaError extends JulebError {
  readonly retryable = false;

  constructor(
    operation: string,
    readonly detail: string,
  ) {
    super(`Juleb returned an unexpected payload shape for ${operation}(): ${detail}`);
    this.name = 'JulebSchemaError';
  }
}

/**
 * Juleb refused the order because stock moved. A normal, expected path (§3.7),
 * not an exception case — our stock figures are a stale projection.
 */
export class JulebStockError extends JulebError {
  readonly retryable = false;

  constructor(readonly shortfalls: readonly { julebProductId: string; requested: number; available: number }[]) {
    super(`Juleb rejected the order: ${shortfalls.length} line(s) short of stock`);
    this.name = 'JulebStockError';
  }
}

/** Juleb has no record of the referenced entity. Not retryable. */
export class JulebNotFoundError extends JulebError {
  readonly retryable = false;

  constructor(entity: string, id: string) {
    super(`Juleb has no ${entity} with id "${id}"`);
    this.name = 'JulebNotFoundError';
  }
}
