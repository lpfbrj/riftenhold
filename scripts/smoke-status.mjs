import pw from '/home/claude/.npm-global/lib/node_modules/playwright/index.js';
const { chromium } = pw;
const erros = [];
const ok = (c, m) => { if (!c) erros.push('[falha] ' + m); };
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1440, height: 1050 } });
p.on('pageerror', e => erros.push('[pageerror] ' + e.message));
p.on('console', m => { if (m.type() === 'error' && !/ERR_TUNNEL|Failed to load resource/.test(m.text())) erros.push('[console] ' + m.text()); });

const ESPERADO = {
  'Black-Briar Meadery': 'Vaga', "Elgrim's Elixirs": 'Vaga', "Haelga's Bunkhouse": 'Vaga',
  'Heartwood Mill': 'Vaga', 'Pawned Prawn': 'Vaga', 'The Bee and Barb': 'Vaga', 'Vilemyr Inn': 'Vaga',
  'Snow-Shod Farm': 'Interditada', 'Sarethi Farm': 'Interditada', 'Fellstar Farm': 'Interditada',
  'Riften Fishery': 'Interditada', 'Riften Warehouse': 'Interditada',
  'The Scorched Hammer': 'Operante',
};

// Parte 1 — instalação nova
await p.goto('http://localhost:4173', { waitUntil: 'networkidle' });
await p.waitForTimeout(400);
await p.click('.portal-card:has(.portal-nome:text-is("Corte de Riften"))');
await p.waitForTimeout(300);
await p.fill('.login-caixa input >> nth=0', 'jarl@riften.rift');
await p.fill('input[type=password]', 'mistveil');
await p.click('.login-caixa form button.primario');
await p.waitForSelector('.sidebar', { timeout: 8000 });
await p.click('.nav-item:has-text("Imobiliária")');
await p.waitForTimeout(700);

ok(await p.locator('.prop-card').count() === 13, `esperava 13 comércios, achei ${await p.locator('.prop-card').count()}`);
for (const [nome, status] of Object.entries(ESPERADO)) {
  const t = await p.locator(`.prop-card:has-text("${nome}")`).first().innerText().catch(() => '');
  ok(t.includes(status), `${nome} deveria estar "${status}" — cartão diz: ${t.split('\n').slice(0,3).join(' / ')}`);
}
const fishery = await p.locator('.prop-card:has-text("Riften Fishery")').innerText();
ok(/6\s*Inventário/.test(fishery), 'Fishery: faltam os 6 inventários');
ok(/Peixe Assassino/.test(fishery), 'Fishery: falta o Peixe Assassino');
ok(/Farm de Carne de Salmão/.test(fishery), 'Fishery: falta o Farm de Carne de Salmão');
const warehouse = await p.locator('.prop-card:has-text("Riften Warehouse")').innerText();
ok(/27\s*Inventário/.test(warehouse), 'Warehouse: deveria ter 27 inventários');
await p.screenshot({ path: '/home/claude/shots/S1-comercios.png' });

// Parte 2 — navegador que já tinha os dados antigos
const antigo = await p.evaluate(() => {
  const e = JSON.parse(localStorage.getItem('riften-hold:v1'));
  delete e.seed_versao;
  e.propriedades = e.propriedades
    .filter(x => !/Riften Fishery|Riften Warehouse/.test(x.nome))
    .map(x => ({ ...x, status: 'Operante' }));
  e.civis = [{ id: 'c9', nome: 'Cidadã Antiga', id_jogo: '999', status: 'Aprovado' }];
  return e;
});
await p.addInitScript((e) => {
  localStorage.setItem('riften-hold:v1', JSON.stringify(e));
  sessionStorage.removeItem('riften-hold:sessao');   // volta para o portal
  localStorage.removeItem('riften-hold:sessao');
}, antigo);
await p.goto('http://localhost:4173', { waitUntil: 'networkidle' });
await p.waitForTimeout(400);
await p.click('.portal-card:has(.portal-nome:text-is("Corte de Riften"))');
await p.waitForTimeout(300);
await p.fill('.login-caixa input >> nth=0', 'jarl@riften.rift');
await p.fill('input[type=password]', 'mistveil');
await p.click('.login-caixa form button.primario');
await p.waitForSelector('.sidebar', { timeout: 8000 });
await p.click('.nav-item:has-text("Imobiliária")');
await p.waitForTimeout(700);

ok(await p.locator('.prop-card').count() === 13, `após migrar, esperava 13 comércios, achei ${await p.locator('.prop-card').count()}`);
for (const [nome, status] of Object.entries(ESPERADO)) {
  const t = await p.locator(`.prop-card:has-text("${nome}")`).first().innerText().catch(() => '');
  ok(t.includes(status), `migração: ${nome} deveria virar "${status}"`);
}
// A migração acrescenta os três moradores de demonstração, mas não pode
// tocar em quem a Corte já cadastrou.
const civis = await p.evaluate(() => JSON.parse(localStorage.getItem('riften-hold:v1')).civis);
const antiga = civis.find((c) => c.id === 'c9');
ok(Boolean(antiga) && antiga.nome === 'Cidadã Antiga' && antiga.id_jogo === '999',
   'a migração não podia mexer no Registro Civil já cadastrado');
const demo = civis.filter((c) => ['Sophia', 'Aldric', 'Varek'].includes(c.id_jogo)).length;
ok(civis.length === 4 && demo === 3,
   `esperava a cidadã antiga mais os três moradores de demonstração, achei ${civis.length}`);
await p.screenshot({ path: '/home/claude/shots/S2-migrado.png' });

console.log(erros.length ? 'PROBLEMAS:\n' + erros.join('\n') : 'Tudo certo — comércios novos, status aplicados e migração preservando o resto.');
await b.close();
