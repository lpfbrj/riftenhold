// ============================================================
//  PERFIL DO CIDADÃO
//
//  Reúne, num objeto só, tudo que os registros do Hold sabem sobre
//  uma pessoa: ofício, patente militar, propriedades, casa nobre,
//  cargo na Corte, senhorio de vilarejo e licenças emitidas.
//
//  O vínculo forte é o `civil_id`. Onde ele não existe (registro
//  antigo, nome digitado à mão), casa-se pelo nome exato.
// ============================================================

import { nobrezaDe, servicoDe } from './nobreza.js';
import { clasDe, licencasDe } from './guildas.js';
import { PLEBEU, TITULO_NOBREZA_TOM } from './constants.js';

const norm = (s) => String(s || '').trim().toLowerCase();

/** Uma ficha pertence a este cidadão? */
function ehDele(ficha, civil, campoId = 'civil_id') {
  if (!ficha || !civil) return false;
  if (ficha[campoId] && ficha[campoId] === civil.id) return true;
  if (ficha[campoId]) return false; // vinculado a outra pessoa
  return norm(ficha.nome) === norm(civil.nome);
}

/**
 * @param {object} civil  registro do Registro Civil
 * @param {object} dados  o estado inteiro vindo do useDados()
 */
export function montarPerfil(civil, dados = {}) {
  if (!civil) return null;
  const {
    trabalhadores = [], guardas = [], propriedades = [],
    clas = [], corte = [], assentamentos = [], licencas = [], prisoes = [],
    guildas = [],
  } = dados;

  const trabalho = trabalhadores.find((t) => ehDele(t, civil)) || null;
  const militar = guardas.find((g) => ehDele(g, civil)) || null;

  const imoveis = propriedades.filter(
    (p) => (p.proprietario_civil_id && p.proprietario_civil_id === civil.id) ||
           (!p.proprietario_civil_id && norm(p.proprietario) === norm(civil.nome) && p.proprietario),
  );

  // Casa nobre: como líder ou como membro. Casa que ainda espera o
  // aval da Corte não conta — quem a fundou só vira nobre no dia em
  // que ela é reconhecida.
  const casas = [];
  for (const c of clas.filter((x) => (x.situacao || 'Aprovada') === 'Aprovada')) {
    const lidera = c.lider_civil_id
      ? c.lider_civil_id === civil.id
      : Boolean(c.lider) && norm(c.lider) === norm(civil.nome);
    const membro = (c.membros || []).find(
      (m) => (m.civil_id && m.civil_id === civil.id) ||
             (!m.civil_id && norm(m.nome) === norm(civil.nome) && m.nome),
    );
    if (lidera || membro) {
      casas.push({
        cla: c,
        lidera: Boolean(lidera),
        // A liderança da casa (Patriarca/Matriarca) e o título na Nobreza
        // são duas coisas diferentes, e cada uma tem sua coluna.
        lideranca: lidera ? (c.titulo_lider || 'Patriarca') : '',
        titulo: lidera ? (c.lider_titulo || 'Nobre') : (membro?.titulo || 'Nobre'),
      });
    }
  }

  // Linha de cargo vago não conta: ela existe só para o quadro do Palácio.
  const cargo = corte.find(
    (c) => c.nome && ((c.civil_id && c.civil_id === civil.id) ||
                      (!c.civil_id && norm(c.nome) === norm(civil.nome))),
  ) || null;

  // Senhorio de vilarejo: prefere o vínculo forte, cai no nome só onde ele falta.
  const senhorioDe = assentamentos.filter((a) => (a.lorde_civil_id
    ? a.lorde_civil_id === civil.id
    : Boolean(a.lorde) && norm(a.lorde) === norm(civil.nome)));

  // As licenças que valem para ele: as emitidas no nome dele e as
  // do clã de que participa — licença de clã cobre todo membro.
  const suasLicencas = licencasDe(civil, licencas, guildas);

  const suasPrisoes = prisoes.filter(
    (x) => (x.civil_id && x.civil_id === civil.id) ||
           (!x.civil_id && norm(x.preso) === norm(civil.nome) && x.preso),
  );

  const nobreza = nobrezaDe(civil, clas);
  const meusClas = clasDe(civil, guildas);
  // Servo de uma casa não é nobre: serve à casa e segue Plebeu.
  const servico = nobreza ? null : servicoDe(civil, clas);

  return {
    civil, trabalho, militar, imoveis, casas, cargo, senhorioDe,
    /** Posição na Nobreza de Riften; `null` quer dizer Plebeu. */
    nobreza,
    /** Serviço prestado a uma casa, para quem não é nobre. */
    servico,
    tituloNobreza: nobreza?.titulo || PLEBEU,
    // Os clãs de que ele participa — associação, não linhagem.
    clas: meusClas,
    prisoes: suasPrisoes,
    licencas: suasLicencas,
    /** Quantos registros do Hold citam esta pessoa. */
    vinculos: (trabalho ? 1 : 0) + (militar ? 1 : 0) + imoveis.length +
              casas.length + (cargo ? 1 : 0) + senhorioDe.length + (servico ? 1 : 0) +
              suasLicencas.length + suasPrisoes.length + meusClas.length,
  };
}

/**
 * Como se chama quem responde por um vilarejo: "Lorde de Ivarstead".
 * Uma coisa só, não duas — o posto no vilarejo já diz o tratamento.
 * Devolve '' para quem não rege nada.
 */
export function tratamentoSenhorio(perfil) {
  const vilas = (perfil?.senhorioDe || []).map((a) => a.nome).filter(Boolean);
  if (!vilas.length) return '';
  const titulo = perfil.nobreza?.titulo || '';
  const tratamento = (titulo === 'Lorde' || titulo === 'Lady') ? titulo : 'Lorde';
  return `${tratamento} de ${vilas.join(' e ')}`;
}

/** Papéis da pessoa, em selos curtos, para listagens. */
export function papeisDe(perfil) {
  if (!perfil) return [];
  const p = [];
  if (perfil.cargo) p.push({ texto: 'Corte', tom: 'gold' });
  const chefia = perfil.casas.find((c) => c.lidera);
  if (chefia) p.push({ texto: chefia.lideranca || 'Patriarca', tom: 'roxo' });
  /* Senhorio de vilarejo.
     Quem responde por um vilarejo é "Lorde de X" — um selo só. Antes saíam
     dois ("Lorde" pelo título e "Lorde nomeado" pelo posto), dizendo a mesma
     coisa duas vezes. O título de nobreza só sai à parte quando ele não é
     Lorde/Lady, porque aí ele acrescenta algo (um Thane que rege um vilarejo). */
  const titulo = perfil.nobreza?.titulo || '';
  const ehLorde = titulo === 'Lorde' || titulo === 'Lady';
  const senhorio = tratamentoSenhorio(perfil);

  if (senhorio) {
    p.push({ texto: senhorio, tom: 'gold' });
    if (titulo && !ehLorde) p.push({ texto: titulo, tom: TITULO_NOBREZA_TOM[titulo] });
  } else if (perfil.nobreza) {
    p.push({ texto: titulo, tom: TITULO_NOBREZA_TOM[titulo] });
  } else if (perfil.servico) {
    p.push({ texto: perfil.servico.funcao || 'Servo', tom: '' });
  }
  if (perfil.militar) p.push({ texto: perfil.militar.patente || 'Militar', tom: '' });
  if (perfil.trabalho) p.push({ texto: perfil.trabalho.profissao || 'Trabalhador', tom: '' });
  if (perfil.imoveis.length) p.push({ texto: 'Proprietário', tom: 'ok' });
  if (perfil.licencas.some((l) => l.status === 'Ativa')) p.push({ texto: 'Licenciado', tom: 'ok' });
  // Pena cumprida não vira selo: quem já pagou não anda marcado. O registro
  // continua na ficha, no quadro de prisões, que é onde ele serve para algo.
  if (perfil.prisoes?.some((x) => x.status === 'Cumprindo pena')) p.push({ texto: 'Preso', tom: 'perigo' });
  return p;
}

/** Acha o cidadão por trás de uma ficha qualquer (trabalhador, guarda…). */
export function civilDaFicha(ficha, civis = []) {
  if (!ficha) return null;
  if (ficha.civil_id) return civis.find((c) => c.id === ficha.civil_id) || null;
  return civis.find((c) => norm(c.nome) === norm(ficha.nome)) || null;
}
