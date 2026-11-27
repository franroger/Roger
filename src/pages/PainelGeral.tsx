import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { novaObraVazia, useStore } from '../lib/store';
import { analisarCarteira, fluxoConsolidado, recebimentos, type LinhaCarteira } from '../lib/carteira';
import { fmtData, fmtMoeda, fmtMoedaCurta, fmtPct, hojeISO, rotuloMes } from '../lib/format';
import { ROTULO_STATUS, type Obra } from '../lib/types';
import type { Recomendacao } from '../lib/recomendacoes';
import { BarraAvanco, Kpi, Modal, ROTULO_SAUDE, Tag, indiceTom } from '../components/ui';
import ObraForm from '../components/ObraForm';
import { obrasExemplo } from '../lib/demoCarteira';

/* Cores dos gráficos (paleta validada para daltonismo). */
const COR = {
  receita: '#257de0',
  despesa: '#f47230',
  saldo: '#1d2733',
  previsto: '#84b9f3',
  executado: '#1b64be',
  grade: '#e8ecf0',
  texto: '#5f6b7a',
};

type Aba = 'painel' | 'contrato' | 'orcamento' | 'andamento' | 'financeiro';
type Filtro = 'ativas' | 'todas' | 'concluida';
type Coluna = 'nome' | 'executado' | 'spi' | 'cpi' | 'saldo' | 'vencido' | 'margem' | 'termino' | 'saude';

const ORDEM_SAUDE = { critico: 0, atencao: 1, ok: 2, info: 3 };

/** Para qual aba da obra levar cada alerta. */
function abaDoAlerta(r: Recomendacao): Aba {
  if (/parcela|multa|prazo contratual|contrato/i.test(r.titulo)) return 'contrato';
  if (r.area === 'financeiro') return 'financeiro';
  if (r.area === 'controle') return /andamento/i.test(r.titulo) ? 'andamento' : 'financeiro';
  return 'painel';
}

/** Nome sem o prefixo "Exemplo –" e sem a descrição entre parênteses. */
const nomeCurto = (o: Obra) => {
  const n = o.nome.replace(/^Exemplo\s*[–-]\s*/i, '').replace(/\s*\(.*\)\s*$/, '').trim() || o.nome;
  return n.length > 30 ? `${n.slice(0, 28)}…` : n;
};

export default function PainelGeral() {
  const { obras, salvarObra } = useStore();
  const navegar = useNavigate();
  const [nova, setNova] = useState(false);
  const [filtro, setFiltro] = useState<Filtro>('ativas');
  const [ordem, setOrdem] = useState<{ col: Coluna; asc: boolean }>({ col: 'saude', asc: true });
  const hoje = hojeISO();

  const abrir = (o: Obra, aba: Aba = 'painel') => navegar(`/obra/${o.id}`, { state: { aba } });

  const visiveis = useMemo(
    () => obras.filter((o) => (filtro === 'todas' ? true : filtro === 'concluida' ? o.status === 'concluida' : o.status !== 'concluida')),
    [obras, filtro],
  );
  const cart = useMemo(() => analisarCarteira(visiveis.length ? visiveis : [], hoje), [visiveis, hoje]);
  // Nos totais, "ativas" já exclui concluídas; com o filtro de concluídas, usar todas as linhas.
  const base = filtro === 'concluida' ? cart.linhas : cart.ativas;
  const fluxo = useMemo(
    () =>
      fluxoConsolidado(base.map((l) => l.obra)).map((m) => {
        const futuro = m.mes > hoje.slice(0, 7);
        return { ...m, rot: rotuloMes(m.mes), receitas: futuro ? null : m.receitas, despesas: futuro ? null : m.despesas, saldoAcumulado: futuro ? null : m.saldoAcumulado };
      }),
    [base, hoje],
  );
  const parcelas = useMemo(() => recebimentos(base, hoje), [base, hoje]);

  const alertas = useMemo(
    () => {
      // Dentro de cada gravidade, alterna entre as obras para nenhuma dominar a lista.
      const itens = base.flatMap((l) =>
        l.recs.filter((r) => r.gravidade === 'critico' || r.gravidade === 'atencao').map((r, k) => ({ l, r, k })),
      );
      return itens.sort((x, y) => ORDEM_SAUDE[x.r.gravidade] - ORDEM_SAUDE[y.r.gravidade] || x.k - y.k);
    },
    [base],
  );
  const [verTodos, setVerTodos] = useState(false);

  const linhasOrdenadas = useMemo(() => {
    const val = (l: LinhaCarteira): number | string => {
      switch (ordem.col) {
        case 'nome': return l.obra.nome.toLowerCase();
        case 'executado': return l.a.executado;
        case 'spi': return l.a.spi ?? 9;
        case 'cpi': return l.a.cpi ?? 9;
        case 'saldo': return l.a.saldoCaixa;
        case 'vencido': return l.ac.vencidoNaoRecebido;
        case 'margem': return l.a.margemProjetada;
        case 'termino': return l.a.diasAtrasoProjetado;
        case 'saude': return ORDEM_SAUDE[l.saude];
      }
    };
    return [...cart.linhas].sort((x, y) => {
      const a = val(x), b = val(y);
      const c = a < b ? -1 : a > b ? 1 : 0;
      return ordem.asc ? c : -c;
    });
  }, [cart.linhas, ordem]);

  const th = (col: Coluna, rot: string, num = true) => (
    <th
      className={num ? 'num ordenavel' : 'ordenavel'}
      onClick={() => setOrdem((o) => ({ col, asc: o.col === col ? !o.asc : true }))}
      aria-sort={ordem.col === col ? (ordem.asc ? 'ascending' : 'descending') : 'none'}
    >
      {rot} {ordem.col === col ? (ordem.asc ? '▲' : '▼') : ''}
    </th>
  );

  const fisico = base.map((l) => ({ id: l.obra.id, nome: nomeCurto(l.obra), completo: l.obra.nome, Previsto: l.a.planejado, Executado: l.a.executado }));
  const margens = base.map((l) => ({
    id: l.obra.id,
    nome: nomeCurto(l.obra),
    completo: l.obra.nome,
    'Margem prevista': l.a.margemPrevista,
    'Margem projetada': l.a.margemProjetada,
  }));
  const irParaObraDoGrafico = (d: { id?: string } | undefined) => {
    const o = obras.find((x) => x.id === d?.id);
    if (o) abrir(o);
  };

  const cabecalho = (
    <div className="linha entre" style={{ marginBottom: '1rem' }}>
      <div>
        <h1>Painel das obras</h1>
        <div className="muted peq">Situação de todas as obras em {fmtData(hoje)}. Clique em qualquer obra, alerta ou parcela para ver os detalhes.</div>
      </div>
      <div className="linha">
        {obras.length === 0 && (
          <button className="btn sec" onClick={() => obrasExemplo().forEach(salvarObra)}>
            Carregar obras de exemplo
          </button>
        )}
        <button className="btn" onClick={() => setNova(true)}>
          + Nova obra
        </button>
      </div>
    </div>
  );

  const modal = nova && (
    <Modal titulo="Nova obra" aoFechar={() => setNova(false)}>
      <ObraForm
        inicial={novaObraVazia()}
        aoCancelar={() => setNova(false)}
        aoSalvar={(o) => {
          salvarObra(o);
          setNova(false);
          abrir(o, 'contrato');
        }}
      />
    </Modal>
  );

  if (obras.length === 0) {
    return (
      <>
        {cabecalho}
        <div className="card vazio">
          <h2>Nenhuma obra cadastrada</h2>
          <p>Cadastre a primeira obra ou carregue as obras de exemplo para ver o painel funcionando.</p>
        </div>
        {modal}
      </>
    );
  }

  const resultado = cart.receitas - cart.despesas;

  return (
    <>
      {cabecalho}

      <div className="linha" style={{ marginBottom: '1rem' }}>
        {(
          [
            ['ativas', `Em andamento (${obras.filter((o) => o.status !== 'concluida').length})`],
            ['todas', `Todas (${obras.length})`],
            ['concluida', `Concluídas (${obras.filter((o) => o.status === 'concluida').length})`],
          ] as const
        ).map(([k, r]) => (
          <button key={k} className={`btn mini ${filtro === k ? '' : 'sec'}`} onClick={() => setFiltro(k)}>
            {r}
          </button>
        ))}
        <span className="espaco" />
        <span className="peq">
          {cart.porSaude.critico > 0 && <Tag tom="critico">{cart.porSaude.critico} crítica(s)</Tag>}{' '}
          {cart.porSaude.atencao > 0 && <Tag tom="atencao">{cart.porSaude.atencao} em atenção</Tag>}{' '}
          {cart.porSaude.ok > 0 && <Tag tom="ok">{cart.porSaude.ok} saudável(is)</Tag>}
        </span>
      </div>

      <div className="grade kpis4" style={{ marginBottom: '1rem' }}>
        <Kpi rotulo="Carteira (valor dos contratos)" valor={fmtMoeda(cart.contratos)} sub={`${base.length} obra(s)`} />
        <Kpi
          rotulo="Avanço físico da carteira"
          valor={fmtPct(cart.executado)}
          sub={`Previsto ${fmtPct(cart.planejado)} · ponderado pelo valor`}
          tom={indiceTom(cart.planejado > 0 ? cart.executado / cart.planejado : null, 0.95, 0.85)}
        />
        <Kpi
          rotulo="Encontro de contas"
          valor={<span className={resultado < 0 ? 'neg' : 'pos'}>{fmtMoeda(resultado)}</span>}
          sub={`Recebido ${fmtMoedaCurta(cart.receitas)} · gasto ${fmtMoedaCurta(cart.despesas)}`}
          tom={resultado < 0 ? 'atencao' : 'ok'}
        />
        <Kpi
          rotulo="Parcelas vencidas"
          valor={<span className={cart.vencido > 0 ? 'neg' : ''}>{fmtMoeda(cart.vencido)}</span>}
          sub={`${cart.qtdVencidas} parcela(s) · executado não recebido ${fmtMoedaCurta(cart.aReceber)}`}
          tom={cart.vencido > 0 ? 'critico' : 'ok'}
        />
        <Kpi rotulo="Margem prevista" valor={fmtMoeda(cart.margemPrevista)} sub={`${fmtPct((cart.margemPrevista / (cart.contratos || 1)) * 100)} dos contratos`} />
        <Kpi
          rotulo="Margem projetada no término"
          valor={<span className={cart.margemProjetada < 0 ? 'neg' : ''}>{fmtMoeda(cart.margemProjetada)}</span>}
          sub={`${fmtPct((cart.margemProjetada / (cart.contratos || 1)) * 100)} · perda de ${fmtMoedaCurta(Math.max(0, cart.margemPrevista - cart.margemProjetada))}`}
          tom={cart.margemProjetada < 0 ? 'critico' : cart.margemProjetada < cart.margemPrevista * 0.6 ? 'atencao' : 'ok'}
        />
        <Kpi rotulo="Risco de multas por atraso" valor={fmtMoeda(cart.multa)} sub="Se o atraso projetado se confirmar" tom={cart.multa > 0 ? 'critico' : 'ok'} />
        <Kpi
          rotulo="Obras com atraso projetado"
          valor={base.filter((l) => l.a.diasAtrasoProjetado > 0).length}
          sub={`de ${base.length} · maior atraso ${Math.max(0, ...base.map((l) => l.a.diasAtrasoProjetado))} dias`}
          tom={base.some((l) => l.a.diasAtrasoProjetado > 15) ? 'atencao' : 'ok'}
        />
      </div>

      <div className="grade g2">
        <div className="card">
          <div className="linha entre">
            <h2>Alertas prioritários ({alertas.length})</h2>
            {alertas.length > 6 && (
              <button className="btn sec mini" onClick={() => setVerTodos((v) => !v)}>
                {verTodos ? 'Ver menos' : 'Ver todos'}
              </button>
            )}
          </div>
          {alertas.length === 0 && <div className="muted">Nenhum alerta. Todas as obras dentro do previsto.</div>}
          <div className="lista-clicavel">
            {(verTodos ? alertas : alertas.slice(0, 6)).map(({ l, r }, k) => (
              <button key={k} className={`rec ${r.gravidade} clicavel`} onClick={() => abrir(l.obra, abaDoAlerta(r))}>
                <div className="peq muted">{nomeCurto(l.obra)}</div>
                <div className="tit">{r.titulo}</div>
                <div className="acao">
                  <b>O que fazer:</b> {r.acao}
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="card">
          <h2>Recebimentos: vencidos e próximos 45 dias</h2>
          {parcelas.length === 0 ? (
            <div className="muted">Nenhuma parcela vencida ou a vencer nos próximos 45 dias.</div>
          ) : (
            <div className="tabela-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Vencimento</th>
                    <th>Obra / parcela</th>
                    <th className="num">Em aberto</th>
                    <th>Situação</th>
                  </tr>
                </thead>
                <tbody>
                  {parcelas.map((p) => (
                    <tr key={p.parcela.id} className="linha-clicavel" tabIndex={0} onClick={() => abrir(p.obra, 'contrato')} onKeyDown={(e) => e.key === 'Enter' && abrir(p.obra, 'contrato')}>
                      <td>{fmtData(p.parcela.dataPrevista)}</td>
                      <td>
                        <div>{nomeCurto(p.obra)}</div>
                        <div className="peq muted">{p.parcela.descricao}</div>
                      </td>
                      <td className="num">{fmtMoeda(p.aberto)}</td>
                      <td>{p.vencida ? <Tag tom="critico">Vencida · {p.dias} d</Tag> : <Tag tom="neutro">A vencer</Tag>}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={2}>Total</td>
                    <td className="num">{fmtMoeda(parcelas.reduce((s, p) => s + p.aberto, 0))}</td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      </div>

      <div className="card">
        <div className="linha entre">
          <h2>Obras</h2>
          <span className="muted peq">Clique no título da coluna para ordenar e na linha para abrir a obra.</span>
        </div>
        <div className="tabela-wrap">
          <table>
            <thead>
              <tr>
                {th('nome', 'Obra', false)}
                {th('saude', 'Situação', false)}
                {th('executado', 'Físico (exec./prev.)', false)}
                {th('spi', 'IDP')}
                {th('cpi', 'IDC')}
                {th('termino', 'Término projetado')}
                {th('saldo', 'Saldo (recebido − gasto)')}
                {th('vencido', 'Vencido')}
                {th('margem', 'Margem projetada')}
              </tr>
            </thead>
            <tbody>
              {linhasOrdenadas.map((l) => (
                <tr key={l.obra.id} className="linha-clicavel" tabIndex={0} onClick={() => abrir(l.obra)} onKeyDown={(e) => e.key === 'Enter' && abrir(l.obra)}>
                  <td style={{ minWidth: 220 }}>
                    <b>{nomeCurto(l.obra)}</b>
                    <div className="peq muted">
                      {l.obra.cliente || 'Sem cliente'} · {ROTULO_STATUS[l.obra.status]}
                    </div>
                  </td>
                  <td>
                    <Tag tom={l.saude}>{ROTULO_SAUDE[l.saude]}</Tag>
                  </td>
                  <td style={{ minWidth: 130 }}>
                    <div className="peq">
                      {fmtPct(l.a.executado, 0)} / {fmtPct(l.a.planejado, 0)}
                    </div>
                    <BarraAvanco planejado={l.a.planejado} executado={l.a.executado} />
                  </td>
                  <td className={`num ${l.a.spi !== null && l.a.spi < 0.9 ? 'neg' : ''}`}>{l.a.spi === null ? '—' : l.a.spi.toFixed(2)}</td>
                  <td className={`num ${l.a.cpi !== null && l.a.cpi < 0.9 ? 'neg' : ''}`}>{l.a.cpi === null ? '—' : l.a.cpi.toFixed(2)}</td>
                  <td className="num">
                    {fmtData(l.a.terminoProjetado ?? undefined)}
                    {l.a.diasAtrasoProjetado > 0 && <div className="peq neg">+{l.a.diasAtrasoProjetado} dias</div>}
                  </td>
                  <td className={`num ${l.a.saldoCaixa < 0 ? 'neg' : 'pos'}`}>
                    {fmtMoeda(l.a.saldoCaixa)}
                    <div className="peq muted">
                      {fmtMoedaCurta(l.a.receitas)} − {fmtMoedaCurta(l.a.despesas)}
                    </div>
                  </td>
                  <td className={`num ${l.ac.vencidoNaoRecebido > 0 ? 'neg' : ''}`}>{fmtMoeda(l.ac.vencidoNaoRecebido)}</td>
                  <td className={`num ${l.a.margemProjetada < 0 ? 'neg' : ''}`}>
                    {fmtMoeda(l.a.margemProjetada)}
                    <div className="peq muted">{fmtPct((l.a.margemProjetada / (l.a.valorContrato || 1)) * 100)}</div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grade g2">
        <div className="card">
          <h2>Avanço físico por obra</h2>
          <div className="muted peq">Previsto pelo cronograma x executado até hoje</div>
          <div style={{ height: Math.max(180, fisico.length * 64 + 70) }}>
            <ResponsiveContainer>
              <BarChart data={fisico} layout="vertical" margin={{ left: 10, right: 16, top: 10 }} barGap={2}>
                <CartesianGrid strokeDasharray="3 3" stroke={COR.grade} horizontal={false} />
                <XAxis type="number" domain={[0, 100]} unit="%" fontSize={11} stroke={COR.texto} />
                <YAxis type="category" dataKey="nome" width={170} fontSize={11} stroke={COR.texto} />
                <Tooltip formatter={(v: number) => fmtPct(v)} labelFormatter={(_, p) => p?.[0]?.payload?.completo ?? ''} />
                <Legend />
                <Bar dataKey="Previsto" fill={COR.previsto} radius={[0, 4, 4, 0]} cursor="pointer" onClick={irParaObraDoGrafico} />
                <Bar dataKey="Executado" fill={COR.executado} radius={[0, 4, 4, 0]} cursor="pointer" onClick={irParaObraDoGrafico} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="card">
          <h2>Margem por obra</h2>
          <div className="muted peq">Prevista no orçamento x projetada no término, pelo ritmo de gastos atual</div>
          <div style={{ height: Math.max(180, margens.length * 64 + 70) }}>
            <ResponsiveContainer>
              <BarChart data={margens} layout="vertical" margin={{ left: 10, right: 16, top: 10 }} barGap={2}>
                <CartesianGrid strokeDasharray="3 3" stroke={COR.grade} horizontal={false} />
                <XAxis type="number" tickFormatter={fmtMoedaCurta} fontSize={11} stroke={COR.texto} />
                <YAxis type="category" dataKey="nome" width={170} fontSize={11} stroke={COR.texto} />
                <Tooltip formatter={(v: number) => fmtMoeda(v)} labelFormatter={(_, p) => p?.[0]?.payload?.completo ?? ''} />
                <Legend />
                <Bar dataKey="Margem prevista" fill={COR.receita} radius={[0, 4, 4, 0]} cursor="pointer" onClick={irParaObraDoGrafico} />
                <Bar dataKey="Margem projetada" fill={COR.despesa} radius={[0, 4, 4, 0]} cursor="pointer" onClick={irParaObraDoGrafico} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="card">
        <h2>Fluxo de caixa de todas as obras</h2>
        <div className="muted peq">Recebido e gasto por mês; linhas tracejadas mostram o previsto (parcelas do contrato e custo do cronograma).</div>
        <div style={{ height: 300 }}>
          <ResponsiveContainer>
            <ComposedChart data={fluxo} margin={{ left: 10, right: 16, top: 10 }} barGap={2}>
              <CartesianGrid strokeDasharray="3 3" stroke={COR.grade} vertical={false} />
              <XAxis dataKey="rot" fontSize={11} stroke={COR.texto} />
              <YAxis tickFormatter={fmtMoedaCurta} fontSize={11} width={72} stroke={COR.texto} />
              <Tooltip formatter={(v: number) => fmtMoeda(v)} />
              <Legend />
              <Bar dataKey="receitas" name="Recebido" fill={COR.receita} radius={[4, 4, 0, 0]} />
              <Bar dataKey="despesas" name="Gasto" fill={COR.despesa} radius={[4, 4, 0, 0]} />
              <Line dataKey="receitaPrevista" name="Recebimento previsto" stroke={COR.receita} strokeWidth={2} strokeDasharray="5 4" dot={false} />
              <Line dataKey="custoPrevisto" name="Gasto previsto" stroke={COR.despesa} strokeWidth={2} strokeDasharray="5 4" dot={false} />
              <Line dataKey="saldoAcumulado" name="Saldo acumulado" stroke={COR.saldo} strokeWidth={2} dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {modal}
    </>
  );
}
