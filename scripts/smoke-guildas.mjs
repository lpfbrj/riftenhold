/**
 * CLÃS DO HOLD
 *
 *  1. O morador registra um clã: tipo, história e função no RP.
 *  2. A Corte lê os dois textos e reconhece — ou recusa.
 *  3. Reconhecido, quem registrou é o líder: chama membros e
 *     vincula uma propriedade sua como sede.
 *  4. A Corte emite uma licença em nome do clã, e ela vale para
 *     todos os membros — sem cada um tirar a sua.
 */
import pw from '/home/claude/.npm-global/lib/node_modules/playwright/index.js';
const { chromium } = pw;
const erros = [];
const ok = (c, m) => { if (!c) erros.push('[falha] ' + m); };
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1440, height: 1250 } });
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

const LIDER = 'Brynjar Lanterna-Velha';
const MEMBRO = 'Astrid Passo-Curto';
const DE_FORA = 'Grelka Mão-Torta';

await p.goto('http://localhost:4173', { waitUntil: 'networkidle' });

/* ============================================================
   Cenário: três moradores; o primeiro com uma propriedade
   ============================================================ */
const senhas = await p.evaluate(([lider, membro, fora]) => {
  const s = JSON.parse(localStorage.getItem('riften-hold:v1') || '{}');
  const uid = () => crypto.randomUUID();
  const civil = (nome, id_jogo, senha) => ({
    id: uid(), nome, id_jogo, senha_acesso: senha, status: 'Aprovado',
    raca: 'Nord', origem: 'natal',
  });
  const c1 = civil(lider, 'CLA-1', 'AAAA-1111');
  const c2 = civil(membro, 'CLA-2', 'BBBB-2222');
  const c3 = civil(fora, 'CLA-3', 'CCCC-3333');
  s.civis = [...(s.civis || []).filter((x) => !/^CLA-/.test(x.id_jogo || '')), c1, c2, c3];
  s.guildas = [];
  s.licencas = [];
  s.avisos = [];
  s.propriedades = [
    { id: uid(), nome: 'Casa da Lanterna', tipo: 'Casa', categoria: 'casa', local: 'Riften',
      valor: 15000, proprietario: c1.nome, proprietario_civil_id: c1.id, status: 'Operante' },
  ];
  localStorage.setItem('riften-hold:v1', JSON.stringify(s));
  return { lider: 'AAAA-1111', membro: 'BBBB-2222', fora: 'CCCC-3333' };
}, [LIDER, MEMBRO, DE_FORA]);

/* ============================================================
   1. A aba de Clãs e os quatro tipos
   ============================================================ */
await entrarCidade('CLA-1', senhas.lider);
const menu = await p.locator('.nav-item').allInnerTexts();
ok(menu.some((t) => /Clãs/.test(t)), 'o morador devia ver a aba Clãs');

await irPara('Clãs');
ok(/Clãs de Riften/.test(await p.locator('.pg-head h1').innerText()), 'a tela devia se chamar Clãs de Riften');
const tipos = await p.locator('.tipo-cla h4').allInnerTexts();
ok(tipos.length === 4, `esperava 4 tipos de clã, achei ${tipos.length}`);
for (const nome of ['Sociedade', 'Guilda Comercial', 'Clã de Aventureiros', 'Clã Religioso']) {
  ok(tipos.includes(nome), `falta o tipo "${nome}"`);
}
const propostas = await p.locator('.painel:has-text("Nenhum clã sob sua liderança")').innerText();
ok(/caravanas/i.test(propostas) && /escolta/i.test(propostas) && /Daedra/i.test(propostas),
   'cada tipo devia trazer a sua proposta de roleplay');
await shot('G1-tipos');

/* ============================================================
   2. Registrar o clã
   ============================================================ */
await p.click('.pg-head .btn.primario');
await p.waitForTimeout(500);
await p.click('.origem-op:has-text("Clã de Aventureiros")');
await p.waitForTimeout(300);
await p.fill('.cla-campos input >> nth=0', 'Companhia da Lanterna');
await p.fill('.cla-campos input >> nth=2', 'A luz vai na frente');
await p.fill('.modal textarea >> nth=0',
  'Fundada por batedores que sobreviveram ao inverno na estrada do leste, a Companhia '
  + 'juntou gente que já não tinha para onde voltar.');
ok(await p.locator('.modal-f .btn.primario').isDisabled(),
   'sem a função declarada, o envio devia estar travado');
await p.fill('.modal textarea >> nth=1',
  'Escolta de caravanas e limpeza de covis a pedido dos vilarejos, por contrato e por preço.');
await shot('G2-registro');
await p.click('.modal-f .btn.primario');
await p.waitForTimeout(1400);

const espera = await p.locator('.main').innerText();
ok(/Companhia da Lanterna/.test(espera), 'o clã registrado devia aparecer na tela');
ok(/Pendente/.test(espera), 'o clã devia ficar pendente');
ok(!/Chamar alguém/.test(espera), 'sem reconhecimento, não se administra membro');

/* -- e não aparece no Hold ainda -- */
await entrarCidade('CLA-2', senhas.membro);
await irPara('Clãs');
ok(!/Companhia da Lanterna/.test(await p.locator('.painel:has(.painel-h h3:text-is("Clãs reconhecidos pela Corte"))').innerText()),
   'clã pendente não devia aparecer no diretório');

/* ============================================================
   3. A Corte lê e reconhece
   ============================================================ */
await entrarCorte();
const lateral = await p.locator('.sidebar').innerText();
ok(/Clãs do Hold/.test(lateral), 'a Corte devia ter a tela de Clãs do Hold');
await irPara('Clãs do Hold');
const fila = p.locator('.painel:has(.painel-h h3:text-is("Registros aguardando a Corte"))');
ok((await fila.locator('.pedido-casa').count()) === 1, 'o registro devia estar na fila da Corte');
const cartao = await fila.innerText();
ok(/sobreviveram ao inverno/.test(cartao), 'a Corte devia ler a história declarada');
ok(/Escolta de caravanas/.test(cartao), 'a Corte devia ler a função declarada');
ok(/Clã de Aventureiros/.test(cartao), 'o tipo devia aparecer');
await shot('G3-fila-corte');

await fila.locator('button:has-text("Reconhecer")').click();
await p.waitForTimeout(500);
await p.fill('.modal textarea', 'Reconhecida. A Corte espera relatório das escoltas.');
await p.click('.modal-f .btn.primario');
await p.waitForTimeout(1400);
ok((await fila.locator('.pedido-casa').count()) === 0, 'reconhecido, o registro sai da fila');
const registro = await p.locator('.painel:has(.painel-h h3:text-is("Registro de clãs"))').innerText();
ok(/Companhia da Lanterna/.test(registro) && /Aprovado/.test(registro),
   'o clã devia constar como aprovado no registro');

/* ============================================================
   4. O líder administra: membros e sede
   ============================================================ */
await entrarCidade('CLA-1', senhas.lider);
await irPara('Quadro de Avisos');
ok(/reconhecido/i.test(await p.locator('.main').innerText()), 'o líder devia ser avisado');

await irPara('Clãs');
const meu = p.locator('.painel:has(.painel-h h3:text-is("Clã Companhia da Lanterna"))');
ok(await meu.count() === 1, 'o quadro do clã dele devia abrir');
ok(/Aprovado/.test(await meu.innerText()), 'o clã devia constar aprovado');

await p.click('.painel:has(.painel-h h3:text-is("Membros do clã")) .btn.primario');
await p.waitForTimeout(400);
await p.fill('.lista-membros .seletor-civil input', 'Astrid');
await p.waitForTimeout(500);
await p.click('.lista-membros .seletor-op');
await p.waitForTimeout(300);
await p.selectOption('.lista-membros select', 'Veterano');
await p.selectOption('.painel:has-text("Sede e história") select', { label: 'Casa da Lanterna — Casa' });
await p.waitForTimeout(300);
await p.click('.barra-salvar .btn.primario');
await p.waitForTimeout(1600);
const depois = await p.locator('.main').innerText();
ok(/Casa da Lanterna/.test(depois), 'a sede devia ficar vinculada');
// Membro vinculado ao Registro Civil vira um selo, não um campo.
ok(/Astrid/.test(await p.locator('.painel:has(.painel-h h3:text-is("Membros do clã"))').innerText()),
   'o membro devia ficar salvo');
ok(/Veterano/.test(await p.locator('.painel:has(.painel-h h3:text-is("Membros do clã"))').innerText()),
   'o cargo do membro devia ficar salvo');
await shot('G4-clã-vivo');

/* ============================================================
   5. A licença do clã vale para os membros
   ============================================================ */
await entrarCorte();
await irPara('Emissão de Licenças');
const tiposLic = await p.locator('.barra-filtros select >> nth=0').locator('option').allInnerTexts();
ok(tiposLic.length >= 5, `esperava mais tipos de licença, achei ${tiposLic.length - 1}`);
for (const t of ['Licença de Mineração', 'Licença de Comércio e Caravanas',
                 'Licença de Exploração e Caça', 'Licença de Culto']) {
  ok(tiposLic.includes(t), `falta o tipo de licença "${t}"`);
}

await p.click('.pg-head .btn.primario');
await p.waitForTimeout(500);
ok((await p.locator('.modal .origem-op').count()) === 2,
   'a emissão devia perguntar se o titular é morador ou clã');
await p.click('.modal .origem-op:has-text("Clã")');
await p.waitForTimeout(400);
const opcoesCla = await p.locator('.modal select >> nth=0').locator('option').allInnerTexts();
const daCompanhia = opcoesCla.find((o) => /Companhia da Lanterna/.test(o));
ok(Boolean(daCompanhia), `o clã devia estar entre os titulares: ${opcoesCla.join(' | ')}`);
await p.selectOption('.modal select >> nth=0', { label: daCompanhia });
await p.waitForTimeout(300);
ok(/2 pessoas/.test(await p.locator('.modal .ajuda').first().innerText()),
   'a Corte devia ver para quanta gente a licença vale');
await p.selectOption('.modal .grade.g3 select >> nth=0', 'exploracao');
await p.waitForTimeout(400);
await p.click('.cobertura-op:has-text("Cavernas")');
await p.click('.cobertura-op:has-text("Caça")');
await p.click('.escolta-op');
await shot('G5-licenca-cla');
await p.click('.modal-f .btn.primario');
await p.waitForTimeout(1300);

const cartaoLic = await p.locator('.licenca-card').innerText();
ok(/Companhia da Lanterna/.test(cartaoLic), 'o cartão devia trazer o clã como titular');
ok(/LIC-EXP-0001/.test(cartaoLic), `a numeração devia usar o prefixo do tipo: ${cartaoLic}`);
ok(/Clã · 2 pessoas/.test(cartaoLic), 'o cartão devia dizer para quantos vale');

/* -- o líder e o membro enxergam a licença; quem está fora, não -- */
for (const [id, senha, quem] of [
  ['CLA-1', senhas.lider, 'o líder'],
  ['CLA-2', senhas.membro, 'o membro'],
]) {
  await entrarCidade(id, senha);
  const ficha = await p.locator('.main').innerText();
  ok(/LIC-EXP-0001/.test(ficha), `${quem} devia ver a licença do clã na ficha`);
  ok(/pelo clã Companhia da Lanterna/.test(ficha),
     `a ficha devia dizer que a licença vem do clã (${quem})`);
  ok(/Licenciado/.test(ficha), `${quem} devia constar como licenciado`);
}
await shot('G6-licenca-na-ficha');

await entrarCidade('CLA-3', senhas.fora);
const deFora = await p.locator('.main').innerText();
ok(!/LIC-EXP-0001/.test(deFora), 'quem não é do clã não devia ver a licença dele');
ok(!/Licenciado/.test(deFora), 'quem não é do clã não é licenciado');

/* -- e o diretório mostra o clã para todo o Hold -- */
await irPara('Clãs');
const diretorio = await p.locator('.painel:has(.painel-h h3:text-is("Clãs reconhecidos pela Corte"))').innerText();
ok(/Companhia da Lanterna/.test(diretorio), 'o clã reconhecido devia entrar no diretório');
ok(/Escolta de caravanas/.test(diretorio), 'a função devia aparecer no cartão do clã');
await p.click('.cla-guilda button:has-text("Ler a história")');
await p.waitForTimeout(500);
const ficha = await p.locator('.modal').innerText();
ok(/sobreviveram ao inverno/.test(ficha), 'a ficha do clã devia trazer a história');
ok(/Astrid/.test(ficha), 'a ficha do clã devia listar os membros');
ok(/LIC-EXP-0001/.test(ficha), 'a ficha do clã devia mostrar a licença dele');
await shot('G7-ficha-cla');
await p.click('.modal-f .btn.primario');
await p.waitForTimeout(300);

/* ============================================================
   6. Não se registra dois clãs, e a recusa pode ser corrigida
   ============================================================ */
await entrarCidade('CLA-1', senhas.lider);
await irPara('Clãs');
ok((await p.locator('.pg-head .btn.primario').count()) === 0,
   'quem já lidera um clã não devia poder registrar outro');

await entrarCidade('CLA-3', senhas.fora);
await irPara('Clãs');
await p.click('.pg-head .btn.primario');
await p.waitForTimeout(500);
await p.click('.origem-op:has-text("Clã Religioso")');
await p.fill('.cla-campos input >> nth=0', 'Vigília de Mara');
await p.fill('.modal textarea >> nth=0', 'Nasceu do abrigo dos peregrinos no templo.');
await p.fill('.modal textarea >> nth=1', 'Casamentos, bênçãos e cuidado dos doentes.');
await p.click('.modal-f .btn.primario');
await p.waitForTimeout(1400);

await entrarCorte();
await irPara('Clãs do Hold');
await p.locator('.pedido-casa:has-text("Vigília de Mara") button:has-text("Recusar")').click();
await p.waitForTimeout(500);
await p.fill('.modal textarea', 'Diga a qual divino o culto se dirige.');
await p.click('.modal-f .btn.perigo');
await p.waitForTimeout(1400);

await entrarCidade('CLA-3', senhas.fora);
await irPara('Clãs');
const recusado = await p.locator('.main').innerText();
ok(/Recusado/.test(recusado), 'o clã recusado devia constar assim');
ok(/qual divino/.test(recusado), 'o parecer da Corte devia aparecer');
ok(/Corrigir e reenviar/.test(recusado), 'devia haver como corrigir e reenviar');
await shot('G8-recusado');

await b.close();
console.log(erros.length
  ? 'PROBLEMAS:\n' + erros.join('\n')
  : 'Tudo certo — clã registrado, reconhecido, com membros, sede e licença valendo para todos.');
