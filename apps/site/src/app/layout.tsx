import { vi } from '@erpchess/i18n';
import type { Metadata } from 'next';
import { Roboto } from 'next/font/google';
import type { ReactNode } from 'react';
import './globals.css';

const roboto = Roboto({
  subsets: ['latin', 'vietnamese'],
  weight: ['300', '400', '500', '700', '900'],
  variable: '--font-roboto',
});

export const metadata: Metadata = {
  title: vi.app.name,
  description: vi.app.tagline,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="vi" className={roboto.variable}>
      <body>{children}</body>
    </html>
  );
}
