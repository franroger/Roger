import { useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { AnaliseObra } from '../lib/calc';
import { curvaS, fluxoCaixa } from '../lib/calc';
import { gerarRecomendacoes, type Area } from '../lib/recomendacoes';
import { fmtData, fmtMoeda, fmtMoedaCurta, fmtPct, rotuloMes } from '../lib/format';
import type { Obra } from '../lib/types';
import { ROTULO_EXECUCAO } from '../lib/types';
import { BarraAvanco, Kpi, Tag, indiceTom } from './ui';

const ROT_AREA: Record<Area, string> = { planejamento: 'Planejamento', financeiro: 'Financeiro', controle: 'Controle' };
const SIT: Record<string, [string, 'ok' | 'atencao' | 'critico' | 'info' | 'neutro']> = {
  concluido: ['Concluída', 'ok'],
  em_dia: ['Em dia', 'ok'],
  adiantado: ['Adiantada', 'info'],
  atrasado: ['Atrasada', 'critico'],
  nao_iniciado: ['Não iniciada', 'atencao'],
  futuro: ['A iniciar', 'neutro'],
};

export default function Painel({ obra, analise: a, irPara }: { obra: Obra; analise: AnaliseObra; irPara: (aba: 'orcamento' | 'andamento' | 'financeiro') => void }) {
  const recs = useMemo(() => gerarRecomendacoes(obra, a), [obra, a]);
  const [filtro, setFiltro] = useState<Area | 'todas'>('todas');
  const curva = useMemo(() => curvaS(obra, a.data).map((p) => ({ ...p, rot: rotuloMes(p.mes) })), [obra, a.data]);
  const fluxo = useMemo(() => fluxoCaixa(obra).map((p) => ({ ...p, rot: rotuloMes(p.mes) })), [obra]);
  const custoEtapas = a.itens.map((x) => ({
    nome: x.item.codigo || x.item.descricao.slice(0, 14),
    descricao: x.item.descricao,
    Orçado: x.custoPrevisto,
    'Valor agregado': x.valorAgregado,
    Gasto: x.gasto,
    Projetado: x.custoProjetado,
  }));

  if (obra.itens.length === 0) {
    return (
      <div className="card vazio">
        <h2>Comece pela planilha orçamentária</h2>
        <p>Cadastre as etapas com quantidades, preços, custos e datas previstas (ou importe do Excel).</p>
        <button className="btn" onClick={() => irPara('orcamento')}>
          Ir para Orçamento e cronograma
        </button>
      </div>
    );
  }

  const recsVis = recs.filter((r) => filtro === 'todas' || r.area === filtro);

  return (
    <>
      <div className="grade g4" style={{ marginBottom: '1rem' }}>
        <Kpi
          rotulo="Avanço físico"
          valor={`${fmtPct(a.executado)}`}
          sub={<>Previsto {fmtPct(a.planejado)} · prazo decorrido {fmtPct(a.prazoDecorrido, 0)}</>}
          tom={indiceTom(a.spi, 0.95, 0.85)}
        />
        <Kpi
          rotulo="Índice de prazo (IDP)"
          valor={a.spi === null ? '—' : a.spi.toFixed(2)}
          sub={
            a.terminoProjetado ? (
              <>
                Término projetado {fmtData(a.terminoProjetado)}
                {a.diasAtrasoProjetado > 0 ? <b className="neg"> (+{a.diasAtrasoProjetado} d)</b> : a.diasAtrasoProjetado < 0 ? <b className="pos"> ({a.diasAtrasoProjetado} d)</b> : null}
              </>
            ) : (
              '—'
            )
          }
          tom={indiceTom(a.spi, 0.95, 0.85)}
        />
        <Kpi
          rotulo="Índice de custo (IDC)"
          valor={a.cpi === null ? '—' : a.cpi.toFixed(2)}
          sub={a.cpi === null ? 'Sem despesas apropriadas às etapas' : a.cpi >= 1 ? 'Gastando dentro do orçado' : 'Gastando acima do orçado'}
          tom={indiceTom(a.cpi)}
        />
        <Kpi
          rotulo="Encontro de contas (caixa)"
          valor={<span className={a.saldoCaixa < 0 ? 'neg' : 'pos'}>{fmtMoeda(a.saldoCaixa)}</span>}
          sub={<>{a.saldoCaixa < 0 ? 'Deficitário' : 'Superavitário'} · recebido {fmtMoedaCurta(a.receitas)} · gasto {fmtMoedaCurta(a.despesas)}</>}
          tom={a.saldoCaixa < 0 ? 'atencao' : 'ok'}
        />
        <Kpi rotulo="Executado não recebido" valor={fmtMoeda(a.aReceber)} sub={`Valor executado (venda) ${fmtMoedaCurta(a.medidoVenda)}`} tom={a.aReceber > 0 ? 'info' : 'ok'} />
        <Kpi rotulo="Custo orçado" valor={fmtMoeda(a.custoPrevistoTotal)} sub={`Margem prevista ${fmtMoeda(a.margemPrevista)} (${fmtPct((a.margemPrevista / (a.valorContrato || 1)) * 100)})`} />
        <Kpi
          rotulo="Custo projetado no término"
          valor={fmtMoeda(a.custoProjetado)}
          sub={<>Desvio {fmtMoeda(a.custoProjetado - a.custoPrevistoTotal)} sobre o orçado</>}
          tom={a.custoProjetado > a.custoPrevistoTotal * 1.03 ? 'atencao' : 'ok'}
        />
        <Kpi
          rotulo="Margem projetada"
          valor={<span className={a.margemProjetada < 0 ? 'neg' : ''}>{fmtMoeda(a.margemProjetada)}</span>}
          sub={`${fmtPct((a.margemProjetada / (a.valorContrato || 1)) * 100)} do contrato`}
          tom={a.margemProjetada < 0 ? 'critico' : a.margemProjetada < a.margemPrevista * 0.6 ? 'atencao' : 'ok'}
        />
      </div>

      <div className="card">
        <div className="linha entre">
          <h2>Recomendações</h2>
          <div className="linha peq">
            {(['todas', 'planejamento', 'financeiro', 'controle'] as const).map((f) => (
              <button key={f} className={`btn mini ${filtro === f ? '' : 'sec'}`} onClick={() => setFiltro(f)}>
                {f === 'todas' ? 'Todas' : ROT_AREA[f]}
              </button>
            ))}
          </div>
        </div>
        {recsVis.map((r, k) => (
          <div key={k} className={`rec ${r.gravidade}`}>
            <div className="linha entre">
              <span className="tit">{r.titulo}</span>
              <Tag tom="neutro">{ROT_AREA[r.area]}</Tag>
            </div>
            <div className="muted peq">{r.detalhe}</div>
            <div className="acao">
              <b>O que fazer:</b> {r.acao}
            </div>
          </div>
        ))}
        {recsVis.length === 0 && <div className="muted">Nada nesta área.</div>}
      </div>

      <div className="grade g2">
        <div className="card">
          <h2>Curva S – avanço físico acumulado</h2>
          <div style={{ height: 260 }}>
            <ResponsiveContainer>
              <LineChart data={curva} margin={{ left: -10, right: 10, top: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e8ecf0" />
                <XAxis dataKey="rot" fontSize={11} />
                <YAxis domain={[0, 100]} unit="%" fontSize={11} />
                <Tooltip formatter={(v: number) => fmtPct(v)} />
                <Legend />
                <Line type="monotone" dataKey="planejado" name="Previsto" stroke="#9aaebf" strokeWidth={2} strokeDasharray="5 4" dot={false} />
                <Line type="monotone" dataKey="executado" name="Executado" stroke="#1f5f8b" strokeWidth={3} connectNulls={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="card">
          <h2>Fluxo de caixa mensal</h2>
          <div style={{ height: 260 }}>
            <ResponsiveContainer>
              <ComposedChart data={fluxo} margin={{ left: 10, right: 10, top: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e8ecf0" />
                <XAxis dataKey="rot" fontSize={11} />
                <YAxis tickFormatter={fmtMoedaCurta} fontSize={11} width={70} />
                <Tooltip formatter={(v: number) => fmtMoeda(v)} />
                <Legend />
                <Bar dataKey="receitas" name="Recebido" fill="#1f8a4c" />
                <Bar dataKey="despesas" name="Gasto" fill="#c0392b" />
                <Line dataKey="custoPrevisto" name="Custo previsto (cronograma)" stroke="#b26a00" strokeDasharray="5 4" dot={false} />
                <Line dataKey="saldoAcumulado" name="Saldo acumulado" stroke="#1f5f8b" strokeWidth={2} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="card">
        <h2>Custo por etapa da planilha</h2>
        <div className="muted peq">Valor agregado = quanto do custo orçado já “vale” pelo que foi executado. Gasto acima do valor agregado = estouro.</div>
        <div style={{ height: 300 }}>
          <ResponsiveContainer>
            <BarChart data={custoEtapas} margin={{ left: 10, right: 10, top: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e8ecf0" />
              <XAxis dataKey="nome" fontSize={11} />
              <YAxis tickFormatter={fmtMoedaCurta} fontSize={11} width={70} />
              <Tooltip formatter={(v: number) => fmtMoeda(v)} labelFormatter={(_, p) => p?.[0]?.payload?.descricao ?? ''} />
              <Legend />
              <Bar dataKey="Orçado" fill="#c9d6e2" />
              <Bar dataKey="Valor agregado" fill="#1f5f8b" />
              <Bar dataKey="Gasto" fill="#c0392b" />
              <Bar dataKey="Projetado" fill="#b26a00" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="card">
        <h2>Situação por etapa</h2>
        <div className="tabela-wrap">
          <table>
            <thead>
              <tr>
                <th>Etapa</th>
                <th>Execução</th>
                <th>Situação</th>
                <th style={{ minWidth: 120 }}>Físico (exec./prev.)</th>
                <th className="num">Orçado</th>
                <th className="num">Gasto</th>
                <th className="num">IDC</th>
                <th className="num">Projetado</th>
                <th className="num">Desvio</th>
              </tr>
            </thead>
            <tbody>
              {a.itens.map((x) => {
                const [rot, tom] = SIT[x.situacaoPrazo];
                return (
                  <tr key={x.item.id}>
                    <td>
                      <b>{x.item.codigo}</b> {x.item.descricao}
                      {x.item.responsavel && <div className="muted peq">{x.item.responsavel}</div>}
                    </td>
                    <td className="peq">{ROTULO_EXECUCAO[x.item.execucao]}</td>
                    <td>
                      <Tag tom={tom}>{rot}</Tag>
                    </td>
                    <td>
                      <div className="peq">
                        {fmtPct(x.executado, 0)} / {fmtPct(x.planejado, 0)}
                      </div>
                      <BarraAvanco planejado={x.planejado} executado={x.executado} />
                    </td>
                    <td className="num">{fmtMoeda(x.custoPrevisto)}</td>
                    <td className="num">{fmtMoeda(x.gasto)}</td>
                    <td className="num">
                      {x.cpi === null ? '—' : <span className={x.cpi < 0.9 ? 'neg' : x.cpi >= 1 ? 'pos' : ''}>{x.cpi.toFixed(2)}</span>}
                    </td>
                    <td className="num">{fmtMoeda(x.custoProjetado)}</td>
                    <td className={`num ${x.desvioCustoProjetado > 0.5 ? 'neg' : 'pos'}`}>{fmtMoeda(x.desvioCustoProjetado)}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={4}>Total das etapas{a.despesasSemEtapa > 0 && <span className="muted peq"> (+ {fmtMoeda(a.despesasSemEtapa)} de despesas sem etapa)</span>}</td>
                <td className="num">{fmtMoeda(a.custoPrevistoTotal)}</td>
                <td className="num">{fmtMoeda(a.itens.reduce((s, x) => s + x.gasto, 0))}</td>
                <td className="num">{a.cpi === null ? '—' : a.cpi.toFixed(2)}</td>
                <td className="num">{fmtMoeda(a.itens.reduce((s, x) => s + x.custoProjetado, 0))}</td>
                <td className="num">{fmtMoeda(a.itens.reduce((s, x) => s + x.desvioCustoProjetado, 0))}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      <div className="card">
        <h2>Equipe própria x terceirizados</h2>
        <div className="tabela-wrap">
          <table>
            <thead>
              <tr>
                <th>Tipo de execução</th>
                <th className="num">Custo orçado</th>
                <th className="num">Valor agregado</th>
                <th className="num">Gasto</th>
                <th className="num">IDC</th>
              </tr>
            </thead>
            <tbody>
              {(Object.keys(a.porExecucao) as (keyof typeof a.porExecucao)[])
                .filter((k) => a.porExecucao[k].custoPrevisto > 0 || a.porExecucao[k].gasto > 0)
                .map((k) => {
                  const g = a.porExecucao[k];
                  const idc = g.gasto > 0 ? g.valorAgregado / g.gasto : null;
                  return (
                    <tr key={k}>
                      <td>{ROTULO_EXECUCAO[k]}</td>
                      <td className="num">{fmtMoeda(g.custoPrevisto)}</td>
                      <td className="num">{fmtMoeda(g.valorAgregado)}</td>
                      <td className="num">{fmtMoeda(g.gasto)}</td>
                      <td className="num">{idc === null ? '—' : idc.toFixed(2)}</td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
