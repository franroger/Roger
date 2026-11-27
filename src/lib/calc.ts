import { addDias, diffDias, hojeISO, parseISO, toISO } from './format';
import type { ItemOrcamento, Obra, TipoExecucao } from './types';
import { percentualPorDiario } from './producao';

export const valorVenda = (i: ItemOrcamento) => i.quantidade * i.precoUnitario;
export const custoPrevisto = (i: ItemOrcamento) => i.quantidade * i.custoUnitario;

/** Percentual planejado (0..100) de um item numa data, distribuição linear entre início e fim. */
export function planejadoItem(i: ItemOrcamento, data: string): number {
  if (!i.inicioPrevisto || !i.fimPrevisto) return 0;
  if (data < i.inicioPrevisto) return 0;
  if (data >= i.fimPrevisto) return 100;
  const total = diffDias(i.inicioPrevisto, i.fimPrevisto) + 1;
  const decorrido = diffDias(i.inicioPrevisto, data) + 1;
  return Math.min(100, Math.max(0, (decorrido / total) * 100));
}

/** Percentual executado (0..100) de um item numa data, pela última medição até a data. */
export function executadoItem(obra: Obra, itemId: string, data: string): number {
  let melhor: { data: string; percentual: number } | null = null;
  for (const m of obra.medicoes) {
    if (m.itemId !== itemId || m.data > data) continue;
    if (!melhor || m.data >= melhor.data) melhor = m;
  }
  const porMedicao = melhor ? Math.min(100, Math.max(0, melhor.percentual)) : 0;
  // Se houver produção no diário de obra, vale o maior dos dois (evita regredir ao trocar de método).
  const item = obra.apontamentos?.length ? obra.itens.find((i) => i.id === itemId) : undefined;
  const porDiario = item ? percentualPorDiario(obra, item, data) : null;
  return porDiario === null ? porMedicao : Math.max(porMedicao, porDiario);
}

/** Peso do item: valor de venda (padrão de cronograma físico-financeiro). Cai para o custo se não houver preço. */
function pesos(obra: Obra): Map<string, number> {
  const mapa = new Map<string, number>();
  let total = obra.itens.reduce((s, i) => s + valorVenda(i), 0);
  const usarCusto = total <= 0;
  if (usarCusto) total = obra.itens.reduce((s, i) => s + custoPrevisto(i), 0);
  for (const i of obra.itens) {
    const v = usarCusto ? custoPrevisto(i) : valorVenda(i);
    mapa.set(i.id, total > 0 ? v / total : 1 / Math.max(1, obra.itens.length));
  }
  return mapa;
}

export function planejadoObra(obra: Obra, data: string): number {
  const p = pesos(obra);
  return obra.itens.reduce((s, i) => s + planejadoItem(i, data) * (p.get(i.id) ?? 0), 0);
}

export function executadoObra(obra: Obra, data: string): number {
  const p = pesos(obra);
  return obra.itens.reduce((s, i) => s + executadoItem(obra, i.id, data) * (p.get(i.id) ?? 0), 0);
}

export interface AnaliseItem {
  item: ItemOrcamento;
  peso: number;
  valorVenda: number;
  custoPrevisto: number;
  planejado: number; // %
  executado: number; // %
  desvioFisico: number; // executado - planejado (pp)
  gasto: number; // custo real apropriado
  valorAgregado: number; // executado% * custo previsto (EV)
  custoPlanejadoAteHoje: number; // planejado% * custo previsto (PV)
  cpi: number | null; // EV / gasto
  spi: number | null; // executado / planejado
  custoProjetado: number; // estimativa no término (EAC)
  desvioCustoProjetado: number; // EAC - custo previsto
  medidoVenda: number; // executado% * valor de venda (faturável)
  situacaoPrazo: 'adiantado' | 'em_dia' | 'atrasado' | 'nao_iniciado' | 'concluido' | 'futuro';
}

export function analisarItem(obra: Obra, i: ItemOrcamento, data: string, peso: number): AnaliseItem {
  const vv = valorVenda(i);
  const cp = custoPrevisto(i);
  const planejado = planejadoItem(i, data);
  const executado = executadoItem(obra, i.id, data);
  const gasto = obra.lancamentos
    .filter((l) => l.tipo === 'despesa' && l.itemId === i.id && l.data <= data)
    .reduce((s, l) => s + l.valor, 0);
  const ev = (executado / 100) * cp;
  const pv = (planejado / 100) * cp;
  const cpi = gasto > 0 ? ev / gasto : null;
  const spi = planejado > 0 ? executado / planejado : null;
  let eac: number;
  if (executado >= 100) eac = gasto;
  else if (executado >= 20 && gasto > 0) eac = gasto / (executado / 100);
  // Etapa no início: compras antecipadas de material distorcem a extrapolação,
  // então projeta-se gasto + saldo físico pelo custo orçado.
  else eac = Math.max(cp, gasto + cp * (1 - executado / 100));

  let situacao: AnaliseItem['situacaoPrazo'];
  const desvio = executado - planejado;
  if (executado >= 100) situacao = 'concluido';
  else if (planejado === 0 && executado === 0) situacao = 'futuro';
  else if (executado === 0 && planejado > 0) situacao = 'nao_iniciado';
  else if (desvio < -5) situacao = 'atrasado';
  else if (desvio > 5) situacao = 'adiantado';
  else situacao = 'em_dia';

  return {
    item: i,
    peso,
    valorVenda: vv,
    custoPrevisto: cp,
    planejado,
    executado,
    desvioFisico: desvio,
    gasto,
    valorAgregado: ev,
    custoPlanejadoAteHoje: pv,
    cpi,
    spi,
    custoProjetado: eac,
    desvioCustoProjetado: eac - cp,
    medidoVenda: (executado / 100) * vv,
    situacaoPrazo: situacao,
  };
}

export interface AnaliseObra {
  data: string;
  itens: AnaliseItem[];
  valorContrato: number;
  valorPlanilha: number;
  custoPrevistoTotal: number;
  margemPrevista: number;
  planejado: number;
  executado: number;
  desvioFisico: number;
  spi: number | null;
  cpi: number | null;
  despesas: number;
  despesasSemEtapa: number;
  receitas: number;
  saldoCaixa: number; // receitas - despesas
  medidoVenda: number; // quanto já poderia ter sido faturado
  aReceber: number; // medido - recebido
  custoProjetado: number; // EAC total (inclui despesas sem etapa)
  margemProjetada: number;
  terminoProjetado: string | null;
  diasAtrasoProjetado: number;
  prazoDecorrido: number; // %
  ultimaMedicao: string | null;
  porExecucao: Record<TipoExecucao, { custoPrevisto: number; gasto: number; valorAgregado: number }>;
}

export function analisarObra(obra: Obra, data: string = hojeISO()): AnaliseObra {
  const p = pesos(obra);
  const itens = obra.itens.map((i) => analisarItem(obra, i, data, p.get(i.id) ?? 0));
  const valorPlanilha = itens.reduce((s, a) => s + a.valorVenda, 0);
  const custoPrevistoTotal = itens.reduce((s, a) => s + a.custoPrevisto, 0);
  const valorContrato = obra.valorContrato > 0 ? obra.valorContrato : valorPlanilha;
  const planejado = itens.reduce((s, a) => s + a.planejado * a.peso, 0);
  const executado = itens.reduce((s, a) => s + a.executado * a.peso, 0);

  const lanc = obra.lancamentos.filter((l) => l.data <= data);
  const despesas = lanc.filter((l) => l.tipo === 'despesa').reduce((s, l) => s + l.valor, 0);
  const idsItens = new Set(obra.itens.map((i) => i.id));
  const despesasSemEtapa = lanc
    .filter((l) => l.tipo === 'despesa' && (!l.itemId || !idsItens.has(l.itemId)))
    .reduce((s, l) => s + l.valor, 0);
  const receitas = lanc.filter((l) => l.tipo === 'receita').reduce((s, l) => s + l.valor, 0);

  const ev = itens.reduce((s, a) => s + a.valorAgregado, 0);
  const gastoEtapas = itens.reduce((s, a) => s + a.gasto, 0);
  const cpi = gastoEtapas > 0 ? ev / gastoEtapas : null;
  const spi = planejado > 0 ? executado / planejado : null;

  // Despesas sem etapa (indiretas) são projetadas proporcionalmente ao avanço físico.
  const indiretoProjetado =
    executado > 0 && executado < 100 ? despesasSemEtapa / (executado / 100) : despesasSemEtapa;
  const custoProjetado = itens.reduce((s, a) => s + a.custoProjetado, 0) + indiretoProjetado;

  const medidoVenda = itens.reduce((s, a) => s + a.medidoVenda, 0) * (valorPlanilha > 0 ? valorContrato / valorPlanilha : 1);

  // Prazo
  let terminoProjetado: string | null = null;
  let diasAtraso = 0;
  const duracao = obra.dataInicio && obra.dataFim ? diffDias(obra.dataInicio, obra.dataFim) : 0;
  const decorrido = obra.dataInicio ? Math.max(0, diffDias(obra.dataInicio, data)) : 0;
  if (obra.dataFim) {
    if (executado >= 99.99) {
      terminoProjetado = obra.ultimaConclusao ?? data;
    } else if (spi && spi > 0 && data > obra.dataInicio) {
      const duracaoProjetada = Math.round(duracao / Math.min(spi, 3));
      terminoProjetado = addDias(obra.dataInicio, Math.max(duracaoProjetada, decorrido));
    } else {
      terminoProjetado = obra.dataFim;
    }
    diasAtraso = terminoProjetado ? diffDias(obra.dataFim, terminoProjetado) : 0;
  }

  const ultimaMedicao = obra.medicoes.reduce<string | null>(
    (m, x) => (x.data <= data && (!m || x.data > m) ? x.data : m),
    null,
  );

  const porExecucao: AnaliseObra['porExecucao'] = {
    propria: { custoPrevisto: 0, gasto: 0, valorAgregado: 0 },
    terceirizada: { custoPrevisto: 0, gasto: 0, valorAgregado: 0 },
    mista: { custoPrevisto: 0, gasto: 0, valorAgregado: 0 },
  };
  for (const a of itens) {
    const g = porExecucao[a.item.execucao] ?? porExecucao.propria;
    g.custoPrevisto += a.custoPrevisto;
    g.gasto += a.gasto;
    g.valorAgregado += a.valorAgregado;
  }

  return {
    data,
    itens,
    valorContrato,
    valorPlanilha,
    custoPrevistoTotal,
    margemPrevista: valorContrato - custoPrevistoTotal,
    planejado,
    executado,
    desvioFisico: executado - planejado,
    spi,
    cpi,
    despesas,
    despesasSemEtapa,
    receitas,
    saldoCaixa: receitas - despesas,
    medidoVenda,
    aReceber: Math.max(0, medidoVenda - receitas),
    custoProjetado,
    margemProjetada: valorContrato - custoProjetado,
    terminoProjetado,
    diasAtrasoProjetado: diasAtraso,
    prazoDecorrido: duracao > 0 ? Math.min(100, (decorrido / duracao) * 100) : 0,
    ultimaMedicao,
    porExecucao,
  };
}

/** Lista de meses (yyyy-mm) entre duas datas. */
export function mesesEntre(inicio: string, fim: string): string[] {
  if (!inicio || !fim || fim < inicio) return [];
  const out: string[] = [];
  const d = parseISO(inicio);
  d.setDate(1);
  const f = parseISO(fim);
  while (d <= f && out.length < 240) {
    out.push(toISO(d).slice(0, 7));
    d.setMonth(d.getMonth() + 1);
  }
  return out;
}

function fimDoMes(chave: string): string {
  const [a, m] = chave.split('-').map(Number);
  return toISO(new Date(a, m, 0));
}

function limitesObra(obra: Obra): [string, string] {
  let ini = obra.dataInicio;
  let fim = obra.dataFim;
  for (const p of obra.contrato?.parcelas ?? []) {
    if (p.dataPrevista && (!ini || p.dataPrevista < ini)) ini = p.dataPrevista;
    if (p.dataPrevista && (!fim || p.dataPrevista > fim)) fim = p.dataPrevista;
  }
  for (const i of obra.itens) {
    if (i.inicioPrevisto && (!ini || i.inicioPrevisto < ini)) ini = i.inicioPrevisto;
    if (i.fimPrevisto && (!fim || i.fimPrevisto > fim)) fim = i.fimPrevisto;
  }
  for (const l of obra.lancamentos) {
    if (!ini || l.data < ini) ini = l.data;
    if (!fim || l.data > fim) fim = l.data;
  }
  return [ini, fim];
}

export interface PontoCurvaS {
  mes: string;
  planejado: number;
  executado: number | null;
}

/** Curva S física: % acumulado planejado x executado ao final de cada mês. */
export function curvaS(obra: Obra, hoje: string = hojeISO()): PontoCurvaS[] {
  const [ini, fim] = limitesObra(obra);
  return mesesEntre(ini, fim).map((mes) => {
    const fm = fimDoMes(mes);
    const ref = fm > hoje ? hoje : fm;
    return {
      mes,
      planejado: planejadoObra(obra, fm),
      executado: mes <= hoje.slice(0, 7) ? executadoObra(obra, ref) : null,
    };
  });
}

/** Cronograma físico-financeiro: valor (de venda e custo) previsto por item por mês. */
export function cronogramaFinanceiro(obra: Obra) {
  const [ini, fim] = limitesObra(obra);
  const meses = mesesEntre(ini, fim);
  const linhas = obra.itens.map((i) => {
    const vv = valorVenda(i);
    const porMes = meses.map((mes) => {
      const inicioMes = `${mes}-01`;
      const anterior = addDias(inicioMes, -1);
      const frac = (planejadoItem(i, fimDoMes(mes)) - planejadoItem(i, anterior)) / 100;
      return frac * vv;
    });
    return { item: i, porMes };
  });
  const totais = meses.map((_, k) => linhas.reduce((s, l) => s + l.porMes[k], 0));
  return { meses, linhas, totais };
}

export interface PontoFluxo {
  mes: string;
  receitas: number;
  despesas: number;
  saldoMes: number;
  saldoAcumulado: number;
  /** Faturamento previsto no mês pelo cronograma (valor de venda, ajustado ao contrato). */
  receitaPrevista: number;
  custoPrevisto: number;
  saldoPrevistoAcumulado: number;
}

/** Fluxo de caixa mensal: receitas x despesas realizadas e previstas pelo cronograma. */
export function fluxoCaixa(obra: Obra): PontoFluxo[] {
  const [ini, fim] = limitesObra(obra);
  const totVenda = obra.itens.reduce((s, i) => s + valorVenda(i), 0);
  const fator = obra.valorContrato > 0 && totVenda > 0 ? obra.valorContrato / totVenda : 1;
  let acumulado = 0;
  let acumPrev = 0;
  const parcelas = obra.contrato?.parcelas ?? [];
  return mesesEntre(ini, fim).map((mes) => {
    const doMes = obra.lancamentos.filter((l) => l.data.slice(0, 7) === mes);
    const receitas = doMes.filter((l) => l.tipo === 'receita').reduce((s, l) => s + l.valor, 0);
    const despesas = doMes.filter((l) => l.tipo === 'despesa').reduce((s, l) => s + l.valor, 0);
    acumulado += receitas - despesas;
    const antes = addDias(`${mes}-01`, -1);
    let custoPrev = 0;
    let receitaPrev = 0;
    for (const i of obra.itens) {
      const frac = (planejadoItem(i, fimDoMes(mes)) - planejadoItem(i, antes)) / 100;
      custoPrev += frac * custoPrevisto(i);
      receitaPrev += frac * valorVenda(i) * fator;
    }
    // Com parcelas cadastradas no contrato, a receita prevista segue as datas de pagamento.
    if (parcelas.length) receitaPrev = parcelas.filter((p) => p.dataPrevista.slice(0, 7) === mes).reduce((s, p) => s + p.valor, 0);
    acumPrev += receitaPrev - custoPrev;
    return {
      mes,
      receitas,
      despesas,
      saldoMes: receitas - despesas,
      saldoAcumulado: acumulado,
      receitaPrevista: receitaPrev,
      custoPrevisto: custoPrev,
      saldoPrevistoAcumulado: acumPrev,
    };
  });
}
