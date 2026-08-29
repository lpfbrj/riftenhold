/**
 * Ajustes de acabamento:
 *   1. Crônica da Corte — 10 por página, com páginas e com apagar (um / tudo)
 *   2. Perfil — "Lorde de X" no lugar de "Lorde" + "Lorde nomeado", e sem
 *      selo de Ficha criminal para quem já cumpriu pena
 *   3. Brasão — só formato com transparência, com o limite escrito na tela
 */
import pw from '/home/claude/.npm-global/lib/node_modules/playwright/index.js';
const { chromium } = pw;
const erros = [];
const ok = (c, m) => { if (!c) erros.push('[falha] ' + m); };
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1440, height: 1100 } });
p.on('pageerror', e => erros.push('[pageerror] ' + e.message));
p.on('console', m => { if (m.type() === 'error' && !/ERR_TUNNEL|Failed to load resource/.test(m.text())) erros.push('[console] ' + m.text()); });
const shot = n => p.screenshot({ path: `/home/claude/shots/${n}.png` });
const limpar = () => p.evaluate(() => {
  sessionStorage.removeItem('riften-hold:sessao');
  sessionStorage.removeItem('riften-hold:cidadao');
});
const aoPortal = async () => { await limpar(); await p.reload({ waitUntil: 'networkidle' }); await p.waitForTimeout(400); };
const entrarCorte = async () => {
  await p.click('.portal-card:has(.portal-nome:text-is("Corte de Riften"))');
  await p.waitForTimeout(300);
  await p.fill('.login-caixa input >> nth=0', 'jarl@riften.rift');
  await p.fill('input[type=password]', 'mistveil');
  await p.click('.login-caixa form button.primario');
  await p.waitForSelector('.sidebar', { timeout: 8000 });
  await p.waitForTimeout(500);
};

await p.goto('http://localhost:4173', { waitUntil: 'networkidle' });

/* ============================================================
   1. Crônica da Corte
   ============================================================ */
// 23 atos plantados direto no armazém local: a paginação é o que se testa
// aqui, não o caminho que gera cada ato (isso as outras suítes já cobrem).
await p.evaluate(() => {
  const bruto = JSON.parse(localStorage.getItem('riften-hold:v1') || '{}');
  const base = Date.parse('2026-08-01T12:00:00Z');
  bruto.registros = Array.from({ length: 23 }, (_, i) => ({
    id: `ato-${i}`, autor: 'Jarl Laila', acao: 'editou', entidade: 'civis',
    alvo: `Ato número ${i + 1}`, detalhe: '',
    criado_em: new Date(base + i * 3600_000).toISOString(),
  }));
  localStorage.setItem('riften-hold:v1', JSON.stringify(bruto));
});
await aoPortal();
await entrarCorte();
await p.click('.nav-item:has-text("Palácio do Jarl")');
await p.waitForTimeout(700);

const cronica = p.locator('.painel:has(.painel-h h3:text-is("Crônica da Corte"))');
ok((await cronica.count()) === 1, 'falta o painel da Crônica');
ok((await cronica.locator('.cronica-item').count()) === 10,
   `a Crônica devia mostrar 10 atos por página, mostrou ${await cronica.locator('.cronica-item').count()}`);
ok(/23 atos/.test(await cronica.innerText()), 'o selo devia contar os 23 atos');
const pag = cronica.locator('.paginacao');
ok((await pag.count()) === 1, 'faltou a paginação');
ok(/Página\s*1\s*de\s*3/i.test(await pag.innerText()),
   `a paginação devia dizer 1 de 3: ${await pag.innerText()}`);
ok(await pag.locator('button:has-text("Anterior")').isDisabled(),
   'na primeira página, Anterior devia estar travado');
ok(/Ato número 23/.test(await cronica.innerText()), 'o ato mais novo devia abrir a lista');
await cronica.scrollIntoViewIfNeeded();
await p.waitForTimeout(300);
await shot('A1-cronica-p1');

await pag.locator('button:has-text("Próxima")').click();
await p.waitForTimeout(400);
ok(/Página\s*2\s*de\s*3/i.test(await pag.innerText()), 'não avançou para a página 2');
const p2 = await cronica.innerText();
ok(!/Ato número 23/.test(p2), 'a página 2 não devia repetir o ato da página 1');
ok(/Ato número 13/.test(p2), 'a página 2 devia continuar de onde a 1 parou');

await pag.locator('button:has-text("Próxima")').click();
await p.waitForTimeout(400);
ok((await cronica.locator('.cronica-item').count()) === 3, 'a última página devia ter os 3 que sobram');
ok(await pag.locator('button:has-text("Próxima")').isDisabled(),
   'na última página, Próxima devia estar travado');
await shot('A2-cronica-p3');

// apagar um ato
await pag.locator('button:has-text("Anterior")').click();
await pag.locator('button:has-text("Anterior")').click();
await p.waitForTimeout(400);
await cronica.locator('.cronica-item:has-text("Ato número 23") .cronica-x').click();
await p.waitForTimeout(700);
const depoisDeUm = await cronica.innerText();
ok(!/Ato número 23/.test(depoisDeUm), 'o ato apagado devia sumir');
ok(/22 atos/.test(depoisDeUm), `a conta devia cair para 22: ${depoisDeUm.slice(0, 120)}`);
ok((await cronica.locator('.cronica-item').count()) === 10,
   'a página devia se recompor com 10 atos');

// apagar tudo
await cronica.locator('button:has-text("Limpar tudo")').click();
await p.waitForTimeout(400);
await p.click('.modal-f .btn.perigo');
await p.waitForTimeout(800);
const vazia = await cronica.innerText();
ok(/Nenhum ato registrado/i.test(vazia), `a Crônica devia ficar vazia: ${vazia.slice(0, 200)}`);
ok((await cronica.locator('.paginacao').count()) === 0, 'sem atos, não há paginação');
await shot('A3-cronica-vazia');

/* ============================================================
   2. Brasão: o limite está escrito, e JPG é recusado
   ============================================================ */
await p.click('.painel:has(.painel-h h3:text-is("Casas & Dinastias Nobres")) .btn.primario');
await p.waitForTimeout(500);
const regra = await p.locator('.modal .brasao-regra').innerText();
ok(/PNG/i.test(regra) && /sem fundo/i.test(regra), `a regra do brasão não aparece: ${regra}`);
ok(/512×512/.test(regra), `faltou o tamanho máximo na tela: ${regra}`);
ok(/4 MB/.test(regra), `faltou o limite de arquivo: ${regra}`);
ok((await p.locator('.modal .cla-brasao-edit input[type=file]').getAttribute('accept'))
   === 'image/png,image/webp,image/svg+xml', 'o seletor devia recusar JPG já na escolha');

// um JPG de verdade, para ver a recusa com explicação
await p.locator('.modal .cla-brasao-edit input[type=file]').setInputFiles({
  name: 'brasao.jpg',
  mimeType: 'image/jpeg',
  buffer: Buffer.from(
    '/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0a'
    + 'HBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAA'
    + 'AAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==', 'base64'),
});
await p.waitForTimeout(700);
const recusa = await p.locator('.modal .cla-brasao-edit p').last().innerText();
ok(/transparência/i.test(recusa) && /PNG/i.test(recusa),
   `o JPG devia ser recusado com explicação: ${recusa}`);
await shot('A4-brasao-jpg');
await p.click('.modal-h .x');
await p.waitForTimeout(400);

/* ============================================================
   3. Perfil: "Lorde de X" e nada de Ficha criminal
   ============================================================ */
// Sigurd é do Registro Civil semeado; vamos fazê-lo Lorde de um vilarejo,
// nobre de uma casa, e dar-lhe uma pena já cumprida.
const NOBRE = await p.evaluate(() => {
  const bruto = JSON.parse(localStorage.getItem('riften-hold:v1') || '{}');
  const civil = (bruto.civis || []).find(c => c.status === 'Aprovado')
    || { id: 'civil-teste', nome: 'Sigurd Pedra-Alta', id_jogo: 'SKY-9100',
         raca: 'Nórdico', status: 'Aprovado', profissao: 'Ferreiro', nivel: 'Mestre' };
  if (!(bruto.civis || []).some(c => c.id === civil.id)) {
    bruto.civis = [civil, ...(bruto.civis || [])];
  }
  bruto.clas = [{
    id: 'casa-teste', nome: 'Pedra-Alta', cor: '#7c6bb0',
    lider: civil.nome, lider_civil_id: civil.id, titulo_lider: 'Patriarca',
    lider_titulo: 'Lorde', membros: [], servos: [], notas: '',
  }, ...(bruto.clas || [])];
  bruto.assentamentos = (bruto.assentamentos || []).map((a, i) => (i === 0
    ? { ...a, lorde: civil.nome, lorde_civil_id: civil.id }
    : a));
  bruto.prisoes = [{
    id: 'pena-velha', preso: civil.nome, civil_id: civil.id, hold: 'Riften',
    crime: 'Furto', status: 'Cumprida', criado_em: new Date().toISOString(),
  }, ...(bruto.prisoes || [])];
  localStorage.setItem('riften-hold:v1', JSON.stringify(bruto));
  return { nome: civil.nome, vila: bruto.assentamentos[0].nome };
});
await aoPortal();
await entrarCorte();
await p.click('.nav-item:has-text("Registro Civil")');
await p.waitForTimeout(700);
await p.locator(`tr:has-text("${NOBRE.nome}") .link-perfil`).first().click();
await p.waitForTimeout(700);
const modal = p.locator('.modal');
const selos = await modal.locator('.perfil-papeis .selo, .perfil-topo .selo').allInnerTexts();
const txtSelos = selos.join(' | ');
ok(new RegExp(`Lorde de ${NOBRE.vila}`, 'i').test(txtSelos),
   `esperava o selo "Lorde de ${NOBRE.vila}": ${txtSelos}`);
ok(!selos.some(s => /^\s*Lorde\s*$/i.test(s)), `"Lorde" solto não devia sobrar: ${txtSelos}`);
ok(!selos.some(s => /Lorde nomeado/i.test(s)), `"Lorde nomeado" não devia sobrar: ${txtSelos}`);
ok(!selos.some(s => /Ficha criminal/i.test(s)), `o selo de Ficha criminal foi removido: ${txtSelos}`);
await shot('A5-perfil-lorde');

await b.close();
console.log(erros.length
  ? 'PROBLEMAS:\n' + erros.join('\n')
  : 'Tudo certo — Crônica paginada, brasão transparente e selo único de Lorde do vilarejo.');
