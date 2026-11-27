import { addDias, diffDias, uid } from './format';
import { cronogramaFinanceiro, valorVenda } from './calc';
import type { DadosContrato, Obra, Parcela } from './types';

export type SituacaoParcela = 'recebida' | 'parcial' | 'vencida' | 'a_vencer';

export interface ParcelaAnalisada {
  parcela: Parcela;
  recebido: number;
  situacao: SituacaoParcela;
  diasAtraso: number;
}

export interface AnaliseContrato {
  parcelas: ParcelaAnalisada[];
  totalParcelas: number;
  previstoAteHoje: number;
  recebido: number;
  vencidoNaoRecebido: number;
  qtdVencidas: number;
  /** Multa estimada se o atraso projetado se confirmar. */
  multaEstimada: number;
  retencaoAcumulada: number;
}

/**
 * Situação das parcelas: as receitas lançadas são distribuídas nas parcelas
 * pela ordem de vencimento (a mais antiga é quitada primeiro).
 */
export function analisarContrato(obra: Obra, data: string, diasAtrasoProjetado: number, medidoVenda: number): AnaliseContrato {
  const c = obra.contrato;
  const parcelas = [...(c?.parcelas ?? [])].sort((a, b) => (a.dataPrevista < b.dataPrevista ? -1 : 1));
  let saldo = obra.lancamentos.filter((l) => l.tipo === 'receita' && l.data <= data).reduce((s, l) => s + l.valor, 0);
  const recebidoTotal = saldo;
  const analisadas = parcelas.map((p) => {
    const recebido = Math.min(p.valor, Math.max(0, saldo));
    saldo -= recebido;
    let situacao: SituacaoParcela;
    if (recebido >= p.valor - 0.01) situacao = 'recebida';
    else if (p.dataPrevista < data) situacao = 'vencida';
    else if (recebido > 0) situacao = 'parcial';
    else situacao = 'a_vencer';
    return {
      parcela: p,
      recebido,
      situacao,
      diasAtraso: situacao === 'vencida' ? diffDias(p.dataPrevista, data) : 0,
    };
  });
  const vencidas = analisadas.filter((x) => x.situacao === 'vencida');
  const valorContrato = obra.valorContrato || obra.itens.reduce((s, i) => s + valorVenda(i), 0);
  let multa = 0;
  if (c && c.multaAtrasoPctDia > 0 && diasAtrasoProjetado > 0) {
    const pct = Math.min(c.multaAtrasoPctDia * diasAtrasoProjetado, c.multaLimitePct > 0 ? c.multaLimitePct : Infinity);
    multa = (valorContrato * pct) / 100;
  }
  return {
    parcelas: analisadas,
    totalParcelas: parcelas.reduce((s, p) => s + p.valor, 0),
    previstoAteHoje: parcelas.filter((p) => p.dataPrevista <= data).reduce((s, p) => s + p.valor, 0),
    recebido: recebidoTotal,
    vencidoNaoRecebido: vencidas.reduce((s, x) => s + x.parcela.valor - x.recebido, 0),
    qtdVencidas: vencidas.length,
    multaEstimada: multa,
    retencaoAcumulada: c ? (medidoVenda * c.retencaoPct) / 100 : 0,
  };
}

/**
 * Gera as parcelas a partir das condições: adiantamento na assinatura/início,
 * medições conforme o cronograma (descontando a amortização do adiantamento e a
 * retenção), pagas X dias depois da medição, e devolução da retenção no final.
 */
export function gerarParcelas(obra: Obra, c: DadosContrato): Parcela[] {
  const valorContrato = obra.valorContrato || obra.itens.reduce((s, i) => s + valorVenda(i), 0);
  const totVenda = obra.itens.reduce((s, i) => s + valorVenda(i), 0);
  const fator = totVenda > 0 ? valorContrato / totVenda : 1;
  const out: Parcela[] = [];
  const adiant = (valorContrato * c.adiantamentoPct) / 100;
  if (adiant > 0) {
    out.push({ id: uid(), descricao: `Adiantamento (${c.adiantamentoPct}%)`, dataPrevista: c.dataAssinatura || obra.dataInicio, valor: adiant });
  }
  const fatorLiquido = 1 - c.adiantamentoPct / 100 - c.retencaoPct / 100;
  const { meses, totais } = cronogramaFinanceiro(obra);
  const fimMes = (m: string) => {
    const [a, mm] = m.split('-').map(Number);
    const d = new Date(a, mm, 0);
    return `${a}-${String(mm).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };
  let n = 0;
  if (c.periodicidade === 'quinzenal') {
    meses.forEach((m, k) => {
      const bruto = totais[k] * fator;
      if (bruto <= 0.5) return;
      for (const [dia, rot] of [[`${m}-15`, '1ª quinz.'], [fimMes(m), '2ª quinz.']] as const) {
        n++;
        out.push({ id: uid(), descricao: `Medição ${String(n).padStart(2, '0')} (${rot})`, dataPrevista: addDias(dia, c.prazoPagamentoDias), valor: (bruto / 2) * fatorLiquido });
      }
    });
  } else if (c.periodicidade === 'por_etapa') {
    for (const i of obra.itens) {
      if (!i.fimPrevisto) continue;
      out.push({ id: uid(), descricao: `Conclusão ${i.codigo} ${i.descricao}`.trim(), dataPrevista: addDias(i.fimPrevisto, c.prazoPagamentoDias), valor: valorVenda(i) * fator * fatorLiquido });
    }
    out.sort((a, b) => (a.dataPrevista < b.dataPrevista ? -1 : 1));
  } else {
    meses.forEach((m, k) => {
      const bruto = totais[k] * fator;
      if (bruto <= 0.5) return;
      n++;
      out.push({ id: uid(), descricao: `Medição ${String(n).padStart(2, '0')}`, dataPrevista: addDias(fimMes(m), c.prazoPagamentoDias), valor: bruto * fatorLiquido });
    });
  }
  const ret = (valorContrato * c.retencaoPct) / 100;
  if (ret > 0) {
    const ultima = out.reduce((m, p) => (p.dataPrevista > m ? p.dataPrevista : m), obra.dataFim || obra.dataInicio);
    out.push({ id: uid(), descricao: `Devolução da retenção (${c.retencaoPct}%)`, dataPrevista: addDias(ultima, 30), valor: ret });
  }
  return out.map((p) => ({ ...p, valor: Math.round(p.valor * 100) / 100 }));
}

/* ------------------------------------------------------------------ */
/* Leitura do arquivo do contrato                                       */
/* ------------------------------------------------------------------ */

export async function extrairTexto(arquivo: File): Promise<string> {
  const nome = arquivo.name.toLowerCase();
  const buf = await arquivo.arrayBuffer();
  if (nome.endsWith('.pdf')) return textoPdf(buf);
  if (nome.endsWith('.docx')) return textoDocx(buf);
  if (nome.endsWith('.txt') || nome.endsWith('.md')) return new TextDecoder().decode(buf);
  throw new Error('Formato não suportado. Use PDF, Word (.docx) ou texto (.txt).');
}

async function textoPdf(buf: ArrayBuffer): Promise<string> {
  const pdfjs = await import('pdfjs-dist');
  const worker = (await import('pdfjs-dist/build/pdf.worker.min.js?raw')).default;
  if (!pdfjs.GlobalWorkerOptions.workerSrc) {
    pdfjs.GlobalWorkerOptions.workerSrc = URL.createObjectURL(new Blob([worker], { type: 'text/javascript' }));
  }
  const doc = await pdfjs.getDocument({ data: new Uint8Array(buf) }).promise;
  const paginas: string[] = [];
  for (let n = 1; n <= doc.numPages; n++) {
    const pg = await doc.getPage(n);
    const tc = await pg.getTextContent();
    let linha = '';
    const linhas: string[] = [];
    for (const it of tc.items as { str?: string; hasEOL?: boolean }[]) {
      linha += it.str ?? '';
      if (it.hasEOL) {
        linhas.push(linha);
        linha = '';
      }
    }
    if (linha) linhas.push(linha);
    paginas.push(linhas.join('\n'));
  }
  return paginas.join('\n\n');
}

async function textoDocx(buf: ArrayBuffer): Promise<string> {
  const XLSX = await import('xlsx');
  const cfb = XLSX.CFB.read(new Uint8Array(buf), { type: 'array' });
  const idx = cfb.FullPaths.findIndex((p: string) => /word\/document\.xml$/i.test(p));
  const conteudo = idx >= 0 ? cfb.FileIndex[idx]?.content : undefined;
  if (!conteudo || !conteudo.length) throw new Error('Arquivo Word sem conteúdo legível.');
  const xml = new TextDecoder().decode(new Uint8Array(conteudo as ArrayLike<number>));
  return xml
    .replace(/<w:tab\/>/g, '\t')
    .replace(/<\/w:p>/g, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

/* ------------------------------------------------------------------ */
/* Identificação automática dos dados do contrato                       */
/* ------------------------------------------------------------------ */

export type CampoExtraido =
  | 'numeroContrato'
  | 'cliente'
  | 'valorContrato'
  | 'dataAssinatura'
  | 'dataInicio'
  | 'prazoDias'
  | 'adiantamentoPct'
  | 'retencaoPct'
  | 'multaAtrasoPctDia'
  | 'multaLimitePct'
  | 'prazoPagamentoDias'
  | 'periodicidade'
  | 'reajuste'
  | 'garantia';

export interface Achado {
  campo: CampoExtraido;
  rotulo: string;
  valor: string | number;
  exibicao: string;
  trecho: string;
}

const MESES_EXT: Record<string, number> = {
  janeiro: 1, fevereiro: 2, marco: 3, março: 3, abril: 4, maio: 5, junho: 6,
  julho: 7, agosto: 8, setembro: 9, outubro: 10, novembro: 11, dezembro: 12,
};

function num(s: string): number {
  const t = s.replace(/\s/g, '');
  return Number(t.includes(',') ? t.replace(/\./g, '').replace(',', '.') : t.replace(/\.(?=\d{3}\b)/g, ''));
}

function trecho(texto: string, idx: number, len: number): string {
  const ini = Math.max(0, idx - 70);
  const fim = Math.min(texto.length, idx + len + 70);
  return (ini > 0 ? '…' : '') + texto.slice(ini, fim).replace(/\s+/g, ' ').trim() + (fim < texto.length ? '…' : '');
}

function dataDe(s: string): string {
  let m = s.match(/(\d{1,2})\s*[/.-]\s*(\d{1,2})\s*[/.-]\s*(\d{2,4})/);
  if (m) {
    const a = m[3].length === 2 ? `20${m[3]}` : m[3];
    return `${a}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  }
  m = s.match(/(\d{1,2})º?\s+de\s+([a-zç]+)\s+de\s+(\d{4})/i);
  if (m) {
    const mes = MESES_EXT[m[2].toLowerCase()];
    if (mes) return `${m[3]}-${String(mes).padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  }
  return '';
}

const DATA_RE = String.raw`(\d{1,2}\s*[/.-]\s*\d{1,2}\s*[/.-]\s*\d{2,4}|\d{1,2}º?\s+de\s+[a-zç]+\s+de\s+\d{4})`;
const PCT_RE = String.raw`(\d{1,3}(?:[.,]\d+)?)\s*%`;
const MOEDA_RE = String.raw`R\$\s*([\d.]+(?:,\d{2})?)`;

/** Procura os principais dados no texto do contrato. Sempre revisar: é uma leitura automática. */
export function identificarDados(texto: string): Achado[] {
  const achados: Achado[] = [];
  // Junta as linhas quebradas (comum em PDF); mantém as quebras de parágrafo.
  const t = texto
    .replace(/\r/g, '')
    .replace(/[ \t\u00a0]+/g, ' ')
    .replace(/([^\n])\n(?!\n)/g, '$1 ');
  const add = (campo: CampoExtraido, rotulo: string, valor: string | number, exibicao: string, idx: number, len: number) => {
    if (!achados.some((a) => a.campo === campo)) achados.push({ campo, rotulo, valor, exibicao, trecho: trecho(t, idx, len) });
  };
  const busca = (re: RegExp, fn: (m: RegExpExecArray) => void) => {
    const m = re.exec(t);
    if (m) fn(m);
  };

  busca(/contrato\s*(?:de\s+[\wçãéí ]{3,40}?)?\s*n[º°o.]*\s*:?\s*([A-Z0-9][\w./-]{1,24})/i, (m) =>
    add('numeroContrato', 'Nº do contrato', m[1], m[1], m.index, m[0].length),
  );

  busca(/CONTRATANTE\s*[:,-]?\s*(?:o|a)?\s*([A-ZÁÉÍÓÚÂÊÔÃÕÇ][^\n,;]{3,90})/, (m) => {
    const nome = m[1].replace(/\s+/g, ' ').replace(/,?\s*(pessoa jur[ií]dica|inscrit[oa]|com sede|CNPJ).*$/i, '').trim();
    if (nome.length > 3) add('cliente', 'Contratante (cliente)', nome, nome, m.index, m[0].length);
  });

  // Valor: perto de "valor global/total", senão o maior valor em R$
  busca(new RegExp(String.raw`(?:valor|pre[çc]o)\s+(?:global|total|do\s+contrato|contratado|certo)[^$]{0,120}?` + MOEDA_RE, 'i'), (m) => {
    const v = num(m[1]);
    if (v > 0) add('valorContrato', 'Valor do contrato', v, `R$ ${m[1]}`, m.index, m[0].length);
  });
  if (!achados.some((a) => a.campo === 'valorContrato')) {
    let maior: RegExpExecArray | null = null;
    const re = new RegExp(MOEDA_RE, 'g');
    for (let m = re.exec(t); m; m = re.exec(t)) if (!maior || num(m[1]) > num(maior[1])) maior = m;
    if (maior) add('valorContrato', 'Valor do contrato (maior valor citado)', num(maior[1]), `R$ ${maior[1]}`, maior.index, maior[0].length);
  }

  busca(/prazo[^.\n]{0,140}?(\d{1,4})\s*(?:\([^)]{2,40}\)\s*)?(dias|meses)(\s+(?:corridos|[úu]teis|consecutivos))?/i, (m) => {
    const n = Number(m[1]);
    const dias = /mes/i.test(m[2]) ? n * 30 : n;
    const desc = `${n} ${m[2]}${m[3] ?? ''}`;
    add('prazoDias', 'Prazo de execução', dias, /mes/i.test(m[2]) ? `${desc} (≈ ${dias} dias)` : desc, m.index, m[0].length);
  });

  busca(new RegExp(String.raw`(?:in[íi]cio|iniciad[oa]s?|come[çc]ar[aã]o?|ordem de servi[çc]o)[^.\n]{0,80}?` + DATA_RE, 'i'), (m) => {
    const d = dataDe(m[1]);
    if (d) add('dataInicio', 'Data de início', d, m[1], m.index, m[0].length);
  });

  // Assinatura: costuma ser a última data por extenso do documento
  {
    const re = new RegExp(String.raw`\d{1,2}º?\s+de\s+[a-zç]+\s+de\s+\d{4}`, 'gi');
    let ultima: RegExpExecArray | null = null;
    for (let m = re.exec(t); m; m = re.exec(t)) ultima = m;
    if (ultima) {
      const d = dataDe(ultima[0]);
      if (d) add('dataAssinatura', 'Data de assinatura', d, ultima[0], ultima.index, ultima[0].length);
    }
  }

  const pctPerto = (palavras: string, campo: CampoExtraido, rotulo: string) => {
    busca(new RegExp(String.raw`(?:${palavras})[^.\n%]{0,120}?` + PCT_RE, 'i'), (m) =>
      add(campo, rotulo, num(m[1]), `${m[1]}%`, m.index, m[0].length),
    );
    busca(new RegExp(PCT_RE + String.raw`[^.\n%]{0,60}?(?:${palavras})`, 'i'), (m) =>
      add(campo, rotulo, num(m[1]), `${m[1]}%`, m.index, m[0].length),
    );
  };
  pctPerto('adiantamento|sinal|entrada|antecipa[çc][ãa]o', 'adiantamentoPct', 'Adiantamento / sinal');
  pctPerto('reten[çc][ãa]o|retid[oa]|cau[çc][ãa]o', 'retencaoPct', 'Retenção técnica / caução');

  busca(/multa[^.\n]{0,120}?(\d{1,2}(?:[.,]\d+)?)\s*%[^.\n]{0,60}?(?:por\s+dia|ao\s+dia|di[áa]ri[oa])/i, (m) =>
    add('multaAtrasoPctDia', 'Multa por dia de atraso', num(m[1]), `${m[1]}% ao dia`, m.index, m[0].length),
  );
  busca(/multa[^.]{0,200}?(?:limitad[oa]|m[áa]xim[oa]|n[ãa]o\s+(?:podendo\s+)?(?:exceder|ultrapassar)|teto)[^.%]{0,60}?(\d{1,2}(?:[.,]\d+)?)\s*%/i, (m) =>
    add('multaLimitePct', 'Limite da multa', num(m[1]), `${m[1]}%`, m.index, m[0].length),
  );

  busca(/(\d{1,3})\s*(?:\([^)]{2,30}\)\s*)?dias[^.\n]{0,80}?(?:ap[óo]s|a\s+contar|contados)[^.\n]{0,60}?(?:medi[çc][ãa]o|nota|fatura|emiss[ãa]o|aprova[çc][ãa]o|apresenta[çc][ãa]o)/i, (m) =>
    add('prazoPagamentoDias', 'Prazo de pagamento', Number(m[1]), `${m[1]} dias após a medição/nota`, m.index, m[0].length),
  );
  busca(/pag(?:amento|o)s?[^.\n]{0,80}?at[ée]\s+o\s+(\d{1,2})º?\s*(?:\([^)]{2,20}\)\s*)?dia/i, (m) =>
    add('prazoPagamentoDias', 'Prazo de pagamento', Number(m[1]), `até o dia ${m[1]} do mês seguinte`, m.index, m[0].length),
  );

  busca(/medi[çc](?:[õo]es|[ãa]o)\s+(?:ser[ãa]o?\s+(?:(?:realizad|feit)[oa]s?\s+)?(?:de\s+forma\s+)?)?(mensa(?:l|is)|quinzena(?:l|is)|semana(?:l|is))/i, (m) => {
    const p = /quinz/i.test(m[1]) ? 'quinzenal' : 'mensal';
    add('periodicidade', 'Periodicidade das medições', p, m[1], m.index, m[0].length);
  });
  if (!achados.some((a) => a.campo === 'periodicidade')) {
    busca(/(?:conclus[ãa]o|t[ée]rmino)\s+de\s+cada\s+etapa/i, (m) =>
      add('periodicidade', 'Periodicidade das medições', 'por_etapa', 'por etapa concluída', m.index, m[0].length),
    );
  }

  busca(/(?:reajust[ae]\w*)[^.\n]{0,120}?(INCC(?:-[A-Z]+)?|IGP-?M|IPCA|INPC|CUB)/i, (m) =>
    add('reajuste', 'Índice de reajuste', m[1].toUpperCase(), m[1].toUpperCase(), m.index, m[0].length),
  );
  busca(/garantia[^.\n]{0,80}?(\d{1,2})\s*(?:\([^)]{2,20}\)\s*)?(anos?|meses)/i, (m) =>
    add('garantia', 'Garantia dos serviços', `${m[1]} ${m[2]}`, `${m[1]} ${m[2]}`, m.index, m[0].length),
  );

  return achados;
}

/** Trechos do contrato que falam de pagamento, para preencher "condições de pagamento". */
export function trechosPagamento(texto: string): string {
  const frases = texto
    .replace(/\s+/g, ' ')
    .split(/(?<=[.;])\s+(?=[A-ZÁÉÍÓÚ0-9§])/)
    .filter((f) => /pagamento|pago|medi[çc][ãa]o|parcela|adiantamento|faturamento|nota fiscal|reten[çc][ãa]o/i.test(f))
    .map((f) => f.trim())
    .filter((f) => f.length > 20 && f.length < 600);
  return frases.slice(0, 8).join('\n\n');
}
