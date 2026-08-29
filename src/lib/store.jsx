import React, { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react';
import * as db from './db.js';

const Ctx = createContext(null);

const TABELAS = ['civis', 'clas', 'corte', 'guardas', 'divisoes', 'patentes', 'milicia', 'campanhas', 'cofre', 'cobrancas', 'precos', 'prisoes', 'movimentos', 'trabalhadores', 'pedidos_dinastia', 'avisos', 'pedidos_compra', 'editais', 'propostas', 'propriedades', 'assentamentos', 'licencas', 'registros', 'pedidos_casa', 'ofertas', 'guildas', 'convites_divisao', 'missoes_exercito'];

export function DadosProvider({ usuario, children }) {
  const [dados, setDados] = useState(() => Object.fromEntries(TABELAS.map((t) => [t, []])));
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(null);

  const recarregar = useCallback(async () => {
    try {
      const tabelas = await Promise.all(TABELAS.map((t) => db.listar(t).catch(() => [])));
      setDados(Object.fromEntries(TABELAS.map((t, i) => [t, tabelas[i]])));
      setErro(null);
    } catch (e) {
      setErro(e.message || 'Falha ao consultar os arquivos da Corte.');
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => { recarregar(); }, [recarregar]);

  const autor = usuario?.nome || usuario?.cargo || 'Corte';

  /**
   * Gravar e recarregar.
   *
   * Se o banco recusar, a mensagem sobe para o quadro de erro da tela (como
   * já acontecia em `remover`) **e** a exceção segue adiante, para que quem
   * chamou não feche o formulário achando que salvou.
   */
  const salvar = useCallback(async (tabela, registro, rotuloAlvo) => {
    try {
      const novo = await db.salvar(tabela, registro);
      await db.registrar(autor, registro.id ? 'editou' : 'registrou', tabela, rotuloAlvo || registro.nome || '');
      await recarregar();
      setErro(null);
      return novo;
    } catch (e) {
      setErro(e.message || 'Não consegui salvar este registro.');
      throw e;
    }
  }, [autor, recarregar]);

  const remover = useCallback(async (tabela, id, rotuloAlvo) => {
    try {
      await db.remover(tabela, id);
      await db.registrar(autor, 'removeu', tabela, rotuloAlvo || '');
      await recarregar();
      setErro(null);
    } catch (e) {
      setErro(e.message || 'Não consegui remover este registro.');
    }
  }, [autor, recarregar]);

  const reiniciar = useCallback(async () => {
    db.reiniciarDemo();
    await recarregar();
  }, [recarregar]);

  // O valor do contexto muda só quando algo de verdade muda: sem isto,
  // cada render do provedor obrigava toda tela consumidora a redesenhar.
  const valor = useMemo(() => ({
    ...dados, carregando, erro,
    salvar, remover, recarregar, reiniciar, modo: db.MODO,
  }), [dados, carregando, erro, salvar, remover, recarregar, reiniciar]);

  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>;
}

export function useDados() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useDados fora do DadosProvider');
  return v;
}
