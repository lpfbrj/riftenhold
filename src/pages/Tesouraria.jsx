import React, { useMemo, useState } from 'react';
import { useDados } from '../lib/store.jsx';
import { Icone } from '../components/ui.jsx';
import {
  estadoDoCofre, emAberto, declaradas, septims,
} from '../lib/tesouraria.js';
import { soldoDe, campanhaAberta, convocadosDa } from '../lib/forcas.js';
import PainelCofre from './tesouraria/PainelCofre.jsx';
import PainelLivro from './tesouraria/PainelLivro.jsx';
import PainelCobrancas from './tesouraria/PainelCobrancas.jsx';
import PainelFolha from './tesouraria/PainelFolha.jsx';

const ABAS = [
  { id: 'cofre',     nome: 'Cofre',       icone: 'moeda',      sub: 'Saldo e arrecadação' },
  { id: 'livro',     nome: 'Livro-caixa', icone: 'livro',      sub: 'Tudo que entrou e saiu' },
  { id: 'cobrancas', nome: 'Cobranças',   icone: 'balanca',    sub: 'O que o Hold tem a receber' },
  { id: 'folha',     nome: 'Folha',       icone: 'espada',     sub: 'Soldo semanal da tropa' },
];

/**
 * A Tesouraria do Hold.
 *
 * Aqui se concentra o dinheiro: o cofre e o seu livro-caixa, tudo o
 * que o Hold tem a receber, e a folha da tropa. Nenhuma tela escreve
 * um saldo — escreve-se um lançamento, e o saldo é a soma.
 *
 * A plataforma não conversa com o jogo, então o número nunca é
 * verdade em tempo real: é "o último saldo que a Corte declarou,
 * mais o que a plataforma registrou desde então". A tela diz isso na
 * cara, para ninguém confiar num número velho sem perceber.
 */
export default function Tesouraria({ usuario }) {
  const d = useDados();
  const [aba, setAba] = useState('cofre');

  const cofre = d.cofre || [];
  const cobrancas = d.cobrancas || [];
  const precos = d.precos || [];
  const guardas = d.guardas || [];
  const patentes = d.patentes || [];
  const milicia = d.milicia || [];
  const campanhas = d.campanhas || [];

  const estado = useMemo(() => estadoDoCofre(cofre), [cofre]);

  const vencidos = useMemo(() => {
    const daTropa = guardas.filter((g) => g.status !== 'Aposentado' && soldoDe(g, patentes).vencido);
    const daCampanha = convocadosDa(campanhaAberta(campanhas), milicia)
      .filter((m) => soldoDe(m, []).vencido);
    return daTropa.length + daCampanha.length;
  }, [guardas, patentes, milicia, campanhas]);

  const naMesa = declaradas(cobrancas).length;

  const contagem = {
    cofre: Number(estado.saldo).toLocaleString('pt-BR'),
    livro: cofre.length,
    cobrancas: emAberto(cobrancas).length + naMesa,
    folha: vencidos,
  };
  const alerta = { cobrancas: naMesa > 0, folha: vencidos > 0 };

  return (
    <>
      <div className="pg-head">
        <div>
          <h1>Tesouraria do Hold</h1>
          <p>
            O cofre de Riften e tudo que o move: o que entra, o que sai, o que o Hold tem a
            receber e o soldo da tropa. Como a plataforma não fala com o jogo, o saldo é o
            que a Corte declarou mais o que foi registrado desde então.
          </p>
        </div>
      </div>
      <div className="regra" />

      <nav className="abas-forca" aria-label="Seções da Tesouraria">
        {ABAS.map((a) => (
          <button
            key={a.id}
            className={`aba-forca ${aba === a.id ? 'ativa' : ''} ${alerta[a.id] ? 'alerta' : ''}`}
            onClick={() => setAba(a.id)}
          >
            <Icone nome={a.icone} tam={15} cor={aba === a.id ? 'var(--gold)' : 'var(--txt-3)'} />
            <span className="aba-forca-txt">
              <strong>{a.nome}</strong>
              <small>{a.sub}</small>
            </span>
            <span className="aba-forca-num mono">{contagem[a.id]}</span>
          </button>
        ))}
      </nav>

      {aba === 'cofre' && (
        <PainelCofre dados={d} cofre={cofre} cobrancas={cobrancas} precos={precos} usuario={usuario} />
      )}
      {aba === 'livro' && (
        <PainelLivro dados={d} cofre={cofre} usuario={usuario} />
      )}
      {aba === 'cobrancas' && (
        <PainelCobrancas
          dados={d}
          cobrancas={cobrancas}
          civis={d.civis || []}
          propriedades={d.propriedades || []}
          clas={d.clas || []}
          usuario={usuario}
        />
      )}
      {aba === 'folha' && (
        <PainelFolha dados={d} guardas={guardas} patentes={patentes}
                     milicia={milicia} campanhas={campanhas} usuario={usuario} />
      )}
    </>
  );
}

export { septims };
