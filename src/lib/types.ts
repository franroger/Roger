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
