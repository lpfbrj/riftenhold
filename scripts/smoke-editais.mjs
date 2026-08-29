/**
 * EDITAIS E CONTRATOS
 *
 * O caminho inteiro: o Quartel abre um edital de fornecimento, a cidade
 * se inscreve (e quem não pode é barrado com explicação), a proposta
 * escolhida vira contrato e o contrato se encerra cumprido. Depois, um
 * comércio abrindo edital só para trabalhadores e o Quartel recrutando
 * por habilidade de combate.
 */
import pw from '/home/claude/.npm-global/lib/node_modules/playwright/index.js';
const { chromium } = pw;
const erros = [];
const ok = (c, m) => { if (!c) erros.push('[falha] ' + m); };
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1440, height: 1200 } });
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
const entrarPorta = async (porta, id, senha) => {
  await aoPortal();
  await p.click(`.portal-card:has(.portal-nome:text-is("${porta}"))`);
  await p.waitForTimeout(300);
  await p.fill('.login-caixa input >> nth=0', id);
  await p.fill('.login-caixa input[type=password]', senha);
  await p.click('.login-caixa form button.primario');
  await p.waitForSelector('.sidebar', { timeout: 8000 });
  await p.waitForTimeout(700);
};
const irPara = async (nome) => {
  await p.click(`.nav-item:has-text("${nome}")`);
  await p.waitForTimeout(700);
};

const FERREIRO = 'Brynjar Malho-Firme';   // trabalhador Mestre, sem comércio
const MINERADORA = 'Sigrid Pá-Torta';     // funcionária do comércio
const DONO = 'Torvald Cofre-Cheio';       // dono do comércio, sem profissão
const SARGENTO = 'Hakon Escudo-Longo';    // soldado: abre os editais do Quartel
const SENHA = 'RFT-KKKK-234';

await p.goto('http://localhost:4173', { waitUntil: 'networkidle' });

/* ---- o elenco, posto direto no armazém local ----
   O caminho do registro civil e do alistamento já é coberto por
   smoke-acesso; aqui o que se testa é o que vem depois deles. */
await p.evaluate(([FERREIRO, MINERADORA, DONO, SARGENTO, SENHA]) => {
  const s = JSON.parse(localStorage.getItem('riften-hold:v1') || '{}');
  const civil = (nome, id_jogo, profissao, nivel) => ({
    id: `civil-${id_jogo}`, nome, id_jogo, raca: 'Nórdico', profissao, nivel,
    status: 'Aprovado', senha_acesso: SENHA, notas: '',
  });
  s.civis = [
    civil(FERREIRO, 'SKY-8001', 'Ferreiro-Armamentista', 'Mestre'),
    civil(MINERADORA, 'SKY-8002', 'Minerador', 'Adepto'),
    civil(DONO, 'SKY-8003', '', 'N/A'),
    civil(SARGENTO, 'SKY-8004', '', 'N/A'),
    ...(s.civis || []),
  ];
  s.guardas = [{
    id: 'guarda-sargento', nome: SARGENTO, civil_id: 'civil-SKY-8004', id_jogo: 'SKY-8004',
    raca: 'Nórdico', patente: 'Capitão', afiliacao: 'Guarda da Cidade',
    divisao: 'Exercito de Riften', status: 'Operante', pericias: {}, notas: '',
  }, ...(s.guardas || [])];
  s.propriedades = [{
    id: 'prop-forja', nome: 'Forja do Cofre', tipo: 'Oficina', local: 'Riften',
    status: 'Operante', proprietario: DONO, proprietario_civil_id: 'civil-SKY-8003',
    funcionarios: [{ nome: MINERADORA, civil_id: 'civil-SKY-8002', id_jogo: 'SKY-8002',
      profissao: 'Minerador', nivel: 'Adepto', funcao: 'Extração' }],
    estoque: [], catalogacao: '',
  }, ...(s.propriedades || [])];
  s.editais = []; s.propostas = []; s.avisos = [];
  localStorage.setItem('riften-hold:v1', JSON.stringify(s));
}, [FERREIRO, MINERADORA, DONO, SARGENTO, SENHA]);

/* ============================================================
   1. O Quartel abre o edital dos 100 lingotes de ébano
   ============================================================ */
await entrarPorta('Quartel General', 'SKY-8004', SENHA);
const menu = await p.locator('.nav-item').allInnerTexts();
ok(menu.length === 5, `o soldado devia ver 5 telas, vê ${menu.length}: ${menu.join(', ')}`);
ok(menu.some(t => /Editais e Contratos/i.test(t)), 'falta "Editais e Contratos" no Quartel');

await irPara('Editais e Contratos');
await p.click('.pg-head .btn.primario');
await p.waitForTimeout(500);
ok((await p.locator('.modal .ed-tipo').count()) === 3, 'o formulário devia oferecer os três tipos');
ok(/Abrir edital EDT-001/i.test(await p.locator('.modal-h').innerText()),
   'o primeiro edital devia ser o EDT-001');
await p.fill('.modal .grade.g2 input >> nth=0', 'Fornecimento de lingotes de ébano');
ok((await p.locator('.modal .grade.g2 input.travado').inputValue()) === 'Quartel General',
   'o edital do soldado devia sair em nome do Quartel General');
await p.fill('.modal textarea', 'Para a forja da Guarda. Entregar no almoxarifado do Quartel.');
await p.fill('.modal .ed-bloco .lista-membros input >> nth=0', 'Lingote de Ébano');
await p.fill('.modal .ed-bloco .lista-membros input[type=number] >> nth=0', '100');
// teto e prazo
await p.fill('.modal .grade.g3 input[type=number] >> nth=0', '4000');
await p.selectOption('.modal .grade.g3 select >> nth=0', 'Em até 7 dias');
// só quem for Minerador ou Ferreiro-Armamentista, do nível Adepto para cima
await p.click('.modal .chip-op:text-is("Minerador")');
await p.click('.modal .chip-op:text-is("Ferreiro-Armamentista")');
await p.selectOption('.modal .ed-bloco .grade.g2 select', 'Adepto');
await shot('E1-form-edital');
await p.click('.modal-f .btn.primario');
await p.waitForTimeout(1100);

const praca = p.locator('.painel:has(.painel-h h3:text-is("Editais abertos"))');
const cartao = praca.locator('.edital-card').first();
const txtCartao = await cartao.innerText();
ok(/EDT-001/.test(txtCartao), `o cartão devia trazer o número: ${txtCartao}`);
ok(/100× Lingote de Ébano/.test(txtCartao), 'o cartão devia resumir o objeto do edital');
ok(/QUARTEL GENERAL/i.test(txtCartao), 'o cartão devia dizer o órgão');
ok(/Trabalhadores/i.test(txtCartao) && /Comércios/i.test(txtCartao),
   'o edital devia aceitar as duas modalidades');
ok(/Adepto\+/.test(txtCartao), 'o cartão devia mostrar o nível mínimo');
await shot('E2-praca');

/* ============================================================
   2. O chamado chega ao Quadro de Avisos de todo o Hold
   ============================================================ */
await irPara('Quadro de Avisos');
const mural = await p.locator('.main').innerText();
ok(/EDT-001/.test(mural), 'o edital devia ser anunciado no Quadro de Avisos');
ok(/Lingote de Ébano/i.test(mural), 'o anúncio devia dizer o que se pede');
ok(/4\.000 Septims/.test(mural), 'o anúncio devia trazer o teto');

/* ============================================================
   3. O ferreiro Mestre concorre como trabalhador
   ============================================================ */
await entrarPorta('Cidade de Riften', 'SKY-8001', SENHA);
const menuMorador = await p.locator('.nav-item').allInnerTexts();
ok(menuMorador.some(t => /Editais e Contratos/i.test(t)), 'falta "Editais e Contratos" na Cidade');
await irPara('Editais e Contratos');
ok(/Você pode concorrer/i.test(await p.locator('.edital-card').first().innerText()),
   'o ferreiro Mestre devia poder concorrer');
await p.click('.edital-card');
await p.waitForTimeout(600);

const ficha = p.locator('.modal');
ok(/100× Lingote de Ébano/.test(await ficha.innerText()), 'a ficha devia listar o que se pede');
const vias = await ficha.locator('.ed-via').allInnerTexts();
ok(vias.length === 1 && /trabalhador/i.test(vias[0]),
   `o ferreiro só tem a via de trabalhador: ${vias.join(' | ')}`);
ok(/Ferreiro-Armamentista/.test(vias[0]), 'a via devia dizer a profissão dele');

// o prazo oferecido não pode passar do teto do edital
const prazos = await ficha.locator('.campo:has(span:text-is("Prazo que você promete")) select')
  .locator('option').allInnerTexts();
ok(!prazos.some(t => /1 mês/.test(t)),
   `o edital aceita no máximo 7 dias, mas o prazo oferecia: ${prazos.join(', ')}`);

await ficha.locator('input[type=number]').first().fill('3800');
await ficha.locator('textarea').fill('Tenho veio próprio e forja pronta.');
await shot('E3-proposta');
await ficha.locator('.painel .btn.primario:has-text("Enviar proposta")').click();
await p.waitForTimeout(1200);
ok((await p.locator('.aviso-ok').count()) === 1, 'não confirmou o envio da proposta');
const minhas = await p.locator('.painel:has(.painel-h h3:text-is("Minhas propostas"))').innerText();
ok(/3\.800 Septims/.test(minhas), `a proposta devia aparecer em Minhas propostas: ${minhas.slice(0, 300)}`);
ok(/Enviada/.test(minhas), 'a proposta devia constar como Enviada');

/* ============================================================
   4. As regras barram quem não se encaixa
   ============================================================ */
// O dono não tem profissão — mas tem comércio, e o comércio tem Minerador Adepto.
await entrarPorta('Cidade de Riften', 'SKY-8003', SENHA);
await irPara('Editais e Contratos');
await p.click('.edital-card');
await p.waitForTimeout(600);
const viasDono = await p.locator('.modal .ed-via').allInnerTexts();
ok(viasDono.length === 2, `o dono devia ver duas vias, viu ${viasDono.length}: ${viasDono.join(' | ')}`);
const viaTrab = viasDono.find(t => /trabalhador/i.test(t)) || '';
ok(/profissão no Registro Civil/i.test(viaTrab),
   `sem profissão, a via de trabalhador tem de explicar o motivo: ${viaTrab}`);
ok((await p.locator('.modal .ed-via.bloqueada').count()) === 1,
   'a via sem profissão devia estar bloqueada');
ok(/Forja do Cofre/.test(viasDono.join(' ')), 'a via do comércio dele devia aparecer');
await shot('E4-vias-dono');

// pela Forja, com a equipe qualificada, ele concorre
await p.locator('.modal .ed-via:not(.bloqueada) input').check();
await p.locator('.modal input[type=number]').first().fill('3500');
await p.locator('.modal .painel .btn.primario:has-text("Enviar proposta")').click();
await p.waitForTimeout(1200);
ok(/Forja do Cofre/.test(await p.locator('.painel:has(.painel-h h3:text-is("Minhas propostas"))').innerText()),
   'a proposta do comércio não foi registrada');

/* ============================================================
   5. O Quartel escolhe: vira contrato, a outra proposta cai
   ============================================================ */
await entrarPorta('Quartel General', 'SKY-8004', SENHA);
await irPara('Editais e Contratos');
await p.click('.edital-card');
await p.waitForTimeout(600);
const recebidas = p.locator('.modal .painel:has(.painel-h h3:has-text("Propostas recebidas"))');
ok((await recebidas.locator('tbody tr').count()) === 2, 'o edital devia ter as duas propostas');
const primeiraLinha = await recebidas.locator('tbody tr').first().innerText();
ok(/3\.500/.test(primeiraLinha), 'a proposta mais barata devia vir primeiro');

await recebidas.locator(`tr:has-text("${FERREIRO}") button:has-text("Contratar")`).click();
await p.waitForTimeout(1500);
ok(/Contratado com/i.test(await p.locator('.modal .ed-contrato').innerText()),
   'a ficha devia mostrar o contrato firmado');
await shot('E5-contratado');
await p.click('.modal-h .x');
await p.waitForTimeout(500);

const contratos = p.locator('.painel:has(.painel-h h3:text-is("Contratos do Hold"))');
const txtContrato = await contratos.innerText();
ok(new RegExp(FERREIRO).test(txtContrato), 'o contrato devia nomear o contratado');
ok(/3\.800 Septims/.test(txtContrato), 'o contrato devia trazer o valor combinado');
ok(/Contratado/.test(txtContrato), 'a situação devia ser Contratado');
ok((await p.locator('.painel:has(.painel-h h3:text-is("Editais abertos")) .edital-card').count()) === 0,
   'o edital contratado devia sair da praça');

/* ============================================================
   6. Os dois lados são avisados
   ============================================================ */
await entrarPorta('Cidade de Riften', 'SKY-8001', SENHA);
await irPara('Quadro de Avisos');
ok(/Contrato firmado/i.test(await p.locator('.main').innerText()),
   'o vencedor devia receber o recado do contrato');
await entrarPorta('Cidade de Riften', 'SKY-8003', SENHA);
await irPara('Quadro de Avisos');
ok(/encerrado/i.test(await p.locator('.main').innerText()),
   'quem perdeu devia ser avisado do encerramento');
ok(/Recusada/.test(await (await irPara('Editais e Contratos'), p.locator('.painel:has(.painel-h h3:text-is("Minhas propostas"))').innerText())),
   'a proposta perdedora devia constar como Recusada');

/* ============================================================
   7. O contrato é dado por cumprido
   ============================================================ */
await entrarPorta('Quartel General', 'SKY-8004', SENHA);
await irPara('Editais e Contratos');
await p.locator('.painel:has(.painel-h h3:text-is("Contratos do Hold")) button:has-text("Cumprido")').click();
await p.waitForTimeout(1300);
ok(/Cumprido/.test(await p.locator('.painel:has(.painel-h h3:text-is("Contratos do Hold"))').innerText()),
   'o contrato devia constar como Cumprido');
await shot('E6-cumprido');

/* ============================================================
   8. Um comércio abre edital — e só para trabalhadores
   ============================================================ */
await entrarPorta('Cidade de Riften', 'SKY-8003', SENHA);
await irPara('Editais e Contratos');
await p.click('.pg-head .btn.primario');
await p.waitForTimeout(500);
ok(/comércio chama trabalhadores/i.test(await p.locator('.modal .ed-bloco:has(h4:text-is("Quem pode responder"))').innerText()),
   'o edital de um comércio devia ser só para trabalhadores');
ok((await p.locator('.modal .ed-modalidade').count()) === 0,
   'o comércio não escolhe modalidade: é sempre trabalhador');
await p.fill('.modal .grade.g2 input >> nth=0', 'Precisa-se de mineradores');
await p.click('.modal .ed-tipo:has-text("Serviço")');
await p.waitForTimeout(300);
await p.fill('.modal .grade.g3 input[type=number] >> nth=1', '900');
await p.click('.modal-f .btn.primario');
await p.waitForTimeout(1200);
const doComercio = await p.locator('.edital-card:has-text("mineradores")').innerText();
ok(/FORJA DO COFRE/i.test(doComercio), `o edital devia sair em nome da casa: ${doComercio}`);
ok(!/Comércios/.test(doComercio), 'o edital de um comércio não aceita outros comércios');
ok(/Você abriu este edital/i.test(doComercio), 'quem abriu não concorre no próprio edital');
await shot('E7-edital-comercio');

/* ============================================================
   9. Recrutamento: o Quartel exige habilidade de combate
   ============================================================ */
await entrarPorta('Quartel General', 'SKY-8004', SENHA);
await irPara('Editais e Contratos');
await p.click('.pg-head .btn.primario');
await p.waitForTimeout(500);
await p.click('.modal .ed-tipo:has-text("Recrutamento")');
await p.waitForTimeout(300);
await p.fill('.modal .grade.g2 input >> nth=0', 'Alistamento da Guarda da Cidade');
ok((await p.locator('.modal .ed-grupo').count()) === 4,
   'o recrutamento devia oferecer os quatro grupos de perícia');
ok(/só trabalhadores/i.test(await p.locator('.modal .ed-bloco:has(h4:text-is("Quem pode responder"))').innerText()),
   'recrutamento é chamado por gente, não por comércio');
// Arqueiro Adepto
await p.locator('.modal .ed-pericia-campo:has-text("Arqueiro") select').selectOption('Adepto');
await p.click('.modal-f .btn.primario');
await p.waitForTimeout(1200);
const recrut = await p.locator('.edital-card:has-text("Alistamento")').innerText();
ok(/perícia/i.test(recrut), `o cartão devia avisar da exigência de perícia: ${recrut}`);
await shot('E8-recrutamento');

// sem habilidade registrada, o cartão já explica o que falta
await entrarPorta('Cidade de Riften', 'SKY-8001', SENHA);
await irPara('Editais e Contratos');
const semHabilidade = await p.locator('.edital-card:has-text("Alistamento")').innerText();
ok(/não registrou habilidades/i.test(semHabilidade),
   `o cartão devia mandar preencher as habilidades: ${semHabilidade}`);
await p.click('.edital-card:has-text("Alistamento")');
await p.waitForTimeout(600);
ok((await p.locator('.modal input[type=number]').count()) === 0, 'recrutamento não pede preço');
ok((await p.locator('.modal .btn.primario:has-text("Enviar proposta")').count()) === 0,
   'sem habilidade não há como enviar proposta');
await shot('E9-barrado');
await p.click('.modal-h .x');
await p.waitForTimeout(300);

// ele preenche as habilidades na própria ficha
await irPara('Minha ficha');
const quadro = p.locator('.painel:has(.painel-h h3:text-is("Minhas habilidades"))');
ok((await quadro.count()) === 1, 'falta o quadro de habilidades na ficha do morador');
ok(/Nenhuma habilidade registrada/i.test(await quadro.innerText()), 'o quadro devia começar vazio');
await quadro.locator('.btn:has-text("Preencher")').click();
await p.waitForTimeout(400);
ok((await quadro.locator('.grupo-pericia').count()) === 4,
   'a ficha devia oferecer os quatro grupos de perícia');
await quadro.locator('.pericia-linha:has(.nm:text-is("Arqueiro")) select').selectOption('Especialista');
await quadro.locator('.pericia-linha:has(.nm:text-is("Curandeiro")) select').selectOption('Adepto');
await shot('E10-habilidades');
await quadro.locator('.btn.primario:has-text("Salvar habilidades")').click();
await p.waitForTimeout(1200);
const salvas = await quadro.innerText();
ok(/2 registradas/i.test(salvas), `o quadro devia contar as duas habilidades: ${salvas.slice(0, 200)}`);
ok(/Arqueiro/.test(salvas) && /Curandeiro/.test(salvas), 'as habilidades salvas deviam aparecer');

// e agora a inscrição no recrutamento vale sozinha
await irPara('Editais e Contratos');
ok(/Você pode concorrer/i.test(await p.locator('.edital-card:has-text("Alistamento")').innerText()),
   'com a habilidade registrada, ele devia poder concorrer');
await p.click('.edital-card:has-text("Alistamento")');
await p.waitForTimeout(600);
const alist = p.locator('.modal');
ok(/registrou em Minha ficha/i.test(await alist.innerText()),
   'a ficha do edital devia dizer que as habilidades vêm da ficha dele');
ok((await alist.locator('.ed-pericia.atende').count()) === 1,
   'a habilidade exigida devia aparecer marcada como atendida');
await alist.locator('.painel .btn.primario:has-text("Enviar proposta")').click();
await p.waitForTimeout(1300);
ok((await p.locator('.aviso-ok').count()) === 1, 'a inscrição no alistamento devia ser aceita');

// num edital que não exige habilidade, anexar é opcional
await p.click('.modal-h .x').catch(() => {});
await p.waitForTimeout(300);
await entrarPorta('Cidade de Riften', 'SKY-8001', SENHA);
await irPara('Editais e Contratos');
await p.click('.edital-card:has-text("mineradores")');
await p.waitForTimeout(600);
const servico = p.locator('.modal');
ok((await servico.locator('.ed-anexo').count()) === 1,
   'num serviço, anexar as habilidades devia ser oferecido como opção');
ok(!(await servico.locator('.ed-anexo input').isChecked()), 'anexar não pode vir marcado');
await servico.locator('.ed-anexo input').check();
await servico.locator('input[type=number]').first().fill('700');
await servico.locator('.painel .btn.primario:has-text("Enviar proposta")').click();
await p.waitForTimeout(1300);
await shot('E11-anexo');

await entrarPorta('Cidade de Riften', 'SKY-8003', SENHA);
await irPara('Editais e Contratos');
await p.click('.edital-card:has-text("mineradores")');
await p.waitForTimeout(600);
const comAnexo = await p.locator('.modal .painel:has(.painel-h h3:has-text("Propostas recebidas"))').innerText();
ok(/Arqueiro/.test(comAnexo), `as habilidades anexadas deviam chegar ao dono: ${comAnexo.slice(0, 300)}`);
await p.click('.modal-h .x');
await p.waitForTimeout(300);

await entrarPorta('Quartel General', 'SKY-8004', SENHA);
await irPara('Editais e Contratos');
await p.click('.edital-card:has-text("Alistamento")');
await p.waitForTimeout(600);
const inscritos = await p.locator('.modal .painel:has(.painel-h h3:has-text("Propostas recebidas"))').innerText();
ok(new RegExp(FERREIRO).test(inscritos), 'o candidato devia aparecer para o Quartel');
ok(/declaradas pelo candidato/i.test(inscritos),
   'o Quartel precisa saber que as perícias foram declaradas, não aferidas');
ok(/Arqueiro/.test(inscritos), 'a habilidade exigida devia constar na proposta');
await shot('E12-inscritos');

/* ============================================================
   10. A Corte enxerga tudo e guarda o registro
   ============================================================ */
await entrarCorte();
await irPara('Editais e Contratos');
const naCorte = await p.locator('.main').innerText();
ok(/EDT-001/.test(naCorte), 'a Corte devia enxergar o edital do Quartel');
ok(/Cumprido/.test(naCorte), 'a Corte devia ver o contrato cumprido no registro');
ok(/Alistamento/.test(naCorte), 'a Corte devia ver o recrutamento aberto');
ok(/mineradores/i.test(naCorte), 'a Corte devia ver o edital do comércio');
// O edital é de outro órgão: a Corte acompanha, mas não julga por ele.
await p.click('.edital-card:has-text("Alistamento")');
await p.waitForTimeout(600);
ok(/quem julga as propostas é quem o abriu/i.test(await p.locator('.modal').innerText()),
   'a Corte não julga proposta de edital alheio');
ok((await p.locator('.modal .btn.perigo:has-text("Encerrar pela Corte")').count()) === 1,
   'a Corte devia poder encerrar qualquer edital do Hold');
await shot('E13-corte');
await p.click('.modal-h .x');
await p.waitForTimeout(300);

await b.close();
console.log(erros.length
  ? 'PROBLEMAS:\n' + erros.join('\n')
  : 'Tudo certo — edital publicado, propostas filtradas pelas regras, contrato firmado e cumprido.');
