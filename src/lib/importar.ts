import * as XLSX from 'xlsx';
import { toISO, uid } from './format';
import type { ItemOrcamento, Lancamento, Medicao, Obra, TipoExecucao } from './types';

export type TipoImportacao = 'orcamento' | 'andamento' | 'financeiro';

type Linha = Record<string, unknown>;

const norm = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9%]+/g, ' ')
    .trim();

/** Procura o valor da primeira coluna cujo cabeçalho contém algum dos apelidos. */
function campo(l: Linha, apelidos: string[]): unknown {
  const chaves = Object.keys(l);
  for (const ap of apelidos) {
    const k = chaves.find((c) => norm(c) === ap);
    if (k !== undefined) return l[k];
  }
  for (const ap of apelidos) {
    if (ap.length <= 3) continue; // apelidos curtos só valem por igualdade exata
    const k = chaves.find((c) => norm(c).includes(ap));
    if (k !== undefined) return l[k];
  }
  return undefined;
}

export function paraNumero(v: unknown): number {
  if (typeof v === 'number') return v;
  if (v == null) return 0;
  let s = String(v).trim().replace(/[R$\s%]/g, '');
  if (!s) return 0;
  const negativo = /^\(.*\)$/.test(s) || s.startsWith('-');
  s = s.replace(/[()-]/g, '');
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  const n = Number(s);
  return Number.isFinite(n) ? (negativo ? -n : n) : 0;
}

export function paraData(v: unknown): string {
  if (v instanceof Date && !isNaN(v.getTime())) return toISO(v);
  if (typeof v === 'number' && v > 20000 && v < 80000) {
    const d = XLSX.SSF.parse_date_code(v);
    if (d) return `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`;
  }
  const s = String(v ?? '').trim();
  let m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})/);
  if (m) {
    const ano = m[3].length === 2 ? `20${m[3]}` : m[3];
    return `${ano}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  }
  m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  return '';
}

function texto(v: unknown): string {
  return v == null ? '' : String(v).trim();
}

function paraExecucao(v: unknown): TipoExecucao {
  const s = norm(texto(v));
  if (s.includes('mist') || (s.includes('propri') && s.includes('terc'))) return 'mista';
  if (s.includes('terc') || s.includes('sub') || s.includes('empreit')) return 'terceirizada';
  return 'propria';
}

export async function lerPlanilha(arquivo: File): Promise<Linha[]> {
  const buf = await arquivo.arrayBuffer();
  const wb = XLSX.read(buf, { type: 'array', cellDates: true });
  const ws = wb.Sheets[wb.SheetNames[0]];
  // Detecta a linha de cabeçalho: a primeira com pelo menos 3 células de texto.
  const matriz = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: '' });
  let idx = matriz.findIndex((r) => r.filter((c) => typeof c === 'string' && c.trim()).length >= 3);
  if (idx < 0) idx = 0;
  return XLSX.utils.sheet_to_json<Linha>(ws, { range: idx, defval: '' });
}

/** Localiza a etapa pelo código ou pela descrição. */
function acharItem(obra: Obra, ref: unknown): ItemOrcamento | undefined {
  const r = texto(ref);
  if (!r) return undefined;
  const n = norm(r);
  return (
    obra.itens.find((i) => i.codigo && norm(i.codigo) === n) ??
    obra.itens.find((i) => norm(i.descricao) === n) ??
    obra.itens.find((i) => n.length > 3 && norm(i.descricao).includes(n))
  );
}

export interface ResultadoImportacao<T> {
  registros: T[];
  avisos: string[];
}

export function importarOrcamento(linhas: Linha[]): ResultadoImportacao<ItemOrcamento> {
  const avisos: string[] = [];
  const registros: ItemOrcamento[] = [];
  linhas.forEach((l, k) => {
    const descricao = texto(campo(l, ['descricao', 'servico', 'etapa', 'discriminacao']));
    if (!descricao) return;
    const quantidade = paraNumero(campo(l, ['quantidade', 'quant', 'qtd', 'qtde']));
    const precoUnitario = paraNumero(campo(l, ['preco unitario', 'valor unitario', 'pu', 'preco unit', 'unitario venda']));
    const precoTotal = paraNumero(campo(l, ['preco total', 'valor total', 'total venda']));
    const custoUnitario = paraNumero(campo(l, ['custo unitario', 'custo unit', 'cu']));
    const custoTotal = paraNumero(campo(l, ['custo total', 'custo previsto', 'custo']));
    const q = quantidade || 1;
    const pu = precoUnitario || precoTotal / q;
    const cu = custoUnitario || custoTotal / q;
    const inicio = paraData(campo(l, ['inicio previsto', 'inicio', 'data inicio']));
    const fim = paraData(campo(l, ['fim previsto', 'termino', 'fim', 'data fim', 'conclusao']));
    if (!inicio || !fim) avisos.push(`Linha ${k + 2}: "${descricao}" sem datas de início/fim — ajuste no cronograma.`);
    registros.push({
      id: uid(),
      codigo: texto(campo(l, ['codigo', 'cod', 'item'])),
      descricao,
      unidade: texto(campo(l, ['unidade', 'und', 'un'])),
      quantidade: q,
      precoUnitario: pu,
      custoUnitario: cu,
      execucao: paraExecucao(campo(l, ['execucao', 'tipo execucao', 'tipo'])),
      responsavel: texto(campo(l, ['responsavel', 'empresa', 'fornecedor', 'equipe', 'terceirizado'])),
      inicioPrevisto: inicio,
      fimPrevisto: fim,
    });
  });
  return { registros, avisos };
}

export function importarAndamento(obra: Obra, linhas: Linha[]): ResultadoImportacao<Medicao> {
  const avisos: string[] = [];
  const registros: Medicao[] = [];
  linhas.forEach((l, k) => {
    const ref = campo(l, ['codigo', 'cod', 'etapa', 'item', 'servico', 'descricao']);
    const item = acharItem(obra, ref) ?? acharItem(obra, campo(l, ['descricao', 'servico', 'etapa']));
    const data = paraData(campo(l, ['data', 'dia', 'data medicao']));
    let p = paraNumero(campo(l, ['% acumulado', 'acumulado', 'percentual', '%', 'avanco', 'executado']));
    if (!texto(ref)) return;
    if (!item) {
      avisos.push(`Linha ${k + 2}: etapa "${texto(ref)}" não encontrada na planilha orçamentária.`);
      return;
    }
    if (!data) {
      avisos.push(`Linha ${k + 2}: data inválida.`);
      return;
    }
    if (p > 0 && p <= 1 && !String(campo(l, ['%', 'percentual']) ?? '').includes('%')) p = p * 100;
    registros.push({
      id: uid(),
      data,
      itemId: item.id,
      percentual: Math.min(100, Math.max(0, p)),
      observacao: texto(campo(l, ['observacao', 'obs', 'comentario'])),
    });
  });
  return { registros, avisos };
}

const MAPA_CATEGORIA: [string, Lancamento['categoria']][] = [
  ['propri', 'mao_obra_propria'],
  ['folha', 'mao_obra_propria'],
  ['salario', 'mao_obra_propria'],
  ['mao de obra', 'mao_obra_propria'],
  ['terc', 'terceirizado'],
  ['empreit', 'terceirizado'],
  ['subcontrat', 'terceirizado'],
  ['material', 'material'],
  ['equip', 'equipamento'],
  ['andaime', 'equipamento'],
  ['locacao', 'equipamento'],
  ['admin', 'administrativo'],
  ['imposto', 'impostos'],
  ['taxa', 'impostos'],
  ['medicao', 'medicao'],
  ['adiant', 'adiantamento'],
];

export function importarFinanceiro(obra: Obra, linhas: Linha[]): ResultadoImportacao<Lancamento> {
  const avisos: string[] = [];
  const registros: Lancamento[] = [];
  linhas.forEach((l, k) => {
    const data = paraData(campo(l, ['data', 'vencimento', 'pagamento', 'dia']));
    let valor = paraNumero(campo(l, ['valor', 'montante', 'total']));
    const entrada = paraNumero(campo(l, ['entrada', 'receita', 'credito', 'recebido']));
    const saida = paraNumero(campo(l, ['saida', 'despesa', 'debito', 'pago']));
    const tipoTxt = norm(texto(campo(l, ['tipo', 'natureza', 'operacao'])));
    let tipo: Lancamento['tipo'];
    if (entrada && !valor) {
      valor = entrada;
      tipo = 'receita';
    } else if (saida && !valor) {
      valor = saida;
      tipo = 'despesa';
    } else if (tipoTxt.includes('rec') || tipoTxt.includes('entr') || tipoTxt.includes('cred')) tipo = 'receita';
    else if (tipoTxt.includes('desp') || tipoTxt.includes('said') || tipoTxt.includes('deb') || tipoTxt.includes('cust')) tipo = 'despesa';
    else tipo = 'despesa';
    valor = Math.abs(valor);
    if (!valor) return;
    if (!data) {
      avisos.push(`Linha ${k + 2}: data inválida — lançamento ignorado.`);
      return;
    }
    const catTxt = norm(texto(campo(l, ['categoria', 'centro de custo', 'classificacao', 'grupo'])));
    let categoria: Lancamento['categoria'] = tipo === 'receita' ? 'medicao' : 'outros';
    for (const [chave, cat] of MAPA_CATEGORIA) {
      if (catTxt.includes(chave)) {
        categoria = cat;
        break;
      }
    }
    const refEtapa = campo(l, ['etapa', 'codigo', 'item', 'servico']);
    const item = acharItem(obra, refEtapa);
    if (texto(refEtapa) && !item) avisos.push(`Linha ${k + 2}: etapa "${texto(refEtapa)}" não encontrada — lançado sem etapa.`);
    registros.push({
      id: uid(),
      data,
      tipo,
      itemId: item?.id,
      categoria,
      descricao: texto(campo(l, ['descricao', 'historico', 'fornecedor', 'favorecido', 'obs'])),
      valor,
    });
  });
  return { registros, avisos };
}

export function baixarModelo(tipo: TipoImportacao) {
  const modelos: Record<TipoImportacao, (string | number)[][]> = {
    orcamento: [
      ['Código', 'Descrição', 'Unidade', 'Quantidade', 'Preço unitário', 'Custo unitário', 'Execução', 'Responsável', 'Início', 'Fim'],
      ['1.1', 'Mobilização e canteiro', 'vb', 1, 25000, 18000, 'Própria', 'Equipe João', '01/12/2026', '15/12/2026'],
      ['2.1', 'Impermeabilização da cobertura', 'm²', 500, 160, 115, 'Terceirizada', 'ImperTec', '10/12/2026', '30/01/2027'],
    ],
    andamento: [
      ['Data', 'Código', 'Etapa', '% Acumulado', 'Observação'],
      ['20/12/2026', '1.1', 'Mobilização e canteiro', 100, ''],
      ['20/12/2026', '2.1', 'Impermeabilização da cobertura', 15, 'Início da manta'],
    ],
    financeiro: [
      ['Data', 'Tipo', 'Etapa', 'Categoria', 'Descrição', 'Valor'],
      ['05/12/2026', 'Despesa', '1.1', 'Material', 'Tapumes', 4500],
      ['10/12/2026', 'Despesa', '2.1', 'Terceirizado', 'ImperTec – sinal', 15000],
      ['15/12/2026', 'Receita', '', 'Medição', 'Medição 01', 30000],
    ],
  };
  const ws = XLSX.utils.aoa_to_sheet(modelos[tipo]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Dados');
  XLSX.writeFile(wb, `modelo-${tipo}.xlsx`);
}
