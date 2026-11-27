import { analisarObra, fluxoCaixa, type AnaliseObra } from './calc';
import { analisarContrato, type AnaliseContrato } from './contrato';
import { addDias } from './format';
import { gerarRecomendacoes, saudeObra, type Gravidade, type Recomendacao } from './recomendacoes';
import type { Obra, Parcela } from './types';

export interface LinhaCarteira {
  obra: Obra;
  a: AnaliseObra;
  ac: AnaliseContrato;
  saude: Gravidade;
  recs: Recomendacao[];
}

export interface Carteira {
  linhas: LinhaCarteira[];
  ativas: LinhaCarteira[];
  contratos: number;
  planejado: number; // % ponderado pelo valor do contrato
  executado: number;
  receitas: number;
  despesas: number;
  aReceber: number;
  vencido: number;
  qtdVencidas: number;
  margemPrevista: number;
  margemProjetada: number;
  multa: number;
  porSaude: Record<'ok' | 'atencao' | 'critico', number>;
}

export function analisarCarteira(obras: Obra[], data: string): Carteira {
  const linhas = obras.map((obra) => {
    const a = analisarObra(obra, data);
    const ac = analisarContrato(obra, data, a.diasAtrasoProjetado, a.medidoVenda);
    return { obra, a, ac, saude: saudeObra(a), recs: gerarRecomendacoes(obra, a) };
  });
  const ativas = linhas.filter((l) => l.obra.status !== 'concluida');
  const soma = (f: (l: LinhaCarteira) => number) => ativas.reduce((s, l) => s + f(l), 0);
  const contratos = soma((l) => l.a.valorContrato);
  const porSaude = { ok: 0, atencao: 0, critico: 0 };
  for (const l of ativas) if (l.saude in porSaude) porSaude[l.saude as keyof typeof porSaude]++;
  return {
    linhas,
    ativas,
    contratos,
    planejado: contratos ? soma((l) => l.a.planejado * l.a.valorContrato) / contratos : 0,
    executado: contratos ? soma((l) => l.a.executado * l.a.valorContrato) / contratos : 0,
    receitas: soma((l) => l.a.receitas),
    despesas: soma((l) => l.a.despesas),
    aReceber: soma((l) => l.a.aReceber),
    vencido: soma((l) => l.ac.vencidoNaoRecebido),
    qtdVencidas: soma((l) => l.ac.qtdVencidas),
    margemPrevista: soma((l) => l.a.margemPrevista),
    margemProjetada: soma((l) => l.a.margemProjetada),
    multa: soma((l) => l.ac.multaEstimada),
    porSaude,
  };
}

export interface MesConsolidado {
  mes: string;
  receitas: number;
  despesas: number;
  receitaPrevista: number;
  custoPrevisto: number;
  saldoAcumulado: number;
}

/** Fluxo de caixa mensal somando todas as obras. */
export function fluxoConsolidado(obras: Obra[]): MesConsolidado[] {
  const mapa = new Map<string, MesConsolidado>();
  for (const o of obras) {
    for (const p of fluxoCaixa(o)) {
      const m = mapa.get(p.mes) ?? { mes: p.mes, receitas: 0, despesas: 0, receitaPrevista: 0, custoPrevisto: 0, saldoAcumulado: 0 };
      m.receitas += p.receitas;
      m.despesas += p.despesas;
      m.receitaPrevista += p.receitaPrevista;
      m.custoPrevisto += p.custoPrevisto;
      mapa.set(p.mes, m);
    }
  }
  let acum = 0;
  return [...mapa.values()]
    .sort((a, b) => (a.mes < b.mes ? -1 : 1))
    .map((m) => {
      acum += m.receitas - m.despesas;
      return { ...m, saldoAcumulado: acum };
    });
}

export interface ParcelaCarteira {
  obra: Obra;
  parcela: Parcela;
  aberto: number;
  vencida: boolean;
  dias: number;
}

/** Parcelas vencidas e as que vencem nos próximos `dias` dias, de todas as obras. */
export function recebimentos(linhas: LinhaCarteira[], data: string, dias = 45): ParcelaCarteira[] {
  const limite = addDias(data, dias);
  const out: ParcelaCarteira[] = [];
  for (const l of linhas) {
    for (const x of l.ac.parcelas) {
      const aberto = x.parcela.valor - x.recebido;
      if (aberto < 0.5) continue;
      if (x.situacao === 'vencida' || x.parcela.dataPrevista <= limite) {
        out.push({ obra: l.obra, parcela: x.parcela, aberto, vencida: x.situacao === 'vencida', dias: x.diasAtraso });
      }
    }
  }
  return out.sort((a, b) => (a.parcela.dataPrevista < b.parcela.dataPrevista ? -1 : 1));
}
