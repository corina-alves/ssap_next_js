import { comBasePath } from '../base-path';

/** Links sensíveis usam a URL configurada; nunca Host/X-Forwarded-Host do cliente. */
export function montarLinkSenha(base: string, token: string): string {
  if (!/^[0-9a-f]{64}$/i.test(token)) throw new Error('Token de redefinição inválido.');
  const url = new URL(comBasePath('/acesso/redefinir-senha'), base);
  url.searchParams.set('token', token);
  return url.toString();
}
