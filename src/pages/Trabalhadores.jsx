import React, { useMemo, useState } from 'react';
import { useDados } from '../lib/store.jsx';
import { RACAS, PROFISSOES, NIVEIS, NIVEL_VALOR } from '../lib/constants.js';
import SeletorCivil from '../components/SeletorCivil.jsx';
import FichaCidadao from '../components/FichaCidadao.jsx';
import { civilDaFicha } from '../lib/perfil.js';
import {
  Painel, Stat, Selo, Modal, Texto, AreaTexto, Selecao, Icone, Vazio, Pips, Confirmar,
} from '../components/ui.jsx';

const VAZIO = { nome: '', civil_id: '', id_jogo: '', raca: '', profissao: '', nivel: 'Novato', local: 'Riften', vinculo: '', notas: '' };

export default function Trabalhadores() {
  const d = useDados();
  const [busca, setBusca] = useState('');
  const [fProf, setFProf] = useState('');
  const [fNivel, setFNivel] = useState('');
  const [fLocal, setFLocal] = useState('');
  const [edit, setEdit] = useState(null);
  const [rem, setRem] = useState(null);
  const [perfil, setPerfil] = useState(null);

  const todos = d.trabalhadores || [];
  const locais = useMemo(
    () => [...new Set([...(d.assentamentos || []).map((a) => a.nome), ...todos.map((t) => t.local)].filter(Boolean))].sort(),
    [d.assentamentos, todos],
  );

  const lista = useMemo(() => {
    const t = busca.trim().toLowerCase();
    return todos
      .filter((w) =>
        (!t || `${w.nome} ${w.vinculo}`.toLowerCase().includes(t)) &&
        (!fProf || w.profissao === fProf) &&
        (!fNivel || w.nivel === fNivel) &&
        (!fLocal || w.local === fLocal))
      .sort((a, b) => (NIVEL_VALOR[b.nivel] || 0) - (NIVEL_VALOR[a.nivel] || 0) || (a.nome || '').localeCompare(b.nome || ''));
  }, [todos, busca, fProf, fNivel, fLocal]);

  const mestres = todos.filter((w) => w.nivel === 'Mestre').length;
  const oficios = new Set(todos.map((w) => w.profissao).filter(Boolean)).size;
  const semOficio = PROFISSOES.filter((p) => !todos.some((w) => w.profissao === p));

  return (
    <>
      <div className="pg-head">
        <div>
          <h1>Trabalhadores da Cidade</h1>
          <p>Ofícios registrados no Hold — quem produz o quê, em que nível e a serviço de quem.</p>
        </div>
        <div className="acoes">
          <button className="btn primario" onClick={() => setEdit({ ...VAZIO })}>
            <Icone nome="mais" tam={15} /> Registrar trabalhador
          </button>
        </div>
      </div>
      <div className="regra" />

      <div className="grade g4" style={{ marginBottom: 18 }}>
        <Stat rotulo="Trabalhadores" valor={todos.length} sub="no registro de trabalhadores" />
        <Stat rotulo="Mestres de ofício" valor={mestres} sub="nível máximo" tom="verde" />
        <Stat rotulo="Ofícios cobertos" valor={`${oficios}/${PROFISSOES.length}`} sub="profissões com ao menos 1" tom="laranja" />
        <Stat rotulo="Ofícios descobertos" valor={semOficio.length} sub="nenhum registrado" tom="roxo" />
      </div>

      {semOficio.length > 0 && (
        <>
          <Painel titulo="Ofícios sem nenhum trabalhador">
            <div className="chip-lista">
              {semOficio.map((p) => <Selo key={p} tom="warn">{p}</Selo>)}
            </div>
          </Painel>
          <div style={{ height: 16 }} />
        </>
      )}

      <div className="barra-filtros">
        <div className="campo busca">
          <label>Buscar</label>
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Nome ou vínculo…" />
        </div>
        <Selecao rotulo="Profissão" valor={fProf} aoMudar={setFProf} opcoes={PROFISSOES} vazioLabel="Todas" />
        <Selecao rotulo="Nível" valor={fNivel} aoMudar={setFNivel} opcoes={NIVEIS} vazioLabel="Todos" />
        <Selecao rotulo="Local" valor={fLocal} aoMudar={setFLocal} opcoes={locais} vazioLabel="Todos" />
      </div>

      {lista.length === 0 ? (
        <Painel>
          <Vazio simb="⚒">
            Nenhum trabalhador registrado ainda. Use <strong>Registrar trabalhador</strong> para começar o censo de ofícios.
          </Vazio>
        </Painel>
      ) : (
        <div className="tabela-wrap">
          <table>
            <thead>
              <tr>
                <th>Nome</th><th>ID do jogo</th><th>Raça</th><th>Profissão</th><th>Nível</th>
                <th>Local</th><th>Vínculo</th><th className="col-acoes"></th>
              </tr>
            </thead>
            <tbody>
              {lista.map((w) => (
                <tr key={w.id}>
                  <td>
                    {civilDaFicha(w, d.civis || [])
                      ? <button className="nome-forte link-perfil" onClick={() => setPerfil(civilDaFicha(w, d.civis || []))}
                                title="Abrir perfil completo">{w.nome}</button>
                      : <span className="nome-forte">{w.nome}</span>}
                    {w.civil_id && <span className="selo ok" style={{ marginLeft: 7 }} title="Vindo do Registro Civil">civil</span>}
                  </td>
                  <td><span className="mono" style={{ color: 'var(--txt-2)' }}>{w.id_jogo || '—'}</span></td>
                  <td style={{ color: 'var(--txt-2)' }}>{w.raca || '—'}</td>
                  <td><Selo tom="gold">{w.profissao || '—'}</Selo></td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Pips nivel={w.nivel} />
                      <span style={{ fontSize: 11.5, color: 'var(--txt-3)' }}>{w.nivel}</span>
                    </div>
                  </td>
                  <td style={{ color: 'var(--txt-2)' }}>{w.local || '—'}</td>
                  <td style={{ color: 'var(--txt-2)', fontSize: 12.5 }}>{w.vinculo || '—'}</td>
                  <td className="col-acoes">
                    <button className="btn pq fantasma" onClick={() => setEdit(w)}><Icone nome="lapis" tam={13} /></button>{' '}
                    <button className="btn pq perigo" onClick={() => setRem(w)}><Icone nome="lixo" tam={13} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {perfil && <FichaCidadao civil={perfil} dados={d} aoFechar={() => setPerfil(null)} />}
      {edit && (
        <FormTrabalhador
          inicial={edit}
          locais={locais}
          civis={d.civis || []}
          propriedades={d.propriedades || []}
          aoFechar={() => setEdit(null)}
          aoSalvar={async (v) => { await d.salvar('trabalhadores', v); setEdit(null); }}
        />
      )}
      {rem && (
        <Confirmar
          mensagem={`Remover ${rem.nome} do registro de trabalhadores? O cadastro dele no Registro Civil continua.`}
          aoConfirmar={() => d.remover('trabalhadores', rem.id, rem.nome)}
          aoFechar={() => setRem(null)}
        />
      )}
    </>
  );
}

function FormTrabalhador({ inicial, locais, civis, propriedades, aoFechar, aoSalvar }) {
  const [v, setV] = useState({ ...VAZIO, ...inicial });
  const set = (k) => (val) => setV((s) => ({ ...s, [k]: val }));
  const vinculado = v.civil_id ? civis.find((c) => c.id === v.civil_id) : null;

  /** Escolher um cidadão traz a ficha inteira do Registro Civil. */
  const puxarCivil = (c) => setV((s) => ({
    ...s,
    civil_id: c.id,
    nome: c.nome,
    id_jogo: c.id_jogo || '',
    raca: c.raca || s.raca,
    profissao: c.profissao || s.profissao,
    nivel: c.nivel || s.nivel,
  }));

  return (
    <Modal
      titulo={inicial.id ? `Editar — ${inicial.nome}` : 'Registrar trabalhador'}
      aoFechar={aoFechar}
      rodape={
        <>
          <button className="btn fantasma" onClick={aoFechar}>Cancelar</button>
          <button className="btn primario" disabled={!String(v.nome || '').trim()} onClick={() => aoSalvar(v)}>Salvar</button>
        </>
      }
    >
      <SeletorCivil
        rotulo="Cidadão"
        valor={v.nome}
        aoMudar={(n) => setV((s) => ({ ...s, nome: n, civil_id: '', id_jogo: '' }))}
        aoEscolher={puxarCivil}
        civis={civis}
        vinculado={vinculado}
        aoDesvincular={() => setV((s) => ({ ...s, civil_id: '', id_jogo: '' }))}
      />
      <div style={{ height: 12 }} />
      <div className="grade g2">
        <Texto rotulo="ID do jogo" valor={v.id_jogo} aoMudar={set('id_jogo')} className="mono" placeholder="preenchido pelo Registro Civil" />
        <Selecao rotulo="Raça" valor={v.raca} aoMudar={set('raca')} opcoes={RACAS} />
        <Selecao rotulo="Profissão" valor={v.profissao} aoMudar={set('profissao')} opcoes={PROFISSOES} />
        <Selecao rotulo="Nível" valor={v.nivel} aoMudar={set('nivel')} opcoes={NIVEIS} vazioLabel="—" />
        <Selecao rotulo="Local" valor={v.local} aoMudar={set('local')} opcoes={locais} vazioLabel="—" />
        <Selecao
          rotulo="Vínculo (propriedade)"
          valor={v.vinculo}
          aoMudar={set('vinculo')}
          opcoes={propriedades.map((p) => p.nome).sort()}
          vazioLabel="Autônomo"
        />
      </div>
      <div style={{ height: 12 }} />
      <AreaTexto rotulo="Observações" valor={v.notas} aoMudar={set('notas')} />
    </Modal>
  );
}
