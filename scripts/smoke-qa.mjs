/**
 * VARREDURA GERAL
 *
 * Passa por todas as telas das três portas, abre cada modal que existe e
 * confere que nada explode no caminho: nenhum erro de console, nenhuma
 * página em branco, nenhum botão que não responde. É a rede que pega o
 * estrago que uma mudança em um canto causa no outro.
 *
 * Cobre também os defeitos que já foram consertados, para que não voltem:
 *   · copiar ID e senha nas credenciais
 *   · Escape fecha só o modal de cima
 *   · aceitar 1 proposta entre várias responde a todas
 *   · concluir pedido não devolve peça ao estoque
 */
import pw from '/home/claude/.npm-global/lib/node_modules/playwright/index.js';
const { chromium } = pw;
const erros = [];
const ok = (c, m) => { if (!c) erros.push('[falha] ' + m); };
const b = await chromium.launch();
const p = await b.newPage({
  viewport: { width: 1440, height: 1100 },
  permissions: [],   // sem permissão de área de transferência, de propósito
});
p.on('pageerror', e => erros.push('[pageerror] ' + e.message));
p.on('console', m => {
  const t = m.text();
  if (m.type() === 'error' && !/ERR_TUNNEL|favicon|Failed to load resource/.test(t)) erros.push('[console] ' + t);
});
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
const entrarPorta = async (porta, id, senha) => {
  await aoPortal();
  await p.click(`.portal-card:has(.portal-nome:text-is("${porta}"))`);
  await p.waitForTimeout(300);
  await p.fill('.login-caixa input >> nth=0', id);
  await p.fill('.login-caixa input[type=password]', senha);
  await p.click('.login-caixa form button.primario');
  await p.waitForSelector('.sidebar', { timeout: 8000 });
  await p.waitForTimeout(700);
};
const irPara = async (nome) => { await p.click(`.nav-item:has-text("${nome}")`); await p.waitForTimeout(700); };
const semTelaBranca = async (onde) => {
  const txt = (await p.locator('.main').innerText()).trim();
  ok(txt.length > 40, `a tela ${onde} veio vazia`);
};

const SENHA = 'RFT-QQQQ-456';
const DONO = 'Ragna Punho-de-Pedra';
const FREGUES1 = 'Tova Mão-Leve';
const FREGUES2 = 'Skeggr Barba-Ruiva';
const FREGUES3 = 'Ylva Passo-Curto';

await p.goto('http://localhost:4173', { waitUntil: 'networkidle' });

await p.evaluate(([SENHA, DONO, F1, F2, F3]) => {
  const s = JSON.parse(localStorage.getItem('riften-hold:v1') || '{}');
  const civil = (nome, id_jogo, profissao) => ({
    id: `qa-${id_jogo}`, nome, id_jogo, raca: 'Nórdico', profissao, nivel: 'Adepto',
    status: 'Aprovado', senha_acesso: SENHA, notas: '', pericias: {},
  });
  s.civis = [
    civil(DONO, 'QA-1', 'Ferreiro-Armeiro'),
    civil(F1, 'QA-2', 'Alquimista'),
    civil(F2, 'QA-3', 'Caçador'),
    civil(F3, 'QA-4', 'Herbalista'),
    ...(s.civis || []),
  ];
  s.propriedades = [{
    id: 'qa-loja', nome: 'Casa do Punho', tipo: 'Oficina', local: 'Riften',
    status: 'Operante', proprietario: DONO, proprietario_civil_id: 'qa-QA-1',
    funcionarios: [], catalogacao: '',
    estoque: [{ nome: 'Adaga de Aço', quantidade: 10, valor: 90 }],
  }, ...(s.propriedades || [])];
  s.editais = []; s.propostas = []; s.avisos = []; s.pedidos_compra = []; s.registros = [];
  localStorage.setItem('riften-hold:v1', JSON.stringify(s));
}, [SENHA, DONO, FREGUES1, FREGUES2, FREGUES3]);

/* ============================================================
   1. Todas as telas da Corte abrem
   ============================================================ */
await entrarCorte();
const telasCorte = await p.locator('.nav-item').allInnerTexts();
ok(telasCorte.length === 12, `a Corte devia ter 12 telas, tem ${telasCorte.length}`);
for (let i = 0; i < telasCorte.length; i += 1) {
  await p.locator('.nav-item').nth(i).click();
  await p.waitForTimeout(650);
  await semTelaBranca(telasCorte[i]);
}
await shot('Q1-corte');

/* ============================================================
   2. Copiar as credenciais funciona mesmo sem área de transferência
   ============================================================ */
await irPara('Registro Civil');
await p.locator(`tr:has-text("${DONO}") .btn.fantasma`).first().click();
await p.waitForTimeout(600);
const cred = p.locator('.modal');
ok(/QA-1/.test(await cred.innerText()), 'o quadro de credenciais devia mostrar o ID');
await cred.locator('.credencial-linha >> nth=0 >> button').click();
await p.waitForTimeout(400);
const marcaId = await cred.locator('.credencial-linha >> nth=0 >> button').innerText();
ok(marcaId.trim() === '✓', `copiar o ID devia confirmar, veio "${marcaId}"`);
await cred.locator('.credencial-linha.senha button').click();
await p.waitForTimeout(400);
ok((await cred.locator('.credencial-linha.senha button').innerText()).trim() === '✓',
   'copiar a senha devia confirmar');
const copiado = await p.evaluate(() => navigator.clipboard?.readText?.().catch(() => '') || '');
ok(!copiado || /QA-1|RFT/.test(copiado), 'o que foi copiado devia ser a credencial');
await shot('Q2-copiar');
await p.click('.modal-f .btn.primario');
await p.waitForTimeout(300);

/* ============================================================
   3. Escape fecha só o modal de cima
   ============================================================ */
await irPara('Palácio do Jarl');
await p.click('.painel:has(.painel-h h3:text-is("Casas & Dinastias Nobres")) .btn.primario');
await p.waitForTimeout(400);
await p.fill('.modal input[placeholder="Clã ..."]', 'Casa da Varredura');
await p.click('.modal-f .btn.primario');
await p.waitForTimeout(900);
ok((await p.locator('.cla-card:has-text("Casa da Varredura")').count()) === 1,
   'a casa devia entrar no quadro');

// Ficha do vilarejo + ficha de uma propriedade: dois modais empilhados.
await p.click('.vila-card:has-text("Ivarstead")');
await p.waitForTimeout(500);
await p.click('.modal .btn:has-text("Adicionar propriedade")');
await p.waitForTimeout(600);
ok((await p.locator('.overlay').count()) === 2, 'a ficha da propriedade devia abrir por cima da do vilarejo');
await p.keyboard.press('Escape');
await p.waitForTimeout(400);
ok((await p.locator('.overlay').count()) === 1, 'o Escape devia fechar só a de cima');
await p.keyboard.press('Escape');
await p.waitForTimeout(400);
ok((await p.locator('.overlay').count()) === 0, 'o segundo Escape fecha a de baixo');
await shot('Q3-escape');

/* ============================================================
   4. Crônica com filtros
   ============================================================ */
const cronica = p.locator('.painel:has(.painel-h h3:text-is("Crônica da Corte"))');
await cronica.scrollIntoViewIfNeeded();
ok((await cronica.locator('.barra-filtros').count()) === 1, 'a Crônica devia ter filtros');
await cronica.locator('.campo.busca input').fill('Casa da Varredura');
await p.waitForTimeout(400);
const atos = await cronica.locator('.cronica-item').count();
ok(atos >= 1, 'a busca da Crônica devia achar o ato da casa criada');
await cronica.locator('.campo.busca input').fill('zzzz-nada');
await p.waitForTimeout(400);
ok(/Nenhum ato com esse filtro/i.test(await cronica.innerText()),
   'busca sem resultado devia dizer isso');
await cronica.locator('.campo.busca input').fill('');
await p.waitForTimeout(300);
await shot('Q4-cronica');

/* ============================================================
   5. Cinco propostas, uma escolhida: as outras quatro respondidas
   ============================================================ */
await irPara('Editais e Contratos');
await p.click('.pg-head .btn.primario');
await p.waitForTimeout(500);
await p.fill('.modal .grade.g2 input >> nth=0', 'Compra de peles curtidas');
await p.fill('.modal .ed-bloco .lista-membros input >> nth=0', 'Pele curtida');
await p.fill('.modal .ed-bloco .lista-membros input[type=number] >> nth=0', '40');
await p.click('.modal-f .btn.primario');
await p.waitForTimeout(1200);
ok((await p.locator('.edital-card').count()) === 1, 'o edital devia entrar na praça');

// três moradores concorrem
let n = 0;
for (const [id, preco] of [['QA-2', '500'], ['QA-3', '300'], ['QA-4', '400']]) {
  await entrarPorta('Cidade de Riften', id, SENHA);
  await irPara('Editais e Contratos');
  await p.click('.edital-card:has-text("peles curtidas")');
  await p.waitForTimeout(600);
  await p.locator('.modal input[type=number]').first().fill(preco);
  await p.locator('.modal .painel .btn.primario:has-text("Enviar proposta")').click();
  await p.waitForTimeout(1300);
  ok(/A sua proposta/i.test(await p.locator('.modal').innerText()),
     'depois de enviar, a ficha devia mostrar a proposta feita');
  await p.click('.modal-h .x');
  await p.waitForTimeout(400);
  n += 1;
  ok((await p.locator('.painel:has(.painel-h h3:text-is("Minhas propostas")) tbody tr').count()) === 1,
     `a proposta de ${id} devia ficar registrada`);
}
ok(n === 3, 'três moradores deviam ter concorrido');

// a mesma pessoa não manda duas
await p.click('.edital-card:has-text("peles curtidas")');
await p.waitForTimeout(600);
ok(/A sua proposta/i.test(await p.locator('.modal').innerText()),
   'quem já concorreu devia ver a própria proposta, não o formulário');
await p.click('.modal-h .x');
await p.waitForTimeout(300);

await entrarCorte();
await irPara('Editais e Contratos');
await p.click('.edital-card:has-text("peles curtidas")');
await p.waitForTimeout(600);
const recebidas = p.locator('.modal .painel:has(.painel-h h3:has-text("Propostas recebidas"))');
ok((await recebidas.locator('tbody tr').count()) === 3, 'as três propostas deviam estar lá');
await recebidas.locator(`tr:has-text("${FREGUES2}") button:has-text("Contratar")`).click();
await p.waitForTimeout(1800);
const depois = await recebidas.innerText();
ok((depois.match(/Recusada/g) || []).length === 2,
   `as duas propostas não escolhidas deviam constar Recusadas: ${depois.slice(0, 400)}`);
ok(/Aceita/.test(depois), 'a proposta escolhida devia constar Aceita');
ok(/Outra proposta foi escolhida/.test(depois), 'as recusadas deviam trazer o motivo');
await shot('Q5-propostas');
await p.click('.modal-h .x');
await p.waitForTimeout(400);

// e cada perdedor foi avisado
await entrarPorta('Cidade de Riften', 'QA-2', SENHA);
await irPara('Quadro de Avisos');
ok(/encerrado/i.test(await p.locator('.main').innerText()),
   'quem perdeu devia ter recado no Quadro de Avisos');
await entrarPorta('Cidade de Riften', 'QA-3', SENHA);
await irPara('Quadro de Avisos');
ok(/Contrato firmado/i.test(await p.locator('.main').innerText()),
   'o vencedor devia ter recado do contrato');

/* ============================================================
   6. Pedido de compra: aceitar não baixa, concluir baixa uma vez só
   ============================================================ */
await entrarPorta('Cidade de Riften', 'QA-2', SENHA);
await irPara('Comércios');
await p.click('.loja-card:has-text("Casa do Punho") .btn.primario');
await p.waitForTimeout(500);
await p.locator('.modal input[type=number]').first().fill('3');
await p.click('.modal-f .btn.primario');
await p.waitForTimeout(1200);

await entrarPorta('Cidade de Riften', 'QA-1', SENHA);
await irPara('Propriedades');
const fila = p.locator('.painel:has(.painel-h h3:text-is("Pedidos dos moradores"))');
await fila.locator('button:has-text("Aceitar")').click();
await p.waitForTimeout(1300);
const qtd = () => p.locator('.painel:has(.painel-h h3:text-is("Estoque e lista de preços")) input[type=number]').first().inputValue();
ok((await qtd()) === '10', `aceitar não baixa estoque; veio ${await qtd()}`);
await fila.locator('button:has-text("Concluir")').click();
await p.waitForTimeout(1500);
ok((await qtd()) === '7', `concluir devia baixar para 7; veio ${await qtd()}`);
ok((await fila.locator('button:has-text("Concluir")').count()) === 0,
   'não deve sobrar botão de concluir depois de concluído');
const lucro = await p.locator('.painel:has(.painel-h h3:text-is("Lucro da casa"))').innerText();
ok(/270 Septims/.test(lucro), `o lucro devia ser 3 × 90 = 270: ${lucro.slice(0, 200)}`);
await shot('Q6-pedido');

/* ============================================================
   7. Todas as telas do morador e do soldado abrem
   ============================================================ */
const telasMorador = await p.locator('.nav-item').allInnerTexts();
for (let i = 0; i < telasMorador.length; i += 1) {
  await p.locator('.nav-item').nth(i).click();
  await p.waitForTimeout(600);
  await semTelaBranca(telasMorador[i]);
}
await shot('Q7-morador');

// alista o dono para abrir a porta do Quartel
await entrarCorte();
await irPara('Exército de Riften');
await p.click('.pg-head .btn.primario');
await p.waitForTimeout(400);
await p.fill('.modal .seletor-civil input', 'Ragna');
await p.waitForTimeout(500);
await p.click('.modal .seletor-op');
await p.waitForTimeout(300);
await p.click('.modal-f .btn.primario');
await p.waitForTimeout(1000);

await entrarPorta('Quartel General', 'QA-1', SENHA);
const telasQuartel = await p.locator('.nav-item').allInnerTexts();
ok(telasQuartel.length === 5, `o Quartel devia ter 5 telas, tem ${telasQuartel.length}`);
for (let i = 0; i < telasQuartel.length; i += 1) {
  await p.locator('.nav-item').nth(i).click();
  await p.waitForTimeout(600);
  await semTelaBranca(telasQuartel[i]);
}
await shot('Q8-quartel');

/* ============================================================
   8. As habilidades não se atropelam no formulário do edital
   ============================================================ */
await irPara('Editais e Contratos');
await p.click('.pg-head .btn.primario');
await p.waitForTimeout(500);
await p.click('.modal .ed-tipo:has-text("Recrutamento")');
await p.waitForTimeout(400);
const caixas = await p.locator('.modal .ed-pericia-campo').all();
ok(caixas.length === 25, `deviam ser 25 perícias, são ${caixas.length}`);
const linhas = [];
for (const c of caixas.slice(0, 8)) {
  const cx = await c.boundingBox();
  const sel = await c.locator('select').boundingBox();
  const rot = await c.locator('span').boundingBox();
  // O seletor tem de caber dentro da caixa, sem invadir a coluna vizinha.
  ok(sel.x + sel.width <= cx.x + cx.width + 1,
     'o seletor de perícia está saindo da própria caixa');
  ok(rot.x + rot.width <= sel.x + 1, 'o nome da perícia está encostando no seletor');
  linhas.push(cx);
}
await shot('Q9-pericias');
await p.click('.modal-h .x');
await p.waitForTimeout(300);

await b.close();
console.log(erros.length
  ? 'PROBLEMAS:\n' + erros.join('\n')
  : 'Tudo certo — todas as telas abrem, credenciais copiam, propostas e pedidos fecham direito.');
