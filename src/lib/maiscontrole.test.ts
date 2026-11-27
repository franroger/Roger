import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { interpretarComentario, lerRdoMaisControle, previaRdoMaisControle } from './maiscontrole';
import type { ItemOrcamento, Local, Obra } from './types';

const ler = (n: string) => readFileSync(new URL(`./__fixtures__/${n}`, import.meta.url), 'utf8');
const item = (id: string, codigo: string, unidade: string, quantidade: number, locais: string[]): ItemOrcamento => ({
  id, codigo, descricao: codigo, unidade, quantidade, precoUnitario: 1, custoUnitario: 1, execucao: 'propria', responsavel: '',
  inicioPrevisto: '2026-11-01', fimPrevisto: '2026-12-31', locais,
});
const obra = (nome: string, itens: ItemOrcamento[], locais: Local[]): Obra => ({
  id: 'o', nome, cliente: '', endereco: '', numeroContrato: '', valorContrato: 0, dataInicio: '2026-11-01', dataFim: '2026-12-31',
  status: 'em_andamento', observacoes: '', criadoEm: '2026-11-01', itens, medicoes: [], lancamentos: [], locais, apontamentos: [],
});

describe('RDO do Mais Controle', () => {
  it('lê cabeçalho, clima, mão de obra, atividades e comentários (fachada)', () => {
    const r = lerRdoMaisControle(ler('maiscontrole-fachada.html'));
    expect(r).toMatchObject({
      numero: '26', data: '2026-11-26', obra: 'Cond. Edifício Exemplo', cliente: 'Edifício Exemplo', criadoPor: 'Encarregado Teste',
      climaManha: 'Bom', condManha: 'Praticável', condTarde: 'Praticável',
    });
    expect(r.maoDeObra.reduce((s, m) => s + m.qtd, 0)).toBe(3);
    expect(r.atividades.map((a) => [a.codigo, a.unidade, a.status])).toEqual([
      ['2.8', 'm', 'Em Andamento'],
      ['2.10', 'm²', 'Finalizada'],
    ]);
    expect(r.comentarios[0]).toMatch(/rejunte palha/);
  });

  it('lê o RDO da casa (vários profissionais, só manhã)', () => {
    const r = lerRdoMaisControle(ler('maiscontrole-casa.html'));
    expect(r).toMatchObject({ numero: '30', obra: 'Casa Exemplo', criadoPor: 'Encarregado Teste', condManha: 'Praticável', condTarde: '' });
    expect(r.maoDeObra.reduce((s, m) => s + m.qtd, 0)).toBe(8);
    expect(r.atividades.map((a) => [a.codigo, a.unidade])).toEqual([
      ['7.2', 'm²'],
      ['2.5', 'KG'],
    ]);
  });

  it('converte o comentário de fachada em panos', () => {
    const locais: Local[] = [
      { id: 'f', nome: 'Fachada frente', tipo: 'fachada', area: 1200, pavimentos: 12, prumadas: 6 },
      { id: 'e', nome: 'Lateral esquerda', tipo: 'fachada', area: 480, pavimentos: 12, prumadas: 4 },
    ];
    const o = obra('Cond. Edifício Exemplo', [item('j', '2.8', 'm', 900, ['f', 'e']), item('r', '2.10', 'm²', 1680, ['f', 'e'])], locais);
    const p = previaRdoMaisControle(o, lerRdoMaisControle(ler('maiscontrole-fachada.html')));
    expect(p.avisos).toEqual([]);
    expect(p.dia).toMatchObject({ data: '2026-11-26', condicao: 'praticavel', efetivoProprio: 3 });
    // 2.8: P3, pav 12→8 = 5 panos; 2.10: prumadas 2 e 3, pav 10→9 = 4 panos
    expect(p.linhas.map((l) => [l.atividade.codigo, l.apontamento?.panos?.length])).toEqual([
      ['2.8', 5],
      ['2.10', 4],
    ]);
  });

  it('converte o comentário de obra comum (casa) em quantidade', () => {
    const locais: Local[] = [
      { id: 't', nome: 'Pavimento térreo', tipo: 'area', area: 120, pavimentos: 1, prumadas: 1 },
      { id: 's', nome: 'Pavimento superior', tipo: 'area', area: 100, pavimentos: 1, prumadas: 1 },
    ];
    const o = obra('Casa Exemplo', [item('c', '7.2', 'm²', 220, ['t', 's']), item('a', '2.5', 'kg', 3000, ['t', 's'])], locais);
    const p = previaRdoMaisControle(o, lerRdoMaisControle(ler('maiscontrole-casa.html')));
    expect(p.linhas.map((l) => [l.atividade.codigo, l.apontamento?.localId, l.apontamento?.quantidade])).toEqual([
      ['7.2', 't', 35],
      ['2.5', 's', 120],
    ]);
  });

  it('sem comentário a atividade não é contabilizada; "Finalizada" vira 100% com alerta', () => {
    const o = obra('Casa Exemplo', [item('c', '7.2', 'm²', 220, []), item('a', '2.5', 'kg', 3000, [])], []);
    const rdo = lerRdoMaisControle(ler('maiscontrole-casa.html'));
    rdo.atividades.forEach((a) => (a.comentario = ''));
    rdo.atividades[1].status = 'Finalizada';
    const p = previaRdoMaisControle(o, rdo);
    expect(p.linhas[0].apontamento).toBeUndefined();
    expect(p.linhas[0].explicacao).toMatch(/Sem comentário/);
    expect(p.linhas[1].apontamento?.percentual).toBe(100);
    expect(p.linhas[1].alerta).toBe(true);
  });

  it('interpreta variações de escrita', () => {
    const o = obra('X', [], [{ id: 'c', nome: 'Cobertura', tipo: 'area', area: 1, pavimentos: 1, prumadas: 1 }]);
    expect(interpretarComentario('cobertura 45,5 m2', o)).toMatchObject({ quantidade: 45.5 });
    expect(interpretarComentario('guarita 60%', o)).toMatchObject({ percentual: 60 });
    expect(interpretarComentario('P2 do 8º ao 5º', o)).toMatchObject({ prumadas: [2], pavDe: 8, pavAte: 5 });
    expect(interpretarComentario('prumadas 1 e 4, pav. 3', o)).toMatchObject({ prumadas: [1, 4], pavDe: 3, pavAte: 3 });
  });
});
