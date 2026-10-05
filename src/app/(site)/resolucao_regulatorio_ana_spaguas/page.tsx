import type { Metadata } from 'next';
import '@/styles/legado/antigo-estilo.css';
import '@/styles/legado/antigo-resolucao_ana_daee.css';
import { ConteudoLegado } from '@/components/site/conteudo-legado';
import html from '@/conteudo/legado/resolucao_regulatorio_ana_spaguas';

export const metadata: Metadata = {
  title: 'Resolução Conjunta ANA/DAEE nº 925/2017 — Cantareira',
  description: 'Condições de operação do Sistema Cantareira.',
};

// Texto fixo, igual ao de resolucao_regulatorio_ana_spaguas.php (veja scripts/capturar-legado.mjs).
export default function Pagina() {
  return <ConteudoLegado html={html} antigo />;
}
