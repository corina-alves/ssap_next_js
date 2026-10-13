import { NextResponse, type NextRequest } from 'next/server';

const METODOS_SEGUROS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Proteção CSRF das rotas /api de escrita: o Origin precisa ser o próprio
 * site. Em produção a origem vem de APP_URL, sem depender de headers enviados
 * pelo cliente. (As Server Actions já fazem essa checagem sozinhas; o cookie de sessão
 * é SameSite=Strict.) A autorização de verdade fica em cada rota.
 */
export function proxy(req: NextRequest) {
  if (METODOS_SEGUROS.has(req.method)) return NextResponse.next();

  const origin = req.headers.get('origin');
  let mesmaOrigem = false;
  try {
    const origemEsperada = process.env.NODE_ENV === 'production'
      ? new URL(process.env.APP_URL ?? '').origin
      : req.nextUrl.origin;
    mesmaOrigem = origin !== null && new URL(origin).origin === origemEsperada;
  } catch {
    mesmaOrigem = false;
  }
  if (!mesmaOrigem) {
    return NextResponse.json({ erro: 'Origem da requisição não permitida.' }, { status: 403 });
  }
  return NextResponse.next();
}

export const config = {
  matcher: '/api/:path*',
};
