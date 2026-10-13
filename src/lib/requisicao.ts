import 'server-only';
import { headers } from 'next/headers';
import { env } from './env';
import { origemIp } from './origem';

export type Origem = { ip: string; userAgent: string | null };

/**
 * IP e navegador da requisição atual.
 *
 * O Next preenche X-Forwarded-For com o IP da conexão só quando o cliente não
 * envia o cabeçalho. Por isso:
 *  - TRUST_PROXY=true (atrás de IIS/nginx que acrescenta o IP real): usa a
 *    última entrada, que é a do proxy confiável;
 *  - TRUST_PROXY=false: não confia no cabeçalho informado pelo cliente;
 *    registra IP desconhecido e mantém o bloqueio por conta.
 */
export async function origemRequisicao(): Promise<Origem> {
  const h = await headers();
  const ip = origemIp(h, env().TRUST_PROXY);
  const ua = h.get('user-agent');
  return { ip, userAgent: ua ? ua.slice(0, 255) : null };
}

/**
 * Endereço público da aplicação, para montar links absolutos: APP_URL ou, sem
 * ela (somente em desenvolvimento), a origem da requisição. Cabeçalhos
 * encaminhados só são aceitos quando o proxy é explicitamente confiável.
 */
export function enderecoPublico(req: Request): string {
  const fixo = env().APP_URL;
  if (fixo) return fixo.replace(/\/$/, '');
  const origem = new URL(req.url).origin;
  if (!env().TRUST_PROXY) return origem;
  const h = req.headers;
  const host = h.get('x-forwarded-host') ?? h.get('host');
  const proto = h.get('x-forwarded-proto');
  if (!host || !['http', 'https'].includes(proto ?? '') || !/^[A-Za-z0-9.\-\[\]:]+$/.test(host)) return origem;
  try { return new URL(`${proto}://${host}`).origin; } catch { return origem; }
}
