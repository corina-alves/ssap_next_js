import Image from 'next/image';
import Link from 'next/link';
import '@/styles/legado/pagina-nota-conjunta.css';

/**
 * Página de uma Nota Informativa Conjunta SP-Águas/ARSESP: cabeçalho com os
 * dados do documento e o PDF, e o texto em coluna de leitura centralizada.
 * `html` é conteúdo fixo nosso (src/conteudo/nota-conjunta-*.ts), nunca dado
 * digitado por usuário — por isso pode ser inserido direto.
 */
export function NotaConjunta({
  titulo,
  assunto,
  edicao,
  processo,
  pdf,
  html,
}: {
  titulo: string;
  assunto: string;
  edicao: string;
  processo?: string;
  /** Caminho do PDF assinado, em public/. */
  pdf: string;
  html: string;
}) {
  return (
    <>
      <section className="sssp-page-hero">
        <div className="container">
          <div className="nota-hero">
            <div className="sssp-page-hero__inner">
              <div className="sssp-breadcrumb">
                <Link href="/">Início</Link>
                <i className="bi bi-chevron-right" />
                <Link href="/nota_informativa">Notas informativas</Link>
                <i className="bi bi-chevron-right" />
                <span>{titulo}</span>
              </div>
              <span className="sssp-page-kicker">
                <i className="bi bi-file-earmark-text" />
                Documentos técnicos
              </span>
              <h1>{titulo}</h1>
              <p>{assunto}</p>
              <ul className="nota-hero__dados">
                <li>
                  <i className="bi bi-calendar3" /> {edicao}
                </li>
                {processo && (
                  <li>
                    <i className="bi bi-hash" /> {processo}
                  </li>
                )}
                <li>
                  <i className="bi bi-pen" /> Assinado digitalmente
                </li>
              </ul>
            </div>
            <div className="nota-hero__cartao">
              <Image src="/legado/logo/logo_arsesp.svg" alt="ARSESP" width={120} height={64} unoptimized />
              <strong>Portaria Conjunta ARSESP – SP-Águas nº 01/2025</strong>
              <span>Comitê de Integração das Agências para a Segurança Hídrica</span>
              <a className="btn btn-primary" href={pdf} target="_blank" rel="noopener">
                <i className="bi bi-file-earmark-pdf me-1" /> Baixar PDF
              </a>
            </div>
          </div>
        </div>
      </section>

      <main className="sssp-main">
        <div className="container">
          <article className="sssp-section-card nota-texto">
            <div className="sssp-section-card__body" dangerouslySetInnerHTML={{ __html: html }} />
          </article>
        </div>
      </main>
    </>
  );
}
