import pw from '/home/claude/.npm-global/lib/node_modules/playwright/index.js';
const { chromium } = pw;
const erros = [];
const ok = (c, m) => { if (!c) erros.push('[falha] ' + m); };
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1440, height: 1000 } });
p.on('pageerror', e => erros.push('[pageerror] ' + e.message));
p.on('console', m => { if (m.type() === 'error' && !/ERR_TUNNEL|Failed to load resource/.test(m.text())) erros.push('[console] ' + m.text()); });
const shot = n => p.screenshot({ path: `/home/claude/shots/${n}.png` });

await p.goto('http://localhost:4173', { waitUntil: 'networkidle' });

await p.waitForTimeout(500);

// 1. Portal
ok(await p.locator('.portal-card').count() === 3, 'o portal deveria ter três caminhos');
await shot('C1-portal');

// 2. Registro público
await p.click('.portal-card:has(.portal-nome:text-is("Cidade de Riften"))');
await p.waitForTimeout(350);
await p.click('.login-alternativa .btn');
await p.waitForTimeout(400);
await p.fill('input[placeholder="Como é chamado no Hold"]', 'Brynjar Pedravalente');
await p.fill('input[placeholder="Ex.: 1042"]', '7781');
await p.selectOption('.registro-caixa select >> nth=0', 'Nórdico');
await p.selectOption('.registro-caixa select >> nth=1', 'Ferreiro-Armeiro');
await p.click('.nivel-op:has-text("Especialista")');
await p.fill('textarea', 'Moro em Ivarstead, trabalho na forja.');
await shot('C2-formulario');
await p.click('.registro-caixa form button.primario');
await p.waitForTimeout(800);
ok(await p.locator('.recibo').count() === 1, 'o recibo de envio não apareceu');
ok((await p.locator('.recibo').innerText()).includes('7781'), 'o recibo não mostra o ID do jogo');
await shot('C3-recibo');

// 3. Entra como Corte
await p.click('button:has-text("Voltar ao portal")');
await p.waitForTimeout(400);
await p.click('.portal-card:has(.portal-nome:text-is("Corte de Riften"))');
await p.waitForTimeout(400);
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
await p.waitForTimeout(700);

// 4. Badge de pendente
const badge = await p.locator('.nav-item:has-text("Registro Civil") .badge-num').innerText();
ok(badge.trim() === '1', `o menu deveria marcar 1 pendente, marcou "${badge}"`);
await p.click('.nav-item:has-text("Registro Civil")');
await p.waitForTimeout(600);
ok(await p.locator('.civil-pedido').count() === 1, 'o pedido não chegou na fila da Corte');
await shot('C4-fila');

// 5. Aprovar
await p.click('.civil-pedido button:has-text("Aprovar")');
await p.waitForTimeout(800);
// a aprovação abre as credenciais para a Corte entregar em mãos
const cred = await p.locator('.modal').innerText();
ok(/Credenciais/.test(cred), 'a aprovação deveria mostrar as credenciais do morador');
ok(/RFT-/.test(cred), 'a aprovação deveria gerar a senha de acesso');
await p.click('.modal-f .btn.primario');
await p.waitForTimeout(400);
ok(await p.locator('.civil-pedido').count() === 0, 'o pedido deveria sair da fila após aprovado');
const linhas = await p.locator('tbody tr').count();
ok(linhas === 1, `a lista oficial deveria ter 1 cidadão, tem ${linhas}`);
ok((await p.locator('tbody tr').innerText()).includes('7781'), 'o ID não aparece na lista oficial');
await shot('C5-aprovado');

// 6. Consulta a partir de Trabalhadores
await p.click('.nav-item:has-text("Trabalhadores")');
await p.waitForTimeout(500);
await p.click('.pg-head .btn.primario');
await p.waitForTimeout(400);
await p.fill('.seletor-civil input', 'Bryn');
await p.waitForTimeout(400);
ok(await p.locator('.seletor-op').count() === 1, 'a busca no Registro Civil não achou o cidadão');
await shot('C6-busca');
await p.click('.seletor-op');
await p.waitForTimeout(400);

const idJogo = await p.inputValue('.modal input.mono');
ok(idJogo === '7781', `o ID deveria vir preenchido, veio "${idJogo}"`);
const vals = await p.locator('.modal select').evaluateAll(els => els.map(e => e.value));
ok(vals.includes('Nórdico'), `a raça não foi preenchida (selects: ${vals.join(', ')})`);
ok(vals.includes('Ferreiro-Armeiro'), 'a profissão não foi preenchida');
ok(vals.includes('Especialista'), 'o nível não foi preenchido');
ok(await p.locator('.civil-vinculado').count() === 1, 'o vínculo com o Registro Civil não foi marcado');
await shot('C7-preenchido');

await p.click('.modal-f .btn.primario');
await p.waitForTimeout(800);
const linhaT = await p.locator('tbody tr').innerText();
ok(/7781/.test(linhaT), 'o ID do jogo não foi salvo na ficha do trabalhador');
ok(/civil/.test(linhaT), 'a marca de vínculo civil não aparece na lista');
await shot('C8-trabalhador');

// 7. Botão "Contratar" direto do Registro Civil
await p.click('.nav-item:has-text("Registro Civil")');
await p.waitForTimeout(500);
const temContratar = await p.locator('button:has-text("Contratar")').count();
ok(temContratar === 0, 'quem já é trabalhador não deveria mostrar "Contratar"');

console.log(erros.length ? 'PROBLEMAS:\n' + erros.join('\n') : 'Tudo certo — portal, registro, aprovação e consulta funcionando.');
await b.close();
