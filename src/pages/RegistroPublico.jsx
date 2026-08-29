import React, { useState } from 'react';
import { enviarRegistroCivil, idJogoJaUsado } from '../lib/db.js';
import { RACAS, PROFISSOES, NIVEIS, ONDE_ACHAR_ID, ORIGENS, REGRA_ISENCAO } from '../lib/constants.js';
import { CIDADES_DE_ORIGEM, OUTRO_LUGAR, nomeDaCidade } from '../lib/cidadania.js';
import { Brasao, Icone, Texto, AreaTexto, Selecao, Pips } from '../components/ui.jsx';

const VAZIO = {
  nome: '', id_jogo: '', raca: '', profissao: '', nivel: 'Novato', notas: '',
  // Cidadania: nasceu aqui, ou está transferindo de outra cidade.
  origem: 'natal', cidade_anterior_id: '', cidade_anterior: '',
  pede_isencao: false, isencao_motivo: '',
};

export default function RegistroPublico({ aoVoltar }) {
  const [v, setV] = useState({ ...VAZIO });
  const [erro, setErro] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [enviado, setEnviado] = useState(null);
  const set = (k) => (val) => setV((s) => ({ ...s, [k]: val }));

  async function enviar(e) {
    e.preventDefault();
    setErro('');
    setOcupado(true);
    try {
      if (await idJogoJaUsado(v.id_jogo)) {
        throw new Error('Este ID de jogo já consta no Registro Civil. Se foi você, procure a Corte.');
      }
      await enviarRegistroCivil(v);
      setEnviado({ ...v });
    } catch (ex) {
      setErro(ex.message || 'Não consegui enviar o registro. Tente de novo.');
    } finally {
      setOcupado(false);
    }
  }

  if (enviado) {
    return (
      <div className="registro-tela">
        <div className="registro-caixa confirmado">
          <Brasao tamanho={54} />
          <h1>Registro enviado</h1>
          <p className="sub">Aguardando o aval da Corte</p>

          <div className="recibo">
            <div className="linha"><span>Personagem</span><span>{enviado.nome}</span></div>
            <div className="linha"><span>ID do jogo</span><span className="mono">{enviado.id_jogo}</span></div>
            {enviado.raca && <div className="linha"><span>Raça</span><span>{enviado.raca}</span></div>}
            {enviado.profissao && (
              <div className="linha">
                <span>Ofício</span>
                <span>{enviado.profissao} · {enviado.nivel}</span>
              </div>
            )}
            <div className="linha">
              <span>Cidadania</span>
              <span>
                {enviado.origem === 'transferencia'
                  ? `Transferência de ${nomeDaCidade(enviado.cidade_anterior_id, enviado.cidade_anterior) || 'outra cidade'}`
                  : 'Natural de Riften'}
              </span>
            </div>
            {enviado.pede_isencao && (
              <div className="linha">
                <span>Isenção</span>
                <span>Pedida — aguardando a Corte</span>
              </div>
            )}
          </div>

          <p className="registro-aviso">
            Seu pedido entrou na fila do Registro Civil. Assim que a Corte aprovar, você passa
            a constar oficialmente nos arquivos do Hold — e seus dados aparecem sozinhos quando
            for contratado como trabalhador, alistado na guarda ou registrado como proprietário.
          </p>

          <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
            <button className="btn" style={{ flex: 1, justifyContent: 'center' }}
                    onClick={() => { setEnviado(null); setV({ ...VAZIO }); }}>
              Registrar outro personagem
            </button>
            <button className="btn primario" style={{ flex: 1, justifyContent: 'center' }} onClick={aoVoltar}>
              Voltar ao portal
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="registro-tela">
      <div className="registro-caixa">
        <button className="btn pq fantasma voltar" onClick={aoVoltar}>← Portal</button>

        <Brasao tamanho={48} />
        <h1>Registro Civil</h1>
        <p className="sub">Hold de Riften</p>

        <form onSubmit={enviar}>
          {erro && <div className="login-erro">{erro}</div>}

          <Texto
            rotulo="Nome do personagem"
            valor={v.nome}
            aoMudar={set('nome')}
            placeholder="Como é chamado no Hold"
            required
            maxLength={60}
          />

          <div className="campo">
            <label>ID do jogo</label>
            <input
              value={v.id_jogo}
              onChange={(e) => set('id_jogo')(e.target.value)}
              placeholder="Ex.: 1042"
              required
              maxLength={40}
              className="mono"
            />
            <p className="ajuda">
              <Icone nome="livro" tam={13} /> {ONDE_ACHAR_ID}
            </p>
          </div>

          <div className="grade g2">
            <Selecao rotulo="Raça" valor={v.raca} aoMudar={set('raca')} opcoes={RACAS} vazioLabel="Selecione…" />
            <Selecao rotulo="Profissão" valor={v.profissao} aoMudar={set('profissao')} opcoes={PROFISSOES} vazioLabel="Nenhuma" />
          </div>

          <div className="campo">
            <label>Nível da profissão</label>
            <div className="nivel-escolha">
              {NIVEIS.filter((n) => n !== 'N/A').map((n) => (
                <button
                  type="button"
                  key={n}
                  className={`nivel-op ${v.nivel === n ? 'ativo' : ''}`}
                  onClick={() => set('nivel')(n)}
                  disabled={!v.profissao}
                >
                  <Pips nivel={n} />
                  <span>{n}</span>
                </button>
              ))}
            </div>
            {!v.profissao && <p className="ajuda">Escolha uma profissão para definir o nível.</p>}
          </div>

          {/* -------- Cidadania -------- */}
          <div className="campo">
            <label>Sua cidadania</label>
            <div className="origem-escolha">
              {ORIGENS.map((o) => (
                <button
                  type="button"
                  key={o.id}
                  className={`origem-op ${v.origem === o.id ? 'ativo' : ''}`}
                  onClick={() => setV((s) => ({
                    ...s,
                    origem: o.id,
                    // Trocar para natal apaga o que só vale em transferência.
                    ...(o.id === 'natal'
                      ? { cidade_anterior_id: '', cidade_anterior: '', pede_isencao: false, isencao_motivo: '' }
                      : {}),
                  }))}
                >
                  <Icone nome={o.icone} tam={17} cor={v.origem === o.id ? 'var(--gold)' : 'var(--txt-3)'} />
                  <strong>{o.nome}</strong>
                  <span>{o.resumo}</span>
                </button>
              ))}
            </div>
          </div>

          {v.origem === 'transferencia' && (
            <div className="bloco-transferencia">
              <Selecao
                rotulo="Cidade anterior"
                valor={v.cidade_anterior_id}
                aoMudar={(x) => setV((s) => ({ ...s, cidade_anterior_id: x, cidade_anterior: '' }))}
                opcoes={[
                  ...CIDADES_DE_ORIGEM.map((h) => ({ valor: h.id, rotulo: h.nome })),
                  { valor: OUTRO_LUGAR, rotulo: 'Outro lugar de Tamriel' },
                ]}
                vazioLabel="De onde você vem…"
              />
              {v.cidade_anterior_id === OUTRO_LUGAR && (
                <Texto rotulo="Qual lugar" valor={v.cidade_anterior} aoMudar={set('cidade_anterior')}
                       placeholder="Ex.: Cyrodiil, Alto Rochedo…" maxLength={60} />
              )}

              <label className="isencao-op">
                <input type="checkbox" checked={v.pede_isencao}
                       onChange={() => setV((s) => ({ ...s, pede_isencao: !s.pede_isencao }))} />
                <span>
                  <strong>Preciso de isenção para mudar de cidadania</strong>
                  <em>
                    {REGRA_ISENCAO}
                  </em>
                  <em>
                    A isenção desfaz o vínculo com
                    {v.cidade_anterior_id ? ` ${nomeDaCidade(v.cidade_anterior_id, v.cidade_anterior) || 'a cidade anterior'}` : ' a cidade anterior'}
                    {' '}sem pagar a taxa. Quem concede é a Corte de Riften, e ela pode negar.
                  </em>
                </span>
              </label>

              {v.pede_isencao && (
                <AreaTexto
                  rotulo="Por que você precisa da isenção"
                  valor={v.isencao_motivo}
                  aoMudar={set('isencao_motivo')}
                  placeholder="Dívida, juramento, serviço prestado à outra corte, exílio…"
                  maxLength={400}
                />
              )}
            </div>
          )}

          <AreaTexto
            rotulo="Algo que a Corte deva saber (opcional)"
            valor={v.notas}
            aoMudar={set('notas')}
            placeholder="Onde mora, a quem serve, o que faz no Hold…"
            maxLength={400}
          />

          <button className="btn primario" style={{ justifyContent: 'center', marginTop: 4 }}
                  disabled={ocupado || !String(v.nome || '').trim() || !String(v.id_jogo || '').trim()}>
            {ocupado ? 'Enviando…' : 'Enviar para aprovação'}
          </button>
        </form>

        <p className="registro-aviso">
          O registro não entra na lista na hora: a Corte analisa cada pedido antes de
          reconhecê-lo oficialmente.
        </p>
      </div>
    </div>
  );
}
