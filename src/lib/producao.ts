import { uid } from './format';
import type { Apontamento, Fase, ItemOrcamento, Local, Obra } from './types';

/** Local com mapa de panos (fachada) ou área/ambiente comum. */
export const ehFachada = (l: Local) => (l.tipo ?? (l.prumadas > 1 || l.pavimentos > 1 ? 'fachada' : 'area')) === 'fachada';

/** Fases da etapa; sem fases cadastradas, a etapa é uma fase única. */
export function fasesDoItem(item: ItemOrcamento): Fase[] {
  const f = (item.fases ?? []).filter((x) => x.nome.trim() && x.peso > 0);
  return f.length ? f : [{ nome: '', peso: 100 }];
}

const mesmaFase = (a?: string, b?: string) => (a ?? '').trim().toLowerCase() === (b ?? '').trim().toLowerCase();


/** Locais em que a etapa é executada (os que existem na obra). */
export function locaisDoItem(obra: Obra, item: ItemOrcamento): Local[] {
  const todos = obra.locais ?? [];
  const ids = new Set(item.locais ?? []);
  return todos.filter((l) => ids.has(l.id));
}

/**
 * Quantidade da etapa em cada local: a quantidade total da etapa é dividida
 * proporcionalmente à área de cada local em que ela é executada.
 */
export function quantidadePorLocal(obra: Obra, item: ItemOrcamento): Map<string, number> {
  const ls = locaisDoItem(obra, item);
  const areaTotal = ls.reduce((s, l) => s + (l.area || 0), 0);
  const mapa = new Map<string, number>();
  for (const l of ls) {
    mapa.set(l.id, areaTotal > 0 ? (item.quantidade * (l.area || 0)) / areaTotal : item.quantidade / ls.length);
  }
  return mapa;
}

export function qtdPorPano(obra: Obra, item: ItemOrcamento, local: Local): number {
  const q = quantidadePorLocal(obra, item).get(local.id) ?? 0;
  const n = Math.max(1, local.pavimentos) * Math.max(1, local.prumadas);
  return q / n;
}

export const chavePano = (prumada: number, pavimento: number) => `${prumada}-${pavimento}`;

/** Panos já executados de uma etapa num local, com a data em que foram registrados. */
export function panosExecutados(obra: Obra, itemId: string, localId: string, ate?: string, fase?: string): Map<string, string> {
  const mapa = new Map<string, string>();
  for (const a of obra.apontamentos ?? []) {
    if (a.itemId !== itemId || a.localId !== localId || !a.panos || (ate && a.data > ate)) continue;
    if (fase !== undefined && a.fase && !mesmaFase(a.fase, fase)) continue;
    for (const p of a.panos) if (!mapa.has(p) || a.data < mapa.get(p)!) mapa.set(p, a.data);
  }
  return mapa;
}

/**
 * Quantidade executada de uma etapa numa fase e num local (ou sem local).
 * Registros por quantidade se somam; registros por % acumulado valem o último.
 * Prevalece o maior dos dois, limitado à quantidade do local.
 */
function executadoFaseLocal(obra: Obra, item: ItemOrcamento, fase: string, localId: string | undefined, data: string, qtdRef: number): number {
  let soma = 0;
  let ultimo: Apontamento | null = null;
  for (const a of obra.apontamentos ?? []) {
    if (a.itemId !== item.id || a.data > data) continue;
    if ((a.localId ?? undefined) !== localId) continue;
    if (a.fase && !mesmaFase(a.fase, fase)) continue;
    if (a.percentual != null) {
      if (!ultimo || a.data >= ultimo.data) ultimo = a;
    } else soma += a.quantidade;
  }
  const porPct = ultimo ? (qtdRef * Math.min(100, Math.max(0, ultimo.percentual!))) / 100 : 0;
  return Math.min(qtdRef, Math.max(soma, porPct));
}

/** Avanço (0..100) de uma etapa num local e fase, pelo diário. */
export function avancoLocalFase(obra: Obra, item: ItemOrcamento, localId: string | undefined, fase: string, data: string): number {
  const qtdRef = localId ? quantidadePorLocal(obra, item).get(localId) ?? 0 : item.quantidade;
  if (qtdRef <= 0) return 0;
  return (executadoFaseLocal(obra, item, fase, localId, data, qtdRef) / qtdRef) * 100;
}

/** % executado pela produção registrada no diário (null se não há registros). */
export function percentualPorDiario(obra: Obra, item: ItemOrcamento, data: string): number | null {
  const aps = obra.apontamentos ?? [];
  if (!aps.some((a) => a.itemId === item.id && a.data <= data)) return null;
  if (item.quantidade <= 0) return null;
  const fases = fasesDoItem(item);
  const pesoTotal = fases.reduce((s, f) => s + f.peso, 0);
  const qpl = quantidadePorLocal(obra, item);
  let total = 0;
  for (const f of fases) {
    // registros sem local contam sobre a etapa inteira; com local, sobre a parte do local
    let exec = executadoFaseLocal(obra, item, f.nome, undefined, data, item.quantidade);
    for (const [lid, q] of qpl) exec += executadoFaseLocal(obra, item, f.nome, lid, data, q);
    total += (Math.min(item.quantidade, exec) / item.quantidade) * (f.peso / pesoTotal);
  }
  return Math.min(100, total * 100);
}

/** Quantidade equivalente executada (avanço × quantidade da etapa). */
export function quantidadeExecutada(obra: Obra, itemId: string, data: string): number {
  const item = obra.itens.find((i) => i.id === itemId);
  if (!item) return 0;
  return ((percentualPorDiario(obra, item, data) ?? 0) / 100) * item.quantidade;
}

/** Lista de pavimentos de cima para baixo, como o balancim desce. */
export function pavimentosDeCima(local: Local): number[] {
  return Array.from({ length: Math.max(1, local.pavimentos) }, (_, k) => local.pavimentos - k);
}

/**
 * Cria o registro de produção a partir de um trecho de fachada:
 * prumada(s) e faixa de pavimentos. Panos já registrados são ignorados.
 */
export function apontamentoDeTrecho(
  obra: Obra,
  item: ItemOrcamento,
  local: Local,
  data: string,
  prumadas: number[],
  pavDe: number,
  pavAte: number,
  extra: { equipe?: string; observacao?: string; fase?: string } = {},
): { apontamento: Apontamento | null; repetidos: number } {
  const feitos = panosExecutados(obra, item.id, local.id, undefined, extra.fase ?? '');
  const [a, b] = pavDe <= pavAte ? [pavDe, pavAte] : [pavAte, pavDe];
  const panos: string[] = [];
  let repetidos = 0;
  for (const pr of prumadas) {
    if (pr < 1 || pr > local.prumadas) continue;
    for (let pv = Math.max(1, a); pv <= Math.min(local.pavimentos, b); pv++) {
      const k = chavePano(pr, pv);
      if (feitos.has(k)) repetidos++;
      else panos.push(k);
    }
  }
  if (!panos.length) return { apontamento: null, repetidos };
  return {
    apontamento: {
      id: uid(),
      data,
      itemId: item.id,
      localId: local.id,
      quantidade: panos.length * qtdPorPano(obra, item, local),
      panos,
      ...extra,
    },
    repetidos,
  };
}

/** Fachadas típicas para começar o cadastro de uma obra. */
export function locaisPadrao(pavimentos: number, areaFachada: number): Local[] {
  const base = (nome: string, area: number, prumadas: number): Local => ({ id: uid(), nome, tipo: 'fachada', area, pavimentos, prumadas });
  return [
    base('Fachada frente', areaFachada * 0.3, 6),
    base('Fachada fundos', areaFachada * 0.3, 6),
    base('Lateral esquerda', areaFachada * 0.2, 4),
    base('Lateral direita', areaFachada * 0.2, 4),
  ];
}

/** Lê números de prumadas como "3", "2,3", "1-4", "P3". */
export function lerPrumadas(txt: string): number[] {
  const out = new Set<number>();
  for (const parte of String(txt ?? '').split(/[;,/e]+/)) {
    const m = parte.match(/(\d+)\s*(?:-|a|até)\s*(\d+)/i);
    if (m) {
      for (let k = Number(m[1]); k <= Number(m[2]); k++) out.add(k);
    } else {
      const n = parte.match(/\d+/);
      if (n) out.add(Number(n[0]));
    }
  }
  return [...out].sort((a, b) => a - b);
}

/** Modelos de fases para os serviços mais comuns (pesos em %). */
export const FASES_PADRAO: Record<string, Fase[]> = {
  'Impermeabilização com manta': [
    { nome: 'Regularização / preparo', peso: 20 },
    { nome: 'Primer', peso: 10 },
    { nome: 'Manta', peso: 55 },
    { nome: 'Teste de estanqueidade', peso: 5 },
    { nome: 'Proteção mecânica', peso: 10 },
  ],
  'Impermeabilização cimentícia / cristalização': [
    { nome: 'Limpeza e apicoamento', peso: 25 },
    { nome: 'Tratamento de fissuras', peso: 20 },
    { nome: 'Aplicação (demãos)', peso: 45 },
    { nome: 'Cura e teste', peso: 10 },
  ],
  'Pintura': [
    { nome: 'Preparo / lixamento', peso: 25 },
    { nome: 'Selador / massa', peso: 25 },
    { nome: 'Acabamento (demãos)', peso: 50 },
  ],
  'Revestimento cerâmico / piso': [
    { nome: 'Remoção', peso: 15 },
    { nome: 'Regularização', peso: 20 },
    { nome: 'Assentamento', peso: 50 },
    { nome: 'Rejunte e limpeza', peso: 15 },
  ],
  'Reforma de ambiente (guarita, banheiro...)': [
    { nome: 'Demolição', peso: 10 },
    { nome: 'Alvenaria / estrutura', peso: 25 },
    { nome: 'Instalações elétricas e hidráulicas', peso: 20 },
    { nome: 'Revestimentos e piso', peso: 25 },
    { nome: 'Pintura e acabamentos', peso: 20 },
  ],
};
