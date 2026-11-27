import { useRef, useState } from 'react';
import { useStore } from '../lib/store';
import { obraExemplo } from '../lib/demo';
import { hojeISO } from '../lib/format';
import type { BancoDados } from '../lib/types';

export default function Dados() {
  const { exportar, substituirTudo, salvarObra, obras } = useStore();
  const ref = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState('');

  const baixar = () => {
    const blob = new Blob([exportar()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `backup-obras-${hojeISO()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <h1>Backup e dados</h1>
      <div className="card">
        <h2>Onde ficam os dados</h2>
        <p className="muted">
          Nesta versão os dados ficam salvos neste navegador, neste computador. Faça backup com frequência e use o arquivo de backup para levar os
          dados para outro computador.
        </p>
        <div className="linha">
          <button className="btn" onClick={baixar}>
            Baixar backup ({obras.length} obra{obras.length === 1 ? '' : 's'})
          </button>
          <button className="btn sec" onClick={() => ref.current?.click()}>
            Restaurar backup
          </button>
          <button
            className="btn sec"
            onClick={() => {
              salvarObra(obraExemplo());
              setMsg('Obra de exemplo adicionada.');
            }}
          >
            Adicionar obra de exemplo
          </button>
          <input
            ref={ref}
            type="file"
            accept=".json"
            style={{ display: 'none' }}
            onChange={async (e) => {
              const f = e.target.files?.[0];
              e.target.value = '';
              if (!f) return;
              try {
                const db = JSON.parse(await f.text()) as BancoDados;
                if (!Array.isArray(db.obras)) throw new Error('arquivo sem obras');
                if (confirm(`Substituir os dados atuais por ${db.obras.length} obra(s) do backup?`)) {
                  substituirTudo({ versao: 1, obras: db.obras });
                  setMsg('Backup restaurado.');
                }
              } catch (err) {
                setMsg(`Arquivo inválido: ${(err as Error).message}`);
              }
            }}
          />
        </div>
        {msg && <div className="sucesso">{msg}</div>}
      </div>
      <div className="card">
        <h2>Como os indicadores são calculados</h2>
        <ul className="peq">
          <li><b>Previsto</b>: cada etapa avança de forma linear entre a data de início e a de fim previstas. O avanço da obra é a média ponderada pelo valor de venda das etapas.</li>
          <li><b>Executado</b>: último % acumulado informado (ou importado) para cada etapa até a data de referência.</li>
          <li><b>IDP (índice de desempenho de prazo)</b> = executado ÷ previsto. Abaixo de 1 = atrasado. O término projetado é a duração do contrato ÷ IDP.</li>
          <li><b>Valor agregado</b> = % executado × custo orçado da etapa.</li>
          <li><b>IDC (índice de desempenho de custo)</b> = valor agregado ÷ gasto real. Abaixo de 1 = gastando mais do que o orçado para o que foi feito.</li>
          <li><b>Custo projetado no término</b> = gasto ÷ % executado (para etapas iniciadas); etapas não iniciadas usam o custo orçado. Despesas sem etapa são projetadas pelo avanço físico.</li>
          <li><b>Encontro de contas</b> = total recebido − total gasto. <b>A receber</b> = valor de venda executado − recebido.</li>
        </ul>
      </div>
    </>
  );
}
