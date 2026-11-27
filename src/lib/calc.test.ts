import { describe, expect, it } from 'vitest';
import { analisarObra, planejadoItem, cronogramaFinanceiro } from './calc';
import { gerarRecomendacoes } from './recomendacoes';
import { importarFinanceiro, paraData, paraNumero } from './importar';
import type { ItemOrcamento, Obra } from './types';
import { obraExemplo } from './demo';

const item = (p: Partial<ItemOrcamento>): ItemOrcamento => ({
  id: 'a',
  codigo: '1',
  descricao: 'Etapa A',
  unidade: 'm²',
  quantidade: 100,
  precoUnitario: 100,
  custoUnitario: 70,
  execucao: 'propria',
  responsavel: '',
  inicioPrevisto: '2026-01-01',
  fimPrevisto: '2026-01-10',
  ...p,
});

const obraBase = (p: Partial<Obra> = {}): Obra => ({
  id: 'o',
  nome: 'Teste',
  cliente: '',
  endereco: '',
  numeroContrato: '',
  valorContrato: 0,
  dataInicio: '2026-01-01',
  dataFim: '2026-01-20',
  status: 'em_andamento',
  observacoes: '',
  itens: [item({}), item({ id: 'b', codigo: '2', descricao: 'Etapa B', inicioPrevisto: '2026-01-11', fimPrevisto: '2026-01-20' })],
  medicoes: [],
  lancamentos: [],
  criadoEm: '2026-01-01',
  ...p,
});

describe('planejamento', () => {
  it('distribui linearmente o previsto', () => {
    const i = item({});
    expect(planejadoItem(i, '2025-12-31')).toBe(0);
    expect(planejadoItem(i, '2026-01-05')).toBeCloseTo(50);
    expect(planejadoItem(i, '2026-01-10')).toBe(100);
  });

  it('cronograma físico-financeiro soma o valor de venda', () => {
    const c = cronogramaFinanceiro(obraBase());
    expect(c.totais.reduce((s, v) => s + v, 0)).toBeCloseTo(20000);
  });
});

describe('análise da obra', () => {
  it('detecta atraso e estouro de custo', () => {
    const o = obraBase({
      medicoes: [{ id: 'm', data: '2026-01-10', itemId: 'a', percentual: 50 }],
      lancamentos: [
        { id: 'l1', data: '2026-01-09', tipo: 'despesa', itemId: 'a', categoria: 'material', descricao: '', valor: 5000 },
        { id: 'l2', data: '2026-01-09', tipo: 'receita', categoria: 'medicao', descricao: '', valor: 3000 },
      ],
    });
    const a = analisarObra(o, '2026-01-10');
    expect(a.planejado).toBeCloseTo(50); // A 100% previsto, peso 50%
    expect(a.executado).toBeCloseTo(25);
    expect(a.spi).toBeCloseTo(0.5);
    const ia = a.itens[0];
    expect(ia.valorAgregado).toBeCloseTo(3500);
    expect(ia.cpi).toBeCloseTo(0.7);
    expect(ia.custoProjetado).toBeCloseTo(10000);
    expect(a.saldoCaixa).toBe(-2000);
    expect(a.aReceber).toBeCloseTo(2000); // 25% de 20.000 = 5.000 − 3.000
    expect(a.diasAtrasoProjetado).toBeGreaterThan(0);
    const recs = gerarRecomendacoes(o, a);
    expect(recs[0].gravidade).toBe('critico');
    expect(recs.some((r) => r.area === 'financeiro')).toBe(true);
    expect(recs.some((r) => r.area === 'planejamento')).toBe(true);
  });

  it('obra de exemplo gera análise consistente', () => {
    const o = obraExemplo();
    const a = analisarObra(o);
    expect(a.executado).toBeGreaterThan(0);
    expect(a.executado).toBeLessThan(100);
    expect(gerarRecomendacoes(o, a).length).toBeGreaterThan(0);
  });
});

describe('importação', () => {
  it('converte números e datas brasileiras', () => {
    expect(paraNumero('R$ 1.234,56')).toBeCloseTo(1234.56);
    expect(paraNumero('(500,00)')).toBe(-500);
    expect(paraData('05/03/2026')).toBe('2026-03-05');
    expect(paraData(46000)).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('importa lançamentos com entrada/saída e etapa por código', () => {
    const o = obraBase();
    const { registros } = importarFinanceiro(o, [
      { Data: '02/01/2026', 'Código': '1', Categoria: 'Material', 'Histórico': 'Cimento', 'Saída': '1.000,00' },
      { Data: '03/01/2026', 'Histórico': 'Medição 1', Entrada: 2500 },
    ]);
    expect(registros).toHaveLength(2);
    expect(registros[0]).toMatchObject({ tipo: 'despesa', itemId: 'a', valor: 1000, categoria: 'material' });
    expect(registros[1]).toMatchObject({ tipo: 'receita', valor: 2500 });
  });
});
