import { useMemo, useState } from 'react';
import type { AnaliseObra } from '../lib/calc';
import { fmtData, fmtMoeda, fmtPct, hojeISO, uid } from '../lib/format';
import { importarFinanceiro, paraNumero } from '../lib/importar';
import type { Lancamento, Obra } from '../lib/types';
import { CATEGORIAS_DESPESA, CATEGORIAS_RECEITA, ROTULO_CATEGORIA } from '../lib/types';
import Importador from './Importador';
import { Kpi } from './ui';
import ReceitasDespesas from './ReceitasDespesas';

type Props = { obra: Obra; analise: AnaliseObra; atualizar: (fn: (o: Obra) => Obra) => void };

const vazio = (): Omit<Lancamento, 'id' | 'valor'> & { valor: string } => ({
  data: hojeISO(),
  tipo: 'despesa',
  itemId: '',
  categoria: 'material',
  descricao: '',
  valor: '',
});

export default function Financeiro({ obra, analise: a, atualizar }: Props) {
  const [f, setF] = useState(vazio);
  const [filtroTipo, setFiltroTipo] = useState<'todos' | 'despesa' | 'receita'>('todos');
  const [filtroItem, setFiltroItem] = useState('');

  const salvar = () => {
    const valor = paraNumero(f.valor);
    if (!valor || !f.data) return;
    const l: Lancamento = { ...f, id: uid(), valor: Math.abs(valor), itemId: f.itemId || undefined };
    atualizar((o) => ({ ...o, lancamentos: [...o.lancamentos, l] }));
    setF((x) => ({ ...vazio(), data: x.data, tipo: x.tipo, categoria: x.categoria, itemId: x.itemId }));
  };

  const lista = useMemo(
    () =>
      [...obra.lancamentos]
        .filter((l) => filtroTipo === 'todos' || l.tipo === filtroTipo)
        .filter((l) => !filtroItem || (filtroItem === '_sem' ? !l.itemId : l.itemId === filtroItem))
        .sort((x, y) => (x.data < y.data ? 1 : -1)),
    [obra.lancamentos, filtroTipo, filtroItem],
  );


  const nomeItem = (id?: string) => {
    if (!id) return <span className="muted">sem etapa</span>;
    const i = obra.itens.find((x) => x.id === id);
    return i ? `${i.codigo} ${i.descricao}` : <span className="muted">(excluída)</span>;
  };

  return (
    <>
      <div className="grade g4" style={{ marginBottom: '1rem' }}>
        <Kpi rotulo="Recebido do cliente" valor={fmtMoeda(a.receitas)} sub={`${fmtPct((a.receitas / (a.valorContrato || 1)) * 100)} do contrato`} tom="info" />
        <Kpi rotulo="Gasto na obra" valor={fmtMoeda(a.despesas)} sub={`${fmtPct((a.despesas / (a.custoPrevistoTotal || 1)) * 100)} do custo orçado`} tom="info" />
        <Kpi
          rotulo="Encontro de contas"
          valor={<span className={a.saldoCaixa < 0 ? 'neg' : 'pos'}>{fmtMoeda(a.saldoCaixa)}</span>}
          sub={a.saldoCaixa < 0 ? 'Deficitário: a empresa está bancando a obra' : 'Superavitário'}
          tom={a.saldoCaixa < 0 ? 'atencao' : 'ok'}
        />
        <Kpi rotulo="A receber pelo executado" valor={fmtMoeda(a.aReceber)} sub="Executado (preço de venda) − recebido" tom={a.aReceber > 0 ? 'atencao' : 'ok'} />
      </div>

      <ReceitasDespesas obra={obra} analise={a} />

      <div className="card">
        <div className="linha entre">
          <div>
            <h2>Novo lançamento</h2>
            <div className="linha" style={{ margin: '.3rem 0' }}>
              <button className={`btn mini ${f.tipo === 'receita' ? '' : 'sec'}`} onClick={() => setF((x) => ({ ...x, tipo: 'receita', categoria: 'medicao', itemId: '' }))}>
                + Receita (recebimento do cliente)
              </button>
              <button className={`btn mini ${f.tipo === 'despesa' ? '' : 'sec'}`} onClick={() => setF((x) => ({ ...x, tipo: 'despesa', categoria: 'material' }))}>
                + Despesa (custo)
              </button>
            </div>
            <div className="muted peq">Apropriar cada despesa a uma etapa da planilha permite comparar gasto x orçado por etapa.</div>
          </div>
          <Importador
            tipo="financeiro"
            rotulo="Importar planilha de custos"
            aoImportar={(linhas) => {
              const { registros, avisos } = importarFinanceiro(obra, linhas);
              const chave = (l: Lancamento) => `${l.data}|${l.tipo}|${l.valor.toFixed(2)}|${l.descricao}`;
              const existentes = new Set(obra.lancamentos.map(chave));
              const novos = registros.filter((r) => !existentes.has(chave(r)));
              if (novos.length < registros.length) avisos.unshift(`${registros.length - novos.length} lançamento(s) já existiam e foram ignorados (mesma data, tipo, valor e descrição).`);
              atualizar((o) => ({ ...o, lancamentos: [...o.lancamentos, ...novos] }));
              return { qtd: novos.length, avisos };
            }}
          />
        </div>
        <div className="form" style={{ marginTop: '.75rem' }}>
          <label className="campo">
            Tipo
            <select
              value={f.tipo}
              onChange={(e) => {
                const tipo = e.target.value as Lancamento['tipo'];
                setF((x) => ({ ...x, tipo, categoria: tipo === 'receita' ? 'medicao' : 'material' }));
              }}
            >
              <option value="despesa">Despesa (saída)</option>
              <option value="receita">Receita (entrada)</option>
            </select>
          </label>
          <label className="campo">
            Data
            <input type="date" value={f.data} onChange={(e) => setF((x) => ({ ...x, data: e.target.value }))} />
          </label>
          <label className="campo">
            Categoria
            <select value={f.categoria} onChange={(e) => setF((x) => ({ ...x, categoria: e.target.value as Lancamento['categoria'] }))}>
              {(f.tipo === 'despesa' ? CATEGORIAS_DESPESA : CATEGORIAS_RECEITA).map((c) => (
                <option key={c} value={c}>
                  {ROTULO_CATEGORIA[c]}
                </option>
              ))}
            </select>
          </label>
          <label className="campo">
            Etapa da planilha
            <select value={f.itemId} onChange={(e) => setF((x) => ({ ...x, itemId: e.target.value }))}>
              <option value="">— sem etapa / indireto —</option>
              {obra.itens.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.codigo} {i.descricao}
                </option>
              ))}
            </select>
          </label>
          <label className="campo largo">
            Descrição
            <input value={f.descricao} onChange={(e) => setF((x) => ({ ...x, descricao: e.target.value }))} placeholder="Fornecedor, nota fiscal, medição nº..." />
          </label>
          <label className="campo">
            Valor (R$)
            <input inputMode="decimal" value={f.valor} onChange={(e) => setF((x) => ({ ...x, valor: e.target.value }))} onKeyDown={(e) => e.key === 'Enter' && salvar()} />
          </label>
          <div className="campo" style={{ justifyContent: 'flex-end' }}>
            <button className="btn" onClick={salvar}>
              Lançar
            </button>
          </div>
        </div>
      </div>

      <div className="card">
          <h2>Gasto x orçado por etapa</h2>
          <div className="tabela-wrap">
            <table>
              <thead>
                <tr>
                  <th>Etapa</th>
                  <th className="num">Orçado</th>
                  <th className="num">Gasto</th>
                  <th className="num">% gasto</th>
                  <th className="num">% físico</th>
                  <th className="num">Saldo</th>
                </tr>
              </thead>
              <tbody>
                {a.itens.map((x) => {
                  const pg = x.custoPrevisto ? (x.gasto / x.custoPrevisto) * 100 : 0;
                  return (
                    <tr key={x.item.id}>
                      <td>
                        <b>{x.item.codigo}</b> {x.item.descricao}
                      </td>
                      <td className="num">{fmtMoeda(x.custoPrevisto)}</td>
                      <td className="num">{fmtMoeda(x.gasto)}</td>
                      <td className={`num ${pg > x.executado + 10 ? 'neg' : ''}`}>{fmtPct(pg, 0)}</td>
                      <td className="num">{fmtPct(x.executado, 0)}</td>
                      <td className={`num ${x.custoPrevisto - x.gasto < 0 ? 'neg' : ''}`}>{fmtMoeda(x.custoPrevisto - x.gasto)}</td>
                    </tr>
                  );
                })}
                {a.despesasSemEtapa > 0 && (
                  <tr>
                    <td className="muted">Despesas sem etapa (indiretas)</td>
                    <td className="num">—</td>
                    <td className="num">{fmtMoeda(a.despesasSemEtapa)}</td>
                    <td colSpan={3}></td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="muted peq" style={{ marginTop: '.4rem' }}>
            Em vermelho: etapas em que o % do orçamento já gasto supera o % executado em mais de 10 pontos.
          </div>
        </div>

      <div className="card">
        <div className="linha entre">
          <h2>Lançamentos ({lista.length})</h2>
          <div className="linha">
            <select value={filtroTipo} onChange={(e) => setFiltroTipo(e.target.value as typeof filtroTipo)} style={{ width: 'auto' }}>
              <option value="todos">Todos</option>
              <option value="despesa">Despesas</option>
              <option value="receita">Receitas</option>
            </select>
            <select value={filtroItem} onChange={(e) => setFiltroItem(e.target.value)} style={{ width: 'auto', maxWidth: 260 }}>
              <option value="">Todas as etapas</option>
              <option value="_sem">Sem etapa</option>
              {obra.itens.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.codigo} {i.descricao}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="tabela-wrap" style={{ maxHeight: 480 }}>
          <table>
            <thead>
              <tr>
                <th>Data</th>
                <th>Tipo</th>
                <th>Categoria</th>
                <th>Etapa</th>
                <th>Descrição</th>
                <th className="num">Valor</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {lista.map((l) => (
                <tr key={l.id}>
                  <td>{fmtData(l.data)}</td>
                  <td className={l.tipo === 'receita' ? 'pos' : 'neg'}>{l.tipo === 'receita' ? 'Receita' : 'Despesa'}</td>
                  <td className="peq">{ROTULO_CATEGORIA[l.categoria] ?? l.categoria}</td>
                  <td className="peq">
                    <select
                      value={l.itemId ?? ''}
                      onChange={(e) =>
                        atualizar((o) => ({
                          ...o,
                          lancamentos: o.lancamentos.map((x) => (x.id === l.id ? { ...x, itemId: e.target.value || undefined } : x)),
                        }))
                      }
                      style={{ maxWidth: 220 }}
                      title="Apropriar a uma etapa"
                    >
                      <option value="">— sem etapa —</option>
                      {obra.itens.map((i) => (
                        <option key={i.id} value={i.id}>
                          {i.codigo} {i.descricao}
                        </option>
                      ))}
                    </select>
                    {l.itemId && !obra.itens.some((i) => i.id === l.itemId) && nomeItem(l.itemId)}
                  </td>
                  <td>{l.descricao}</td>
                  <td className={`num ${l.tipo === 'receita' ? 'pos' : ''}`}>{fmtMoeda(l.valor)}</td>
                  <td>
                    <button className="btn perigo mini" onClick={() => atualizar((o) => ({ ...o, lancamentos: o.lancamentos.filter((x) => x.id !== l.id) }))}>
                      ✕
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
