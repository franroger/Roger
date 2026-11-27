import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { novaObraVazia, useStore } from '../lib/store';
import { analisarObra } from '../lib/calc';
import { saudeObra } from '../lib/recomendacoes';
import { fmtData, fmtMoeda, fmtPct } from '../lib/format';
import { ROTULO_STATUS } from '../lib/types';
import { BarraAvanco, Kpi, Modal, ROTULO_SAUDE, Tag } from '../components/ui';
import ObraForm from '../components/ObraForm';
import { obraExemplo } from '../lib/demo';

export default function ListaObras() {
  const { obras, salvarObra } = useStore();
  const [nova, setNova] = useState(false);
  const navegar = useNavigate();

  const linhas = useMemo(
    () => obras.map((o) => ({ obra: o, a: analisarObra(o) })).map((x) => ({ ...x, saude: saudeObra(x.a) })),
    [obras],
  );

  const tot = linhas.reduce(
    (s, { a, obra }) => {
      if (obra.status === 'concluida') return s;
      s.contratos += a.valorContrato;
      s.receitas += a.receitas;
      s.despesas += a.despesas;
      s.margem += a.margemProjetada;
      return s;
    },
    { contratos: 0, receitas: 0, despesas: 0, margem: 0 },
  );
  const criticas = linhas.filter((l) => l.saude === 'critico').length;

  return (
    <>
      <div className="linha entre" style={{ marginBottom: '1rem' }}>
        <div>
          <h1>Obras</h1>
          <div className="muted peq">Planejamento, andamento e financeiro de cada obra</div>
        </div>
        <div className="linha">
          {obras.length === 0 && (
            <button className="btn sec" onClick={() => salvarObra(obraExemplo())}>
              Carregar obra de exemplo
            </button>
          )}
          <button className="btn" onClick={() => setNova(true)}>
            + Nova obra
          </button>
        </div>
      </div>

      {obras.length > 0 && (
        <div className="grade g4" style={{ marginBottom: '1rem' }}>
          <Kpi rotulo="Carteira ativa (contratos)" valor={fmtMoeda(tot.contratos)} sub={`${linhas.filter((l) => l.obra.status !== 'concluida').length} obras ativas`} />
          <Kpi rotulo="Recebido x gasto" valor={fmtMoeda(tot.receitas - tot.despesas)} sub={`Recebido ${fmtMoeda(tot.receitas)} · gasto ${fmtMoeda(tot.despesas)}`} tom={tot.receitas - tot.despesas < 0 ? 'atencao' : 'ok'} />
          <Kpi rotulo="Margem projetada" valor={fmtMoeda(tot.margem)} sub="Contrato − custo projetado no término" tom={tot.margem < 0 ? 'critico' : 'ok'} />
          <Kpi rotulo="Obras em estado crítico" valor={criticas} sub="Prazo ou custo fora do limite" tom={criticas ? 'critico' : 'ok'} />
        </div>
      )}

      {obras.length === 0 ? (
        <div className="card vazio">
          <h2>Nenhuma obra cadastrada</h2>
          <p>Cadastre uma obra ou carregue o exemplo para conhecer o aplicativo.</p>
        </div>
      ) : (
        <div className="obras">
          {linhas.map(({ obra, a, saude }) => (
            <Link to={`/obra/${obra.id}`} key={obra.id} className="card obra-card">
              <div className="linha entre" style={{ alignItems: 'flex-start' }}>
                <h3 style={{ margin: 0 }}>{obra.nome}</h3>
                <Tag tom={saude}>{ROTULO_SAUDE[saude]}</Tag>
              </div>
              <div className="muted peq" style={{ margin: '.25rem 0 .6rem' }}>
                {obra.cliente || 'Sem cliente'} · {ROTULO_STATUS[obra.status]} · {fmtData(obra.dataInicio)} a {fmtData(obra.dataFim)}
              </div>
              <div className="linha entre peq">
                <span>
                  Físico: <b>{fmtPct(a.executado)}</b> <span className="muted">/ {fmtPct(a.planejado)} previsto</span>
                </span>
                {a.diasAtrasoProjetado > 0 && <span className="neg">+{a.diasAtrasoProjetado} dias</span>}
              </div>
              <div style={{ margin: '.35rem 0 .7rem' }}>
                <BarraAvanco planejado={a.planejado} executado={a.executado} />
              </div>
              <div className="linha entre peq">
                <span>Contrato {fmtMoeda(a.valorContrato)}</span>
                <span className={a.saldoCaixa < 0 ? 'neg' : 'pos'}>Caixa {fmtMoeda(a.saldoCaixa)}</span>
              </div>
              <div className="linha entre peq muted">
                <span>Margem projetada</span>
                <span className={a.margemProjetada < 0 ? 'neg' : ''}>{fmtMoeda(a.margemProjetada)}</span>
              </div>
            </Link>
          ))}
        </div>
      )}

      {obras.length > 0 && (
        <div className="card" style={{ marginTop: '1rem' }}>
          <h2>Receitas x despesas por obra</h2>
          <div className="tabela-wrap">
            <table>
              <thead>
                <tr>
                  <th>Obra</th>
                  <th className="num">Contrato</th>
                  <th className="num">Recebido</th>
                  <th className="num">Falta receber</th>
                  <th className="num">Gasto</th>
                  <th className="num">Saldo (receita − despesa)</th>
                  <th className="num">Resultado projetado</th>
                </tr>
              </thead>
              <tbody>
                {linhas.map(({ obra, a }) => (
                  <tr key={obra.id}>
                    <td>
                      <Link to={`/obra/${obra.id}`}>{obra.nome}</Link>
                    </td>
                    <td className="num">{fmtMoeda(a.valorContrato)}</td>
                    <td className="num pos">{fmtMoeda(a.receitas)}</td>
                    <td className="num">{fmtMoeda(Math.max(0, a.valorContrato - a.receitas))}</td>
                    <td className="num neg">{fmtMoeda(a.despesas)}</td>
                    <td className={`num ${a.saldoCaixa < 0 ? 'neg' : 'pos'}`}>{fmtMoeda(a.saldoCaixa)}</td>
                    <td className={`num ${a.margemProjetada < 0 ? 'neg' : 'pos'}`}>{fmtMoeda(a.margemProjetada)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td>Total</td>
                  <td className="num">{fmtMoeda(linhas.reduce((s, l) => s + l.a.valorContrato, 0))}</td>
                  <td className="num">{fmtMoeda(linhas.reduce((s, l) => s + l.a.receitas, 0))}</td>
                  <td className="num">{fmtMoeda(linhas.reduce((s, l) => s + Math.max(0, l.a.valorContrato - l.a.receitas), 0))}</td>
                  <td className="num">{fmtMoeda(linhas.reduce((s, l) => s + l.a.despesas, 0))}</td>
                  <td className="num">{fmtMoeda(linhas.reduce((s, l) => s + l.a.saldoCaixa, 0))}</td>
                  <td className="num">{fmtMoeda(linhas.reduce((s, l) => s + l.a.margemProjetada, 0))}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {nova && (
        <Modal titulo="Nova obra" aoFechar={() => setNova(false)}>
          <ObraForm
            inicial={novaObraVazia()}
            aoCancelar={() => setNova(false)}
            aoSalvar={(o) => {
              salvarObra(o);
              setNova(false);
              navegar(`/obra/${o.id}`);
            }}
          />
        </Modal>
      )}
    </>
  );
}
