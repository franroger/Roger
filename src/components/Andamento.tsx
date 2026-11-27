import { useState } from 'react';
import type { AnaliseObra } from '../lib/calc';
import { executadoItem } from '../lib/calc';
import { fmtData, fmtPct, hojeISO, uid } from '../lib/format';
import { importarAndamento, paraNumero } from '../lib/importar';
import type { Medicao, Obra } from '../lib/types';
import Importador from './Importador';
import { BarraAvanco } from './ui';

type Props = { obra: Obra; analise: AnaliseObra; atualizar: (fn: (o: Obra) => Obra) => void };

export default function Andamento({ obra, analise, atualizar }: Props) {
  const [data, setData] = useState(hojeISO());
  const [valores, setValores] = useState<Record<string, string>>({});
  const [obs, setObs] = useState('');
  const [msg, setMsg] = useState('');

  if (!obra.itens.length) return <div className="card vazio">Cadastre a planilha orçamentária antes de lançar o andamento.</div>;

  const registrar = () => {
    const novos: Medicao[] = [];
    for (const [itemId, txt] of Object.entries(valores)) {
      if (txt.trim() === '') continue;
      novos.push({ id: uid(), data, itemId, percentual: Math.min(100, Math.max(0, paraNumero(txt))), observacao: obs || undefined });
    }
    if (!novos.length) {
      setMsg('Informe o % acumulado de pelo menos uma etapa.');
      return;
    }
    atualizar((o) => ({
      ...o,
      // substitui registro da mesma etapa na mesma data
      medicoes: [...o.medicoes.filter((m) => !novos.some((n) => n.itemId === m.itemId && n.data === m.data)), ...novos],
    }));
    setValores({});
    setObs('');
    setMsg(`${novos.length} etapa(s) atualizada(s) em ${fmtData(data)}.`);
  };

  const historico = [...obra.medicoes].sort((a, b) => (a.data < b.data ? 1 : a.data > b.data ? -1 : 0));
  const nomeItem = (id: string) => {
    const i = obra.itens.find((x) => x.id === id);
    return i ? `${i.codigo} ${i.descricao}` : '(etapa excluída)';
  };

  return (
    <>
      <div className="card">
        <div className="linha entre">
          <div>
            <h2>Registrar andamento</h2>
            <div className="muted peq">
              Informe o percentual <b>acumulado</b> executado de cada etapa (dos relatórios de campo). Deixe em branco as que não mudaram.
            </div>
          </div>
          <Importador
            tipo="andamento"
            rotulo="Importar relatório de andamento"
            aoImportar={(linhas) => {
              const { registros, avisos } = importarAndamento(obra, linhas);
              atualizar((o) => ({
                ...o,
                medicoes: [...o.medicoes.filter((m) => !registros.some((n) => n.itemId === m.itemId && n.data === m.data)), ...registros],
              }));
              return { qtd: registros.length, avisos };
            }}
          />
        </div>
        <div className="linha" style={{ margin: '.75rem 0' }}>
          <label className="campo" style={{ maxWidth: 180 }}>
            Data do relatório
            <input type="date" value={data} onChange={(e) => setData(e.target.value)} />
          </label>
          <label className="campo espaco">
            Observação (opcional)
            <input value={obs} onChange={(e) => setObs(e.target.value)} placeholder="Ex.: chuva paralisou 2 dias" />
          </label>
        </div>
        <div className="tabela-wrap">
          <table>
            <thead>
              <tr>
                <th>Etapa</th>
                <th>Período previsto</th>
                <th className="num">Previsto hoje</th>
                <th className="num">Último executado</th>
                <th style={{ minWidth: 120 }}></th>
                <th className="num">Novo % acumulado</th>
              </tr>
            </thead>
            <tbody>
              {analise.itens.map((x) => {
                const atual = executadoItem(obra, x.item.id, data);
                return (
                  <tr key={x.item.id}>
                    <td>
                      <b>{x.item.codigo}</b> {x.item.descricao}
                    </td>
                    <td className="peq">
                      {fmtData(x.item.inicioPrevisto)} a {fmtData(x.item.fimPrevisto)}
                    </td>
                    <td className="num">{fmtPct(x.planejado, 0)}</td>
                    <td className="num">{fmtPct(atual, 0)}</td>
                    <td>
                      <BarraAvanco planejado={x.planejado} executado={atual} />
                    </td>
                    <td className="num">
                      <input
                        inputMode="decimal"
                        style={{ width: 80, textAlign: 'right' }}
                        placeholder={String(Math.round(atual))}
                        value={valores[x.item.id] ?? ''}
                        onChange={(e) => setValores((v) => ({ ...v, [x.item.id]: e.target.value }))}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="linha" style={{ marginTop: '.75rem' }}>
          <button className="btn" onClick={registrar}>
            Salvar andamento
          </button>
          {msg && <span className="peq muted">{msg}</span>}
        </div>
      </div>

      <div className="card">
        <h2>Histórico de andamento ({historico.length})</h2>
        {historico.length === 0 ? (
          <div className="muted">Nenhum registro ainda.</div>
        ) : (
          <div className="tabela-wrap" style={{ maxHeight: 420 }}>
            <table>
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Etapa</th>
                  <th className="num">% acumulado</th>
                  <th>Observação</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {historico.map((m) => (
                  <tr key={m.id}>
                    <td>{fmtData(m.data)}</td>
                    <td>{nomeItem(m.itemId)}</td>
                    <td className="num">{fmtPct(m.percentual, 0)}</td>
                    <td className="peq muted">{m.observacao}</td>
                    <td>
                      <button
                        className="btn perigo mini"
                        onClick={() => atualizar((o) => ({ ...o, medicoes: o.medicoes.filter((x) => x.id !== m.id) }))}
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
