/**
 * CIDADANIA E ISENÇÃO
 *
 *  1. No Registro Civil, o morador diz se Riften é a cidade natal dele ou
 *     se está vindo de outra — e, vindo de fora, de onde e se precisa de
 *     isenção para trocar de cidadania.
 *  2. A Corte vê o pedido, concede ou nega, e o morador é avisado.
 *  3. Quem não pediu na hora pede depois, pela própria ficha; quem teve
 *     o pedido negado pode tentar de novo.
 */
import pw from '/home/claude/.npm-global/lib/node_modules/playwright/index.js';
const { chromium } = pw;
const erros = [];
const ok = (c, m) => { if (!c) erros.push('[falha] ' + m); };
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1440, height: 1150 } });
p.on('pageerror', e => erros.push('[pageerror] ' + e.message));
p.on('console', m => { if (m.type() === 'error' && !/ERR_TUNNEL|Failed to load resource/.test(m.text())) erros.push('[console] ' + m.text()); });
const shot = n => p.screenshot({ path: `/home/claude/shots/${n}.png` });
const limpar = () => p.evaluate(() => {
  sessionStorage.removeItem('riften-hold:sessao');
  sessionStorage.removeItem('riften-hold:cidadao');
});
const aoPortal = async () => { await limpar(); await p.reload({ waitUntil: 'networkidle' }); await p.waitForTimeout(400); };
const entrarCorte = async () => {
  await aoPortal();
  await p.click('.portal-card:has(.portal-nome:text-is("Corte de Riften"))');
  await p.waitForTimeout(300);
  await p.fill('.login-caixa input >> nth=0', 'jarl@riften.rift');
  await p.fill('input[type=password]', 'mistveil');
  await p.click('.login-caixa form button.primario');
  await p.waitForSelector('.sidebar', { timeout: 8000 });
  await p.waitForTimeout(600);
};
const entrarCidade = async (id, senha) => {
  await aoPortal();
  await p.click('.portal-card:has(.portal-nome:text-is("Cidade de Riften"))');
  await p.waitForTimeout(300);
  await p.fill('.login-caixa input >> nth=0', id);
  await p.fill('.login-caixa input[type=password]', senha);
  await p.click('.login-caixa form button.primario');
  await p.waitForSelector('.sidebar', { timeout: 8000 });
  await p.waitForTimeout(700);
};
const irPara = async (nome) => { await p.click(`.nav-item:has-text("${nome}")`); await p.waitForTimeout(700); };

/** Preenche o Registro Civil público e envia. */
async function registrar({ nome, id, origem, cidade, isencao, motivo }) {
  await aoPortal();
  await p.click('.portal-card:has(.portal-nome:text-is("Cidade de Riften"))');
  await p.waitForTimeout(350);
  await p.click('.login-alternativa .btn');
  await p.waitForTimeout(450);
  await p.fill('.registro-caixa input >> nth=0', nome);
  await p.fill('.registro-caixa input >> nth=1', id);
  await p.selectOption('.registro-caixa select >> nth=0', { index: 1 });

  ok((await p.locator('.origem-op').count()) === 2,
     'o registro devia oferecer as duas opções de cidadania');
  await p.click(`.origem-op:has-text("${origem === 'natal' ? 'Cidade Natal' : 'outra Cidade'}")`);
  await p.waitForTimeout(300);

  if (origem !== 'natal') {
    ok((await p.locator('.bloco-transferencia').count()) === 1,
       'escolher "outra cidade" devia abrir os campos da transferência');
    await p.selectOption('.bloco-transferencia select', cidade);
    await p.waitForTimeout(200);
    // A regra do preço tem de estar escrita onde ele decide pedir.
    const regra = await p.locator('.isencao-op').innerText();
    ok(/5\.000 septims/.test(regra),
       `a descrição da isenção devia dizer o preço da troca: ${regra}`);
    ok(/gratuita|de graça/i.test(regra) && /não solicit|não peça/i.test(regra),
       `a descrição devia mandar não pedir quem ainda tem a troca grátis: ${regra}`);

    if (isencao) {
      await p.check('.isencao-op input');
      await p.waitForTimeout(250);
      await p.fill('.bloco-transferencia textarea', motivo);
    }
  } else {
    ok((await p.locator('.bloco-transferencia').count()) === 0,
       'quem é natural de Riften não devia ver os campos de transferência');
  }

  await p.click('.registro-caixa form button.primario');
  await p.waitForTimeout(900);
}

/** Aprova o registro na Corte e devolve a senha gerada. */
async function aprovar(nome) {
  await entrarCorte();
  await irPara('Registro Civil');
  await p.locator(`.civil-pedido:has-text("${nome}") button:has-text("Aprovar")`).click();
  await p.waitForTimeout(900);
  const senha = (await p.locator('.cred-val.grande').innerText()).trim();
  await p.click('.modal-f .btn.primario');
  await p.waitForTimeout(400);
  return senha;
}

const NATIVA = 'Hilde Filha-do-Lago';
const VINDO = 'Bjorn Passo-Longe';
const TARDIO = 'Rurik Sem-Rumo';

await p.goto('http://localhost:4173', { waitUntil: 'networkidle' });
await p.evaluate(() => {
  const s = JSON.parse(localStorage.getItem('riften-hold:v1') || '{}');
  s.civis = []; s.avisos = [];
  localStorage.setItem('riften-hold:v1', JSON.stringify(s));
});

/* ============================================================
   1. Natural de Riften: nada de transferência, nada de isenção
   ============================================================ */
await registrar({ nome: NATIVA, id: 'CID-1', origem: 'natal' });
ok(/Natural de Riften/i.test(await p.locator('.recibo').innerText()),
   'o recibo devia dizer que ela é natural de Riften');
await shot('K1-natal');

/* ============================================================
   2. Vindo de outra cidade, pedindo isenção
   ============================================================ */
await registrar({
  nome: VINDO, id: 'CID-2', origem: 'transferencia', cidade: 'windhelm',
  isencao: true, motivo: 'Jurei serviço ao Jarl de Windhelm e preciso ser liberado do juramento.',
});
const recibo = await p.locator('.recibo').innerText();
ok(/Transferência de Windhelm/i.test(recibo), `o recibo devia trazer a cidade anterior: ${recibo}`);
ok(/Isenção/.test(recibo) && /aguardando a Corte/i.test(recibo),
   'o recibo devia dizer que a isenção foi pedida');
await shot('K2-transferencia');

/* ============================================================
   3. A Corte enxerga tudo na fila e no quadro de isenções
   ============================================================ */
await entrarCorte();
await irPara('Registro Civil');
const fila = await p.locator('.painel:has(.painel-h h3:text-is("Fila de aprovação"))').innerText();
ok(/Natural de Riften/.test(fila), 'a fila devia marcar quem é natural do Hold');
ok(/Vindo de Windhelm/.test(fila), 'a fila devia marcar de onde vem o transferido');
ok(/Pede isenção/i.test(fila), 'a fila devia avisar que há pedido de isenção');

const quadro = p.locator('.painel:has(.painel-h h3:text-is("Isenções de cidadania"))');
ok((await quadro.count()) === 1, 'falta o quadro de isenções');
ok((await quadro.locator('.isencao-card').count()) === 1, 'o pedido devia estar no quadro');
ok(/juramento/i.test(await quadro.innerText()), 'a justificativa do morador devia aparecer');
await quadro.scrollIntoViewIfNeeded();
await p.waitForTimeout(300);
await shot('K3-quadro-isencoes');

/* ============================================================
   4. A Corte concede — e o morador é avisado
   ============================================================ */
const senhaVindo = await aprovar(VINDO);
await irPara('Registro Civil');
await p.locator('.isencao-card:has-text("Bjorn") button:has-text("Conceder")').click();
await p.waitForTimeout(500);
await p.fill('.modal textarea', 'Concedida em troca de dois anos de serviço à Guarda.');
await p.click('.modal-f .btn.primario');
await p.waitForTimeout(1300);
const depois = p.locator('.painel:has(.painel-h h3:text-is("Isenções de cidadania"))');
ok((await depois.locator('.isencao-card').count()) === 0,
   'o pedido decidido devia sair do quadro');
const linha = await p.locator(`tr:has-text("${VINDO}")`).innerText();
ok(/Windhelm/.test(linha), 'a lista oficial devia mostrar a cidade anterior');
ok(/Isenção concedida/i.test(linha), `a lista devia mostrar a isenção concedida: ${linha}`);
await shot('K4-concedida');

await entrarCidade('CID-2', senhaVindo);
await irPara('Quadro de Avisos');
const mural = await p.locator('.main').innerText();
ok(/Isenção de cidadania concedida/i.test(mural), 'o morador devia receber o recado da concessão');
ok(/dois anos de serviço/i.test(mural), 'o parecer da Corte devia ir junto');

await irPara('Minha ficha');
const ficha = p.locator('.painel:has(.painel-h h3:text-is("Minha cidadania"))');
ok((await ficha.count()) === 1, 'falta o quadro de cidadania na ficha do morador');
const txtFicha = await ficha.innerText();
ok(/Windhelm/.test(txtFicha), 'a ficha devia mostrar a cidade anterior');
ok(/Concedida/i.test(txtFicha), 'a ficha devia mostrar a isenção concedida');
ok((await ficha.locator('button:has-text("Pedir isenção")').count()) === 0,
   'quem já tem isenção não pede de novo');
await shot('K5-ficha-morador');

/* ============================================================
   5. Quem não pediu na hora pede depois, pela ficha
   ============================================================ */
await registrar({ nome: TARDIO, id: 'CID-3', origem: 'transferencia', cidade: 'markarth', isencao: false });
const senhaTardio = await aprovar(TARDIO);

await entrarCidade('CID-3', senhaTardio);
await irPara('Minha ficha');
const dele = p.locator('.painel:has(.painel-h h3:text-is("Minha cidadania"))');
ok(/Markarth/.test(await dele.innerText()), 'a ficha devia trazer Markarth');
ok(/Não pedida/i.test(await dele.innerText()), 'a isenção devia constar como não pedida');
ok(/5\.000 septims/.test(await dele.innerText()),
   'a ficha devia explicar o preço da troca antes de ele pedir a isenção');
await dele.locator('button:has-text("Pedir isenção")').click();
await p.waitForTimeout(400);
await dele.locator('textarea').fill('Fui exilado de Markarth e quero assentar em Riften.');
await dele.locator('.btn.primario:has-text("Enviar pedido")').click();
await p.waitForTimeout(1300);
ok(/Pendente/i.test(await dele.innerText()), 'o pedido feito pela ficha devia ficar pendente');
ok((await dele.locator('button:has-text("Pedir isenção")').count()) === 0,
   'com pedido em pé, não se pede de novo');
await shot('K6-pedido-tardio');

/* ============================================================
   6. A Corte nega — e ele pode tentar outra vez
   ============================================================ */
await entrarCorte();
await irPara('Registro Civil');
await p.locator('.isencao-card:has-text("Rurik") button:has-text("Negar")').click();
await p.waitForTimeout(500);
await p.fill('.modal textarea', 'Falta prova do exílio. Traga o decreto de Markarth.');
await p.click('.modal-f .btn.perigo');
await p.waitForTimeout(1300);
ok(/Isenção negada/i.test(await p.locator(`tr:has-text("${TARDIO}")`).innerText()),
   'a lista devia mostrar a isenção negada');

await entrarCidade('CID-3', senhaTardio);
await irPara('Quadro de Avisos');
ok(/negada/i.test(await p.locator('.main').innerText()), 'ele devia ser avisado da recusa');
await irPara('Minha ficha');
const negada = p.locator('.painel:has(.painel-h h3:text-is("Minha cidadania"))');
ok(/Falta prova do exílio/.test(await negada.innerText()), 'o parecer da Corte devia aparecer na ficha');
ok((await negada.locator('button:has-text("Pedir isenção")').count()) === 1,
   'depois de negada, ele pode pedir de novo');
await shot('K7-negada');

/* ============================================================
   7. Quem é natural do Hold não tem o que pedir
   ============================================================ */
const senhaNativa = await aprovar(NATIVA);
await entrarCidade('CID-1', senhaNativa);
await irPara('Minha ficha');
const nativa = p.locator('.painel:has(.painel-h h3:text-is("Minha cidadania"))');
ok(/Natural de Riften/i.test(await nativa.innerText()), 'a ficha dela devia dizer natural de Riften');
ok((await nativa.locator('button:has-text("Pedir isenção")').count()) === 0,
   'quem nasceu aqui não pede isenção');

await b.close();
console.log(erros.length
  ? 'PROBLEMAS:\n' + erros.join('\n')
  : 'Tudo certo — cidadania natal e transferida, isenção pedida, concedida, negada e repetida.');
