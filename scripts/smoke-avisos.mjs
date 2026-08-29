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
  await p.click('.portal-card:has(.portal-nome:text-is("Corte de Riften"))');
  await p.waitForTimeout(300);
  await p.fill('.login-caixa input >> nth=0', 'jarl@riften.rift');
  await p.fill('input[type=password]', 'mistveil');
  await p.click('.login-caixa form button.primario');
  await p.waitForSelector('.sidebar', { timeout: 8000 });
  await p.waitForTimeout(500);
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
async function cadastrar(nome, id) {
  await aoPortal();
  await p.click('.portal-card:has(.portal-nome:text-is("Cidade de Riften"))');
  await p.waitForTimeout(350);
  await p.click('.login-alternativa .btn');
  await p.waitForTimeout(400);
  await p.fill('.registro-caixa input >> nth=0', nome);
  await p.fill('.registro-caixa input >> nth=1', id);
  await p.selectOption('.registro-caixa select >> nth=0', { index: 1 });
  await p.click('.registro-caixa form button.primario');
  await p.waitForTimeout(800);
  await aoPortal();
  await entrarCorte();
  await p.click('.nav-item:has-text("Registro Civil")');
  await p.waitForTimeout(600);
  await p.locator(`.civil-pedido:has-text("${nome}") button:has-text("Aprovar")`).click();
  await p.waitForTimeout(800);
  const senha = (await p.locator('.cred-val.grande').innerText()).trim();
  await p.click('.modal-f .btn.primario');
  await p.waitForTimeout(400);
  return senha;
}

await p.goto('http://localhost:4173', { waitUntil: 'networkidle' });

const PAT = 'Eirik Punho-de-Ferro';
const ID_PAT = 'SKY-7001';
const INDICADO = 'Runa Punho-de-Ferro';
const ID_IND = 'SKY-7002';
const OUTRO = 'Gorm, o Pescador';
const ID_OUTRO = 'SKY-7003';

const senhaPat = await cadastrar(PAT, ID_PAT);
await cadastrar(INDICADO, ID_IND);
const senhaOutro = await cadastrar(OUTRO, ID_OUTRO);

// -------- 1. A Corte publica no Quadro de Avisos --------
await p.click('.nav-item:has-text("Quadro de Avisos")');
await p.waitForTimeout(600);
ok(/Quadro de Avisos/.test(await p.locator('.pg-head h1').innerText()), 'não abriu o Quadro de Avisos');
await p.click('.pg-head .btn.primario');
await p.waitForTimeout(400);
await p.fill('.modal input', 'Toque de recolher no Mercado');
await p.fill('.modal textarea', 'A partir desta noite, o Mercado fecha ao pôr do sol. A Guarda dobra a ronda.');
await shot('V1-publicar');
await p.click('.modal-f .btn.primario');
await p.waitForTimeout(900);
const mural = await p.locator('.main').innerText();
ok(/Toque de recolher no Mercado/.test(mural), 'a publicação não apareceu no mural');
ok(/A Guarda dobra a ronda/.test(mural), 'o texto do aviso não apareceu');
ok(/\d{2}\/\d{2}\/\d{4}/.test(mural), 'a data da publicação não aparece');
await shot('V2-mural-corte');

// -------- 2. Chega a quem tem registro em Riften --------
await entrarCidade(ID_OUTRO, senhaOutro);
const menuCidadao = await p.locator('.nav-item').allInnerTexts();
ok(menuCidadao.some(t => /Quadro de Avisos/.test(t)), 'falta o Quadro de Avisos para o morador');
await p.click('.nav-item:has-text("Quadro de Avisos")');
await p.waitForTimeout(600);
const muralMorador = await p.locator('.main').innerText();
ok(/Toque de recolher no Mercado/.test(muralMorador), 'o morador não recebeu a publicação');
ok(!/Publicar aviso/.test(muralMorador), 'o morador não pode publicar');
ok((await p.locator('.pg-head .btn').count()) === 0, 'o morador não devia ter botão de ação aqui');
await shot('V3-mural-morador');

// -------- 3. A Corte funda a casa e o patriarca indica alguém --------
await aoPortal();
await entrarCorte();
await p.click('.nav-item:has-text("Palácio do Jarl")');
await p.waitForTimeout(600);
await p.click('.painel:has(.painel-h h3:text-is("Casas & Dinastias Nobres")) .btn.primario');
await p.waitForTimeout(400);
await p.fill('.cla-campos input >> nth=0', 'Punho-de-Ferro');
await p.fill('.cla-campos .seletor-civil input', 'Eirik');
await p.waitForTimeout(400);
await p.click('.cla-campos .seletor-op');
await p.waitForTimeout(300);
await p.click('.modal-f .btn.primario');
await p.waitForTimeout(900);

await entrarCidade(ID_PAT, senhaPat);
await p.click('.nav-item:has-text("Dinastia")');
await p.waitForTimeout(600);
await p.click('.pg-head .btn.primario');
await p.waitForTimeout(400);
await p.fill('.modal .seletor-civil input', 'Runa');
await p.waitForTimeout(400);
await p.click('.modal .seletor-op');
await p.waitForTimeout(300);
await p.fill('.modal input[placeholder*="Filho"]', 'Irmã');
await p.click('.modal-f .btn.primario');
await p.waitForTimeout(1000);

// -------- 4. O pedido chega DENTRO do quadro da Nobreza --------
await aoPortal();
await entrarCorte();
await p.click('.nav-item:has-text("Palácio do Jarl")');
await p.waitForTimeout(800);
ok((await p.locator('.painel:has(.painel-h h3:text-is("Pedidos das Casas"))').count()) === 0,
   'o quadro separado de Pedidos das Casas devia ter sumido');
const nobreza = p.locator('.painel:has(.painel-h h3:text-is("Nobreza de Riften"))');
const txt = await nobreza.innerText();
ok(txt.includes(INDICADO), 'o pedido devia aparecer dentro do quadro da Nobreza');
ok(/aguardando aval/i.test(txt), 'faltou marcar o pedido como aguardando aval');
ok(/indicado por Eirik/i.test(txt), 'o quadro não diz quem indicou');
ok((await nobreza.locator('tr.linha-pendente').count()) === 1, 'esperava 1 linha pendente');

// -------- 5. Sumiu o seletor de título da lista --------
ok((await nobreza.locator('tbody select').count()) === 0,
   'o seletor de título não devia mais existir na lista da Nobreza');
ok(/editado na ficha da casa/i.test(txt), 'faltou dizer onde o título é editado');
await nobreza.scrollIntoViewIfNeeded();
await p.waitForTimeout(300);
await shot('V4-nobreza-pendente');

// -------- 6. Recusar tira da lista e avisa quem indicou --------
await nobreza.locator('tr.linha-pendente button:has-text("Recusar")').click();
await p.waitForTimeout(400);
await p.fill('.modal textarea', 'Linhagem ainda não comprovada perante a Corte.');
await p.click('.modal-f .btn.perigo');
await p.waitForTimeout(1100);
const depois = await nobreza.innerText();
ok(!depois.includes(INDICADO), 'o recusado devia sair da lista da Nobreza');
ok((await nobreza.locator('tr.linha-pendente').count()) === 0, 'não devia sobrar linha pendente');
await shot('V5-recusado');

// -------- 7. O recado é pessoal: o outro morador não vê --------
await entrarCidade(ID_OUTRO, senhaOutro);
await p.click('.nav-item:has-text("Quadro de Avisos")');
await p.waitForTimeout(600);
const muralOutro = await p.locator('.main').innerText();
ok(/Toque de recolher/.test(muralOutro), 'o aviso geral devia continuar visível');
ok(!/recusou a entrada/i.test(muralOutro), 'o recado da recusa não é para este morador');
ok(!/Para você/i.test(muralOutro), 'este morador não tem recado pessoal');

// -------- 8. Quem indicou recebe o recado --------
await entrarCidade(ID_PAT, senhaPat);
await p.click('.nav-item:has-text("Quadro de Avisos")');
await p.waitForTimeout(600);
const muralPat = await p.locator('.main').innerText();
ok(/Para você/i.test(muralPat), 'faltou a seção de recados pessoais');
ok(/recusou a entrada de Runa/i.test(muralPat), 'o patriarca não recebeu o recado da recusa');
ok(/Linhagem ainda não comprovada/.test(muralPat), 'o motivo da recusa não chegou');
ok(/Toque de recolher/.test(muralPat), 'o aviso geral também devia estar aqui');
ok((await p.locator('.aviso.pessoal').count()) === 1, 'esperava 1 recado pessoal');
await shot('V6-recado-pessoal');

// -------- 9. Aprovar também avisa, e o nobre entra na lista --------
await p.click('.nav-item:has-text("Dinastia")');
await p.waitForTimeout(600);
await p.click('.pg-head .btn.primario');
await p.waitForTimeout(400);
await p.fill('.modal .seletor-civil input', 'Runa');
await p.waitForTimeout(400);
await p.click('.modal .seletor-op');
await p.waitForTimeout(300);
await p.click('.modal-f .btn.primario');
await p.waitForTimeout(1000);

await aoPortal();
await entrarCorte();
await p.click('.nav-item:has-text("Palácio do Jarl")');
await p.waitForTimeout(800);
const nobreza2 = p.locator('.painel:has(.painel-h h3:text-is("Nobreza de Riften"))');
await nobreza2.locator('tr.linha-pendente button:has-text("Aprovar")').click();
await p.waitForTimeout(1100);
const aprovada = await nobreza2.innerText();
ok((await nobreza2.locator('tr.linha-pendente').count()) === 0, 'a linha pendente devia sumir');
ok(aprovada.includes(INDICADO), 'a aprovada devia entrar na lista da Nobreza');
ok(/Membro da Dinastia/.test(aprovada), 'a aprovada devia constar como Membro da Dinastia');
await shot('V7-aprovada');

// -------- 10. E o patriarca é avisado da aprovação --------
await entrarCidade(ID_PAT, senhaPat);
await p.click('.nav-item:has-text("Quadro de Avisos")');
await p.waitForTimeout(600);
const muralFinal = await p.locator('.main').innerText();
ok(/entrou na Casa Punho-de-Ferro/i.test(muralFinal), 'faltou o recado da aprovação');
ok((await p.locator('.aviso.pessoal').count()) === 2, 'esperava 2 recados pessoais');

// -------- 11. O título continua editável na ficha da casa --------
await aoPortal();
await entrarCorte();
await p.click('.nav-item:has-text("Palácio do Jarl")');
await p.waitForTimeout(700);
await p.click('.cla-card .cla-abrir');
await p.waitForTimeout(500);
const fichaCasa = await p.locator('.modal').innerText();
ok(/Título na Nobreza/i.test(fichaCasa), 'a ficha da casa devia ter o título do chefe');
ok((await p.locator('.lista-membros select').count()) >= 1,
   'a ficha da casa devia ter o seletor de título do membro');
await shot('V8-titulo-na-casa');

await b.close();
console.log(erros.length
  ? 'PROBLEMAS:\n' + erros.join('\n')
  : 'Tudo certo — pedidos dentro da Nobreza, título só na casa e Quadro de Avisos chegando a todos.');
