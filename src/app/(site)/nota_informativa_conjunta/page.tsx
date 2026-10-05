import type { Metadata } from 'next';
import '@/styles/legado/antigo-estilo.css';
import '@/styles/legado/antigo-protocolo_escassez.css';
import { ConteudoLegado } from '@/components/site/conteudo-legado';
import html from '@/conteudo/legado/nota_informativa_conjunta';

export const metadata: Metadata = {
  title: 'Nota Informativa — Armazenamento do Cantareira',
  description: 'Situação de armazenamento do Sistema Cantareira e medidas de restrição.',
};

// Texto fixo, igual ao de nota_informativa_conjunta.php (veja scripts/capturar-legado.mjs).
export default function Pagina() {
  return <ConteudoLegado html={html} antigo />;
}
