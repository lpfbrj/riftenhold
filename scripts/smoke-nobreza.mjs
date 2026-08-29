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

/* ------------------------------------------------------------
   Esta suíte conta linhas: segue sem os moradores, a casa e a
   tropa de demonstração, que existem só para quem quer testar o
   sistema à mão. O estado só nasce depois do login, por isso a
   limpeza vem aqui e não no portal.
   ------------------------------------------------------------ */
await p.evaluate(() => {
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
await p.reload({ waitUntil: 'networkidle' });
await p.waitForSelector('.sidebar', { timeout: 8000 });
await p.waitForTimeout(600);
  await p.waitForTimeout(500);
};
/** Cadastra alguém pelo portal e aprova, devolvendo a senha gerada. */
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


const PAI = 'Hrolfdir Corvo-Negro';
const ID_PAI = 'SKY-3001';
const FILHA = 'Ingrun Corvo-Negro';
const ID_FILHA = 'SKY-3002';
const SOZINHO = 'Bran, o Andarilho';
const ID_SOZINHO = 'SKY-3003';

const senhaPai = await cadastrar(PAI, ID_PAI);
await cadastrar(FILHA, ID_FILHA);
const senhaSozinho = await cadastrar(SOZINHO, ID_SOZINHO);

// -------- 1. Só Patriarca e Matriarca lideram --------
await p.click('.nav-item:has-text("Palácio do Jarl")');
await p.waitForTimeout(600);
await p.click('.painel:has(.painel-h h3:text-is("Casas & Dinastias Nobres")) .btn.primario');
await p.waitForTimeout(400);
const lideranca = await p.locator('.cla-campos .grade.g2 >> nth=1').locator('select').first()
  .locator('option').allInnerTexts();
ok(lideranca.filter(t => t !== '—').join(',') === 'Patriarca,Matriarca',
   `liderança devia ser só Patriarca/Matriarca, veio: ${lideranca.join(', ')}`);

// -------- 2. O patriarca tem busca no Registro Civil --------
ok((await p.locator('.cla-campos .seletor-civil').count()) === 1,
   'o campo do chefe da casa devia buscar no Registro Civil');
await p.fill('.cla-campos .seletor-civil input', 'Hrolfdir');
await p.waitForTimeout(400);
const sugestoes = await p.locator('.cla-campos .seletor-op').allInnerTexts();
ok(sugestoes.length >= 1 && sugestoes[0].includes(PAI),
   `a busca do patriarca não achou ninguém: ${sugestoes.join(' | ')}`);
await shot('N1-busca-patriarca');
await p.click('.cla-campos .seletor-op');
await p.waitForTimeout(300);
ok((await p.locator('.cla-campos .civil-vinculado').innerText()).includes(ID_PAI),
   'escolher o patriarca devia trazer o ID do jogo junto');

await p.fill('.cla-campos input >> nth=0', 'Corvo-Negro');

// -------- 3. Membro também busca, e entra como Nobre --------
await p.click('.editor-cat-h .btn.primario');
await p.waitForTimeout(300);
await p.fill('.lista-membros .seletor-civil input', 'Ingrun');
await p.waitForTimeout(400);
await p.click('.lista-membros .seletor-op');
await p.waitForTimeout(300);
ok((await p.locator('.lista-membros .civil-vinculado').innerText()).includes(ID_FILHA),
   'o membro devia vincular ao Registro Civil');
const titulosMembro = await p.locator('.lista-membros select').first().locator('option').allInnerTexts();
ok(titulosMembro.join(',') === 'Nobre,Lorde,Lady,Thane',
   `títulos de membro errados: ${titulosMembro.join(', ')}`);
ok(await p.locator('.lista-membros select').first().inputValue() === 'Nobre',
   'membro novo devia entrar como Nobre');
await shot('N2-casa');
await p.click('.modal-f .btn.primario');
await p.waitForTimeout(900);

// -------- 4. A Nobreza de Riften lista os dois --------
const nobreza = p.locator('.painel:has(.painel-h h3:text-is("Nobreza de Riften"))');
ok((await nobreza.count()) === 1, 'falta o painel Nobreza de Riften');
const txt = await nobreza.innerText();
ok(txt.includes(PAI) && txt.includes(FILHA), `a Nobreza não lista os dois: ${txt.slice(0, 300)}`);
ok(!txt.includes(SOZINHO), 'quem não está em casa nenhuma não devia aparecer na Nobreza');
const linhas = await nobreza.locator('tbody tr').count();
ok(linhas === 2, `esperava 2 nobres, achei ${linhas}`);
const linhaPai = await nobreza.locator(`tr:has-text("${PAI}")`).innerText();
ok(/Patriarca da Dinastia/.test(linhaPai), 'o chefe devia estar marcado como Patriarca da Dinastia');
ok(/Corvo-Negro/.test(linhaPai), 'a família não aparece na linha');
ok(/\bNobre\b/.test(linhaPai), 'o patriarca devia contar como Nobre na lista');
await nobreza.scrollIntoViewIfNeeded();
await p.waitForTimeout(300);
await shot('N3-nobreza');

// -------- 5. O título é editado na ficha da casa, não na lista --------
ok((await nobreza.locator('tbody select').count()) === 0,
   'a lista da Nobreza não deve ter seletor de título');
// o botão da linha leva à ficha da casa, que é onde se edita
await nobreza.locator(`tr:has-text("${PAI}") .col-acoes button`).click();
await p.waitForTimeout(500);
ok((await p.locator('.modal').count()) === 1, 'o botão da linha devia abrir a ficha da casa');
// chefe a Lorde, membro a Lady
await p.selectOption('.cla-campos .grade.g2 >> nth=1 >> select >> nth=1', 'Lorde');
await p.selectOption('.lista-membros select >> nth=0', 'Lady');
await p.click('.modal-f .btn.primario');
await p.waitForTimeout(1000);
const linhaPai2 = await nobreza.locator(`tr:has-text("${PAI}")`).innerText();
ok(/Lorde/.test(linhaPai2), 'a elevação a Lorde não pegou');
ok(/Patriarca da Dinastia/.test(linhaPai2), 'elevar o título não devia tirar a liderança');
ok(/Lady/.test(await nobreza.locator(`tr:has-text("${FILHA}")`).innerText()), 'a elevação a Lady não pegou');
await nobreza.scrollIntoViewIfNeeded();
await p.waitForTimeout(300);
await shot('N4-elevado');

// -------- 6. A Corte nomeia o patriarca Lorde Mão --------
await p.click('.cargo-card:has-text("Lorde Mão") button:has-text("Nomear")');
await p.waitForTimeout(400);
await p.fill('.modal .seletor-civil input', 'Hrolfdir');
await p.waitForTimeout(400);
await p.click('.modal .seletor-op');
await p.waitForTimeout(300);
await p.click('.modal-f .btn.primario');
await p.waitForTimeout(900);
ok((await p.locator('.cargo-card:has-text("Lorde Mão")').innerText()).includes(PAI),
   'a nomeação não apareceu no quadro do cargo');
// e não pode ter criado uma segunda linha do mesmo cargo
const cargosDuplicados = await p.evaluate(() => {
  const bruto = JSON.parse(localStorage.getItem('riften-hold:v1') || '{}');
  const ids = (bruto.corte || []).map(c => c.cargo_id || c.id);
  return ids.length - new Set(ids).size;
});
ok(cargosDuplicados === 0, `a nomeação duplicou ${cargosDuplicados} linha(s) de cargo`);

// -------- 7. O perfil que a Corte abre reflete tudo --------
await p.click('.nav-item:has-text("Registro Civil")');
await p.waitForTimeout(600);
await p.click(`tr:has-text("${PAI}") .link-perfil`);
await p.waitForTimeout(600);
const modal = await p.locator('.modal').innerText();
ok(/Lorde Mão/.test(modal), 'o perfil não mostra o cargo na Corte');
ok(/Corvo-Negro/.test(modal), 'o perfil não mostra a casa');
ok(/Lorde/.test(modal), 'o perfil não mostra o título de nobreza');
ok(/Patriarca/.test(modal), 'o perfil não mostra a liderança da casa');
await shot('N5-perfil-corte');
await p.click('.modal-h .x');
await p.waitForTimeout(300);

// -------- 8. A ficha do próprio morador reflete o mesmo --------
await aoPortal();
await p.click('.portal-card:has(.portal-nome:text-is("Cidade de Riften"))');
await p.waitForTimeout(300);
await p.fill('.login-caixa input >> nth=0', ID_PAI);
await p.fill('.login-caixa input[type=password]', senhaPai);
await p.click('.login-caixa form button.primario');
await p.waitForSelector('.sidebar', { timeout: 8000 });
await p.waitForTimeout(700);
const ficha = await p.locator('.main').innerText();
ok(/Lorde Mão/.test(ficha), 'a ficha do morador não reflete o cargo na Corte');
ok(/Braço direito do Jarl/.test(ficha), 'a ficha não descreve o cargo');
ok(/Casa Corvo-Negro/.test(ficha), 'a ficha não mostra a casa');
ok(/Nobreza de Riften/.test(ficha), 'a ficha não cita a Nobreza');
ok(/Patriarca da casa/.test(ficha), 'a ficha não mostra a liderança');
ok(!/Plebeu/.test(ficha), 'um Lorde não pode aparecer como Plebeu');
await p.evaluate(() => window.scrollTo(0, 620));
await p.waitForTimeout(300);
await shot('N6-ficha-lorde');

// -------- 9. Quem não é da nobreza é Plebeu --------
await aoPortal();
await p.click('.portal-card:has(.portal-nome:text-is("Cidade de Riften"))');
await p.waitForTimeout(300);
await p.fill('.login-caixa input >> nth=0', ID_SOZINHO);
await p.fill('.login-caixa input[type=password]', senhaSozinho);
await p.click('.login-caixa form button.primario');
await p.waitForSelector('.sidebar', { timeout: 8000 });
await p.waitForTimeout(700);
const plebeu = await p.locator('.main').innerText();
ok(/Plebeu/.test(plebeu), 'quem não é nobre devia constar como Plebeu');
ok(/Você não ocupa cargo na Corte/.test(plebeu), 'devia dizer que não tem cargo');
await shot('N7-plebeu');


// -------- 10. Vilarejo: o Lorde vem do Registro Civil --------
await aoPortal();
await entrarCorte();
await p.click('.nav-item:has-text("Palácio do Jarl")');
await p.waitForTimeout(600);
await p.click('.vila-card:has-text("Ivarstead")');
await p.waitForTimeout(500);
ok((await p.locator('.modal .seletor-civil').count()) >= 1,
   'o Lorde do vilarejo devia buscar no Registro Civil');
await p.fill('.modal .seletor-civil input', 'Ingrun');
await p.waitForTimeout(400);
const opsVila = await p.locator('.modal .seletor-op').allInnerTexts();
ok(opsVila.length >= 1 && opsVila[0].includes(FILHA),
   `a busca do Lorde não achou ninguém: ${opsVila.join(' | ')}`);
await p.click('.modal .seletor-op');
await p.waitForTimeout(400);
const aviso = await p.locator('.modal .ajuda').first().innerText();
ok(/Casa Corvo-Negro/.test(aviso), `o aviso da casa detentora não apareceu: ${aviso}`);
await shot('N8-vila-lorde');
await p.click('.modal-f .btn.primario');
await p.waitForTimeout(900);

// -------- 11. A tag da casa entra no cartão do vilarejo --------
const cartao = await p.locator('.vila-card:has-text("Ivarstead")').innerText();
ok(/Lorde: Ingrun/.test(cartao), `o Lorde não aparece no cartão: ${cartao}`);
ok(/Casa Corvo-Negro/.test(cartao), `a casa detentora não aparece no cartão: ${cartao}`);
const semLordeCartao = await p.locator(".vila-card:has-text(\"Shor's Stone\")").innerText();
ok(!/Casa /.test(semLordeCartao), 'vilarejo sem Lorde não devia ter casa detentora');
await p.locator('.painel:has-text("Vilarejos")').scrollIntoViewIfNeeded();
await p.waitForTimeout(300);
await shot('N9-vila-tag');

// -------- 12. A Nobreza mostra só nome, família e título --------
const nobreza2 = p.locator('.painel:has(.painel-h h3:text-is("Nobreza de Riften"))');
const linhaFilha = await nobreza2.locator(`tr:has-text("${FILHA}")`).innerText();
ok(!/ID SKY/.test(linhaFilha), `o ID do jogo não devia mais aparecer: ${linhaFilha}`);
ok(!/Alto Elfo|Nórdico|Bretão|Imperial/.test(linhaFilha), `a raça não devia mais aparecer: ${linhaFilha}`);
ok(/Membro da Dinastia/.test(linhaFilha), 'faltou marcar como Membro da Dinastia');
const linhaPai3 = await nobreza2.locator(`tr:has-text("${PAI}")`).innerText();
ok(/Patriarca da Dinastia/.test(linhaPai3), 'faltou marcar como Patriarca da Dinastia');
ok(!/ID SKY/.test(linhaPai3), 'o ID do jogo não devia aparecer na linha do patriarca');

// -------- 13. O vilarejo chega à ficha da Lady --------
const senhaFilha = await (async () => {
  await p.click('.nav-item:has-text("Registro Civil")');
  await p.waitForTimeout(600);
  await p.locator(`tr:has-text("${FILHA}") .btn.fantasma`).first().click();
  await p.waitForTimeout(500);
  const s = (await p.locator('.cred-val.grande').innerText()).trim();
  await p.click('.modal-f .btn.primario');
  await p.waitForTimeout(300);
  return s;
})();

await aoPortal();
await p.click('.portal-card:has(.portal-nome:text-is("Cidade de Riften"))');
await p.waitForTimeout(300);
await p.fill('.login-caixa input >> nth=0', ID_FILHA);
await p.fill('.login-caixa input[type=password]', senhaFilha);
await p.click('.login-caixa form button.primario');
await p.waitForSelector('.sidebar', { timeout: 8000 });
await p.waitForTimeout(700);
const fichaFilha = await p.locator('.main').innerText();
ok(/Vilarejo sob minha responsabilidade/i.test(fichaFilha),
   'a ficha da Lady não mostra o vilarejo sob responsabilidade dela');
ok(/Ivarstead/.test(fichaFilha), 'a ficha não nomeia o vilarejo');
ok(/Casa Corvo-Negro/.test(fichaFilha), 'a ficha não mostra a casa que detém o vilarejo');
// O posto no vilarejo e o título de nobreza viram um selo só.
ok(/Lady de Ivarstead/i.test(fichaFilha), `faltou o selo "Lady de Ivarstead": ${fichaFilha.slice(0, 400)}`);
ok(!/Lorde nomeado/i.test(fichaFilha), 'o selo antigo "Lorde nomeado" não devia mais aparecer');
await p.evaluate(() => window.scrollTo(0, 700));
await p.waitForTimeout(300);
await shot('N10-ficha-lady');

await b.close();
console.log(erros.length
  ? 'PROBLEMAS:\n' + erros.join('\n')
  : 'Tudo certo — Nobreza enxuta, vilarejo ligado ao Registro Civil e casa detentora na ficha.');
