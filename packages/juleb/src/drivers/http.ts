import type { Branch, OrderDraft, OrderRef, Product, StockLevel } from '@splendmed/domain';

import { JulebSpecUnavailableError } from '../errors';
import type { JulebClient } from '../port';

/**
 * Real Juleb transport. Not implemented, by design.
 *
 * Guardrail §3.1: Juleb publishes no API specification. Every method below throws
 * rather than issuing a fabricated request, because a guessed endpoint produces
 * code that compiles, reads convincingly, passes review, and is entirely fictional
 * — discovered only at integration time.
 *
 * Deliberately thin. Retry policy, circuit breaking and request logging are all
 * described in §8.2, but building them now would mean guessing at error shapes,
 * rate-limit headers and idempotency semantics we have not been told. They are
 * written alongside the first real method, against captured sandbox payloads.
 *
 * To implement: follow the swap-in checklist in docs/integrations/juleb.md. The
 * contract test suite that the mock already satisfies is the acceptance criteria.
 */
export class HttpJulebClient implements JulebClient {
  readonly name = 'http' as const;

  /**
   * Config is read and validated here so the env contract is discoverable, even
   * though nothing uses it yet. Absence is not an error at construction time: the
   * driver is unusable regardless until the spec lands.
   */
  constructor(
    private readonly config: {
      baseUrl: string | undefined;
      clientId: string | undefined;
      clientSecret: string | undefined;
    } = {
      baseUrl: process.env.JULEB_BASE_URL,
      clientId: process.env.JULEB_CLIENT_ID,
      clientSecret: process.env.JULEB_CLIENT_SECRET,
    },
  ) {}

  /** True once credentials are present. Shown in the admin sync-health view. */
  get isConfigured(): boolean {
    return Boolean(this.config.baseUrl && this.config.clientId && this.config.clientSecret);
  }

  listBranches(): Promise<readonly Branch[]> {
    throw new JulebSpecUnavailableError('listBranches');
  }

  listProducts(): Promise<{ products: readonly Product[]; nextCursor: string | null }> {
    throw new JulebSpecUnavailableError('listProducts');
  }

  getStock(): Promise<readonly StockLevel[]> {
    throw new JulebSpecUnavailableError('getStock');
  }

  createOrder(_draft: OrderDraft): Promise<OrderRef> {
    throw new JulebSpecUnavailableError('createOrder');
  }

  getOrder(_julebOrderId: string): Promise<OrderRef> {
    throw new JulebSpecUnavailableError('getOrder');
  }

  cancelOrder(_julebOrderId: string, _reason: string): Promise<void> {
    throw new JulebSpecUnavailableError('cancelOrder');
  }
}
