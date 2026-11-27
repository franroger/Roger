import { useMemo, useRef, useState } from 'react';
import type { AnaliseObra } from '../lib/calc';
import { analisarContrato, extrairTexto, gerarParcelas, identificarDados, trechosPagamento, type Achado, type SituacaoParcela } from '../lib/contrato';
import { addDias, diffDias, fmtData, fmtMoeda, fmtNum, fmtPct, uid } from '../lib/format';
import { paraNumero } from '../lib/importar';
import { contratoVazio, ROTULO_PERIODICIDADE, type DadosContrato, type Obra, type Periodicidade } from '../lib/types';
import { BotaoConfirmar, Kpi, Tag } from './ui';

type Props = { obra: Obra; analise: AnaliseObra; atualizar: (fn: (o: Obra) => Obra) => void };

const SIT: Record<SituacaoParcela, [string, 'ok' | 'atencao' | 'critico' | 'neutro']> = {
  recebida: ['Recebida', 'ok'],
  parcial: ['Parcial', 'atencao'],
  vencida: ['Vencida', 'critico'],
  a_vencer: ['A vencer', 'neutro'],
};

function CampoNumero({ id, valor, aoMudar, sufixo, moeda }: { id: string; valor: number; aoMudar: (n: number) => void; sufixo?: string; moeda?: boolean }) {
  const [txt, setTxt] = useState<string | null>(null);
  return (
    <div className="linha" style={{ gap: '.3rem', flexWrap: 'nowrap' }}>
      <input
        id={id}
        inputMode="decimal"
        value={txt ?? (valor ? (moeda ? valor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : fmtNum(valor)) : '')}
        onFocus={() => setTxt(valor ? String(valor).replace('.', ',') : '')}
        onChange={(e) => setTxt(e.target.value)}
        onBlur={() => {
          if (txt !== null) aoMudar(paraNumero(txt));
          setTxt(null);
        }}
      />
      {sufixo && <span className="muted peq">{sufixo}</span>}
    </div>
  );
}

export default function Contrato({ obra, analise: a, atualizar }: Props) {
  const c: DadosContrato = obra.contrato ?? contratoVazio();
  const ac = useMemo(() => analisarContrato(obra, a.data, a.diasAtrasoProjetado, a.medidoVenda), [obra, a]);
  const arquivoRef = useRef<HTMLInputElement>(null);
  const [lendo, setLendo] = useState(false);
  const [erro, setErro] = useState('');
  const [achados, setAchados] = useState<(Achado & { usar: boolean })[] | null>(null);
  const [textoLido, setTextoLido] = useState<{ nome: string; texto: string } | null>(null);
  const [busca, setBusca] = useState('');
  const [verTexto, setVerTexto] = useState(false);

  const setC = (patch: Partial<DadosContrato>) => atualizar((o) => ({ ...o, contrato: { ...(o.contrato ?? contratoVazio()), ...patch } }));
  const setObra = (patch: Partial<Obra>) => atualizar((o) => ({ ...o, ...patch }));

  /** Prazo em dias define o término a partir do início. */
  const mudarPrazo = (dias: number) => {
    setC({ prazoDias: dias });
    if (dias > 0 && obra.dataInicio) setObra({ dataFim: addDias(obra.dataInicio, dias - 1) });
  };
  const mudarInicio = (ini: string) => {
    setObra({ dataInicio: ini, ...(c.prazoDias > 0 && ini ? { dataFim: addDias(ini, c.prazoDias - 1) } : {}) });
  };

  const lerArquivo = async (f: File) => {
    setErro('');
    setLendo(true);
    setAchados(null);
    try {
      const texto = await extrairTexto(f);
      if (texto.replace(/\s/g, '').length < 200) {
        setErro('Não foi possível ler o texto do arquivo. Se for um PDF escaneado (imagem), preencha os dados manualmente ou use um PDF com texto.');
        return;
      }
      setTextoLido({ nome: f.name, texto });
      setAchados(identificarDados(texto).map((x) => ({ ...x, usar: true })));
    } catch (e) {
      setErro(`Não foi possível ler o arquivo: ${(e as Error).message}`);
    } finally {
      setLendo(false);
    }
  };

  const aplicar = () => {
    if (!achados || !textoLido) return;
    const usar = Object.fromEntries(achados.filter((x) => x.usar).map((x) => [x.campo, x.valor]));
    atualizar((o) => {
      const atual = o.contrato ?? contratoVazio();
      const novo: DadosContrato = { ...atual, textoContrato: textoLido.texto, nomeArquivo: textoLido.nome };
      const obraPatch: Partial<Obra> = {};
      for (const [k, v] of Object.entries(usar)) {
        if (k === 'numeroContrato' || k === 'cliente') obraPatch[k] = String(v);
        else if (k === 'valorContrato') obraPatch.valorContrato = Number(v);
        else if (k === 'dataInicio') obraPatch.dataInicio = String(v);
        else if (k === 'periodicidade') novo.periodicidade = v as Periodicidade;
        else if (k === 'reajuste' || k === 'garantia' || k === 'dataAssinatura') novo[k] = String(v);
        else (novo as unknown as Record<string, number>)[k] = Number(v);
      }
      if (!novo.condicoesPagamento.trim()) novo.condicoesPagamento = trechosPagamento(textoLido.texto);
      const ini = obraPatch.dataInicio ?? o.dataInicio;
      if (novo.prazoDias > 0 && ini) obraPatch.dataFim = addDias(ini, novo.prazoDias - 1);
      return { ...o, ...obraPatch, contrato: novo };
    });
    setAchados(null);
  };

  const ocorrencias = useMemo(() => {
    const texto = c.textoContrato ?? '';
    if (!busca.trim() || busca.trim().length < 3) return [];
    const termo = busca.trim().toLowerCase();
    const out: string[] = [];
    const baixo = texto.toLowerCase();
    for (let i = baixo.indexOf(termo); i >= 0 && out.length < 20; i = baixo.indexOf(termo, i + termo.length)) {
      out.push(texto.slice(Math.max(0, i - 120), i + termo.length + 160).replace(/\s+/g, ' '));
    }
    return out;
  }, [busca, c.textoContrato]);

  const valorContrato = a.valorContrato;
  const difParcelas = c.parcelas.length ? ac.totalParcelas - valorContrato : 0;
  const diasRestantes = obra.dataFim ? diffDias(a.data, obra.dataFim) : 0;

  return (
    <>
      <div className="grade g4" style={{ marginBottom: '1rem' }}>
        <Kpi rotulo="Valor do contrato" valor={fmtMoeda(valorContrato)} sub={obra.numeroContrato ? `Contrato ${obra.numeroContrato}` : 'Nº não informado'} />
        <Kpi
          rotulo="Prazo contratual"
          valor={c.prazoDias ? `${c.prazoDias} dias` : `${diffDias(obra.dataInicio, obra.dataFim) + 1} dias`}
          sub={<>{fmtData(obra.dataInicio)} a {fmtData(obra.dataFim)} · {diasRestantes >= 0 ? `faltam ${diasRestantes} dias` : `vencido há ${-diasRestantes} dias`}</>}
          tom={diasRestantes < 0 && a.executado < 100 ? 'critico' : a.diasAtrasoProjetado > 0 ? 'atencao' : 'ok'}
        />
        <Kpi
          rotulo="Parcelas vencidas"
          valor={<span className={ac.vencidoNaoRecebido > 0 ? 'neg' : ''}>{fmtMoeda(ac.vencidoNaoRecebido)}</span>}
          sub={c.parcelas.length ? `${ac.qtdVencidas} parcela(s) · recebido ${fmtMoeda(ac.recebido)} de ${fmtMoeda(ac.previstoAteHoje)} previsto até hoje` : 'Cadastre as parcelas abaixo'}
          tom={ac.vencidoNaoRecebido > 0 ? 'critico' : 'ok'}
        />
        <Kpi
          rotulo="Risco de multa por atraso"
          valor={fmtMoeda(ac.multaEstimada)}
          sub={c.multaAtrasoPctDia ? `${fmtNum(c.multaAtrasoPctDia)}% ao dia · atraso projetado ${Math.max(0, a.diasAtrasoProjetado)} dias` : 'Multa não informada'}
          tom={ac.multaEstimada > 0 ? 'critico' : 'ok'}
        />
      </div>

      <div className="card">
        <div className="linha entre">
          <div>
            <h2>Importar contrato</h2>
            <div className="muted peq">
              Envie o contrato em PDF, Word (.docx) ou texto. O aplicativo procura valor, prazo, adiantamento, retenção, multa, prazo de pagamento,
              reajuste e garantia. Confira cada item antes de aplicar.
            </div>
            {c.nomeArquivo && <div className="peq" style={{ marginTop: '.3rem' }}>Arquivo lido: <b>{c.nomeArquivo}</b></div>}
          </div>
          <button className="btn" disabled={lendo} onClick={() => arquivoRef.current?.click()}>
            {lendo ? 'Lendo o contrato…' : c.nomeArquivo ? 'Importar outro arquivo' : 'Importar contrato'}
          </button>
          <input
            ref={arquivoRef}
            type="file"
            accept=".pdf,.docx,.txt"
            style={{ display: 'none' }}
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = '';
              if (f) lerArquivo(f);
            }}
          />
        </div>
        {erro && <div className="aviso">{erro}</div>}
        {achados && (
          <div style={{ marginTop: '.75rem' }}>
            {achados.length === 0 ? (
              <div className="aviso">Nenhum dado foi identificado automaticamente. O texto foi lido e você pode preencher os campos abaixo consultando-o.</div>
            ) : (
              <div className="sucesso">Encontrei {achados.length} informação(ões). Desmarque o que estiver errado e clique em Aplicar.</div>
            )}
            <div className="tabela-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Usar</th>
                    <th>Informação</th>
                    <th>Valor encontrado</th>
                    <th>Trecho do contrato</th>
                  </tr>
                </thead>
                <tbody>
                  {achados.map((x, k) => (
                    <tr key={x.campo}>
                      <td>
                        <input
                          type="checkbox"
                          style={{ width: 'auto' }}
                          checked={x.usar}
                          onChange={(e) => setAchados((l) => l!.map((y, j) => (j === k ? { ...y, usar: e.target.checked } : y)))}
                        />
                      </td>
                      <td>{x.rotulo}</td>
                      <td>
                        <b>{x.campo.startsWith('data') ? fmtData(String(x.valor)) : x.exibicao}</b>
                      </td>
                      <td className="peq muted" style={{ maxWidth: 480 }}>
                        {x.trecho}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="linha" style={{ marginTop: '.6rem' }}>
              <button className="btn" onClick={aplicar}>
                Aplicar ao contrato
              </button>
              <button className="btn sec" onClick={() => setAchados(null)}>
                Descartar
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="card">
        <h2>Dados e condições do contrato</h2>
        <div className="form">
          <label className="campo">
            Nº do contrato
            <input id="ct-numero" value={obra.numeroContrato} onChange={(e) => setObra({ numeroContrato: e.target.value })} />
          </label>
          <label className="campo">
            Contratante (cliente)
            <input id="ct-cliente" value={obra.cliente} onChange={(e) => setObra({ cliente: e.target.value })} />
          </label>
          <label className="campo">
            Valor do contrato (R$)
            <CampoNumero id="ct-valor" valor={obra.valorContrato} moeda aoMudar={(n) => setObra({ valorContrato: n })} />
          </label>
          <label className="campo">
            Data de assinatura
            <input id="ct-assinatura" type="date" value={c.dataAssinatura} onChange={(e) => setC({ dataAssinatura: e.target.value })} />
          </label>
          <label className="campo">
            Início da obra
            <input id="ct-inicio" type="date" value={obra.dataInicio} onChange={(e) => mudarInicio(e.target.value)} />
          </label>
          <label className="campo">
            Prazo de execução
            <CampoNumero id="ct-prazo" valor={c.prazoDias} aoMudar={mudarPrazo} sufixo="dias" />
          </label>
          <label className="campo">
            Tipo de prazo
            <select id="ct-tipoprazo" value={c.tipoPrazo} onChange={(e) => setC({ tipoPrazo: e.target.value as DadosContrato['tipoPrazo'] })}>
              <option value="corridos">Dias corridos</option>
              <option value="uteis">Dias úteis</option>
            </select>
          </label>
          <label className="campo">
            Término contratual
            <input id="ct-fim" type="date" value={obra.dataFim} onChange={(e) => setObra({ dataFim: e.target.value })} />
          </label>
        </div>

        <h3 style={{ marginTop: '1.2rem' }}>Condições de pagamento</h3>
        <div className="form">
          <label className="campo">
            Adiantamento / sinal
            <CampoNumero id="ct-adiant" valor={c.adiantamentoPct} aoMudar={(n) => setC({ adiantamentoPct: n })} sufixo="%" />
          </label>
          <label className="campo">
            Forma de medição
            <select id="ct-periodicidade" value={c.periodicidade} onChange={(e) => setC({ periodicidade: e.target.value as Periodicidade })}>
              {Object.entries(ROTULO_PERIODICIDADE).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </label>
          <label className="campo">
            Pagamento após a medição
            <CampoNumero id="ct-prazopag" valor={c.prazoPagamentoDias} aoMudar={(n) => setC({ prazoPagamentoDias: n })} sufixo="dias" />
          </label>
          <label className="campo">
            Retenção técnica / caução
            <CampoNumero id="ct-retencao" valor={c.retencaoPct} aoMudar={(n) => setC({ retencaoPct: n })} sufixo="%" />
          </label>
          <label className="campo">
            Multa por atraso
            <CampoNumero id="ct-multa" valor={c.multaAtrasoPctDia} aoMudar={(n) => setC({ multaAtrasoPctDia: n })} sufixo="% ao dia" />
          </label>
          <label className="campo">
            Limite da multa
            <CampoNumero id="ct-multalim" valor={c.multaLimitePct} aoMudar={(n) => setC({ multaLimitePct: n })} sufixo="% do contrato" />
          </label>
          <label className="campo">
            Reajuste
            <input id="ct-reajuste" value={c.reajuste} placeholder="Ex.: INCC anual" onChange={(e) => setC({ reajuste: e.target.value })} />
          </label>
          <label className="campo">
            Garantia dos serviços
            <input id="ct-garantia" value={c.garantia} placeholder="Ex.: 5 anos" onChange={(e) => setC({ garantia: e.target.value })} />
          </label>
          <label className="campo largo">
            Condições de pagamento (texto)
            <textarea id="ct-condicoes" value={c.condicoesPagamento} onChange={(e) => setC({ condicoesPagamento: e.target.value })} placeholder="Como o cliente paga, documentos exigidos, aprovação de medição…" />
          </label>
          <label className="campo largo">
            Cláusulas importantes / observações
            <textarea id="ct-clausulas" value={c.clausulas} onChange={(e) => setC({ clausulas: e.target.value })} placeholder="Escopo excluído, responsabilidades do cliente, seguros, ART…" />
          </label>
        </div>
      </div>

      <div className="card">
        <div className="linha entre">
          <div>
            <h2>Cronograma de recebimentos</h2>
            <div className="muted peq">
              As receitas lançadas no Financeiro quitam as parcelas pela ordem de vencimento. Essas datas passam a ser a "receita prevista" do fluxo de caixa.
            </div>
          </div>
          <div className="linha">
            {c.parcelas.length > 0 ? (
              <BotaoConfirmar className="btn sec" confirmar="Substituir as parcelas atuais?" aoConfirmar={() => setC({ parcelas: gerarParcelas(obra, c) })}>
                Gerar pelas condições
              </BotaoConfirmar>
            ) : (
              <button className="btn" onClick={() => setC({ parcelas: gerarParcelas(obra, c) })} disabled={!obra.itens.length && c.periodicidade !== 'outra'}>
                Gerar pelas condições
              </button>
            )}
            <button
              className="btn sec"
              onClick={() => setC({ parcelas: [...c.parcelas, { id: uid(), descricao: `Parcela ${c.parcelas.length + 1}`, dataPrevista: a.data, valor: 0 }] })}
            >
              + Parcela
            </button>
          </div>
        </div>
        {!obra.itens.length && <div className="aviso">Para gerar as parcelas automaticamente, cadastre antes a planilha orçamentária com o cronograma.</div>}
        {c.parcelas.length > 0 && (
          <div className="tabela-wrap" style={{ marginTop: '.75rem' }}>
            <table>
              <thead>
                <tr>
                  <th>Descrição</th>
                  <th>Vencimento</th>
                  <th className="num">Valor</th>
                  <th className="num">Recebido</th>
                  <th>Situação</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {ac.parcelas.map(({ parcela: p, recebido, situacao, diasAtraso }) => {
                  const mudar = (patch: Partial<typeof p>) => setC({ parcelas: c.parcelas.map((x) => (x.id === p.id ? { ...x, ...patch } : x)) });
                  const [rot, tom] = SIT[situacao];
                  return (
                    <tr key={p.id}>
                      <td>
                        <input value={p.descricao} onChange={(e) => mudar({ descricao: e.target.value })} />
                      </td>
                      <td>
                        <input type="date" value={p.dataPrevista} onChange={(e) => mudar({ dataPrevista: e.target.value })} />
                      </td>
                      <td className="num">
                        <CampoNumero id={`parc-${p.id}`} valor={p.valor} moeda aoMudar={(n) => mudar({ valor: n })} />
                      </td>
                      <td className="num">{fmtMoeda(recebido)}</td>
                      <td>
                        <Tag tom={tom}>{rot}</Tag>
                        {diasAtraso > 0 && <span className="peq neg"> {diasAtraso} d</span>}
                      </td>
                      <td>
                        <button className="btn perigo mini" title="Excluir parcela" onClick={() => setC({ parcelas: c.parcelas.filter((x) => x.id !== p.id) })}>
                          ✕
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={2}>Total das parcelas</td>
                  <td className="num">{fmtMoeda(ac.totalParcelas)}</td>
                  <td className="num">{fmtMoeda(Math.min(ac.recebido, ac.totalParcelas))}</td>
                  <td colSpan={2} className="peq">
                    {Math.abs(difParcelas) > 1 ? (
                      <span className="neg">
                        {difParcelas > 0 ? 'Acima' : 'Abaixo'} do contrato em {fmtMoeda(Math.abs(difParcelas))}
                      </span>
                    ) : (
                      <span className="pos">Confere com o contrato</span>
                    )}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
        {c.retencaoPct > 0 && (
          <div className="muted peq" style={{ marginTop: '.4rem' }}>
            Retenção de {fmtPct(c.retencaoPct, 1)} sobre o executado até agora: {fmtMoeda(ac.retencaoAcumulada)} (devolvida no final).
          </div>
        )}
      </div>

      {c.textoContrato && (
        <div className="card">
          <div className="linha entre">
            <h2>Texto do contrato</h2>
            <button className="btn sec mini" onClick={() => setVerTexto((v) => !v)}>
              {verTexto ? 'Ocultar texto completo' : 'Ver texto completo'}
            </button>
          </div>
          <label className="campo" style={{ maxWidth: 420 }}>
            Procurar no contrato
            <input id="ct-busca" value={busca} placeholder="Ex.: multa, medição, garantia" onChange={(e) => setBusca(e.target.value)} />
          </label>
          {busca.trim().length >= 3 && (
            <div style={{ marginTop: '.5rem' }}>
              {ocorrencias.length === 0 && <div className="muted peq">Nada encontrado.</div>}
              {ocorrencias.map((o, k) => (
                <div key={k} className="peq" style={{ padding: '.4rem 0', borderBottom: '1px solid var(--line)' }}>
                  …{o}…
                </div>
              ))}
            </div>
          )}
          {verTexto && (
            <pre className="peq" style={{ whiteSpace: 'pre-wrap', maxHeight: 480, overflow: 'auto', background: '#fafbfc', padding: '.75rem', borderRadius: 8, marginTop: '.75rem' }}>
              {c.textoContrato}
            </pre>
          )}
        </div>
      )}
    </>
  );
}
