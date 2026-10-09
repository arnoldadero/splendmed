export type { JulebClient } from './port';
export * from './errors';
export { MockJulebClient, type MockJulebOptions } from './drivers/mock';
export { HttpJulebClient } from './drivers/http';
export { getJulebClient, setJulebClientForTesting, parseDriverName } from './factory';
export type { JulebDriverName } from './factory';

/*
 * Wire types and mappers are intentionally NOT exported.
 *
 * §8.3: Juleb shapes stay inside this package. If something outside needs a
 * Juleb* type, the boundary has leaked and the domain model is missing something
 * instead.
 */
