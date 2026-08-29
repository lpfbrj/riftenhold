import pw from '/home/claude/.npm-global/lib/node_modules/playwright/index.js';
const { chromium } = pw;
const erros = [];
const ok = (c, m) => { if (!c) erros.push('[falha] ' + m); };
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1440, height: 1050 } });
p.on('pageerror', e => erros.push('[pageerror] ' + e.message));
p.on('console', m => { if (m.type() === 'error' && !/ERR_TUNNEL|Failed to load resource/.test(m.text())) erros.push('[console] ' + m.text()); });
const shot = n => p.screenshot({ path: `/home/claude/shots/${n}.png` });
const limpar = () => p.evaluate(() => {
  sessionStorage.removeItem('riften-hold:sessao');
  sessionStorage.removeItem('riften-hold:cidadao');
});
const aoPortal = async () => { await limpar(); await p.reload({ waitUntil: 'networkidle' }); await p.waitForTimeout(400); };
const porta = async (nome) => p.click(`.portal-card:has(.portal-nome:text-is("${nome}"))`);
const entrarCorte = async () => {
  await porta('Corte de Riften');
  await p.waitForTimeout(300);
  await p.fill('.login-caixa input >> nth=0', 'jarl@riften.rift');
  await p.fill('input[type=password]', 'mistveil');
  await p.click('.login-caixa form button.primario');
  await p.waitForSelector('.sidebar', { timeout: 8000 });
  await p.waitForTimeout(500);
};

await p.goto('http://localhost:4173', { waitUntil: 'networkidle' });
await aoPortal();

// -------- 1. O portal tem três portas --------
const portas = await p.locator('.portal-nome').allInnerTexts();
ok(portas.length === 3, `esperava 3 portas, achei ${portas.length}: ${portas.join(', ')}`);
ok(portas[0] === 'Corte de Riften' && portas[1] === 'Cidade de Riften'
   && portas[2] === 'Quartel General', `portas erradas: ${portas.join(' / ')}`);
await shot('A1-portal');

// -------- 2. Registro Civil pela Cidade --------
await porta('Cidade de Riften');
await p.waitForTimeout(400);
ok((await p.locator('.login-caixa.cidade').count()) === 1, 'não abriu o login da Cidade');
await p.click('.login-alternativa .btn');
await p.waitForTimeout(400);
ok((await p.locator('.registro-caixa').count()) === 1, 'não abriu o formulário de Registro Civil');

const NOME = 'Sigrid Pedra-Firme';
const ID = 'SKY-77420';
await p.fill('.registro-caixa input >> nth=0', NOME);
await p.fill('.registro-caixa input >> nth=1', ID);
const selects = p.locator('.registro-caixa select');
await selects.nth(0).selectOption({ index: 1 });
await selects.nth(1).selectOption({ label: 'Ferreiro' }).catch(() => selects.nth(1).selectOption({ index: 1 }));
await p.locator('.registro-caixa textarea').fill('Vim de Ivarstead para trabalhar a forja.');
await p.click('.registro-caixa form button.primario');
await p.waitForTimeout(900);
const depoisEnvio = await p.locator('.registro-caixa').innerText();
ok(/enviad|recebid|aval|Corte/i.test(depoisEnvio), `envio não confirmou: ${depoisEnvio.slice(0, 200)}`);
await shot('A2-registro');

// -------- 3. Ainda não dá para entrar: falta aprovar --------
await aoPortal();
await porta('Cidade de Riften');
await p.waitForTimeout(300);
await p.fill('.login-caixa input >> nth=0', ID);
await p.fill('.login-caixa input[type=password]', 'RFT-XXXX-999');
await p.click('.login-caixa form button.primario');
await p.waitForTimeout(600);
ok((await p.locator('.login-erro').count()) === 1, 'devia recusar quem ainda não foi aprovado');

// -------- 4. A Corte aprova e recebe a senha --------
await aoPortal();
await entrarCorte();
await p.click('.nav-item:has-text("Registro Civil")');
await p.waitForTimeout(600);
const pedido = p.locator(`.civil-pedido:has-text("${NOME}")`);
ok((await pedido.count()) === 1, 'o pedido não chegou à fila da Corte');
await pedido.locator('button:has-text("Aprovar")').click();
await p.waitForTimeout(800);

const modalCred = await p.locator('.modal').innerText();
ok(/Credenciais/.test(modalCred), `esperava o modal de credenciais: ${modalCred.slice(0, 150)}`);
ok(modalCred.includes(ID), 'o modal não mostra o ID do jogo');
const senha = (await p.locator('.cred-val.grande').innerText()).trim();
ok(/^RFT-[A-Z]{4}-\d{3}$/.test(senha), `senha em formato inesperado: "${senha}"`);
await shot('A3-credenciais');
await p.click('.modal-f .btn.primario');
await p.waitForTimeout(400);

// -------- 5. Quartel recusa quem não está alistado --------
await aoPortal();
await porta('Quartel General');
await p.waitForTimeout(300);
await p.fill('.login-caixa input >> nth=0', ID);
await p.fill('.login-caixa input[type=password]', senha);
await p.click('.login-caixa form button.primario');
await p.waitForTimeout(700);
const recusa = await p.locator('.login-erro').innerText();
ok(/Exército|alistad/i.test(recusa), `recusa do Quartel estranha: ${recusa}`);
await shot('A4-quartel-recusa');

// -------- 6. O morador entra na Cidade e vê a ficha --------
await aoPortal();
await porta('Cidade de Riften');
await p.waitForTimeout(300);
await p.fill('.login-caixa input >> nth=0', ID.toLowerCase());          // ID sem diferenciar caixa
await p.fill('.login-caixa input[type=password]', senha.replace(/-/g, '').toLowerCase()); // senha tolerante
await p.click('.login-caixa form button.primario');
await p.waitForSelector('.sidebar', { timeout: 8000 });
await p.waitForTimeout(700);
const ficha = await p.locator('.main').innerText();
ok(/Minha ficha/.test(ficha), 'não abriu a ficha do morador');
ok(ficha.includes(NOME), 'a ficha não traz o nome do morador');
const fichaU = ficha.toUpperCase();
for (const bloco of ['Nobreza', 'Cargo na Corte', 'Minhas propriedades', 'Meu ofício',
                     'Minhas licenças', 'Multas', 'Ficha criminal']) {
  ok(fichaU.includes(bloco.toUpperCase()), `falta o bloco "${bloco}" na ficha do morador`);
}
const menuCidadao = await p.locator('.nav-item').allInnerTexts();
ok(menuCidadao.length === 7, `o morador devia ver 7 telas, vê ${menuCidadao.length}: ${menuCidadao.join(', ')}`);
await shot('A5-minha-ficha');

// -------- 7. O morador edita e salva --------
await p.click('.pg-head .btn.primario');
await p.waitForTimeout(400);
ok(await p.locator('input.travado').isEditable() === false, 'o ID do jogo devia estar travado');
await p.locator('.painel textarea').fill('Já montei banca na forja de Riften.');
await p.selectOption('.painel .grade.g2 select >> nth=2', 'Aprendiz');
await p.click('.ficha-acoes .btn.primario');
await p.waitForTimeout(900);
ok((await p.locator('.aviso-ok').count()) === 1, 'não confirmou o salvamento');
const salva = await p.locator('.main').innerText();
ok(/Já montei banca/.test(salva), 'o texto editado não ficou salvo');
ok(/Aprendiz/.test(salva), 'o nível editado não ficou salvo');
await shot('A6-ficha-salva');

// -------- 8. A Corte alista o morador --------
await aoPortal();
await entrarCorte();
await p.click('.nav-item:has-text("Exército de Riften")');
await p.waitForTimeout(600);
await p.click('.pg-head .btn.primario');
await p.waitForTimeout(400);
await p.fill('.seletor-civil input', NOME);
await p.waitForTimeout(500);
const sugestao = p.locator('.seletor-civil .sugestao, .seletor-civil li, .seletor-civil button').filter({ hasText: NOME }).first();
if (await sugestao.count()) { await sugestao.click(); await p.waitForTimeout(300); }
await p.selectOption('.modal .grade.g3 select >> nth=1', { label: 'Soldado' }).catch(() => {});
await p.click('.modal-f .btn.primario');
await p.waitForTimeout(900);
const tropa = await p.locator('.main').innerText();
ok(tropa.includes(NOME), 'o alistamento não apareceu no Exército');
await shot('A7-alistado');

// -------- 9. Agora o Quartel abre --------
await aoPortal();
await porta('Quartel General');
await p.waitForTimeout(300);
await p.fill('.login-caixa input >> nth=0', ID);
await p.fill('.login-caixa input[type=password]', senha);
await p.click('.login-caixa form button.primario');
await p.waitForSelector('.sidebar', { timeout: 8000 });
await p.waitForTimeout(700);
const menuQuartel = await p.locator('.nav-item').allInnerTexts();
ok(menuQuartel.length === 5, `o soldado devia ver 5 telas, vê ${menuQuartel.length}: ${menuQuartel.join(', ')}`);
ok(menuQuartel.some(t => /Meu registro militar/.test(t)), 'falta "Meu registro militar"');
ok(menuQuartel.some(t => /Registro de Prisões/.test(t)), 'falta o Registro de Prisões');
ok(menuQuartel.some(t => /Logística/.test(t)), 'falta a Logística');
const militar = await p.locator('.main').innerText();
ok(/registro de habilidades/i.test(militar), 'falta o registro de habilidades');
ok(/aptidão/i.test(militar), 'falta a aptidão');
await shot('A8-quartel');

// -------- 10. O soldado edita as próprias habilidades --------
await p.click('.pg-head .btn.primario');
await p.waitForTimeout(400);
await p.selectOption('.grupo-pericia .mini-select.largo >> nth=0', 'Mestre');
await p.waitForTimeout(300);
await p.click('.ficha-acoes .btn.primario');
await p.waitForTimeout(900);
ok((await p.locator('.aviso-ok').count()) === 1, 'não confirmou o salvamento das habilidades');
const depois = await p.locator('.main').innerText();
ok(/Mestre/.test(depois), 'a perícia editada não ficou salva');
await shot('A9-habilidades');

// -------- 11. O soldado registra uma prisão --------
await p.click('.nav-item:has-text("Registro de Prisões")');
await p.waitForTimeout(600);
await p.click('.pg-head .btn.primario');
await p.waitForTimeout(400);
await p.fill('.seletor-civil input', 'Ulfr, o Bêbado');
await p.selectOption('.modal .grade.g3 select', 'winterhold');
await p.selectOption('.crime-select', 'c08');
await p.fill('.modal textarea', 'Confusão no mercado.');
await p.click('.modal-f .btn.primario');
await p.waitForTimeout(900);
const celas = await p.locator('.main').innerText();
ok(/Ulfr/.test(celas), 'a prisão registrada pelo soldado não apareceu nas celas');
ok(celas.includes(NOME), `a prisão devia sair em nome do soldado (${NOME})`);
await shot('A10-prisao-soldado');

// -------- 12. O soldado movimenta o almoxarifado do seu prédio --------
await p.click('.nav-item:has-text("Logística")');
await p.waitForTimeout(700);
ok((await p.locator('.predio-card').count()) === 3,
   'o soldado também escolhe o prédio antes de ver o estoque');
await p.click('.predio-card:has-text("Mistveil Keep Barracks")');
await p.waitForTimeout(700);
await p.click('.pg-head .btn.primario');
await p.waitForTimeout(400);
await p.selectOption('.modal .grade.g2 select', 'recursos');
await p.waitForTimeout(200);
await p.fill('.modal .grade.g2 input', 'Leather Strips');
await p.waitForTimeout(300);
const opts = await p.locator('.modal select').nth(1).locator('option').allInnerTexts();
await p.selectOption('.modal select >> nth=1', { label: opts.find(o => /^Leather Strips/.test(o)) });
await p.fill('.modal input[type=number]', '12');
await p.waitForTimeout(300);
await p.click('.modal-f .btn.primario');
await p.waitForTimeout(900);
await p.click('.aba-painel:has-text("Recursos e Insumos")');
await p.waitForTimeout(600);
await p.click('.gaveta-bts .btn >> nth=0');   // abrir as gavetas de recursos
await p.waitForTimeout(500);
const saldo = await p.locator('.estoque-linha:has(.estoque-nome:text-is("Leather Strips")) .estoque-qtd').innerText();
ok(saldo.trim() === '12', `o saldo devia ser 12, veio "${saldo}"`);
const livro = await p.locator('.painel:has-text("Livro de movimentos")').innerText();
ok(livro.includes(NOME), 'o lançamento devia sair em nome do soldado');
ok((await p.locator('.painel:has-text("Livro de movimentos") .btn.perigo').count()) === 0,
   'o soldado não devia poder apagar lançamentos');
await shot('A11-logistica-soldado');

// -------- 13. A Corte continua vendo tudo --------
await aoPortal();
await entrarCorte();
const menuCorte = await p.locator('.nav-item').allInnerTexts();
ok(menuCorte.length === 12, `a Corte devia ver 12 telas, vê ${menuCorte.length}`);

await b.close();
console.log(erros.length
  ? 'PROBLEMAS:\n' + erros.join('\n')
  : 'Tudo certo — três portas, senha na aprovação, ficha do morador e Quartel do soldado.');
