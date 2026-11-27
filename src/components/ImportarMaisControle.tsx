import { useRef, useState } from 'react';
import { fmtData } from '../lib/format';
import { lerRdoMaisControle, previaRdoMaisControle, type PreviaRdo } from '../lib/maiscontrole';
import { ROTULO_CONDICAO, type Obra } from '../lib/types';

type Props = { obra: Obra; atualizar: (fn: (o: Obra) => Obra) => void };

/** Importa RDOs do Mais Controle salvos pelo navegador (.mht/.html), com prévia antes de gravar. */
export default function ImportarMaisControle({ obra, atualizar }: Props) {
  const ref = useRef<HTMLInputElement>(null);
  const [previas, setPrevias] = useState<(PreviaRdo & { usar: boolean[]; usarDia: boolean })[]>([]);
  const [erro, setErro] = useState('');
  const [msg, setMsg] = useState('');
  const [ajuda, setAjuda] = useState(false);

  const ler = async (arquivos: FileList) => {
    setErro('');
    setMsg('');
    const novas: typeof previas = [];
    for (const f of Array.from(arquivos)) {
      try {
        const rdo = lerRdoMaisControle(await f.text());
        if (!rdo.atividades.length && !rdo.data) throw new Error('não parece um RDO do Mais Controle');
        const p = previaRdoMaisControle(obra, rdo);
        novas.push({ ...p, usar: p.linhas.map((l) => !!l.apontamento), usarDia: !!rdo.data });
      } catch (e) {
        setErro((x) => `${x}${f.name}: ${(e as Error).message}. `);
      }
    }
    novas.sort((a, b) => (a.rdo.data < b.rdo.data ? -1 : 1));
    setPrevias(novas);
  };

  const aplicar = () => {
    const aps = previas.flatMap((p) => p.linhas.filter((l, k) => p.usar[k] && l.apontamento).map((l) => l.apontamento!));
    const dias = previas.filter((p) => p.usarDia).map((p) => p.dia);
    atualizar((o) => ({
      ...o,
      apontamentos: [...(o.apontamentos ?? []), ...aps],
      diasRdo: [...(o.diasRdo ?? []).filter((x) => !dias.some((d) => d.data === x.data)), ...dias],
    }));
    setMsg(`${aps.length} atividade(s) e ${dias.length} dia(s) registrados.`);
    setPrevias([]);
  };

  const semDados = previas.reduce((s, p) => s + p.linhas.filter((l) => !l.apontamento).length, 0);

  return (
    <div className="card">
      <div className="linha entre">
        <div>
          <h2>Importar RDO do Mais Controle</h2>
          <div className="muted peq">
            No Mais Controle, abra o relatório e salve a página (Ctrl+S → “Página da Web, arquivo único” .mht, ou .html). Pode escolher vários RDOs de uma vez.
          </div>
        </div>
        <div className="linha">
          <button className="btn" onClick={() => ref.current?.click()}>
            Escolher RDOs (.mht)
          </button>
          <button className="btn sec mini" onClick={() => setAjuda((x) => !x)}>
            Como o encarregado deve preencher
          </button>
        </div>
        <input
          ref={ref}
          type="file"
          multiple
          accept=".mht,.mhtml,.html,.htm"
          style={{ display: 'none' }}
          onChange={(e) => {
            if (e.target.files?.length) ler(e.target.files);
            e.target.value = '';
          }}
        />
      </div>

      {ajuda && (
        <div className="aviso" style={{ marginTop: '.6rem' }}>
          <b>No campo “Comentário” de cada atividade</b>, escrever <b>onde</b> e <b>quanto</b>, com o local escrito como está cadastrado na obra:
          <ul style={{ margin: '.4rem 0 0', paddingLeft: '1.2rem' }}>
            <li>
              Fachada: <code>Fachada frente, P3, pav 12 ao 8</code> · <code>Lateral esquerda, balancim 2-3, do 10 ao 6</code>
            </li>
            <li>
              Medindo a quantidade: <code>Cobertura 45 m²</code> · <code>Junta fachada fundos 18 m</code> · <code>Vigas pavimento superior 120 kg</code>
            </li>
            <li>
              Sem como medir: <code>Guarita alvenaria 60%</code> (percentual acumulado do serviço naquele local)
            </li>
            <li>Etapa com fases: incluir a fase (ex.: <code>Laje G1, manta, 120 m²</code>).</li>
            <li>
              “Finalizada” sem comentário é entendida como <b>etapa inteira concluída</b>. Se só terminou um trecho, escrever o trecho.
            </li>
          </ul>
        </div>
      )}
      {erro && <div className="aviso">{erro}</div>}
      {msg && <div className="sucesso">{msg}</div>}

      {previas.length > 0 && (
        <div style={{ marginTop: '.75rem' }}>
          {semDados > 0 && (
            <div className="aviso">
              {semDados} atividade(s) não dizem onde nem quanto foi feito e <b>não entram no avanço</b>. Veja o motivo em cada linha.
            </div>
          )}
          {previas.map((p, ip) => (
            <div key={ip} style={{ borderTop: '1px solid var(--line)', paddingTop: '.6rem', marginTop: '.6rem' }}>
              <div className="linha entre">
                <div>
                  <b>
                    RDO nº {p.rdo.numero || '?'} · {fmtData(p.rdo.data)}
                  </b>{' '}
                  <span className="muted peq">
                    {p.rdo.obra} · por {p.rdo.criadoPor || '—'}
                  </span>
                </div>
                <label className="peq linha" style={{ gap: '.3rem' }}>
                  <input
                    type="checkbox"
                    style={{ width: 'auto' }}
                    checked={p.usarDia}
                    onChange={(e) => setPrevias((l) => l.map((x, j) => (j === ip ? { ...x, usarDia: e.target.checked } : x)))}
                  />
                  Registrar o dia: {p.rdo.climaManha || '—'}/{p.rdo.climaTarde || '—'}, {ROTULO_CONDICAO[p.dia.condicao].toLowerCase()}, efetivo {p.dia.efetivoProprio + p.dia.efetivoTerceirizado}
                </label>
              </div>
              {p.avisos.map((a, k) => (
                <div key={k} className="aviso">
                  {a}
                </div>
              ))}
              <div className="tabela-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Usar</th>
                      <th>Atividade</th>
                      <th>Status</th>
                      <th>Comentário do encarregado</th>
                      <th>Como será registrado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {p.linhas.map((l, k) => (
                      <tr key={k}>
                        <td>
                          <input
                            type="checkbox"
                            style={{ width: 'auto' }}
                            disabled={!l.apontamento}
                            checked={p.usar[k]}
                            onChange={(e) => setPrevias((ls) => ls.map((x, j) => (j === ip ? { ...x, usar: x.usar.map((u, i) => (i === k ? e.target.checked : u)) } : x)))}
                          />
                        </td>
                        <td style={{ maxWidth: 320 }}>
                          <b>{l.atividade.codigo}</b> {l.item ? l.item.descricao : l.atividade.descricao.slice(0, 80)}
                        </td>
                        <td className="peq">{l.atividade.status}</td>
                        <td className="peq">{l.atividade.comentario || <span className="muted">(vazio)</span>}</td>
                        <td className={`peq ${l.alerta ? 'neg' : ''}`}>{l.explicacao}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {p.rdo.comentarios.length > 0 && (
                <details className="peq" style={{ marginTop: '.3rem' }}>
                  <summary>Comentários gerais do RDO ({p.rdo.comentarios.length} linhas) — vão para “ocorrências” do dia</summary>
                  <div className="muted">{p.rdo.comentarios.join(' ')}</div>
                </details>
              )}
            </div>
          ))}
          <div className="linha" style={{ marginTop: '.75rem' }}>
            <button className="btn" onClick={aplicar}>
              Registrar no diário
            </button>
            <button className="btn sec" onClick={() => setPrevias([])}>
              Descartar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
