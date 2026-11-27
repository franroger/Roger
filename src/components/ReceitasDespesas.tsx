import { useMemo } from 'react';
import { Bar, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { AnaliseObra } from '../lib/calc';
import { fluxoCaixa } from '../lib/calc';
import { fmtMoeda, fmtMoedaCurta, fmtPct, rotuloMes } from '../lib/format';
import type { Obra } from '../lib/types';
import { ROTULO_CATEGORIA } from '../lib/types';

/** Comparativo de receitas x despesas da obra: resumo, mês a mês e por categoria. */
export default function ReceitasDespesas({ obra, analise: a }: { obra: Obra; analise: AnaliseObra }) {
  const meses = useMemo(() => fluxoCaixa(obra), [obra]);
  const mesAtual = a.data.slice(0, 7);
  const dados = meses.map((m) => ({ ...m, rot: rotuloMes(m.mes) }));

  const receitaPrevAteHoje = meses.filter((m) => m.mes <= mesAtual).reduce((s, m) => s + m.receitaPrevista, 0);
  const custoPrevAteHoje = meses.filter((m) => m.mes <= mesAtual).reduce((s, m) => s + m.custoPrevisto, 0);

  const porCat = (tipo: 'receita' | 'despesa') => {
    const m = new Map<string, number>();
    for (const l of obra.lancamentos) if (l.tipo === tipo && l.data <= a.data) m.set(l.categoria, (m.get(l.categoria) ?? 0) + l.valor);
    return [...m.entries()].sort((x, y) => y[1] - x[1]);
  };
  const recCat = porCat('receita');
  const despCat = porCat('despesa');

  const resultadoAtual = a.receitas - a.despesas;
  const resultadoFinal = a.valorContrato - a.custoProjetado;

  return (
    <>
      <div className="card">
        <h2>Receitas x despesas da obra</h2>
        <div className="tabela-wrap">
          <table>
            <thead>
              <tr>
                <th></th>
                <th className="num">Receitas (cliente)</th>
                <th className="num">Despesas (custos)</th>
                <th className="num">Resultado</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Total da obra (contrato x custo orçado)</td>
                <td className="num">{fmtMoeda(a.valorContrato)}</td>
                <td className="num">{fmtMoeda(a.custoPrevistoTotal)}</td>
                <td className={`num ${a.margemPrevista < 0 ? 'neg' : 'pos'}`}>{fmtMoeda(a.margemPrevista)}</td>
              </tr>
              <tr>
                <td>Previsto até este mês (pelo cronograma)</td>
                <td className="num">{fmtMoeda(receitaPrevAteHoje)}</td>
                <td className="num">{fmtMoeda(custoPrevAteHoje)}</td>
                <td className={`num ${receitaPrevAteHoje - custoPrevAteHoje < 0 ? 'neg' : 'pos'}`}>{fmtMoeda(receitaPrevAteHoje - custoPrevAteHoje)}</td>
              </tr>
              <tr style={{ fontWeight: 600 }}>
                <td>Realizado até hoje</td>
                <td className="num">{fmtMoeda(a.receitas)}</td>
                <td className="num">{fmtMoeda(a.despesas)}</td>
                <td className={`num ${resultadoAtual < 0 ? 'neg' : 'pos'}`}>
                  {fmtMoeda(resultadoAtual)} {resultadoAtual < 0 ? '(deficitário)' : '(superavitário)'}
                </td>
              </tr>
              <tr>
                <td>Falta receber / falta gastar</td>
                <td className="num">{fmtMoeda(Math.max(0, a.valorContrato - a.receitas))}</td>
                <td className="num">{fmtMoeda(Math.max(0, a.custoProjetado - a.despesas))}</td>
                <td className="num muted peq">gasto restante pela projeção</td>
              </tr>
              <tr>
                <td>Projeção no fim da obra</td>
                <td className="num">{fmtMoeda(a.valorContrato)}</td>
                <td className="num">{fmtMoeda(a.custoProjetado)}</td>
                <td className={`num ${resultadoFinal < 0 ? 'neg' : 'pos'}`}>
                  {fmtMoeda(resultadoFinal)} ({fmtPct((resultadoFinal / (a.valorContrato || 1)) * 100)})
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div className="muted peq" style={{ marginTop: '.4rem' }}>
          Recebido {fmtPct((a.receitas / (a.valorContrato || 1)) * 100)} do contrato, com {fmtPct(a.executado)} da obra executada.
          {a.receitas < receitaPrevAteHoje * 0.9 && ' Recebimento abaixo do previsto no cronograma.'}
          {a.despesas > custoPrevAteHoje * 1.1 && ' Gastos acima do previsto para o período.'}
        </div>
      </div>

      <div className="card">
        <h2>Mês a mês</h2>
        <div style={{ height: 280 }}>
          <ResponsiveContainer>
            <ComposedChart data={dados} margin={{ left: 10, right: 10, top: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e8ecf0" />
              <XAxis dataKey="rot" fontSize={11} />
              <YAxis tickFormatter={fmtMoedaCurta} fontSize={11} width={70} />
              <Tooltip formatter={(v: number) => fmtMoeda(v)} />
              <Legend />
              <Bar dataKey="receitas" name="Receita realizada" fill="#1f8a4c" />
              <Bar dataKey="despesas" name="Despesa realizada" fill="#c0392b" />
              <Line dataKey="receitaPrevista" name="Receita prevista" stroke="#1f8a4c" strokeDasharray="5 4" dot={false} />
              <Line dataKey="custoPrevisto" name="Despesa prevista" stroke="#c0392b" strokeDasharray="5 4" dot={false} />
              <Line dataKey="saldoAcumulado" name="Saldo acumulado" stroke="#1f5f8b" strokeWidth={2} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        <div className="tabela-wrap">
          <table>
            <thead>
              <tr>
                <th>Mês</th>
                <th className="num">Receita prevista</th>
                <th className="num">Receita realizada</th>
                <th className="num">Despesa prevista</th>
                <th className="num">Despesa realizada</th>
                <th className="num">Saldo do mês</th>
                <th className="num">Saldo acumulado</th>
              </tr>
            </thead>
            <tbody>
              {meses.map((m) => {
                const futuro = m.mes > mesAtual;
                return (
                  <tr key={m.mes} style={futuro ? { color: 'var(--muted)' } : undefined}>
                    <td>
                      {rotuloMes(m.mes)}
                      {m.mes === mesAtual && <span className="tag info" style={{ marginLeft: 6 }}>atual</span>}
                    </td>
                    <td className="num">{fmtMoeda(m.receitaPrevista)}</td>
                    <td className="num">{futuro ? '—' : fmtMoeda(m.receitas)}</td>
                    <td className="num">{fmtMoeda(m.custoPrevisto)}</td>
                    <td className="num">{futuro ? '—' : fmtMoeda(m.despesas)}</td>
                    <td className={`num ${futuro ? '' : m.saldoMes < 0 ? 'neg' : 'pos'}`}>{futuro ? '—' : fmtMoeda(m.saldoMes)}</td>
                    <td className={`num ${futuro ? '' : m.saldoAcumulado < 0 ? 'neg' : 'pos'}`}>{futuro ? '—' : fmtMoeda(m.saldoAcumulado)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grade g2">
        <div className="card">
          <h2>Receitas por tipo</h2>
          <TabelaCat linhas={recCat} total={a.receitas} vazio="Nenhuma receita lançada." />
        </div>
        <div className="card">
          <h2>Despesas por categoria</h2>
          <TabelaCat linhas={despCat} total={a.despesas} vazio="Nenhuma despesa lançada." />
        </div>
      </div>
    </>
  );
}

function TabelaCat({ linhas, total, vazio }: { linhas: [string, number][]; total: number; vazio: string }) {
  if (!linhas.length) return <div className="muted">{vazio}</div>;
  return (
    <table>
      <tbody>
        {linhas.map(([c, v]) => (
          <tr key={c}>
            <td>{ROTULO_CATEGORIA[c] ?? c}</td>
            <td className="num">{fmtMoeda(v)}</td>
            <td className="num muted">{fmtPct((v / (total || 1)) * 100, 0)}</td>
          </tr>
        ))}
      </tbody>
      <tfoot>
        <tr>
          <td>Total</td>
          <td className="num">{fmtMoeda(total)}</td>
          <td />
        </tr>
      </tfoot>
    </table>
  );
}
