import { useMemo, useState } from 'react';
import { executadoItem } from '../lib/calc';
import { fmtData, fmtNum, fmtPct, hojeISO, uid } from '../lib/format';
import { importarDiario, paraNumero } from '../lib/importar';
import {
  apontamentoDeTrecho,
  chavePano,
  locaisDoItem,
  locaisPadrao,
  panosExecutados,
  pavimentosDeCima,
  qtdPorPano,
  quantidadeExecutada,
  quantidadePorLocal,
} from '../lib/producao';
import type { Apontamento, Local, Obra } from '../lib/types';
import Importador from './Importador';
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

export default function DiarioObra({ obra, atualizar }: Props) {
  const locais = obra.locais ?? [];
  const apontamentos = obra.apontamentos ?? [];
  const hoje = hojeISO();

  const setLocais = (fn: (l: Local[]) => Local[]) => atualizar((o) => ({ ...o, locais: fn(o.locais ?? []) }));
  const addApontamentos = (novos: Apontamento[]) => atualizar((o) => ({ ...o, apontamentos: [...(o.apontamentos ?? []), ...novos] }));

  // ---------- Mapa ----------
  const itensComLocal = obra.itens.filter((i) => (i.locais ?? []).some((id) => locais.some((l) => l.id === id)));
  const [itemSel, setItemSel] = useState<string>('');
  const [localSel, setLocalSel] = useState<string>('');
  const item = itensComLocal.find((i) => i.id === itemSel) ?? itensComLocal[0];
  const locaisItem = item ? locaisDoItem(obra, item) : [];
  const local = locaisItem.find((l) => l.id === localSel) ?? locaisItem[0];
  const [selecao, setSelecao] = useState<Set<string>>(new Set());
  const [dataReg, setDataReg] = useState(hoje);
  const [equipe, setEquipe] = useState('');
  const [msg, setMsg] = useState('');

  const feitos = useMemo(() => (item && local ? panosExecutados(obra, item.id, local.id) : new Map<string, string>()), [obra, item, local]);
  const porPano = item && local ? qtdPorPano(obra, item, local) : 0;

  const alternar = (k: string) => {
    if (feitos.has(k)) return;
    setSelecao((s) => {
      const n = new Set(s);
      if (n.has(k)) n.delete(k);
      else n.add(k);
      return n;
    });
  };
  const selecionarPrumada = (pr: number) => {
    if (!local) return;
    setSelecao((s) => {
      const n = new Set(s);
      const chaves = pavimentosDeCima(local).map((pv) => chavePano(pr, pv)).filter((k) => !feitos.has(k));
      const todas = chaves.every((k) => n.has(k));
      chaves.forEach((k) => (todas ? n.delete(k) : n.add(k)));
      return n;
    });
  };

  const registrarSelecao = () => {
    if (!item || !local || !selecao.size) return;
    const panos = [...selecao];
    addApontamentos([
      { id: uid(), data: dataReg, itemId: item.id, localId: local.id, quantidade: panos.length * porPano, panos, equipe: equipe || undefined },
    ]);
    setMsg(`${panos.length} pano(s) registrados: ${fmtNum(panos.length * porPano)} ${item.unidade} em ${fmtData(dataReg)}.`);
    setSelecao(new Set());
  };

  // ---------- Lançamento por trecho / quantidade ----------
  const [f, setF] = useState({ data: hoje, itemId: '', localId: '', prumada: '', pavDe: '', pavAte: '', quantidade: '', equipe: '', obs: '' });
  const itemF = obra.itens.find((i) => i.id === f.itemId);
  const localF = locais.find((l) => l.id === f.localId);
  const lancar = () => {
    if (!itemF) return setMsgF('Escolha a etapa.');
    if (localF && f.prumada && (f.pavDe || f.pavAte)) {
      const prumadas = f.prumada.split(/[,;]/).flatMap((p) => {
        const m = p.match(/(\d+)\s*-\s*(\d+)/);
        if (m) return Array.from({ length: Number(m[2]) - Number(m[1]) + 1 }, (_, k) => Number(m[1]) + k);
        return p.trim() ? [Number(p)] : [];
      });
      const r = apontamentoDeTrecho(obra, itemF, localF, f.data, prumadas, Number(f.pavDe || f.pavAte), Number(f.pavAte || f.pavDe), {
        equipe: f.equipe || undefined,
        observacao: f.obs || undefined,
      });
      if (!r.apontamento) return setMsgF(r.repetidos ? 'Esses panos já estavam registrados.' : 'Trecho inválido para este local.');
      addApontamentos([r.apontamento]);
      setMsgF(`Registrado: ${r.apontamento.panos!.length} pano(s) = ${fmtNum(r.apontamento.quantidade)} ${itemF.unidade}${r.repetidos ? ` (${r.repetidos} já existiam)` : ''}.`);
    } else {
      const q = paraNumero(f.quantidade);
      if (q <= 0) return setMsgF('Informe a quantidade ou o trecho (prumada e pavimentos).');
      addApontamentos([{ id: uid(), data: f.data, itemId: itemF.id, localId: localF?.id, quantidade: q, equipe: f.equipe || undefined, observacao: f.obs || undefined }]);
      setMsgF(`Registrado: ${fmtNum(q)} ${itemF.unidade} (${fmtPct((q / (itemF.quantidade || 1)) * 100)} da etapa).`);
    }
    setF((x) => ({ ...x, prumada: '', pavDe: '', pavAte: '', quantidade: '', obs: '' }));
  };
  const [msgF, setMsgF] = useState('');

  const historico = [...apontamentos].sort((a, b) => (a.data < b.data ? 1 : -1));
  const nomeItem = (id: string) => {
    const i = obra.itens.find((x) => x.id === id);
    return i ? `${i.codigo} ${i.descricao}` : '(etapa excluída)';
  };

  if (!obra.itens.length) return <div className="card vazio">Cadastre a planilha orçamentária antes de usar o diário de obra.</div>;

  return (
    <>
      <div className="card">
        <h2>Como funciona</h2>
        <ol className="peq" style={{ margin: 0, paddingLeft: '1.2rem' }}>
          <li>
            Cadastre os <b>locais</b> da obra (cada fachada, cobertura, reservatório…) com a área e, nas fachadas, o número de <b>pavimentos</b> e de{' '}
            <b>prumadas</b> (descidas do balancim). Cada prumada × pavimento é um <b>pano</b>.
          </li>
          <li>Marque <b>em quais locais cada etapa é executada</b>. A quantidade da etapa é dividida pela área de cada local.</li>
          <li>
            No dia a dia, registre o que ficou pronto: clicando nos panos do <b>mapa da fachada</b>, informando o <b>trecho</b> (“prumada 3, do 12º ao
            8º”) ou a <b>quantidade</b> (m², m). O aplicativo calcula o percentual da etapa sozinho.
          </li>
        </ol>
      </div>

      {/* ---------------- LOCAIS ---------------- */}
      <div className="card">
        <div className="linha entre">
          <h2>Locais da obra</h2>
          <div className="linha">
            {locais.length === 0 && (
              <button className="btn sec" onClick={() => setLocais(() => locaisPadrao(10, obra.itens.reduce((m, i) => (i.unidade.includes('m²') ? Math.max(m, i.quantidade) : m), 0) || 1000))}>
                Criar 4 fachadas padrão
              </button>
            )}
            <button className="btn" onClick={() => setLocais((l) => [...l, { id: uid(), nome: `Local ${l.length + 1}`, area: 0, pavimentos: 1, prumadas: 1 }])}>
              + Local
            </button>
          </div>
        </div>
        {locais.length === 0 ? (
          <div className="muted">Nenhum local cadastrado.</div>
        ) : (
          <div className="tabela-wrap">
            <table>
              <thead>
                <tr>
                  <th>Nome</th>
                  <th className="num">Área / extensão</th>
                  <th className="num">Pavimentos</th>
                  <th className="num">Prumadas</th>
                  <th className="num">Panos</th>
                  <th className="num">Área por pano</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {locais.map((l) => {
                  const mudar = (p: Partial<Local>) => setLocais((ls) => ls.map((x) => (x.id === l.id ? { ...x, ...p } : x)));
                  const panos = Math.max(1, l.pavimentos) * Math.max(1, l.prumadas);
                  return (
                    <tr key={l.id}>
                      <td>
                        <input id={`loc-nome-${l.id}`} value={l.nome} onChange={(e) => mudar({ nome: e.target.value })} />
                      </td>
                      <td className="num">
                        <Num id={`loc-area-${l.id}`} valor={l.area} aoMudar={(n) => mudar({ area: n })} />
                      </td>
                      <td className="num">
                        <Num id={`loc-pav-${l.id}`} largura={60} valor={l.pavimentos} aoMudar={(n) => mudar({ pavimentos: Math.max(1, Math.round(n)) })} />
                      </td>
                      <td className="num">
                        <Num id={`loc-pru-${l.id}`} largura={60} valor={l.prumadas} aoMudar={(n) => mudar({ prumadas: Math.max(1, Math.round(n)) })} />
                      </td>
                      <td className="num">{panos}</td>
                      <td className="num">{fmtNum(l.area / panos)}</td>
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
          Locais sem balancim (cobertura, reservatório) podem ficar com 1 pavimento e 1 prumada; neles a produção é lançada por quantidade.
        </div>
      </div>

      {/* ---------------- ETAPAS × LOCAIS ---------------- */}
      {locais.length > 0 && (
        <div className="card">
          <h2>Onde cada etapa é executada</h2>
          <div className="muted peq">Marque os locais de cada etapa. Abaixo da marcação aparece a quantidade da etapa naquele local.</div>
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
                  <th className="num">Executado (diário)</th>
                </tr>
              </thead>
              <tbody>
                {obra.itens.map((i) => {
                  const qpl = quantidadePorLocal(obra, i);
                  const exec = quantidadeExecutada(obra, i.id, hoje);
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
                              onChange={(e) =>
                                atualizar((o) => ({
                                  ...o,
                                  itens: o.itens.map((x) =>
                                    x.id === i.id
                                      ? { ...x, locais: e.target.checked ? [...(x.locais ?? []), l.id] : (x.locais ?? []).filter((y) => y !== l.id) }
                                      : x,
                                  ),
                                }))
                              }
                            />
                            {marcado && (
                              <div className="peq muted">
                                {fmtNum(qpl.get(l.id) ?? 0)} {i.unidade}
                              </div>
                            )}
                          </td>
                        );
                      })}
                      <td className="num">
                        {exec > 0 ? (
                          <>
                            {fmtNum(exec)} {i.unidade}
                            <div className="peq muted">{fmtPct((exec / (i.quantidade || 1)) * 100, 0)} da etapa</div>
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
        </div>
      )}

      {/* ---------------- MAPA ---------------- */}
      {item && local && (
        <div className="card">
          <h2>Mapa da fachada</h2>
          <div className="linha" style={{ margin: '.5rem 0' }}>
            <label className="campo" style={{ minWidth: 240, flex: 1 }}>
              Etapa
              <select
                id="mapa-etapa"
                value={item.id}
                onChange={(e) => {
                  setItemSel(e.target.value);
                  setSelecao(new Set());
                }}
              >
                {itensComLocal.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.codigo} {i.descricao}
                  </option>
                ))}
              </select>
            </label>
            <label className="campo" style={{ minWidth: 180 }}>
              Local
              <select
                id="mapa-local"
                value={local.id}
                onChange={(e) => {
                  setLocalSel(e.target.value);
                  setSelecao(new Set());
                }}
              >
                {locaisItem.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.nome}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {(() => {
            const qLocal = quantidadePorLocal(obra, item).get(local.id) ?? 0;
            const execLocal = feitos.size * porPano;
            const total = Math.max(1, local.pavimentos) * Math.max(1, local.prumadas);
            return (
              <div className="peq" style={{ marginBottom: '.5rem' }}>
                <b>{local.nome}</b>: {feitos.size} de {total} panos ({fmtPct((feitos.size / total) * 100, 0)}) · {fmtNum(execLocal)} de {fmtNum(qLocal)} {item.unidade} · cada pano ={' '}
                {fmtNum(porPano)} {item.unidade}. <b>Etapa inteira: {fmtPct(executadoItem(obra, item.id, hoje))}</b>
              </div>
            );
          })()}

          <div className="legenda" style={{ marginBottom: '.5rem' }}>
            <span><i style={{ background: 'var(--brand)' }} />Executado</span>
            <span><i style={{ background: '#f47230' }} />Selecionado para registrar</span>
            <span><i style={{ background: '#e8ecf0' }} />A executar</span>
          </div>

          <div className="tabela-wrap">
            <div className="mapa" style={{ gridTemplateColumns: `44px repeat(${local.prumadas}, minmax(30px, 1fr))` }} role="grid" aria-label={`Mapa de ${local.nome}`}>
              <div className="mapa-canto peq muted">Pav.</div>
              {Array.from({ length: local.prumadas }, (_, k) => (
                <button key={k} type="button" className="mapa-cab" onClick={() => selecionarPrumada(k + 1)} title="Selecionar a prumada inteira">
                  P{k + 1}
                </button>
              ))}
              {pavimentosDeCima(local).map((pv) => (
                <div key={pv} style={{ display: 'contents' }}>
                  <div className="mapa-pav peq muted">{pv}º</div>
                  {Array.from({ length: local.prumadas }, (_, k) => {
                    const ch = chavePano(k + 1, pv);
                    const data = feitos.get(ch);
                    const sel = selecao.has(ch);
                    return (
                      <button
                        key={ch}
                        type="button"
                        className={`pano ${data ? 'feito' : sel ? 'sel' : ''}`}
                        title={data ? `Prumada ${k + 1}, ${pv}º pav. — executado em ${fmtData(data)}` : `Prumada ${k + 1}, ${pv}º pav.`}
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
              <button className="btn" disabled={!selecao.size} onClick={registrarSelecao}>
                Registrar {selecao.size || ''} pano(s){selecao.size ? ` = ${fmtNum(selecao.size * porPano)} ${item.unidade}` : ''}
              </button>
            </div>
            {selecao.size > 0 && (
              <button className="btn sec" onClick={() => setSelecao(new Set())}>
                Limpar seleção
              </button>
            )}
          </div>
          {msg && <div className="sucesso">{msg}</div>}
          <div className="muted peq" style={{ marginTop: '.4rem' }}>
            Clique nos panos que ficaram prontos (ou no “P” do topo para a prumada inteira) e depois em Registrar.
          </div>
        </div>
      )}
      {locais.length > 0 && !itensComLocal.length && (
        <div className="card muted">Marque em “Onde cada etapa é executada” os locais das etapas para ver o mapa da fachada.</div>
      )}

      {/* ---------------- LANÇAMENTO DO DIÁRIO ---------------- */}
      <div className="card">
        <div className="linha entre">
          <div>
            <h2>Lançar produção do dia</h2>
            <div className="muted peq">Informe o trecho (prumada e pavimentos) ou a quantidade executada.</div>
          </div>
          <Importador
            tipo="diario"
            rotulo="Importar diário de obra"
            aoImportar={(linhas) => {
              const { registros, avisos } = importarDiario(obra, linhas);
              addApontamentos(registros);
              return { qtd: registros.length, avisos };
            }}
          />
        </div>
        <div className="form" style={{ marginTop: '.75rem' }}>
          <label className="campo">
            Data
            <input id="d-data" type="date" value={f.data} onChange={(e) => setF((x) => ({ ...x, data: e.target.value }))} />
          </label>
          <label className="campo" style={{ gridColumn: 'span 2' }}>
            Etapa
            <select id="d-etapa" value={f.itemId} onChange={(e) => setF((x) => ({ ...x, itemId: e.target.value, localId: '' }))}>
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
              <option value="">— sem local —</option>
              {(itemF ? locaisDoItem(obra, itemF) : locais).map((l) => (
                <option key={l.id} value={l.id}>
                  {l.nome}
                </option>
              ))}
            </select>
          </label>
          <label className="campo">
            Prumada(s)
            <input id="d-prumada" placeholder="Ex.: 3 ou 1-4" value={f.prumada} onChange={(e) => setF((x) => ({ ...x, prumada: e.target.value }))} disabled={!localF} />
          </label>
          <label className="campo">
            Do pavimento
            <input id="d-pavde" inputMode="numeric" placeholder="Ex.: 12" value={f.pavDe} onChange={(e) => setF((x) => ({ ...x, pavDe: e.target.value }))} disabled={!localF} />
          </label>
          <label className="campo">
            Até o pavimento
            <input id="d-pavate" inputMode="numeric" placeholder="Ex.: 8" value={f.pavAte} onChange={(e) => setF((x) => ({ ...x, pavAte: e.target.value }))} disabled={!localF} />
          </label>
          <label className="campo">
            ou Quantidade {itemF ? `(${itemF.unidade})` : ''}
            <input id="d-qtd" inputMode="decimal" value={f.quantidade} onChange={(e) => setF((x) => ({ ...x, quantidade: e.target.value }))} />
          </label>
          <label className="campo">
            Equipe
            <input id="d-equipe" value={f.equipe} onChange={(e) => setF((x) => ({ ...x, equipe: e.target.value }))} />
          </label>
          <label className="campo largo">
            Observação
            <input id="d-obs" value={f.obs} placeholder="Ex.: chuva à tarde, faltou material…" onChange={(e) => setF((x) => ({ ...x, obs: e.target.value }))} />
          </label>
        </div>
        <div className="linha" style={{ marginTop: '.75rem' }}>
          <button className="btn" onClick={lancar}>
            Registrar produção
          </button>
          {msgF && <span className="peq">{msgF}</span>}
        </div>
      </div>

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
                  <th>Etapa</th>
                  <th>Local / trecho</th>
                  <th className="num">Quantidade</th>
                  <th className="num">% da etapa</th>
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
                      <td>{nomeItem(a.itemId)}</td>
                      <td className="peq">
                        {l?.nome ?? '—'}
                        {a.panos?.length ? <div className="muted">{a.panos.length} pano(s)</div> : null}
                      </td>
                      <td className="num">
                        {fmtNum(a.quantidade)} {i?.unidade}
                      </td>
                      <td className="num">{i ? fmtPct((a.quantidade / (i.quantidade || 1)) * 100) : '—'}</td>
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
