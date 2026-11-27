import { addDias, hojeISO, uid } from './format';
import { gerarParcelas } from './contrato';
import { obraExemplo } from './demo';
import { contratoVazio, type Apontamento, type Fase, type ItemOrcamento, type Lancamento, type Local, type Medicao, type Obra } from './types';
import { FASES_PADRAO } from './producao';

type ItemDef = [string, string, string, number, number, number, ItemOrcamento['execucao'], string, number, number];

/** Monta uma obra de exemplo a partir de definições compactas (dias relativos ao início). */
function montar(opts: {
  nome: string;
  cliente: string;
  endereco: string;
  numero: string;
  inicioHaDias: number;
  duracao: number;
  itens: ItemDef[];
  /** [índice do item, dia, % acumulado] */
  medicoes: [number, number, number][];
  /** [dia, índice do item ou -1, categoria, descrição, valor] */
  despesas: [number, number, Lancamento['categoria'], string, number][];
  receitas: [number, string, number][];
  adiantamentoPct: number;
  retencaoPct: number;
  status: Obra['status'];
  /** [nome, tipo, área] */
  locais?: [string, 'fachada' | 'area', number][];
  /** por item: índices dos locais e fases */
  itemLocais?: Record<number, number[]>;
  itemFases?: Record<number, Fase[]>;
  /** [item, local (-1 = etapa inteira), dia, fase, quantidade | {pct}] */
  producao?: [number, number, number, string, number | { pct: number }][];
}): Obra {
  const ini = addDias(hojeISO(), -opts.inicioHaDias);
  const d = (n: number) => addDias(ini, n);
  const locais: Local[] = (opts.locais ?? []).map(([nome, tipo, area]) => ({ id: uid(), nome, tipo, area, pavimentos: 1, prumadas: 1 }));
  const itens: ItemOrcamento[] = opts.itens.map(([codigo, descricao, unidade, quantidade, precoUnitario, custoUnitario, execucao, responsavel, a, b], k) => ({
    id: uid(),
    codigo,
    descricao,
    unidade,
    quantidade,
    precoUnitario,
    custoUnitario,
    execucao,
    responsavel,
    inicioPrevisto: d(a),
    fimPrevisto: d(b),
    locais: opts.itemLocais?.[k]?.map((j) => locais[j].id),
    fases: opts.itemFases?.[k],
  }));
  const apontamentos: Apontamento[] = (opts.producao ?? []).map(([k, j, dia, fase, v]) => ({
    id: uid(),
    data: d(dia),
    itemId: itens[k].id,
    localId: j >= 0 ? locais[j].id : undefined,
    fase: fase || undefined,
    quantidade: typeof v === 'number' ? v : 0,
    percentual: typeof v === 'number' ? undefined : v.pct,
  }));
  const medicoes: Medicao[] = opts.medicoes.map(([k, dia, p]) => ({ id: uid(), itemId: itens[k].id, data: d(dia), percentual: p }));
  const lancamentos: Lancamento[] = [
    ...opts.despesas.map(([dia, k, categoria, descricao, valor]) => ({
      id: uid(),
      data: d(dia),
      tipo: 'despesa' as const,
      itemId: k >= 0 ? itens[k].id : undefined,
      categoria,
      descricao,
      valor,
    })),
    ...opts.receitas.map(([dia, descricao, valor]) => ({ id: uid(), data: d(dia), tipo: 'receita' as const, categoria: 'medicao' as const, descricao, valor })),
  ];
  const obra: Obra = {
    id: uid(),
    nome: opts.nome,
    cliente: opts.cliente,
    endereco: opts.endereco,
    numeroContrato: opts.numero,
    valorContrato: itens.reduce((s, i) => s + i.quantidade * i.precoUnitario, 0),
    dataInicio: ini,
    dataFim: d(opts.duracao - 1),
    status: opts.status,
    observacoes: 'Obra de exemplo para demonstração do aplicativo.',
    itens,
    medicoes,
    lancamentos,
    criadoEm: hojeISO(),
    locais: locais.length ? locais : undefined,
    apontamentos: apontamentos.length ? apontamentos : undefined,
  };
  const contrato = {
    ...contratoVazio(),
    dataAssinatura: addDias(ini, -7),
    prazoDias: opts.duracao,
    adiantamentoPct: opts.adiantamentoPct,
    prazoPagamentoDias: 20,
    retencaoPct: opts.retencaoPct,
    multaAtrasoPctDia: 0.1,
    multaLimitePct: 10,
    reajuste: 'INCC-DI anual',
    garantia: '5 anos',
  };
  return { ...obra, contrato: { ...contrato, parcelas: gerarParcelas(obra, contrato) } };
}

/** Obra adiantada e com custo abaixo do orçado. */
function mirante(): Obra {
  return montar({
    nome: 'Exemplo – Ed. Mirante (impermeabilização de subsolo e garagem)',
    cliente: 'Construtora Horizonte',
    endereco: 'Rua das Acácias, 320',
    numero: 'CT-2026/021',
    inicioHaDias: 45,
    duracao: 120,
    status: 'em_andamento',
    adiantamentoPct: 0,
    retencaoPct: 5,
    itens: [
      ['1', 'Mobilização e preparo da superfície', 'm²', 2400, 12, 8, 'propria', 'Equipe própria', 0, 20],
      ['2', 'Impermeabilização com manta asfáltica (lajes)', 'm²', 2400, 135, 92, 'terceirizada', 'ImperTec Impermeabilizações', 15, 80],
      ['3', 'Cristalização de cortinas e poço de elevador', 'm²', 900, 95, 62, 'propria', 'Equipe própria – Encarregado Paulo', 30, 95],
      ['4', 'Proteção mecânica e regularização', 'm²', 2400, 38, 26, 'propria', 'Equipe própria', 60, 115],
      ['5', 'Reforma da guarita', 'vb', 1, 38000, 26000, 'propria', 'Equipe própria – Encarregado Paulo', 25, 100],
    ],
    locais: [
      ['Laje garagem G1', 'area', 1200],
      ['Laje garagem G2', 'area', 900],
      ['Rampa de acesso', 'area', 300],
      ['Cortinas de contenção', 'area', 700],
      ['Poço do elevador', 'area', 200],
      ['Guarita', 'area', 1],
    ],
    itemLocais: { 0: [0, 1, 2], 1: [0, 1, 2], 2: [3, 4], 3: [0, 1, 2], 4: [5] },
    itemFases: {
      1: [
        { nome: 'Regularização / preparo', peso: 20 },
        { nome: 'Primer', peso: 10 },
        { nome: 'Manta', peso: 60 },
        { nome: 'Teste de estanqueidade', peso: 10 },
      ],
      2: FASES_PADRAO['Impermeabilização cimentícia / cristalização'],
      4: FASES_PADRAO['Reforma de ambiente (guarita, banheiro...)'],
    },
    producao: [
      [1, 0, 20, 'Regularização / preparo', 1200],
      [1, 0, 26, 'Primer', 1200],
      [1, 0, 33, 'Manta', 500],
      [1, 0, 40, 'Manta', 450],
      [1, 0, 44, 'Manta', 250],
      [1, 0, 44, 'Teste de estanqueidade', { pct: 50 }],
      [1, 1, 38, 'Regularização / preparo', 900],
      [1, 1, 43, 'Primer', 600],
      [1, 2, 44, 'Regularização / preparo', { pct: 40 }],
      [2, 3, 36, 'Limpeza e apicoamento', { pct: 100 }],
      [2, 3, 44, 'Tratamento de fissuras', { pct: 60 }],
      [2, 4, 42, 'Limpeza e apicoamento', { pct: 100 }],
      [2, 4, 44, 'Aplicação (demãos)', { pct: 30 }],
      [4, 5, 30, 'Demolição', { pct: 100 }],
      [4, 5, 44, 'Alvenaria / estrutura', { pct: 70 }],
      [4, 5, 44, 'Instalações elétricas e hidráulicas', { pct: 20 }],
    ],
    medicoes: [
      [0, 18, 100],
      [1, 30, 30],
      [1, 44, 55],
      [2, 44, 25],
    ],
    despesas: [
      [5, 0, 'mao_obra_propria', 'Folha – preparo', 11000],
      [12, 0, 'material', 'Primer e argamassa', 6500],
      [25, 1, 'terceirizado', 'ImperTec – medição 1', 52000],
      [40, 1, 'terceirizado', 'ImperTec – medição 2', 46000],
      [38, 2, 'material', 'Cristalizante', 7800],
      [43, 2, 'mao_obra_propria', 'Folha – cristalização', 5200],
      [30, -1, 'administrativo', 'Engenheiro / ART', 6000],
    ],
    receitas: [
      [30, 'Medição 01', 58000],
      [44, 'Medição 02', 96000],
    ],
  });
}

/** Obra na reta final, com pequeno estouro de custo. */
function vilaVerde(): Obra {
  return montar({
    nome: 'Exemplo – Residencial Vila Verde (pintura e recuperação de fachada)',
    cliente: 'Condomínio Residencial Vila Verde',
    endereco: 'Av. Brasil, 2100',
    numero: 'CT-2026/009',
    inicioHaDias: 150,
    duracao: 165,
    status: 'em_andamento',
    adiantamentoPct: 10,
    retencaoPct: 0,
    itens: [
      ['1', 'Balancins e proteções', 'mês', 5, 6800, 5400, 'terceirizada', 'Andaimes Forte Ltda', 0, 150],
      ['2', 'Recuperação de fissuras e reboco', 'm²', 950, 72, 48, 'propria', 'Equipe própria', 5, 70],
      ['3', 'Pintura de fachada (textura + acrílica)', 'm²', 5200, 34, 23, 'propria', 'Equipe própria – Encarregado Luís', 50, 150],
      ['4', 'Limpeza e desmobilização', 'vb', 1, 9000, 6500, 'propria', 'Equipe própria', 150, 164],
    ],
    medicoes: [
      [0, 140, 90],
      [1, 40, 60],
      [1, 70, 100],
      [2, 90, 35],
      [2, 120, 70],
      [2, 148, 92],
    ],
    despesas: [
      [10, 0, 'equipamento', 'Balancins – meses 1 e 2', 10800],
      [70, 0, 'equipamento', 'Balancins – meses 3 e 4', 10800],
      [130, 0, 'equipamento', 'Balancins – mês 5', 5400],
      [30, 1, 'mao_obra_propria', 'Folha – fissuras', 24000],
      [65, 1, 'material', 'Argamassa e tela', 22500],
      [90, 2, 'material', 'Tintas e texturas', 52000],
      [100, 2, 'mao_obra_propria', 'Folha – pintura', 38000],
      [140, 2, 'mao_obra_propria', 'Folha – pintura', 32000],
      [60, -1, 'administrativo', 'Engenheiro / ART', 9000],
      [120, -1, 'administrativo', 'Engenheiro', 6000],
    ],
    receitas: [
      [3, 'Adiantamento (10%)', 28000],
      [45, 'Medição 01', 42000],
      [75, 'Medição 02', 61000],
      [105, 'Medição 03', 55000],
      [135, 'Medição 04', 58000],
    ],
  });
}

/** Carteira de exemplo: três obras em situações diferentes. */
export function obrasExemplo(): Obra[] {
  return [obraExemplo(), mirante(), vilaVerde()];
}
