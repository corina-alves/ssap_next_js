import Link from 'next/link';
import type { CSSProperties, ReactNode } from 'react';

/** Peças de página da área /acesso — mesmas classes dos partials do PHP. */

/** Cor de destaque da sala (no PHP vinha de estilo-salas.php, como .sala-<id>). */
export const corSala = (cor: string | null) => (cor ? ({ '--sala-cor': cor } as CSSProperties) : undefined);

/** Cabeçalho de página: trilha, título, subtítulo e botões (partials/cabecalho.php). */
export function Cabecalho({
  titulo,
  subtitulo,
  trilha,
  acoes,
}: {
  titulo: string;
  subtitulo?: string;
  /** [rótulo, endereço]; o último item (página atual) vai sem endereço. */
  trilha?: [string, string | null][];
  acoes?: ReactNode;
}) {
  return (
    <div className="acesso-cabecalho">
      <div>
        {trilha && (
          <nav aria-label="Trilha">
            <ol className="breadcrumb small mb-1">
              {trilha.map(([rotulo, href]) =>
                href ? (
                  <li key={rotulo} className="breadcrumb-item">
                    <Link href={href}>{rotulo}</Link>
                  </li>
                ) : (
                  <li key={rotulo} className="breadcrumb-item active" aria-current="page">
                    {rotulo}
                  </li>
                ),
              )}
            </ol>
          </nav>
        )}
        <h1 className="h4 mb-0">{titulo}</h1>
        {subtitulo && <p className="text-secondary small mb-0 mt-1">{subtitulo}</p>}
      </div>
      {acoes && <div className="acesso-cabecalho__acoes">{acoes}</div>}
    </div>
  );
}

const ALERTA = {
  sucesso: ['success', 'check-circle'],
  erro: ['danger', 'exclamation-octagon'],
  aviso: ['warning', 'exclamation-triangle'],
  info: ['info', 'info-circle'],
} as const;

/** Mensagem no padrão de partials/mensagens.php. */
export function Mensagem({ tipo, children }: { tipo: keyof typeof ALERTA; children: ReactNode }) {
  const [classe, icone] = ALERTA[tipo];
  return (
    <div className={`alert alert-${classe} d-flex gap-2 align-items-start`} role={tipo === 'erro' ? 'alert' : 'status'}>
      <i className={`bi bi-${icone} flex-shrink-0`} />
      <div>{children}</div>
    </div>
  );
}

/** Telas sem sessão (login, senha): cartão centralizado (templates/auth_inicio.php). */
export function MolduraAuth({ children }: { children: ReactNode }) {
  return (
    <div className="acesso-auth">
      <main className="acesso-auth__wrap">
        <div className="acesso-auth__marca">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/acesso/img/spaguas_white.png" alt="SP-Águas" className="acesso-auth__logo" />
          <div>
            <strong>Salas de Situação</strong>
            <span>Área administrativa</span>
          </div>
        </div>
        <div className="acesso-auth__card">{children}</div>
        <p className="acesso-auth__rodape">SP-Águas · Agência de Águas do Estado de São Paulo</p>
      </main>
    </div>
  );
}
