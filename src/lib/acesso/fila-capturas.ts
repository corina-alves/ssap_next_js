/** Fila limitada às capturas conhecidas: uma tarefa ativa e uma promessa por chave. */
export type FilaCapturas<K extends string, T> = {
  executar(chave: K, tarefa: () => Promise<T>): Promise<T>;
};

export function criarFilaCapturas<K extends string, T>(chaves: readonly K[]): FilaCapturas<K, T> {
  const permitidas = new Set(chaves);
  const pendentes = new Map<K, Promise<T>>();
  let fim: Promise<void> = Promise.resolve();

  return {
    executar(chave, tarefa) {
      if (!permitidas.has(chave)) return Promise.reject(new Error('Captura inválida.'));
      const existente = pendentes.get(chave);
      if (existente) return existente;

      const atual = fim.then(tarefa);
      pendentes.set(chave, atual);
      // A próxima tarefa só começa quando a anterior terminou, inclusive o encerramento do navegador.
      fim = atual.then(() => undefined, () => undefined);
      void atual.then(() => pendentes.delete(chave), () => pendentes.delete(chave));
      return atual;
    },
  };
}
