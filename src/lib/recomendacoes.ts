import type { AnaliseObra } from './calc';
import { diffDias, fmtData, fmtMoeda, fmtPct } from './format';
import type { Obra } from './types';

export type Gravidade = 'critico' | 'atencao' | 'info' | 'ok';
export type Area = 'planejamento' | 'financeiro' | 'controle';

export interface Recomendacao {
  gravidade: Gravidade;
  area: Area;
  titulo: string;
  detalhe: string;
  acao: string;
}

const ordem: Record<Gravidade, number> = { critico: 0, atencao: 1, info: 2, ok: 3 };

export function gerarRecomendacoes(obra: Obra, a: AnaliseObra): Recomendacao[] {
  const r: Recomendacao[] = [];
  const emCurso = a.planejado > 0 || a.executado > 0;

  if (obra.itens.length === 0) {
    return [
      {
        gravidade: 'info',
        area: 'planejamento',
        titulo: 'Cadastre a planilha orçamentária',
        detalhe: 'Sem etapas cadastradas não é possível acompanhar cronograma nem custos.',
        acao: 'Vá em "Orçamento e cronograma" e cadastre as etapas ou importe a planilha do Excel.',
      },
    ];
  }

  // ---------- PLANEJAMENTO / PRAZO ----------
  if (a.spi !== null && emCurso) {
    if (a.spi < 0.85) {
      r.push({
        gravidade: 'critico',
        area: 'planejamento',
        titulo: `Obra atrasada: executado ${fmtPct(a.executado)} contra ${fmtPct(a.planejado)} previsto`,
        detalhe: `Índice de prazo (IDP) ${a.spi.toFixed(2)}. Mantido o ritmo atual, o término vai para ${fmtData(
          a.terminoProjetado ?? undefined,
        )} (${a.diasAtrasoProjetado} dias após o contrato).`,
        acao: 'Montar plano de recuperação: aumentar equipe ou turnos nas etapas críticas listadas abaixo, e avaliar terceirizar frentes que estão com equipe própria.',
      });
    } else if (a.spi < 0.95) {
      r.push({
        gravidade: 'atencao',
        area: 'planejamento',
        titulo: `Ritmo um pouco abaixo do cronograma (IDP ${a.spi.toFixed(2)})`,
        detalhe: `Executado ${fmtPct(a.executado)} contra ${fmtPct(a.planejado)} previsto até ${fmtData(a.data)}.`,
        acao: 'Revisar a programação semanal das frentes atrasadas antes que o desvio aumente.',
      });
    } else if (a.spi > 1.1) {
      r.push({
        gravidade: 'ok',
        area: 'planejamento',
        titulo: `Obra adiantada (IDP ${a.spi.toFixed(2)})`,
        detalhe: `Executado ${fmtPct(a.executado)} contra ${fmtPct(a.planejado)} previsto.`,
        acao: 'Antecipar a medição com o cliente para melhorar o caixa.',
      });
    }
  }

  const atrasados = a.itens
    .filter((x) => x.situacaoPrazo === 'atrasado' || x.situacaoPrazo === 'nao_iniciado')
    .sort((x, y) => x.desvioFisico * x.peso - y.desvioFisico * y.peso);
  for (const x of atrasados.slice(0, 6)) {
    const vencido = x.item.fimPrevisto && x.item.fimPrevisto < a.data;
    const resp = x.item.responsavel ? ` (${x.item.responsavel})` : '';
    const terc = x.item.execucao === 'terceirizada';
    r.push({
      gravidade: vencido || x.desvioFisico < -20 ? 'critico' : 'atencao',
      area: 'planejamento',
      titulo:
        x.situacaoPrazo === 'nao_iniciado'
          ? `"${x.item.descricao}" ainda não começou`
          : `"${x.item.descricao}" atrasada ${Math.abs(x.desvioFisico).toFixed(0)} pontos`,
      detalhe: `Previsto ${fmtPct(x.planejado, 0)}, executado ${fmtPct(x.executado, 0)}${resp}. ${
        vencido ? `Prazo da etapa venceu em ${fmtData(x.item.fimPrevisto)}.` : `Término previsto ${fmtData(x.item.fimPrevisto)}.`
      }`,
      acao: terc
        ? 'Cobrar do terceirizado um plano de recuperação com efetivo e datas; aplicar cláusula contratual se houver.'
        : x.item.execucao === 'propria'
          ? 'Reforçar a equipe própria nesta frente ou contratar apoio terceirizado para recuperar o prazo.'
          : 'Reequilibrar a divisão entre equipe própria e terceirizado nesta etapa.',
    });
  }

  if (emCurso && a.ultimaMedicao) {
    const dias = diffDias(a.ultimaMedicao, a.data);
    if (dias > 15) {
      r.push({
        gravidade: 'atencao',
        area: 'controle',
        titulo: `Andamento sem atualização há ${dias} dias`,
        detalhe: `Último registro em ${fmtData(a.ultimaMedicao)}. A análise pode estar desatualizada.`,
        acao: 'Importar os relatórios de andamento mais recentes do aplicativo de campo.',
      });
    }
  } else if (a.planejado > 0 && !a.ultimaMedicao) {
    r.push({
      gravidade: 'atencao',
      area: 'controle',
      titulo: 'Nenhum andamento registrado',
      detalhe: `O cronograma prevê ${fmtPct(a.planejado)} executado até hoje, mas não há registros de avanço.`,
      acao: 'Registrar ou importar o andamento físico das etapas.',
    });
  }

  // ---------- FINANCEIRO / CUSTO ----------
  if (a.cpi !== null) {
    if (a.cpi < 0.9) {
      r.push({
        gravidade: 'critico',
        area: 'financeiro',
        titulo: `Gasto acima do previsto para o que foi executado (IDC ${a.cpi.toFixed(2)})`,
        detalhe: `Para cada R$ 1,00 de serviço executado (pelo custo orçado) estão sendo gastos ${fmtMoeda(1 / a.cpi)}.`,
        acao: 'Auditar as etapas com maior estouro (abaixo): produtividade das equipes, desperdício de material e aditivos de terceirizados.',
      });
    } else if (a.cpi < 0.97) {
      r.push({
        gravidade: 'atencao',
        area: 'financeiro',
        titulo: `Custo levemente acima do orçado (IDC ${a.cpi.toFixed(2)})`,
        detalhe: 'O desvio ainda é pequeno, mas tende a crescer até o fim da obra.',
        acao: 'Acompanhar semanalmente as etapas com IDC abaixo de 1.',
      });
    }
  }

  if (a.margemProjetada < 0) {
    r.push({
      gravidade: 'critico',
      area: 'financeiro',
      titulo: `Projeção de PREJUÍZO de ${fmtMoeda(-a.margemProjetada)}`,
      detalhe: `Custo projetado no término ${fmtMoeda(a.custoProjetado)} contra contrato de ${fmtMoeda(a.valorContrato)}.`,
      acao: 'Negociar aditivo com o cliente para serviços extras, renegociar com fornecedores/terceirizados e cortar custos indiretos.',
    });
  } else if (a.margemPrevista > 0 && a.margemProjetada < a.margemPrevista * 0.6) {
    r.push({
      gravidade: 'atencao',
      area: 'financeiro',
      titulo: 'Margem da obra sendo consumida',
      detalhe: `Margem prevista ${fmtMoeda(a.margemPrevista)}; projetada ${fmtMoeda(a.margemProjetada)}.`,
      acao: 'Rever custos das etapas com estouro e verificar se há serviços fora do escopo que merecem aditivo.',
    });
  }

  const estouros = a.itens
    .filter((x) => x.gasto > 0 && x.desvioCustoProjetado > Math.max(500, x.custoPrevisto * 0.05))
    .sort((x, y) => y.desvioCustoProjetado - x.desvioCustoProjetado);
  for (const x of estouros.slice(0, 6)) {
    const jaEstourou = x.gasto > x.custoPrevisto;
    r.push({
      gravidade: jaEstourou || (x.cpi !== null && x.cpi < 0.8) ? 'critico' : 'atencao',
      area: 'financeiro',
      titulo: jaEstourou
        ? `"${x.item.descricao}" já passou do orçado`
        : `"${x.item.descricao}" vai estourar o orçamento`,
      detalhe: `Orçado ${fmtMoeda(x.custoPrevisto)}, gasto ${fmtMoeda(x.gasto)} com ${fmtPct(
        x.executado,
        0,
      )} executado. Projeção no término: ${fmtMoeda(x.custoProjetado)} (+${fmtMoeda(x.desvioCustoProjetado)}).`,
      acao:
        x.item.execucao === 'terceirizada'
          ? 'Conferir as medições pagas ao terceirizado contra o executado; não pagar à frente do avanço físico.'
          : 'Verificar produtividade da equipe, horas extras e perdas de material nesta etapa.',
    });
  }

  if (a.saldoCaixa < 0) {
    r.push({
      gravidade: a.aReceber > 0 ? 'atencao' : 'critico',
      area: 'financeiro',
      titulo: `Caixa da obra deficitário em ${fmtMoeda(-a.saldoCaixa)}`,
      detalhe: `Recebido ${fmtMoeda(a.receitas)}, gasto ${fmtMoeda(a.despesas)}.`,
      acao:
        a.aReceber > 0
          ? `Há ${fmtMoeda(a.aReceber)} executado e ainda não recebido: emitir/cobrar a medição do cliente.`
          : 'A empresa está financiando a obra. Negociar adiantamento ou antecipar medições.',
    });
  } else if (a.receitas > 0) {
    r.push({
      gravidade: 'ok',
      area: 'financeiro',
      titulo: `Caixa superavitário em ${fmtMoeda(a.saldoCaixa)}`,
      detalhe: `Recebido ${fmtMoeda(a.receitas)}, gasto ${fmtMoeda(a.despesas)}.`,
      acao: 'Manter o ritmo de medições. Reservar o saldo para as etapas finais.',
    });
  }

  if (a.aReceber > a.valorContrato * 0.05 && a.saldoCaixa >= 0) {
    r.push({
      gravidade: 'info',
      area: 'financeiro',
      titulo: `${fmtMoeda(a.aReceber)} executado ainda não faturado/recebido`,
      detalhe: 'O avanço físico supera o que foi recebido do cliente.',
      acao: 'Emitir a próxima medição.',
    });
  }

  if (a.despesas > 0 && a.despesasSemEtapa / a.despesas > 0.15) {
    r.push({
      gravidade: 'info',
      area: 'controle',
      titulo: `${fmtPct((a.despesasSemEtapa / a.despesas) * 100, 0)} das despesas sem etapa vinculada`,
      detalhe: `${fmtMoeda(a.despesasSemEtapa)} não estão apropriados a nenhuma etapa da planilha.`,
      acao: 'Apropriar as despesas às etapas (coluna "Etapa" na planilha de custos) para que a análise por etapa fique correta.',
    });
  }

  const pe = a.porExecucao;
  const cpiP = pe.propria.gasto > 0 ? pe.propria.valorAgregado / pe.propria.gasto : null;
  const cpiT = pe.terceirizada.gasto > 0 ? pe.terceirizada.valorAgregado / pe.terceirizada.gasto : null;
  if (cpiP !== null && cpiT !== null && Math.abs(cpiP - cpiT) > 0.15) {
    const melhor = cpiP > cpiT ? 'equipe própria' : 'terceirizados';
    const pior = cpiP > cpiT ? 'terceirizados' : 'equipe própria';
    r.push({
      gravidade: 'info',
      area: 'financeiro',
      titulo: `Serviços com ${melhor} estão mais eficientes que com ${pior}`,
      detalhe: `IDC equipe própria ${cpiP.toFixed(2)} x terceirizados ${cpiT.toFixed(2)}.`,
      acao: `Avaliar migrar frentes restantes para ${melhor} ou renegociar preços com ${pior}.`,
    });
  }

  if (r.length === 0) {
    r.push({
      gravidade: 'ok',
      area: 'planejamento',
      titulo: 'Obra dentro do prazo e do custo',
      detalhe: 'Nenhum desvio relevante identificado.',
      acao: 'Continuar atualizando andamento e custos semanalmente.',
    });
  }

  return r.sort((x, y) => ordem[x.gravidade] - ordem[y.gravidade]);
}

export function saudeObra(a: AnaliseObra): Gravidade {
  const prazoRuim = a.spi !== null && a.spi < 0.85;
  const custoRuim = (a.cpi !== null && a.cpi < 0.9) || a.margemProjetada < 0;
  if (prazoRuim || custoRuim) return 'critico';
  if ((a.spi !== null && a.spi < 0.95) || (a.cpi !== null && a.cpi < 0.97) || a.saldoCaixa < 0) return 'atencao';
  return 'ok';
}
