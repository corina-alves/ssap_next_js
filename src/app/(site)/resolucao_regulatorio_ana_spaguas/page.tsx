import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import '@/styles/legado/pagina-resolucao-ana-daee.css';
import { DISPOSITIVOS, PREAMBULO } from '@/conteudo/resolucao-ana-daee-925';

export const metadata: Metadata = {
  title: 'Resolução Conjunta ANA/DAEE nº 925/2017 — Cantareira',
  description: 'Condições de operação do Sistema Cantareira.',
};

/** Faixas de operação e limites de retirada na Elevatória Santa Inês (art. 4º, caput e § 1º). */
const FAIXAS = [
  { n: 1, nome: 'Normal', volume: '≥ 60%', limite: '33,0' },
  { n: 2, nome: 'Atenção', volume: '≥ 40% e < 60%', limite: '31,0' },
  { n: 3, nome: 'Alerta', volume: '≥ 30% e < 40%', limite: '27,0' },
  { n: 4, nome: 'Restrição', volume: '≥ 20% e < 30%', limite: '23,0' },
  { n: 5, nome: 'Especial', volume: '< 20%', limite: '15,5' },
];

/** Assunto de cada artigo, só para o índice lateral (não faz parte do texto oficial). */
const ASSUNTOS: Record<number, string> = {
  1: 'Sistema e volume útil',
  2: 'Vazões mínimas',
  3: 'Períodos hidrológicos',
  4: 'Faixas e retirada para a RMSP',
  5: 'Vazões para as Bacias PCJ',
  6: 'Definição mensal da faixa',
  7: 'Validade',
  8: 'Revogação',
  9: 'Vigência',
};

const ROTULO = /^(Art\. \d+º|§ \d+[º.]|Parágrafo único\.|[IVX]+ -) /;

type Artigo = { numero: number; itens: string[] };

/** Agrupa os dispositivos por artigo ("Art. Nº" abre um grupo). */
function artigos(): Artigo[] {
  const lista: Artigo[] = [];
  for (const t of DISPOSITIVOS) {
    const m = /^Art\. (\d+)º /.exec(t);
    if (m) lista.push({ numero: Number(m[1]), itens: [t] });
    else lista.at(-1)?.itens.push(t);
  }
  return lista;
}

function Dispositivo({ texto }: { texto: string }) {
  const rotulo = ROTULO.exec(texto)?.[1] ?? '';
  const tipo = rotulo.startsWith('Art.') ? 'artigo' : /^[IVX]/.test(rotulo) ? 'inciso' : 'paragrafo';
  return (
    <p className={`res-${tipo}`}>
      <strong>{rotulo}</strong>
      {texto.slice(rotulo.length)}
    </p>
  );
}

export default function Pagina() {
  const lista = artigos();
  return (
    <>
      <section className="sssp-page-hero">
        <div className="container">
          <div className="res-hero">
            <div className="sssp-page-hero__inner">
              <div className="sssp-breadcrumb">
                <Link href="/">Início</Link>
                <i className="bi bi-chevron-right" />
                <Link href="/documentos">Documentos</Link>
                <i className="bi bi-chevron-right" />
                <span>Resolução ANA/DAEE nº 925/2017</span>
              </div>
              <span className="sssp-page-kicker">
                <i className="bi bi-file-text" />
                Regulação do Sistema Cantareira
              </span>
              <h1>Resolução Conjunta ANA/DAEE nº 925, de 29 de maio de 2017</h1>
              <p>
                Dispõe sobre as condições de operação para o Sistema Cantareira - SC, delimitado, para fins desta resolução, como o conjunto dos reservatórios
                Jaguari-Jacareí, Cachoeira, Atibainha e Paiva Castro.
              </p>
              <ul className="res-hero__dados">
                <li>
                  <i className="bi bi-calendar3" /> Publicada em 31 de maio de 2017
                </li>
                <li>
                  <i className="bi bi-bank" /> Poder Executivo · Seção I
                </li>
                <li>
                  <i className="bi bi-hash" /> Documento nº 00000.031749/2017-55
                </li>
              </ul>
            </div>
            <div className="res-hero__orgaos">
              <Image src="/legado/logo/ana.png" alt="Agência Nacional de Águas (ANA)" width={176} height={50} />
              <Image src="/legado/logo/daee.png" alt="Departamento de Águas e Energia Elétrica (DAEE)" width={60} height={72} />
            </div>
          </div>
        </div>
      </section>

      <main className="sssp-main">
        <div className="container">
          <div className="res-grade">
            <aside className="res-indice">
              <nav className="sssp-section-card" aria-label="Índice da resolução">
                <div className="sssp-section-card__body">
                  <h2>Nesta página</h2>
                  <ol>
                    <li>
                      <a href="#faixas">Faixas de operação</a>
                    </li>
                    <li>
                      <a href="#preambulo">Preâmbulo</a>
                    </li>
                    {lista.map((a) => (
                      <li key={a.numero}>
                        <a href={`#art-${a.numero}`}>
                          <strong>Art. {a.numero}º</strong> {ASSUNTOS[a.numero]}
                        </a>
                      </li>
                    ))}
                  </ol>
                </div>
              </nav>
            </aside>

            <div className="res-conteudo">
              <section className="sssp-section-card" id="faixas">
                <div className="sssp-section-card__head">
                  <div className="sssp-section-card__title">
                    <span>
                      <i className="bi bi-bar-chart-steps" />
                    </span>
                    <div>
                      <h2>Faixas de operação</h2>
                      <p>Resumo do art. 4º: volume útil acumulado e limite máximo médio mensal de retirada na Elevatória Santa Inês.</p>
                    </div>
                  </div>
                </div>
                <div className="sssp-section-card__body">
                  <div className="res-faixas">
                    {FAIXAS.map((f) => (
                      <div key={f.n} className={`res-faixa res-faixa--${f.n}`}>
                        <small>Faixa {f.n}</small>
                        <strong>{f.nome}</strong>
                        <span>{f.volume}</span>
                        <b>
                          {f.limite} <em>m³/s</em>
                        </b>
                      </div>
                    ))}
                  </div>
                </div>
              </section>

              <article className="sssp-section-card res-texto">
                <div className="sssp-section-card__body">
                  <section id="preambulo">
                    {PREAMBULO.map((t) => (
                      <p key={t}>{t}</p>
                    ))}
                  </section>

                  <h2 className="res-resolvem">Resolvem:</h2>

                  {lista.map((a) => (
                    <section key={a.numero} id={`art-${a.numero}`}>
                      {a.itens.map((t) => (
                        <div key={t}>
                          <Dispositivo texto={t} />
                          {t.endsWith('conforme quadro a seguir:') && (
                            <figure className="res-quadro">
                              <Image
                                src="/legado/img/Anexo925a.jpg"
                                alt="Quadro com as cotas e os volumes mínimos e máximos operacionais e o volume útil de cada reservatório do Sistema Cantareira"
                                width={709}
                                height={180}
                              />
                            </figure>
                          )}
                        </div>
                      ))}
                    </section>
                  ))}

                  <div className="res-assinaturas">
                    <p>
                      <strong>Vicente Andreu</strong>
                      Diretor-Presidente da ANA
                    </p>
                    <p>
                      <strong>Ricardo Daruiz Borsari</strong>
                      Superintendente do DAEE
                    </p>
                  </div>
                </div>
              </article>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
