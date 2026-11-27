import { uid } from './format';
import type { Apontamento, ItemOrcamento, Local, Obra } from './types';

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
export function panosExecutados(obra: Obra, itemId: string, localId: string, ate?: string): Map<string, string> {
  const mapa = new Map<string, string>();
  for (const a of obra.apontamentos ?? []) {
    if (a.itemId !== itemId || a.localId !== localId || !a.panos || (ate && a.data > ate)) continue;
    for (const p of a.panos) if (!mapa.has(p) || a.data < mapa.get(p)!) mapa.set(p, a.data);
  }
  return mapa;
}

/** Quantidade executada de uma etapa até a data, pelo diário (opcionalmente só num local). */
export function quantidadeExecutada(obra: Obra, itemId: string, data: string, localId?: string): number {
  return (obra.apontamentos ?? [])
    .filter((a) => a.itemId === itemId && a.data <= data && (!localId || a.localId === localId))
    .reduce((s, a) => s + a.quantidade, 0);
}

/** % executado pela produção registrada no diário (null se não há registros). */
export function percentualPorDiario(obra: Obra, item: ItemOrcamento, data: string): number | null {
  const aps = obra.apontamentos ?? [];
  if (!aps.some((a) => a.itemId === item.id && a.data <= data)) return null;
  if (item.quantidade <= 0) return null;
  return Math.min(100, (quantidadeExecutada(obra, item.id, data) / item.quantidade) * 100);
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
  extra: { equipe?: string; observacao?: string } = {},
): { apontamento: Apontamento | null; repetidos: number } {
  const feitos = panosExecutados(obra, item.id, local.id);
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
  const base = (nome: string, area: number, prumadas: number): Local => ({ id: uid(), nome, area, pavimentos, prumadas });
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
