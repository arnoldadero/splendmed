import { Logo } from '@/components/logo';
import { BRAND_VALUES } from '@/lib/brand';

/*
 * Phase 0 landing page. Its job is to prove the brand system renders correctly
 * end to end — palette, Archivo, and the Logo component with enforced clear space.
 * The real storefront (catalog, search, cart) arrives in Phase 3; the catalog is a
 * projection of Juleb and cannot be built before the sync exists.
 */

const VALUE_BLURBS: Record<(typeof BRAND_VALUES)[number], string> = {
  Trust: 'Reliable quality in every product and every interaction.',
  Professionalism: 'Expert care and high standards, consistently applied.',
  Compassion: 'Health is a shared journey. We treat it that way.',
  Wellness: 'Care that goes beyond medication to overall well-being.',
  Innovation: 'Modern solutions that widen access to healthcare.',
};

export default function HomePage() {
  return (
    <main className="min-h-screen">
      <header className="border-b border-border">
        <nav
          className="mx-auto flex max-w-6xl items-center justify-between px-4 py-2"
          aria-label="Primary"
        >
          <Logo variant="primary" height={36} priority />
          <span className="text-sm font-medium text-muted-foreground">Kisumu, Kenya</span>
        </nav>
      </header>

      {/* Named so it does not surface as an unlabelled region landmark (§12). */}
      <section
        className="mx-auto max-w-6xl px-10 py-20 sm:py-28"
        aria-labelledby="hero-heading"
      >
        <p className="text-sm font-semibold uppercase tracking-widest text-brand-teal">
          Pharmacy &amp; wellness
        </p>
        <h1
          id="hero-heading"
          className="mt-4 max-w-3xl text-4xl font-bold leading-tight text-balance sm:text-6xl"
        >
          Trusted medication, and care that looks after the whole person.
        </h1>
        <p className="mt-6 max-w-2xl text-lg text-muted-foreground">
          Founded in Kisumu with a simple mission: quality medication and exceptional care. Order
          what you need, upload a prescription, and have it checked by a licensed pharmacist before
          it ever leaves our counter.
        </p>

        <div className="mt-10 flex flex-wrap gap-3">
          <span className="rounded-full bg-primary px-5 py-2.5 font-semibold text-primary-foreground">
            Storefront arrives in Phase 3
          </span>
          <span className="rounded-full border border-border px-5 py-2.5 font-semibold">
            Pharmacist review in Phase 6
          </span>
        </div>
      </section>

      <section
        className="border-t border-border bg-secondary"
        aria-labelledby="values-heading"
      >
        <div className="mx-auto max-w-6xl px-10 py-16">
          <h2 id="values-heading" className="text-2xl font-bold">
            What we stand for
          </h2>
          <ul className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {BRAND_VALUES.map((value) => (
              <li key={value} className="rounded-xl bg-card p-6">
                <h3 className="font-semibold text-brand-teal">{value}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{VALUE_BLURBS[value]}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <footer className="border-t border-border">
        <div className="mx-auto max-w-6xl px-10 py-10 text-sm text-muted-foreground">
          <p>
            Prescription-only medicines are dispensed only against a valid prescription verified by
            a pharmacist registered with the Pharmacy and Poisons Board.
          </p>
          <p className="mt-2">&copy; {new Date().getFullYear()} SplendMed Pharmacy</p>
        </div>
      </footer>
    </main>
  );
}
