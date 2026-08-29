import pw from '/home/claude/.npm-global/lib/node_modules/playwright/index.js';
const { chromium } = pw;
const erros = [];
const ok = (c, m) => { if (!c) erros.push('[falha] ' + m); };
const b = await chromium.launch();
const p = await b.newPage({ viewport:{width:1440,height:1000} });
p.on('pageerror', e=>erros.push('[pageerror] '+e.message));
p.on('console', m=>{ if(m.type()==='error' && !/ERR_TUNNEL|Failed to load resource/.test(m.text())) erros.push('[console] '+m.text()); });

await p.goto('http://localhost:4173',{waitUntil:'networkidle'});

await p.click('.portal-card:has(.portal-nome:text-is("Corte de Riften"))');
await p.waitForTimeout(300);
await p.fill('.login-caixa input >> nth=0','jarl@riften.rift');
await p.fill('input[type=password]','mistveil');
await p.click('button.primario');
await p.waitForSelector('.sidebar'); await p.waitForTimeout(500);

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

// cria a casa
await p.click('.painel:has(.painel-h h3:text-is("Casas & Dinastias Nobres")) button.primario');
await p.waitForTimeout(300);
await p.fill('.modal input[placeholder="Clã ..."]','Blackwing');
await p.fill('.modal .cla-campos .seletor-civil input','Aldric Blackwing');
await p.setInputFiles('.modal input[type=file]','/tmp/brasao.png');
await p.waitForTimeout(600);
await p.click('.modal-f .btn.primario');
await p.waitForTimeout(700);
ok(await p.locator('.cla-card').count() === 1, `após criar deveria haver 1 cartão, há ${await p.locator('.cla-card').count()}`);

// reabre e adiciona membros — três vezes seguidas
for (const nome of ['Vera Blackwing','Torgar Blackwing','Sif Blackwing']) {
  await p.click('.cla-card');
  await p.waitForTimeout(350);
  await p.click('.modal button:has-text("Adicionar membro")');
  await p.waitForTimeout(200);
  await p.fill('.lista-membros li:last-child .seletor-civil input', nome);
  await p.click('.modal-f .btn.primario');
  await p.waitForTimeout(600);
  const n = await p.locator('.cla-card').count();
  ok(n === 1, `depois de adicionar "${nome}" deveria continuar 1 cartão, há ${n}`);
}
const texto = await p.locator('.cla-card').innerText();
ok(/3 membros/.test(texto), `o cartão deveria mostrar 3 membros — mostra: ${texto.replace(/\n/g,' | ')}`);

// confere que os três nomes estão salvos dentro da ficha
await p.click('.cla-card'); await p.waitForTimeout(400);
const membros = await p.locator('.lista-membros li').count();
ok(membros === 3, `a ficha deveria listar 3 membros, lista ${membros}`);
await p.screenshot({path:'/home/claude/shots/R1-ficha.png'});
await p.click('.modal-h .x'); await p.waitForTimeout(400);

// mais duas casas para ver a grade
for (const [n,l] of [['Casa Corvo Negro','Ysolda'],['Clã Pedravalente','Brynjar Pedravalente de Ivarstead']]) {
  await p.click('.painel:has(.painel-h h3:text-is("Casas & Dinastias Nobres")) button.primario');
  await p.waitForTimeout(250);
  await p.fill('.modal input[placeholder="Clã ..."]', n);
  await p.fill('.modal .cla-campos .seletor-civil input', l);
  if (n.includes('Corvo')) await p.setInputFiles('.modal input[type=file]','/tmp/brasao.png');
  await p.waitForTimeout(400);
  await p.click('.modal-f .btn.primario');
  await p.waitForTimeout(600);
}
await p.locator('.painel:has(.painel-h h3:text-is("Casas & Dinastias Nobres"))').scrollIntoViewIfNeeded();
await p.waitForTimeout(400);
await p.screenshot({path:'/home/claude/shots/R2-cartoes.png'});
ok(await p.locator('.cla-card').count() === 3, 'deveriam existir 3 casas');

console.log(erros.length ? 'PROBLEMAS:\n'+erros.join('\n') : 'Tudo certo — sem duplicação e sem erros.');
await b.close();
