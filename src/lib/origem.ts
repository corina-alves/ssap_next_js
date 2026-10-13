import { isIP } from 'node:net';

type Cabecalhos = { get(nome: string): string | null };

/** O último IP só é confiável quando o proxy controlado acrescenta/sobrescreve XFF. */
export function origemIp(cabecalhos: Cabecalhos, confiarProxy: boolean): string {
  // O Next preserva XFF informado pelo cliente: sem proxy, ele não prova o IP.
  if (!confiarProxy) return '0.0.0.0';
  const bruto = cabecalhos.get('x-forwarded-for')?.split(',').at(-1)?.trim() ?? '';
  const ip = bruto.startsWith('::ffff:') ? bruto.slice(7) : bruto;
  return isIP(ip) ? ip : '0.0.0.0';
}
