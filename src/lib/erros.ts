/** Mensagens aprovadas para exibição pelo operador; nunca dados do driver. */
export class ErroOperacional extends Error {}

/** Apenas o código técnico, sem message/detail/stack, que podem conter segredos. */
export function codigoErro(erro: unknown): string {
  if (erro && typeof erro === 'object' && 'code' in erro && typeof erro.code === 'string' && /^[A-Z0-9_]{2,40}$/.test(erro.code)) {
    return erro.code;
  }
  return 'ERRO_INTERNO';
}

export function erroParaOperador(erro: unknown): string {
  return erro instanceof ErroOperacional
    ? erro.message
    : `A operação falhou (${codigoErro(erro)}). Verifique a configuração e a disponibilidade do banco/armazenamento.`;
}
