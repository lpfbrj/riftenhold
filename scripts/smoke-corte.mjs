/**
 * PERSONALIZAÇÃO DA CORTE E OFÍCIO NA FICHA
 *
 *  1. O morador troca profissão e nível na própria ficha, e a Corte enxerga.
 *  2. A Corte cria um cargo novo, nomeia alguém, renomeia o cargo e o extingue.
 *  3. No quadro da Corte, o cartão mostra o título de nobreza de quem ocupa
 *     o cargo — não a raça.
 */
import pw from '/home/claude/.npm-global/lib/node_modules/playwright/index.js';
const { chromium } = pw;
const erros = [];
const ok = (c, m) => { if (!c) erros.push('[falha] ' + m); };
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1440, height: 1100 } });
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

const THANE = 'Ulfrid Corta-Vento';
const SENHA = 'RFT-MMMM-345';

await p.goto('http://localhost:4173', { waitUntil: 'networkidle' });

// Um morador aprovado, já membro de uma casa nobre com título de Thane.
await p.evaluate(([THANE, SENHA]) => {
  const s = JSON.parse(localStorage.getItem('riften-hold:v1') || '{}');
  s.civis = [{
    id: 'civil-thane', nome: THANE, id_jogo: 'SKY-9001', raca: 'Nórdico',
    profissao: '', nivel: 'Novato', status: 'Aprovado', senha_acesso: SENHA, notas: '',
  }, ...(s.civis || [])];
  s.clas = [{
    id: 'casa-vento', nome: 'Corta-Vento', cor: '#7c6bb0', titulo_lider: 'Patriarca',
    lider: 'Alguém', lider_civil_id: '', lider_titulo: 'Nobre',
    membros: [{ nome: THANE, civil_id: 'civil-thane', titulo: 'Thane' }],
    servos: [], notas: '',
  }, ...(s.clas || [])];
  localStorage.setItem('riften-hold:v1', JSON.stringify(s));
}, [THANE, SENHA]);

/* ============================================================
   1. Profissão e nível, editados pelo próprio jogador
   ============================================================ */
await entrarCidade('SKY-9001', SENHA);
const dados = p.locator('.painel:has(.painel-h h3:text-is("Meus dados"))');
ok((await dados.locator('.btn:has-text("Editar")').count()) === 1,
   'o quadro Meus dados devia ter o próprio botão de editar');
await dados.locator('.btn:has-text("Editar")').click();
await p.waitForTimeout(400);

const rotulos = await dados.locator('.campo > span').allInnerTexts();
ok(rotulos.some(t => /^Profissão$/i.test(t)), `falta o campo Profissão: ${rotulos.join(', ')}`);
ok(rotulos.some(t => /Nível da profissão/i.test(t)), `falta o campo Nível: ${rotulos.join(', ')}`);

await dados.locator('.campo:has(span:text-is("Profissão")) select').selectOption('Alquimista');
await dados.locator('.campo:has(span:text-is("Nível da profissão")) select').selectOption('Especialista');
await shot('C1-edita-oficio');
await dados.locator('.btn.primario:has-text("Salvar minha ficha")').click();
await p.waitForTimeout(1000);
const depois = await dados.innerText();
ok(/Alquimista/.test(depois), `a profissão devia ficar salva: ${depois.slice(0, 200)}`);
ok(/Especialista/.test(depois), 'o nível devia ficar salvo');

// e a Corte enxerga a mudança
await entrarCorte();
await irPara('Registro Civil');
ok(/Alquimista/.test(await p.locator(`tr:has-text("${THANE}")`).innerText()),
   'o Registro Civil devia mostrar a profissão nova');

/* ============================================================
   2. A Corte cria, edita e extingue um cargo
   ============================================================ */
await irPara('Palácio do Jarl');
const corte = p.locator('.painel:has(.painel-h h3:text-is("A Corte"))');
ok((await corte.locator('.cargo-card').count()) === 6, 'a Corte devia começar com os seis cargos');

await corte.locator('.btn.primario:has-text("Novo cargo")').click();
await p.waitForTimeout(400);
await p.fill('.modal .grade.g2 input >> nth=0', 'Mestre dos Sussurros');
await p.fill('.modal textarea', 'Responde pelos informantes do Hold.');
await p.click('.modal-f .btn.primario');
await p.waitForTimeout(1000);
ok((await corte.locator('.cargo-card').count()) === 7, 'o cargo novo não entrou no quadro');
const novo = corte.locator('.cargo-card:has-text("Mestre dos Sussurros")');
ok(/Cargo vago/i.test(await novo.innerText()), 'cargo recém-criado devia nascer vago');
ok(/informantes/i.test(await novo.innerText()), 'a descrição escrita devia aparecer');
await shot('C2-cargo-novo');

// nomear o Thane nele
await novo.locator('.btn:has-text("Nomear")').click();
await p.waitForTimeout(500);
await p.fill('.modal .seletor-civil input', 'Ulfrid');
await p.waitForTimeout(500);
await p.click('.modal .seletor-op');
await p.waitForTimeout(300);
await p.click('.modal-f .btn.primario');
await p.waitForTimeout(1000);

/* ============================================================
   3. No cartão vale o título de nobreza, não a raça
   ============================================================ */
const ocupado = await corte.locator('.cargo-card:has-text("Mestre dos Sussurros")').innerText();
ok(new RegExp(THANE).test(ocupado), 'o nomeado devia aparecer no cartão');
ok(/Thane/.test(ocupado), `o cartão devia trazer o título de nobreza: ${ocupado}`);
ok(!/Nórdico/.test(ocupado), `a raça não devia mais aparecer no cartão: ${ocupado}`);
await shot('C3-tag-nobreza');

// o mesmo vale para um cargo de fábrica
await corte.locator('.cargo-card:has(.cargo-nome:has-text("Jarl")) .btn:has-text("Nomear")').click();
await p.waitForTimeout(500);
await p.fill('.modal .seletor-civil input', 'Ulfrid');
await p.waitForTimeout(500);
await p.click('.modal .seletor-op');
await p.waitForTimeout(300);
await p.click('.modal-f .btn.primario');
await p.waitForTimeout(1000);
ok(/Thane/.test(await corte.locator('.cargo-card:has(.cargo-nome:has-text("Jarl"))').innerText()),
   'o título de nobreza devia acompanhar o nomeado em qualquer cargo');

/* ============================================================
   4. Renomear e extinguir
   ============================================================ */
await corte.locator('.cargo-card:has-text("Mestre dos Sussurros") .cargo-def').click();
await p.waitForTimeout(400);
await p.fill('.modal .grade.g2 input >> nth=0', 'Mestre das Sombras');
await p.click('.modal-f .btn.primario');
await p.waitForTimeout(1000);
ok((await corte.locator('.cargo-card:has-text("Mestre das Sombras")').count()) === 1,
   'o cargo devia atender pelo nome novo');
ok(new RegExp(THANE).test(await corte.locator('.cargo-card:has-text("Mestre das Sombras")').innerText()),
   'renomear o cargo não devia desfazer a nomeação');

// um cargo de fábrica pode ser renomeado, mas não extinto
await corte.locator('.cargo-card:has-text("Mago da Corte") .cargo-def').click();
await p.waitForTimeout(400);
ok((await p.locator('.modal .btn.perigo:has-text("Extinguir")').count()) === 0,
   'cargo de fábrica não pode ser extinto');
ok(/não extinto/i.test(await p.locator('.modal .ajuda').innerText()),
   'o formulário devia explicar por que não há como extinguir');
await p.fill('.modal .grade.g2 input >> nth=0', 'Arquimago de Riften');
await p.click('.modal-f .btn.primario');
await p.waitForTimeout(1000);
ok((await corte.locator('.cargo-card:has-text("Arquimago de Riften")').count()) === 1,
   'o cargo de fábrica devia aceitar o nome novo');
await shot('C4-renomeado');

// e o criado sai quando a Corte quiser
await corte.locator('.cargo-card:has-text("Mestre das Sombras") .cargo-def').click();
await p.waitForTimeout(400);
await p.click('.modal .btn.perigo:has-text("Extinguir")');
await p.waitForTimeout(400);
await p.click('.modal-f .btn.perigo');
await p.waitForTimeout(1000);
ok((await corte.locator('.cargo-card').count()) === 6, 'o cargo extinto devia sair do quadro');
ok((await corte.locator('.cargo-card:has-text("Mestre das Sombras")').count()) === 0,
   'o cargo extinto não devia mais aparecer');

// o nome novo do cargo de fábrica chega à ficha de quem o ocupa
await irPara('Registro Civil');
await p.locator(`tr:has-text("${THANE}") .link-perfil`).first().click();
await p.waitForTimeout(600);
ok(/Jarl/.test(await p.locator('.modal').innerText()), 'o perfil devia mostrar o cargo do nomeado');
await p.click('.modal-h .x');
await p.waitForTimeout(300);

await b.close();
console.log(erros.length
  ? 'PROBLEMAS:\n' + erros.join('\n')
  : 'Tudo certo — ofício editável na ficha, cargos personalizáveis e tag de nobreza no quadro.');
