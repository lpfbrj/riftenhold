import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useDados } from '../lib/store.jsx';
import {
  salvarFichaPropria, salvarPericiasCidadao, pedirIsencaoCidadania, pedirNobreza,
  alistarNaMilicia, sairDaMilicia,
} from '../lib/db.js';
import {
  RACAS, PROFISSOES, NIVEIS, NIVEL_VALOR, GRUPOS_PERICIA, STATUS_CIVIL_TOM, STATUS_PRISAO_TOM,
  STATUS_LICENCA_TOM, TIPO_LICENCA_POR_ID, recursoDaLicenca,
  TITULO_NOBREZA_TOM, SEM_ISENCAO, STATUS_ISENCAO_TOM, REGRA_ISENCAO, rotuloHold,
  PEDIDO_CASA_POR_ID,
} from '../lib/constants.js';
import { cidadaniaDe } from '../lib/cidadania.js';
import { cargoPorId } from '../lib/corte.js';
import { SECAO_POR_ID, septims } from '../data/codigo.js';
import { lerCatalogacao, totalItens } from '../data/itens.js';
import { montarPerfil, papeisDe, tratamentoSenhorio } from '../lib/perfil.js';
import { casaDoVilarejo } from '../lib/nobreza.js';
import { nobrezaDoCivil, casaFundadaPor, septims as moeda } from '../lib/casas.js';
import { naMilicia, campanhaAberta, dataBR, septims as soldoEmSeptims } from '../lib/forcas.js';
import { Catalogo } from '../components/Catalogo.jsx';
import {
  Painel, Stat, Selo, Texto, AreaTexto, Selecao, Icone, Vazio, Pips,
} from '../components/ui.jsx';

const data = (iso) => (iso
  ? new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })
  : '—');

/**
 * A ficha do próprio morador. Ele edita o que é dele para editar
 * (nome, raça, ofício, nível, o que quer que a Corte saiba) e consulta,
 * sem poder mexer, tudo que a Corte registrou a respeito dele.
 */
export default function MinhaFicha({ usuario }) {
  const d = useDados();
  const civis = d.civis || [];
  const eu = civis.find((c) => c.id === usuario.civil_id) || null;

  const perfil = useMemo(() => (eu ? montarPerfil(eu, d) : null), [eu, d]);

  const [rascunho, setRascunho] = useState(null);
  const [salvo, setSalvo] = useState(false);
  const [erro, setErro] = useState('');
  const relogio = useRef(null);
  useEffect(() => () => clearTimeout(relogio.current), []);

  if (!eu) {
    return (
      <Painel titulo="Ficha não encontrada">
        <Vazio simb="✦">
          Seu registro não está mais nos arquivos do Hold. Procure alguém da Corte.
        </Vazio>
      </Painel>
    );
  }

  const editando = rascunho !== null;
  const v = rascunho || eu;
  const set = (k) => (val) => setRascunho((s) => ({ ...(s || eu), [k]: val }));

  const salvar = async () => {
    setErro('');
    if (!String(v.nome || '').trim()) { setErro('O nome do personagem não pode ficar em branco.'); return; }
    try {
      // O morador mexe só nestes campos. Situação, observação da Corte, senha e
      // ID do jogo continuam como estão — quem decide isso é a Corte.
      await salvarFichaPropria(usuario, v);
      await d.recarregar();
      setRascunho(null);
      setSalvo(true);
      clearTimeout(relogio.current);
      relogio.current = setTimeout(() => setSalvo(false), 3500);
    } catch (ex) {
      setErro(ex.message || 'Não foi possível salvar agora.');
    }
  };

  const papeis = papeisDe(perfil);

  // ---- multas: o que o Código cobrou dele nas prisões registradas ----
  const comMulta = (perfil.prisoes || []).filter((x) => x.multa != null && x.multa > 0);
  const totalMultas = comMulta.reduce((s, x) => s + Number(x.multa || 0), 0);
  const emAberto = comMulta.filter((x) => x.status === 'Cumprindo pena');
  const totalAberto = emAberto.reduce((s, x) => s + Number(x.multa || 0), 0);

  const licencasAtivas = (perfil.licencas || []).filter((l) => l.status === 'Ativa');

  return (
    <>
      <div className="pg-head">
        <div>
          <h1>Minha ficha</h1>
          <p>
            Tudo que os arquivos do Hold guardam sobre você. O que está aqui em cima
            é seu para editar; o resto é registro da Corte, e só a Corte muda.
          </p>
        </div>
        {!editando && (
          <div className="acoes">
            <button className="btn primario" onClick={() => setRascunho({ ...eu })}>
              <Icone nome="lapis" tam={15} /> Editar minha ficha
            </button>
          </div>
        )}
      </div>
      <div className="regra" />

      {salvo && (
        <div className="aviso-ok">
          <Icone nome="selo" tam={15} /> Ficha salva. A Corte já enxerga a atualização.
        </div>
      )}

      {/* -------- Identidade -------- */}
      <div className="ficha-topo">
        <span className="ficha-avatar"><Icone nome="pessoa" tam={34} cor="var(--gold)" /></span>
        <div className="ficha-id">
          <h2>{eu.nome}</h2>
          <div className="chip-lista">
            <Selo tom="ok"><span className="mono">ID {eu.id_jogo}</span></Selo>
            {eu.raca && <Selo>{eu.raca}</Selo>}
            <Selo tom={STATUS_CIVIL_TOM[eu.status]} ponto>{eu.status}</Selo>
          </div>
          {papeis.length > 0 && (
            <div className="chip-lista" style={{ marginTop: 6 }}>
              {papeis.map((p, i) => <Selo key={i} tom={p.tom}>{p.texto}</Selo>)}
            </div>
          )}
        </div>
      </div>

      {eu.observacao_corte && (
        <p className="perfil-nota-corte"><strong>Recado da Corte:</strong> {eu.observacao_corte}</p>
      )}

      {/* -------- O que é dele para editar -------- */}
      <Painel
        titulo="Meus dados"
        acoes={editando
          ? <Selo tom="warn" ponto>Editando</Selo>
          : (
            <>
              {(eu.atualizado_em || eu.criado_em) && (
                <Selo>Atualizado em {data(eu.atualizado_em || eu.criado_em)}</Selo>
              )}
              {/* O mesmo que o botão do topo, à mão de quem só quer trocar
                  a profissão ou o nível dela. */}
              <button className="btn pq" onClick={() => setRascunho({ ...eu })}>
                <Icone nome="lapis" tam={13} /> Editar
              </button>
            </>
          )}
      >
        {erro && <div className="login-erro" style={{ marginBottom: 12 }}>{erro}</div>}

        {editando ? (
          <>
            <div className="grade g2">
              <Texto rotulo="Nome do personagem" valor={v.nome} aoMudar={set('nome')} />
              <div className="campo">
                <span>ID do jogo</span>
                <input value={eu.id_jogo} readOnly className="mono travado" />
              </div>
              <Selecao rotulo="Raça" valor={v.raca} aoMudar={set('raca')} opcoes={RACAS} />
              <Selecao rotulo="Profissão" valor={v.profissao} aoMudar={set('profissao')}
                       opcoes={PROFISSOES} vazioLabel="Nenhuma" />
              <Selecao rotulo="Nível da profissão" valor={v.nivel} aoMudar={set('nivel')}
                       opcoes={NIVEIS.filter((n) => n !== 'N/A')} vazioLabel="—" />
            </div>
            <p className="ajuda" style={{ marginTop: 8 }}>
              <Icone nome="livro" tam={13} /> Profissão e nível são seus para manter em dia —
              é o que abre (ou fecha) os editais que pedem um ofício. O ID do jogo é o seu
              login, e só a Corte pode trocá-lo; situação e cargos também são decisão dela.
            </p>
            <div style={{ height: 12 }} />
            <AreaTexto rotulo="O que quero que a Corte saiba" valor={v.notas} aoMudar={set('notas')}
                       placeholder="História do personagem, ofício, pedidos…" />
            <footer className="ficha-acoes">
              <button className="btn fantasma" onClick={() => { setRascunho(null); setErro(''); }}>
                Cancelar
              </button>
              <button className="btn primario" onClick={salvar}>Salvar minha ficha</button>
            </footer>
          </>
        ) : (
          <div className="grade g3">
            <Dado rotulo="Raça" valor={eu.raca} />
            <Dado rotulo="Profissão" valor={eu.profissao} />
            <Dado rotulo="Nível">
              {eu.profissao ? (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                  <Pips nivel={eu.nivel} />
                  <span style={{ fontSize: 12, color: 'var(--txt-2)' }}>{eu.nivel}</span>
                </span>
              ) : '—'}
            </Dado>
            {eu.notas && (
              <div style={{ gridColumn: '1 / -1' }}>
                <Dado rotulo="O que você escreveu"><em style={{ color: 'var(--txt-2)' }}>“{eu.notas}”</em></Dado>
              </div>
            )}
          </div>
        )}
      </Painel>

      <div style={{ height: 16 }} />

      {/* -------- Cidadania -------- */}
      <PainelCidadania usuario={usuario} eu={eu} aoSalvar={d.recarregar} />

      <div style={{ height: 16 }} />

      {/* -------- Habilidades declaradas -------- */}
      <PainelHabilidades usuario={usuario} eu={eu} militar={perfil.militar} aoSalvar={d.recarregar} />

      <div style={{ height: 16 }} />

      <div className="grade g4" style={{ marginBottom: 16 }}>
        <Stat rotulo="Propriedades" valor={perfil.imoveis.length} sub="em seu nome"
              tom={perfil.imoveis.length ? 'verde' : ''} />
        <Stat rotulo="Licenças ativas" valor={licencasAtivas.length} sub="emitidas pela Corte"
              tom={licencasAtivas.length ? 'roxo' : ''} />
        <Stat rotulo="Multas em aberto" valor={septims(totalAberto)}
              sub={emAberto.length ? `${emAberto.length} pendente${emAberto.length === 1 ? '' : 's'}` : 'nada devendo'}
              tom={totalAberto ? 'laranja' : ''} />
        <Stat rotulo="Prisões" valor={(perfil.prisoes || []).length} sub="na ficha criminal"
              tom={(perfil.prisoes || []).length ? 'laranja' : ''} />
      </div>

      {/* -------- Cargo na Corte -------- */}
      <Painel
        titulo="Cargo na Corte"
        acoes={perfil.cargo
          ? <Selo tom="gold" ponto>Membro da Corte</Selo>
          : <Selo tom="off">Sem assento</Selo>}
      >
        {perfil.cargo ? (() => {
          const c = cargoPorId(perfil.cargo.cargo_id || perfil.cargo.id, d.corte || []);
          return (
            <>
              <div className="perfil-linha destaque">
                <Icone nome="coroa" tam={16} cor="var(--gold)" />
                <span style={{ fontSize: 15 }}>{c?.nome || 'Cargo'}</span>
                {perfil.cargo.desde && <Selo>nomeado desde {perfil.cargo.desde}</Selo>}
              </div>
              {c?.descricao && (
                <p style={{ margin: '6px 0 0', fontSize: 12.5, color: 'var(--txt-2)' }}>{c.descricao}</p>
              )}
              {perfil.cargo.notas && (
                <p className="perfil-fala" style={{ marginBottom: 0 }}>“{perfil.cargo.notas}”</p>
              )}
            </>
          );
        })() : (
          <Vazio simb="♔">Você não ocupa cargo na Corte de Riften.</Vazio>
        )}
      </Painel>
      <div style={{ height: 16 }} />

      {/* -------- Nobreza -------- */}
      <Painel
        titulo="Nobreza"
        acoes={<Selo tom={TITULO_NOBREZA_TOM[perfil.tituloNobreza]} ponto>{perfil.tituloNobreza}</Selo>}
      >
        {perfil.casas.length === 0 ? (
          perfil.servico ? (
            <>
              <p className="painel-nota">
                Você <strong>serve</strong> a uma casa, mas não pertence à linhagem dela — por
                isso consta como <strong>Plebeu</strong> e não aparece na Nobreza de Riften.
              </p>
              <div className="perfil-linha destaque">
                <span className="cor-ponto" style={{ background: perfil.servico.cor }} />
                <span style={{ fontSize: 15 }}>Casa {perfil.servico.casa}</span>
                <Selo tom="gold">{perfil.servico.funcao || 'Servo da casa'}</Selo>
              </div>
            </>
          ) : (
            <Vazio simb="⚜">
              Você não pertence a nenhuma dinastia nobre de Riften, e por isso consta como
              <strong> Plebeu</strong>. Quem inscreve alguém numa casa é o Patriarca ou a
              Matriarca, junto à Corte.
            </Vazio>
          )
        ) : (
          <>
            <p className="painel-nota">
              Você consta na <strong>Nobreza de Riften</strong> como{' '}
              <strong>{perfil.tituloNobreza}</strong>. Elevar esse título é ato da Corte.
            </p>
            <div className="grade g2">
              {perfil.casas.map(({ cla, lidera, lideranca, titulo }) => (
                <article className="casa-cartao" key={cla.id}>
                  <span className="casa-brasao" style={{ borderColor: cla.cor || '#7c6bb0' }}>
                    {cla.brasao
                      ? <img src={cla.brasao} alt="" />
                      : <Icone nome="estandarte" tam={24} cor={cla.cor || '#7c6bb0'} />}
                  </span>
                  <div>
                    <h4>Casa {cla.nome}</h4>
                    <div className="chip-lista" style={{ marginTop: 5 }}>
                      {/* O título é o daquela casa: quem é Thane numa e Nobre
                          noutra não pode ver o mesmo selo nas duas. */}
                      <Selo tom={TITULO_NOBREZA_TOM[titulo]}>{titulo}</Selo>
                      {lidera
                        ? <Selo tom="gold">{lideranca || 'Patriarca'} da casa</Selo>
                        : <Selo>Membro</Selo>}
                      {cla.lider && !lidera && <Selo>{cla.titulo_lider || 'Patriarca'}: {cla.lider}</Selo>}
                      <Selo>{(cla.membros || []).length} membros</Selo>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </>
        )}
      </Painel>

      <div style={{ height: 16 }} />

      {/* -------- Pedido de nobreza -------- */}
      <PainelPedirNobreza usuario={usuario} eu={eu} aoSalvar={d.recarregar} />

      <div style={{ height: 16 }} />

      {/* -------- Vilarejo sob responsabilidade -------- */}
      {perfil.senhorioDe.length > 0 && (
        <>
          <Painel
            titulo="Vilarejo sob minha responsabilidade"
            acoes={<Selo tom="gold" ponto>{tratamentoSenhorio(perfil)}</Selo>}
          >
            {perfil.senhorioDe.map((a) => {
              const casa = casaDoVilarejo(a, d.clas || []);
              const props = (d.propriedades || []).filter((x) => x.local === a.nome);
              return (
                <div className="perfil-imovel" key={a.id}>
                  <div className="perfil-linha destaque">
                    <Icone nome="vila" tam={15} cor="var(--gold)" />
                    <span style={{ fontSize: 15 }}>{a.nome}</span>
                    <Selo>{a.tipo}</Selo>
                    {casa && (
                      <Selo tom="roxo">
                        <i className="cor-ponto" style={{ background: casa.cor }} /> Casa {casa.nome}
                      </Selo>
                    )}
                    <Selo tom="ok">{props.length} propriedade{props.length === 1 ? '' : 's'}</Selo>
                  </div>
                  {a.descricao && (
                    <p style={{ margin: '6px 0 0', fontSize: 12.5, color: 'var(--txt-2)' }}>{a.descricao}</p>
                  )}
                  {casa && (
                    <p className="perfil-aviso">
                      Enquanto você responder por {a.nome}, o vilarejo consta sob o estandarte
                      da Casa {casa.nome}.
                    </p>
                  )}
                </div>
              );
            })}
          </Painel>
          <div style={{ height: 16 }} />
        </>
      )}

      {/* -------- Propriedades -------- */}
      <Painel
        titulo="Minhas propriedades"
        acoes={perfil.imoveis.length ? <Selo tom="gold">{perfil.imoveis.length}</Selo> : null}
      >
        {perfil.imoveis.length === 0 ? (
          <Vazio simb="⌂">Nenhuma propriedade em seu nome nos registros do Hold.</Vazio>
        ) : (
          perfil.imoveis.map((p) => {
            const cat = lerCatalogacao(p.catalogacao);
            return (
              <div className="perfil-imovel" key={p.id}>
                <div className="perfil-linha destaque">
                  <span>{p.nome}</span>
                  <Selo>{p.tipo}</Selo>
                  {p.local && <Selo>{p.local}</Selo>}
                  {p.status && <Selo tom="off">{p.status}</Selo>}
                  {p.organizacao && <Selo tom="roxo">{p.organizacao}</Selo>}
                  {cat.length > 0 && <Selo tom="gold">{totalItens(cat)} peças</Selo>}
                </div>
                {cat.length > 0 && <Catalogo itens={cat} limite={10} />}
              </div>
            );
          })
        )}
      </Painel>

      <div style={{ height: 16 }} />

      {/* -------- Ofício e ficha militar -------- */}
      <div className="grade g2">
        <Painel titulo="Meu ofício">
          {!perfil.trabalho && !eu.profissao ? (
            <Vazio simb="⚒">Nenhum ofício registrado.</Vazio>
          ) : (
            <>
              <div className="perfil-linha destaque">
                <span>{perfil.trabalho?.profissao || eu.profissao}</span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
                  <Pips nivel={perfil.trabalho?.nivel || eu.nivel} />
                  <span style={{ fontSize: 11.5, color: 'var(--txt-3)' }}>
                    {perfil.trabalho?.nivel || eu.nivel}
                  </span>
                </span>
              </div>
              {perfil.trabalho?.local && (
                <div className="perfil-linha"><span>Trabalha em {perfil.trabalho.local}</span></div>
              )}
              {perfil.trabalho?.vinculo && (
                <div className="perfil-linha"><span>A serviço de {perfil.trabalho.vinculo}</span></div>
              )}
              {!perfil.trabalho && (
                <p className="perfil-aviso">
                  Você declarou este ofício, mas a Corte ainda não abriu sua ficha de
                  trabalhador. Isso não impede nada — é só o registro formal.
                </p>
              )}
            </>
          )}
        </Painel>

        <Painel titulo="Ficha militar">
          {!perfil.militar ? (
            <Vazio simb="⚔">
              Você não consta no Exército de Riften. Alistados entram pelo Quartel General,
              com estas mesmas credenciais.
            </Vazio>
          ) : (
            <>
              <div className="perfil-linha destaque">
                <span>{perfil.militar.patente}</span>
                <Selo tom={perfil.militar.status === 'Operante' ? 'ok' : 'off'} ponto>
                  {perfil.militar.status}
                </Selo>
              </div>
              <div className="perfil-linha"><span>{perfil.militar.divisao || 'Sem divisão'}</span></div>
              <p className="perfil-aviso">
                Suas habilidades de combate ficam no Quartel General — entre por lá para editá-las.
              </p>
            </>
          )}
        </Painel>
      </div>

      <div style={{ height: 16 }} />

      <PainelMilicia usuario={usuario} dados={d} perfil={perfil} />

      <div style={{ height: 16 }} />

      {/* -------- Licenças -------- */}
      <Painel
        titulo="Minhas licenças"
        acoes={licencasAtivas.length ? <Selo tom="ok" ponto>{licencasAtivas.length} ativa(s)</Selo> : null}
      >
        {(perfil.licencas || []).length === 0 ? (
          <Vazio simb="⚖">
            Nenhuma licença vale para você. A Corte emite licenças para moradores e para
            clãs — e a licença de um clã vale para todos os membros dele.
          </Vazio>
        ) : (
          perfil.licencas.map((l) => {
            const tipo = TIPO_LICENCA_POR_ID[l.tipo];
            return (
              <div className="perfil-imovel" key={l.id}>
                <div className="perfil-linha destaque">
                  <span>{tipo?.nome || 'Licença'}</span>
                  <span className="selo mono">{l.numero}</span>
                  <Selo tom={STATUS_LICENCA_TOM[l.status]} ponto>{l.status}</Selo>
                  {l.escolta && <Selo tom="roxo"><Icone nome="escudo" tam={11} /> Escolta</Selo>}
                  {/* Licença do clã: ela não é dele, mas vale para ele. */}
                  {l.porCla && <Selo tom="gold">pelo clã {l.porCla}</Selo>}
                </div>
                {(l.cobertura || []).length > 0 && (
                  <div className="chip-lista" style={{ marginTop: 5 }}>
                    {(l.cobertura || []).map((c) => (
                      <Selo key={c}>{tipo?.coberturas.find((x) => x.id === c)?.nome || c}</Selo>
                    ))}
                  </div>
                )}
                {(l.recursos || []).length > 0 && (
                  <div className="cat-chips" style={{ marginTop: 6 }}>
                    {(l.recursos || []).map((r) => {
                      const m = recursoDaLicenca(l.tipo, r);
                      return (
                        <span className="cat-chip" key={r} style={{ '--c': m?.cor || '#8d8d94' }}>
                          <i className="minerio-ponto" style={{ background: m?.cor }} />
                          {m?.nome || r}
                        </span>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })
        )}
      </Painel>

      <div style={{ height: 16 }} />

      {/* -------- Multas -------- */}
      <Painel
        titulo="Multas"
        acoes={totalMultas
          ? <Selo tom={totalAberto ? 'warn' : 'ok'}>{septims(totalMultas)} no total</Selo>
          : <Selo tom="ok" ponto>Nada devendo</Selo>}
      >
        {comMulta.length === 0 ? (
          <Vazio simb="⛃">Nenhuma multa lançada contra você.</Vazio>
        ) : (
          <div className="tabela-wrap">
            <table style={{ minWidth: 560 }}>
              <thead>
                <tr><th>Quando</th><th>Motivo</th><th>Artigo</th><th>Multa</th><th>Situação</th></tr>
              </thead>
              <tbody>
                {[...comMulta].sort((a, b) => new Date(b.inicio) - new Date(a.inicio)).map((x) => (
                  <tr key={x.id}>
                    <td style={{ color: 'var(--txt-2)', fontSize: 12 }}>{data(x.inicio)}</td>
                    <td>{x.crime}</td>
                    <td style={{ color: 'var(--txt-2)', fontSize: 12.5 }}>
                      {x.artigo || '—'}
                      {x.secao && <div style={{ fontSize: 11, color: 'var(--txt-3)' }}>{SECAO_POR_ID[x.secao]?.nome}</div>}
                    </td>
                    <td className="mono" style={{ color: 'var(--gold-2)' }}>{septims(x.multa)}</td>
                    <td><Selo tom={STATUS_PRISAO_TOM[x.status]} ponto>{x.status}</Selo></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Painel>

      <div style={{ height: 16 }} />

      {/* -------- Ficha criminal -------- */}
      <Painel
        titulo="Ficha criminal"
        acoes={(perfil.prisoes || []).length
          ? <Selo tom="warn">{perfil.prisoes.length} registro(s)</Selo>
          : <Selo tom="ok" ponto>Nada consta</Selo>}
      >
        {(perfil.prisoes || []).length === 0 ? (
          <Vazio simb="✓">Nada consta contra você nos registros da Guarda.</Vazio>
        ) : (
          [...perfil.prisoes].sort((a, b) => new Date(b.inicio) - new Date(a.inicio)).map((x) => (
            <div className="perfil-imovel" key={x.id}>
              <div className="perfil-linha destaque">
                <span>{x.crime}</span>
                {x.artigo && <Selo>{x.artigo}</Selo>}
                <Selo tom="gold">{x.minutos} min</Selo>
                <Selo tom={STATUS_PRISAO_TOM[x.status]} ponto>{x.status}</Selo>
              </div>
              <div className="perfil-linha" style={{ fontSize: 11.5, color: 'var(--txt-3)' }}>
                <span>
                  {data(x.inicio)}
                  {x.origem && <> · procedência {rotuloHold(x.origem)}</>}
                  {x.registrado_por && <> · registrado por {x.registrado_por}</>}
                </span>
              </div>
              {x.motivo && <p className="perfil-fala" style={{ margin: 0 }}>“{x.motivo}”</p>}
            </div>
          ))
        )}
      </Painel>
    </>
  );
}

/* ============================================================
   MINHA CIDADANIA
   Quem nasceu no Hold não precisa de nada. Quem veio de outra
   cidade está transferindo a cidadania e pode pedir isenção —
   na hora do registro ou depois, aqui, quantas vezes precisar
   (enquanto não houver pedido em pé nem isenção concedida).
   ============================================================ */
/* ============================================================
   Pedido de nobreza
   O caminho para a casa nobre começa aqui, e começa na
   propriedade: quem tem casa, comércio ou fortaleza em seu nome
   pode pedir à Corte o título — 50.000 Septims. Concedido o
   título, abre-se o menu da Dinastia para fundar a casa.
   ============================================================ */
function PainelPedirNobreza({ usuario, eu, aoSalvar }) {
  const d = useDados();
  const [pedindo, setPedindo] = useState(false);
  const [motivo, setMotivo] = useState('');
  const [erro, setErro] = useState('');
  const [salvo, setSalvo] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const relogio = useRef(null);
  useEffect(() => () => clearTimeout(relogio.current), []);

  const pedidos = d.pedidos_casa || [];
  const propriedades = d.propriedades || [];
  const civil = { civil_id: usuario?.civil_id || eu?.id, nome: usuario?.nome || eu?.nome };
  const n = nobrezaDoCivil(civil, { pedidos, propriedades });
  const minhaCasa = casaFundadaPor(civil, d.clas || []);
  const taxa = PEDIDO_CASA_POR_ID.nobreza;
  const septims = moeda;

  const enviar = async () => {
    setErro('');
    setOcupado(true);
    try {
      await pedirNobreza(usuario, { motivo, propriedades });
      await aoSalvar();
      setPedindo(false);
      setMotivo('');
      setSalvo(true);
      clearTimeout(relogio.current);
      relogio.current = setTimeout(() => setSalvo(false), 4000);
    } catch (ex) {
      setErro(ex.message || 'Não foi possível enviar o pedido agora.');
    } finally {
      setOcupado(false);
    }
  };

  const selo = n.nobre
    ? <Selo tom="ok" ponto>Título concedido</Selo>
    : n.pendente
      ? <Selo tom="warn" ponto>Na mesa da Corte</Selo>
      : n.negado
        ? <Selo tom="perigo" ponto>Indeferido</Selo>
        : <Selo tom="off" ponto>{septims(taxa.custo)}</Selo>;

  return (
    <Painel titulo="Título de nobreza" acoes={selo}>
      {salvo && (
        <div className="aviso-ok">
          <Icone nome="selo" tam={15} /> Pedido enviado à Corte. A resposta chega no Quadro de Avisos.
        </div>
      )}

      <p className="painel-nota">
        Fundar uma casa nobre começa por aqui. O título é pedido à Corte de Riften e custa{' '}
        <strong>{septims(taxa.custo)}</strong>. {taxa.exige}
      </p>

      {n.nobre ? (
        <>
          <div className="perfil-linha destaque">
            <Icone nome="coroa" tam={15} cor="var(--gold)" />
            <span style={{ fontSize: 15 }}>A Corte reconheceu sua nobreza</span>
            <Selo tom="ok">{data(n.pedido?.avaliado_em)}</Selo>
          </div>
          {n.parecer && (
            <p className="perfil-nota-corte" style={{ marginTop: 8 }}>
              <strong>Parecer da Corte:</strong> {n.parecer}
            </p>
          )}
          <p className="painel-nota" style={{ marginBottom: 0, marginTop: 10 }}>
            {minhaCasa
              ? <>Sua casa é a <strong>Casa {minhaCasa.nome}</strong> — administre-a pela aba Dinastia.</>
              : <>Use a aba <strong>Dinastia</strong> para fundar a sua casa: nome, lema, brasão e a
                 propriedade que será a sede principal.</>}
          </p>
        </>
      ) : n.pendente ? (
        <p className="painel-nota" style={{ marginBottom: 0 }}>
          Seu pedido está na mesa da Corte. A resposta chega no Quadro de Avisos.
        </p>
      ) : (
        <>
          {n.negado && n.parecer && (
            <p className="perfil-nota-corte" style={{ marginTop: 0, marginBottom: 10 }}>
              <strong>Parecer da Corte:</strong> {n.parecer}
            </p>
          )}

          <div className="chip-lista" style={{ marginBottom: 10 }}>
            {n.propriedades.length === 0
              ? <Selo tom="perigo">Nenhuma propriedade em seu nome</Selo>
              : n.propriedades.map((p) => (
                  <Selo key={p.id} tom="gold">{p.nome} · {p.tipo}</Selo>
                ))}
          </div>

          {!n.temPropriedade ? (
            <p className="painel-nota" style={{ marginBottom: 0 }}>
              Registre uma propriedade em seu nome junto à Corte e o pedido se abre aqui.
            </p>
          ) : !pedindo ? (
            <button className="btn primario" onClick={() => setPedindo(true)}>
              <Icone nome="coroa" tam={14} /> Pedir título de nobreza ({septims(taxa.custo)})
            </button>
          ) : (
            <div style={{ marginTop: 4 }}>
              <AreaTexto
                rotulo="Por que a Corte deve enobrecer você"
                valor={motivo}
                aoMudar={setMotivo}
                placeholder="Serviços prestados ao Hold, o que administra, o que pretende com a casa…"
                maxLength={400}
              />
              {erro && <div className="login-erro">{erro}</div>}
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <button className="btn fantasma" onClick={() => { setPedindo(false); setErro(''); }}>
                  Cancelar
                </button>
                <button className="btn primario" disabled={ocupado} onClick={enviar}>
                  {ocupado ? 'Enviando…' : `Enviar à Corte — ${septims(taxa.custo)}`}
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </Painel>
  );
}

function PainelCidadania({ usuario, eu, aoSalvar }) {
  const c = cidadaniaDe(eu);
  const [pedindo, setPedindo] = useState(false);
  const [motivo, setMotivo] = useState('');
  const [erro, setErro] = useState('');
  const [salvo, setSalvo] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const relogio = useRef(null);
  useEffect(() => () => clearTimeout(relogio.current), []);

  const enviar = async () => {
    setErro('');
    setOcupado(true);
    try {
      await pedirIsencaoCidadania(usuario, motivo);
      await aoSalvar();
      setPedindo(false);
      setMotivo('');
      setSalvo(true);
      clearTimeout(relogio.current);
      relogio.current = setTimeout(() => setSalvo(false), 4000);
    } catch (ex) {
      setErro(ex.message || 'Não foi possível enviar o pedido agora.');
    } finally {
      setOcupado(false);
    }
  };

  return (
    <Painel
      titulo="Minha cidadania"
      acoes={c.transferido
        ? <Selo tom={STATUS_ISENCAO_TOM[c.isencao]} ponto>
            {c.isencao === SEM_ISENCAO ? 'Sem isenção pedida' : `Isenção ${c.isencao.toLowerCase()}`}
          </Selo>
        : <Selo tom="ok" ponto>Natural de Riften</Selo>}
    >
      {salvo && (
        <div className="aviso-ok">
          <Icone nome="selo" tam={15} /> Pedido enviado. A Corte responde pelo Quadro de Avisos.
        </div>
      )}

      {!c.transferido ? (
        <p className="painel-nota" style={{ marginBottom: 0 }}>
          Riften é a sua cidade natal — não há cidadania anterior a desfazer, e nada a pedir
          aqui. Se isso estiver errado na sua ficha, fale com a Corte.
        </p>
      ) : (
        <>
          <div className="grade g3">
            <Dado rotulo="Origem" valor="Transferência de cidadania" />
            <Dado rotulo="Cidade anterior" valor={c.cidade || '—'} />
            <Dado rotulo="Isenção">
              <Selo tom={STATUS_ISENCAO_TOM[c.isencao]} ponto>{c.isencao}</Selo>
            </Dado>
          </div>

          {c.motivo && (
            <p className="painel-nota" style={{ marginTop: 10 }}>
              <strong>Sua justificativa:</strong> “{c.motivo}”
            </p>
          )}
          {c.parecer && (
            <p className="perfil-nota-corte" style={{ marginTop: 8 }}>
              <strong>Parecer da Corte:</strong> {c.parecer}
            </p>
          )}

          {c.pendente && (
            <p className="painel-nota" style={{ marginBottom: 0 }}>
              Seu pedido está na mesa da Corte. A resposta chega no Quadro de Avisos.
            </p>
          )}
          {c.concedida && (
            <p className="painel-nota" style={{ marginBottom: 0 }}>
              O vínculo com {c.cidade || 'a cidade anterior'} está desfeito: a sua cidadania é
              de Riften.
            </p>
          )}

          {c.podePedir && !pedindo && (
            <div style={{ marginTop: 12 }}>
              <p className="painel-nota">{REGRA_ISENCAO}</p>
              <button className="btn primario" onClick={() => setPedindo(true)}>
                <Icone nome="pergaminho" tam={14} /> Pedir isenção de cidadania
              </button>
            </div>
          )}

          {pedindo && (
            <div style={{ marginTop: 12 }}>
              <AreaTexto rotulo="Por que você precisa da isenção" valor={motivo} aoMudar={setMotivo}
                         placeholder="Dívida, juramento, serviço prestado à outra corte, exílio…" />
              {erro && <div className="login-erro" style={{ marginTop: 10 }}>{erro}</div>}
              <footer className="ficha-acoes">
                <button className="btn fantasma" onClick={() => { setPedindo(false); setErro(''); }}>
                  Cancelar
                </button>
                <button className="btn primario" disabled={ocupado || !motivo.trim()} onClick={enviar}>
                  {ocupado ? 'Enviando…' : 'Enviar pedido à Corte'}
                </button>
              </footer>
            </div>
          )}
        </>
      )}
    </Painel>
  );
}

/* ============================================================
   MINHAS HABILIDADES
   Ninguém é obrigado a preencher. Quem preenche é porque quer
   concorrer a alguma coisa — um recrutamento do Quartel, um serviço
   de escolta, um contrato que peça braço treinado —, e então a
   inscrição no edital passa a valer sozinha, sem redigitar nada.
   Quem tem ficha militar segue com o que o Quartel aferiu: contra a
   aferição não adianta declarar.
   ============================================================ */
function PainelHabilidades({ usuario, eu, militar, aoSalvar }) {
  const [rascunho, setRascunho] = useState(null);
  const [salvo, setSalvo] = useState(false);
  const [erro, setErro] = useState('');
  const relogio = useRef(null);
  useEffect(() => () => clearTimeout(relogio.current), []);

  const declaradas = eu.pericias || {};
  const aferidas = militar?.pericias || {};
  const editando = rascunho !== null;
  const atual = editando ? rascunho : declaradas;

  // O que vale de fato: o aferido por cima do declarado.
  const valendo = { ...declaradas };
  for (const [k, v] of Object.entries(aferidas)) if (v && v !== 'N/A') valendo[k] = v;
  const preenchidas = Object.entries(valendo).filter(([, v]) => v && v !== 'N/A');

  const salvar = async () => {
    setErro('');
    try {
      await salvarPericiasCidadao(usuario, rascunho);
      await aoSalvar();
      setRascunho(null);
      setSalvo(true);
      clearTimeout(relogio.current);
      relogio.current = setTimeout(() => setSalvo(false), 3500);
    } catch (ex) { setErro(ex.message || 'Não foi possível salvar agora.'); }
  };

  return (
    <Painel
      titulo="Minhas habilidades"
      acoes={editando
        ? <Selo tom="warn" ponto>Editando</Selo>
        : (
          <>
            <Selo tom={preenchidas.length ? 'ok' : 'off'}>
              {preenchidas.length ? `${preenchidas.length} registrada${preenchidas.length === 1 ? '' : 's'}` : 'nenhuma'}
            </Selo>
            <button className="btn pq" onClick={() => setRascunho({ ...declaradas })}>
              <Icone nome="lapis" tam={13} /> {preenchidas.length ? 'Editar' : 'Preencher'}
            </button>
          </>
        )}
    >
      <p className="painel-nota">
        Preencher é opcional. O que estiver aqui é o que vai junto quando você se inscreve
        num <strong>edital</strong> — um recrutamento do Quartel, um serviço de escolta, um
        contrato que peça braço treinado. Sem isso, os editais que exigem habilidade ficam
        fechados para você.
        {militar && ' Você tem ficha militar: onde o Quartel aferiu, é a aferição dele que vale.'}
      </p>

      {salvo && (
        <div className="aviso-ok">
          <Icone nome="selo" tam={15} /> Habilidades salvas. Já valem nos editais.
        </div>
      )}
      {erro && <div className="login-erro" style={{ marginBottom: 12 }}>{erro}</div>}

      {editando ? (
        <>
          <div className="grade g2">
            {GRUPOS_PERICIA.map((grp) => (
              <div className="grupo-pericia" key={grp.id}>
                <h4>{grp.nome}</h4>
                {grp.pericias.map((p) => {
                  const travada = aferidas[p] && aferidas[p] !== 'N/A';
                  return (
                    <div className="pericia-linha" key={p}>
                      <span className="nm">{p}</span>
                      <Pips nivel={travada ? aferidas[p] : atual[p]} />
                      {travada ? (
                        <span className="lv" title="Aferida pelo Quartel">{aferidas[p]} ⚔</span>
                      ) : (
                        <select className="mini-select largo" value={atual[p] || 'N/A'}
                                onChange={(e) => setRascunho({ ...atual, [p]: e.target.value })}>
                          {NIVEIS.map((n) => <option key={n} value={n}>{n}</option>)}
                        </select>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
          <footer className="ficha-acoes">
            <button className="btn fantasma" onClick={() => { setRascunho(null); setErro(''); }}>Cancelar</button>
            <button className="btn primario" onClick={salvar}>Salvar habilidades</button>
          </footer>
        </>
      ) : preenchidas.length === 0 ? (
        <Vazio simb="⚔">
          Nenhuma habilidade registrada. Preencha se pretende concorrer a recrutamentos
          ou oferecer serviços que peçam habilidade.
        </Vazio>
      ) : (
        <div className="ed-pericias">
          {preenchidas
            .sort((a, b) => (NIVEL_VALOR[b[1]] || 0) - (NIVEL_VALOR[a[1]] || 0))
            .map(([nome, nivel]) => (
              <span className="ed-pericia" key={nome}>
                {nome} <Pips nivel={nivel} />
                <i>{aferidas[nome] ? 'aferida' : nivel}</i>
              </span>
            ))}
        </div>
      )}
    </Painel>
  );
}

function Dado({ rotulo, valor, children }) {
  return (
    <div className="dado">
      <span className="dado-rot">{rotulo}</span>
      <span className="dado-val">{children || valor || '—'}</span>
    </div>
  );
}

/* ============================================================
   MILÍCIA DE RIFTEN — a porta do morador
   ============================================================
   Quem quiser lutar pelo Hold se inscreve aqui. Estar na lista
   não é estar em armas: só marcha quem for convocado, e enquanto
   a campanha durar não se sai da milícia por conta própria.
   ============================================================ */
function PainelMilicia({ usuario, dados: d }) {
  const [erro, setErro] = React.useState('');
  const [ocupado, setOcupado] = React.useState(false);
  const [nota, setNota] = React.useState('');
  const [abrindo, setAbrindo] = React.useState(false);

  const inscricao = naMilicia(usuario, d.milicia || []);
  // Dispensado é como não estar na lista: o morador pode se oferecer
  // outra vez, e a tela não pode prendê-lo num "sair" que não sai.
  const minha = inscricao && inscricao.situacao !== 'Dispensado' ? inscricao : null;
  const campanha = campanhaAberta(d.campanhas || []);
  const convocado = minha?.situacao === 'Convocado';

  const agir = async (fn) => {
    setOcupado(true);
    setErro('');
    try {
      await fn();
      setAbrindo(false);
      setNota('');
    } catch (e) {
      setErro(e.message || 'Não consegui concluir agora.');
    } finally {
      await d.recarregar().catch(() => {});
      setOcupado(false);
    }
  };

  return (
    <Painel
      titulo="Milícia de Riften"
      acoes={
        minha ? (
          <button className="btn pq perigo" disabled={ocupado || convocado}
                  title={convocado ? 'Você está convocado para uma campanha' : 'Sair da lista'}
                  onClick={() => agir(() => sairDaMilicia(usuario))}>
            Sair da milícia
          </button>
        ) : (
          <button className="btn primario pq" disabled={ocupado} onClick={() => setAbrindo(true)}>
            <Icone nome="estandarte" tam={14} /> Quero me alistar
          </button>
        )
      }
    >
      {erro && <div className="login-erro" style={{ marginBottom: 12 }}>{erro}</div>}

      <p className="painel-nota">
        A milícia é a força temporária do Hold: moradores que se oferecem para as campanhas
        militares e são chamados quando há necessidade. Enquanto ninguém convoca, você segue
        na sua vida — só o nome fica na lista.
      </p>

      {minha ? (
        <>
          <div className="perfil-linha destaque">
            <span>Você está na lista da milícia</span>
            <Selo tom={convocado ? 'gold' : 'ok'} ponto>{minha.situacao || 'Disponível'}</Selo>
          </div>
          {convocado && (
            <div className="perfil-linha">
              <span>
                Convocado para <strong>{minha.campanha_nome || 'uma campanha'}</strong>
                {minha.convocado_em ? ` desde ${dataBR(minha.convocado_em)}` : ''}
                {campanha?.soldo ? ` · soldo de campanha ${soldoEmSeptims(campanha.soldo)}` : ''}
              </span>
            </div>
          )}
          {!convocado && campanha && (
            <p className="perfil-aviso">
              Há uma campanha aberta — <strong>{campanha.nome}</strong>. Se o Lorde Comandante
              precisar de você, seu nome será chamado.
            </p>
          )}
          {minha.notas && <div className="perfil-linha"><span>{minha.notas}</span></div>}
        </>
      ) : abrindo ? (
        <>
          <AreaTexto
            rotulo="Com o que você pode ajudar?"
            valor={nota}
            aoMudar={setNota}
            rows={2}
            placeholder="Sabe usar arco, tem cavalo, conhece as trilhas do Rift…"
          />
          <footer className="ficha-acoes">
            <button className="btn fantasma" onClick={() => { setAbrindo(false); setErro(''); }}>Cancelar</button>
            <button className="btn primario" disabled={ocupado}
                    onClick={() => agir(() => alistarNaMilicia(usuario, { notas: nota }))}>
              {ocupado ? 'Alistando…' : 'Alistar-me na milícia'}
            </button>
          </footer>
        </>
      ) : (
        <Vazio simb="⚑">
          {inscricao
            ? 'Você foi dispensado da milícia. Pode se oferecer de novo quando quiser.'
            : `Você não está na milícia. Alistar-se não obriga a nada agora — é dizer ao Hold
               que, se a campanha vier, pode contar com você.`}
        </Vazio>
      )}
    </Painel>
  );
}
