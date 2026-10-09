import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './globals.css';

export const metadata: Metadata = {
<<<<<<< HEAD
  title: { default: 'Sala de Situação Alfredo Pisani', template: '%s · Sala de Situação Alfredo Pisani' },
=======
  title: { default: 'Sala de Situação Alfredo Pisani - SP-Águas', template: '%s · Sala de Situação Alfredo Pisani - SP-Águas' },
>>>>>>> 304185b (alterações em title, defesa civil...)
  description: 'Monitoramento hidrológico do Estado de São Paulo — SP Águas.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR" data-scroll-behavior="smooth">
      <body>{children}</body>
    </html>
  );
}
