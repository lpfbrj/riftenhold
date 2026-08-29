/**
 * Copiar para a área de transferência.
 *
 * `navigator.clipboard` não existe em toda parte: fora de HTTPS, e dentro
 * de um iframe sem permissão de escrita (é o caso da página publicada),
 * ele some ou recusa em silêncio — era por isso que o botão "copiar" das
 * credenciais parecia morto. Aqui tentamos o caminho moderno e, se ele
 * falhar, caímos no truque antigo: um campo invisível, seleção e
 * `execCommand`, que continua funcionando porque parte de um clique.
 *
 * @returns {Promise<boolean>} se o texto foi mesmo copiado.
 */
export async function copiarTexto(texto) {
  const valor = String(texto ?? '');
  if (!valor) return false;

  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(valor);
      return true;
    }
  } catch { /* sem permissão: tentamos o caminho de baixo */ }

  try {
    const campo = document.createElement('textarea');
    campo.value = valor;
    campo.setAttribute('readonly', '');
    // Fora da vista, mas dentro da página: o navegador só copia o que existe.
    campo.style.cssText = 'position:fixed;top:0;left:-9999px;opacity:0;';
    document.body.appendChild(campo);
    campo.select();
    campo.setSelectionRange(0, valor.length);
    const deu = document.execCommand('copy');
    document.body.removeChild(campo);
    return deu;
  } catch {
    return false;
  }
}
