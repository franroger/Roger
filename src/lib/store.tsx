import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { BancoDados, Obra } from './types';
import { hojeISO, uid } from './format';
import { obraExemplo } from './demo';

const CHAVE = 'gestao-obras:v1';

function carregar(): BancoDados {
  try {
    const raw = localStorage.getItem(CHAVE);
    if (raw) {
      const db = JSON.parse(raw) as BancoDados;
      if (Array.isArray(db.obras)) return db;
    }
  } catch {
    /* armazenamento indisponível */
  }
  // Na versão publicada como página, quem abre pela primeira vez já vê uma obra de exemplo.
  return { versao: 1, obras: import.meta.env.VITE_MODO === 'pagina' ? [obraExemplo()] : [] };
}

export function novaObraVazia(): Obra {
  const hoje = hojeISO();
  return {
    id: uid(),
    nome: '',
    cliente: '',
    endereco: '',
    numeroContrato: '',
    valorContrato: 0,
    dataInicio: hoje,
    dataFim: hoje,
    status: 'planejamento',
    observacoes: '',
    itens: [],
    medicoes: [],
    lancamentos: [],
    criadoEm: hoje,
  };
}

interface Ctx {
  obras: Obra[];
  obter: (id: string) => Obra | undefined;
  salvarObra: (obra: Obra) => void;
  atualizarObra: (id: string, fn: (o: Obra) => Obra) => void;
  excluirObra: (id: string) => void;
  substituirTudo: (db: BancoDados) => void;
  exportar: () => string;
}

const StoreCtx = createContext<Ctx | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [db, setDb] = useState<BancoDados>(carregar);

  useEffect(() => {
    try {
      localStorage.setItem(CHAVE, JSON.stringify(db));
    } catch {
      /* ignore */
    }
  }, [db]);

  const salvarObra = useCallback((obra: Obra) => {
    setDb((d) => {
      const existe = d.obras.some((o) => o.id === obra.id);
      return { ...d, obras: existe ? d.obras.map((o) => (o.id === obra.id ? obra : o)) : [...d.obras, obra] };
    });
  }, []);

  const atualizarObra = useCallback((id: string, fn: (o: Obra) => Obra) => {
    setDb((d) => ({ ...d, obras: d.obras.map((o) => (o.id === id ? fn(o) : o)) }));
  }, []);

  const excluirObra = useCallback((id: string) => {
    setDb((d) => ({ ...d, obras: d.obras.filter((o) => o.id !== id) }));
  }, []);

  const valor = useMemo<Ctx>(
    () => ({
      obras: db.obras,
      obter: (id) => db.obras.find((o) => o.id === id),
      salvarObra,
      atualizarObra,
      excluirObra,
      substituirTudo: (novo) => setDb(novo),
      exportar: () => JSON.stringify(db, null, 2),
    }),
    [db, salvarObra, atualizarObra, excluirObra],
  );

  return <StoreCtx.Provider value={valor}>{children}</StoreCtx.Provider>;
}

export function useStore(): Ctx {
  const c = useContext(StoreCtx);
  if (!c) throw new Error('StoreProvider ausente');
  return c;
}
