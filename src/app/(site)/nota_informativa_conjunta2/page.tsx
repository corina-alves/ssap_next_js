import type { Metadata } from 'next';
import { NotaConjunta } from '@/components/site/nota-conjunta';
import html from '@/conteudo/nota-conjunta-projecoes';

export const metadata: Metadata = {
  title: 'Nota Informativa — Metodologia de Projeções',
  description: 'Metodologia de projeções hidrológicas do Comitê de Integração.',
};

export default function Pagina() {
  return (
    <NotaConjunta
      titulo="Nota Informativa Conjunta"
      assunto="Metodologia de projeções hidrológicas e de ações de gestão da demanda."
      edicao="Edição de 23 de setembro de 2025"
      pdf="/legado/nota_tecnica_spaguas_arsesp/NotaInformativaConjuntaProjecoessComitedeIntegracao.pdf"
      html={html}
    />
  );
}
