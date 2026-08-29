/**
 * MERCADO IMOBILIÁRIO
 *
 *  1. No Palácio, Comércios virou Imobiliária, com as três
 *     categorias — e comércio novo nasce avaliado em 40.000.
 *  2. O dono anuncia o imóvel pelo preço que quiser.
 *  3. Outro morador manda proposta; o dono aceita ou recusa.
 *  4. O aceite transfere o imóvel na hora, derruba as demais
 *     propostas, avisa todo mundo e lavra a venda na Crônica.
 */
import pw from '/home/claude/.npm-global/lib/node_modules/playwright/index.js';
const { chromium } = pw;
const erros = [];
const ok = (c, m) => { if (!c) erros.push('[falha] ' + m); };
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1440, height: 1200 } });
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

const DONA = 'Ylva Mão-de-Prata';
const COMPRADOR = 'Torvald Bolsa-Cheia';
const RIVAL = 'Nilsine Pé-Ligeiro';

await p.goto('http://localhost:4173', { waitUntil: 'networkidle' });

/* ============================================================
   Cenário: três moradores aprovados; a primeira tem dois imóveis
   ============================================================ */
const senhas = await p.evaluate(([dona, comprador, rival]) => {
  const s = JSON.parse(localStorage.getItem('riften-hold:v1') || '{}');
  const uid = () => crypto.randomUUID();
  const civil = (nome, id_jogo, senha) => ({
    id: uid(), nome, id_jogo, senha_acesso: senha, status: 'Aprovado',
    raca: 'Nord', origem: 'natal',
  });
  const c1 = civil(dona, 'IMO-1', 'AAAA-1111');
  const c2 = civil(comprador, 'IMO-2', 'BBBB-2222');
  const c3 = civil(rival, 'IMO-3', 'CCCC-3333');
  s.civis = [...(s.civis || []).filter((x) => !/^IMO-/.test(x.id_jogo || '')), c1, c2, c3];
  s.ofertas = [];
  s.avisos = [];
  s.propriedades = [
    { id: uid(), nome: 'Casa do Riacho', tipo: 'Casa', categoria: 'casa', local: 'Riften',
      valor: 15000, proprietario: c1.nome, proprietario_civil_id: c1.id, status: 'Operante' },
    { id: uid(), nome: 'Forja da Prata', tipo: 'Oficina', categoria: 'comercio', local: 'Riften',
      valor: 40000, proprietario: c1.nome, proprietario_civil_id: c1.id, status: 'Operante' },
    { id: uid(), nome: 'Torre do Corvo', tipo: 'Torre', categoria: 'fortaleza', local: 'Riften',
      valor: 80000, proprietario: '', proprietario_civil_id: '', status: 'Vaga' },
  ];
  localStorage.setItem('riften-hold:v1', JSON.stringify(s));
  return { dona: 'AAAA-1111', comprador: 'BBBB-2222', rival: 'CCCC-3333' };
}, [DONA, COMPRADOR, RIVAL]);

/* ============================================================
   1. No Palácio, a Imobiliária com as três categorias
   ============================================================ */
await entrarCorte();
const lateral = await p.locator('.sidebar').innerText();
ok(/Imobiliária/.test(lateral), 'o menu da Corte devia trazer Imobiliária');
ok(!/^Comércios$/m.test(lateral), 'Comércios não devia mais existir no menu da Corte');

await irPara('Imobiliária');
ok(/Imobiliária do Hold/.test(await p.locator('.pg-head h1').innerText()),
   'a tela devia se chamar Imobiliária do Hold');
const categorias = await p.locator('.aba-painel .aba-txt strong').allInnerTexts();
ok(categorias.length === 3, `esperava 3 categorias, achei ${categorias.length}`);
ok(categorias[0] === 'Casas' && categorias[1] === 'Comércios' && categorias[2] === 'Fortalezas',
   `categorias erradas: ${categorias.join(' / ')}`);
const basesTexto = await p.locator('.abas-painel').innerText();
ok(/40\.000 Septims/.test(basesTexto), 'a base do comércio devia ser 40.000');
ok(/15\.000 Septims/.test(basesTexto) && /80\.000 Septims/.test(basesTexto),
   'as bases de casa e fortaleza deviam aparecer');
await shot('I1-imobiliaria');

// A aba de comércios traz os comércios, e não as casas
const emComercios = await p.locator('.grade.g2').first().innerText();
ok(/Forja da Prata/.test(emComercios), 'a Forja devia estar em Comércios');
ok(!/Casa do Riacho/.test(emComercios), 'a casa não devia aparecer na aba de Comércios');

await p.click('.aba-painel:has-text("Casas")');
await p.waitForTimeout(500);
const emCasas = await p.locator('.grade.g2').first().innerText();
ok(/Casa do Riacho/.test(emCasas), 'a casa devia estar na aba Casas');
ok(!/Forja da Prata/.test(emCasas), 'a Forja não devia aparecer na aba Casas');

await p.click('.aba-painel:has-text("Fortalezas")');
await p.waitForTimeout(500);
ok(/Torre do Corvo/.test(await p.locator('.grade.g2').first().innerText()),
   'a torre devia estar na aba Fortalezas');

/* -------- Comércio novo nasce avaliado em 40.000 -------- */
await p.click('.aba-painel:has-text("Comércios")');
await p.waitForTimeout(500);
await p.click('.pg-head .btn.primario');
await p.waitForTimeout(500);
const avaliacao = await p.inputValue('.modal input[type=number]');
ok(avaliacao === '40000', `comércio novo devia nascer avaliado em 40000, veio "${avaliacao}"`);
await p.fill('.modal input >> nth=0', 'Adega do Porto');
await p.click('.modal-f .btn.primario');
await p.waitForTimeout(900);
ok(/Adega do Porto/.test(await p.locator('.main').innerText()), 'o comércio novo devia entrar na lista');
await shot('I2-novo-comercio');

/* ============================================================
   2. A dona anuncia o imóvel
   ============================================================ */
await entrarCidade('IMO-1', senhas.dona);
const menu = await p.locator('.nav-item').allInnerTexts();
ok(menu.some((t) => /Mercado Imobiliário/.test(t)), 'o morador devia ver a aba Mercado Imobiliário');

await irPara('Mercado Imobiliário');
ok((await p.locator('.abas-painel .aba-painel').count()) === 3,
   'o mercado devia ter as três categorias');
const meus = p.locator('.painel:has(.painel-h h3:text-is("Meus imóveis"))');
ok(await meus.count() === 1, 'falta o quadro dos imóveis dela');
ok(/Casa do Riacho/.test(await meus.innerText()) && /Forja da Prata/.test(await meus.innerText()),
   'os dois imóveis dela deviam constar');

await meus.locator('tr:has-text("Casa do Riacho") button:has-text("Pôr à venda")').click();
await p.waitForTimeout(500);
const sugerido = await p.inputValue('.modal input[type=number]');
ok(sugerido === '15000', `o preço sugerido devia ser a avaliação (15000), veio "${sugerido}"`);
await p.fill('.modal input[type=number]', '18000');
await p.fill('.modal textarea', 'Casa de pedra junto ao riacho, telhado novo.');
await p.click('.modal-f .btn.primario');
await p.waitForTimeout(1300);
ok(/18\.000 Septims/.test(await p.locator('.main').innerText()),
   'o anúncio devia sair por 18.000');
await shot('I3-anunciada');

/* ============================================================
   3. Outro morador manda proposta
   ============================================================ */
await entrarCidade('IMO-2', senhas.comprador);
await irPara('Mercado Imobiliário');
await p.click('.aba-painel:has-text("Casas")');
await p.waitForTimeout(500);
const vitrine = p.locator('.imovel-card');
ok(await vitrine.count() === 1, 'a casa anunciada devia estar na vitrine');
const cartao = await vitrine.innerText();
ok(/18\.000 Septims/.test(cartao), 'o preço pedido devia aparecer no cartão');
ok(/15\.000 Septims/.test(cartao), 'a avaliação da Corte devia aparecer no cartão');
ok(/telhado novo/.test(cartao), 'a nota do anúncio devia aparecer');
await shot('I4-vitrine');

await vitrine.locator('button:has-text("Fazer proposta")').click();
await p.waitForTimeout(500);
await p.fill('.modal input[type=number]', '17000');
await p.fill('.modal textarea', 'Pago à vista, em barras de prata.');
ok(/abaixo do pedido/.test(await p.locator('.mov-resumo').innerText()),
   'o resumo devia avisar que a oferta está abaixo do pedido');
await p.click('.modal-f .btn.primario');
await p.waitForTimeout(1300);
const minhas = p.locator('.painel:has(.painel-h h3:text-is("Minhas propostas"))');
ok(await minhas.count() === 1, 'falta o quadro das propostas enviadas');
ok(/Aberta/.test(await minhas.innerText()), 'a proposta devia ficar aberta');

// Não se propõe duas vezes pelo mesmo imóvel
await p.click('.aba-painel:has-text("Casas")');
await p.waitForTimeout(500);
ok(await p.locator('.imovel-card button:has-text("Fazer proposta")').isDisabled(),
   'com proposta em pé, o botão devia travar');

/* -------- e um rival propõe mais -------- */
await entrarCidade('IMO-3', senhas.rival);
await irPara('Mercado Imobiliário');
await p.click('.aba-painel:has-text("Casas")');
await p.waitForTimeout(500);
await p.click('.imovel-card button:has-text("Fazer proposta")');
await p.waitForTimeout(500);
await p.fill('.modal input[type=number]', '19500');
await p.click('.modal-f .btn.primario');
await p.waitForTimeout(1300);

/* ============================================================
   4. A dona vê as duas e aceita a maior
   ============================================================ */
await entrarCidade('IMO-1', senhas.dona);
await irPara('Mercado Imobiliário');
const recebidas = p.locator('.painel:has(.painel-h h3:text-is("Propostas pelos seus imóveis"))');
ok(await recebidas.count() === 1, 'falta o quadro das propostas recebidas');
ok((await recebidas.locator('.oferta-card').count()) === 2, 'deviam ser duas propostas');
const texto = await recebidas.innerText();
ok(/17\.000 Septims/.test(texto) && /19\.500 Septims/.test(texto),
   `as duas propostas deviam aparecer com valor: ${texto}`);
ok(/barras de prata/.test(texto), 'o recado do comprador devia aparecer');
await shot('I5-propostas');

await recebidas.locator(`.oferta-card:has-text("19.500") button:has-text("Aceitar")`).click();
await p.waitForTimeout(500);
await p.fill('.modal textarea', 'As chaves ficam com o taberneiro.');
await p.click('.modal-f .btn.primario');
await p.waitForTimeout(1500);

// Aceitar não passa a casa: quem lavra a escritura é a Corte, e até
// lá o imóvel continua no nome da vendedora.
const aceita = await p.locator('.main').innerText();
ok(/Forja da Prata/.test(aceita), 'a Forja devia continuar sendo dela');
ok(/Casa do Riacho/.test(await p.locator('.painel:has(.painel-h h3:text-is("Meus imóveis"))').innerText()),
   'antes da escritura, a casa ainda é da vendedora');
await shot('I6-aceita');

/* ============================================================
   4b. A Corte lavra a escritura — sem taxa, passa na hora
   ============================================================ */
await entrarCorte();
await irPara('Imobiliária');
const fila = p.locator('.painel:has(.painel-h h3:has-text("Escrituras a lavrar"))');
ok(await fila.count() === 1, 'a venda aceita devia esperar escritura na Imobiliária');
ok(/Casa do Riacho/.test(await fila.innerText()), 'a fila devia mostrar a casa vendida');
await fila.locator('button:has-text("Lavrar")').first().click();
await p.waitForTimeout(500);
await p.fill('.modal .campo:has(span:text-is("Taxa de transmissão (Septims)")) input', '0');
await p.click('.modal-f .btn.primario');
await p.waitForTimeout(1500);
ok(/Nenhuma venda esperando escritura/i.test(
  await p.locator('.painel:has(.painel-h h3:has-text("Escrituras a lavrar"))').innerText()),
   'lavrada a escritura, a fila devia esvaziar');

/* -------- a vendedora não tem mais a casa -------- */
await entrarCidade('IMO-1', senhas.dona);
await irPara('Mercado Imobiliário');
ok(!/Casa do Riacho/.test(await p.locator('.painel:has(.painel-h h3:text-is("Meus imóveis"))').innerText()),
   'depois da escritura, a casa não é mais dela');

/* -------- o comprador recebeu a casa -------- */
await entrarCidade('IMO-3', senhas.rival);
await irPara('Quadro de Avisos');
ok(/Escritura lavrada/.test(await p.locator('.main').innerText()),
   'o comprador devia ser avisado da escritura');
await irPara('Mercado Imobiliário');
const doRival = p.locator('.painel:has(.painel-h h3:text-is("Meus imóveis"))');
ok(/Casa do Riacho/.test(await doRival.innerText()), 'a casa devia estar em nome do comprador');
ok(/Fora do mercado/.test(await doRival.innerText()), 'a casa comprada devia sair do mercado');

/* -------- e o perdedor foi avisado -------- */
await entrarCidade('IMO-2', senhas.comprador);
await irPara('Quadro de Avisos');
ok(/Imóvel vendido/.test(await p.locator('.main').innerText()),
   'quem perdeu devia ser avisado de que o imóvel foi vendido');
await irPara('Mercado Imobiliário');
ok(/Recusada/.test(await p.locator('.painel:has(.painel-h h3:text-is("Minhas propostas"))').innerText()),
   'a proposta perdedora devia constar como recusada');

/* ============================================================
   5. A Corte vê a venda na Crônica e o mercado no quadro
   ============================================================ */
await entrarCorte();
await irPara('Palácio do Jarl');
const cronica = await p.locator('.painel:has-text("Crônica")').innerText();
ok(/escritura/i.test(cronica) && /Casa do Riacho/.test(cronica),
   `a venda devia estar lavrada na Crônica: ${cronica.slice(0, 300)}`);

await irPara('Imobiliária');
const mercado = p.locator('.painel:has(.painel-h h3:text-is("No Mercado Imobiliário"))');
ok(await mercado.count() === 1, 'falta o quadro do mercado na Imobiliária');
const noMercado = await mercado.innerText();
ok(/Lavrada/.test(noMercado) && /19\.500 Septims/.test(noMercado),
   'a venda lavrada devia constar nas últimas propostas');
await shot('I7-corte-mercado');

/* ============================================================
   6. Retirar o anúncio derruba as propostas abertas
   ============================================================ */
await entrarCidade('IMO-1', senhas.dona);
await irPara('Mercado Imobiliário');
const meus2 = p.locator('.painel:has(.painel-h h3:text-is("Meus imóveis"))');
await meus2.locator('tr:has-text("Forja da Prata") button:has-text("Pôr à venda")').click();
await p.waitForTimeout(500);
await p.click('.modal-f .btn.primario');
await p.waitForTimeout(1300);

await entrarCidade('IMO-2', senhas.comprador);
await irPara('Mercado Imobiliário');
await p.click('.aba-painel:has-text("Comércios")');
await p.waitForTimeout(500);
await p.click('.imovel-card:has-text("Forja da Prata") button:has-text("Fazer proposta")');
await p.waitForTimeout(500);
await p.fill('.modal input[type=number]', '41000');
await p.click('.modal-f .btn.primario');
await p.waitForTimeout(1300);

await entrarCidade('IMO-1', senhas.dona);
await irPara('Mercado Imobiliário');
await p.locator('.painel:has(.painel-h h3:text-is("Meus imóveis")) tr:has-text("Forja da Prata") button:has-text("Retirar")').click();
await p.waitForTimeout(500);
await p.click('.modal-f .btn.perigo, .modal-f .btn.primario');
await p.waitForTimeout(1400);
ok(/Fora do mercado/.test(await p.locator('.painel:has(.painel-h h3:text-is("Meus imóveis"))').innerText()),
   'a Forja devia sair do mercado');

await entrarCidade('IMO-2', senhas.comprador);
await irPara('Mercado Imobiliário');
const proposta = await p.locator('.painel:has(.painel-h h3:text-is("Minhas propostas"))').innerText();
ok(/anúncio foi retirado/i.test(proposta),
   `a proposta devia cair com o anúncio: ${proposta.slice(0, 300)}`);
await shot('I8-anuncio-retirado');

await b.close();
console.log(erros.length
  ? 'PROBLEMAS:\n' + erros.join('\n')
  : 'Tudo certo — Imobiliária por categoria, anúncio, propostas, venda fechada e Crônica lavrada.');
