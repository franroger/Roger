const moeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const moedaCurta = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  notation: 'compact',
  maximumFractionDigits: 1,
});
const numero = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 });

export const fmtMoeda = (v: number) => moeda.format(Number.isFinite(v) ? v : 0);
export const fmtMoedaCurta = (v: number) => moedaCurta.format(Number.isFinite(v) ? v : 0);
export const fmtNum = (v: number) => numero.format(Number.isFinite(v) ? v : 0);
export const fmtPct = (v: number, casas = 1) =>
  `${(Number.isFinite(v) ? v : 0).toLocaleString('pt-BR', {
    minimumFractionDigits: casas,
    maximumFractionDigits: casas,
  })}%`;

export function fmtData(iso: string | undefined): string {
  if (!iso) return '—';
  const [a, m, d] = iso.slice(0, 10).split('-');
  if (!a || !m || !d) return iso;
  return `${d}/${m}/${a}`;
}

export function hojeISO(): string {
  const d = new Date();
  return toISO(d);
}

export function toISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function parseISO(iso: string): Date {
  const [a, m, d] = iso.slice(0, 10).split('-').map(Number);
  return new Date(a, (m || 1) - 1, d || 1);
}

export function addDias(iso: string, dias: number): string {
  const d = parseISO(iso);
  d.setDate(d.getDate() + dias);
  return toISO(d);
}

export function diffDias(a: string, b: string): number {
  return Math.round((parseISO(b).getTime() - parseISO(a).getTime()) / 86400000);
}

export const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

export function rotuloMes(chave: string): string {
  const [a, m] = chave.split('-');
  return `${MESES[Number(m) - 1]}/${a.slice(2)}`;
}

export function uid(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}
