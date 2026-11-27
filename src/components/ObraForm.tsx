import { useState } from 'react';
import type { Obra, StatusObra } from '../lib/types';
import { ROTULO_STATUS } from '../lib/types';
import { paraNumero } from '../lib/importar';

export default function ObraForm({ inicial, aoSalvar, aoCancelar }: { inicial: Obra; aoSalvar: (o: Obra) => void; aoCancelar: () => void }) {
  const [o, setO] = useState<Obra>(inicial);
  const [valorTxt, setValorTxt] = useState(inicial.valorContrato ? String(inicial.valorContrato).replace('.', ',') : '');
  const set = <K extends keyof Obra>(k: K, v: Obra[K]) => setO((x) => ({ ...x, [k]: v }));

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!o.nome.trim()) return;
        aoSalvar({ ...o, valorContrato: paraNumero(valorTxt) });
      }}
    >
      <div className="form">
        <label className="campo largo">
          Nome da obra *
          <input required value={o.nome} onChange={(e) => set('nome', e.target.value)} placeholder="Ex.: Ed. Solar – fachada e impermeabilização" />
        </label>
        <label className="campo">
          Cliente
          <input value={o.cliente} onChange={(e) => set('cliente', e.target.value)} />
        </label>
        <label className="campo">
          Nº do contrato
          <input value={o.numeroContrato} onChange={(e) => set('numeroContrato', e.target.value)} />
        </label>
        <label className="campo largo">
          Endereço
          <input value={o.endereco} onChange={(e) => set('endereco', e.target.value)} />
        </label>
        <label className="campo">
          Valor do contrato (R$)
          <input inputMode="decimal" value={valorTxt} onChange={(e) => setValorTxt(e.target.value)} placeholder="Vazio = soma da planilha" />
        </label>
        <label className="campo">
          Início do contrato
          <input type="date" value={o.dataInicio} onChange={(e) => set('dataInicio', e.target.value)} />
        </label>
        <label className="campo">
          Término do contrato
          <input type="date" value={o.dataFim} onChange={(e) => set('dataFim', e.target.value)} />
        </label>
        <label className="campo">
          Situação
          <select value={o.status} onChange={(e) => set('status', e.target.value as StatusObra)}>
            {Object.entries(ROTULO_STATUS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </label>
        <label className="campo largo">
          Observações
          <textarea value={o.observacoes} onChange={(e) => set('observacoes', e.target.value)} />
        </label>
      </div>
      <div className="linha" style={{ marginTop: '1rem', justifyContent: 'flex-end' }}>
        <button type="button" className="btn sec" onClick={aoCancelar}>
          Cancelar
        </button>
        <button type="submit" className="btn">
          Salvar obra
        </button>
      </div>
    </form>
  );
}
