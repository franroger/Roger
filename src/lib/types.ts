export type TipoExecucao = 'propria' | 'terceirizada' | 'mista';

export type StatusObra = 'planejamento' | 'em_andamento' | 'paralisada' | 'concluida';

export type CategoriaDespesa =
  | 'mao_obra_propria'
  | 'terceirizado'
  | 'material'
  | 'equipamento'
  | 'administrativo'
  | 'impostos'
  | 'outros';

/** Item / etapa da planilha orçamentária, já com o planejamento (cronograma). */
export interface ItemOrcamento {
  id: string;
  codigo: string;
  descricao: string;
  unidade: string;
  quantidade: number;
  /** Preço unitário de venda (o que está no contrato com o cliente). */
  precoUnitario: number;
  /** Custo unitário previsto (o que a empresa espera gastar). */
  custoUnitario: number;
  execucao: TipoExecucao;
  /** Equipe própria responsável ou empresa terceirizada. */
  responsavel: string;
  inicioPrevisto: string; // yyyy-mm-dd
  fimPrevisto: string; // yyyy-mm-dd
  /** Locais onde a etapa é executada (a quantidade é dividida pela área de cada um). */
  locais?: string[];
}

/** Registro de andamento: percentual físico acumulado de uma etapa numa data. */
export interface Medicao {
  id: string;
  data: string;
  itemId: string;
  percentual: number; // 0..100 acumulado
  observacao?: string;
}

export interface Lancamento {
  id: string;
  data: string;
  tipo: 'despesa' | 'receita';
  /** Etapa da planilha à qual a despesa/receita é apropriada (opcional). */
  itemId?: string;
  categoria: CategoriaDespesa | 'medicao' | 'adiantamento' | 'outros';
  descricao: string;
  valor: number;
}

export interface Obra {
  id: string;
  nome: string;
  cliente: string;
  endereco: string;
  numeroContrato: string;
  valorContrato: number;
  dataInicio: string;
  dataFim: string;
  status: StatusObra;
  observacoes: string;
  itens: ItemOrcamento[];
  medicoes: Medicao[];
  lancamentos: Lancamento[];
  criadoEm: string;
  /** Data em que a obra atingiu 100% (opcional). */
  ultimaConclusao?: string;
  /** Dados e condições do contrato com o cliente. */
  contrato?: DadosContrato;
  /** Fachadas e áreas da obra, divididas em panos (prumada × pavimento). */
  locais?: Local[];
  /** Produção registrada no diário de obra. */
  apontamentos?: Apontamento[];
  /** Condições de cada dia (clima, efetivo, paralisações) vindas do RDO. */
  diasRdo?: RegistroDia[];
}

export type CondicaoDia = 'praticavel' | 'parcial' | 'impraticavel';

/** Um dia do Relatório Diário de Obra. */
export interface RegistroDia {
  id: string;
  data: string;
  responsavel: string;
  climaManha: string;
  climaTarde: string;
  condicao: CondicaoDia;
  efetivoProprio: number;
  efetivoTerceirizado: number;
  horasParadas: number;
  motivoParalisacao: string;
  ocorrencias: string;
}

export const ROTULO_CONDICAO: Record<CondicaoDia, string> = {
  praticavel: 'Praticável',
  parcial: 'Parcialmente praticável',
  impraticavel: 'Impraticável',
};

/**
 * Local de execução: uma fachada, a cobertura, um reservatório...
 * A fachada é dividida em panos: prumadas (descidas do balancim) × pavimentos.
 */
export interface Local {
  id: string;
  nome: string;
  /** Área ou extensão total do local, na unidade das etapas (m², m). */
  area: number;
  pavimentos: number;
  prumadas: number;
}

/** Registro de produção do diário de obra. */
export interface Apontamento {
  id: string;
  data: string;
  itemId: string;
  localId?: string;
  /** Quantidade executada, na unidade da etapa. */
  quantidade: number;
  /** Panos concluídos, no formato "prumada-pavimento" (ex.: "3-12"). */
  panos?: string[];
  equipe?: string;
  observacao?: string;
}

export type Periodicidade = 'mensal' | 'quinzenal' | 'por_etapa' | 'outra';

/** Parcela prevista de recebimento do cliente. */
export interface Parcela {
  id: string;
  descricao: string;
  dataPrevista: string;
  valor: number;
}

export interface DadosContrato {
  dataAssinatura: string;
  prazoDias: number;
  tipoPrazo: 'corridos' | 'uteis';
  adiantamentoPct: number;
  periodicidade: Periodicidade;
  /** Dias para o cliente pagar após a medição/nota. */
  prazoPagamentoDias: number;
  retencaoPct: number;
  multaAtrasoPctDia: number;
  multaLimitePct: number;
  reajuste: string;
  garantia: string;
  condicoesPagamento: string;
  clausulas: string;
  parcelas: Parcela[];
  textoContrato?: string;
  nomeArquivo?: string;
}

export const ROTULO_PERIODICIDADE: Record<Periodicidade, string> = {
  mensal: 'Medição mensal',
  quinzenal: 'Medição quinzenal',
  por_etapa: 'Por etapa concluída',
  outra: 'Outra (ver condições)',
};

export function contratoVazio(): DadosContrato {
  return {
    dataAssinatura: '',
    prazoDias: 0,
    tipoPrazo: 'corridos',
    adiantamentoPct: 0,
    periodicidade: 'mensal',
    prazoPagamentoDias: 30,
    retencaoPct: 0,
    multaAtrasoPctDia: 0,
    multaLimitePct: 10,
    reajuste: '',
    garantia: '',
    condicoesPagamento: '',
    clausulas: '',
    parcelas: [],
  };
}

export interface BancoDados {
  versao: 1;
  obras: Obra[];
}

export const ROTULO_EXECUCAO: Record<TipoExecucao, string> = {
  propria: 'Equipe própria',
  terceirizada: 'Terceirizado',
  mista: 'Própria + terceirizado',
};

export const ROTULO_STATUS: Record<StatusObra, string> = {
  planejamento: 'Planejamento',
  em_andamento: 'Em andamento',
  paralisada: 'Paralisada',
  concluida: 'Concluída',
};

export const ROTULO_CATEGORIA: Record<string, string> = {
  mao_obra_propria: 'Mão de obra própria',
  terceirizado: 'Serviço terceirizado',
  material: 'Material',
  equipamento: 'Equipamento / andaime',
  administrativo: 'Administrativo',
  impostos: 'Impostos / taxas',
  outros: 'Outros',
  medicao: 'Recebimento de medição',
  adiantamento: 'Adiantamento',
};

export const CATEGORIAS_DESPESA: CategoriaDespesa[] = [
  'mao_obra_propria',
  'terceirizado',
  'material',
  'equipamento',
  'administrativo',
  'impostos',
  'outros',
];

export const CATEGORIAS_RECEITA = ['medicao', 'adiantamento', 'outros'] as const;
