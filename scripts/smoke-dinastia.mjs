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

const PAT = 'Sigurd Lua-Cinzenta';
const ID_PAT = 'SKY-5001';
const FILHO = 'Halvar Lua-Cinzenta';
const ID_FILHO = 'SKY-5002';
const SERVO = 'Torvi, a Copeira';
const ID_SERVO = 'SKY-5003';

const senhaPat = await cadastrar(PAT, ID_PAT);
await cadastrar(FILHO, ID_FILHO);
const senhaServo = await cadastrar(SERVO, ID_SERVO);

// -------- 1. A Corte funda a casa com o patriarca --------
await p.click('.nav-item:has-text("Palácio do Jarl")');
await p.waitForTimeout(600);
await p.click('.painel:has(.painel-h h3:text-is("Casas & Dinastias Nobres")) .btn.primario');
await p.waitForTimeout(400);
await p.fill('.cla-campos input >> nth=0', 'Lua-Cinzenta');
await p.fill('.cla-campos .seletor-civil input', 'Sigurd');
await p.waitForTimeout(400);
await p.click('.cla-campos .seletor-op');
await p.waitForTimeout(300);
// a Corte também tem o bloco de servos
ok((await p.locator('.modal:has-text("Servos da casa")').count()) === 1,
   'o formulário da Corte devia ter o bloco de servos');
await p.click('.modal-f .btn.primario');
await p.waitForTimeout(900);

// -------- 2. Quem não chefia casa não vê a aba Dinastia --------
await entrarCidade(ID_SERVO, senhaServo);
let menu = await p.locator('.nav-item').allInnerTexts();
ok(menu.length === 7, `quem não chefia casa devia ver 7 telas, vê ${menu.length}: ${menu.join(', ')}`);
ok(!menu.some(t => /Dinastia/.test(t)), 'quem não chefia casa não devia ver a aba Dinastia');

// -------- 3. O patriarca vê a aba Dinastia --------
await entrarCidade(ID_PAT, senhaPat);
menu = await p.locator('.nav-item').allInnerTexts();
ok(menu.length === 8, `o patriarca devia ver 8 telas, vê ${menu.length}: ${menu.join(', ')}`);
ok(menu.some(t => /Dinastia/.test(t)), 'falta a aba Dinastia para o patriarca');
await p.click('.nav-item:has-text("Dinastia")');
await p.waitForTimeout(700);
const casa = await p.locator('.main').innerText();
ok(/Casa Lua-Cinzenta/.test(casa), 'a tela não nomeia a casa');
const abas = await p.locator('.sub-aba').allInnerTexts();
ok(abas.length === 7, `a Dinastia devia ter sete abas, tem ${abas.length}`);
for (const nome of ['A casa', 'Membros', 'Herdeiro', 'Mesnada', 'Alianças', 'Servos', 'Pedidos']) {
  ok(abas.some((a) => a.includes(nome)), `falta a aba "${nome}"`);
}
ok(/Estandarte da casa/i.test(casa), 'a aba inicial devia mostrar o estandarte');
await shot('D1-dinastia');

// -------- 4. Brasão e lema agora são pedido à Corte, com taxa --------
ok((await p.locator('.cla-brasao-edit input[type=file]').count()) === 0,
   'o brasão não se troca direto: depois da fundação é pedido à Corte');
ok(/5\.000 Septims/.test(casa), 'a taxa da insígnia devia estar à vista');
await p.locator('.painel textarea').first().fill('Casa de barqueiros do lago Honrich.');
await p.waitForTimeout(300);
ok((await p.locator('.barra-salvar').count()) === 1, 'devia avisar que há mudança não salva');
await shot('D2-casa');
await p.click('.barra-salvar .btn.primario');
await p.waitForTimeout(1000);
ok((await p.locator('.aviso-ok').count()) === 1, 'não confirmou o salvamento da casa');
ok((await p.locator('.barra-salvar').count()) === 0, 'a barra de salvar devia sumir');

// -------- 5. Ele registra um servo, sem passar pela Corte --------
await p.click('.sub-aba:has-text("Servos")');
await p.waitForTimeout(500);
await p.click('.painel:has-text("Servos da casa") .btn.primario');
await p.waitForTimeout(300);
await p.fill('.lista-membros .seletor-civil input', 'Torvi');
await p.waitForTimeout(400);
await p.click('.lista-membros .seletor-op');
await p.waitForTimeout(300);
await p.fill('.lista-membros .servo-funcao', 'Mordoma da casa');
await p.waitForTimeout(200);
await p.click('.barra-salvar .btn.primario');
await p.waitForTimeout(1000);
const comServo = await p.locator('.main').innerText();
ok(/Torvi/.test(comServo), 'o servo não ficou salvo');
ok(await p.locator('.lista-membros .servo-funcao').inputValue() === 'Mordoma da casa',
   'a função do servo não ficou salva');
await shot('D3-servo');

// -------- 6. Ele indica um membro: vai para a Corte, não entra direto --------
await p.click('.pg-head .btn.primario');
await p.waitForTimeout(400);
await p.fill('.modal .seletor-civil input', 'Halvar');
await p.waitForTimeout(400);
await p.click('.modal .seletor-op');
await p.waitForTimeout(300);
await p.fill('.modal input[placeholder*="Filho"]', 'Filho mais velho');
await p.fill('.modal textarea', 'Herdeiro da casa, já responde pelas barcaças.');
await shot('D4-indicar');
await p.click('.modal-f .btn.primario');
await p.waitForTimeout(1000);
const depoisPedido = await p.locator('.main').innerText();
ok(/Pedido enviado/.test(depoisPedido), 'não confirmou o envio do pedido');
await p.click('.sub-aba:has-text("Pedidos")');
await p.waitForTimeout(600);
const quadroPedidos = await p.locator('.painel:has(.painel-h h3:text-is("Indicações de membros"))').innerText();
ok(/Halvar/.test(quadroPedidos), 'a indicação devia constar no quadro de pedidos');
ok(/Pendente/.test(quadroPedidos), 'o pedido devia ficar pendente');
// e o indicado NÃO pode ter entrado na casa ainda
await p.click('.sub-aba:has-text("Membros")');
await p.waitForTimeout(500);
const blocoMembros = await p.locator('.painel:has-text("Membros da dinastia")').innerText();
ok(!/Halvar/.test(blocoMembros), 'o indicado não podia entrar na casa antes do aval da Corte');
await shot('D5-pedido');

// -------- 7. Ele ainda não é nobre --------
await aoPortal();
await entrarCorte();
await p.click('.nav-item:has-text("Palácio do Jarl")');
await p.waitForTimeout(700);
const nobreza = p.locator('.painel:has(.painel-h h3:text-is("Nobreza de Riften"))');
const txtNobreza = await nobreza.innerText();
// a tabela de nobres vai até o rodapé de servos; separo os dois para conferir
const soNobres = txtNobreza.split(/servos das casas/i)[0];
// o indicado aparece como linha PENDENTE, mas ainda não é nobre da casa
ok((await nobreza.locator('tr.linha-pendente').count()) === 1,
   'o pedido devia aparecer como linha pendente na Nobreza');
const jaNobre = await nobreza.locator(`tbody tr:not(.linha-pendente):has-text("${FILHO}")`).count();
ok(jaNobre === 0, 'o indicado não podia estar na Nobreza ainda');
ok(!soNobres.includes(SERVO), 'servo nunca entra na Nobreza');
ok(/servos das casas/i.test(txtNobreza), 'falta a lista de servos no quadro');
ok(txtNobreza.includes('Mordoma da casa'), 'a função do servo não aparece para a Corte');

// -------- 8. A Corte aprova o pedido, dentro do quadro da Nobreza --------
const pendente = nobreza.locator('tr.linha-pendente');
const linha = await pendente.innerText();
ok(linha.includes(FILHO), 'o pedido não chegou à Corte');
ok(/Lua-Cinzenta/.test(linha), 'o pedido não diz de que casa é');
ok(/Sigurd/.test(linha), 'o pedido não diz quem indicou');
ok(/Filho mais velho/.test(linha), 'o parentesco não aparece');
await nobreza.scrollIntoViewIfNeeded();
await p.waitForTimeout(300);
await shot('D6-fila-corte');
await pendente.locator('button:has-text("Aprovar")').click();
await p.waitForTimeout(1100);
ok((await nobreza.locator('tr.linha-pendente').count()) === 0, 'a linha pendente devia sumir');

// -------- 9. Agora ele é nobre --------
const nobreza2 = await p.locator('.painel:has(.painel-h h3:text-is("Nobreza de Riften"))').innerText();
ok(nobreza2.includes(FILHO), 'o aprovado devia entrar na Nobreza');
ok(/Membro da Dinastia/.test(nobreza2), 'o aprovado devia constar como Membro da Dinastia');
ok(!nobreza2.split(/servos das casas/i)[0].includes(SERVO), 'servo continua fora da Nobreza');
await p.locator('.painel:has(.painel-h h3:text-is("Nobreza de Riften"))').scrollIntoViewIfNeeded();
await p.waitForTimeout(300);
await shot('D7-aprovado');

// -------- 10. O patriarca vê o pedido aprovado e o membro na casa --------
await entrarCidade(ID_PAT, senhaPat);
await p.click('.nav-item:has-text("Dinastia")');
await p.waitForTimeout(700);
await p.click('.sub-aba:has-text("Pedidos")');
await p.waitForTimeout(600);
ok(/Aprovado/.test(await p.locator('.main').innerText()), 'o patriarca devia ver o pedido aprovado');
await p.click('.sub-aba:has-text("Membros")');
await p.waitForTimeout(500);
ok((await p.locator('.painel:has-text("Membros da dinastia")').innerText()).includes(FILHO),
   'o aprovado devia aparecer entre os membros da casa');

// -------- 11. A ficha do servo: Plebeu, mas com a casa e a função --------
await entrarCidade(ID_SERVO, senhaServo);
const fichaServo = await p.locator('.main').innerText();
ok(/Plebeu/.test(fichaServo), 'o servo devia constar como Plebeu');
ok(/Casa Lua-Cinzenta/.test(fichaServo), 'a ficha do servo devia citar a casa que ele serve');
ok(/Mordoma da casa/.test(fichaServo), 'a ficha do servo devia trazer a função dele');
ok(!/Nobreza de Riften como/.test(fichaServo), 'servo não é nobre');
await p.evaluate(() => window.scrollTo(0, 620));
await p.waitForTimeout(300);
await shot('D8-ficha-servo');

// -------- 12. A ficha do novo membro: nobre de verdade --------
await aoPortal();
await entrarCorte();
await p.click('.nav-item:has-text("Registro Civil")');
await p.waitForTimeout(600);
await p.click(`tr:has-text("${FILHO}") .link-perfil`);
await p.waitForTimeout(600);
const perfilFilho = await p.locator('.modal').innerText();
ok(/Lua-Cinzenta/.test(perfilFilho), 'o perfil do novo membro não mostra a casa');
ok(/Nobre/.test(perfilFilho), 'o novo membro devia constar como Nobre');
ok(!/Plebeu/.test(perfilFilho), 'quem entrou na casa não é mais Plebeu');

await b.close();
console.log(erros.length
  ? 'PROBLEMAS:\n' + erros.join('\n')
  : 'Tudo certo — Dinastia do patriarca, servos Plebeus e membros passando pela Corte.');
