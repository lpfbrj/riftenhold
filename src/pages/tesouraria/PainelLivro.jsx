import React, { useMemo, useState } from 'react';
import {
  Painel, Selo, Modal, AreaTexto, Selecao, Icone, Vazio, Campo,
} from '../../components/ui.jsx';
import { ORIGENS_COFRE, ORIGENS_SAIDA, TIPOS_LANCAMENTO } from '../../lib/constants.js';
import { extrato, origemDe, dataHora, septims } from '../../lib/tesouraria.js';
import { registrarSaida } from '../../lib/db.js';

const TOM_TIPO = { entrada: 'ok', saida: 'perigo', ajuste: 'roxo' };
const SINAL = { entrada: '+', saida: '−', ajuste: '=' };

/**
 * O extrato do cofre, linha a linha.
 *
 * É aqui que a promessa do sistema se cumpre: nada mexe no saldo sem
 * aparecer nesta lista, com data, autor e a razão escrita — inclusive
 * a declaração de saldo da Corte.
 */
export default function PainelLivro({ dados: d, cofre = [], usuario }) {
  const [fTipo, setFTipo] = useState('');
  const [fOrigem, setFOrigem] = useState('');
  const [busca, setBusca] = useState('');
  const [saida, setSaida] = useState(null);
  const [erro, setErro] = useState('');

  const autor = usuario?.nome || usuario?.cargo || 'Corte';

  const linhas = useMemo(() => {
    const t = busca.trim().toLowerCase();
    return extrato(cofre).filter((l) =>
      (!fTipo || l.tipo === fTipo) &&
      (!fOrigem || l.origem === fOrigem) &&
      (!t || String(l.descricao || '').toLowerCase().includes(t) ||
             String(l.autor || '').toLowerCase().includes(t)));
  }, [cofre, fTipo, fOrigem, busca]);

  return (
    <>
      <div style={{ height: 18 }} />

      {erro && <div className="login-erro" style={{ marginBottom: 14 }}>{erro}</div>}

      <div className="barra-filtros">
        <div className="campo busca">
          <label>Buscar</label>
          <input value={busca} onChange={(e) => setBusca(e.target.value)}
                 placeholder="Descrição ou autor do lançamento…" />
        </div>
        <Selecao rotulo="Tipo" valor={fTipo} aoMudar={setFTipo} vazioLabel="Todos"
                 opcoes={TIPOS_LANCAMENTO.map((t) => ({
                   valor: t,
                   rotulo: t === 'entrada' ? 'Entradas' : t === 'saida' ? 'Saídas' : 'Ajustes',
                 }))} />
        <Selecao rotulo="Origem" valor={fOrigem} aoMudar={setFOrigem} vazioLabel="Todas"
                 opcoes={ORIGENS_COFRE.map((o) => ({ valor: o.id, rotulo: o.nome }))} />
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'flex-end' }}>
          <button className="btn primario" onClick={() => setSaida({ valor: '', origem: 'retirada', descricao: '' })}>
            <Icone nome="saidaItem" tam={15} /> Registrar saída
          </button>
        </div>
      </div>

      {linhas.length === 0 ? (
        <Painel>
          <Vazio simb="◈">
            {cofre.length
              ? 'Nenhum lançamento corresponde ao filtro.'
              : 'O livro-caixa está em branco. Comece declarando o saldo do cofre.'}
          </Vazio>
        </Painel>
      ) : (
        <div className="tabela-wrap">
          <table>
            <thead>
              <tr>
                <th>Quando</th><th>Tipo</th><th>Origem</th>
                <th>A que se refere</th><th>Registrado por</th><th>Valor</th>
              </tr>
            </thead>
            <tbody>
              {linhas.map((l) => (
                <tr key={l.id}>
                  <td style={{ color: 'var(--txt-2)', fontSize: 12.5 }} className="mono">
                    {dataHora(l.criado_em)}
                  </td>
                  <td><Selo tom={TOM_TIPO[l.tipo] || ''} ponto>
                    {l.tipo === 'entrada' ? 'Entrada' : l.tipo === 'saida' ? 'Saída' : 'Ajuste'}
                  </Selo></td>
                  <td style={{ color: 'var(--txt-2)', fontSize: 12.5 }}>{origemDe(l).nome}</td>
                  <td>
                    <span className="nome-forte">{l.descricao}</span>
                    {l.tipo === 'ajuste' && (
                      <small className="sub-linha">
                        saldo declarado: {septims(l.saldo_declarado)}
                      </small>
                    )}
                  </td>
                  <td style={{ color: 'var(--txt-3)', fontSize: 12 }}>{l.autor || '—'}</td>
                  <td className={`mono valor-${l.tipo}`}>
                    {l.tipo === 'ajuste'
                      ? septims(l.saldo_declarado)
                      : `${SINAL[l.tipo]} ${Number(l.valor || 0).toLocaleString('pt-BR')}`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {saida && (
        <FormSaida
          inicial={saida}
          aoFechar={() => setSaida(null)}
          aoSalvar={async (v) => {
            await registrarSaida(v, autor);
            await d.recarregar();
            setSaida(null);
          }}
        />
      )}
    </>
  );
}

/* ------------------------------------------------------------ */
function FormSaida({ inicial, aoFechar, aoSalvar }) {
  const [v, setV] = useState({ ...inicial });
  const [erro, setErro] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const set = (k) => (x) => setV((s) => ({ ...s, [k]: x }));

  const enviar = async () => {
    if (!Math.round(Number(v.valor) || 0)) { setErro('Diga quanto está saindo do cofre.'); return; }
    if (!String(v.descricao || '').trim()) { setErro('Escreva a que se refere a saída.'); return; }
    setOcupado(true);
    setErro('');
    try { await aoSalvar(v); }
    catch (e) { setErro(e.message || 'Não consegui registrar a saída.'); setOcupado(false); }
  };

  return (
    <Modal
      titulo="Registrar saída do cofre"
      aoFechar={aoFechar}
      rodape={
        <>
          <button className="btn fantasma" onClick={aoFechar}>Cancelar</button>
          <button className="btn primario" disabled={ocupado} onClick={enviar}>
            {ocupado ? 'Registrando…' : 'Registrar saída'}
          </button>
        </>
      }
    >
      {erro && <div className="login-erro" style={{ marginBottom: 14 }}>{erro}</div>}
      <p className="painel-nota">
        Dinheiro que sai do cofre dentro do jogo: retirada para as mãos de alguém da Corte,
        compra de itens, obra, ou a cidadania que o Hold paga por um morador.
      </p>
      <div className="grade g2">
        <Campo rotulo="Valor (Septims)">
          <input type="number" min="0" className="mono" value={v.valor ?? ''}
                 onChange={(e) => set('valor')(e.target.value)} autoFocus />
        </Campo>
        <Selecao rotulo="Destino" valor={v.origem} aoMudar={set('origem')} vazioLabel="—"
                 opcoes={ORIGENS_SAIDA.map((o) => ({ valor: o.id, rotulo: o.nome }))} />
      </div>
      <div style={{ height: 12 }} />
      <AreaTexto rotulo="A que se refere" valor={v.descricao} aoMudar={set('descricao')} rows={3}
                 placeholder="Quem retirou, para quê, o que foi comprado…" />
    </Modal>
  );
}
