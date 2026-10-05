'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { Alertas } from '@/components/alertas';
import type { EstadoAdmin } from '@/lib/admin/estado';
import {
  criarBoletimAcao,
  editarBoletimAcao,
  excluirBoletimAcao,
  transicionarAcao,
  type ValoresBoletim,
} from './actions';

const inicial = { erros: [], versao: 0 };
const LIMITE = '30 MB';

type GrupoTipos = { sala: string; tipos: { id: number; nome: string; periodicidade: string; exige_revisao: boolean }[] };

function CamposMetadados({ v }: { v: ValoresBoletim }) {
  return (
    <>
      <label>
        Título
        <input name="titulo" defaultValue={v.titulo} maxLength={255} required placeholder="Ex.: Boletim Diário — 30/09/2026" />
      </label>
      <div className="colunas">
        <label>
          Data de referência
          <input name="data_referencia" type="date" defaultValue={v.dataReferencia} required />
        </label>
        <label>
          Competência (boletins mensais)
          <input name="competencia" type="month" defaultValue={v.competencia} />
          <small className="suave">Em branco num tipo mensal: usa o mês da data de referência.</small>
        </label>
      </div>
    </>
  );
}

export function FormNovoBoletim({ grupos, inicialValores }: { grupos: GrupoTipos[]; inicialValores: ValoresBoletim }) {
  const [estado, acao, pendente] = useActionState(criarBoletimAcao, inicial as EstadoAdmin<ValoresBoletim>);
  const v = estado.valores ?? inicialValores;
  return (
    <>
      <Alertas erros={estado.erros} mensagem={estado.mensagem} />
      <form key={estado.versao} action={acao} className="formulario cartao" noValidate>
        <label>
          Tipo de boletim
          <select name="tipo_id" defaultValue={v.tipoId || ''} required>
            <option value="">Selecione…</option>
            {grupos.map((g) => (
              <optgroup key={g.sala} label={g.sala}>
                {g.tipos.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.nome}
                    {t.exige_revisao ? ' (com revisão)' : ''}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>
        <CamposMetadados v={v} />
        <label>
          Arquivo PDF
          <input name="pdf" type="file" accept="application/pdf,.pdf" required />
          <small className="suave">Somente PDF, até {LIMITE}.</small>
        </label>
        <p className="suave">O boletim é criado como rascunho. Depois você o envia para revisão ou publica.</p>
        <div className="acoes">
          <Link href="/acesso/boletins" className="botao botao-secundario">
            Voltar
          </Link>
          <button type="submit" className="botao" disabled={pendente}>
            {pendente ? 'Enviando…' : 'Cadastrar boletim'}
          </button>
        </div>
      </form>
    </>
  );
}

export function FormEditarBoletim({ id, inicialValores }: { id: string; inicialValores: ValoresBoletim }) {
  const [estado, acao, pendente] = useActionState(editarBoletimAcao, inicial as EstadoAdmin<ValoresBoletim>);
  const v = estado.valores ?? inicialValores;
  return (
    <section className="cartao">
      <h2>Editar</h2>
      <Alertas erros={estado.erros} mensagem={estado.mensagem} />
      <form key={estado.versao} action={acao} className="formulario" noValidate>
        <input type="hidden" name="id" value={id} />
        <CamposMetadados v={v} />
        <label>
          Substituir o PDF (opcional)
          <input name="pdf" type="file" accept="application/pdf,.pdf" />
          <small className="suave">O PDF anterior continua guardado na versão anterior.</small>
        </label>
        <div className="acoes">
          <button type="submit" className="botao" disabled={pendente}>
            {pendente ? 'Salvando…' : 'Salvar alterações'}
          </button>
        </div>
      </form>
    </section>
  );
}

export function PainelAcoes({
  id,
  acoes,
}: {
  id: string;
  acoes: { acao: string; rotulo: string; bloqueio: string | null }[];
}) {
  const [estado, acao, pendente] = useActionState(transicionarAcao, inicial as EstadoAdmin);
  return (
    <section className="cartao">
      <h2>Andamento</h2>
      <Alertas erros={estado.erros} mensagem={estado.mensagem} />
      {acoes.length === 0 ? (
        <p className="suave">Nenhuma ação disponível para você neste status.</p>
      ) : (
        <form key={estado.versao} action={acao} className="formulario">
          <input type="hidden" name="id" value={id} />
          <label>
            Comentário <small className="suave">(obrigatório para devolver)</small>
            <textarea name="comentario" maxLength={500} rows={2} />
          </label>
          <div className="linha">
            {acoes.map((x) => (
              <button
                key={x.acao}
                type="submit"
                name="acao"
                value={x.acao}
                className={x.acao === 'publicar' || x.acao === 'aprovar' ? 'botao' : 'botao botao-secundario'}
                disabled={pendente || !!x.bloqueio}
                title={x.bloqueio ?? undefined}
              >
                {x.rotulo}
              </button>
            ))}
          </div>
          {acoes
            .filter((x) => x.bloqueio)
            .map((x) => (
              <small key={x.acao} className="suave">
                {x.rotulo}: {x.bloqueio}
              </small>
            ))}
        </form>
      )}
    </section>
  );
}

export function ExcluirBoletim({ id }: { id: string }) {
  const [estado, acao, pendente] = useActionState(excluirBoletimAcao, inicial as EstadoAdmin);
  return (
    <form
      action={acao}
      onSubmit={(e) => {
        if (!window.confirm('Excluir este boletim? Ele some das listas; o histórico é preservado.')) e.preventDefault();
      }}
    >
      <input type="hidden" name="id" value={id} />
      <Alertas erros={estado.erros} />
      <button type="submit" className="botao botao-perigo" disabled={pendente}>
        Excluir boletim
      </button>
    </form>
  );
}
