import type { Metadata, Viewport } from 'next';
import { Archivo } from 'next/font/google';

import { SiteHeader } from '@/components/site-header';

import './globals.css';

/*
 * Archivo is the official brand typeface (§6). display: 'swap' keeps text visible
 * during font load, which matters on the mid-range Android / 3G target in §12.
 */
const archivo = Archivo({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-archivo',
});

export const metadata: Metadata = {
  title: {
    default: 'SplendMed Pharmacy — Trusted medication and wellness care',
    template: '%s · SplendMed Pharmacy',
  },
  description:
    'SplendMed Pharmacy in Kisumu blends trusted medication with holistic wellness care. Order medication, upload a prescription, and have it reviewed by a licensed pharmacist.',
  applicationName: 'SplendMed',
  icons: { icon: '/brand/icon.png' },
};

export const viewport: Viewport = {
  themeColor: '#01B1AF',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={archivo.variable}>
      <body>
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-primary focus:px-3 focus:py-2 focus:text-primary-foreground"
        >
          Skip to content
        </a>
        <SiteHeader />
        <main id="main">{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}

/*
 * The compliance line is not boilerplate. MyDawa claims to be the most trusted
 * online pharmacy and shows no licence to back it; we go the other way and name
 * the regulator we answer to (§11, and the ux-reference note on trust claims).
 * The licence number itself is a placeholder until the real one is supplied.
 */
function SiteFooter() {
  return (
    <footer className="mt-16 border-t border-border">
      <div className="mx-auto max-w-6xl px-4 py-10 text-sm text-muted-foreground">
        <p className="max-w-3xl">
          Prescription-only medicines are dispensed only against a valid prescription verified by a
          pharmacist registered with the Pharmacy and Poisons Board of Kenya. We do not provide
          dosage or treatment advice online — speak to our pharmacist.
        </p>
        <p className="mt-3">SplendMed Pharmacy · Kisumu, Kenya</p>
        <p className="mt-1">&copy; {new Date().getFullYear()} SplendMed Pharmacy</p>
      </div>
    </footer>
  );
}
