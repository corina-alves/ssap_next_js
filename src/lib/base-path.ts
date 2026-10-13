/** O prefixo é definido no build do Next e deve ser igual em desenvolvimento e produção. */
export const BASE_PATH = '/ssap';

/** URLs do navegador (fetch, assets e HTML nativo); Next Link e redirect aplicam o prefixo. */
export function comBasePath(caminho: string): string {
  if (!caminho.startsWith('/') || caminho.startsWith('//')) return caminho;
  if (caminho === BASE_PATH || caminho.startsWith(`${BASE_PATH}/`) || caminho.startsWith(`${BASE_PATH}?`) || caminho.startsWith(`${BASE_PATH}#`)) return caminho;
  return `${BASE_PATH}${caminho}`;
}

/**
 * Adapta os documentos HTML próprios capturados do PHP na fronteira de renderização.
 * Preserva recursos externos, URLs relativas, fragmentos e conteúdo dos documentos.
 * Não é um sanitizador: estes documentos já precisam vir de uma fonte confiável.
 */
export function htmlComBasePath(html: string): string {
  return html
    .replace(/\b((?:href|src|action|poster|data-(?:dados|medias|api|url))\s*=\s*)(["'])(\/(?!\/)[^"']*)\2/gi,
      (_, atributo: string, aspas: string, caminho: string) => `${atributo}${aspas}${comBasePath(caminho)}${aspas}`)
    .replace(/url\(\s*(["']?)(\/(?!\/)[^\s)"']+)\1\s*\)/gi,
      (_, aspas: string, caminho: string) => `url(${aspas}${comBasePath(caminho)}${aspas})`)
    // Scripts inline dos documentos podem consultar APIs ou assets do próprio sistema.
    .replace(/(["'`])(\/(?:api|acesso|legado)\/[^"'`\s<>]*)\1/g,
      (_, aspas: string, caminho: string) => `${aspas}${comBasePath(caminho)}${aspas}`);
}
