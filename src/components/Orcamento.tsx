import { useMemo, useState } from 'react';
import type { ItemOrcamento, Obra, TipoExecucao } from '../lib/types';
import { ROTULO_EXECUCAO } from '../lib/types';
import { cronogramaFinanceiro, custoPrevisto, executadoItem, valorVenda } from '../lib/calc';
import { diffDias, fmtData, fmtMoeda, fmtNum, fmtPct, rotuloMes, uid } from '../lib/format';
import { importarOrcamento, paraNumero } from '../lib/importar';
import Importador from './Importador';
import { BotaoConfirmar } from './ui';

type Props = { obra: Obra; atualizar: (fn: (o: Obra) => Obra) => void; dataRef: string };

function novoItem(obra: Obra): ItemOrcamento {
  return {
    id: uid(),
    codigo: String(obra.itens.length + 1),
    descricao: '',
    unidade: 'm²',
    quantidade: 1,
    precoUnitario: 0,
    custoUnitario: 0,
    execucao: 'propria',
    responsavel: '',
    inicioPrevisto: obra.dataInicio,
    fimPrevisto: obra.dataFim,
  };
}

function CampoNum({ valor, aoMudar }: { valor: number; aoMudar: (n: number) => void }) {
  const [txt, setTxt] = useState<string | null>(null);
  return (
    <input
      inputMode="decimal"
      style={{ textAlign: 'right', width: 95 }}
      value={txt ?? fmtNum(valor)}
      onFocus={() => setTxt(valor ? String(valor).replace('.', ',') : '')}
      onChange={(e) => setTxt(e.target.value)}
      onBlur={() => {
        if (txt !== null) aoMudar(paraNumero(txt));
        setTxt(null);
      }}
    />
  );
}

export default function Orcamento({ obra, atualizar, dataRef }: Props) {
  const [visao, setVisao] = useState<'planilha' | 'gantt' | 'fisfin'>('planilha');

  const mudar = (id: string, patch: Partial<ItemOrcamento>) =>
    atualizar((o) => ({ ...o, itens: o.itens.map((i) => (i.id === id ? { ...i, ...patch } : i)) }));
  const remover = (id: string) => {
    atualizar((o) => ({
      ...o,
      itens: o.itens.filter((i) => i.id !== id),
      medicoes: o.medicoes.filter((m) => m.itemId !== id),
      lancamentos: o.lancamentos.map((l) => (l.itemId === id ? { ...l, itemId: undefined } : l)),
    }));
  };

  const totVenda = obra.itens.reduce((s, i) => s + valorVenda(i), 0);
  const totCusto = obra.itens.reduce((s, i) => s + custoPrevisto(i), 0);

  return (
    <>
      <div className="card">
        <div className="linha entre">
          <div>
            <h2>Planilha orçamentária e cronograma</h2>
            <div className="muted peq">
              Cada etapa tem preço de venda (contrato), custo previsto (o que a empresa espera gastar), tipo de execução e o período previsto no cronograma.
            </div>
          </div>
          <Importador
            tipo="orcamento"
            aoImportar={(linhas) => {
              const { registros, avisos } = importarOrcamento(linhas);
              // As etapas importadas são acrescentadas às existentes.
              atualizar((o) => ({ ...o, itens: [...o.itens, ...registros] }));
              return { qtd: registros.length, avisos };
            }}
          />
        </div>
        <div className="linha" style={{ margin: '.75rem 0' }}>
          {(
            [
              ['planilha', 'Planilha'],
              ['gantt', 'Cronograma (Gantt)'],
              ['fisfin', 'Físico-financeiro mensal'],
            ] as const
          ).map(([k, r]) => (
            <button key={k} className={`btn mini ${visao === k ? '' : 'sec'}`} onClick={() => setVisao(k)}>
              {r}
            </button>
          ))}
          <span className="espaco" />
          <span className="peq">
            Venda <b>{fmtMoeda(totVenda)}</b> · Custo <b>{fmtMoeda(totCusto)}</b> · Margem{' '}
            <b className={totVenda - totCusto < 0 ? 'neg' : 'pos'}>
              {fmtMoeda(totVenda - totCusto)} ({fmtPct(totVenda ? ((totVenda - totCusto) / totVenda) * 100 : 0)})
            </b>
          </span>
        </div>
        {obra.valorContrato > 0 && Math.abs(obra.valorContrato - totVenda) > 1 && obra.itens.length > 0 && (
          <div className="aviso">
            A soma da planilha ({fmtMoeda(totVenda)}) difere do valor do contrato ({fmtMoeda(obra.valorContrato)}). Os valores executados são ajustados proporcionalmente ao contrato.
          </div>
        )}

        {visao === 'planilha' && (
          <div className="tabela-wrap">
            <table>
              <thead>
                <tr>
                  <th>Código</th>
                  <th style={{ minWidth: 220 }}>Descrição da etapa</th>
                  <th>Un.</th>
                  <th className="num">Quant.</th>
                  <th className="num">Preço unit.</th>
                  <th className="num">Custo unit.</th>
                  <th className="num">Total venda</th>
                  <th className="num">Total custo</th>
                  <th>Execução</th>
                  <th style={{ minWidth: 160 }}>Responsável / terceirizado</th>
                  <th>Início</th>
                  <th>Fim</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {obra.itens.map((i) => (
                  <tr key={i.id}>
                    <td>
                      <input style={{ width: 60 }} value={i.codigo} onChange={(e) => mudar(i.id, { codigo: e.target.value })} />
                    </td>
                    <td>
                      <input value={i.descricao} placeholder="Descrição" onChange={(e) => mudar(i.id, { descricao: e.target.value })} />
                    </td>
                    <td>
                      <input style={{ width: 55 }} value={i.unidade} onChange={(e) => mudar(i.id, { unidade: e.target.value })} />
                    </td>
                    <td>
                      <CampoNum valor={i.quantidade} aoMudar={(n) => mudar(i.id, { quantidade: n })} />
                    </td>
                    <td>
                      <CampoNum valor={i.precoUnitario} aoMudar={(n) => mudar(i.id, { precoUnitario: n })} />
                    </td>
                    <td>
                      <CampoNum valor={i.custoUnitario} aoMudar={(n) => mudar(i.id, { custoUnitario: n })} />
                    </td>
                    <td className="num">{fmtMoeda(valorVenda(i))}</td>
                    <td className="num">{fmtMoeda(custoPrevisto(i))}</td>
                    <td>
                      <select value={i.execucao} onChange={(e) => mudar(i.id, { execucao: e.target.value as TipoExecucao })}>
                        {Object.entries(ROTULO_EXECUCAO).map(([k, v]) => (
                          <option key={k} value={k}>
                            {v}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <input value={i.responsavel} onChange={(e) => mudar(i.id, { responsavel: e.target.value })} />
                    </td>
                    <td>
                      <input type="date" value={i.inicioPrevisto} onChange={(e) => mudar(i.id, { inicioPrevisto: e.target.value })} />
                    </td>
                    <td>
                      <input
                        type="date"
                        value={i.fimPrevisto}
                        min={i.inicioPrevisto}
                        onChange={(e) => mudar(i.id, { fimPrevisto: e.target.value })}
                        style={i.fimPrevisto && obra.dataFim && i.fimPrevisto > obra.dataFim ? { borderColor: 'var(--bad)' } : undefined}
                        title={i.fimPrevisto > obra.dataFim ? 'Termina depois do prazo do contrato' : ''}
                      />
                    </td>
                    <td>
                      <BotaoConfirmar className="btn perigo mini" confirmar="Excluir?" aoConfirmar={() => remover(i.id)} title="Excluir etapa (andamentos dela são apagados; lançamentos ficam sem etapa)">
                        ✕
                      </BotaoConfirmar>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={6}>Total</td>
                  <td className="num">{fmtMoeda(totVenda)}</td>
                  <td className="num">{fmtMoeda(totCusto)}</td>
                  <td colSpan={5}></td>
                </tr>
              </tfoot>
            </table>
            <button className="btn" style={{ marginTop: '.75rem' }} onClick={() => atualizar((o) => ({ ...o, itens: [...o.itens, novoItem(o)] }))}>
              + Adicionar etapa
            </button>
          </div>
        )}

        {visao === 'gantt' && <Gantt obra={obra} dataRef={dataRef} />}
        {visao === 'fisfin' && <FisicoFinanceiro obra={obra} />}
      </div>
    </>
  );
}

function Gantt({ obra, dataRef }: { obra: Obra; dataRef: string }) {
  const itens = obra.itens.filter((i) => i.inicioPrevisto && i.fimPrevisto);
  if (!itens.length) return <div className="vazio">Cadastre datas de início e fim nas etapas.</div>;
  let ini = obra.dataInicio || itens[0].inicioPrevisto;
  let fim = obra.dataFim || itens[0].fimPrevisto;
  for (const i of itens) {
    if (i.inicioPrevisto < ini) ini = i.inicioPrevisto;
    if (i.fimPrevisto > fim) fim = i.fimPrevisto;
  }
  const total = Math.max(1, diffDias(ini, fim) + 1);
  const pos = (d: string) => (diffDias(ini, d) / total) * 100;
  const meses: { rot: string; left: number }[] = [];
  {
    const [a, m] = ini.split('-').map(Number);
    let ano = a;
    let mes = m;
    for (let k = 0; k < 60; k++) {
      const iso = `${ano}-${String(mes).padStart(2, '0')}-01`;
      if (iso > fim) break;
      if (iso >= ini) meses.push({ rot: rotuloMes(iso.slice(0, 7)), left: pos(iso) });
      mes++;
      if (mes > 12) {
        mes = 1;
        ano++;
      }
    }
  }
  const hojePos = dataRef >= ini && dataRef <= fim ? pos(dataRef) : null;
  const fimContrato = obra.dataFim && obra.dataFim >= ini && obra.dataFim <= fim ? pos(obra.dataFim) : null;

  return (
    <>
      <div className="legenda" style={{ marginBottom: '.5rem' }}>
        <span><i style={{ background: '#c9d6e2' }} />Período previsto</span>
        <span><i style={{ background: 'var(--brand)' }} />Executado (própria)</span>
        <span><i style={{ background: '#7b4fa0' }} />Executado (terceirizado)</span>
        <span><i style={{ background: '#2a8c8c' }} />Executado (misto)</span>
        <span><i style={{ background: 'var(--bad)', width: 3 }} />Data de referência</span>
      </div>
      <div className="tabela-wrap">
        <div className="gantt">
          <div className="g-meses">
            <div />
            <div className="m">
              {meses.map((m) => (
                <span key={m.rot} style={{ left: `${m.left}%` }}>
                  {m.rot}
                </span>
              ))}
            </div>
          </div>
          {itens.map((i) => {
            const exec = executadoItem(obra, i.id, dataRef);
            return (
              <div className="g-linha" key={i.id}>
                <div className="g-nome" title={`${i.descricao} — ${fmtData(i.inicioPrevisto)} a ${fmtData(i.fimPrevisto)}`}>
                  <b>{i.codigo}</b> {i.descricao}
                </div>
                <div className="g-trilha">
                  {hojePos !== null && <div className="g-hoje" style={{ left: `${hojePos}%` }} />}
                  {fimContrato !== null && <div className="g-hoje" style={{ left: `${fimContrato}%`, background: '#333', opacity: 0.35 }} title="Fim do contrato" />}
                  <div
                    className={`g-bar ${i.execucao}`}
                    style={{ left: `${pos(i.inicioPrevisto)}%`, width: `${Math.max(0.5, ((diffDias(i.inicioPrevisto, i.fimPrevisto) + 1) / total) * 100)}%` }}
                    title={`${fmtPct(exec, 0)} executado`}
                  >
                    <i style={{ width: `${exec}%` }} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}

function FisicoFinanceiro({ obra }: { obra: Obra }) {
  const { meses, linhas, totais } = useMemo(() => cronogramaFinanceiro(obra), [obra]);
  const totalGeral = totais.reduce((s, v) => s + v, 0);
  let acum = 0;
  if (!meses.length) return <div className="vazio">Defina as datas da obra e das etapas.</div>;
  return (
    <div className="tabela-wrap">
      <table>
        <thead>
          <tr>
            <th style={{ minWidth: 200 }}>Etapa</th>
            {meses.map((m) => (
              <th key={m} className="num">
                {rotuloMes(m)}
              </th>
            ))}
            <th className="num">Total</th>
          </tr>
        </thead>
        <tbody>
          {linhas.map((l) => (
            <tr key={l.item.id}>
              <td>
                <b>{l.item.codigo}</b> {l.item.descricao}
              </td>
              {l.porMes.map((v, k) => (
                <td key={k} className="num" style={v > 0 ? { background: '#eef4f9' } : undefined}>
                  {v > 0.5 ? fmtMoeda(v) : ''}
                </td>
              ))}
              <td className="num">{fmtMoeda(valorVenda(l.item))}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td>Total do mês</td>
            {totais.map((v, k) => (
              <td key={k} className="num">
                {fmtMoeda(v)}
              </td>
            ))}
            <td className="num">{fmtMoeda(totalGeral)}</td>
          </tr>
          <tr>
            <td>% acumulado previsto</td>
            {totais.map((v, k) => {
              acum += v;
              return (
                <td key={k} className="num">
                  {fmtPct(totalGeral ? (acum / totalGeral) * 100 : 0)}
                </td>
              );
            })}
            <td />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
