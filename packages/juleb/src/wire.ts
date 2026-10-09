import { z } from 'zod';

/*
 * PROVISIONAL wire schemas.
 *
 * Read this before changing anything here.
 *
 * Juleb publishes no API specification, so these shapes are NOT Juleb's contract.
 * They are a placeholder the mock driver serves and the mapper consumes, so that
 * every layer above can be built and tested today. They will be wrong in detail.
 *
 * This does not violate §3.1. That guardrail forbids inventing an *endpoint* — a
 * URL, method, or auth flow we would actually call, because calling a fabricated
 * endpoint fails at integration time. Defining a local shape for our own fixtures
 * is a necessary stand-in, and it is confined to this file plus mappers.ts. When
 * the real spec arrives, these schemas are rewritten from captured payloads
 * (swap-in checklist step 2) and nothing outside this package changes.
 *
 * Field naming here deliberately uses snake_case to stay visually distinct from
 * our camelCase domain types — so a Juleb shape leaking past the mapper is
 * obvious on sight.
 */

export const julebMoneySchema = z.object({
  /** Decimal string, not a float — the usual way a money value crosses JSON. */
  amount: z.string().regex(/^-?\d+(\.\d{1,4})?$/, 'expected a decimal amount string'),
  currency: z.string().length(3),
});

export const julebProductSchema = z.object({
  id: z.string().min(1),
  sku: z.string().min(1).nullable().optional(),
  name: z.string().min(1),
  generic_name: z.string().nullable().optional(),
  brand: z.object({ id: z.string(), name: z.string() }).nullable().optional(),
  form: z.string().nullable().optional(),
  strength: z.string().nullable().optional(),
  pack_size: z.string().nullable().optional(),
  unit_of_sale: z.string().nullable().optional(),
  /**
   * The §3.2 safety gate depends on this. Treated as required with no default:
   * if Juleb cannot tell us a product is prescription-only, we must fail loudly
   * rather than quietly assume it is over-the-counter.
   */
  dispensing_class: z.string().min(1),
  price: julebMoneySchema,
  compare_at_price: julebMoneySchema.nullable().optional(),
  vat_rate: z.number().min(0).max(1).nullable().optional(),
  image_url: z.string().nullable().optional(),
  category_ids: z.array(z.string()).nullable().optional(),
  condition_ids: z.array(z.string()).nullable().optional(),
  is_active: z.boolean().nullable().optional(),
  updated_at: z.string().min(1),
});

export const julebStockLevelSchema = z.object({
  branch_id: z.string().min(1),
  product_id: z.string().min(1),
  quantity_available: z.number().int(),
  as_of: z.string().min(1),
});

export const julebBranchSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  county: z.string().nullable().optional(),
  ppb_licence_no: z.string().nullable().optional(),
  pharmacist_in_charge: z.string().nullable().optional(),
  is_active: z.boolean().nullable().optional(),
});

export const julebOrderRefSchema = z.object({
  id: z.string().min(1),
  status: z.string().min(1),
});

export const julebStockShortfallSchema = z.object({
  product_id: z.string().min(1),
  requested: z.number().int(),
  available: z.number().int(),
});

/** Cursor pagination. Style is an open question for Juleb (see their Q14). */
export function julebPageSchema<T extends z.ZodTypeAny>(item: T) {
  return z.object({
    data: z.array(item),
    next_cursor: z.string().nullable().optional(),
  });
}

export type JulebProduct = z.infer<typeof julebProductSchema>;
export type JulebStockLevel = z.infer<typeof julebStockLevelSchema>;
export type JulebBranch = z.infer<typeof julebBranchSchema>;
export type JulebOrderRef = z.infer<typeof julebOrderRefSchema>;
export type JulebMoney = z.infer<typeof julebMoneySchema>;

export interface JulebPage<T> {
  readonly data: readonly T[];
  readonly nextCursor: string | null;
}
