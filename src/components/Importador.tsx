import { useRef, useState } from 'react';
import { baixarModelo, lerPlanilha, type TipoImportacao } from '../lib/importar';

const TEXTO: Record<TipoImportacao, string> = {
  orcamento: 'Colunas reconhecidas: Código, Descrição, Unidade, Quantidade, Preço unitário (ou Preço total), Custo unitário (ou Custo total), Execução (Própria / Terceirizada / Mista), Responsável, Início, Fim.',
  andamento: 'Colunas reconhecidas: Data, Código ou Etapa, % Acumulado, Observação. A etapa é localizada pelo código ou pela descrição da planilha orçamentária.',
  financeiro: 'Colunas reconhecidas: Data, Tipo (Despesa/Receita) — ou colunas separadas Entrada/Saída —, Etapa (código), Categoria, Descrição, Valor.',
};

/** Botão de importação de planilha Excel/CSV com retorno de avisos. */
export default function Importador({
  tipo,
  aoImportar,
  rotulo = 'Importar do Excel',
}: {
  tipo: TipoImportacao;
  aoImportar: (linhas: Record<string, unknown>[]) => { qtd: number; avisos: string[] };
  rotulo?: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [res, setRes] = useState<{ qtd: number; avisos: string[] } | null>(null);
  const [erro, setErro] = useState('');
  const [ajuda, setAjuda] = useState(false);

  return (
    <div>
      <div className="linha">
        <button className="btn sec" onClick={() => ref.current?.click()}>
          {rotulo}
        </button>
        {import.meta.env.VITE_MODO !== 'pagina' && (
          <button className="btn sec mini" onClick={() => baixarModelo(tipo)}>
            Baixar modelo
          </button>
        )}
        <button className="btn sec mini" onClick={() => setAjuda((x) => !x)}>
          ?
        </button>
        <input
          ref={ref}
          type="file"
          accept=".xlsx,.xls,.csv,.ods"
          style={{ display: 'none' }}
          onChange={async (e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            if (!f) return;
            setErro('');
            try {
              const linhas = await lerPlanilha(f);
              setRes(aoImportar(linhas));
            } catch (err) {
              setRes(null);
              setErro(`Não foi possível ler o arquivo: ${(err as Error).message}`);
            }
          }}
        />
      </div>
      {ajuda && <div className="muted peq" style={{ marginTop: '.4rem' }}>{TEXTO[tipo]}</div>}
      {erro && <div className="aviso">{erro}</div>}
      {res && (
        <>
          <div className="sucesso">{res.qtd} registro(s) importado(s).</div>
          {res.avisos.length > 0 && (
            <div className="aviso">
              {res.avisos.slice(0, 8).map((a, k) => (
                <div key={k}>{a}</div>
              ))}
              {res.avisos.length > 8 && <div>… e mais {res.avisos.length - 8} aviso(s).</div>}
            </div>
          )}
        </>
      )}
    </div>
  );
}
