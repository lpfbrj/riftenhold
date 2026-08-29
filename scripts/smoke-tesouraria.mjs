/**
 * TESOURARIA DO HOLD
 *
 *  1. O cofre é um livro-caixa: a Corte declara o saldo com razão
 *     escrita, e a declaração fica no extrato.
 *  2. A multa da prisão vira cobrança rastreável contra o preso.
 *  3. O morador vê a cobrança, declara que pagou, e não consegue
 *     declarar duas vezes.
 *  4. A Corte confirma — e só aí o dinheiro entra no cofre.
 *  5. A licença emitida cobra a taxa de tabela.
 *  6. A saída registrada tira do saldo e aparece no livro.
 *  7. A folha da tropa é paga pela Tesouraria e vira despesa.
 *  8. A venda entre jogadores espera a escritura da Corte.
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

/** O saldo que a tela mostra, como número. */
const saldoNaTela = async () => {
  const t = await p.locator('.cofre-valor > strong').innerText();
  return Number(t.replace(/[^\d]/g, ''));
};

const PRESO = 'Gorm Punho-Fechado';

await p.goto('http://localhost:4173', { waitUntil: 'networkidle' });

/* ============================================================
   Cenário: um morador aprovado, para ser multado e cobrado
   ============================================================ */
await entrarCorte();
await p.evaluate((preso) => {
  const s = JSON.parse(localStorage.getItem('riften-hold:v1') || '{}');
  const uid = () => crypto.randomUUID();
  s.civis = [
    ...(s.civis || []).filter((x) => x.id_jogo !== 'TES-1'),
    { id: uid(), nome: preso, id_jogo: 'TES-1', senha_acesso: 'TTTT-1111',
      status: 'Aprovado', raca: 'Nórdico', origem: 'natal' },
  ];
  s.cofre = [];
  s.cobrancas = [];
  s.prisoes = [];
  localStorage.setItem('riften-hold:v1', JSON.stringify(s));
}, PRESO);
await p.reload({ waitUntil: 'networkidle' });
await p.waitForSelector('.sidebar', { timeout: 8000 });
await p.waitForTimeout(600);

/* ============================================================
   1. Declarar o saldo do cofre
   ============================================================ */
await irPara('Tesouraria');
const inicio = await p.locator('.main').innerText();
ok(/tesouraria do hold/i.test(inicio), 'a Tesouraria devia abrir no cofre');
ok(/ainda não declarou o saldo/i.test(inicio),
   'sem declaração, a tela devia avisar que o número não é confiável');

await p.click('.cofre-hero .btn.primario');
await p.waitForTimeout(400);
// Sem razão escrita não se mexe no cofre.
await p.fill('.modal .campo:has(span:text-is("Saldo real do cofre (Septims)")) input', '100000');
await p.click('.modal-f .btn.primario');
await p.waitForTimeout(500);
ok(await p.locator('.modal .login-erro').count() === 1,
   'declarar saldo sem razão escrita devia ser recusado');
await p.fill('.modal textarea', 'Conferência do cofre em jogo, feita pelo Mestre da Moeda.');
await p.click('.modal-f .btn.primario');
await p.waitForTimeout(1100);

ok(await saldoNaTela() === 100000, 'o saldo declarado devia aparecer no cofre');
await aba('Livro-caixa');
const livro = await p.locator('.main').innerText();
ok(/Conferência do cofre em jogo/.test(livro), 'a razão da declaração devia ficar no extrato');
ok(/Ajuste/i.test(livro), 'a declaração devia entrar como ajuste no livro');
await shot('T1-cofre');

/* ============================================================
   2. A multa da prisão vira cobrança
   ============================================================ */
await irPara('Registro de Prisões');
await p.click('.pg-head .btn.primario');
await p.waitForTimeout(400);
await p.fill('.modal .seletor-civil input', PRESO);
await p.waitForTimeout(500);
const sug = p.locator('.modal .seletor-op').first();
if (await sug.count()) { await sug.click(); await p.waitForTimeout(300); }
// Um crime que o Código puna com multa em Septims — é ela que vira
// cobrança. O valor aparece no resumo da pena assim que é escolhido.
const crimes = p.locator('.modal .crime-select');
const opcoes = (await crimes.locator('option').allInnerTexts()).filter((o) => /Art\./.test(o));
let multaAplicada = 0;
for (const rotulo of opcoes) {
  await crimes.selectOption({ label: rotulo });
  await p.waitForTimeout(250);
  const resumo = await p.locator('.modal .pena-resumo').innerText();
  const achado = resumo.match(/Multa\s+([\d.]+)\s*Septims/i);
  if (achado) { multaAplicada = Number(achado[1].replace(/\./g, '')); break; }
}
ok(multaAplicada > 0, 'o Código devia ter algum crime com multa em Septims');
await p.click('.modal-f .btn.primario');
await p.waitForTimeout(1300);

await irPara('Tesouraria');
await aba('Cobranças');
const cobrancas = await p.locator('.main').innerText();
ok(new RegExp(PRESO).test(cobrancas), 'a multa devia virar cobrança em nome do preso');
ok(/COB-0001/.test(cobrancas), 'a cobrança devia receber número');
await shot('T2-cobranca');

/* ============================================================
   3. O morador vê, e declara que pagou
   ============================================================ */
await entrarCidade('TES-1', 'TTTT-1111');
await irPara('Cobranças');
const minha = await p.locator('.main').innerText();
ok(/Em aberto/.test(minha), 'o morador devia ver a cobrança em aberto');
ok(/Multa/i.test(minha), 'a cobrança devia dizer que é multa');

await p.click('button:has-text("Já paguei")');
await p.waitForTimeout(400);
await p.fill('.modal textarea', 'Paguei ao carcereiro ontem à noite.');
await p.click('.modal-f .btn.primario');
await p.waitForTimeout(1200);
const depois = await p.locator('.main').innerText();
ok(/Pagamento declarado/.test(depois), 'a cobrança devia ficar como pagamento declarado');
ok(await p.locator('button:has-text("Já paguei")').first().isDisabled(),
   'ninguém declara o mesmo pagamento duas vezes');
await shot('T3-morador');

/* ============================================================
   4. Só a confirmação da Corte põe dinheiro no cofre
   ============================================================ */
await entrarCorte();
await irPara('Tesouraria');
const antesConfirmar = await saldoNaTela();
ok(antesConfirmar === 100000,
   `declarar não pode mexer no cofre — saldo ${antesConfirmar}`);

await aba('Cobranças');
const valorCobrado = multaAplicada;
ok(valorCobrado > 0, 'a cobrança devia ter valor');
await p.click('.divisao-linha button:has-text("Confirmar")');
await p.waitForTimeout(400);
await p.click('.modal-f .btn.primario');
await p.waitForTimeout(1300);

await aba('Cofre');
const depoisConfirmar = await saldoNaTela();
ok(depoisConfirmar === 100000 + valorCobrado,
   `confirmar devia somar ${valorCobrado} ao cofre — deu ${depoisConfirmar}`);
const grafico = await p.locator('.main').innerText();
ok(/Arrecadação por origem/i.test(grafico), 'o gráfico de arrecadação devia estar na tela');
ok(/Multas/.test(grafico), 'a multa devia aparecer no gráfico por origem');
await shot('T4-arrecadacao');

/* ============================================================
   5. A licença emitida cobra a taxa de tabela
   ============================================================ */
await irPara('Emissão de Licenças');
await p.click('.pg-head .btn.primario');
await p.waitForTimeout(500);
const taxa = await p.locator('.modal .campo:has(span:text-is("Taxa de emissão (Septims)")) input').inputValue();
ok(Number(taxa) === 2500, `a taxa devia vir da tabela de preços (2500), veio ${taxa}`);
await p.fill('.modal .seletor-civil input', PRESO);
await p.waitForTimeout(500);
const sugLic = p.locator('.modal .seletor-op').first();
if (await sugLic.count()) { await sugLic.click(); await p.waitForTimeout(300); }
await p.click('.modal-f .btn.primario');
await p.waitForTimeout(1300);

await irPara('Tesouraria');
await aba('Cobranças');
ok(/LIC-MIN-0001/.test(await p.locator('.main').innerText()),
   'a licença emitida devia gerar cobrança da taxa');

/* ============================================================
   6. A saída sai do cofre
   ============================================================ */
await aba('Livro-caixa');
await p.click('.barra-filtros .btn.primario');
await p.waitForTimeout(400);
await p.fill('.modal .campo:has(span:text-is("Valor (Septims)")) input', '5000');
await p.fill('.modal textarea', 'Retirada pelo Jarl para pagar a cidadania de um morador.');
await p.click('.modal-f .btn.primario');
await p.waitForTimeout(1200);

await aba('Cofre');
const comSaida = await saldoNaTela();
ok(comSaida === 100000 + valorCobrado - 5000,
   `a saída devia tirar 5000 do cofre — saldo ${comSaida}`);
ok(/Despesas por destino/i.test(await p.locator('.main').innerText()),
   'as despesas deviam ter o seu próprio gráfico');
await shot('T5-saida');

/* ============================================================
   7. A folha é paga pela Tesouraria, não pelo Exército
   ============================================================ */
await irPara('Exército de Riften');
const abasExercito = await p.locator('.aba-forca').allInnerTexts();
ok(!abasExercito.some((x) => /pagamento/i.test(x)),
   'a folha não devia mais poluir a tela do Exército');

await irPara('Tesouraria');
await aba('Folha');
const linhaVencida = p.locator('tr.linha-vencida').first();
ok(await linhaVencida.count() > 0, 'devia haver soldo vencido para pagar');
const soldo = Number((await linhaVencida.locator('td').nth(3).innerText()).replace(/[^\d]/g, ''));
await linhaVencida.locator('button:text-is("Pagar")').click();
await p.waitForTimeout(1300);

await aba('Cofre');
const comFolha = await saldoNaTela();
ok(comFolha === comSaida - soldo,
   `o soldo pago (${soldo}) devia sair do cofre — saldo ${comFolha}`);
await aba('Livro-caixa');
ok(/Soldo de/.test(await p.locator('.main').innerText()),
   'o pagamento do soldo devia aparecer no livro-caixa');
await shot('T6-folha');

/* ============================================================
   8. A venda entre jogadores espera a escritura da Corte
   ============================================================ */
await irPara('Imobiliária');
const imobiliaria = await p.locator('.main').innerText();
ok(/Escrituras a lavrar/i.test(imobiliaria),
   'a Imobiliária devia ter a fila de escrituras');
ok(/Nenhuma venda esperando escritura/i.test(imobiliaria),
   'sem venda aceita, a fila devia estar vazia');
await shot('T7-escrituras');

console.log(erros.length
  ? 'PROBLEMAS:\n' + erros.join('\n')
  : 'Tudo certo — cofre declarado, multa cobrada, pagamento confirmado, licença, saída e folha no livro.');
await b.close();
