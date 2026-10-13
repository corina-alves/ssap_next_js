import type { ReactNode } from 'react';

/**
 * Aviso de carregamento com as três cores do logo da SP Águas (estilos em
 * globals.css). `pagina`: versão grande, para a troca de página (loading.tsx);
 * `linha`: versão pequena, ao lado de um rótulo.
 */
export function Carregando({ children = 'Carregando…', pagina = false, linha = false, className = '' }: { children?: ReactNode; pagina?: boolean; linha?: boolean; className?: string }) {
  const Caixa = linha ? 'span' : 'div';
  return (
    <Caixa className={`spa-carregando ${pagina ? 'spa-carregando--pagina' : ''} ${linha ? 'spa-carregando--linha' : ''} ${className}`.trim()} role="status" aria-live="polite">
      <span className="spa-spinner" aria-hidden>
        <i />
        <i />
        <i />
      </span>
      <span className="spa-carregando__texto">{children}</span>
    </Caixa>
  );
}
