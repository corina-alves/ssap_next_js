import assert from 'node:assert/strict';
import { test } from 'node:test';
import { criarFilaCapturas } from '../src/lib/acesso/fila-capturas';

function sinal() {
  let liberar!: () => void;
  const aguardar = new Promise<void>((resolve) => { liberar = resolve; });
  return { aguardar, liberar };
}

test('pedidos iguais compartilham a captura e diagramas diferentes aguardam o mesmo navegador', async () => {
  const fila = criarFilaCapturas<'tiete' | 'ribeira', string>(['tiete', 'ribeira']);
  const primeiro = sinal();
  const executados: string[] = [];
  const tiete = fila.executar('tiete', async () => {
    executados.push('tiete');
    await primeiro.aguardar;
    return 'captura-tiete';
  });
  const repetido = fila.executar('tiete', async () => { throw new Error('Não deve executar novamente.'); });
  const ribeira = fila.executar('ribeira', async () => {
    executados.push('ribeira');
    return 'captura-ribeira';
  });
  assert.equal(repetido, tiete);
  await Promise.resolve();
  assert.deepEqual(executados, ['tiete']);
  primeiro.liberar();
  assert.deepEqual(await Promise.all([tiete, repetido, ribeira]), ['captura-tiete', 'captura-tiete', 'captura-ribeira']);
  assert.deepEqual(executados, ['tiete', 'ribeira']);
});

test('falha na captura libera o navegador para o próximo diagrama e permite nova tentativa', async () => {
  const fila = criarFilaCapturas<'tiete' | 'ribeira', number>(['tiete', 'ribeira']);
  const falha = fila.executar('tiete', async () => { throw new Error('Fonte indisponível.'); });
  const proxima = fila.executar('ribeira', async () => 2);
  await assert.rejects(falha, /Fonte indisponível/);
  assert.equal(await proxima, 2);
  assert.equal(await fila.executar('tiete', async () => 3), 3);
});

test('recusa uma chave fora dos diagramas configurados sem executar a tarefa', async () => {
  const fila = criarFilaCapturas<string, number>(['tiete', 'ribeira']);
  let executou = false;
  await assert.rejects(fila.executar('outro', async () => { executou = true; return 1; }), /Captura inválida/);
  assert.equal(executou, false);
});
