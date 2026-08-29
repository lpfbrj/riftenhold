/**
 * LOGÍSTICA — um almoxarifado por prédio.
 *
 *  1. A tela abre pedindo o prédio: Mistveil Keep, Mistveil Keep
 *     Barracks ou Fort Greenwall.
 *  2. Dentro do prédio, os três painéis, agora em gavetas — nada
 *     de despejar 52 armas de uma vez.
 *  3. Entradas e saídas mexem só no estoque daquela casa, e a
 *     transferência move de um prédio para o outro.
 */
import pw from '/home/claude/.npm-global/lib/node_modules/playwright/index.js';
const { chromium } = pw;
const erros = [];
const ok = (c, m) => { if (!c) erros.push('[falha] ' + m); };
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1440, height: 1050 } });
p.on('pageerror', e => erros.push('[pageerror] ' + e.message));
p.on('console', m => { if (m.type() === 'error' && !/ERR_TUNNEL|Failed to load resource/.test(m.text())) erros.push('[console] ' + m.text()); });
const shot = n => p.screenshot({ path: `/home/claude/shots/${n}.png` });

await p.goto('http://localhost:4173', { waitUntil: 'networkidle' });
await p.evaluate(() => {
  sessionStorage.removeItem('riften-hold:sessao');
  sessionStorage.removeItem('riften-hold:predio-logistica');
  const s = JSON.parse(localStorage.getItem('riften-hold:v1') || '{}');
  s.movimentos = [];
  localStorage.setItem('riften-hold:v1', JSON.stringify(s));
});
await p.reload({ waitUntil: 'networkidle' });
await p.waitForTimeout(400);
await p.click('.portal-card:has(.portal-nome:text-is("Corte de Riften"))');
await p.waitForTimeout(300);
await p.fill('.login-caixa input >> nth=0', 'jarl@riften.rift');
await p.fill('input[type=password]', 'mistveil');
await p.click('.login-caixa form button.primario');
await p.waitForSelector('.sidebar', { timeout: 8000 });
await p.waitForTimeout(600);

const irLogistica = async () => {
  await p.click('.nav-item:has-text("Logística")');
  await p.waitForTimeout(600);
};

// -------- 1. Logística mora no Quartel General --------
const lateral = await p.locator('.sidebar').innerText();
const iQG = lateral.indexOf('QUARTEL GENERAL');
const iLog = lateral.indexOf('Logística');
const iReg = lateral.indexOf('REGISTROS');
ok(iQG > 0 && iLog > iQG && iReg > iLog, 'Logística deveria ficar sob Quartel General');

// -------- 2. Holds: exatamente os nove nomes pedidos --------
await p.click('.nav-item:has-text("Registro de Prisões")');
await p.waitForTimeout(500);
const holds = await p.locator('.barra-filtros select').nth(1).locator('option').allInnerTexts();
const esperados = ['Windhelm', 'Falkreath', 'Solitude', 'Morthal', 'Dawnstar',
                   'Markarth', 'Riften', 'Whiterun', 'Winterhold'];
const semVazio = holds.filter(h => h !== 'Todas');
ok(semVazio.length === 9, `esperava 9 holds, achei ${semVazio.length}: ${semVazio.join(', ')}`);
ok(esperados.every((e, i) => semVazio[i] === e),
   `os holds vieram diferentes: ${semVazio.join(', ')}`);

/* ============================================================
   3. Primeiro se escolhe o prédio
   ============================================================ */
await irLogistica();
ok((await p.locator('.predio-escolha').count()) === 1,
   'a Logística devia abrir pedindo o prédio');
const cartoes = await p.locator('.predio-card header strong').allInnerTexts();
ok(cartoes.length === 3, `esperava 3 prédios, achei ${cartoes.length}: ${cartoes.join(', ')}`);
for (const nome of ['Mistveil Keep', 'Mistveil Keep Barracks', 'Fort Greenwall']) {
  ok(cartoes.includes(nome), `falta o prédio "${nome}"`);
}
ok((await p.locator('.aba-painel').count()) === 0,
   'sem prédio escolhido, não devia haver painel de estoque');
await shot('L0-predios');

// O inventário-base foi contado no Quartel: só ele começa com peças.
const totais = await p.locator('.predio-card .predio-num .grande').allInnerTexts();
const numero = (s) => Number(String(s).replace(/\D/g, '')) || 0;
const porNome = Object.fromEntries(cartoes.map((n, i) => [n, numero(totais[i])]));
ok(porNome['Mistveil Keep Barracks'] > 400,
   `o Quartel devia começar com o baú contado: ${porNome['Mistveil Keep Barracks']}`);
ok(porNome['Mistveil Keep'] === 0 && porNome['Fort Greenwall'] === 0,
   'os outros prédios deviam começar zerados');

await p.click('.predio-card:has-text("Mistveil Keep Barracks")');
await p.waitForTimeout(600);
ok(/Mistveil Keep Barracks/.test(await p.locator('.pg-head h1').innerText()),
   'o cabeçalho devia nomear o prédio escolhido');

// -------- 4. Os três painéis, já dentro do prédio --------
const abas = await p.locator('.aba-painel .aba-txt strong').allInnerTexts();
ok(abas.length === 3, `esperava 3 painéis, achei ${abas.length}`);
ok(abas[0] === 'Equipamentos da Guarda' && abas[1] === 'Poções e Ingredientes'
   && abas[2] === 'Recursos e Insumos', `painéis errados: ${abas.join(' / ')}`);
await shot('L1-painel');

// -------- 5. Armaduras: contagem e classificação --------
const corpo = await p.locator('.painel').first().innerText();
for (const t of ["Riften Guard's Armor", 'Riften Heavy Armor', 'Riften Light Armor',
                 'Botas de Pelo', 'Riften Guard Cloak', 'Riften Shield']) {
  ok(corpo.includes(t), `falta a peça "${t}"`);
}
ok(/Armadura Pesada/.test(corpo) && /Armadura Leve/.test(corpo) && /Roupa/.test(corpo),
   'faltam as classes Pesada / Leve / Roupa');
for (const slot of ['Body', 'Head', 'Hands', 'Feet', 'Cloak', 'Shield']) {
  ok(corpo.includes(slot), `falta o tipo (slot) "${slot}"`);
}
const linhaEscudo = await p.locator("tr:has-text(\"Riften Guard's Shield\")").innerText();
ok(/\b77\b/.test(linhaEscudo), `Riften Guard's Shield deveria ter 77 no estoque: ${linhaEscudo}`);
const linhaLeve = await p.locator('tr:has-text("Riften Light Armor")').innerText();
ok(/\b51\b/.test(linhaLeve), `Riften Light Armor deveria ter 51 no estoque: ${linhaLeve}`);
ok(!/Lend[áa]rio/.test(corpo), 'lendárias não deveriam virar item separado');

/* ============================================================
   6. Arsenal: sub-aba própria, gavetas fechadas e filtro de empunhadura
   ============================================================ */
await p.click('.sub-aba:has-text("Arsenal")');
await p.waitForTimeout(500);
ok((await p.locator('.estoque-bloco.dobravel').count()) === 6,
   'o arsenal devia trazer os seis materiais em gavetas');
ok((await p.locator('.estoque-bloco.aberto').count()) === 0,
   'as gavetas do arsenal deviam começar fechadas');
ok((await p.locator('.estoque-linha').count()) === 0,
   'com tudo fechado, nenhuma arma devia estar na tela');

const arsenal = await p.locator('.painel').first().innerText();
for (const m of ['Ferro', 'Aço', 'Élfico', 'Cristal', 'Nórdico', 'Ébano']) {
  ok(arsenal.includes(m), `falta o material "${m}"`);
}
ok(!/Daedric|Daédric/i.test(arsenal), 'não deveria haver arma daédrica');

// Abrir uma gaveta mostra só as armas daquele material
await p.click('.estoque-bloco:has-text("Ébano") .bloco-cab');
await p.waitForTimeout(400);
const ebano = await p.locator('.estoque-bloco.aberto').innerText();
ok(/Ebony Warhammer/.test(ebano) && /Ebony Bow/.test(ebano), `gaveta do Ébano incompleta: ${ebano.slice(0, 200)}`);
ok(!/Iron Sword/.test(await p.locator('.estoque-lista').first().innerText()),
   'a gaveta aberta não devia trazer arma de outro material');
await shot('L2-arsenal');

// Empunhadura: o filtro que o Jarl gosta
await p.selectOption('.barra-filtros.compacta select >> nth=1', 'Duas mãos');
await p.waitForTimeout(400);
await p.click('.gaveta-bts .btn >> nth=0');   // abrir todos
await p.waitForTimeout(400);
const duasMaos = await p.locator('.painel').first().innerText();
ok(/Ebony Warhammer/.test(duasMaos) && /Iron Battleaxe/.test(duasMaos),
   'o filtro de duas mãos devia manter espadão, machadão e martelo');
ok(!/Ebony Sword/.test(duasMaos) && !/Iron Bow/.test(duasMaos) && !/Iron Dagger/.test(duasMaos),
   'o filtro de duas mãos não devia trazer arma de uma mão');
await p.selectOption('.barra-filtros.compacta select >> nth=1', '');
await p.waitForTimeout(300);

// Ferro e Aço não têm arco
await p.selectOption('.barra-filtros.compacta select >> nth=0', 'ferro');
await p.waitForTimeout(400);
const ferro = await p.locator('.painel').first().innerText();
ok(ferro.includes('Iron Sword') && !ferro.includes('Iron Bow'), 'Ferro não deveria ter arco');
await p.selectOption('.barra-filtros.compacta select >> nth=0', '');
await p.waitForTimeout(300);

// -------- 7. Poções e ingredientes --------
await p.click('.aba-painel:has-text("Poções e Ingredientes")');
await p.waitForTimeout(500);
ok((await p.locator('.estoque-bloco.aberto').count()) === 0,
   'as gavetas de poções também deviam começar fechadas');
await p.click('.gaveta-bts .btn >> nth=0');
await p.waitForTimeout(400);
const alq = await p.locator('body').innerText();
for (const t of ['Potion of Healing', 'Potion of Ultimate Magicka', 'Potion of Minor Stamina']) {
  ok(alq.includes(t), `falta "${t}" no painel de alquimia`);
}
ok(/Restore Health/.test(alq) && /Restore Magicka/.test(alq) && /Restore Stamina/.test(alq),
   'faltam os três efeitos');

await p.click('.sub-aba:has-text("Ingredientes")');
await p.waitForTimeout(500);
ok((await p.locator('.estoque-linha').count()) <= 18,
   'a lista de ingredientes devia vir aos poucos, não os 49 de uma vez');
ok((await p.locator('.ver-mais').count()) === 1, 'faltou o botão de ver mais ingredientes');

// A busca do topo é o caminho curto até um ingrediente
await p.fill('.barra-filtros .campo.busca input', 'Mountain Flower');
await p.waitForTimeout(500);
const ing = await p.locator('body').innerText();
for (const t of ['Blue Mountain Flower', 'Red Mountain Flower', 'Purple Mountain Flower']) {
  ok(ing.includes(t), `a busca devia achar o ingrediente "${t}"`);
}
await p.fill('.barra-filtros .campo.busca input', '');
await p.waitForTimeout(400);
await shot('L3-alquimia');

// -------- 8. Recursos --------
await p.click('.aba-painel:has-text("Recursos e Insumos")');
await p.waitForTimeout(500);
await p.click('.gaveta-bts .btn >> nth=0');
await p.waitForTimeout(400);
const rec = await p.locator('body').innerText();
for (const t of ['Iron Ore', 'Ebony Ore', 'Steel Ingot', 'Refined Malachite',
                 'Bear Pelt', 'Leather', 'Leather Strips']) {
  ok(rec.includes(t), `falta o recurso "${t}"`);
}
await shot('L4-recursos');

/* ============================================================
   9. Entrada e saída mexem só no estoque deste prédio
   ============================================================ */
const saldoDe = (nome) =>
  p.locator(`.estoque-linha:has(.estoque-nome:text-is("${nome}")) .estoque-qtd`).innerText();

await p.click('.pg-head .btn.primario');           // Registrar entrada
await p.waitForTimeout(400);
ok(/Mistveil Keep Barracks/.test(await p.locator('.mov-predio').innerText()),
   'o formulário devia dizer em qual prédio o lançamento entra');
await p.selectOption('.modal .grade.g2 select', 'recursos');
await p.waitForTimeout(200);
await p.fill('.modal .grade.g2 input', 'Iron Ingot');
await p.waitForTimeout(300);
const opts = await p.locator('.modal select').nth(1).locator('option').allInnerTexts();
ok(opts.some(o => /Iron Ingot/.test(o)), `o filtro não achou Iron Ingot: ${opts.join(' | ')}`);
await p.selectOption('.modal select >> nth=1', { label: opts.find(o => /^Iron Ingot/.test(o)) });
await p.fill('.modal input[type=number]', '40');
await p.waitForTimeout(300);
const resumo = await p.locator('.mov-resumo').innerText();
ok(/Iron Ingot/.test(resumo) && /\+40/.test(resumo), `resumo do movimento estranho: ${resumo}`);
await shot('L5-entrada');
await p.click('.modal-f .btn.primario');
await p.waitForTimeout(800);

await p.click('.gaveta-bts .btn >> nth=0');
await p.waitForTimeout(400);
ok((await saldoDe('Iron Ingot')).trim() === '40',
   `depois da entrada o saldo deveria ser 40, veio "${await saldoDe('Iron Ingot')}"`);

// Saída abate do saldo
await p.click('.estoque-linha:has(.estoque-nome:text-is("Iron Ingot")) .estoque-bts .btn:nth-child(2)');
await p.waitForTimeout(400);
await p.fill('.modal input[type=number]', '15');
await p.waitForTimeout(250);
await p.click('.modal-f .btn.perigo');
await p.waitForTimeout(800);
await p.click('.gaveta-bts .btn >> nth=0');
await p.waitForTimeout(400);
ok((await saldoDe('Iron Ingot')).trim() === '25',
   `depois da saída o saldo deveria ser 25, veio "${await saldoDe('Iron Ingot')}"`);

// Saída maior que o saldo é barrada
await p.click('.estoque-linha:has(.estoque-nome:text-is("Iron Ingot")) .estoque-bts .btn:nth-child(2)');
await p.waitForTimeout(400);
await p.fill('.modal input[type=number]', '999');
await p.waitForTimeout(250);
ok(await p.locator('.mov-resumo.erro').count() === 1, 'saída acima do saldo deveria acusar erro');
ok(await p.locator('.modal-f .btn.perigo').isDisabled(), 'o botão de baixa deveria travar');
await shot('L6-excede');
await p.click('.modal-f .btn.fantasma');
await p.waitForTimeout(300);

/* ============================================================
   10. Transferência: sai de um prédio e entra no outro
   ============================================================ */
await p.click('.estoque-linha:has(.estoque-nome:text-is("Iron Ingot")) .estoque-bts .btn:nth-child(2)');
await p.waitForTimeout(400);
await p.click('.troca-sentido .sentido:has-text("Transferir")');
await p.waitForTimeout(300);
await p.selectOption('.modal .grade.g2 >> nth=1 >> select', { label: 'Fort Greenwall' });
await p.fill('.modal input[type=number]', '10');
await p.waitForTimeout(300);
await p.click('.modal-f .btn.primario');
await p.waitForTimeout(900);
await p.click('.gaveta-bts .btn >> nth=0');
await p.waitForTimeout(400);
ok((await saldoDe('Iron Ingot')).trim() === '15',
   `depois de transferir 10, o Quartel devia ficar com 15, veio "${await saldoDe('Iron Ingot')}"`);

// No forte, os 10 chegaram
await p.click('.predio-atalho:has-text("Greenwall")');
await p.waitForTimeout(700);
ok(/Fort Greenwall/.test(await p.locator('.pg-head h1').innerText()), 'o atalho devia trocar de prédio');
await p.click('.aba-painel:has-text("Recursos e Insumos")');
await p.waitForTimeout(500);
await p.click('.gaveta-bts .btn >> nth=0');
await p.waitForTimeout(400);
ok((await saldoDe('Iron Ingot')).trim() === '10',
   `os 10 lingotes deviam estar no forte, veio "${await saldoDe('Iron Ingot')}"`);
const livroForte = await p.locator('.painel:has-text("Livro de movimentos")').innerText();
ok(/Transfer[êe]ncia/.test(livroForte) && /Mistveil Keep Barracks/.test(livroForte),
   'o livro do forte devia registrar de onde veio');
await shot('L7-transferencia');

// E o forte não herdou o baú do Quartel
const linhasForte = await p.locator('.aba-painel').first().innerText();
ok(/\b0\b/.test(linhasForte), `o forte não devia ter equipamento nenhum: ${linhasForte}`);

// -------- 11. Extrato mostra os três prédios --------
await p.click('.estoque-linha:has(.estoque-nome:text-is("Iron Ingot")) .estoque-nome');
await p.waitForTimeout(500);
const extrato = await p.locator('.modal').innerText();
ok(/\+10/.test(extrato), `o extrato do forte não bate: ${extrato.slice(0, 300)}`);
const holdsExtrato = await p.locator('.extrato-hold').allInnerTexts();
ok(holdsExtrato.length === 3, 'o extrato devia dizer quanto há em cada prédio');
ok(holdsExtrato.some(h => /Barracas/.test(h) && /15/.test(h)),
   `o extrato devia mostrar 15 no Quartel: ${holdsExtrato.join(' | ')}`);
await shot('L8-extrato');

// -------- 12. A escolha do prédio se mantém ao voltar --------
await p.click('.modal-x, .modal-f .btn').catch(() => {});
await p.keyboard.press('Escape');
await p.waitForTimeout(300);
await p.click('.nav-item:has-text("Registro de Prisões")');
await p.waitForTimeout(500);
await irLogistica();
ok(/Fort Greenwall/.test(await p.locator('.pg-head h1').innerText()),
   'ao voltar, a Logística devia lembrar do último prédio');
await p.click('.trocar-predio');
await p.waitForTimeout(500);
ok((await p.locator('.predio-escolha').count()) === 1,
   '"Trocar de prédio" devia voltar para a escolha');

await b.close();
console.log(erros.length
  ? 'PROBLEMAS:\n' + erros.join('\n')
  : 'Tudo certo — três prédios, gavetas fechadas, saldos por casa e transferência.');
