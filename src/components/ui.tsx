import type { ReactNode } from 'react';
import type { Gravidade } from '../lib/recomendacoes';

export function Kpi({ rotulo, valor, sub, tom }: { rotulo: string; valor: ReactNode; sub?: ReactNode; tom?: Gravidade }) {
  return (
    <div className={`kpi ${tom ?? ''}`}>
      <div className="rot">{rotulo}</div>
      <div className="val">{valor}</div>
      {sub && <div className="sub">{sub}</div>}
    </div>
  );
}

export function Tag({ tom, children }: { tom: Gravidade | 'neutro'; children: ReactNode }) {
  return <span className={`tag ${tom}`}>{children}</span>;
}

export function BarraAvanco({ planejado, executado }: { planejado: number; executado: number }) {
  return (
    <div className="barra" title={`Previsto ${planejado.toFixed(1)}% · Executado ${executado.toFixed(1)}%`}>
      <span className="plan" style={{ width: `${Math.min(100, planejado)}%` }} />
      <span className="exec" style={{ width: `${Math.min(100, executado)}%` }} />
    </div>
  );
}

export function Modal({ titulo, aoFechar, children }: { titulo: string; aoFechar: () => void; children: ReactNode }) {
  return (
    <div className="modal-fundo" onMouseDown={(e) => e.target === e.currentTarget && aoFechar()}>
      <div className="modal" role="dialog" aria-label={titulo}>
        <div className="linha entre" style={{ marginBottom: '.75rem' }}>
          <h2 style={{ margin: 0 }}>{titulo}</h2>
          <button className="btn sec mini" onClick={aoFechar}>
            Fechar
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export const ROTULO_SAUDE: Record<Gravidade, string> = {
  ok: 'Saudável',
  atencao: 'Atenção',
  critico: 'Crítico',
  info: 'Info',
};

export function indiceTom(v: number | null, bom = 0.97, ruim = 0.9): Gravidade {
  if (v === null) return 'info';
  if (v < ruim) return 'critico';
  if (v < bom) return 'atencao';
  return 'ok';
}
