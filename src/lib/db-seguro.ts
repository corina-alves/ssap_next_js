const CODIGOS_REDE = new Set([
  'ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND', 'EAI_AGAIN',
  'EHOSTUNREACH', 'ENETUNREACH', 'EPIPE', 'CERT_HAS_EXPIRED',
  'DEPTH_ZERO_SELF_SIGNED_CERT', 'SELF_SIGNED_CERT_IN_CHAIN',
  'UNABLE_TO_VERIFY_LEAF_SIGNATURE', 'UNABLE_TO_GET_ISSUER_CERT_LOCALLY',
  'ERR_TLS_CERT_ALTNAME_INVALID',
]);

/** O driver pode incluir credenciais, SQL e valores da linha em message/detail. */
export class ErroBanco extends Error {
  readonly code: string;

  constructor(erro: unknown) {
    const codigo = erro && typeof erro === 'object' && 'code' in erro ? erro.code : null;
    const code = typeof codigo === 'string' && (/^[0-9A-Z]{5}$/.test(codigo) || CODIGOS_REDE.has(codigo)) ? codigo : 'ERRO_BANCO';
    super(`Falha ao acessar o banco de dados (${code}).`);
    this.name = 'ErroBanco';
    this.code = code;
    // Não guardar o erro original em cause: o logger do Next também imprime cause.
  }
}

const proxies = new WeakMap<object, object>();
const seguro = (erro: unknown) => erro instanceof ErroBanco ? erro : new ErroBanco(erro);

/**
 * Protege a fronteira do driver, incluindo consultas diretas do pool/client.
 * Preserva as APIs Promise/callback do pg e os códigos usados nas validações.
 * Os demais métodos são executados com o objeto original como this.
 */
export function protegerBanco<T extends object>(executor: T): T {
  const existente = proxies.get(executor);
  if (existente) return existente as T;
  const proxy = new Proxy(executor, {
    get(alvo, propriedade, receptor) {
      const valor = Reflect.get(alvo, propriedade, receptor);
      if (typeof valor !== 'function') return valor;
      if (propriedade !== 'query' && propriedade !== 'connect') return valor.bind(alvo);
      return (...argumentos: unknown[]) => {
        const conectar = propriedade === 'connect';
        const ultimo = argumentos.at(-1);
        if (typeof ultimo === 'function') {
          argumentos[argumentos.length - 1] = (erro: unknown, resultado: unknown, ...resto: unknown[]) => ultimo(
            erro ? seguro(erro) : erro,
            conectar && resultado && typeof resultado === 'object' ? protegerBanco(resultado) : resultado,
            ...resto,
          );
        }
        try {
          const resultado = Reflect.apply(valor, alvo, argumentos);
          if (resultado && typeof resultado.then === 'function') {
            return resultado.then(
              (r: unknown) => conectar && r && typeof r === 'object' ? protegerBanco(r) : r,
              (e: unknown) => { throw seguro(e); },
            );
          }
          return resultado;
        } catch (e) {
          throw seguro(e);
        }
      };
    },
  });
  proxies.set(executor, proxy);
  proxies.set(proxy, proxy);
  return proxy;
}
