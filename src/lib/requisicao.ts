import 'server-only';
import { isIP } from 'node:net';
import { headers } from 'next/headers';
import { env } from './env';

export type Origem = { ip: string; userAgent: string | null };

/**
 * IP e navegador da requisição atual.
 *
 * O Next preenche X-Forwarded-For com o IP da conexão só quando o cliente não
 * envia o cabeçalho. Por isso:
 *  - TRUST_PROXY=true (atrás de IIS/nginx que acrescenta o IP real): usa a
 *    última entrada, que é a do proxy confiável;
 *  - TRUST_PROXY=false: usa a primeira entrada, que pode ter sido forjada
 *    pelo cliente. O bloqueio por IP vira "melhor esforço"; o bloqueio por
 *    conta continua valendo.
 */
export async function origemRequisicao(): Promise<Origem> {
  const h = await headers();
  const partes = (h.get('x-forwarded-for') ?? '')
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean);
  const bruto = (env().TRUST_PROXY ? partes.at(-1) : partes[0]) ?? '';
  const ip = normalizarIp(bruto);
  const ua = h.get('user-agent');
  return { ip, userAgent: ua ? ua.slice(0, 255) : null };
}

function normalizarIp(v: string): string {
  const semPrefixo = v.startsWith('::ffff:') ? v.slice(7) : v;
  return isIP(semPrefixo) ? semPrefixo : '0.0.0.0';
}
