import { describe, expect, it } from 'vitest';
import { apontamentoDeTrecho, lerPrumadas, qtdPorPano } from './producao';
import { importarDiario } from './importar';
import { executadoItem } from './calc';
import type { Obra } from './types';

const obra = (): Obra => ({
  id: 'o', nome: 'T', cliente: '', endereco: '', numeroContrato: '', valorContrato: 0,
  dataInicio: '2026-01-01', dataFim: '2026-03-01', status: 'em_andamento', observacoes: '', criadoEm: '2026-01-01',
  medicoes: [], lancamentos: [],
  // 2 fachadas: frente 600 m² (10 pav × 6 prumadas = 60 panos de 10 m²) e fundos 400 m²
  locais: [
    { id: 'f', nome: 'Fachada frente', area: 600, pavimentos: 10, prumadas: 6 },
    { id: 'u', nome: 'Fachada fundos', area: 400, pavimentos: 10, prumadas: 4 },
  ],
  itens: [{ id: 'p', codigo: '4.2', descricao: 'Pintura', unidade: 'm²', quantidade: 1000, precoUnitario: 30, custoUnitario: 20,
    execucao: 'propria', responsavel: '', inicioPrevisto: '2026-01-01', fimPrevisto: '2026-02-28', locais: ['f', 'u'] }],
  apontamentos: [],
});

describe('produção pelo diário', () => {
  it('divide a quantidade da etapa por local e por pano', () => {
    const o = obra();
    expect(qtdPorPano(o, o.itens[0], o.locais![0])).toBeCloseTo(10);
    expect(qtdPorPano(o, o.itens[0], o.locais![1])).toBeCloseTo(10);
  });

  it('converte um trecho (prumada + pavimentos) em quantidade e percentual', () => {
    const o = obra();
    const r = apontamentoDeTrecho(o, o.itens[0], o.locais![0], '2026-01-10', [3], 12, 8);
    // pavimentos 8 a 10 existem (3 panos) → 30 m² = 3% da etapa
    expect(r.apontamento!.panos).toHaveLength(3);
    expect(r.apontamento!.quantidade).toBeCloseTo(30);
    const o2 = { ...o, apontamentos: [r.apontamento!] };
    expect(executadoItem(o2, 'p', '2026-01-10')).toBeCloseTo(3);
    // registrar o mesmo trecho de novo não conta em dobro
    expect(apontamentoDeTrecho(o2, o.itens[0], o.locais![0], '2026-01-11', [3], 10, 8).apontamento).toBeNull();
  });

  it('importa o diário por trecho e por quantidade', () => {
    const o = obra();
    const { registros, avisos } = importarDiario(o, [
      { Data: '05/01/2026', Etapa: '4.2', Local: 'fachada frente', Prumada: '1-2', 'Pavimento inicial': 10, 'Pavimento final': 6 },
      { Data: '05/01/2026', Etapa: '4.2', Local: 'Fachada frente', Prumada: '2', 'Pavimento inicial': 6, 'Pavimento final': 5 },
      { Data: '06/01/2026', Etapa: '4.2', Local: 'Fachada fundos', Quantidade: '45,5' },
    ]);
    expect(registros.map((r) => r.quantidade)).toEqual([100, 10, 45.5]);
    expect(avisos.some((a) => a.includes('já estavam registrados'))).toBe(true);
  });

  it('lê prumadas em vários formatos', () => {
    expect(lerPrumadas('1-3')).toEqual([1, 2, 3]);
    expect(lerPrumadas('2, 5')).toEqual([2, 5]);
    expect(lerPrumadas('P4')).toEqual([4]);
  });
});
