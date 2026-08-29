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

await p.waitForTimeout(500);

// nenhum "A Rift" no portal
ok(!(await p.locator('body').innerText()).includes('A Rift'), 'ainda há "A Rift" no portal');

// cadastra e aprova um cidadão
await p.click('.portal-card:has(.portal-nome:text-is("Cidade de Riften"))');
await p.waitForTimeout(350);
await p.click('.login-alternativa .btn');
await p.waitForTimeout(400);
await p.fill('input[placeholder="Como é chamado no Hold"]', 'Eron Halvard');
await p.fill('input[placeholder="Ex.: 1042"]', '4410');
await p.selectOption('.registro-caixa select >> nth=0', 'Nórdico');
await p.selectOption('.registro-caixa select >> nth=1', 'Ferreiro-Armamentista');
await p.click('.nivel-op:has-text("Mestre")');
await p.click('.registro-caixa form button.primario');
await p.waitForTimeout(700);
await p.click('button:has-text("Voltar ao portal")');
await p.waitForTimeout(300);
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
await p.waitForTimeout(700);

// menu: Registro Civil está em Registros, e existe Emissão de Licenças
const secoes = await p.locator('.nav-sec').allInnerTexts();
ok(secoes.length === 3, `esperava 3 seções no menu, achei ${secoes.length}`);
const ordem = await p.locator('.sidebar > *').allInnerTexts();
const iAdm = ordem.findIndex(t => /ADMINISTRA/i.test(t));
const iReg = ordem.findIndex(t => /^REGISTROS$/i.test(t.trim()));
const iCivil = ordem.findIndex(t => /Registro Civil/.test(t));
ok(iCivil > iReg, 'Registro Civil deveria estar depois do cabeçalho Registros');
ok(ordem.some(t => /Emissão de Licenças/.test(t)), 'falta a aba Emissão de Licenças');
ok(!(await p.locator('.sidebar').innerText()).includes('A Rift'), 'ainda há "A Rift" no menu');
await shot('P1-menu');

// aprova
await p.click('.nav-item:has-text("Registro Civil")');
await p.waitForTimeout(500);
await p.click('.civil-pedido button:has-text("Aprovar")');
await p.waitForTimeout(800);
// a aprovação abre as credenciais para a Corte entregar — fecha e segue
await p.click('.modal-f .btn.primario');
await p.waitForTimeout(400);

// dá a ele a propriedade The Scorched Hammer
await p.click('.nav-item:has-text("Imobiliária")');
await p.waitForTimeout(600);
await p.click('.prop-card:has-text("Scorched Hammer") button:has-text("Abrir ficha")');
await p.waitForTimeout(400);
await p.fill('.seletor-civil input', 'Eron');
await p.waitForTimeout(400);
await p.click('.seletor-op');
await p.waitForTimeout(300);
await p.click('.modal-f .btn.primario');
await p.waitForTimeout(800);

// emite uma licença de mineração
await p.click('.nav-item:has-text("Licenças")');
await p.waitForTimeout(600);
await p.click('.pg-head .btn.primario');
await p.waitForTimeout(400);
await p.fill('.seletor-civil input', 'Eron');
await p.waitForTimeout(400);
await p.click('.seletor-op');
await p.waitForTimeout(300);
await p.click('.cobertura-op:has-text("Veios")');
await p.click('.cobertura-op:has-text("Minas")');
await p.click('.minerio-op:has-text("Ferro")');
await p.click('.minerio-op:has-text("Prata")');
await p.click('.minerio-op:has-text("Ébano")');
await p.click('.escolta-op');
ok(await p.locator('.interruptor.on').count() === 1, 'o interruptor de escolta não ligou');
ok(await p.locator('.minerio-op.ativo').count() === 3, 'esperava 3 minérios autorizados');
await shot('P2-emitir');
await p.click('.modal-f .btn.primario');
await p.waitForTimeout(800);

const cartao = await p.locator('.licenca-card').innerText();
ok(/LIC-MIN-0001/.test(cartao), `o número da licença não saiu certo: ${cartao.split('\n')[1]}`);
ok(/Com escolta/.test(cartao), 'a escolta não aparece no cartão');
ok(/Ferro/.test(cartao) && /Prata/.test(cartao) && /Ébano/.test(cartao), 'faltam minérios no cartão');
ok(/Exploração dos Veios/.test(cartao) && /Exploração das Minas/.test(cartao), 'falta cobertura no cartão');
await shot('P3-licenca');

// perfil reúne tudo
await p.click('.nav-item:has-text("Registro Civil")');
await p.waitForTimeout(600);
await p.click('td .link-perfil');
await p.waitForTimeout(600);
const perfil = await p.locator('.modal').innerText();
ok(/4410/.test(perfil), 'o perfil não mostra o ID do jogo');
ok(/Scorched Hammer/.test(perfil), 'o perfil não mostra a propriedade dele');
ok(/LIC-MIN-0001/.test(perfil), 'o perfil não mostra a licença');
ok(/Ferreiro-Armamentista/.test(perfil), 'o perfil não mostra o ofício');
ok(/Com escolta|Escolta/.test(perfil), 'o perfil não mostra a escolta');
await shot('P4-perfil');

console.log(erros.length ? 'PROBLEMAS:\n' + erros.join('\n') : 'Tudo certo — perfil unificado e licenças funcionando.');
await b.close();
