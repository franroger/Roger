import { addDias, hojeISO, uid } from './format';
import type { DadosContrato, ItemOrcamento, Lancamento, Medicao, Obra } from './types';
import { contratoVazio } from './types';
import { gerarParcelas } from './contrato';
import { apontamentoDeTrecho, locaisPadrao } from './producao';

/** Obra de exemplo: reforma de fachada e impermeabilização, com datas relativas a hoje. */
export function obraExemplo(): Obra {
  const hoje = hojeISO();
  const ini = addDias(hoje, -100);
  const d = (n: number) => addDias(ini, n);

  const it = (
    codigo: string,
    descricao: string,
    unidade: string,
    quantidade: number,
    precoUnitario: number,
    custoUnitario: number,
    execucao: ItemOrcamento['execucao'],
    responsavel: string,
    a: number,
    b: number,
  ): ItemOrcamento => ({
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
  });

  const itens: ItemOrcamento[] = [
    it('1.1', 'Mobilização, canteiro e proteções', 'vb', 1, 28000, 21000, 'propria', 'Equipe própria – Encarregado João', 0, 14),
    it('1.2', 'Locação e montagem de balancins/andaimes', 'mês', 6, 9500, 7600, 'terceirizada', 'Andaimes Forte Ltda', 7, 190),
    it('2.1', 'Lavagem e remoção de revestimento solto', 'm²', 4200, 14, 9.5, 'propria', 'Equipe própria', 15, 60),
    it('2.2', 'Tratamento de trincas e recuperação estrutural', 'm', 1800, 85, 58, 'mista', 'Equipe própria + Recupera Engenharia', 30, 95),
    it('3.1', 'Impermeabilização da cobertura (manta asfáltica)', 'm²', 650, 165, 118, 'terceirizada', 'ImperTec Impermeabilizações', 40, 85),
    it('3.2', 'Impermeabilização de reservatórios', 'm²', 180, 210, 150, 'terceirizada', 'ImperTec Impermeabilizações', 70, 100),
    it('4.1', 'Reassentamento de pastilhas/cerâmica', 'm²', 1300, 120, 82, 'propria', 'Equipe própria – Encarregado Marcos', 75, 150),
    it('4.2', 'Pintura de fachada (textura + acrílica)', 'm²', 4200, 38, 26, 'propria', 'Equipe própria', 120, 185),
    it('5.1', 'Limpeza final e desmobilização', 'vb', 1, 15000, 11000, 'propria', 'Equipe própria', 185, 200),
  ];
  const [mob, and, lav, trin, cob, res, past] = itens;

  const medicoes: Medicao[] = [];
  const med = (item: ItemOrcamento, dia: number, p: number) =>
    medicoes.push({ id: uid(), data: d(dia), itemId: item.id, percentual: p });
  med(mob, 10, 70);
  med(mob, 16, 100);
  med(and, 30, 10);
  med(and, 60, 28);
  med(and, 95, 45);
  med(lav, 30, 25);
  med(lav, 55, 70);
  med(lav, 70, 100);
  med(trin, 55, 15);
  med(trin, 80, 40);
  med(trin, 97, 58);
  med(cob, 55, 20);
  med(cob, 80, 70);
  med(cob, 95, 92);
  med(res, 95, 25);
  med(past, 95, 12);

  const lancamentos: Lancamento[] = [];
  const desp = (dia: number, item: ItemOrcamento | null, categoria: Lancamento['categoria'], descricao: string, valor: number) =>
    lancamentos.push({ id: uid(), data: d(dia), tipo: 'despesa', itemId: item?.id, categoria, descricao, valor });
  const rec = (dia: number, descricao: string, valor: number) =>
    lancamentos.push({ id: uid(), data: d(dia), tipo: 'receita', categoria: 'medicao', descricao, valor });

  desp(5, mob, 'mao_obra_propria', 'Folha – mobilização', 9800);
  desp(12, mob, 'material', 'Tapumes e telas de proteção', 13400);
  for (let m = 0; m < 4; m++) desp(10 + m * 30, and, 'equipamento', `Locação balancins – mês ${m + 1}`, 7600);
  desp(30, lav, 'mao_obra_propria', 'Folha – lavagem', 18500);
  desp(60, lav, 'mao_obra_propria', 'Folha – lavagem', 17200);
  desp(35, lav, 'equipamento', 'Lavadoras de alta pressão', 4200);
  desp(55, trin, 'material', 'Argamassa polimérica e tela', 21000);
  desp(80, trin, 'terceirizado', 'Recupera Engenharia – medição 1', 26000);
  desp(95, trin, 'mao_obra_propria', 'Folha – tratamento de trincas', 19000);
  desp(55, cob, 'terceirizado', 'ImperTec – sinal', 25000);
  desp(85, cob, 'terceirizado', 'ImperTec – medição 1', 38000);
  desp(95, cob, 'material', 'Manta asfáltica adicional', 14500);
  desp(96, res, 'terceirizado', 'ImperTec – reservatórios sinal', 9000);
  desp(92, past, 'material', 'Pastilhas e argamassa colante', 31000);
  desp(97, past, 'mao_obra_propria', 'Folha – pastilhas', 12000);
  for (let m = 0; m < 3; m++) desp(28 + m * 30, null, 'administrativo', `Engenheiro residente / ART – mês ${m + 1}`, 8500);

  rec(5, 'Adiantamento contratual (10%)', 77000);
  rec(35, 'Medição 01', 52000);
  rec(65, 'Medição 02', 70000);
  rec(95, 'Medição 03', 98000);

  const obra: Obra = {
    id: uid(),
    nome: 'Exemplo – Cond. Edifício Atlântico (fachada e impermeabilização)',
    cliente: 'Condomínio Edifício Atlântico',
    endereco: 'Av. Beira Mar, 1500 – Centro',
    numeroContrato: 'CT-2026/014',
    valorContrato: itens.reduce((s, i) => s + i.quantidade * i.precoUnitario, 0),
    dataInicio: ini,
    dataFim: d(200),
    status: 'em_andamento',
    observacoes: 'Obra de exemplo para demonstração do aplicativo.',
    itens,
    medicoes,
    lancamentos,
    criadoEm: hoje,
  };
  const contrato: DadosContrato = {
    ...contratoVazio(),
    dataAssinatura: addDias(ini, -10),
    prazoDias: 201,
    adiantamentoPct: 10,
    periodicidade: 'mensal',
    prazoPagamentoDias: 15,
    retencaoPct: 5,
    multaAtrasoPctDia: 0.1,
    multaLimitePct: 10,
    reajuste: 'INCC-DI anual',
    garantia: '5 anos',
    condicoesPagamento:
      'Adiantamento de 10% na assinatura, amortizado proporcionalmente nas medições. Medições mensais até o último dia do mês, pagas em 15 dias após a aprovação e emissão da nota fiscal. Retenção técnica de 5% de cada medição, devolvida no recebimento definitivo.',
    clausulas: 'Andaimes e proteções por conta da contratada. Água e energia fornecidas pelo condomínio. ART de execução obrigatória.',
  };
  contrato.parcelas = gerarParcelas(obra, contrato);

  // Fachadas (10 pavimentos) e produção do diário para as etapas de fachada.
  const locais = locaisPadrao(10, 4200);
  const ids = locais.map((l) => l.id);
  const comLocais = itens.map((i) =>
    ['2.1', '2.2', '4.2'].includes(i.codigo) ? { ...i, locais: ids } : i.codigo === '4.1' ? { ...i, locais: ids.slice(0, 2) } : i,
  );
  let parcial: Obra = { ...obra, itens: comLocais, locais, apontamentos: [] };
  const registrar = (codigo: string, localIdx: number, dia: number, prumadas: number[], de: number, ate: number, equipe: string) => {
    const item = parcial.itens.find((i) => i.codigo === codigo)!;
    const r = apontamentoDeTrecho(parcial, item, locais[localIdx], d(dia), prumadas, de, ate, { equipe });
    if (r.apontamento) parcial = { ...parcial, apontamentos: [...parcial.apontamentos!, r.apontamento] };
  };
  // Lavagem: todas as fachadas, uma prumada por vez
  locais.forEach((l, li) => {
    for (let p = 1; p <= l.prumadas; p++) registrar('2.1', li, 18 + li * 12 + p, [p], 10, 1, 'Equipe própria – lavagem');
  });
  // Pastilhas: começo da fachada frente
  registrar('4.1', 0, 88, [1], 10, 7, 'Encarregado Marcos');
  registrar('4.1', 0, 95, [2], 10, 7, 'Encarregado Marcos');

  return { ...parcial, contrato };
}
