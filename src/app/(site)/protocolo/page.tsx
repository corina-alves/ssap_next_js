import type { Metadata } from 'next';
import '@/styles/legado/antigo-estilo.css';
import '@/styles/legado/antigo-protocolo_escassez.css';
import { ConteudoLegado } from '@/components/site/conteudo-legado';
import html from '@/conteudo/legado/protocolo';

export const metadata: Metadata = {
  title: 'Deliberação SP-Águas nº 10/2025',
  description: 'Experimento Regulatório para implementação do Protocolo de Escassez Hídrica.',
};

// Texto fixo, igual ao de protocolo.php (veja scripts/capturar-legado.mjs).
export default function Pagina() {
  return <ConteudoLegado html={html} antigo />;
}
