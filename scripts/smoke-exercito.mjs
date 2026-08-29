/**
 * FORÇAS DE RIFTEN
 *
 *  1. A tela soma as três forças: Exército + Mesnadas + Milícia.
 *  2. A Corte cria uma divisão, escreve as funções e aponta o capitão.
 *  3. A Corte cria uma patente, arbitra o soldo e reordena a hierarquia.
 *  4. A milícia é convocada por campanha e devolvida ao encerrar.
 *  5. O morador se alista sozinho pela ficha dele.
 *
 *  A folha de pagamento saiu daqui: agora é da Tesouraria, e quem a
 *  cobre é smoke-tesouraria.
 */
import pw from '/home/claude/.npm-global/lib/node_modules/playwright/index.js';
const { chromium } = pw;
const erros = [];
const ok = (c, m) => { if (!c) erros.push('[falha] ' + m); };
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1440, height: 1300 } });
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
  await p.fill('.login-caixa input >> nth=0', 'Jarl');
  await p.fill('input[type=password]', '123');
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
const aba = async (nome) => { await p.click(`.aba-forca:has-text("${nome}")`); await p.waitForTimeout(600); };

/** Escolhe a opção cujo texto contém o trecho — `label` não aceita regex. */
const escolher = async (seletor, trecho) => {
  const caixa = p.locator(seletor).first();
  const textos = await caixa.locator('option').allInnerTexts();
  const alvo = textos.find((t) => t.includes(trecho));
  if (!alvo) { erros.push(`[falha] não achei a opção "${trecho}" em ${seletor}`); return; }
  await caixa.selectOption({ label: alvo });
};

await p.goto('http://localhost:4173', { waitUntil: 'networkidle' });

/* ============================================================
   Cenário: a tropa e a casa nobre da demonstração, mais um
   morador para se alistar na milícia.
   ============================================================ */
await p.evaluate(() => {
  const s = JSON.parse(localStorage.getItem('riften-hold:v1') || '{}');
  const uid = () => crypto.randomUUID();
  s.civis = [
    ...(s.civis || []).filter((x) => x.id_jogo !== 'EXE-1'),
    { id: uid(), nome: 'Ulric Braço-Torto', id_jogo: 'EXE-1', senha_acesso: 'EEEE-1111',
      status: 'Aprovado', raca: 'Nórdico', origem: 'natal' },
  ];
  s.milicia = (s.milicia || []).filter((m) => m.id_jogo !== 'EXE-1');
  s.campanhas = [];
  localStorage.setItem('riften-hold:v1', JSON.stringify(s));
});

/* ============================================================
   1. As três forças somam
   ============================================================ */
await entrarCorte();
await irPara('Exército de Riften');
const forcas = await p.locator('.main').innerText();
ok(/for[çc]a total do hold/i.test(forcas), 'a tela devia abrir na soma das três forças');
ok(/mesnadas/i.test(forcas), 'as mesnadas deviam aparecer nas forças');
ok(/mil[íi]cia/i.test(forcas), 'a milícia devia aparecer nas forças');
ok(/Ordem do Drag[ãa]o Negro/i.test(forcas),
   'a mesnada da Casa Blackwing devia ser contada pelo nome próprio');

const somaMenu = Number((await p.locator('.nav-item:has-text("Exército de Riften") .badge-num').innerText()).trim());
const soldados = await p.evaluate(() => {
  const s = JSON.parse(localStorage.getItem('riften-hold:v1') || '{}');
  // Aposentado é registro, não força: conta no rol, não no poderio.
  const tropa = (s.guardas || []).filter((g) => g.status !== 'Aposentado').length;
  const mesnadas = (s.clas || [])
    .filter((c) => c.mesnada_em)
    .reduce((n, c) => n + (c.soldados || []).length, 0);
  const milicia = (s.milicia || []).filter((m) => m.situacao !== 'Dispensado').length;
  return { tropa, mesnadas, milicia };
});
ok(somaMenu === soldados.tropa + soldados.mesnadas + soldados.milicia,
   `o número do menu (${somaMenu}) devia ser a soma das três forças (${JSON.stringify(soldados)})`);
await shot('E1-forcas');

/* ============================================================
   2. Criar uma divisão, escrever funções e apontar capitão
   ============================================================ */
await aba('Divisões');
const antesDiv = await p.locator('.divisao-linha').count();
await p.click('.painel-h .btn.primario');
await p.waitForTimeout(400);
await p.fill('.modal .campo:has(span:text-is("Nome da divisão")) input', 'Vigia do Lago');
await p.fill('.modal textarea', 'Guarda as docas e as barcaças do Lago Honrich.');
await escolher('.modal .campo:has(span:text-is("Capitão da divisão")) select', 'Sigrid');
await p.click('.modal-f .btn.primario');
await p.waitForTimeout(900);

const depoisDiv = await p.locator('.divisao-linha').count();
ok(depoisDiv === antesDiv + 1, `a divisão nova não entrou na lista (${antesDiv} → ${depoisDiv})`);
const cartao = p.locator('.divisao-linha:has-text("Vigia do Lago")');
ok(await cartao.count() === 1, 'a divisão "Vigia do Lago" devia aparecer');
ok(/docas e as barcaças/i.test(await cartao.innerText()), 'as funções escritas deviam ficar salvas');

// Nome repetido é recusado.
await p.click('.painel-h .btn.primario');
await p.waitForTimeout(400);
await p.fill('.modal .campo:has(span:text-is("Nome da divisão")) input', 'Vigia do Lago');
await p.click('.modal-f .btn.primario');
await p.waitForTimeout(600);
ok(await p.locator('.modal .login-erro').count() === 1, 'duas divisões com o mesmo nome deviam ser recusadas');
await p.click('.modal-h .x');
await p.waitForTimeout(300);

// O capitão é apontado na própria linha.
await escolher('.divisao-linha:has-text("Vigia do Lago") select', 'Bjorn');
await p.waitForTimeout(900);
ok(/Bjorn/.test(await cartao.innerText()), 'o capitão apontado devia ficar na divisão');
await shot('E2-divisoes');

/* ============================================================
   3. A hierarquia é editável
   ============================================================ */
await aba('Hierarquia');
const antesPat = await p.locator('.degrau').count();
await p.click('.painel-h .btn.primario');
await p.waitForTimeout(400);
await p.fill('.modal .campo:has(span:text-is("Nome da patente")) input', 'Alferes');
await p.fill('.modal .campo:has(span:text-is("Soldo semanal (Septims)")) input', '750');
await p.fill('.modal textarea', 'Substitui o capitão quando ele falta.');
await p.click('.modal-f .btn.primario');
await p.waitForTimeout(900);

const depoisPat = await p.locator('.degrau').count();
ok(depoisPat === antesPat + 1, `a patente nova não entrou na hierarquia (${antesPat} → ${depoisPat})`);
const alferes = p.locator('.degrau:has-text("Alferes")');
ok(/750/.test(await alferes.innerText()), 'o soldo da patente nova devia aparecer');

// Posto novo nasce na base da escada — nunca acima do comando — e sobe
// um degrau quando a Corte manda.
const baseAntes = (await p.locator('.degrau .degrau-corpo h4').last().innerText()).trim();
ok(/Alferes/i.test(baseAntes), `a patente nova devia nascer na base, e a base é "${baseAntes}"`);
await p.locator('.degrau').last().locator('button[title="Subir na hierarquia"]').click();
await p.waitForTimeout(1500);
const baseDepois = (await p.locator('.degrau .degrau-corpo h4').last().innerText()).trim();
ok(!/Alferes/i.test(baseDepois), `depois de subir, "${baseDepois}" devia ficar na base`);
await shot('E3-hierarquia');

/* ============================================================
   5. A milícia: convocar e encerrar
   ============================================================ */
await aba('Milícia');
await p.click('.painel-h .btn.primario');   // Abrir convocação
await p.waitForTimeout(400);
await p.fill('.modal .campo:has(span:text-is("Nome da campanha")) input', 'Defesa da Estrada do Rift');
await p.fill('.modal textarea', 'Bandidos cercaram as caravanas na altura de Ivarstead.');
await p.click('.modal-f .btn.primario');
await p.waitForTimeout(1000);
ok(/Defesa da Estrada do Rift/.test(await p.locator('.main').innerText()),
   'a campanha aberta devia aparecer no cartaz');

await p.locator('tbody input[type=checkbox]').first().check();
await p.waitForTimeout(300);
await p.click('button:has-text("Convocar marcados")');
await p.waitForTimeout(1200);
ok(await p.locator('.selo:text-is("Convocado")').count() > 0, 'o marcado devia ficar convocado');

// Convocado entra na conta das forças prontas.
await aba('Forças de Riften');
ok(/1 convocado/.test(await p.locator('.main').innerText()),
   'a milícia convocada devia contar na tela das forças');
await shot('E5-milicia');

/* ============================================================
   6. O morador se alista sozinho — e não sai em campanha
   ============================================================ */
await entrarCidade('EXE-1', 'EEEE-1111');
const fichaMorador = await p.locator('.main').innerText();
ok(/mil[íi]cia de riften/i.test(fichaMorador), 'o morador devia ver o painel da milícia');
await p.click('button:has-text("Quero me alistar")');
await p.waitForTimeout(400);
await p.fill('.painel textarea', 'Sei atirar de arco e conheço as trilhas.');
await p.click('button:has-text("Alistar-me na milícia")');
await p.waitForTimeout(1200);
ok(/Você está na lista da milícia/.test(await p.locator('.main').innerText()),
   'o alistamento do morador não foi registrado');
await shot('E6-morador');

// A Corte convoca; ele deixa de poder sair.
await entrarCorte();
await irPara('Exército de Riften');
await aba('Milícia');
await p.locator('tr:has-text("Ulric Braço-Torto") input[type=checkbox]').check();
await p.click('button:has-text("Convocar marcados")');
await p.waitForTimeout(1200);

await entrarCidade('EXE-1', 'EEEE-1111');
const convocado = p.locator('.painel:has-text("Milícia de Riften")');
ok(/Convocado/.test(await convocado.innerText()), 'o morador devia se ver convocado');
ok(await convocado.locator('button:has-text("Sair da milícia")').isDisabled(),
   'não se abandona a milícia no meio de uma campanha');

// Encerrada a campanha, todos voltam.
await entrarCorte();
await irPara('Exército de Riften');
await aba('Milícia');
await p.click('button:has-text("Encerrar campanha")');
await p.waitForTimeout(400);
await p.click('.modal-f .btn.primario');
await p.waitForTimeout(1300);
const depoisDoFim = await p.locator('.main').innerText();
ok(await p.locator('.selo:text-is("Convocado")').count() === 0,
   'encerrada a campanha, ninguém continua convocado');
ok(/campanhas encerradas/i.test(depoisDoFim), 'a campanha encerrada devia ficar no histórico');
await shot('E7-encerrada');

/* ============================================================
   7. O soldado vê a própria divisão e o próprio soldo
   ============================================================ */
await aoPortal();
await p.click('.portal-card:has(.portal-nome:text-is("Quartel General"))');
await p.waitForTimeout(300);
await p.fill('.login-caixa input >> nth=0', 'Varek');
await p.fill('.login-caixa input[type=password]', '123');
await p.click('.login-caixa form button.primario');
await p.waitForSelector('.sidebar', { timeout: 8000 });
await p.waitForTimeout(800);
const quartel = await p.locator('.main').innerText();
ok(/meu soldo/i.test(quartel), 'o soldado devia ver o próprio soldo');
ok(/Investiga[çc][ãa]o/i.test(quartel), 'o soldado devia ver a divisão dele');
ok(/Pr[óo]ximo pagamento/i.test(quartel), 'o soldado devia ver a data do próximo pagamento');
await shot('E8-soldado');

console.log(erros.length
  ? 'PROBLEMAS:\n' + erros.join('\n')
  : 'Tudo certo — divisões, hierarquia, milícia convocada e mesnadas somadas.');
await b.close();
