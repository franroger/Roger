import { useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { useStore } from '../lib/store';
import { analisarObra } from '../lib/calc';
import { fmtData, fmtMoeda, hojeISO } from '../lib/format';
import { ROTULO_STATUS, type Obra } from '../lib/types';
import { BotaoConfirmar, Modal } from '../components/ui';
import ObraForm from '../components/ObraForm';
import Painel from '../components/Painel';
import Orcamento from '../components/Orcamento';
import Andamento from '../components/Andamento';
import Financeiro from '../components/Financeiro';
import Contrato from '../components/Contrato';
import DiarioObra from '../components/DiarioObra';

const ABAS = [
  ['painel', 'Painel e recomendações'],
  ['contrato', 'Contrato'],
  ['orcamento', 'Orçamento e cronograma'],
  ['diario', 'Diário de obra'],
  ['andamento', 'Andamento'],
  ['financeiro', 'Financeiro'],
] as const;
type Aba = (typeof ABAS)[number][0];

export default function ObraDetalhe() {
  const { id = '' } = useParams();
  const { obter, salvarObra, excluirObra, atualizarObra } = useStore();
  const obra = obter(id);
  const local = useLocation();
  const [aba, setAba] = useState<Aba>(((local.state as { aba?: Aba } | null)?.aba) ?? 'painel');
  const [editando, setEditando] = useState(false);
  const [dataRef, setDataRef] = useState(hojeISO());
  const navegar = useNavigate();

  const analise = useMemo(() => (obra ? analisarObra(obra, dataRef) : null), [obra, dataRef]);

  if (!obra || !analise) {
    return (
      <div className="card vazio">
        Obra não encontrada. <Link to="/">Voltar</Link>
      </div>
    );
  }

  const atualizar = (fn: (o: Obra) => Obra) => atualizarObra(obra.id, fn);

  return (
    <>
      <div className="peq" style={{ marginBottom: '.5rem' }}>
        <Link to="/">← Painel das obras</Link>
      </div>
      <div className="card">
        <div className="linha entre" style={{ alignItems: 'flex-start' }}>
          <div>
            <h1 style={{ marginBottom: '.25rem' }}>{obra.nome}</h1>
            <div className="muted peq">
              {obra.cliente && <>{obra.cliente} · </>}
              {obra.numeroContrato && <>Contrato {obra.numeroContrato} · </>}
              {ROTULO_STATUS[obra.status]} · {fmtData(obra.dataInicio)} a {fmtData(obra.dataFim)} · {fmtMoeda(analise.valorContrato)}
            </div>
            {obra.endereco && <div className="muted peq">{obra.endereco}</div>}
          </div>
          <div className="linha">
            <label className="campo" title="Simula a análise em outra data">
              Data de referência
              <input type="date" value={dataRef} onChange={(e) => setDataRef(e.target.value || hojeISO())} />
            </label>
            <button className="btn sec" onClick={() => setEditando(true)}>
              Editar obra
            </button>
          </div>
        </div>
      </div>

      <div className="abas" role="tablist">
        {ABAS.map(([k, rot]) => (
          <button key={k} role="tab" className={aba === k ? 'ativa' : ''} onClick={() => setAba(k)}>
            {rot}
          </button>
        ))}
      </div>

      {aba === 'painel' && <Painel obra={obra} analise={analise} irPara={setAba} />}
      {aba === 'contrato' && <Contrato obra={obra} analise={analise} atualizar={atualizar} />}
      {aba === 'orcamento' && <Orcamento obra={obra} atualizar={atualizar} dataRef={dataRef} />}
      {aba === 'diario' && <DiarioObra obra={obra} atualizar={atualizar} />}
      {aba === 'andamento' && <Andamento obra={obra} analise={analise} atualizar={atualizar} />}
      {aba === 'financeiro' && <Financeiro obra={obra} analise={analise} atualizar={atualizar} />}

      {editando && (
        <Modal titulo="Editar obra" aoFechar={() => setEditando(false)}>
          <ObraForm
            inicial={obra}
            aoCancelar={() => setEditando(false)}
            aoSalvar={(o) => {
              salvarObra(o);
              setEditando(false);
            }}
          />
          <hr style={{ margin: '1.25rem 0', border: 0, borderTop: '1px solid var(--line)' }} />
          <BotaoConfirmar
            confirmar="Clique de novo para excluir a obra e todos os seus dados"
            aoConfirmar={() => {
              excluirObra(obra.id);
              navegar('/');
            }}
          >
            Excluir obra
          </BotaoConfirmar>
        </Modal>
      )}
    </>
  );
}
