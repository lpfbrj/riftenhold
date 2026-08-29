import React, { useState } from 'react';
import {
  STATUS_PROPRIEDADE, CATEGORIAS_IMOVEL, CATEGORIA_POR_ID, CATEGORIA_PADRAO,
} from '../lib/constants.js';
import { categoriaDe, avaliacaoDe, estaAVenda, precoDe, septims } from '../lib/imobiliaria.js';
import { lerCatalogacao } from '../data/itens.js';
import { EditorCatalogo } from './Catalogo.jsx';
import { Modal, Texto, AreaTexto, Selecao, Campo, Selo } from './ui.jsx';
import SeletorCivil from './SeletorCivil.jsx';

export const PROPRIEDADE_VAZIA = {
  nome: '', tipo: 'Comércio', local: 'Riften',
  categoria: 'comercio', valor: null,
  organizacao: '', proprietario: '', proprietario_civil_id: '', status: 'Operante',
  catalogacao: [], notas: '',
  // Quem trabalha ali e o que há à venda são do dono, não da Corte:
  // ficam aqui só para não se perderem ao salvar a ficha.
  funcionarios: [], estoque: [],
  // O anúncio é do dono, feito pelo Mercado Imobiliário.
  a_venda: false, preco: null, anuncio_nota: '',
};

/**
 * Ficha de um imóvel — a mesma na Imobiliária e dentro do vilarejo.
 *
 * A Corte diz o que o imóvel é (categoria, tipo, local), de quem é e
 * quanto vale. O preço de venda não se mexe aqui: quem anuncia é o
 * dono, pelo Mercado Imobiliário.
 */
export default function FormPropriedade({
  inicial, locais, organizacoes = [], civis = [],
  categoriaPadrao = CATEGORIA_PADRAO,
  aoFechar, aoSalvar, aoRemover,
}) {
  const [v, setV] = useState(() => {
    const base = { ...PROPRIEDADE_VAZIA, ...inicial };
    const categoria = inicial?.id ? categoriaDe(base) : (base.categoria || categoriaPadrao);
    return {
      ...base,
      categoria,
      valor: base.valor ?? (inicial?.id ? avaliacaoDe(base) : CATEGORIA_POR_ID[categoria].base),
      catalogacao: lerCatalogacao(inicial.catalogacao),
    };
  });
  const set = (k) => (val) => setV((s) => ({ ...s, [k]: val }));
  const dono = v.proprietario_civil_id ? civis.find((c) => c.id === v.proprietario_civil_id) : null;
  const info = CATEGORIA_POR_ID[v.categoria] || CATEGORIA_POR_ID[CATEGORIA_PADRAO];

  /**
   * Trocar a categoria troca também o tipo e a avaliação — um imóvel
   * não fica "Casa" na categoria Comércios, e a base é a da categoria
   * nova, a não ser que a Corte já tenha escrito outro valor à mão.
   */
  const trocarCategoria = (id) => setV((s) => {
    const nova = CATEGORIA_POR_ID[id] || info;
    const anterior = CATEGORIA_POR_ID[s.categoria];
    const tipoCabe = nova.tipos.includes(s.tipo);
    // O campo devolve texto; sem o Number, "15000" nunca bate com 15000.
    const valorEraBase = !s.valor || Number(s.valor) === Number(anterior?.base);
    return {
      ...s,
      categoria: id,
      tipo: tipoCabe ? s.tipo : nova.tipos[0],
      valor: valorEraBase ? nova.base : s.valor,
    };
  });

  const salvar = () => aoSalvar({
    ...v,
    valor: Math.max(0, Math.round(Number(v.valor) || 0)) || null,
    cobrar_aquisicao: Math.max(0, Math.round(Number(v.cobrar_aquisicao) || 0)) || null,
  });

  // O Palácio concedendo o imóvel a alguém: é esta venda — e só ela —
  // que é receita do Hold. Quando dois jogadores negociam entre si o
  // dinheiro é deles, e o que entra no cofre é a taxa da escritura.
  const donoNovo = String(v.proprietario || '').trim()
    && String(v.proprietario || '').trim() !== String(inicial.proprietario || '').trim();

  return (
    <Modal
      titulo={inicial.id ? `Ficha — ${inicial.nome}` : `${info.singular === 'Casa' ? 'Nova' : 'Novo'} ${info.singular.toLowerCase()}`}
      largo
      aoFechar={aoFechar}
      rodape={
        <>
          {inicial.id && aoRemover && (
            <button className="btn perigo" style={{ marginRight: 'auto' }} onClick={() => aoRemover(inicial)}>
              Remover
            </button>
          )}
          <button className="btn fantasma" onClick={aoFechar}>Cancelar</button>
          <button className="btn primario" disabled={!String(v.nome || '').trim()} onClick={salvar}>Salvar</button>
        </>
      }
    >
      <div className="grade g3">
        <Texto rotulo="Nome do imóvel" valor={v.nome} aoMudar={set('nome')} />
        <Selecao
          rotulo="Categoria" valor={v.categoria} aoMudar={trocarCategoria}
          opcoes={CATEGORIAS_IMOVEL.map((c) => ({ valor: c.id, rotulo: c.singular }))}
        />
        <Selecao rotulo="Tipo" valor={v.tipo} aoMudar={set('tipo')} opcoes={info.tipos} vazioLabel="—" />

        <Selecao rotulo="Local" valor={v.local} aoMudar={set('local')} opcoes={locais} vazioLabel="Fora dos assentamentos" />

        <Campo rotulo="Organização / Clã">
          <input
            list="lista-organizacoes"
            value={v.organizacao || ''}
            onChange={(e) => set('organizacao')(e.target.value)}
            placeholder="Nenhuma"
          />
          <datalist id="lista-organizacoes">
            {organizacoes.map((o) => <option key={o} value={o} />)}
          </datalist>
        </Campo>

        <Selecao rotulo="Situação" valor={v.status} aoMudar={set('status')} opcoes={STATUS_PROPRIEDADE} vazioLabel="—" />
      </div>

      <div style={{ height: 12 }} />
      <div className="grade g2">
        <Texto
          rotulo="Avaliação da Corte (Septims)" type="number" min="0"
          valor={v.valor ?? ''} aoMudar={set('valor')}
        />
        <div className="campo">
          <label>No mercado</label>
          <div className="chip-lista" style={{ paddingTop: 8 }}>
            {estaAVenda(v)
              ? <Selo tom="ok" ponto>Anunciado pelo dono por {septims(precoDe(v))}</Selo>
              : <Selo tom="off">Fora do mercado</Selo>}
          </div>
          <p className="ajuda">
            Quem anuncia é o dono, pelo Mercado Imobiliário. A base desta categoria é{' '}
            {septims(info.base)}.
          </p>
        </div>
      </div>

      <div style={{ height: 12 }} />
      <SeletorCivil
        rotulo="Proprietário setado"
        valor={v.proprietario}
        aoMudar={(n) => setV((s) => ({ ...s, proprietario: n, proprietario_civil_id: '' }))}
        aoEscolher={(c) => setV((s) => ({ ...s, proprietario: c.nome, proprietario_civil_id: c.id }))}
        civis={civis}
        vinculado={dono}
        aoDesvincular={() => setV((s) => ({ ...s, proprietario_civil_id: '' }))}
        placeholder="Busque no Registro Civil ou digite o nome"
      />

      {donoNovo && (
        <div className="aquisicao">
          <Campo rotulo="Valor pago ao Hold pela aquisição (Septims)">
            <input
              type="number" min="0" className="mono"
              value={v.cobrar_aquisicao ?? ''}
              onChange={(e) => set('cobrar_aquisicao')(e.target.value === '' ? null : Number(e.target.value))}
              placeholder={`avaliação: ${Number(v.valor || info.base).toLocaleString('pt-BR')}`}
            />
          </Campo>
          <p className="painel-nota" style={{ margin: '6px 0 0' }}>
            Vira uma cobrança em nome de <strong>{v.proprietario}</strong> assim que a ficha for
            salva. Deixe em branco se o imóvel está sendo concedido sem custo, ou se a venda
            aconteceu entre jogadores — nesse caso o dinheiro não é do Hold.
          </p>
        </div>
      )}

      <div style={{ height: 18 }} />
      <EditorCatalogo valor={v.catalogacao} aoMudar={set('catalogacao')} titulo="Catalogação da propriedade" />

      <div style={{ height: 14 }} />
      <AreaTexto rotulo="Notas da Corte" valor={v.notas} aoMudar={set('notas')} />
    </Modal>
  );
}
