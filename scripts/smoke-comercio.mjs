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
async function cadastrar(nome, id) {
  await aoPortal();
  await p.click('.portal-card:has(.portal-nome:text-is("Cidade de Riften"))');
  await p.waitForTimeout(350);
  await p.click('.login-alternativa .btn');
  await p.waitForTimeout(400);
  await p.fill('.registro-caixa input >> nth=0', nome);
  await p.fill('.registro-caixa input >> nth=1', id);
  await p.selectOption('.registro-caixa select >> nth=0', { index: 1 });
  await p.click('.registro-caixa form button.primario');
  await p.waitForTimeout(800);
  await aoPortal();
  await entrarCorte();
  await p.click('.nav-item:has-text("Registro Civil")');
  await p.waitForTimeout(600);
  await p.locator(`.civil-pedido:has-text("${nome}") button:has-text("Aprovar")`).click();
  await p.waitForTimeout(800);
  const senha = (await p.locator('.cred-val.grande').innerText()).trim();
  await p.click('.modal-f .btn.primario');
  await p.waitForTimeout(400);
  return senha;
}

await p.goto('http://localhost:4173', { waitUntil: 'networkidle' });

const DONO = 'Brynjar Mão-de-Ferro';
const ID_DONO = 'SKY-9001';
const FUNC = 'Alva, a Balconista';
const ID_FUNC = 'SKY-9002';
const FREGUES = 'Kjeld Andarilho';
const ID_FREG = 'SKY-9003';

const senhaDono = await cadastrar(DONO, ID_DONO);
const senhaFunc = await cadastrar(FUNC, ID_FUNC);
const senhaFreg = await cadastrar(FREGUES, ID_FREG);

// -------- 1. A Corte dá uma propriedade ao dono --------
await p.click('.nav-item:has-text("Imobiliária")');
await p.waitForTimeout(700);
await p.click('.prop-card:has-text("Scorched Hammer") button:has-text("Abrir ficha")');
await p.waitForTimeout(500);
await p.fill('.seletor-civil input', 'Brynjar');
await p.waitForTimeout(500);
await p.click('.seletor-op');
await p.waitForTimeout(300);
await p.click('.modal-f .btn.primario');
await p.waitForTimeout(900);

// -------- 2. Quem não tem propriedade não vê o menu --------
await entrarCidade(ID_FREG, senhaFreg);
let menu = await p.locator('.nav-item').allInnerTexts();
ok(!menu.some(t => /Propriedades/.test(t)), 'quem não tem propriedade não devia ver o menu');
ok(menu.some(t => /Comércios/.test(t)), 'todo morador devia ver a aba Comércios');

// -------- 3. O dono vê o menu Propriedades --------
await entrarCidade(ID_DONO, senhaDono);
menu = await p.locator('.nav-item').allInnerTexts();
ok(menu.some(t => /Propriedades/.test(t)), 'falta o menu Propriedades para o dono');
// ordem: Minha ficha, Propriedades, Comércios, Quadro de Avisos
ok(menu[0].includes('Minha ficha') && menu[1].includes('Propriedades'),
   `ordem do menu errada: ${menu.join(' / ')}`);
await p.click('.nav-item:has-text("Propriedades")');
await p.waitForTimeout(700);
const admin = await p.locator('.main').innerText();
ok(/Scorched Hammer/.test(admin), 'a tela não nomeia a propriedade');
ok(/Você é o dono/.test(admin), 'devia marcar que ele é o dono');
ok(/Estoque e lista de preços/i.test(admin), 'falta o bloco de estoque');
ok(/Funcionários/i.test(admin), 'falta o bloco de funcionários');
ok(/Pedidos dos moradores/i.test(admin), 'falta o bloco de pedidos');
await shot('P1-admin');

// -------- 4. Ele contrata a balconista --------
await p.click('.painel:has(.painel-h h3:text-is("Funcionários")) .btn.primario');
await p.waitForTimeout(300);
await p.fill('.lista-membros .seletor-civil input', 'Alva');
await p.waitForTimeout(400);
await p.click('.lista-membros .seletor-op');
await p.waitForTimeout(300);
await p.selectOption('.lista-membros select >> nth=0', 'Ferreiro-Armamentista').catch(() => {});
await p.selectOption('.lista-membros select >> nth=1', 'Aprendiz');
await p.fill('.lista-membros .servo-funcao', 'Balconista e caixa');
await p.waitForTimeout(200);

// -------- 5. E cadastra o estoque --------
await p.click('.painel:has(.painel-h h3:text-is("Estoque e lista de preços")) .btn.primario');
await p.waitForTimeout(300);
await p.fill('.cel-input.nome >> nth=0', 'Espada de Aço');
await p.fill('.painel:has(.painel-h h3:text-is("Estoque e lista de preços")) input[type=number] >> nth=0', '4');
await p.fill('.painel:has(.painel-h h3:text-is("Estoque e lista de preços")) input[type=number] >> nth=1', '120');
await p.click('.painel:has(.painel-h h3:text-is("Estoque e lista de preços")) .btn.primario');
await p.waitForTimeout(300);
await p.fill('.cel-input.nome >> nth=1', 'Escudo de Ferro');
await p.fill('.painel:has(.painel-h h3:text-is("Estoque e lista de preços")) input[type=number] >> nth=2', '2');
await p.fill('.painel:has(.painel-h h3:text-is("Estoque e lista de preços")) input[type=number] >> nth=3', '60');
await p.waitForTimeout(200);
await shot('P2-estoque');
await p.click('.barra-salvar .btn.primario');
await p.waitForTimeout(1100);
ok((await p.locator('.aviso-ok').count()) === 1, 'não confirmou o salvamento');
const salvo = await p.locator('.main').innerText();
ok(/600 Septims/.test(salvo), `o valor do estoque devia ser 600: ${salvo.slice(0, 400)}`);

// -------- 6. O funcionário também administra --------
await entrarCidade(ID_FUNC, senhaFunc);
menu = await p.locator('.nav-item').allInnerTexts();
ok(menu.some(t => /Propriedades/.test(t)), 'o funcionário também devia ver Propriedades');
await p.click('.nav-item:has-text("Propriedades")');
await p.waitForTimeout(700);
const visaoFunc = await p.locator('.main').innerText();
ok(/Funcionário/.test(visaoFunc), 'devia marcar que ela é funcionária');
ok(/só o dono contrata/i.test(visaoFunc), 'a funcionária não devia poder contratar');
ok((await p.locator('.cel-input.nome').count()) === 2, 'a funcionária devia poder mexer no estoque');

// -------- 7. O freguês vê a vitrine e faz o pedido --------
await entrarCidade(ID_FREG, senhaFreg);
await p.click('.nav-item:has-text("Comércios")');
await p.waitForTimeout(700);
const vitrine = await p.locator('.main').innerText();
ok(/Scorched Hammer/.test(vitrine), 'o comércio não apareceu na vitrine');
ok(/Brynjar/.test(vitrine), 'a vitrine não mostra o dono');
ok(/Alva/.test(vitrine), 'a vitrine não mostra quem atende');
ok(/Balconista e caixa/.test(vitrine), 'a vitrine não mostra a função do funcionário');
ok(/Espada de Aço/.test(vitrine) && /120 Septims/.test(vitrine), 'faltam os itens à venda');
ok(/4 em estoque/.test(vitrine), 'a vitrine não mostra a quantidade');
await shot('P3-vitrine');

await p.click('.loja-card:has-text("Scorched Hammer") button:has-text("Solicitar pedido")');
await p.waitForTimeout(500);
// o limite é o estoque
await p.fill('.modal input[type=number] >> nth=0', '99');
await p.waitForTimeout(300);
ok(await p.locator('.modal input[type=number]').first().inputValue() === '4',
   'a quantidade devia travar no que há em estoque');
await p.fill('.modal input[type=number] >> nth=0', '2');
await p.fill('.modal textarea', 'Passo lá ao anoitecer.');
await p.waitForTimeout(300);
const resumo = await p.locator('.modal-f').innerText();
ok(/240 Septims/.test(resumo), `o total devia ser 240: ${resumo}`);
await shot('P4-pedido');
await p.click('.modal-f .btn.primario');
await p.waitForTimeout(1100);
const meus = await p.locator('.main').innerText();
ok(/Meus pedidos/i.test(meus), 'falta o quadro Meus pedidos');
ok(/Aberto/.test(meus), 'o pedido devia ficar aberto');

// -------- 8. O ticket chega ao dono --------
await entrarCidade(ID_DONO, senhaDono);
await p.click('.nav-item:has-text("Propriedades")');
await p.waitForTimeout(700);
const fila = p.locator('.painel:has(.painel-h h3:text-is("Pedidos dos moradores"))');
const ticket = await fila.innerText();
ok(ticket.includes(FREGUES), 'o pedido não chegou ao dono');
ok(/2×\s*Espada de Aço/.test(ticket), 'o item pedido não aparece');
ok(/240 Septims/.test(ticket), 'o total do pedido não aparece');
ok(/Passo lá ao anoitecer/.test(ticket), 'o recado do freguês não aparece');
await fila.scrollIntoViewIfNeeded();
await p.waitForTimeout(300);
await shot('P5-ticket');

// -------- 9. Aceitar avisa o freguês, mas NÃO baixa o estoque --------
const qtdEstoque = () => p.locator('.painel:has(.painel-h h3:text-is("Estoque e lista de preços")) input[type=number]').first().inputValue();
await fila.locator('tr.linha-pendente button:has-text("Aceitar")').click();
await p.waitForTimeout(1300);
ok((await fila.locator('tr.linha-pendente').count()) === 0, 'o ticket devia sair da fila de abertos');
ok(/Aceito/.test(await fila.innerText()), 'o pedido devia constar como Aceito');
ok((await qtdEstoque()) === '4', `aceitar não pode baixar o estoque; veio "${await qtdEstoque()}"`);
const lucroAntes = p.locator('.painel:has(.painel-h h3:text-is("Lucro da casa"))');
ok(/0 Septims/.test(await lucroAntes.innerText()), 'pedido só aceito não pode virar lucro');
await shot('P6-aceito');

// -------- 10. O recado chega ao Quadro de Avisos do freguês --------
await entrarCidade(ID_FREG, senhaFreg);
await p.click('.nav-item:has-text("Quadro de Avisos")');
await p.waitForTimeout(700);
const recado = await p.locator('.main').innerText();
ok(/Para você/i.test(recado), 'faltou a seção de recados pessoais');
ok(/pedido em The Scorched Hammer foi aceito/i.test(recado), 'faltou o recado da aceitação');
ok(new RegExp(`Procure ${DONO}`).test(recado), 'o recado devia dizer quem procurar');
ok(/em Riften/.test(recado), 'o recado devia dizer onde fica');
ok(/2× Espada de Aço/.test(recado), 'o recado devia listar os itens');
await shot('P7-recado');

// -------- 11. Enquanto não conclui, a vitrine mantém as 4 peças --------
await p.click('.nav-item:has-text("Comércios")');
await p.waitForTimeout(700);
ok(/4 em estoque/.test(await p.locator('.loja-card:has-text("Scorched Hammer")').innerText()),
   'antes de concluir, a vitrine devia manter as 4 peças');
const meusDepois = await p.locator('.painel:has(.painel-h h3:text-is("Meus pedidos"))').innerText();
ok(/Aceito/.test(meusDepois), 'o freguês devia ver o pedido aceito');
ok(new RegExp(`procure ${DONO}`, 'i').test(meusDepois), 'devia dizer quem procurar');

// -------- 12. Concluir: agora sim o estoque baixa e o lucro entra --------
await entrarCidade(ID_DONO, senhaDono);
await p.click('.nav-item:has-text("Propriedades")');
await p.waitForTimeout(700);
const fila2 = p.locator('.painel:has(.painel-h h3:text-is("Pedidos dos moradores"))');
await fila2.locator('button:has-text("Concluir")').click();
await p.waitForTimeout(1400);
ok(/Concluído/.test(await fila2.innerText()), 'o pedido devia constar como Concluído');
ok((await qtdEstoque()) === '2', `depois de concluir o estoque devia cair para 2, veio "${await qtdEstoque()}"`);

const lucro = p.locator('.painel:has(.painel-h h3:text-is("Lucro da casa"))');
const txtLucro = await lucro.innerText();
ok(/240 Septims/.test(txtLucro), `o lucro devia somar 240 Septims: ${txtLucro.slice(0, 300)}`);
ok(new RegExp(FREGUES).test(txtLucro), 'o log de vendas devia citar o comprador');
ok(/2× Espada de Aço/.test(txtLucro), 'o log de vendas devia listar os itens');
await lucro.scrollIntoViewIfNeeded();
await p.waitForTimeout(300);
await shot('P8-lucro');

// -------- 13. O freguês vê a conclusão e a vitrine já baixou --------
await entrarCidade(ID_FREG, senhaFreg);
await p.click('.nav-item:has-text("Quadro de Avisos")');
await p.waitForTimeout(700);
const recado2 = await p.locator('.main').innerText();
ok(/Compra concluída em The Scorched Hammer/i.test(recado2), 'faltou o recado da conclusão');
await p.click('.nav-item:has-text("Comércios")');
await p.waitForTimeout(700);
ok(/2 em estoque/.test(await p.locator('.loja-card:has-text("Scorched Hammer")').innerText()),
   'a vitrine devia mostrar o estoque atualizado');
ok(/Concluído/.test(await p.locator('.painel:has(.painel-h h3:text-is("Meus pedidos"))').innerText()),
   'o freguês devia ver o pedido concluído');

await b.close();
console.log(erros.length
  ? 'PROBLEMAS:\n' + erros.join('\n')
  : 'Tudo certo — propriedade do dono, vitrine da cidade, ticket e recado no Quadro de Avisos.');
