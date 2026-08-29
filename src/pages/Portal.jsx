import React from 'react';
import { Brasao, Icone } from '../components/ui.jsx';

/**
 * Primeira tela do sistema. Três portas:
 *   · Corte de Riften  — administração, entra com credencial da Corte
 *   · Cidade de Riften — o morador se registra, e depois entra com ID + senha
 *   · Quartel General  — mesma senha do morador, mas só para quem está alistado
 */
export default function Portal({ aoEscolher }) {
  return (
    <div className="portal">
      <header className="portal-topo">
        <Brasao tamanho={62} />
        <h1>Hold de Riften</h1>
        <p className="sub">Riften · Ivarstead · Shor's Stone</p>
      </header>

      <div className="portal-opcoes tres">
        <button className="portal-card" onClick={() => aoEscolher('corte')}>
          <span className="portal-icone corte"><Icone nome="coroa" tam={30} cor="var(--gold-2)" /></span>
          <span className="portal-nome">Corte de Riften</span>
          <span className="portal-desc">
            Administração do Hold. Cargos da Corte, casas nobres, licenças, comércios,
            trabalhadores e o registro civil.
          </span>
          <span className="portal-rodape">
            <Icone nome="chave" tam={13} /> Credencial da Corte
          </span>
        </button>

        <button className="portal-card" onClick={() => aoEscolher('cidade')}>
          <span className="portal-icone civil"><Icone nome="pessoa" tam={30} cor="var(--purple)" /></span>
          <span className="portal-nome">Cidade de Riften</span>
          <span className="portal-desc">
            Registro Civil e documentações. Cadastre-se aqui — e, depois de aprovado,
            entre com seu ID e sua senha para ver e cuidar da sua ficha.
          </span>
          <span className="portal-rodape aberto">
            <Icone nome="pergaminho" tam={13} /> Morador do Hold
          </span>
        </button>

        <button className="portal-card" onClick={() => aoEscolher('quartel')}>
          <span className="portal-icone quartel"><Icone nome="espada" tam={30} cor="var(--autumn)" /></span>
          <span className="portal-nome">Quartel General</span>
          <span className="portal-desc">
            Para quem está alistado. Sua ficha militar e suas habilidades, o registro
            de prisões e a logística do almoxarifado.
          </span>
          <span className="portal-rodape">
            <Icone nome="escudo" tam={13} /> Só para alistados
          </span>
        </button>
      </div>

      <p className="portal-nota">
        Morador e soldado usam a <strong>mesma senha</strong>: a que a Corte gera ao aprovar
        o Registro Civil e entrega em mãos. O login é o seu <strong>ID do jogo</strong>.
      </p>
    </div>
  );
}
