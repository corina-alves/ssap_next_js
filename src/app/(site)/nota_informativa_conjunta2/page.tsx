import type { Metadata } from 'next';
import '@/styles/legado/antigo-estilo.css';
import '@/styles/legado/antigo-protocolo_escassez.css';
import { ConteudoLegado } from '@/components/site/conteudo-legado';
import html from '@/conteudo/legado/nota_informativa_conjunta2';

export const metadata: Metadata = {
  title: 'Nota Informativa — Metodologia de Projeções',
  description: 'Metodologia de projeções hidrológicas do Comitê de Integração.',
};

// Texto fixo, igual ao de nota_informativa_conjunta2.php (veja scripts/capturar-legado.mjs).
export default function Pagina() {
  return <ConteudoLegado html={html} antigo />;
}
