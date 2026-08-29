import React from 'react';
import { montarPerfil, papeisDe, tratamentoSenhorio } from '../lib/perfil.js';
import {
  recursoDaLicenca, TIPO_LICENCA_POR_ID, TITULO_NOBREZA_TOM, SEM_ISENCAO, STATUS_ISENCAO_TOM,
  STATUS_CIVIL_TOM, STATUS_LICENCA_TOM, STATUS_PRISAO_TOM,
  NIVEL_VALOR, TODAS_PERICIAS, rotuloHold,
} from '../lib/constants.js';
import { casaDoVilarejo } from '../lib/nobreza.js';
import { cidadaniaDe } from '../lib/cidadania.js';
import { cargoPorId } from '../lib/corte.js';
import { SECAO_POR_ID, septims } from '../data/codigo.js';
import { lerCatalogacao, totalItens } from '../data/itens.js';
import { Catalogo } from './Catalogo.jsx';
import { Modal, Selo, Icone, Pips } from './ui.jsx';

const MAX_PERICIA = TODAS_PERICIAS.length * 5;
const aptidao = (g) => {
  const p = g?.pericias || {};
  return Math.round(
    (TODAS_PERICIAS.reduce((s, k) => s + (NIVEL_VALOR[p[k]] || 0), 0) / MAX_PERICIA) * 100,
  );
};

/**
 * Perfil completo de uma pessoa: um lugar só com tudo que os
 * registros do Hold têm sobre ela.
 */
export default function FichaCidadao({ civil, dados, aoFechar, aoEditar }) {
  const perfil = montarPerfil(civil, dados);
  if (!perfil) return null;
  const papeis = papeisDe(perfil);

  return (
    <Modal
      titulo={`Perfil — ${civil.nome}`}
      largo
      aoFechar={aoFechar}
      rodape={
        <>
          <span style={{ marginRight: 'auto', color: 'var(--txt-3)', fontSize: 12 }}>
            {perfil.vinculos} registro{perfil.vinculos === 1 ? '' : 's'} do Hold citam esta pessoa
          </span>
          <button className="btn fantasma" onClick={aoFechar}>Fechar</button>
          {aoEditar && (
            <button className="btn primario" onClick={() => aoEditar(civil)}>
              <Icone nome="lapis" tam={14} /> Editar cadastro
            </button>
          )}
        </>
      }
    >
      {/* -------- Identidade -------- */}
      <header className="perfil-topo">
        <span className="perfil-avatar"><Icone nome="pessoa" tam={30} cor="var(--gold)" /></span>
        <div className="perfil-id">
          <h3>{civil.nome}</h3>
          <div className="chip-lista">
            <Selo tom="ok"><span className="mono">ID {civil.id_jogo}</span></Selo>
            {civil.raca && <Selo>{civil.raca}</Selo>}
            <Selo tom={STATUS_CIVIL_TOM[civil.status]} ponto>{civil.status}</Selo>
          </div>
          {papeis.length > 0 && (
            <div className="chip-lista" style={{ marginTop: 6 }}>
              {papeis.map((p, i) => <Selo key={i} tom={p.tom}>{p.texto}</Selo>)}
            </div>
          )}
        </div>
      </header>

      {civil.notas && <p className="perfil-fala">“{civil.notas}”</p>}
      {civil.observacao_corte && (
        <p className="perfil-nota-corte"><strong>Corte:</strong> {civil.observacao_corte}</p>
      )}

      <div className="perfil-blocos">
        {/* -------- Corte -------- */}
        <Bloco icone="coroa" titulo="Cargo na Corte" vazio={!perfil.cargo} textoVazio="Não ocupa cargo.">
          {perfil.cargo && (
            <div className="perfil-linha destaque">
              <span>
                {cargoPorId(perfil.cargo.cargo_id || perfil.cargo.id, dados.corte || [])?.nome || 'Cargo'}
              </span>
              {perfil.cargo.desde && <span className="selo">desde {perfil.cargo.desde}</span>}
            </div>
          )}
        </Bloco>

        {/* -------- Cidadania -------- */}
        {(() => {
          const c = cidadaniaDe(civil);
          return (
            <Bloco icone="mapa" titulo="Cidadania">
              <div className="perfil-linha destaque">
                <span>{c.transferido ? 'Transferência de cidadania' : 'Natural de Riften'}</span>
                {c.transferido
                  ? <Selo tom="roxo">{c.cidade || 'outra cidade'}</Selo>
                  : <Selo tom="ok" ponto>Do Hold desde sempre</Selo>}
              </div>
              {c.transferido && (
                <div className="perfil-linha">
                  <span>Isenção</span>
                  <Selo tom={STATUS_ISENCAO_TOM[c.isencao]} ponto>{c.isencao}</Selo>
                </div>
              )}
              {c.transferido && c.motivo && (
                <p className="perfil-fala" style={{ margin: '6px 0 0' }}>“{c.motivo}”</p>
              )}
              {c.parecer && (
                <p className="perfil-nota-corte" style={{ margin: '6px 0 0' }}>
                  <strong>Parecer:</strong> {c.parecer}
                </p>
              )}
            </Bloco>
          );
        })()}

        {/* -------- Nobreza -------- */}
        <Bloco icone="estandarte" titulo="Nobreza">
          <div className="perfil-linha destaque">
            <span>{perfil.tituloNobreza}</span>
            <Selo tom={TITULO_NOBREZA_TOM[perfil.tituloNobreza]} ponto>
              {perfil.nobreza ? 'Nobreza de Riften' : 'Fora da Nobreza'}
            </Selo>
          </div>
          {perfil.casas.length === 0 ? (
            perfil.servico ? (
              <div className="perfil-linha">
                <span className="cor-ponto" style={{ background: perfil.servico.cor }} />
                <span>Serve à Casa {perfil.servico.casa}</span>
                <Selo>{perfil.servico.funcao || 'Servo'}</Selo>
              </div>
            ) : (
              <p className="perfil-vazio" style={{ padding: 0, marginTop: 6 }}>
                Não pertence a nenhuma dinastia — por isso, Plebeu.
              </p>
            )
          ) : perfil.casas.map(({ cla, lidera, lideranca }) => (
            <div className="perfil-linha" key={cla.id}>
              <span className="cor-ponto" style={{ background: cla.cor || '#7c6bb0' }} />
              <span>Casa {cla.nome}</span>
              {lidera ? <Selo tom="gold">{lideranca || 'Patriarca'}</Selo> : <Selo>Membro</Selo>}
            </div>
          ))}
        </Bloco>

        {/* -------- Senhorio -------- */}
        {perfil.senhorioDe.length > 0 && (
          <Bloco icone="vila" titulo={tratamentoSenhorio(perfil)}>
            {perfil.senhorioDe.map((a) => {
              const casa = casaDoVilarejo(a, dados.clas || []);
              return (
                <div className="perfil-linha destaque" key={a.id}>
                  <span>{a.nome}</span>
                  <Selo tom="gold">{a.tipo}</Selo>
                  {casa && (
                    <Selo tom="roxo">
                      <i className="cor-ponto" style={{ background: casa.cor }} /> Casa {casa.nome}
                    </Selo>
                  )}
                </div>
              );
            })}
          </Bloco>
        )}

        {/* -------- Militar -------- */}
        <Bloco icone="espada" titulo="Ficha militar" vazio={!perfil.militar}
               textoVazio="Não consta no Exército de Riften.">
          {perfil.militar && (
            <>
              <div className="perfil-linha destaque">
                <span>{perfil.militar.patente}</span>
                <Selo tom={perfil.militar.status === 'Operante' ? 'ok' : 'off'} ponto>
                  {perfil.militar.status}
                </Selo>
              </div>
              <div className="perfil-linha"><span>{perfil.militar.afiliacao}</span></div>
              <div className="perfil-linha"><span>{perfil.militar.divisao}</span></div>
              <div className="perfil-barra">
                <span>Aptidão</span>
                <div className="barra"><div style={{ width: `${aptidao(perfil.militar)}%` }} /></div>
                <span className="mono">{aptidao(perfil.militar)}%</span>
              </div>
            </>
          )}
        </Bloco>

        {/* -------- Habilidades declaradas --------
            O que a pessoa registrou por conta própria na Cidade de Riften.
            É o que a habilita nos editais que pedem habilidade. */}
        {(() => {
          const declaradas = Object.entries(civil.pericias || {})
            .filter(([, v]) => v && v !== 'N/A')
            .sort((a, b) => (NIVEL_VALOR[b[1]] || 0) - (NIVEL_VALOR[a[1]] || 0));
          return (
            <Bloco icone="escudo" titulo="Habilidades declaradas" vazio={declaradas.length === 0}
                   textoVazio="Nada declarado por ele na ficha.">
              {declaradas.length > 0 && (
                <div className="ed-pericias">
                  {declaradas.map(([nome, nivel]) => (
                    <span className="ed-pericia" key={nome}>
                      {nome} <Pips nivel={nivel} /><i>{nivel}</i>
                    </span>
                  ))}
                </div>
              )}
            </Bloco>
          );
        })()}

        {/* -------- Ofício -------- */}
        <Bloco icone="martelo" titulo="Ofício" vazio={!perfil.trabalho && !civil.profissao}
               textoVazio="Nenhum ofício registrado.">
          {(perfil.trabalho || civil.profissao) && (
            <>
              <div className="perfil-linha destaque">
                <span>{perfil.trabalho?.profissao || civil.profissao}</span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
                  <Pips nivel={perfil.trabalho?.nivel || civil.nivel} />
                  <span style={{ fontSize: 11.5, color: 'var(--txt-3)' }}>
                    {perfil.trabalho?.nivel || civil.nivel}
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
                  Declarado no Registro Civil, mas ainda sem ficha de trabalhador.
                </p>
              )}
            </>
          )}
        </Bloco>

        {/* -------- Propriedades -------- */}
        <Bloco icone="casa" titulo="Propriedades" vazio={perfil.imoveis.length === 0}
               textoVazio="Não é dono de nenhuma propriedade." largo>
          {perfil.imoveis.map((p) => {
            const cat = lerCatalogacao(p.catalogacao);
            return (
              <div className="perfil-imovel" key={p.id}>
                <div className="perfil-linha destaque">
                  <span>{p.nome}</span>
                  <Selo>{p.tipo}</Selo>
                  {p.local && <Selo>{p.local}</Selo>}
                  {p.organizacao && <Selo tom="roxo">{p.organizacao}</Selo>}
                  {cat.length > 0 && <Selo tom="gold">{totalItens(cat)} peças</Selo>}
                </div>
                {cat.length > 0 && <Catalogo itens={cat} limite={6} />}
              </div>
            );
          })}
        </Bloco>

        {/* -------- Ficha criminal -------- */}
        <Bloco icone="grades" titulo="Ficha criminal" vazio={perfil.prisoes.length === 0}
               textoVazio="Nada consta." largo>
          {[...perfil.prisoes]
            .sort((a, b) => new Date(b.inicio) - new Date(a.inicio))
            .map((x) => (
              <div className="perfil-imovel" key={x.id}>
                <div className="perfil-linha destaque">
                  <span>{x.crime}</span>
                  {x.artigo && <Selo>{x.artigo}</Selo>}
                  <Selo tom="gold">{x.minutos} min</Selo>
                  <Selo tom={STATUS_PRISAO_TOM[x.status]} ponto>{x.status}</Selo>
                </div>
                <div className="perfil-linha" style={{ fontSize: 11.5, color: 'var(--txt-3)' }}>
                  <span>
                    {new Date(x.inicio).toLocaleString('pt-BR', {
                      day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })}
                    {x.secao && <> · {SECAO_POR_ID[x.secao]?.nome}</>}
                    {x.origem && <> · procedência {rotuloHold(x.origem)}</>}
                    {x.registrado_por && <> · registrado por {x.registrado_por}</>}
                  </span>
                </div>
                {x.multa != null && <div className="perfil-linha"><span>Multa: {septims(x.multa)}</span></div>}
                {x.motivo && <p className="perfil-fala" style={{ margin: 0 }}>“{x.motivo}”</p>}
              </div>
            ))}
        </Bloco>

        {/* -------- Licenças -------- */}
        <Bloco icone="pergaminho" titulo="Licenças" vazio={perfil.licencas.length === 0}
               textoVazio="Nenhuma licença emitida." largo>
          {perfil.licencas.map((l) => {
            const tipo = TIPO_LICENCA_POR_ID[l.tipo];
            return (
              <div className="perfil-imovel" key={l.id}>
                <div className="perfil-linha destaque">
                  <span>{tipo?.nome || 'Licença'}</span>
                  <span className="selo mono">{l.numero}</span>
                  <Selo tom={STATUS_LICENCA_TOM[l.status]} ponto>{l.status}</Selo>
                  {l.escolta && <Selo tom="roxo"><Icone nome="escudo" tam={11} /> Escolta</Selo>}
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
          })}
        </Bloco>
      </div>
    </Modal>
  );
}

function Bloco({ icone, titulo, children, vazio = false, textoVazio = '', largo = false }) {
  return (
    <section className={`perfil-bloco ${largo ? 'largo' : ''}`}>
      <h4><Icone nome={icone} tam={14} cor="var(--gold)" /> {titulo}</h4>
      {vazio ? <p className="perfil-vazio">{textoVazio}</p> : <div className="perfil-corpo">{children}</div>}
    </section>
  );
}
