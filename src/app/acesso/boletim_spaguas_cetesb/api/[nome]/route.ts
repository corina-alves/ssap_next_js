import { NextResponse, type NextRequest } from 'next/server';
import { exigirApi } from '@/lib/acesso/api';
import { csvRede, periodoPedido, PERMISSAO_CETESB, redeMensal, SALA_CETESB, validacaoRede } from '@/lib/boletins-sala/rede-pluviometrica';

export const maxDuration = 180;

/**
 * APIs da Sala CETESB, nos endereços que o script da página chama:
 *   chuvas_pontos.php?ano=&mes=[&formato=csv]   rede pluviométrica do mês
 *   validacao_pluviometria.php?ano=&mes=        conferência operacional da rede
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ nome: string }> }) {
  const { nome } = await params;
  if (nome !== 'chuvas_pontos.php' && nome !== 'validacao_pluviometria.php') return NextResponse.json({ ok: false, erro: 'Não encontrado.' }, { status: 404 });
  const acesso = await exigirApi(SALA_CETESB, PERMISSAO_CETESB);
  if (acesso instanceof NextResponse) return acesso;

  const q = req.nextUrl.searchParams;
  const { ano, mes } = periodoPedido(q.get('ano'), q.get('mes'));
  let dados: Awaited<ReturnType<typeof redeMensal>>;
  try {
    dados = await redeMensal(ano, mes);
  } catch (e) {
    console.error('Rede pluviométrica:', e);
    return NextResponse.json({ ok: false, erro: 'Não foi possível consolidar a rede pluviométrica.' }, { status: 500 });
  }
  const semCache = { 'Cache-Control': 'private, no-store' };
  if (nome === 'validacao_pluviometria.php') return NextResponse.json(validacaoRede(dados), { headers: semCache });
  if (q.get('formato') === 'csv') {
    const arquivo = `chuvas_alto_tiete_${ano}_${String(mes).padStart(2, '0')}.csv`;
    return new Response(csvRede(dados), { headers: { ...semCache, 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="${arquivo}"` } });
  }
  return NextResponse.json(dados, { headers: semCache });
}
