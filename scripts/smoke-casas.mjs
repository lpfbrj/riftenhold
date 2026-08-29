/**
 * CASAS NOBRES — do morador com propriedade até a aliança lavrada.
 *
 *  1. O morador com propriedade pede o título de nobreza (50.000).
 *  2. A Corte defere; abre-se a aba Dinastia para fundar a casa.
 *  3. A casa nasce Pendente: não aparece na lista pública nem na Nobreza.
 *  4. A Corte reconhece; a casa passa a existir.
 *  5. Herdeiro (3.500), Mesnada (10.000) e insígnia (5.000) por pedido.
 *  6. Sede (8.000) só com mais de uma propriedade.
 *  7. Aliança (10.000): a casa convidada aceita, e só então a Corte lavra.
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

const chancelaria = () => p.locator('.painel:has(.painel-h h3:text-is("Chancelaria da Nobreza"))');

/** Defere ou indefere o primeiro pedido de um tipo na mesa da Corte. */
async function julgar(ato, deferir, parecer = '') {
  const cartao = chancelaria().locator(`.pedido-casa:has(h4:text-is("${ato}"))`).first();
  ok(await cartao.count() > 0, `a Corte devia ver o pedido "${ato}" na Chancelaria`);
  await cartao.locator(`button:text-is("${deferir ? 'Deferir' : 'Indeferir'}")`).click();
  await p.waitForTimeout(500);
  if (parecer) await p.fill('.modal textarea', parecer);
  await p.click(`.modal-f .btn.${deferir ? 'primario' : 'perigo'}`);
  await p.waitForTimeout(1200);
}

const DONO = 'Ragnar Punho-de-Ferro';
const ALIADO = 'Sigrid Olhos-de-Gelo';

await p.goto('http://localhost:4173', { waitUntil: 'networkidle' });

/* ============================================================
   Cenário: dois moradores aprovados, cada um com propriedade;
   o primeiro com duas, para poder transferir a sede.
   ============================================================ */
const senhas = await p.evaluate(([dono, aliado]) => {
  const s = JSON.parse(localStorage.getItem('riften-hold:v1') || '{}');
  const uid = () => crypto.randomUUID();
  const civil = (nome, id_jogo, senha) => ({
    id: uid(), nome, id_jogo, senha_acesso: senha, status: 'Aprovado',
    raca: 'Nord', profissao: 'Ferreiro', nivel: 'Mestre', origem: 'natal',
  });
  const c1 = civil(dono, 'CASA-1', 'AAAA-1111');
  const c2 = civil(aliado, 'CASA-2', 'BBBB-2222');
  s.civis = [...(s.civis || []).filter((x) => x.id_jogo !== 'CASA-1' && x.id_jogo !== 'CASA-2'), c1, c2];
  s.clas = [];
  s.pedidos_casa = [];
  s.pedidos_dinastia = [];
  s.avisos = [];
  s.propriedades = [
    { id: uid(), nome: 'Forja do Punho', tipo: 'Oficina', local: 'Riften',
      proprietario: c1.nome, proprietario_civil_id: c1.id, status: 'Operante' },
    { id: uid(), nome: 'Solar da Colina', tipo: 'Solar', local: 'Riften',
      proprietario: c1.nome, proprietario_civil_id: c1.id, status: 'Operante' },
    { id: uid(), nome: 'Casa do Lago', tipo: 'Casa', local: 'Riften',
      proprietario: c2.nome, proprietario_civil_id: c2.id, status: 'Operante' },
  ];
  localStorage.setItem('riften-hold:v1', JSON.stringify(s));
  return { dono: 'AAAA-1111', aliado: 'BBBB-2222' };
}, [DONO, ALIADO]);

/* ============================================================
   1. O morador pede o título — 50.000 Septims
   ============================================================ */
await entrarCidade('CASA-1', senhas.dono);
const menuAntes = await p.locator('.nav-item').allInnerTexts();
ok(!menuAntes.some((t) => /Dinastia/.test(t)),
   'sem título de nobreza, não devia haver aba Dinastia');

await irPara('Minha ficha');
const quadro = p.locator('.painel:has(.painel-h h3:text-is("Título de nobreza"))');
ok(await quadro.count() === 1, 'falta o quadro do título de nobreza na ficha');
const txt = await quadro.innerText();
ok(/50\.000 Septims/.test(txt), `o quadro devia trazer a taxa de 50.000: ${txt}`);
ok(/Forja do Punho/.test(txt) && /Solar da Colina/.test(txt),
   'o quadro devia listar as propriedades que dão direito ao pedido');
await quadro.scrollIntoViewIfNeeded();
await shot('N1-pedir-nobreza');

await quadro.locator('button:has-text("Pedir título")').click();
await p.waitForTimeout(400);
await quadro.locator('textarea').fill('Forjo as armas da Guarda há doze invernos e mantenho duas propriedades no Hold.');
await quadro.locator('.btn.primario:has-text("Enviar à Corte")').click();
await p.waitForTimeout(1300);
ok(/Na mesa da Corte/i.test(await quadro.innerText()), 'o pedido devia ficar pendente na ficha');

/* ============================================================
   2. A Corte defere
   ============================================================ */
await entrarCorte();
await irPara('Palácio do Jarl');
ok(await chancelaria().count() === 1, 'falta o quadro da Chancelaria da Nobreza no Palácio');
const mesa = await chancelaria().innerText();
ok(/50\.000 Septims/.test(mesa), 'a Chancelaria devia mostrar a taxa do pedido');
ok(/2 propriedades em seu nome/.test(mesa), `a Corte devia ver as propriedades do pedinte: ${mesa}`);
await chancelaria().scrollIntoViewIfNeeded();
await shot('N2-chancelaria');
await julgar('Título de nobreza', true, 'Concedido pelos serviços à Guarda.');

/* ============================================================
   3. Ele funda a casa — que nasce pendente
   ============================================================ */
await entrarCidade('CASA-1', senhas.dono);
const menuDepois = await p.locator('.nav-item').allInnerTexts();
ok(menuDepois.some((t) => /Dinastia/.test(t)), 'o nobre devia ganhar a aba Dinastia');
await irPara('Quadro de Avisos');
ok(/deferido/i.test(await p.locator('.main').innerText()), 'ele devia ser avisado do deferimento');

await irPara('Dinastia');
ok(/Fundar a sua casa nobre/.test(await p.locator('.pg-head').innerText()),
   'a aba devia abrir na fundação da casa');
await p.fill('.cla-campos input >> nth=0', 'Punho-de-Ferro');
await p.fill('.campo-lema', 'O ferro lembra o que a carne esquece');
const lema = await p.inputValue('.campo-lema');
ok(lema.length <= 40, `o lema devia ser cortado em 40 caracteres: ${lema.length}`);
await p.selectOption('.cla-campos select >> nth=1', { label: 'Solar da Colina — Solar' });
await p.waitForTimeout(300);
await shot('N3-fundar');
await p.click('.ficha-acoes .btn.primario');
await p.waitForTimeout(1400);
const espera = await p.locator('.pg-head').innerText();
ok(/Aguardando a Corte/i.test(espera), `a casa devia ficar aguardando: ${espera}`);
ok(/O ferro lembra/.test(await p.locator('.main').innerText()), 'o lema devia constar no que foi enviado');

/* -- a casa pendente não aparece no Hold -- */
await entrarCorte();
await irPara('Palácio do Jarl');
const listaCasas = p.locator('.painel:has(.painel-h h3:text-is("Casas & Dinastias Nobres"))');
ok(!/Punho-de-Ferro/.test(await listaCasas.innerText()),
   'a casa pendente não devia aparecer na lista pública');
const nobreza = p.locator('.painel:has(.painel-h h3:text-is("Nobreza de Riften"))');
ok(!/Punho-de-Ferro/.test(await nobreza.innerText()),
   'a casa pendente não devia entrar na Nobreza');

/* ============================================================
   4. A Corte reconhece a casa
   ============================================================ */
await julgar('Fundação de casa nobre', true, 'Reconhecida. Que a casa honre o Hold.');
ok(/Punho-de-Ferro/.test(await listaCasas.innerText()),
   'depois do aval, a casa devia entrar na lista pública');
ok(/Punho-de-Ferro/.test(await nobreza.innerText()),
   'depois do aval, o fundador devia entrar na Nobreza');
await shot('N4-casa-reconhecida');

/* ============================================================
   5. Herdeiro, mesnada e insígnia
   ============================================================ */
await entrarCidade('CASA-1', senhas.dono);
await irPara('Dinastia');
ok(/Casa Punho-de-Ferro/.test(await p.locator('.pg-head h1').innerText()), 'a casa devia estar viva');
ok((await p.locator('.sub-aba').count()) === 7, 'a Dinastia devia ter sete abas');

// -- herdeiro --
await p.click('.sub-aba:has-text("Herdeiro")');
await p.waitForTimeout(500);
const abaHerdeiro = await p.locator('.painel').first().innerText();
ok(/3\.500 Septims/.test(abaHerdeiro), 'a taxa do herdeiro devia estar à vista');
await p.click('.painel .btn.primario:has-text("Registrar herdeiro")');
await p.waitForTimeout(500);
await p.fill('.modal .seletor-civil input', ALIADO);
await p.waitForTimeout(400);
await p.fill('.modal input >> nth=1', 'Filha de criação');
ok(/3\.500 Septims/.test(await p.locator('.modal-f').innerText()), 'o rodapé do modal devia trazer a taxa');
await p.click('.modal-f .btn.primario');
await p.waitForTimeout(1200);

// -- mesnada --
await p.click('.sub-aba:has-text("Mesnada")');
await p.waitForTimeout(500);
const abaMesnada = await p.locator('.painel').first().innerText();
ok(/10\.000 Septims/.test(abaMesnada), 'a taxa da mesnada devia estar à vista');
ok(/ainda não tem mesnada/i.test(abaMesnada), 'sem mesnada, o registro devia estar fechado');
ok((await p.locator('.lista-membros').count()) === 0,
   'sem mesnada não se alista ninguém');
await p.click('.painel .btn.primario:has-text("Pedir Registro de Mesnada")');
await p.waitForTimeout(500);
await p.fill('.modal textarea', 'A estrada leste anda perigosa e a casa precisa dos próprios homens.');
await p.click('.modal-f .btn.primario');
await p.waitForTimeout(1200);
await shot('N5-pedidos-casa');

// -- insígnia --
await p.click('.sub-aba:has-text("A casa")');
await p.waitForTimeout(500);
await p.click('.painel .btn:has-text("Pedir alteração")');
await p.waitForTimeout(500);
await p.fill('.modal .campo-lema', 'Nem o gelo dobra o ferro');
await p.click('.modal-f .btn.primario');
await p.waitForTimeout(1200);

// -- sede: ele tem duas propriedades, então pode --
await p.click('.painel:has-text("Sede principal") .btn:has-text("Transferir sede")');
await p.waitForTimeout(500);
ok(/8\.000 Septims/.test(await p.locator('.modal-f').innerText()), 'a taxa da sede devia ser 8.000');
await p.selectOption('.modal select', { label: 'Forja do Punho — Oficina' });
await p.click('.modal-f .btn.primario');
await p.waitForTimeout(1200);

const meusPedidos = await (async () => {
  await p.click('.sub-aba:has-text("Pedidos")');
  await p.waitForTimeout(600);
  return p.locator('.painel:has(.painel-h h3:text-is("Pedidos à Chancelaria"))').innerText();
})();
for (const t of ['Registro de Herdeiro Oficial', 'Registro de Mesnada',
                 'Alteração de brasão ou lema', 'Transferência de sede']) {
  ok(meusPedidos.includes(t), `o pedido "${t}" devia constar na Chancelaria da casa`);
}
ok(/3\.500/.test(meusPedidos) && /10\.000/.test(meusPedidos) && /8\.000/.test(meusPedidos),
   'as taxas deviam aparecer na lista de pedidos da casa');

/* -- a Corte defere tudo -- */
await entrarCorte();
await irPara('Palácio do Jarl');
await julgar('Registro de Herdeiro Oficial', true);
await julgar('Registro de Mesnada', true);
await julgar('Alteração de brasão ou lema', true);
await julgar('Transferência de sede', true);

/* -- e a casa sente o efeito -- */
await entrarCidade('CASA-1', senhas.dono);
await irPara('Dinastia');
ok(/Nem o gelo dobra o ferro/.test(await p.locator('.pg-head').innerText()),
   'o lema novo devia valer depois do deferimento');
await p.click('.sub-aba:has-text("Herdeiro")');
await p.waitForTimeout(500);
const herdeiro = await p.locator('.painel').first().innerText();
ok(herdeiro.includes(ALIADO) && /Filha de criação/.test(herdeiro),
   `o herdeiro devia estar registrado: ${herdeiro}`);

await p.click('.sub-aba:has-text("Mesnada")');
await p.waitForTimeout(500);
ok(/Mesnada reconhecida/.test(await p.locator('.painel').first().innerText()),
   'a mesnada devia constar como reconhecida');
await p.click('.painel .btn.primario:has-text("Registrar soldado")');
await p.waitForTimeout(400);
await p.fill('.lista-membros .servo-funcao', 'Capitão da guarda da casa');
await p.fill('.lista-membros .seletor-civil input', 'Torbjorn Escudo-Firme');
await p.waitForTimeout(300);
await p.click('.barra-salvar .btn.primario');
await p.waitForTimeout(1300);
// O nome do soldado mora no valor do campo, não no texto da página.
ok((await p.inputValue('.lista-membros .seletor-civil input')).includes('Torbjorn'),
   'o soldado devia ficar salvo sob a bandeira da casa');
ok((await p.inputValue('.lista-membros .servo-funcao')).includes('Capitão'),
   'o posto do soldado devia ficar salvo');
await shot('N6-mesnada');

await p.click('.sub-aba:has-text("A casa")');
await p.waitForTimeout(500);
ok(/Forja do Punho/.test(await p.locator('.painel:has-text("Sede principal")').innerText()),
   'a sede devia ter mudado para a Forja do Punho');

/* ============================================================
   6. Aliança: a segunda casa nasce e o pacto é proposto
   ============================================================ */
await entrarCidade('CASA-2', senhas.aliado);
await irPara('Minha ficha');
const q2 = p.locator('.painel:has(.painel-h h3:text-is("Título de nobreza"))');
await q2.locator('button:has-text("Pedir título")').click();
await p.waitForTimeout(400);
await q2.locator('textarea').fill('Tenho casa no lago e quero servir ao Hold como nobre.');
await q2.locator('.btn.primario:has-text("Enviar à Corte")').click();
await p.waitForTimeout(1300);

await entrarCorte();
await irPara('Palácio do Jarl');
await julgar('Título de nobreza', true);

await entrarCidade('CASA-2', senhas.aliado);
await irPara('Dinastia');
await p.fill('.cla-campos input >> nth=0', 'Olhos-de-Gelo');
await p.fill('.campo-lema', 'Vemos o inverno antes dele chegar');
await p.selectOption('.cla-campos select >> nth=1', { label: 'Casa do Lago — Casa' });
await p.click('.ficha-acoes .btn.primario');
await p.waitForTimeout(1400);

await entrarCorte();
await irPara('Palácio do Jarl');
await julgar('Fundação de casa nobre', true);

// -- a primeira casa propõe --
await entrarCidade('CASA-1', senhas.dono);
await irPara('Dinastia');
await p.click('.sub-aba:has-text("Alianças")');
await p.waitForTimeout(500);
ok(/10\.000 Septims/.test(await p.locator('.painel').first().innerText()),
   'a taxa da aliança devia estar à vista');
await p.click('.painel .btn.primario:has-text("Propor aliança")');
await p.waitForTimeout(500);
await p.selectOption('.modal select', { label: 'Casa Olhos-de-Gelo' });
await p.fill('.modal textarea', 'Ferro por profecia: minhas forjas, seus olhos.');
await p.click('.modal-f .btn.primario');
await p.waitForTimeout(1300);

// -- a Corte ainda não pode julgar: falta o aceite --
await entrarCorte();
await irPara('Palácio do Jarl');
const semAceite = await chancelaria().innerText();
ok(/Aguardando a casa convidada/.test(semAceite),
   'a proposta devia aparecer como esperando a casa convidada');
ok((await chancelaria().locator('.pedido-casa:has(h4:text-is("Aliança entre casas"))').count()) === 0,
   'sem o aceite, a aliança não devia estar na mesa de julgamento');
await shot('N7-aguardando-casa');

// -- a casa convidada aceita --
await entrarCidade('CASA-2', senhas.aliado);
await irPara('Dinastia');
await p.click('.sub-aba:has-text("Alianças")');
await p.waitForTimeout(500);
const proposta = p.locator('.proposta-alianca');
ok(await proposta.count() === 1, 'a casa convidada devia ver a proposta');
ok(/Ferro por profecia/.test(await proposta.innerText()), 'o texto da proposta devia aparecer');
await proposta.locator('.btn.primario:has-text("Aceitar")').click();
await p.waitForTimeout(1300);
ok((await p.locator('.proposta-alianca').count()) === 0, 'aceita, a proposta sai da fila da casa');

// -- agora sim a Corte lavra --
await entrarCorte();
await irPara('Palácio do Jarl');
ok(/já\s+aceitou/.test(await chancelaria().innerText()),
   'a Corte devia ver que a casa convidada aceitou');
await julgar('Aliança entre casas', true, 'Pacto lavrado nos livros do Hold.');
ok(/Alian[çc]as em vigor/i.test(await chancelaria().innerText()),
   'a aliança devia entrar na lista de alianças em vigor');

// -- e as duas casas a enxergam --
for (const [id, senha, outra] of [
  ['CASA-1', senhas.dono, 'Olhos-de-Gelo'],
  ['CASA-2', senhas.aliado, 'Punho-de-Ferro'],
]) {
  await entrarCidade(id, senha);
  await irPara('Dinastia');
  await p.click('.sub-aba:has-text("Alianças")');
  await p.waitForTimeout(600);
  const aliadas = await p.locator('.painel:has(.painel-h h3:text-is("Alianças da casa"))').innerText();
  ok(new RegExp(outra).test(aliadas), `a Casa ${id} devia ver a aliança com ${outra}: ${aliadas}`);
}
await shot('N8-aliadas');

/* ============================================================
   7. Regra da sede: quem tem uma propriedade só não transfere
   ============================================================ */
await p.click('.sub-aba:has-text("A casa")');
await p.waitForTimeout(500);
await p.click('.painel:has-text("Sede principal") .btn:has-text("Transferir sede")');
await p.waitForTimeout(600);
ok((await p.locator('.modal').count()) === 0,
   'com uma propriedade só, o modal de sede não devia abrir');
ok(/mais de uma propriedade/i.test(await p.locator('.login-erro').innerText()),
   'a tela devia explicar por que a sede não pode mudar');

/* ============================================================
   8. Indeferir também funciona, e o morador é avisado
   ============================================================ */
await entrarCidade('CASA-2', senhas.aliado);
await irPara('Dinastia');
await p.click('.sub-aba:has-text("Herdeiro")');
await p.waitForTimeout(500);
await p.click('.painel .btn.primario:has-text("Registrar herdeiro")');
await p.waitForTimeout(500);
await p.fill('.modal .seletor-civil input', 'Alguém Sem Registro');
await p.click('.modal-f .btn.primario');
await p.waitForTimeout(1200);

await entrarCorte();
await irPara('Palácio do Jarl');
await julgar('Registro de Herdeiro Oficial', false, 'Traga alguém do Registro Civil.');

await entrarCidade('CASA-2', senhas.aliado);
await irPara('Quadro de Avisos');
const mural = await p.locator('.main').innerText();
ok(/indeferido/i.test(mural) && /Registro Civil/.test(mural),
   'o indeferimento devia chegar ao Quadro de Avisos com o motivo');
await irPara('Dinastia');
await p.click('.sub-aba:has-text("Herdeiro")');
await p.waitForTimeout(500);
ok(/ainda não tem herdeiro/i.test(await p.locator('.painel').first().innerText()),
   'indeferido, o herdeiro não devia ser registrado');

await b.close();
console.log(erros.length
  ? 'PROBLEMAS:\n' + erros.join('\n')
  : 'Tudo certo — nobreza pedida, casa fundada e reconhecida, herdeiro, mesnada, insígnia, sede e aliança.');
