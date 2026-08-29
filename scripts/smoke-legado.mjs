import pw from '/home/claude/.npm-global/lib/node_modules/playwright/index.js';
const { chromium } = pw;
const erros = [];
const ok = (c, m) => { if (!c) erros.push('[falha] ' + m); };
const b = await chromium.launch();
const p = await b.newPage({ viewport:{width:1440,height:1000} });
p.on('pageerror', e=>erros.push('[pageerror] '+e.message));
p.on('console', m=>{ if(m.type()==='error' && !/ERR_TUNNEL|Failed to load resource/.test(m.text())) erros.push('[console] '+m.text()); });

// Reproduz o estado quebrado: três casas gravadas SEM id, como no navegador dele.
const quebrado = {
  clas: [
    { nome: 'Blackwing', lider: 'Aldric Blackwing', titulo_lider: 'Patriarca', cor: '#7c6bb0', membros: [] },
    { nome: 'Blackwing', lider: 'Aldric Blackwing', titulo_lider: 'Patriarca', cor: '#7c6bb0', membros: [{ nome: 'Vera' }] },
    { nome: 'Blackwing', lider: 'Aldric Blackwing', titulo_lider: 'Patriarca', cor: '#7c6bb0', membros: [{ nome: 'Vera' }, { nome: 'Torgar' }] },
  ],
  corte: [], guardas: [], trabalhadores: [], propriedades: [], assentamentos: [], registros: [],
};
await p.addInitScript((estado) => {
  localStorage.setItem('riften-hold:v1', JSON.stringify(estado));
}, quebrado);

await p.goto('http://localhost:4173',{waitUntil:'networkidle'});
await p.click('.portal-card:has(.portal-nome:text-is("Corte de Riften"))');
await p.waitForTimeout(300);
await p.fill('.login-caixa input >> nth=0','jarl@riften.rift');
await p.fill('input[type=password]','mistveil');
await p.click('button.primario');
await p.waitForSelector('.sidebar'); await p.waitForTimeout(700);

// 1. o saneamento deu id a todas
const ids = await p.evaluate(() => JSON.parse(localStorage.getItem('riften-hold:v1')).clas.map(c => c.id));
ok(ids.length === 3 && ids.every(i => i) && new Set(ids).size === 3, `ids após saneamento: ${JSON.stringify(ids)}`);
ok(await p.locator('.cla-card').count() === 3, 'as 3 casas legadas deveriam continuar aparecendo');
await p.screenshot({path:'/home/claude/shots/L1-legado.png'});

// 2. editar uma casa legada NÃO pode criar cópia
await p.locator('.cla-abrir').first().click();
await p.waitForTimeout(350);
await p.click('.modal button:has-text("Adicionar membro")');
await p.waitForTimeout(200);
await p.fill('.lista-membros li:last-child .seletor-civil input', 'Sif Blackwing');
await p.click('.modal-f .btn.primario');
await p.waitForTimeout(700);
ok(await p.locator('.cla-card').count() === 3, `editar casa legada duplicou: agora há ${await p.locator('.cla-card').count()} cartões`);
ok((await p.locator('.cla-card').first().innerText()).includes('1 membro'), 'o membro adicionado não foi salvo na casa legada');

// 3. dissolver cada uma, pelo botão do cartão
for (let esperado = 2; esperado >= 0; esperado--) {
  await p.locator('.cla-card').first().hover();
  await p.locator('.cla-remover').first().click();
  await p.waitForTimeout(300);
  await p.click('.modal-f .btn.perigo');
  await p.waitForTimeout(700);
  const n = await p.locator('.cla-card').count();
  ok(n === esperado, `após dissolver deveria restar ${esperado}, restam ${n}`);
}
const semErroVisivel = await p.locator('.login-erro').count();
ok(semErroVisivel === 0, 'apareceu mensagem de erro ao dissolver');
await p.screenshot({path:'/home/claude/shots/L2-dissolvidas.png'});

console.log(erros.length ? 'PROBLEMAS:\n'+erros.join('\n') : 'Tudo certo — dados legados consertados, sem duplicação e todas dissolvidas.');
await b.close();
