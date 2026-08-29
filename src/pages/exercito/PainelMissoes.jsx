import React, { useMemo, useState } from 'react';
import {
  Painel, Stat, Selo, Modal, Texto, AreaTexto, Selecao, Icone, Vazio, Confirmar, Campo,
} from '../../components/ui.jsx';
import {
  STATUS_MISSAO, STATUS_MISSAO_TOM, VISIBILIDADES_MISSAO, INSCRICOES_MISSAO,
} from '../../lib/constants.js';
import {
  todasAsDivisoes, divisaoDe, nomeDaDivisao, fichaMilitarDe, ehLordeComandante,
  ehCapitaoDaDivisao, divisoesQueComanda, podeSeInscreverNaMissao, proximoNumeroMissao,
  dataBR, septims,
} from '../../lib/forcas.js';
import {
  salvarMissaoExercito, inscreverEmMissao, desinscreverDeMissao,
  concluirMissaoExercito, cancelarMissaoExercito,
} from '../../lib/db.js';

const VAZIA_MISSAO = {
  titulo: '',
  descricao: '',
  objetivo: '',
  divisao_id: '',
  prazo: '',
  recompensa: 300,
  tipo_recompensa: 'por_participante',
  visibilidade: 'exercito',
  inscricao: 'aberta',
  vagas: 3,
};

export default function PainelMissoes({
  dados: d,
  usuario,
  divisoes = [],
  guardas = [],
  patentes = [],
  corte = [],
}) {
  const missoes = d.missoes_exercito || [];
  const [busca, setBusca] = useState('');
  const [filtroStatus, setFiltroStatus] = useState('Todas');
  const [filtroDivisao, setFiltroDivisao] = useState('todas');
  const [editMissao, setEditMissao] = useState(null);
  const [concluirMissao, setConcluirMissao] = useState(null);
  const [cancelaMissao, setCancelaMissao] = useState(null);
  const [erro, setErro] = useState('');
  const [ocupado, setOcupado] = useState(false);

  const eComandante = ehLordeComandante(usuario, { corte, guardas, patentes });
  const fichaEu = fichaMilitarDe(usuario, guardas);
  const minhaDivisao = fichaEu ? divisaoDe(fichaEu, divisoes) : null;
  const divsComandadas = divisoesQueComanda(usuario, { divisoes, guardas, corte, patentes });
  const podeEmitir = eComandante || divsComandadas.length > 0;

  // Filtra as missões visíveis e aplicadas pelo filtro do usuário
  const listaVisivel = useMemo(() => {
    return missoes.filter((m) => {
      // Visibilidade de exército vs divisão
      if (!eComandante && m.visibilidade === 'divisao') {
        const minhaDivId = minhaDivisao?.id;
        const eMinhaDiv = minhaDivId && m.divisao_id === minhaDivId;
        const euComando = divsComandadas.some((d) => d.id === m.divisao_id);
        if (!eMinhaDiv && !euComando) return false;
      }

      // Filtro de Status
      if (filtroStatus !== 'Todas' && m.status !== filtroStatus) return false;

      // Filtro de Divisão
      if (filtroDivisao !== 'todas' && m.divisao_id !== filtroDivisao) return false;

      // Filtro de busca
      if (busca.trim()) {
        const termo = busca.toLowerCase();
        const noTitulo = (m.titulo || '').toLowerCase().includes(termo);
        const noObjetivo = (m.objetivo || '').toLowerCase().includes(termo);
        const naDivisao = (m.divisao_nome || '').toLowerCase().includes(termo);
        const noNumero = (m.numero || '').toLowerCase().includes(termo);
        if (!noTitulo && !noObjetivo && !naDivisao && !noNumero) return false;
      }

      return true;
    }).sort((a, b) => new Date(b.criado_em || 0) - new Date(a.criado_em || 0));
  }, [missoes, eComandante, minhaDivisao, divsComandadas, filtroStatus, filtroDivisao, busca]);

  // Estatísticas
  const abertas = missoes.filter((m) => m.status === 'Aberta').length;
  const emAndamento = missoes.filter((m) => m.status === 'Em andamento').length;
  const concluidas = missoes.filter((m) => m.status === 'Concluída').length;
  const totalRecompensasPagas = missoes.reduce((acc, m) => acc + (Number(m.recompensa_paga) || 0), 0);

  // Ações de inscrição
  const aoInscrever = async (missao) => {
    if (ocupado || !fichaEu) return;
    setErro('');
    setOcupado(true);
    try {
      await inscreverEmMissao(missao.id, fichaEu);
      await d.recarregar();
    } catch (ex) {
      setErro(ex.message || 'Não foi possível se inscrever na missão.');
    } finally {
      setOcupado(false);
    }
  };

  const aoDesinscrever = async (missao) => {
    if (ocupado || !fichaEu) return;
    setErro('');
    setOcupado(true);
    try {
      await desinscreverDeMissao(missao.id, fichaEu.id);
      await d.recarregar();
    } catch (ex) {
      setErro(ex.message || 'Não foi possível cancelar sua inscrição.');
    } finally {
      setOcupado(false);
    }
  };

  const aoIniciarMissao = async (missao) => {
    if (ocupado) return;
    setErro('');
    setOcupado(true);
    try {
      await salvarMissaoExercito({ ...missao, status: 'Em andamento' }, usuario?.nome);
      await d.recarregar();
    } catch (ex) {
      setErro(ex.message || 'Não foi possível iniciar a missão.');
    } finally {
      setOcupado(false);
    }
  };

  const abrirNovaMissao = (preDivisaoId = '') => {
    const proximoNum = proximoNumeroMissao(missoes);
    const divPadrao = preDivisaoId || (divsComandadas[0]?.id) || (divisoes[0]?.id) || '';
    const divObj = divisoes.find((d) => d.id === divPadrao);
    setEditMissao({
      ...VAZIA_MISSAO,
      numero: proximoNum,
      divisao_id: divPadrao,
      divisao_nome: divObj?.nome || '',
      emissor_id: fichaEu?.id || usuario?.civil_id || '',
      emissor_nome: usuario?.nome || 'Comando do Exército',
      emissor_cargo: usuario?.cargo || fichaEu?.patente || 'Comandante',
    });
  };

  return (
    <>
      <div style={{ height: 18 }} />

      <div className="grade g4" style={{ marginBottom: 18 }}>
        <Stat rotulo="Missões Abertas" valor={abertas} sub="aguardando voluntários" tom="laranja" />
        <Stat rotulo="Em Andamento" valor={emAndamento} sub="tropas em campo" tom="verde" />
        <Stat rotulo="Concluídas" valor={concluidas} sub="com relatório militar" tom="roxo" />
        <Stat rotulo="Recompensas Pagas" valor={septims(totalRecompensasPagas)} sub="debitadas do Cofre do Hold" tom="gold" />
      </div>

      <Painel
        titulo={`Quadro Geral de Missões do Exército · ${listaVisivel.length}`}
        acoes={
          podeEmitir && (
            <button className="btn primario pq" onClick={() => abrirNovaMissao()}>
              <Icone nome="mais" tam={14} /> Emitir missão
            </button>
          )
        }
      >
        <p className="painel-nota">
          Missões emitidas pelo Comando e pelos Capitães de Divisão. Qualquer soldado pode
          se voluntariar para missões abertas. Recompensas de missões concluídas são pagas
          diretamente através do Cofre de Riften com registro formal na Tesouraria.
        </p>

        {erro && <div className="login-erro" style={{ marginBottom: 14 }}>{erro}</div>}

        {/* Filtros e Busca */}
        <div className="painel-filtros" style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
          <div style={{ flex: '1 1 220px' }}>
            <input
              type="search"
              className="campo-txt"
              placeholder="Buscar por título, objetivo, código ou divisão…"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
            />
          </div>

          <div style={{ minWidth: 160 }}>
            <select
              className="campo-select"
              value={filtroStatus}
              onChange={(e) => setFiltroStatus(e.target.value)}
            >
              <option value="Todas">Status: Todos</option>
              {STATUS_MISSAO.map((st) => (
                <option key={st} value={st}>{st}</option>
              ))}
            </select>
          </div>

          <div style={{ minWidth: 180 }}>
            <select
              className="campo-select"
              value={filtroDivisao}
              onChange={(e) => setFiltroDivisao(e.target.value)}
            >
              <option value="todas">Divisão: Todas</option>
              {todasAsDivisoes(divisoes).map((d) => (
                <option key={d.id} value={d.id}>{d.nome}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Lista de Missões */}
        {listaVisivel.length === 0 ? (
          <Vazio simb="⚔">
            {busca || filtroStatus !== 'Todas' || filtroDivisao !== 'todas'
              ? 'Nenhuma missão encontrada para os filtros selecionados.'
              : 'Nenhuma missão ativa no momento no Exército.'}
          </Vazio>
        ) : (
          <div className="lista-missoes" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {listaVisivel.map((m) => {
              const divAlvo = divisoes.find((d) => d.id === m.divisao_id);
              const participantes = Array.isArray(m.participantes) ? m.participantes : [];
              const jaInscrito = fichaEu && participantes.some((p) => p.guarda_id === fichaEu.id);
              const elegivel = podeSeInscreverNaMissao(m, usuario, { guardas, divisoes });
              const ehCapitaoDesta = divAlvo && ehCapitaoDaDivisao(usuario, divAlvo, { guardas, corte, patentes });
              const podeAdministrar = eComandante || ehCapitaoDesta;

              return (
                <article key={m.id} className={`missao-card status-${(m.status || 'aberta').toLowerCase().replace(/\s+/g, '-')}`}>
                  <header className="missao-card-head">
                    <div className="missao-id-bloco">
                      <span className="mono missao-numero">{m.numero || 'MIS'}</span>
                      {divAlvo && (
                        <span
                          className="missao-div-badge"
                          style={{ borderLeft: `3px solid ${divAlvo.cor || 'var(--gold)'}` }}
                        >
                          <Icone nome={divAlvo.icone || 'escudo'} tam={13} />
                          {divAlvo.nome}
                        </span>
                      )}
                      <Selo tom={STATUS_MISSAO_TOM[m.status] || 'warn'} ponto>
                        {m.status}
                      </Selo>
                    </div>

                    <div className="missao-meta-bloco">
                      {m.visibilidade === 'divisao' && (
                        <Selo tom="roxo">Restrita à Divisão</Selo>
                      )}
                      <span className="missao-emissor">
                        Emitido por <strong>{m.emissor_nome || 'Comando'}</strong> ({m.emissor_cargo || 'Oficial'})
                      </span>
                    </div>
                  </header>

                  <div className="missao-card-corpo">
                    <h3 className="missao-titulo">{m.titulo}</h3>

                    <div className="missao-objetivo-box">
                      <strong>Objetivo Militar:</strong> {m.objetivo || 'Não especificado.'}
                    </div>

                    {m.descricao && (
                      <p className="missao-desc">{m.descricao}</p>
                    )}

                    {m.relatorio && (
                      <div className="missao-relatorio-box">
                        <strong>Relatório de Conclusão:</strong>
                        <p>{m.relatorio}</p>
                        {m.concluida_em && (
                          <small>Concluído em {dataBR(m.concluida_em)} por {m.concluida_por || 'Comando'}.</small>
                        )}
                      </div>
                    )}

                    <div className="missao-detalhes-grid">
                      <div className="detalhe-item">
                        <span className="detalhe-rotulo">Prazo limite</span>
                        <span className="detalhe-valor">{m.prazo ? dataBR(m.prazo) : 'Sem prazo'}</span>
                      </div>

                      <div className="detalhe-item">
                        <span className="detalhe-rotulo">Recompensa</span>
                        <span className="detalhe-valor destaque-gold">{septims(m.recompensa)}</span>
                        <small className="detalhe-sub">por participante</small>
                      </div>

                      <div className="detalhe-item">
                        <span className="detalhe-rotulo">Inscrições</span>
                        <span className="detalhe-valor">
                          {participantes.length} {m.vagas ? `/ ${m.vagas} vaga(s)` : 'voluntário(s)'}
                        </span>
                        <small className="detalhe-sub">
                          {m.inscricao === 'divisao' ? 'Apenas membros da divisão' : 'Aberto a todo o exército'}
                        </small>
                      </div>
                    </div>

                    {/* Lista de Participantes */}
                    {participantes.length > 0 && (
                      <div className="missao-participantes-bloco">
                        <h4>Tropa Inscrita ({participantes.length}):</h4>
                        <div className="participantes-chips">
                          {participantes.map((p, idx) => (
                            <span key={p.guarda_id || idx} className="chip-participante">
                              <Icone nome="espada" tam={12} />
                              <strong>{p.nome}</strong>
                              {p.patente && <small>· {p.patente}</small>}
                              {p.guarda_id === fichaEu?.id && <Selo tom="ok">Você</Selo>}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <footer className="missao-card-rodape">
                    <div className="acoes-soldado">
                      {fichaEu && m.status === 'Aberta' && !jaInscrito && (
                        <button
                          className="btn primario pq"
                          disabled={ocupado || !elegivel.pode}
                          title={elegivel.motivo || 'Inscrever-se'}
                          onClick={() => aoInscrever(m)}
                        >
                          <Icone nome="mais" tam={13} /> Voluntariar-se
                        </button>
                      )}

                      {fichaEu && m.status === 'Aberta' && jaInscrito && (
                        <button
                          className="btn perigo pq"
                          disabled={ocupado}
                          onClick={() => aoDesinscrever(m)}
                        >
                          Cancelar Inscrição
                        </button>
                      )}

                      {!elegivel.pode && !jaInscrito && m.status === 'Aberta' && (
                        <span className="ajuda" style={{ color: 'var(--txt-3)', fontSize: 12 }}>
                          {elegivel.motivo}
                        </span>
                      )}
                    </div>

                    {podeAdministrar && (
                      <div className="acoes-comando">
                        {m.status === 'Aberta' && (
                          <button
                            className="btn pq"
                            disabled={ocupado}
                            onClick={() => aoIniciarMissao(m)}
                            title="Mudar status para Em Andamento"
                          >
                            Iniciar Missão
                          </button>
                        )}

                        {['Aberta', 'Em andamento'].includes(m.status) && (
                          <button
                            className="btn primario pq"
                            disabled={ocupado}
                            onClick={() => setConcluirMissao(m)}
                          >
                            <Icone nome="selo" tam={13} /> Concluir & Pagar
                          </button>
                        )}

                        <button
                          className="btn fantasma pq"
                          disabled={ocupado}
                          title="Editar dados da missão"
                          onClick={() => setEditMissao(m)}
                        >
                          <Icone nome="lapis" tam={13} />
                        </button>

                        {['Aberta', 'Em andamento'].includes(m.status) && (
                          <button
                            className="btn perigo pq"
                            disabled={ocupado}
                            title="Cancelar missão"
                            onClick={() => setCancelaMissao(m)}
                          >
                            Cancelar
                          </button>
                        )}
                      </div>
                    )}
                  </footer>
                </article>
              );
            })}
          </div>
        )}
      </Painel>

      {/* Modal de Nova / Editar Missão */}
      {editMissao && (
        <FormMissao
          inicial={editMissao}
          divisoes={eComandante ? todasAsDivisoes(divisoes) : divsComandadas}
          aoFechar={() => setEditMissao(null)}
          aoSalvar={async (v) => {
            const divObj = divisoes.find((d) => d.id === v.divisao_id);
            await salvarMissaoExercito({
              ...v,
              divisao_nome: divObj?.nome || '',
            }, usuario?.nome || 'Comando');
            await d.recarregar();
            setEditMissao(null);
          }}
        />
      )}

      {/* Modal de Conclusão de Missão com Pagamento da Tesouraria */}
      {concluirMissao && (
        <ModalConcluirMissao
          missao={concluirMissao}
          usuario={usuario}
          aoFechar={() => setConcluirMissao(null)}
          aoConcluir={async ({ relatorio, pagarRecompensa }) => {
            await concluirMissaoExercito({
              missaoId: concluirMissao.id,
              relatorio,
              pagarRecompensa,
              autor: usuario?.nome || usuario?.cargo || 'Comando do Exército',
            });
            await d.recarregar();
            setConcluirMissao(null);
          }}
        />
      )}

      {/* Modal de Cancelamento de Missão */}
      {cancelaMissao && (
        <Confirmar
          mensagem={`Tem certeza que deseja cancelar a missão "${cancelaMissao.titulo}" (${cancelaMissao.numero})?`}
          rotulo="Cancelar Missão"
          aoConfirmar={async () => {
            await cancelarMissaoExercito(cancelaMissao.id, 'Cancelada pelo comando.', usuario?.nome);
            await d.recarregar();
            setCancelaMissao(null);
          }}
          aoFechar={() => setCancelaMissao(null)}
        />
      )}
    </>
  );
}

function FormMissao({ inicial, divisoes = [], aoFechar, aoSalvar }) {
  const [v, setV] = useState({ ...inicial });
  const [erro, setErro] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const set = (k) => (val) => setV((s) => ({ ...s, [k]: val }));

  const enviar = async () => {
    if (!String(v.titulo || '').trim()) {
      setErro('Informe o título da missão.');
      return;
    }
    if (!String(v.objetivo || '').trim()) {
      setErro('Descreva o objetivo militar da missão.');
      return;
    }
    if (!v.divisao_id) {
      setErro('Selecione a divisão responsável pela missão.');
      return;
    }

    setOcupado(true);
    setErro('');
    try {
      await aoSalvar(v);
    } catch (e) {
      setErro(e.message || 'Não foi possível salvar a missão.');
      setOcupado(false);
    }
  };

  return (
    <Modal
      titulo={inicial.id ? `Editar Missão — ${inicial.numero}` : 'Emitir Nova Missão Militar'}
      aoFechar={aoFechar}
      rodape={
        <>
          <button className="btn fantasma" onClick={aoFechar}>Cancelar</button>
          <button className="btn primario" disabled={ocupado} onClick={enviar}>
            {ocupado ? 'Gravando…' : (inicial.id ? 'Salvar Alterações' : 'Emitir Missão')}
          </button>
        </>
      }
    >
      {erro && <div className="login-erro" style={{ marginBottom: 14 }}>{erro}</div>}

      <div className="grade g2">
        <Texto rotulo="Código da Missão" valor={v.numero} aoMudar={set('numero')} placeholder="MIS-0001" />
        <Selecao
          rotulo="Divisão Emissora"
          valor={v.divisao_id}
          aoMudar={set('divisao_id')}
          vazioLabel="— escolha a divisão —"
          opcoes={divisoes.map((d) => ({ valor: d.id, rotulo: d.nome }))}
        />
      </div>

      <div style={{ height: 12 }} />
      <Texto
        rotulo="Título da Missão"
        valor={v.titulo}
        aoMudar={set('titulo')}
        placeholder="Ex.: Patrulha Noturna nas Docas, Escolta Mercante…"
      />

      <div style={{ height: 12 }} />
      <Texto
        rotulo="Objetivo Militar Principal"
        valor={v.objetivo}
        aoMudar={set('objetivo')}
        placeholder="O que os soldados precisam atingir para cumprir a missão."
      />

      <div style={{ height: 12 }} />
      <AreaTexto
        rotulo="Instruções e Detalhes da Missão"
        valor={v.descricao}
        aoMudar={set('descricao')}
        rows={3}
        placeholder="Explicação do contexto, rotas, regras de engajamento e orientações táticas."
      />

      <div style={{ height: 12 }} />
      <div className="grade g3">
        <Texto
          rotulo="Recompensa (Septims/soldado)"
          valor={v.recompensa}
          aoMudar={(val) => set('recompensa')(Number(val) || 0)}
          placeholder="300"
        />
        <Texto
          rotulo="Limite de Vagas (0 = ilimitado)"
          valor={v.vagas}
          aoMudar={(val) => set('vagas')(Number(val) || 0)}
          placeholder="4"
        />
        <Texto
          rotulo="Prazo Limite"
          valor={v.prazo}
          aoMudar={set('prazo')}
          placeholder="AAAA-MM-DD"
        />
      </div>

      <div style={{ height: 12 }} />
      <div className="grade g2">
        <Selecao
          rotulo="Visibilidade"
          valor={v.visibilidade}
          aoMudar={set('visibilidade')}
          opcoes={VISIBILIDADES_MISSAO.map((x) => ({ valor: x.id, rotulo: `${x.nome} — ${x.descricao}` }))}
        />
        <Selecao
          rotulo="Inscrição"
          valor={v.inscricao}
          aoMudar={set('inscricao')}
          opcoes={INSCRICOES_MISSAO.map((x) => ({ valor: x.id, rotulo: `${x.nome} — ${x.descricao}` }))}
        />
      </div>
    </Modal>
  );
}

function ModalConcluirMissao({ missao, usuario, aoFechar, aoConcluir }) {
  const participantes = Array.isArray(missao.participantes) ? missao.participantes : [];
  const recompensa = Number(missao.recompensa || 0);
  const totalPago = recompensa * participantes.length;

  const [relatorio, setRelatorio] = useState('');
  const [pagarRecompensa, setPagarRecompensa] = useState(true);
  const [erro, setErro] = useState('');
  const [ocupado, setOcupado] = useState(false);

  const submeter = async () => {
    setOcupado(true);
    setErro('');
    try {
      await aoConcluir({ relatorio, pagarRecompensa });
    } catch (e) {
      setErro(e.message || 'Falha ao concluir missão.');
      setOcupado(false);
    }
  };

  return (
    <Modal
      titulo={`Concluir Missão — ${missao.numero}: ${missao.titulo}`}
      aoFechar={aoFechar}
      rodape={
        <>
          <button className="btn fantasma" onClick={aoFechar}>Voltar</button>
          <button className="btn primario" disabled={ocupado} onClick={submeter}>
            {ocupado ? 'Processando…' : 'Homologar Conclusão & Pagar'}
          </button>
        </>
      }
    >
      {erro && <div className="login-erro" style={{ marginBottom: 14 }}>{erro}</div>}

      <div className="grade g2" style={{ marginBottom: 14 }}>
        <Stat rotulo="Participantes" valor={participantes.length} sub={participantes.map((p) => p.nome).join(', ') || 'Nenhum soldado'} />
        <Stat rotulo="Total a Debitar do Cofre" valor={pagarRecompensa ? septims(totalPago) : '0 Septims'} sub={`${septims(recompensa)} por soldado`} tom="gold" />
      </div>

      <AreaTexto
        rotulo="Relatório Oficial de Desempenho e Resultados"
        valor={relatorio}
        aoMudar={setRelatorio}
        rows={4}
        placeholder="Descreva o sucesso da operação, prisioneiros apreendidos, itens recuperados ou incidentes…"
      />

      <div style={{ height: 14 }} />
      <label className="linha-check">
        <input
          type="checkbox"
          checked={pagarRecompensa}
          onChange={(e) => setPagarRecompensa(e.target.checked)}
        />
        <span>
          Efetuar lançamento de saída no <strong>Cofre da Tesouraria</strong> ({septims(totalPago)}) referente à recompensa da tropa.
        </span>
      </label>
    </Modal>
  );
}
