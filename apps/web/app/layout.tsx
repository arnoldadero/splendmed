import type { Metadata, Viewport } from 'next';
import { Archivo } from 'next/font/google';

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
      <body>{children}</body>
    </html>
  );
}
