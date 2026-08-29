/**
 * A BATERIA DE TESTES, EM PARALELO
 *
 * Roda todas as suítes `smoke*.mjs` ao mesmo tempo, em vez de uma
 * de cada vez. Não muda nenhum teste: cada suíte abre o seu próprio
 * navegador, com armazenamento próprio, e o servidor que elas
 * consultam só devolve arquivo estático. Nada é compartilhado entre
 * elas — a única diferença é que esperam juntas.
 *
 *   npm run testes                 → todas
 *   npm run testes -- casas corte  → só as que casarem com o nome
 *   npm run testes -- --serie      → uma de cada vez (para depurar)
 *   npm run testes -- --juntas=2   → outra quantidade simultânea
 *
 * Sai com código 1 se qualquer suíte falhar, para servir de portão.
 */
import { readdirSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { cpus } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(AQUI, '..');
const ENDERECO = 'http://localhost:4173';

/**
 * Quantas de uma vez. As suítes passam a maior parte do tempo
 * paradas, esperando a tela assentar, então cabe mais de uma por
 * núcleo — mas não muito mais, ou o navegador começa a estourar
 * o tempo e a falha vira ruído em vez de sinal.
 */
const PADRAO_JUNTAS = Math.max(2, Math.min(4, cpus().length * 2));

const argumentos = process.argv.slice(2);
const serie = argumentos.includes('--serie');
const juntasArg = argumentos.find((a) => a.startsWith('--juntas='));
const juntas = serie ? 1 : Number(juntasArg?.split('=')[1]) || PADRAO_JUNTAS;
const filtros = argumentos.filter((a) => !a.startsWith('--'));

const suites = readdirSync(AQUI)
  .filter((f) => /^smoke.*\.mjs$/.test(f))
  .filter((f) => !filtros.length || filtros.some((t) => f.includes(t)))
  .sort();

if (suites.length === 0) {
  console.error(`Nenhuma suíte casou com: ${filtros.join(', ')}`);
  process.exit(1);
}

/** O servidor de pré-visualização está no ar? */
async function noAr() {
  try {
    const r = await fetch(ENDERECO, { signal: AbortSignal.timeout(2500) });
    return r.ok;
  } catch { return false; }
}

/** Sobe o `vite preview` e espera ele responder. Devolve como derrubar. */
async function subirPreview() {
  const filho = spawn('npx', ['vite', 'preview', '--port', '4173'], {
    cwd: RAIZ, stdio: 'ignore', detached: true,
  });
  filho.unref();
  for (let i = 0; i < 30; i += 1) {
    await new Promise((r) => setTimeout(r, 500));
    if (await noAr()) return () => { try { process.kill(-filho.pid); } catch { /* já morreu */ } };
  }
  throw new Error('O servidor de pré-visualização não subiu. Rode `npm run build` antes.');
}

const tempo = (ms) => `${(ms / 1000).toFixed(0)}s`;

/** Roda uma suíte e devolve o veredito. */
function rodar(arquivo) {
  return new Promise((resolve) => {
    const inicio = Date.now();
    const filho = spawn('node', [path.join(AQUI, arquivo)], { cwd: RAIZ });
    let saida = '';
    filho.stdout.on('data', (d) => { saida += d; });
    filho.stderr.on('data', (d) => { saida += d; });
    filho.on('close', (codigo) => {
      const texto = saida.trim();
      // A convenção das suítes: "Tudo certo — …" quando nada falhou.
      const passou = codigo === 0 && /^Tudo certo/m.test(texto);
      resolve({
        arquivo,
        nome: arquivo.replace(/^smoke-?/, '').replace(/\.mjs$/, '') || 'geral',
        passou,
        codigo,
        saida: texto,
        ms: Date.now() - inicio,
      });
    });
  });
}

/** Fila com limite: começa a próxima assim que uma vaga abre. */
async function emParalelo(itens, limite, tarefa) {
  const resultados = new Array(itens.length);
  let proximo = 0;
  const trabalhador = async () => {
    while (proximo < itens.length) {
      const i = proximo;
      proximo += 1;
      resultados[i] = await tarefa(itens[i]);
      const r = resultados[i];
      process.stdout.write(
        `${r.passou ? '  ok  ' : ' FALHA'} ${r.nome.padEnd(16)} ${tempo(r.ms).padStart(5)}\n`,
      );
    }
  };
  await Promise.all(Array.from({ length: Math.min(limite, itens.length) }, trabalhador));
  return resultados;
}

// ------------------------------------------------------------
const jaEstava = await noAr();
let derrubar = null;
if (!jaEstava) {
  process.stdout.write('Subindo o servidor de pré-visualização…\n');
  derrubar = await subirPreview();
}

process.stdout.write(
  `${suites.length} suíte${suites.length === 1 ? '' : 's'}, ${juntas} de cada vez\n\n`,
);

const comeco = Date.now();
const resultados = await emParalelo(suites, juntas, rodar);
const total = Date.now() - comeco;

if (derrubar) derrubar();

const falhas = resultados.filter((r) => !r.passou);

for (const f of falhas) {
  process.stdout.write(`\n${'─'.repeat(60)}\n${f.arquivo} (saída ${f.codigo})\n${'─'.repeat(60)}\n`);
  process.stdout.write(`${f.saida}\n`);
}

const somaSerie = resultados.reduce((s, r) => s + r.ms, 0);
process.stdout.write(
  `\n${resultados.length - falhas.length}/${resultados.length} suítes passaram `
  + `em ${tempo(total)}`
  + (juntas > 1 ? ` (em série seriam ${tempo(somaSerie)})` : '')
  + '\n',
);

process.exit(falhas.length ? 1 : 0);
