import { useMemo, useState } from 'react';
import { executadoItem } from '../lib/calc';
import { fmtData, fmtNum, fmtPct, hojeISO, uid } from '../lib/format';
import { baixarRdoDaObra, importarDiario, importarDias, lerRdo, paraNumero } from '../lib/importar';
import {
  FASES_PADRAO,
  apontamentoDeTrecho,
  avancoLocalFase,
  chavePano,
  ehFachada,
  fasesDoItem,
  lerPrumadas,
  locaisDoItem,
  locaisPadrao,
  panosExecutados,
  pavimentosDeCima,
  qtdDosPanos,
  qtdPorPano,
  quantidadeExecutada,
  quantidadePorLocal,
} from '../lib/producao';
import { ROTULO_CONDICAO, type Apontamento, type Fase, type ItemOrcamento, type Local, type Obra } from '../lib/types';
import Importador from './Importador';
import ImportarMaisControle from './ImportarMaisControle';
import { BotaoConfirmar } from './ui';

type Props = { obra: Obra; atualizar: (fn: (o: Obra) => Obra) => void };

function Num({ id, valor, aoMudar, largura = 90 }: { id: string; valor: number; aoMudar: (n: number) => void; largura?: number }) {
  const [txt, setTxt] = useState<string | null>(null);
  return (
    <input
      id={id}
      inputMode="decimal"
      style={{ width: largura, textAlign: 'right' }}
      value={txt ?? (valor ? fmtNum(valor) : '')}
      onFocus={() => setTxt(valor ? String(valor).replace('.', ',') : '')}
      onChange={(e) => setTxt(e.target.value)}
      onBlur={() => {
        if (txt !== null) aoMudar(paraNumero(txt));
        setTxt(null);
      }}
    />
  );
}

/** Cor da célula do quadro de avanço (0% claro → 100% cor da marca). */
const corAvanco = (p: number) => (p >= 99.95 ? 'var(--brand)' : p <= 0 ? '#eef1f4' : `color-mix(in srgb, var(--brand) ${Math.round(15 + p * 0.55)}%, #ffffff)`);

export default function DiarioObra({ obra, atualizar }: Props) {
  const locais = obra.locais ?? [];
  const apontamentos = obra.apontamentos ?? [];
  const hoje = hojeISO();

  const setLocais = (fn: (l: Local[]) => Local[]) => atualizar((o) => ({ ...o, locais: fn(o.locais ?? []) }));
  const setItem = (id: string, patch: Partial<ItemOrcamento>) => atualizar((o) => ({ ...o, itens: o.itens.map((x) => (x.id === id ? { ...x, ...patch } : x)) }));
  const addApontamentos = (novos: Apontamento[]) => atualizar((o) => ({ ...o, apontamentos: [...(o.apontamentos ?? []), ...novos] }));

  const [editandoFases, setEditandoFases] = useState<string | null>(null);

  // ---------- Quadro por local e fase ----------
  const [itemQuadro, setItemQuadro] = useState('');
  const itemQ = obra.itens.find((i) => i.id === itemQuadro) ?? obra.itens.find((i) => (i.locais ?? []).length || (i.fases ?? []).length) ?? obra.itens[0];

  // ---------- Formulário de lançamento ----------
  const vazioF = { data: hoje, itemId: '', localId: '', fase: '', prumada: '', pavDe: '', pavAte: '', quantidade: '', percentual: '', equipe: '', obs: '' };
  const [f, setF] = useState(vazioF);
  const [msgF, setMsgF] = useState('');
  const itemF = obra.itens.find((i) => i.id === f.itemId);
  const localF = locais.find((l) => l.id === f.localId);
  const fasesF = itemF ? fasesDoItem(itemF).filter((x) => x.nome) : [];

  const lancar = () => {
    if (!itemF) return setMsgF('Escolha a etapa.');
    if (fasesF.length && !f.fase) return setMsgF('Escolha a fase do serviço.');
    const extra = { equipe: f.equipe || undefined, observacao: f.obs || undefined, fase: f.fase || undefined };
    const rotulo = `${itemF.codigo}${f.fase ? ` · ${f.fase}` : ''}${localF ? ` · ${localF.nome}` : ''}`;
    if (localF && ehFachada(localF) && f.prumada && (f.pavDe || f.pavAte)) {
      const r = apontamentoDeTrecho(obra, itemF, localF, f.data, lerPrumadas(f.prumada), Number(f.pavDe || f.pavAte), Number(f.pavAte || f.pavDe), extra);
      if (!r.apontamento) return setMsgF(r.repetidos ? 'Esses panos já estavam registrados.' : 'Trecho inválido para este local.');
      addApontamentos([r.apontamento]);
      setMsgF(`Registrado (${rotulo}): ${r.apontamento.panos!.length} pano(s) = ${fmtNum(r.apontamento.quantidade)} ${itemF.unidade}${r.repetidos ? ` (${r.repetidos} já existiam)` : ''}.`);
    } else if (f.quantidade.trim()) {
      const q = paraNumero(f.quantidade);
      if (q <= 0) return setMsgF('Quantidade inválida.');
      addApontamentos([{ id: uid(), data: f.data, itemId: itemF.id, localId: localF?.id, quantidade: q, ...extra }]);
      setMsgF(`Registrado (${rotulo}): ${fmtNum(q)} ${itemF.unidade}.`);
    } else if (f.percentual.trim()) {
      const p = Math.min(100, Math.max(0, paraNumero(f.percentual)));
      addApontamentos([{ id: uid(), data: f.data, itemId: itemF.id, localId: localF?.id, quantidade: 0, percentual: p, ...extra }]);
      setMsgF(`Registrado (${rotulo}): ${fmtPct(p, 0)} concluído.`);
    } else {
      return setMsgF('Informe a quantidade feita no dia, o % concluído ou (em fachada) o trecho.');
    }
    setF((x) => ({ ...x, prumada: '', pavDe: '', pavAte: '', quantidade: '', percentual: '', obs: '' }));
  };

  /** Clique numa célula do quadro: prepara o formulário para aquele local e fase. */
  const prepararLancamento = (item: ItemOrcamento, localId: string | undefined, fase: string) => {
    setF((x) => ({ ...x, itemId: item.id, localId: localId ?? '', fase, prumada: '', pavDe: '', pavAte: '', quantidade: '', percentual: '' }));
    setMsgF('');
    document.getElementById('form-producao')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const historico = [...apontamentos].sort((a, b) => (a.data < b.data ? 1 : -1));

  if (!obra.itens.length) return <div className="card vazio">Cadastre a planilha orçamentária antes de usar o diário de obra.</div>;

  return (
    <>
      <div className="card">
        <h2>Como funciona</h2>
        <ol className="peq" style={{ margin: 0, paddingLeft: '1.2rem' }}>
          <li>
            Cadastre os <b>locais</b>: <b>fachadas</b> (divididas em panos: prumada do balancim × pavimento) ou <b>áreas/ambientes</b> (laje, rampa, guarita,
            banheiro, reservatório…).
          </li>
          <li>
            Ligue cada etapa aos seus locais e, se quiser, divida-a em <b>fases</b> com peso (ex.: impermeabilização = regularização, primer, manta, teste,
            proteção).
          </li>
          <li>
            No dia a dia, informe o que avançou: a <b>quantidade</b> feita, o <b>% concluído</b> do serviço naquele local, ou, em fachada, o <b>trecho</b>{' '}
            (prumada e pavimentos). O aplicativo calcula o avanço da etapa.
          </li>
        </ol>
      </div>

      <ImportarMaisControle obra={obra} atualizar={atualizar} />

      {/* ---------------- LOCAIS ---------------- */}
      <div className="card">
        <div className="linha entre">
          <h2>Locais da obra</h2>
          <div className="linha">
            {!locais.some(ehFachada) && (
              <button className="btn sec" onClick={() => setLocais((l) => [...l, ...locaisPadrao(10, 1000)])}>
                + 4 fachadas padrão
              </button>
            )}
            <button className="btn sec" onClick={() => setLocais((l) => [...l, { id: uid(), nome: `Área ${l.length + 1}`, tipo: 'area', area: 0, pavimentos: 1, prumadas: 1 }])}>
              + Área / ambiente
            </button>
            <button className="btn sec" onClick={() => setLocais((l) => [...l, { id: uid(), nome: `Fachada ${l.filter(ehFachada).length + 1}`, tipo: 'fachada', area: 0, pavimentos: 10, prumadas: 4 }])}>
              + Fachada
            </button>
          </div>
        </div>
        {locais.length === 0 ? (
          <div className="muted">Nenhum local cadastrado. Sem locais, a produção é lançada sobre a etapa inteira.</div>
        ) : (
          <div className="tabela-wrap">
            <table>
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>Tipo</th>
                  <th className="num">Área / extensão</th>
                  <th className="num">Pavimentos</th>
                  <th className="num">Prumadas</th>
                  <th className="num">Área por pano</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {locais.map((l) => {
                  const mudar = (p: Partial<Local>) => setLocais((ls) => ls.map((x) => (x.id === l.id ? { ...x, ...p } : x)));
                  const fach = ehFachada(l);
                  const panos = Math.max(1, l.pavimentos) * Math.max(1, l.prumadas);
                  return (
                    <tr key={l.id}>
                      <td>
                        <input id={`loc-nome-${l.id}`} value={l.nome} onChange={(e) => mudar({ nome: e.target.value })} />
                      </td>
                      <td>
                        <select id={`loc-tipo-${l.id}`} value={fach ? 'fachada' : 'area'} onChange={(e) => mudar({ tipo: e.target.value as Local['tipo'] })}>
                          <option value="fachada">Fachada</option>
                          <option value="area">Área / ambiente</option>
                        </select>
                      </td>
                      <td className="num">
                        <Num id={`loc-area-${l.id}`} valor={l.area} aoMudar={(n) => mudar({ area: n })} />
                      </td>
                      <td className="num">
                        {fach ? <Num id={`loc-pav-${l.id}`} largura={60} valor={l.pavimentos} aoMudar={(n) => mudar({ pavimentos: Math.max(1, Math.round(n)) })} /> : <span className="muted">—</span>}
                      </td>
                      <td className="num">
                        {fach ? <Num id={`loc-pru-${l.id}`} largura={60} valor={l.prumadas} aoMudar={(n) => mudar({ prumadas: Math.max(1, Math.round(n)) })} /> : <span className="muted">—</span>}
                      </td>
                      <td className="num">{fach ? (l.larguras?.length ? <span title="Balancins de larguras diferentes">varia</span> : fmtNum(l.area / panos)) : <span className="muted">—</span>}</td>
                      <td>
                        <BotaoConfirmar className="btn perigo mini" confirmar="Excluir?" aoConfirmar={() => setLocais((ls) => ls.filter((x) => x.id !== l.id))} title="Excluir local">
                          ✕
                        </BotaoConfirmar>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <div className="muted peq" style={{ marginTop: '.4rem' }}>
          A área serve para dividir a quantidade de cada etapa entre os locais (ex.: laje G1 com 1.200 m² e G2 com 900 m²). Para um ambiente medido por verba (ex.:
          guarita), a área pode ficar 1.
        </div>
      </div>

      {/* ---------------- ETAPAS: LOCAIS E FASES ---------------- */}
      <div className="card">
        <h2>Etapas: onde são executadas e em que fases</h2>
        <div className="muted peq">Marque os locais de cada etapa e defina as fases (opcional). Sem fases, a etapa avança como um serviço único.</div>
        <div className="tabela-wrap">
          <table>
            <thead>
              <tr>
                <th>Etapa</th>
                {locais.map((l) => (
                  <th key={l.id} className="num">
                    {l.nome}
                  </th>
                ))}
                <th>Fases</th>
                <th className="num">Avanço (diário)</th>
              </tr>
            </thead>
            <tbody>
              {obra.itens.map((i) => {
                const qpl = quantidadePorLocal(obra, i);
                const exec = quantidadeExecutada(obra, i.id, hoje);
                const fases = (i.fases ?? []).filter((x) => x.nome);
                return (
                  <tr key={i.id}>
                    <td>
                      <b>{i.codigo}</b> {i.descricao}
                      <div className="peq muted">
                        {fmtNum(i.quantidade)} {i.unidade}
                      </div>
                    </td>
                    {locais.map((l) => {
                      const marcado = (i.locais ?? []).includes(l.id);
                      return (
                        <td key={l.id} className="num">
                          <input
                            type="checkbox"
                            style={{ width: 'auto' }}
                            checked={marcado}
                            aria-label={`${i.descricao} em ${l.nome}`}
                            onChange={(e) => setItem(i.id, { locais: e.target.checked ? [...(i.locais ?? []), l.id] : (i.locais ?? []).filter((y) => y !== l.id) })}
                          />
                          {marcado && (
                            <div className="peq muted">
                              {fmtNum(qpl.get(l.id) ?? 0)} {i.unidade}
                            </div>
                          )}
                        </td>
                      );
                    })}
                    <td className="peq" style={{ minWidth: 170 }}>
                      {fases.length ? fases.map((x) => `${x.nome} ${x.peso}%`).join(' · ') : <span className="muted">Serviço único</span>}
                      <div>
                        <button className="btn sec mini" style={{ marginTop: 4 }} onClick={() => setEditandoFases(editandoFases === i.id ? null : i.id)}>
                          {editandoFases === i.id ? 'Fechar' : fases.length ? 'Editar fases' : 'Definir fases'}
                        </button>
                      </div>
                    </td>
                    <td className="num">
                      {exec > 0 ? (
                        <>
                          {fmtPct((exec / (i.quantidade || 1)) * 100, 0)}
                          <div className="peq muted">
                            ≈ {fmtNum(exec)} {i.unidade}
                          </div>
                        </>
                      ) : (
                        <span className="muted">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {editandoFases && (
          <EditorFases
            key={editandoFases}
            item={obra.itens.find((i) => i.id === editandoFases)!}
            aoSalvar={(fases) => {
              setItem(editandoFases, { fases });
              setEditandoFases(null);
            }}
          />
        )}
      </div>

      {/* ---------------- QUADRO DE AVANÇO ---------------- */}
      {itemQ && (
        <div className="card">
          <h2>Quadro de avanço por local e fase</h2>
          <label className="campo" style={{ maxWidth: 520, margin: '.4rem 0 .6rem' }}>
            Etapa
            <select id="quadro-etapa" value={itemQ.id} onChange={(e) => setItemQuadro(e.target.value)}>
              {obra.itens.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.codigo} {i.descricao}
                </option>
              ))}
            </select>
          </label>
          <QuadroAvanco obra={obra} item={itemQ} data={hoje} aoClicar={prepararLancamento} />
          <div className="muted peq" style={{ marginTop: '.4rem' }}>
            Clique numa célula para lançar a produção daquele local e fase. Etapa inteira: <b>{fmtPct(executadoItem(obra, itemQ.id, hoje))}</b> (considera também o
            % lançado na aba Andamento).
          </div>
        </div>
      )}

      {/* ---------------- MAPA DA FACHADA ---------------- */}
      <MapaFachada obra={obra} hoje={hoje} addApontamentos={addApontamentos} />

      {/* ---------------- LANÇAMENTO DO DIÁRIO ---------------- */}
      <div className="card" id="form-producao">
        <div className="linha entre">
          <div>
            <h2>Lançar produção do dia</h2>
            <div className="muted peq">Informe UMA das três: quantidade feita hoje, % concluído acumulado, ou trecho da fachada.</div>
          </div>
          <div className="linha">
            {import.meta.env.VITE_MODO !== 'pagina' && (
              <button className="btn sec" onClick={() => baixarRdoDaObra(obra)} title="Planilha do RDO com as etapas, locais e fases desta obra">
                Baixar RDO desta obra
              </button>
            )}
            <Importador
              tipo="diario"
              rotulo="Importar RDO / diário"
              aoImportarArquivo={async (arquivo) => {
                const { producao, dias } = await lerRdo(arquivo);
                const p = importarDiario(obra, producao);
                const d = importarDias(dias);
                atualizar((o) => ({
                  ...o,
                  apontamentos: [...(o.apontamentos ?? []), ...p.registros],
                  // um registro por dia: o importado substitui o da mesma data
                  diasRdo: [...(o.diasRdo ?? []).filter((x) => !d.registros.some((n) => n.data === x.data)), ...d.registros],
                }));
                const avisos = [...p.avisos, ...d.avisos];
                if (d.registros.length) avisos.unshift(`${d.registros.length} dia(s) com clima, efetivo e ocorrências importados.`);
                return { qtd: p.registros.length + d.registros.length, avisos };
              }}
            />
          </div>
        </div>
        <div className="form" style={{ marginTop: '.75rem' }}>
          <label className="campo">
            Data
            <input id="d-data" type="date" value={f.data} onChange={(e) => setF((x) => ({ ...x, data: e.target.value }))} />
          </label>
          <label className="campo" style={{ gridColumn: 'span 2' }}>
            Etapa
            <select id="d-etapa" value={f.itemId} onChange={(e) => setF((x) => ({ ...x, itemId: e.target.value, localId: '', fase: '' }))}>
              <option value="">— escolha —</option>
              {obra.itens.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.codigo} {i.descricao}
                </option>
              ))}
            </select>
          </label>
          <label className="campo">
            Local
            <select id="d-local" value={f.localId} onChange={(e) => setF((x) => ({ ...x, localId: e.target.value }))}>
              <option value="">— etapa inteira —</option>
              {(itemF && (itemF.locais ?? []).length ? locaisDoItem(obra, itemF) : locais).map((l) => (
                <option key={l.id} value={l.id}>
                  {l.nome}
                </option>
              ))}
            </select>
          </label>
          <label className="campo">
            Fase
            <select id="d-fase" value={f.fase} onChange={(e) => setF((x) => ({ ...x, fase: e.target.value }))} disabled={!fasesF.length}>
              <option value="">{fasesF.length ? '— escolha —' : 'Serviço único'}</option>
              {fasesF.map((x) => (
                <option key={x.nome} value={x.nome}>
                  {x.nome}
                </option>
              ))}
            </select>
          </label>
          <label className="campo">
            Quantidade feita hoje {itemF ? `(${itemF.unidade})` : ''}
            <input id="d-qtd" inputMode="decimal" value={f.quantidade} onChange={(e) => setF((x) => ({ ...x, quantidade: e.target.value }))} />
          </label>
          <label className="campo">
            ou % concluído (acumulado)
            <input id="d-pct" inputMode="decimal" placeholder="Ex.: 60" value={f.percentual} onChange={(e) => setF((x) => ({ ...x, percentual: e.target.value }))} />
          </label>
          {localF && ehFachada(localF) && (
            <>
              <label className="campo">
                ou Prumada(s)
                <input id="d-prumada" placeholder="Ex.: 3 ou 1-4" value={f.prumada} onChange={(e) => setF((x) => ({ ...x, prumada: e.target.value }))} />
              </label>
              <label className="campo">
                Do pavimento
                <input id="d-pavde" inputMode="numeric" placeholder="Ex.: 12" value={f.pavDe} onChange={(e) => setF((x) => ({ ...x, pavDe: e.target.value }))} />
              </label>
              <label className="campo">
                Até o pavimento
                <input id="d-pavate" inputMode="numeric" placeholder="Ex.: 8" value={f.pavAte} onChange={(e) => setF((x) => ({ ...x, pavAte: e.target.value }))} />
              </label>
            </>
          )}
          <label className="campo">
            Equipe
            <input id="d-equipe" value={f.equipe} onChange={(e) => setF((x) => ({ ...x, equipe: e.target.value }))} />
          </label>
          <label className="campo largo">
            Observação
            <input id="d-obs" value={f.obs} placeholder="Ex.: teste de estanqueidade iniciado (72 h), faltou material…" onChange={(e) => setF((x) => ({ ...x, obs: e.target.value }))} />
          </label>
        </div>
        <div className="linha" style={{ marginTop: '.75rem' }}>
          <button className="btn" onClick={lancar}>
            Registrar produção
          </button>
          {msgF && <span className="peq">{msgF}</span>}
        </div>
      </div>

      {/* ---------------- DIAS DO RDO ---------------- */}
      <DiasRdo obra={obra} atualizar={atualizar} />

      {/* ---------------- HISTÓRICO ---------------- */}
      <div className="card">
        <h2>Produção registrada ({historico.length})</h2>
        {historico.length === 0 ? (
          <div className="muted">Nenhum registro ainda.</div>
        ) : (
          <div className="tabela-wrap" style={{ maxHeight: 420 }}>
            <table>
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Etapa / fase</th>
                  <th>Local / trecho</th>
                  <th className="num">Registro</th>
                  <th>Equipe / obs.</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {historico.map((a) => {
                  const i = obra.itens.find((x) => x.id === a.itemId);
                  const l = locais.find((x) => x.id === a.localId);
                  return (
                    <tr key={a.id}>
                      <td>{fmtData(a.data)}</td>
                      <td>
                        {i ? `${i.codigo} ${i.descricao}` : '(etapa excluída)'}
                        {a.fase && <div className="peq muted">Fase: {a.fase}</div>}
                      </td>
                      <td className="peq">
                        {l?.nome ?? 'Etapa inteira'}
                        {a.panos?.length ? <div className="muted">{a.panos.length} pano(s)</div> : null}
                      </td>
                      <td className="num">
                        {a.percentual != null ? (
                          <>{fmtPct(a.percentual, 0)} concluído</>
                        ) : (
                          <>
                            {fmtNum(a.quantidade)} {i?.unidade}
                          </>
                        )}
                      </td>
                      <td className="peq muted">{[a.equipe, a.observacao].filter(Boolean).join(' · ')}</td>
                      <td>
                        <button
                          className="btn perigo mini"
                          title="Excluir registro"
                          onClick={() => atualizar((o) => ({ ...o, apontamentos: (o.apontamentos ?? []).filter((x) => x.id !== a.id) }))}
                        >
                          ✕
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ */

function EditorFases({ item, aoSalvar }: { item: ItemOrcamento; aoSalvar: (f: Fase[]) => void }) {
  const [fases, setFases] = useState<Fase[]>(item.fases?.length ? item.fases : []);
  const soma = fases.reduce((s, x) => s + (x.peso || 0), 0);
  return (
    <div className="card" style={{ background: 'var(--brand-soft)', marginTop: '.75rem' }}>
      <div className="linha entre">
        <h3 style={{ margin: 0 }}>
          Fases de {item.codigo} {item.descricao}
        </h3>
        <label className="campo" style={{ minWidth: 260 }}>
          Usar um modelo
          <select id="fases-modelo" value="" onChange={(e) => e.target.value && setFases(FASES_PADRAO[e.target.value].map((x) => ({ ...x })))}>
            <option value="">— escolha —</option>
            {Object.keys(FASES_PADRAO).map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </select>
        </label>
      </div>
      <table style={{ marginTop: '.5rem', maxWidth: 560 }}>
        <thead>
          <tr>
            <th>Fase</th>
            <th className="num">Peso no avanço (%)</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {fases.map((x, k) => (
            <tr key={k}>
              <td>
                <input id={`fase-nome-${k}`} value={x.nome} onChange={(e) => setFases((l) => l.map((y, j) => (j === k ? { ...y, nome: e.target.value } : y)))} />
              </td>
              <td className="num">
                <Num id={`fase-peso-${k}`} largura={70} valor={x.peso} aoMudar={(n) => setFases((l) => l.map((y, j) => (j === k ? { ...y, peso: n } : y)))} />
              </td>
              <td>
                <button className="btn perigo mini" title="Remover fase" onClick={() => setFases((l) => l.filter((_, j) => j !== k))}>
                  ✕
                </button>
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td>Total</td>
            <td className={`num ${fases.length && Math.abs(soma - 100) > 0.01 ? 'neg' : ''}`}>{fmtNum(soma)}%</td>
            <td />
          </tr>
        </tfoot>
      </table>
      {fases.length > 0 && Math.abs(soma - 100) > 0.01 && <div className="aviso">Os pesos somam {fmtNum(soma)}%. O aplicativo considera a proporção entre eles, mas o ideal é somar 100%.</div>}
      <div className="linha" style={{ marginTop: '.6rem' }}>
        <button className="btn sec" onClick={() => setFases((l) => [...l, { nome: '', peso: 0 }])}>
          + Fase
        </button>
        <button className="btn" onClick={() => aoSalvar(fases.filter((x) => x.nome.trim()))}>
          Salvar fases
        </button>
        {fases.length > 0 && (
          <button className="btn sec" onClick={() => aoSalvar([])}>
            Remover todas (serviço único)
          </button>
        )}
      </div>
    </div>
  );
}

function QuadroAvanco({
  obra,
  item,
  data,
  aoClicar,
}: {
  obra: Obra;
  item: ItemOrcamento;
  data: string;
  aoClicar: (item: ItemOrcamento, localId: string | undefined, fase: string) => void;
}) {
  const fases = fasesDoItem(item);
  const locaisItem = locaisDoItem(obra, item);
  const linhas: { id: string | undefined; nome: string }[] = locaisItem.length ? locaisItem.map((l) => ({ id: l.id, nome: l.nome })) : [{ id: undefined, nome: 'Etapa inteira' }];
  const pesoTotal = fases.reduce((s, x) => s + x.peso, 0);
  return (
    <div className="tabela-wrap">
      <table className="quadro">
        <thead>
          <tr>
            <th>Local</th>
            {fases.map((x) => (
              <th key={x.nome} className="num">
                {x.nome || 'Serviço'}
                {x.nome && <div className="peq muted">peso {x.peso}%</div>}
              </th>
            ))}
            <th className="num">Local</th>
          </tr>
        </thead>
        <tbody>
          {linhas.map((l) => {
            const avancos = fases.map((x) => avancoLocalFase(obra, item, l.id, x.nome, data));
            const totalLocal = avancos.reduce((s, p, k) => s + (p * fases[k].peso) / (pesoTotal || 1), 0);
            return (
              <tr key={l.id ?? 'todos'}>
                <td>{l.nome}</td>
                {avancos.map((p, k) => (
                  <td key={k} className="num">
                    <button
                      type="button"
                      className="celula-avanco"
                      style={{ background: corAvanco(p), color: p > 55 ? '#fff' : 'var(--ink)' }}
                      onClick={() => aoClicar(item, l.id, fases[k].nome)}
                      title={`${l.nome}${fases[k].nome ? ` · ${fases[k].nome}` : ''}: ${fmtPct(p, 0)} — clique para lançar`}
                    >
                      {fmtPct(p, 0)}
                    </button>
                  </td>
                ))}
                <td className="num">
                  <b>{fmtPct(totalLocal, 0)}</b>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function MapaFachada({ obra, hoje, addApontamentos }: { obra: Obra; hoje: string; addApontamentos: (a: Apontamento[]) => void }) {
  const fachadas = (obra.locais ?? []).filter(ehFachada);
  const itens = obra.itens.filter((i) => (i.locais ?? []).some((id) => fachadas.some((l) => l.id === id)));
  const [itemSel, setItemSel] = useState('');
  const [localSel, setLocalSel] = useState('');
  const [faseSel, setFaseSel] = useState('');
  const item = itens.find((i) => i.id === itemSel) ?? itens[0];
  const locaisItem = item ? locaisDoItem(obra, item).filter(ehFachada) : [];
  const local = locaisItem.find((l) => l.id === localSel) ?? locaisItem[0];
  const fases = item ? fasesDoItem(item).filter((x) => x.nome) : [];
  const fase = fases.find((x) => x.nome === faseSel)?.nome ?? fases[0]?.nome ?? '';
  const [selecao, setSelecao] = useState<Set<string>>(new Set());
  const [dataReg, setDataReg] = useState(hoje);
  const [equipe, setEquipe] = useState('');
  const [msg, setMsg] = useState('');

  const feitos = useMemo(() => (item && local ? panosExecutados(obra, item.id, local.id, undefined, fase) : new Map<string, string>()), [obra, item, local, fase]);
  if (!item || !local) return null;
  const porPano = qtdPorPano(obra, item, local);
  const total = Math.max(1, local.pavimentos) * Math.max(1, local.prumadas);
  const limpar = () => setSelecao(new Set());

  const alternar = (k: string) => {
    if (feitos.has(k)) return;
    setSelecao((s) => {
      const n = new Set(s);
      if (n.has(k)) n.delete(k);
      else n.add(k);
      return n;
    });
  };
  const selecionarPrumada = (pr: number) =>
    setSelecao((s) => {
      const n = new Set(s);
      const chaves = pavimentosDeCima(local).map((pv) => chavePano(pr, pv)).filter((k) => !feitos.has(k));
      const todas = chaves.every((k) => n.has(k));
      chaves.forEach((k) => (todas ? n.delete(k) : n.add(k)));
      return n;
    });
  const registrar = () => {
    if (!selecao.size) return;
    const panos = [...selecao];
    addApontamentos([
      { id: uid(), data: dataReg, itemId: item.id, localId: local.id, fase: fase || undefined, quantidade: qtdDosPanos(obra, item, local, panos), panos, equipe: equipe || undefined },
    ]);
    setMsg(`${panos.length} pano(s) registrados: ${fmtNum(qtdDosPanos(obra, item, local, panos))} ${item.unidade}${fase ? ` (${fase})` : ''} em ${fmtData(dataReg)}.`);
    limpar();
  };

  return (
    <div className="card">
      <h2>Mapa da fachada</h2>
      <div className="linha" style={{ margin: '.5rem 0' }}>
        <label className="campo" style={{ minWidth: 240, flex: 1 }}>
          Etapa
          <select id="mapa-etapa" value={item.id} onChange={(e) => (setItemSel(e.target.value), setFaseSel(''), limpar())}>
            {itens.map((i) => (
              <option key={i.id} value={i.id}>
                {i.codigo} {i.descricao}
              </option>
            ))}
          </select>
        </label>
        {fases.length > 0 && (
          <label className="campo" style={{ minWidth: 180 }}>
            Fase
            <select id="mapa-fase" value={fase} onChange={(e) => (setFaseSel(e.target.value), limpar())}>
              {fases.map((x) => (
                <option key={x.nome} value={x.nome}>
                  {x.nome}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="campo" style={{ minWidth: 180 }}>
          Fachada
          <select id="mapa-local" value={local.id} onChange={(e) => (setLocalSel(e.target.value), limpar())}>
            {locaisItem.map((l) => (
              <option key={l.id} value={l.id}>
                {l.nome}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="peq" style={{ marginBottom: '.5rem' }}>
        <b>{local.nome}</b>
        {fase && ` · ${fase}`}: {feitos.size} de {total} panos ({fmtPct((feitos.size / total) * 100, 0)}) · {local.larguras?.length ? 'pano médio' : 'cada pano'} = {fmtNum(porPano)} {item.unidade}.{' '}
        <b>Etapa inteira: {fmtPct(executadoItem(obra, item.id, hoje))}</b>
      </div>
      <div className="legenda" style={{ marginBottom: '.5rem' }}>
        <span><i style={{ background: 'var(--brand)' }} />Executado</span>
        <span><i style={{ background: '#f47230' }} />Selecionado para registrar</span>
        <span><i style={{ background: '#e8ecf0' }} />A executar</span>
      </div>
      <div className="tabela-wrap">
        <div className="mapa" style={{ gridTemplateColumns: `44px repeat(${local.prumadas}, minmax(30px, 1fr))` }} role="grid" aria-label={`Mapa de ${local.nome}`}>
          <div className="mapa-canto peq muted">Pav.</div>
          {Array.from({ length: local.prumadas }, (_, k) => (
            <button
              key={k}
              type="button"
              className="mapa-cab"
              onClick={() => selecionarPrumada(k + 1)}
              title={`Selecionar a prumada ${k + 1} inteira${local.larguras?.[k] ? ` (balancim de ${fmtNum(local.larguras[k])} m)` : ''}`}
            >
              P{k + 1}
              {local.larguras?.[k] ? <span className="mapa-larg">{fmtNum(local.larguras[k])}</span> : null}
            </button>
          ))}
          {pavimentosDeCima(local).map((pv) => (
            <div key={pv} style={{ display: 'contents' }}>
              <div className="mapa-pav peq muted">{pv}º</div>
              {Array.from({ length: local.prumadas }, (_, k) => {
                const ch = chavePano(k + 1, pv);
                const dataFeito = feitos.get(ch);
                const sel = selecao.has(ch);
                return (
                  <button
                    key={ch}
                    type="button"
                    className={`pano ${dataFeito ? 'feito' : sel ? 'sel' : ''}`}
                    title={dataFeito ? `Prumada ${k + 1}, ${pv}º pav. — executado em ${fmtData(dataFeito)}` : `Prumada ${k + 1}, ${pv}º pav.`}
                    aria-pressed={sel}
                    onClick={() => alternar(ch)}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>
      <div className="linha" style={{ marginTop: '.75rem' }}>
        <label className="campo" style={{ maxWidth: 170 }}>
          Data
          <input id="mapa-data" type="date" value={dataReg} onChange={(e) => setDataReg(e.target.value)} />
        </label>
        <label className="campo" style={{ maxWidth: 220 }}>
          Equipe (opcional)
          <input id="mapa-equipe" value={equipe} onChange={(e) => setEquipe(e.target.value)} />
        </label>
        <div className="campo" style={{ justifyContent: 'flex-end' }}>
          <button className="btn" disabled={!selecao.size} onClick={registrar}>
            Registrar {selecao.size || ''} pano(s){selecao.size ? ` = ${fmtNum(qtdDosPanos(obra, item, local, [...selecao]))} ${item.unidade}` : ''}
          </button>
        </div>
        {selecao.size > 0 && (
          <button className="btn sec" onClick={limpar}>
            Limpar seleção
          </button>
        )}
      </div>
      {msg && <div className="sucesso">{msg}</div>}
      <div className="muted peq" style={{ marginTop: '.4rem' }}>
        Clique nos panos que ficaram prontos (ou no “P” do topo para a prumada inteira) e depois em Registrar.
      </div>
    </div>
  );
}

function DiasRdo({ obra, atualizar }: Props) {
  const dias = [...(obra.diasRdo ?? [])].sort((a, b) => (a.data < b.data ? 1 : -1));
  if (!dias.length) {
    return (
      <div className="card">
        <h2>Condições dos dias (RDO)</h2>
        <div className="muted">
          Nenhum dia importado. A aba "Dias" do RDO traz clima, efetivo, horas paradas e ocorrências — base para justificar prorrogação de prazo.
        </div>
      </div>
    );
  }
  const impraticaveis = dias.filter((d) => d.condicao === 'impraticavel').length;
  const parciais = dias.filter((d) => d.condicao === 'parcial').length;
  const horas = dias.reduce((s, d) => s + d.horasParadas, 0);
  const efetivoMedio = dias.reduce((s, d) => s + d.efetivoProprio + d.efetivoTerceirizado, 0) / dias.length;
  return (
    <div className="card">
      <h2>Condições dos dias (RDO)</h2>
      <div className="linha peq" style={{ margin: '.4rem 0 .6rem', gap: '1.25rem' }}>
        <span>
          <b>{dias.length}</b> dia(s) registrados
        </span>
        <span className={impraticaveis ? 'neg' : ''}>
          <b>{impraticaveis}</b> impraticável(is)
        </span>
        <span>
          <b>{parciais}</b> parcialmente praticável(is)
        </span>
        <span>
          <b>{fmtNum(horas)}</b> horas paradas
        </span>
        <span>
          Efetivo médio <b>{fmtNum(efetivoMedio)}</b> pessoas/dia
        </span>
      </div>
      <div className="tabela-wrap" style={{ maxHeight: 380 }}>
        <table>
          <thead>
            <tr>
              <th>Data</th>
              <th>Clima (manhã / tarde)</th>
              <th>Condição</th>
              <th className="num">Efetivo próprio</th>
              <th className="num">Terceirizado</th>
              <th className="num">Horas paradas</th>
              <th>Motivo / ocorrências</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {dias.map((d) => (
              <tr key={d.id}>
                <td>
                  {fmtData(d.data)}
                  {d.responsavel && <div className="peq muted">{d.responsavel}</div>}
                </td>
                <td className="peq">
                  {d.climaManha || '—'} / {d.climaTarde || '—'}
                </td>
                <td>
                  <span className={`tag ${d.condicao === 'impraticavel' ? 'critico' : d.condicao === 'parcial' ? 'atencao' : 'ok'}`}>{ROTULO_CONDICAO[d.condicao]}</span>
                </td>
                <td className="num">{d.efetivoProprio || '—'}</td>
                <td className="num">{d.efetivoTerceirizado || '—'}</td>
                <td className="num">{d.horasParadas || '—'}</td>
                <td className="peq">
                  {d.motivoParalisacao && <b>{d.motivoParalisacao}. </b>}
                  {d.ocorrencias}
                </td>
                <td>
                  <button
                    className="btn perigo mini"
                    title="Excluir dia"
                    onClick={() => atualizar((o) => ({ ...o, diasRdo: (o.diasRdo ?? []).filter((x) => x.id !== d.id) }))}
                  >
                    ✕
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
