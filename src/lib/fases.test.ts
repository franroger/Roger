import { describe, expect, it } from 'vitest';
import { avancoLocalFase, percentualPorDiario } from './producao';
import { importarDiario } from './importar';
import type { Obra } from './types';

// Impermeabilização de 1.000 m² em duas lajes (600 + 400), com fases.
const obra = (): Obra => ({
  id: 'o', nome: 'Imper', cliente: '', endereco: '', numeroContrato: '', valorContrato: 0,
  dataInicio: '2026-01-01', dataFim: '2026-03-01', status: 'em_andamento', observacoes: '', criadoEm: '2026-01-01',
  medicoes: [], lancamentos: [],
  locais: [
    { id: 'a', nome: 'Laje G1', tipo: 'area', area: 600, pavimentos: 1, prumadas: 1 },
    { id: 'b', nome: 'Laje G2', tipo: 'area', area: 400, pavimentos: 1, prumadas: 1 },
    { id: 'g', nome: 'Guarita', tipo: 'area', area: 1, pavimentos: 1, prumadas: 1 },
  ],
  itens: [
    { id: 'm', codigo: '2', descricao: 'Manta asfáltica', unidade: 'm²', quantidade: 1000, precoUnitario: 1, custoUnitario: 1, execucao: 'terceirizada',
      responsavel: '', inicioPrevisto: '2026-01-01', fimPrevisto: '2026-02-01', locais: ['a', 'b'],
      fases: [{ nome: 'Regularização', peso: 20 }, { nome: 'Primer', peso: 10 }, { nome: 'Manta', peso: 60 }, { nome: 'Teste de estanqueidade', peso: 10 }] },
    { id: 'r', codigo: '5', descricao: 'Reforma da guarita', unidade: 'vb', quantidade: 1, precoUnitario: 1, custoUnitario: 1, execucao: 'propria',
      responsavel: '', inicioPrevisto: '2026-01-01', fimPrevisto: '2026-02-01', locais: ['g'],
      fases: [{ nome: 'Demolição', peso: 10 }, { nome: 'Alvenaria', peso: 40 }, { nome: 'Acabamento', peso: 50 }] },
  ],
  apontamentos: [],
});

describe('fases e % concluído', () => {
  it('pondera as fases pela quantidade de cada local', () => {
    const o = obra();
    o.apontamentos = [
      { id: '1', data: '2026-01-05', itemId: 'm', localId: 'a', fase: 'Regularização', quantidade: 600 }, // G1 inteira
      { id: '2', data: '2026-01-06', itemId: 'm', localId: 'a', fase: 'Manta', quantidade: 300 },         // metade da G1
      { id: '3', data: '2026-01-07', itemId: 'm', localId: 'b', fase: 'Regularização', quantidade: 0, percentual: 50 }, // 200 m²
    ];
    // Regularização: (600 + 200) / 1000 × 20 = 16 ; Manta: 300/1000 × 60 = 18 → 34%
    expect(percentualPorDiario(o, o.itens[0], '2026-01-31')).toBeCloseTo(34);
    expect(avancoLocalFase(o, o.itens[0], 'a', 'Manta', '2026-01-31')).toBeCloseTo(50);
  });

  it('% concluído vale o último informado (não soma)', () => {
    const o = obra();
    o.apontamentos = [
      { id: '1', data: '2026-01-05', itemId: 'r', localId: 'g', fase: 'Demolição', quantidade: 0, percentual: 100 },
      { id: '2', data: '2026-01-10', itemId: 'r', localId: 'g', fase: 'Alvenaria', quantidade: 0, percentual: 30 },
      { id: '3', data: '2026-01-15', itemId: 'r', localId: 'g', fase: 'Alvenaria', quantidade: 0, percentual: 60 },
    ];
    // 10 + 0,6 × 40 = 34%
    expect(percentualPorDiario(o, o.itens[1], '2026-01-31')).toBeCloseTo(34);
    expect(percentualPorDiario(o, o.itens[1], '2026-01-12')).toBeCloseTo(22);
  });

  it('importa linhas com fase, quantidade e % concluído', () => {
    const o = obra();
    const { registros, avisos } = importarDiario(o, [
      { Data: '05/01/2026', 'Etapa (código)': '2', 'Local / ambiente': 'Laje G1', Fase: 'Manta', 'Quantidade executada no dia': '120,5' },
      { Data: '05/01/2026', 'Etapa (código)': '5', 'Local / ambiente': 'Guarita', Fase: 'alvenaria', '% concluído (acumulado)': 45 },
      { Data: '05/01/2026', 'Etapa (código)': '2', 'Local / ambiente': 'Laje G2', Fase: 'Pintura', 'Quantidade executada no dia': 10 },
    ]);
    expect(registros.map((r) => [r.fase, r.quantidade, r.percentual ?? null])).toEqual([
      ['Manta', 120.5, null],
      ['Alvenaria', 0, 45],
    ]);
    expect(avisos[0]).toMatch(/fase "Pintura" não cadastrada/);
  });
});
