import pw from '/home/claude/.npm-global/lib/node_modules/playwright/index.js';
const { chromium } = pw;

const base = process.argv[2] || 'http://localhost:4173';
const erros = [];
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
page.on('console', m => { if (m.type() === 'error' && !/ERR_TUNNEL|Failed to load resource/.test(m.text())) erros.push('[console] ' + m.text()); });
page.on('pageerror', e => erros.push('[pageerror] ' + e.message));
const shot = n => page.screenshot({ path: `/home/claude/shots/${n}.png` });
const ok = (c, msg) => { if (!c) erros.push('[falha] ' + msg); };

await page.goto(base, { waitUntil: 'networkidle' });

await page.waitForTimeout(400);
ok(await page.locator('.portal-card').count() === 3, 'o portal deveria abrir com três caminhos');
await page.click('.portal-card:has(.portal-nome:text-is("Corte de Riften"))');
await page.waitForTimeout(400);
await page.fill('.login-caixa input >> nth=0', 'jarl@riften.rift');
await page.fill('input[type=password]', 'mistveil');
await page.click('button.primario');
await page.waitForSelector('.sidebar', { timeout: 8000 });

/* ------------------------------------------------------------
   Esta suíte conta linhas: segue sem os moradores, a casa e a
   tropa de demonstração, que existem só para quem quer testar o
   sistema à mão. O estado só nasce depois do login, por isso a
   limpeza vem aqui e não no portal.
   ------------------------------------------------------------ */
await page.evaluate(() => {
  const s = JSON.parse(localStorage.getItem('riften-hold:v1') || '{}');
  if (!s.seed_versao) return;
  s.civis = (s.civis || []).filter((c) => !['Sophia', 'Aldric', 'Varek'].includes(c.id_jogo));
  s.clas = (s.clas || []).filter((c) => c.id !== 'cla-blackwing');
  s.guardas = (s.guardas || []).filter((g) => g.id === 'g1');
  s.milicia = [];
  s.campanhas = [];
  s.propriedades = (s.propriedades || []).map((x) => (
    String(x.proprietario_civil_id || '').startsWith('c-')
      ? { ...x, proprietario: '', proprietario_civil_id: '', organizacao: '' }
      : x));
  localStorage.setItem('riften-hold:v1', JSON.stringify(s));
});
await page.reload({ waitUntil: 'networkidle' });
await page.waitForSelector('.sidebar', { timeout: 8000 });
await page.waitForTimeout(600);
await page.waitForTimeout(600);
await shot('01-palacio');

ok(await page.locator('.nav-item').count() === 12, 'menu deveria ter 12 telas');
ok(await page.locator('.cargo-card').count() === 6, 'esperava 6 cargos');
ok(await page.locator('.cla-card').count() === 0, 'lista de casas deveria começar vazia');
ok(await page.locator('.vila-card').count() === 2, 'vilarejos: só Ivarstead e Shor\'s Stone');
ok(!(await page.locator('.painel:has-text("Vilarejos")').innerText()).includes('Riften'), 'Riften não deveria aparecer entre os vilarejos');

// ---- criar uma casa nobre com brasão e membro
await page.click('.painel:has(.painel-h h3:text-is("Casas & Dinastias Nobres")) button.primario');
await page.waitForTimeout(300);
await page.fill('.modal input[placeholder="Clã ..."]', 'Casa de Teste');
await page.fill('.modal .cla-campos .seletor-civil input', 'Aldric Pedravalente');
await page.setInputFiles('.modal input[type=file]', '/tmp/brasao.png');
await page.waitForTimeout(700);
ok(await page.locator('.brasao-quadro img').count() === 1, 'brasão não carregou');
await page.click('.modal button:has-text("Adicionar membro")');
await page.waitForTimeout(200);
await page.fill('.lista-membros .seletor-civil input', 'Vera Pedravalente');
await shot('02-ficha-cla');
await page.click('.modal-f .btn.primario');
await page.waitForTimeout(700);
ok(await page.locator('.cla-card').count() === 1, 'casa não foi criada');
ok((await page.locator('.cla-card').innerText()).includes('1 membro'), 'membro não contabilizado');
ok(await page.locator('.cla-card .cla-brasao img').count() === 1, 'brasão não aparece no cartão');
await shot('03-casas');

// ---- vilarejo: catalogação + casas
await page.click('.vila-card:has-text("Ivarstead")');
await page.waitForTimeout(400);
const itensIvar = await page.locator('.lista-itens li').count();
ok(itensIvar === 8, `Ivarstead deveria herdar 8 tipos da Fellstar Farm, achei ${itensIvar}`);
const textoIvar = await page.locator('.modal .editor-cat').innerText();
ok(!/Invent/.test(textoIvar), 'inventário de armazenamento não deveria entrar no território');
await shot('04a-ivarstead');
await page.click('.modal-h .x');
await page.waitForTimeout(400);
await page.click('.vila-card:has-text("Shor")');
await page.waitForTimeout(400);
const itensVila = await page.locator('.lista-itens li').count();
ok(itensVila === 7, `esperava 7 itens catalogados em Shor's Stone, achei ${itensVila}`);
const casas = await page.locator('.lista-props li').count();
ok(casas === 3, `esperava 3 casas em Shor's Stone, achei ${casas}`);
await shot('04-vilarejo');
// adiciona um item pelo catálogo de ícones
await page.click('.editor-cat button:has-text("Adicionar item")');
await page.waitForTimeout(250);
await page.click('.seletor-abas .aba:has-text("Cultivo")');
await page.waitForTimeout(200);
await page.click('.item-opcao:has-text("Trigo")');
await page.waitForTimeout(250);
ok(await page.locator('.lista-itens li').count() === 8, 'item não foi adicionado');
await shot('05-catalogo-itens');
await page.click('.modal-f .btn.primario');
await page.waitForTimeout(700);

// ---- comércios: sem casas
await page.click('.nav-item:has-text("Imobiliária")');
await page.waitForTimeout(600);
const cards = await page.locator('.prop-card').count();
ok(cards === 13, `esperava 13 comércios (sem casas), achei ${cards}`);
const textos = await page.locator('.prop-card').allInnerTexts();
ok(!textos.some(t => /House/.test(t)), 'apareceu uma casa na tela de comércios');
ok(!textos.some(t => /A Rift/.test(t)), 'a tag "A Rift" ainda aparece nos comércios');
ok(await page.locator('.cat-chip').count() > 10, 'chips de catalogação não renderizaram');
await shot('06-comercios');

await page.click('.prop-card:has-text("Sarethi") button:has-text("Abrir ficha")');
await page.waitForTimeout(400);
ok(await page.locator('.modal .lista-itens li').count() === 8, 'catalogação da Sarethi Farm incompleta');
await shot('07-ficha-comercio');
await page.click('.modal-h .x');

// ---- exército
await page.click('.nav-item:has-text("Exército")');
await page.waitForTimeout(500);
await page.click('.aba-forca:has-text("Efetivo")');
await page.waitForTimeout(500);
await page.click('td .nome-forte');
await page.waitForTimeout(400);
await shot('08-ficha-guarda');
await page.click('.modal-h .x');

console.log(erros.length ? 'PROBLEMAS:\n' + erros.join('\n') : 'Tudo certo — nenhum erro nem falha de verificação.');
await browser.close();
