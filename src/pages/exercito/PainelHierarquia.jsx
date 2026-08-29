import React, { useState } from 'react';
import {
  Painel, Stat, Selo, Modal, Texto, AreaTexto, Icone, Vazio, Confirmar, Campo,
} from '../../components/ui.jsx';
import {
  hierarquia, efetivoDaPatente, nomePatenteLivre, salarioDe, septims,
} from '../../lib/forcas.js';

const VAZIA = { nome: '', descricao: '', salario: 300, ordem: 0, ativa: true };

/**
 * A hierarquia do Exército. Cada patente é um degrau: tem nome, tem
 * o que se espera de quem a ocupa e tem soldo semanal.
 *
 * A `ordem` é o degrau. A lista aparece do topo para a base, que é
 * como se lê uma hierarquia, e o botão de subir/descer renumera a
 * escada inteira para nunca haver dois degraus no mesmo lugar.
 */
export default function PainelHierarquia({ dados: d, patentes = [], guardas = [] }) {
  const [edit, setEdit] = useState(null);
  const [rem, setRem] = useState(null);
  const [erro, setErro] = useState('');
  const [ocupado, setOcupado] = useState(false);

  const lista = hierarquia(patentes);           // topo → base
  const daBase = [...lista].reverse();          // base → topo, para renumerar

  const gravar = async (patch, rotulo) => {
    setErro('');
    setOcupado(true);
    try { await d.salvar('patentes', patch, rotulo); }
    catch (e) { setErro(e.message || 'Não consegui salvar a patente.'); }
    finally { setOcupado(false); }
  };

  /** Sobe (passo -1) ou desce (passo +1) na lista mostrada. */
  const mover = async (indice, passo) => {
    const destino = indice + passo;
    if (ocupado || destino < 0 || destino >= lista.length) return;
    const nova = [...lista];
    [nova[indice], nova[destino]] = [nova[destino], nova[indice]];
    setErro('');
    setOcupado(true);
    try {
      // A lista está do topo para a base: o primeiro é o maior degrau.
      const total = nova.length;
      for (let i = 0; i < total; i += 1) {
        const degrau = total - i;
        if (Number(nova[i].ordem) === degrau) continue;
        await d.salvar('patentes', { id: nova[i].id, ordem: degrau }, nova[i].nome);
      }
    } catch (e) {
      setErro(e.message || 'Não consegui reordenar a hierarquia.');
    } finally {
      setOcupado(false);
    }
  };

  const salvar = async (v) => {
    if (!nomePatenteLivre(v.nome, patentes, v.id)) {
      throw new Error('Já existe uma patente com esse nome.');
    }
    await d.salvar('patentes', {
      ...v,
      nome: String(v.nome).trim(),
      descricao: String(v.descricao || '').trim(),
      salario: Math.max(0, Number(v.salario) || 0),
      // Posto novo nasce na base da escada — promover é a Corte quem
      // faz, com as setas. Nascer no topo poria um Cabo acima do
      // Lorde Comandante no dia em que fosse criado.
      ordem: v.id
        ? Number(v.ordem) || 1
        : (lista.length ? Math.min(...lista.map((p) => Number(p.ordem) || 0)) - 1 : 1),
    }, v.nome);
    setEdit(null);
  };

  const apagar = async (p) => {
    setErro('');
    try { await d.remover('patentes', p.id, p.nome); }
    catch (e) { setErro(e.message || 'Não consegui remover a patente.'); }
  };

  const folhaSemanal = (guardas || [])
    .filter((g) => g.status !== 'Aposentado')
    .reduce((s, g) => s + salarioDe(g, patentes), 0);

  return (
    <>
      <div className="grade g3" style={{ margin: '18px 0' }}>
        <Stat rotulo="Degraus da hierarquia" valor={lista.length} sub="da base ao comando" />
        <Stat rotulo="Soldo mais alto" valor={septims(Math.max(0, ...lista.map((p) => Number(p.salario) || 0)))}
              sub="por semana" tom="roxo" />
        <Stat rotulo="Folha semanal do Exército" valor={septims(folhaSemanal)}
              sub="somando toda a tropa em serviço" tom="verde" />
      </div>

      <Painel
        titulo="Hierarquia do Exército"
        acoes={
          <button className="btn primario pq" disabled={ocupado} onClick={() => setEdit({ ...VAZIA })}>
            <Icone nome="mais" tam={14} /> Nova patente
          </button>
        }
      >
        <p className="painel-nota">
          Do comando para a base. O soldo de cada degrau é o que o Hold paga por semana a quem
          o ocupa — a ficha do soldado pode arbitrar um valor próprio, e aí é ele que vale.
        </p>
        {erro && <div className="login-erro" style={{ marginBottom: 14 }}>{erro}</div>}

        {lista.length === 0 ? (
          <Vazio simb="✦">Nenhuma patente cadastrada.</Vazio>
        ) : (
          <ol className="escada-patentes">
            {lista.map((p, i) => {
              const gente = efetivoDaPatente(p, guardas, patentes);
              return (
                <li className={`degrau ${p.ativa === false ? 'inativo' : ''}`} key={p.id}>
                  <span className="degrau-num mono">{daBase.length - i}</span>
                  <div className="degrau-corpo">
                    <h4>
                      {p.nome}
                      {p.ativa === false && <Selo tom="off">Fora de uso</Selo>}
                    </h4>
                    <p>{p.descricao || 'Sem descrição.'}</p>
                    <div className="chip-lista">
                      <Selo tom="gold">{septims(p.salario || 0)} / semana</Selo>
                      <Selo tom={gente.length ? 'ok' : 'off'}>{gente.length} soldado(s)</Selo>
                    </div>
                  </div>
                  <div className="divisao-acoes">
                    <button className="btn pq fantasma" title="Subir na hierarquia"
                            disabled={ocupado || i === 0} onClick={() => mover(i, -1)}>↑</button>
                    <button className="btn pq fantasma" title="Descer na hierarquia"
                            disabled={ocupado || i === lista.length - 1} onClick={() => mover(i, 1)}>↓</button>
                    <button className="btn pq fantasma" title="Editar patente" onClick={() => setEdit(p)}>
                      <Icone nome="lapis" tam={13} />
                    </button>
                    <button
                      className="btn pq"
                      disabled={ocupado}
                      onClick={() => gravar({ id: p.id, ativa: p.ativa === false }, p.nome)}
                    >
                      {p.ativa === false ? 'Reativar' : 'Aposentar'}
                    </button>
                    <button
                      className="btn pq perigo"
                      title={gente.length ? 'Há soldados com esta patente' : 'Remover patente'}
                      disabled={ocupado || gente.length > 0}
                      onClick={() => setRem(p)}
                    >
                      <Icone nome="lixo" tam={13} />
                    </button>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </Painel>

      {edit && (
        <FormPatente inicial={edit} aoFechar={() => setEdit(null)} aoSalvar={salvar} />
      )}
      {rem && (
        <Confirmar
          mensagem={`Remover a patente ${rem.nome} da hierarquia?`}
          aoConfirmar={() => apagar(rem)}
          aoFechar={() => setRem(null)}
        />
      )}
    </>
  );
}

/* ------------------------------------------------------------ */
function FormPatente({ inicial, aoFechar, aoSalvar }) {
  const [v, setV] = useState({ ...VAZIA, ...inicial });
  const [erro, setErro] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const set = (k) => (val) => setV((s) => ({ ...s, [k]: val }));

  const enviar = async () => {
    if (!String(v.nome || '').trim()) { setErro('Dê um nome à patente.'); return; }
    setOcupado(true);
    setErro('');
    try { await aoSalvar(v); }
    catch (e) { setErro(e.message || 'Não consegui salvar.'); setOcupado(false); }
  };

  return (
    <Modal
      titulo={inicial.id ? `Patente — ${inicial.nome}` : 'Nova patente'}
      aoFechar={aoFechar}
      rodape={
        <>
          <button className="btn fantasma" onClick={aoFechar}>Cancelar</button>
          <button className="btn primario" disabled={ocupado} onClick={enviar}>
            {ocupado ? 'Salvando…' : 'Salvar patente'}
          </button>
        </>
      }
    >
      {erro && <div className="login-erro" style={{ marginBottom: 14 }}>{erro}</div>}
      <div className="grade g2">
        <Texto rotulo="Nome da patente" valor={v.nome} aoMudar={set('nome')} placeholder="Sargento, Tenente…" />
        <Campo rotulo="Soldo semanal (Septims)">
          <input type="number" min="0" className="mono" value={v.salario ?? ''}
                 onChange={(e) => set('salario')(e.target.value)} />
        </Campo>
      </div>
      <div style={{ height: 12 }} />
      <AreaTexto rotulo="O que se espera deste posto" valor={v.descricao} aoMudar={set('descricao')} rows={3}
                 placeholder="Comanda, treina, responde por…" />
      <div style={{ height: 12 }} />
      <label className="linha-check">
        <input type="checkbox" checked={v.ativa !== false} onChange={(e) => set('ativa')(e.target.checked)} />
        <span>Patente em uso — pode ser atribuída a novos alistados.</span>
      </label>
    </Modal>
  );
}
