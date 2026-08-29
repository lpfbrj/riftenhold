import React, { useState } from 'react';
import {
  Painel, Selo, Modal, Texto, AreaTexto, Selecao, Icone, Vazio, Confirmar, Campo,
} from '../../components/ui.jsx';
import { CORES_DIVISAO, ICONES_DIVISAO } from '../../lib/constants.js';
import {
  todasAsDivisoes, efetivoDaDivisao, operantesDaDivisao, capitaoDa,
  nomeDivisaoLivre, ordenarTropa, nomeDaPatente,
} from '../../lib/forcas.js';

const VAZIA = {
  nome: '', funcoes: '', capitao_id: '', capitao: '',
  cor: CORES_DIVISAO[0].id, icone: 'escudo', ordem: 0, ativa: true,
};

/**
 * O painel onde a Corte desenha o Exército: cria divisões, dá nome,
 * escreve as funções de cada uma e aponta o capitão.
 *
 * As ações rápidas da linha — capitão, ordem, ativar — mandam só o
 * campo que mudou, para não desfazerem o texto de funções que outra
 * pessoa acabou de salvar. O formulário completo, esse grava a ficha
 * inteira: é o que o usuário está vendo e assinando.
 */
export default function PainelDivisoes({ dados: d, divisoes = [], guardas = [], patentes = [] }) {
  const [edit, setEdit] = useState(null);
  const [rem, setRem] = useState(null);
  const [erro, setErro] = useState('');
  const [ocupado, setOcupado] = useState(false);

  const lista = todasAsDivisoes(divisoes);
  const emServico = guardas.filter((g) => g.status !== 'Aposentado');
  const tropa = ordenarTropa(emServico, patentes);
  /** O capitão aposentado continua sendo o capitão até a Corte trocar. */
  const capitaes = (div) => {
    const cap = capitaoDa(div, guardas);
    if (!cap?.id || tropa.some((g) => g.id === cap.id)) return tropa;
    return [...tropa, { ...cap, aposentado: true }];
  };

  const gravar = async (patch, rotulo) => {
    setErro('');
    setOcupado(true);
    try { await d.salvar('divisoes', patch, rotulo); }
    catch (e) { setErro(e.message || 'Não consegui salvar a divisão.'); }
    finally { setOcupado(false); }
  };

  /**
   * Subir e descer na ordem. Renumeramos a lista inteira de 1 em
   * diante: trocar só os dois números daria empate sempre que a
   * ordem gravada estivesse repetida ou com buracos.
   */
  const mover = async (indice, passo) => {
    const destino = indice + passo;
    if (ocupado || destino < 0 || destino >= lista.length) return;
    const nova = [...lista];
    [nova[indice], nova[destino]] = [nova[destino], nova[indice]];
    setErro('');
    setOcupado(true);
    try {
      for (let i = 0; i < nova.length; i += 1) {
        if (Number(nova[i].ordem) === i + 1) continue;
        await d.salvar('divisoes', { id: nova[i].id, ordem: i + 1 }, nova[i].nome);
      }
    } catch (e) {
      setErro(e.message || 'Não consegui reordenar as divisões.');
    } finally {
      setOcupado(false);
    }
  };

  const apontarCapitao = async (div, guardaId) => {
    if (ocupado) return;
    const escolhido = guardas.find((g) => g.id === guardaId) || null;
    await gravar(
      { id: div.id, capitao_id: escolhido?.id || '', capitao: escolhido?.nome || '' },
      `${div.nome} — capitão`,
    );
  };

  const salvar = async (v) => {
    if (!nomeDivisaoLivre(v.nome, divisoes, v.id)) {
      throw new Error('Já existe uma divisão com esse nome.');
    }
    const escolhido = guardas.find((g) => g.id === v.capitao_id) || null;
    await d.salvar('divisoes', {
      ...v,
      nome: String(v.nome).trim(),
      funcoes: String(v.funcoes || '').trim(),
      capitao: escolhido?.nome || '',
      capitao_id: escolhido?.id || '',
      ordem: v.id ? v.ordem : lista.length + 1,
    }, v.nome);
    setEdit(null);
  };

  const apagar = async (div) => {
    setErro('');
    try { await d.remover('divisoes', div.id, div.nome); }
    catch (e) { setErro(e.message || 'Não consegui dissolver a divisão.'); }
  };

  return (
    <>
      <div style={{ height: 18 }} />
      <Painel
        titulo={`Divisões do Exército · ${lista.length}`}
        acoes={
          <button className="btn primario pq" disabled={ocupado} onClick={() => setEdit({ ...VAZIA })}>
            <Icone nome="mais" tam={14} /> Nova divisão
          </button>
        }
      >
        <p className="painel-nota">
          A divisão é a unidade de trabalho do Exército: tem nome, tem função escrita e tem um
          capitão que responde por ela. Dissolver uma divisão só é possível quando não há mais
          ninguém nela — enquanto houver, desative e transfira a tropa.
        </p>
        {erro && <div className="login-erro" style={{ marginBottom: 14 }}>{erro}</div>}

        {lista.length === 0 ? (
          <Vazio simb="⚔">Nenhuma divisão criada ainda.</Vazio>
        ) : (
          <div className="lista-divisoes">
            {lista.map((div, i) => {
              const efetivo = efetivoDaDivisao(div, guardas, divisoes);
              const operantes = operantesDaDivisao(div, guardas, divisoes).length;
              const cap = capitaoDa(div, guardas);
              return (
                <article className={`divisao-linha editavel ${div.ativa === false ? 'inativa' : ''}`} key={div.id}>
                  <span className="divisao-marca" style={{ background: div.cor || 'var(--gold)' }}>
                    <Icone nome={div.icone || 'escudo'} tam={15} cor="#15120c" />
                  </span>

                  <div className="divisao-corpo">
                    <h4>
                      {div.nome}
                      {div.ativa === false && <Selo tom="off">Desativada</Selo>}
                    </h4>
                    <p>{div.funcoes || 'Sem funções descritas — clique em editar e escreva o que esta divisão faz.'}</p>
                    <div className="divisao-capitao">
                      <Campo rotulo="Capitão da divisão">
                        <select value={cap?.id || ''} disabled={ocupado}
                                onChange={(e) => apontarCapitao(div, e.target.value)}>
                          <option value="">— sem capitão —</option>
                          {capitaes(div).map((g) => (
                            <option key={g.id} value={g.id}>
                              {g.nome} · {nomeDaPatente(g, patentes) || 'sem patente'}
                              {g.aposentado ? ' · aposentado' : ''}
                            </option>
                          ))}
                        </select>
                      </Campo>
                      <div className="chip-lista">
                        <Selo>{efetivo.length} na divisão</Selo>
                        <Selo tom={operantes ? 'ok' : 'off'} ponto>{operantes} operante(s)</Selo>
                      </div>
                    </div>
                  </div>

                  <div className="divisao-acoes">
                    <button className="btn pq fantasma" title="Subir na ordem"
                            disabled={ocupado || i === 0} onClick={() => mover(i, -1)}>↑</button>
                    <button className="btn pq fantasma" title="Descer na ordem"
                            disabled={ocupado || i === lista.length - 1} onClick={() => mover(i, 1)}>↓</button>
                    <button className="btn pq fantasma" title="Editar divisão" onClick={() => setEdit(div)}>
                      <Icone nome="lapis" tam={13} />
                    </button>
                    <button
                      className="btn pq"
                      disabled={ocupado}
                      title={div.ativa === false ? 'Reativar' : 'Desativar'}
                      onClick={() => gravar({ id: div.id, ativa: div.ativa === false }, div.nome)}
                    >
                      {div.ativa === false ? 'Reativar' : 'Desativar'}
                    </button>
                    <button
                      className="btn pq perigo"
                      title={efetivo.length ? 'Há soldados nesta divisão' : 'Dissolver divisão'}
                      disabled={ocupado || efetivo.length > 0}
                      onClick={() => setRem(div)}
                    >
                      <Icone nome="lixo" tam={13} />
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </Painel>

      {edit && (
        <FormDivisao
          inicial={edit}
          tropa={capitaes(edit)}
          patentes={patentes}
          aoFechar={() => setEdit(null)}
          aoSalvar={salvar}
        />
      )}
      {rem && (
        <Confirmar
          mensagem={`Dissolver a divisão ${rem.nome}? O registro some da lista de divisões.`}
          rotulo="Dissolver"
          aoConfirmar={() => apagar(rem)}
          aoFechar={() => setRem(null)}
        />
      )}
    </>
  );
}

/* ------------------------------------------------------------ */
function FormDivisao({ inicial, tropa = [], patentes = [], aoFechar, aoSalvar }) {
  const [v, setV] = useState({ ...VAZIA, ...inicial });
  const [erro, setErro] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const set = (k) => (val) => setV((s) => ({ ...s, [k]: val }));

  const enviar = async () => {
    if (!String(v.nome || '').trim()) { setErro('Dê um nome à divisão.'); return; }
    setOcupado(true);
    setErro('');
    try { await aoSalvar(v); }
    catch (e) { setErro(e.message || 'Não consegui salvar.'); setOcupado(false); }
  };

  return (
    <Modal
      titulo={inicial.id ? `Divisão — ${inicial.nome}` : 'Nova divisão'}
      aoFechar={aoFechar}
      rodape={
        <>
          <button className="btn fantasma" onClick={aoFechar}>Cancelar</button>
          <button className="btn primario" disabled={ocupado} onClick={enviar}>
            {ocupado ? 'Salvando…' : 'Salvar divisão'}
          </button>
        </>
      }
    >
      {erro && <div className="login-erro" style={{ marginBottom: 14 }}>{erro}</div>}
      <Texto rotulo="Nome da divisão" valor={v.nome} aoMudar={set('nome')} placeholder="Guarda da Cidade, Cavaleiros Negros…" />
      <div style={{ height: 12 }} />
      <AreaTexto
        rotulo="Funções da divisão"
        valor={v.funcoes}
        aoMudar={set('funcoes')}
        rows={3}
        placeholder="O que esta divisão faz no dia a dia do Hold — ronda, fronteira, investigação, choque…"
      />
      <div style={{ height: 12 }} />
      <Selecao
        rotulo="Capitão da divisão"
        valor={v.capitao_id}
        aoMudar={set('capitao_id')}
        vazioLabel="— sem capitão —"
        opcoes={tropa.map((g) => ({ valor: g.id, rotulo: `${g.nome} · ${nomeDaPatente(g, patentes) || 'sem patente'}` }))}
      />

      <div style={{ height: 16 }} />
      <Campo rotulo="Cor do estandarte">
        <div className="paleta">
          {CORES_DIVISAO.map((c) => (
            <button
              key={c.id}
              type="button"
              className={`paleta-cor ${v.cor === c.id ? 'ativa' : ''}`}
              style={{ background: c.id }}
              title={c.nome}
              onClick={() => set('cor')(c.id)}
            />
          ))}
        </div>
      </Campo>

      <div style={{ height: 12 }} />
      <Campo rotulo="Símbolo">
        <div className="paleta">
          {ICONES_DIVISAO.map((ic) => (
            <button
              key={ic.id}
              type="button"
              className={`paleta-icone ${v.icone === ic.id ? 'ativa' : ''}`}
              title={ic.nome}
              onClick={() => set('icone')(ic.id)}
            >
              <Icone nome={ic.id} tam={16} cor={v.icone === ic.id ? 'var(--gold)' : 'var(--txt-3)'} />
            </button>
          ))}
        </div>
      </Campo>

      <div style={{ height: 12 }} />
      <label className="linha-check">
        <input type="checkbox" checked={v.ativa !== false} onChange={(e) => set('ativa')(e.target.checked)} />
        <span>Divisão ativa — aparece na escala e recebe novos alistados.</span>
      </label>
    </Modal>
  );
}
