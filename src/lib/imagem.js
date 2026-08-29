/**
 * Lê um arquivo de imagem, reduz até `maxLado` e devolve um data URL.
 * Serve para caber a imagem do mapa no banco (ou no navegador, em demonstração)
 * sem perder legibilidade no zoom.
 */
export function prepararImagem(arquivo, maxLado = 2600, qualidade = 0.86) {
  return new Promise((resolve, reject) => {
    if (!arquivo.type.startsWith('image/')) {
      reject(new Error('Selecione um arquivo de imagem (PNG, JPG ou WEBP).'));
      return;
    }
    const url = URL.createObjectURL(arquivo);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const escala = Math.min(1, maxLado / Math.max(img.width, img.height));
      const w = Math.round(img.width * escala);
      const h = Math.round(img.height * escala);
      const cv = document.createElement('canvas');
      cv.width = w; cv.height = h;
      const cx = cv.getContext('2d');
      cx.imageSmoothingQuality = 'high';
      cx.drawImage(img, 0, 0, w, h);
      resolve({ dataUrl: cv.toDataURL('image/jpeg', qualidade), largura: w, altura: h });
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Não consegui ler essa imagem.')); };
    img.src = url;
  });
}

export const tamanhoDataUrl = (s) => (s ? Math.round((s.length * 3) / 4 / 1024) : 0); // KB aprox.

/**
 * O brasão de uma casa nobre.
 *
 * O quadro do brasão é um quadrado, então a imagem é normalizada para
 * um quadrado de LADO_BRASAO px **com fundo transparente**: o desenho
 * entra inteiro, centralizado, sem corte e sem esticar. A saída é PNG,
 * que é o único formato aqui que guarda transparência — JPG não guarda,
 * e por isso é recusado com uma explicação.
 */
export const LADO_BRASAO = 512;          // o quadrado final, em pixels
export const MAX_ARQUIVO_MB = 4;         // o que aceitamos receber
const MAX_SAIDA_KB = 700;                // o que cabe bem no banco / navegador

export function prepararBrasao(arquivo, lado = LADO_BRASAO) {
  return new Promise((resolve, reject) => {
    if (!arquivo?.type?.startsWith('image/')) {
      reject(new Error('Selecione uma imagem PNG ou WEBP.'));
      return;
    }
    if (/jpe?g/i.test(arquivo.type)) {
      reject(new Error(
        'JPG não guarda transparência, e o brasão precisa vir sem fundo. '
        + 'Salve o desenho como PNG (ou WEBP) com fundo transparente e envie de novo.',
      ));
      return;
    }
    if (arquivo.size > MAX_ARQUIVO_MB * 1024 * 1024) {
      reject(new Error(`Essa imagem tem mais de ${MAX_ARQUIVO_MB} MB. Envie uma menor.`));
      return;
    }

    const url = URL.createObjectURL(arquivo);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      if (!img.width || !img.height) { reject(new Error('Não consegui ler essa imagem.')); return; }

      const desenhar = (n) => {
        const cv = document.createElement('canvas');
        cv.width = n; cv.height = n;                       // quadrado, e transparente
        const cx = cv.getContext('2d');
        cx.imageSmoothingQuality = 'high';
        // "contain": o lado maior encosta na borda, o resto fica vazio.
        const escala = Math.min(n / img.width, n / img.height);
        const w = Math.round(img.width * escala);
        const h = Math.round(img.height * escala);
        cx.drawImage(img, Math.round((n - w) / 2), Math.round((n - h) / 2), w, h);
        return cv;
      };

      let cv = desenhar(lado);
      let dataUrl = cv.toDataURL('image/png');
      // PNG grande demais: reduz o quadrado uma vez antes de desistir.
      if (tamanhoDataUrl(dataUrl) > MAX_SAIDA_KB) {
        cv = desenhar(Math.round(lado / 2));
        dataUrl = cv.toDataURL('image/png');
      }
      if (tamanhoDataUrl(dataUrl) > MAX_SAIDA_KB) {
        reject(new Error('Essa imagem é pesada demais mesmo depois de reduzida. Simplifique o desenho ou reduza as cores.'));
        return;
      }

      // Aviso honesto: se os quatro cantos estão opacos, a imagem tem fundo.
      let temFundo = false;
      try {
        const cx = cv.getContext('2d');
        const n = cv.width;
        const cantos = [[1, 1], [n - 2, 1], [1, n - 2], [n - 2, n - 2]];
        temFundo = cantos.every(([x, y]) => cx.getImageData(x, y, 1, 1).data[3] > 200);
      } catch { /* canvas sujo: seguimos sem o aviso */ }

      resolve({ dataUrl, lado: cv.width, temFundo });
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Não consegui ler essa imagem.')); };
    img.src = url;
  });
}
