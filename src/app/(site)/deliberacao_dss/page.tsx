import type { Metadata } from 'next';
import '@/styles/legado/antigo-estilo.css';
import '@/styles/legado/antigo-protocolo_escassez.css';
import { ConteudoLegado } from '@/components/site/conteudo-legado';
import html from '@/conteudo/legado/deliberacao_dss';

export const metadata: Metadata = {
  title: 'Deliberação CRH nº 287/2024',
  description: 'Reorganiza a Sala de Situação São Paulo e dá outras providências.',
};

// Texto fixo, igual ao de deliberacao_dss.php (veja scripts/capturar-legado.mjs).
export default function Pagina() {
  return <ConteudoLegado html={html} antigo />;
}
