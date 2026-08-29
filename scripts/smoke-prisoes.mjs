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
await p.waitForTimeout(400);
await p.click('.portal-card:has(.portal-nome:text-is("Corte de Riften"))');
await p.waitForTimeout(300);
await p.fill('.login-caixa input >> nth=0', 'jarl@riften.rift');
await p.fill('input[type=password]', 'mistveil');
await p.click('.login-caixa form button.primario');
await p.waitForSelector('.sidebar', { timeout: 8000 });
await p.waitForTimeout(600);

// menu: nova seção Quartel General com Exército e Prisões
const secoes = await p.locator('.nav-sec').allInnerTexts();
ok(secoes.length === 3, `esperava 3 seções no menu, achei ${secoes.length}: ${secoes.join(' / ')}`);
ok(secoes.some(t => /QUARTEL GENERAL/i.test(t)), 'falta a seção Quartel General');
const lateral = await p.locator('.sidebar').innerText();
const iQG = lateral.indexOf('QUARTEL GENERAL');
const iEx = lateral.indexOf('Exército de Riften');
const iPr = lateral.indexOf('Registro de Prisões');
const iReg = lateral.indexOf('REGISTROS');
ok(iQG > 0 && iEx > iQG && iPr > iEx && iReg > iPr, 'Exército e Prisões deveriam ficar sob Quartel General');
await shot('Q1-menu');

// Código de Riften: catálogo completo
await p.click('.nav-item:has-text("Registro de Prisões")');
await p.waitForTimeout(500);
await p.click('button:has-text("Consultar o Código")');
await p.waitForTimeout(400);
const codigo = await p.locator('.modal').innerText();
for (const t of ['Perturbação da ordem pública', 'Formação de quadrilha', 'Traição à Coroa',
                 'Sacar arma sem justificativa', 'Mineração sem autorização', 'Fraudar impostos']) {
  ok(codigo.includes(t), `o Código não lista "${t}"`);
}
ok((await p.locator('.modal tbody tr').count()) === 29, `esperava 29 crimes, achei ${await p.locator('.modal tbody tr').count()}`);
ok(/Sem fiança/.test(codigo), 'faltam os crimes sem fiança');
await shot('Q2-codigo');
await p.click('.modal-f .btn.primario');
await p.waitForTimeout(300);

// registra uma prisão com pena curta, para o cronômetro terminar durante o teste
await p.click('.pg-head .btn.primario');
await p.waitForTimeout(400);
await p.fill('.seletor-civil input', 'Ulfr, o Bêbado');
await p.selectOption('.modal .grade.g3 select', 'winterhold');
await p.selectOption('.crime-select', 'c08');   // Embriaguez causando desordem — 5 min
const resumo = await p.locator('.pena-resumo').innerText();
ok(/5 min/.test(resumo), 'o resumo não trouxe a pena de 5 min');
ok(/400/.test(resumo), 'o resumo não trouxe a multa de 400 Septims');
ok(/800/.test(resumo), 'o resumo não trouxe a fiança de 800 Septims');
await p.fill('.modal textarea', 'Derrubou as mesas do Bee and Barb.');
await shot('Q3-registrar');
await p.click('.modal-f .btn.primario');
await p.waitForTimeout(900);

// cela ocupada, cronômetro correndo
ok(await p.locator('.cela-card').count() === 1, 'a prisão não apareceu nas celas');
const cela = await p.locator('.cela-card').innerText();
ok(/Winterhold/.test(cela), 'a procedência não aparece na cela');
ok(/Embriaguez/.test(cela), 'o crime não aparece na cela');
ok(/Art\. 8º/.test(cela), 'o artigo não aparece na cela');
const t1 = await p.locator('.cronometro').innerText();
ok(/^0[45]:\d\d$/.test(t1.trim()), `o cronômetro deveria começar perto de 05:00 — veio "${t1}"`);
await p.waitForTimeout(2500);
const t2 = await p.locator('.cronometro').innerText();
ok(t1 !== t2, `o cronômetro não está correndo (${t1} → ${t2})`);
ok(await p.locator('button:has-text("Registrar pena cumprida")').count() === 0, 'o botão de pena cumprida apareceu antes da hora');
await shot('Q4-cela');

// força o fim da pena e confere o botão
await p.evaluate(() => {
  const e = JSON.parse(localStorage.getItem('riften-hold:v1'));
  e.prisoes[0].fim = new Date(Date.now() - 1000).toISOString();
  localStorage.setItem('riften-hold:v1', JSON.stringify(e));
});
await p.reload({ waitUntil: 'networkidle' });
await p.waitForTimeout(900);
await p.click('.nav-item:has-text("Registro de Prisões")');
await p.waitForTimeout(700);
ok(await p.locator('.cronometro.fim').count() === 1, 'a cela não marcou PENA CUMPRIDA');
ok(await p.locator('button:has-text("Registrar pena cumprida")').count() === 1, 'falta o botão de registrar pena cumprida');
await shot('Q5-fim');

await p.click('button:has-text("Registrar pena cumprida")');
await p.waitForTimeout(900);
ok(await p.locator('.cela-card').count() === 0, 'a cela deveria esvaziar');
const linha = await p.locator('tbody tr').innerText();
ok(/Sentença cumprida/.test(linha), 'o registro não ficou como Sentença cumprida');
ok(/Ulfr/.test(linha), 'o preso não aparece no histórico');
await shot('Q6-historico');

console.log(erros.length ? 'PROBLEMAS:\n' + erros.join('\n') : 'Tudo certo — Quartel General, Código, cronômetro e histórico funcionando.');
await b.close();
