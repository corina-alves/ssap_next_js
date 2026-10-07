import type { Metadata } from 'next';
import { NotaConjunta } from '@/components/site/nota-conjunta';
import html from '@/conteudo/nota-conjunta-armazenamento';

export const metadata: Metadata = {
  title: 'Nota Informativa — Armazenamento do Cantareira',
  description: 'Situação de armazenamento do Sistema Cantareira e medidas de restrição.',
};

export default function Pagina() {
  return (
    <NotaConjunta
      titulo="Nota Informativa Conjunta"
      assunto="Avaliação da situação atual de armazenamento do Sistema Cantareira e recomendação para a manutenção das medidas de restrição vigentes."
      edicao="Edição de 9 de março de 2026"
      processo="Processo SEI 137.00013614/2025-72"
      pdf="/legado/nota_tecnica_spaguas_arsesp/SEI_0100243788_Informacao.pdf"
      html={html}
    />
  );
}
