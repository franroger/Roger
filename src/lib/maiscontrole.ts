/**
 * Leitura do RDO do Mais Controle ERP salvo pelo navegador (.mht / .mhtml / .html)
 * e interpretação do comentário de cada atividade (local, prumada, pavimentos,
 * quantidade, % e fase).
 */
import { uid } from './format';
import { apontamentoDeTrecho, ehFachada, fasesDoItem, lerPrumadas } from './producao';
import type { Apontamento, CondicaoDia, ItemOrcamento, Local, Obra, RegistroDia } from './types';

export interface AtividadeRdo {
  codigo: string;
  descricao: string;
  unidade: string;
  status: string;
  comentario: string;
}

export interface RdoMaisControle {
  numero: string;
  data: string; // yyyy-mm-dd
  obra: string;
  cliente: string;
  criadoPor: string;
  climaManha: string;
  condManha: string;
  climaTarde: string;
  condTarde: string;
  maoDeObra: { qtd: number; funcao: string; nome: string; obs: string }[];
  atividades: AtividadeRdo[];
  comentarios: string[];
}

const MESES: Record<string, number> = { jan: 1, fev: 2, mar: 3, abr: 4, mai: 5, jun: 6, jul: 7, ago: 8, set: 9, out: 10, nov: 11, dez: 12 };

function semTags(s: string): string {
  return s
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t ]+/g, ' ')
    .replace(/\s*\n\s*/g, '\n')
    .trim();
}

/** Extrai o HTML principal de um arquivo .mht (ou devolve o próprio HTML). */
export function htmlDoArquivo(conteudo: string): string {
  const ini = conteudo.search(/<!DOCTYPE html|<html[\s>]/i);
  if (ini < 0) return conteudo;
  let html = conteudo.slice(ini);
  const fim = html.search(/<\/html>/i);
  if (fim >= 0) html = html.slice(0, fim + 7);
  // Quoted-printable (alguns navegadores salvam assim)
  if (/=\r?\n|=3D/.test(html) && /Content-Transfer-Encoding:\s*quoted-printable/i.test(conteudo.slice(0, ini))) {
    const bytes = html
      .replace(/=\r?\n/g, '')
      .replace(/=([0-9A-F]{2})/gi, (_, h) => String.fromCharCode(parseInt(h, 16)));
    html = new TextDecoder().decode(Uint8Array.from(bytes, (c) => c.charCodeAt(0)));
  }
  return html;
}

const climaDoIcone = (icone: string) =>
  /rain|chuv|storm/i.test(icone) ? 'Chuva' : /cloud|nubl/i.test(icone) ? 'Nublado' : /sun|sol|clear/i.test(icone) ? 'Bom' : '';

export function lerRdoMaisControle(conteudo: string): RdoMaisControle {
  const html = htmlDoArquivo(conteudo).replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, ' ');
  // Quebra de linha nos fins de bloco, para cada campo ficar na sua linha
  const texto = semTags(html.replace(/<\/(p|div|td|tr|li|h\d|header|section)>/gi, '\n'));
  const pegar = (re: RegExp) => texto.match(re)?.[1]?.trim() ?? '';

  const numero = pegar(/Relat[óo]rio N[ºo°]\s*(\d+)/i) || pegar(/RDO\s*-\s*(\d+)/i);
  let data = '';
  const md = texto.match(/(\d{1,2})\s+(jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)\w*\.?\s+(\d{4})/i);
  if (md) data = `${md[3]}-${String(MESES[md[2].toLowerCase()]).padStart(2, '0')}-${md[1].padStart(2, '0')}`;
  else {
    const d2 = texto.match(/(\d{2})\/(\d{2})\/(\d{4})/);
    if (d2) data = `${d2[3]}-${d2[2]}-${d2[1]}`;
  }

  // Tempo: ícone + período + (condição)
  const periodo = (nome: string) => {
    const m = html.match(new RegExp(`assets/([\\w-]+?)-[\\w]+\\.svg[^>]*>[\\s\\S]{0,400}?<p[^>]*>\\s*${nome}\\s*</p>\\s*<p[^>]*>\\s*\\(([^)]*)\\)`, 'i'));
    return { clima: m ? climaDoIcone(m[1]) : '', cond: m?.[2]?.trim() ?? '' };
  };
  const manha = periodo('Manh[ãa]');
  const tarde = periodo('Tarde');

  // Mão de obra (versão desktop da linha)
  const maoDeObra: RdoMaisControle['maoDeObra'] = [];
  const reMao =
    /<p class="col-span-4 hidden md:block"><span class="mr-2">(\d+)<\/span>([\s\S]*?)<\/p>\s*<div class="col-span-4 hidden md:block">([\s\S]*?)<\/div>\s*<div class="col-span-4 hidden md:block">([\s\S]*?)<\/div>/gi;
  for (let m = reMao.exec(html); m; m = reMao.exec(html)) {
    maoDeObra.push({ qtd: Number(m[1]) || 1, funcao: semTags(m[2]), nome: semTags(m[3]), obs: semTags(m[4]) });
  }

  // Atividades: tabela com colunas Atividades | Status da Atividade | Comentário
  const atividades: AtividadeRdo[] = [];
  const tabela = html.match(/Status da Atividade[\s\S]*?<tbody>([\s\S]*?)<\/tbody>/i)?.[1] ?? '';
  for (const tr of tabela.split(/<tr[^>]*>/i).slice(1)) {
    const tds = tr.split(/<td[^>]*>/i).slice(1).map((x) => semTags(x.replace(/<\/td>[\s\S]*$/i, '')));
    if (!tds[0]) continue;
    const m = tds[0].match(/^([\d.]+)\s*-\s*([\s\S]*?)(?:\s+-\s+([^\s-][^-]{0,8}))?$/);
    atividades.push({
      codigo: m?.[1] ?? '',
      descricao: (m?.[2] ?? tds[0]).trim(),
      unidade: m?.[3]?.trim() ?? '',
      status: tds[1] ?? '',
      comentario: tds[2] ?? '',
    });
  }

  // Comentários gerais
  const blocoCom = html.match(/>\s*Coment[áa]rios\s*<\/p>\s*<\/header>([\s\S]*?)<\/section>/i)?.[1] ?? '';
  const comentarios = blocoCom
    .split(/<\/div>/i)
    .map((x) => semTags(x))
    .filter(Boolean);

  return {
    numero,
    data,
    obra: pegar(/Obra:\s*([^\n]+)/),
    cliente: pegar(/Cliente:\s*([^\n]+)/),
    criadoPor: pegar(/Criado por:\s*([^\n]+)/),
    climaManha: manha.clima,
    condManha: manha.cond,
    climaTarde: tarde.clima,
    condTarde: tarde.cond,
    maoDeObra,
    atividades,
    comentarios,
  };
}

/* ------------------------------------------------------------------ */
/* Interpretação do comentário da atividade                              */
/* ------------------------------------------------------------------ */

const norm = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

export interface Interpretacao {
  local?: Local;
  fase?: string;
  prumadas: number[];
  pavDe?: number;
  pavAte?: number;
  quantidade?: number;
  percentual?: number;
}

/**
 * Lê o comentário no padrão combinado com o encarregado, em qualquer ordem, ex.:
 *   "Fachada frente, P3, pav 12 ao 8"   · "Lateral esq. balancim 2-3 do 10 ao 6"
 *   "Cobertura 45 m²"   · "Guarita alvenaria 60%"   · "Junta 18 m fachada fundos"
 */
export function interpretarComentario(txt: string, obra: Obra, item?: ItemOrcamento): Interpretacao {
  let t = ` ${norm(txt)} `;
  const r: Interpretacao = { prumadas: [] };

  // Local: o nome cadastrado mais longo que aparecer no texto; aceita abreviações comuns
  const locais = [...(obra.locais ?? [])].sort((a, b) => b.nome.length - a.nome.length);
  const apelidos = (l: Local) => {
    const n = norm(l.nome);
    const lista = [n, n.replace(/^fachada /, ''), n.replace('esquerda', 'esq').replace('direita', 'dir')];
    return [...new Set(lista)].filter((x) => x.length >= 4);
  };
  for (const l of locais) {
    const ap = apelidos(l).find((a) => t.includes(` ${a}`));
    if (ap) {
      r.local = l;
      t = t.replace(ap, ' ');
      break;
    }
  }

  // Fase da etapa
  if (item) {
    const fases = fasesDoItem(item).filter((f) => f.nome);
    const f = fases.find((x) => t.includes(norm(x.nome))) ?? fases.find((x) => norm(x.nome).split(/[ /]+/).some((p) => p.length >= 5 && t.includes(p)));
    if (f) r.fase = f.nome;
  }

  // Pavimentos: "pav 12 ao 8", "do 12 ao 8", "12º ao 8º", "pavimentos 12-8"
  const mp =
    t.match(/pav\w*\.?\s*(?:do\s+)?(\d{1,3})\s*[ºo°]?\s*(?:ao|a|ate|-|\/)\s*(?:o\s+)?(\d{1,3})/) ??
    t.match(/\bdo\s+(\d{1,3})\s*[ºo°]?\s*(?:pav\w*\s*)?(?:ao|a|ate)\s+(?:o\s+)?(\d{1,3})\s*[ºo°]?/) ??
    t.match(/\b(\d{1,3})\s*[ºo°]\s*(?:ao|a|ate|-)\s*(\d{1,3})\s*[ºo°]/);
  if (mp) {
    r.pavDe = Number(mp[1]);
    r.pavAte = Number(mp[2]);
    t = t.replace(mp[0], ' ');
  } else {
    const um = t.match(/(\d{1,3})\s*[ºo°]\s*pav\w*|pav\w*\.?\s*(\d{1,3})\b/);
    if (um) {
      r.pavDe = r.pavAte = Number(um[1] ?? um[2]);
      t = t.replace(um[0], ' ');
    }
  }

  // Prumada / balancim: "P3", "prumada 2-4", "balancim 1 e 2"
  const mpr = t.match(/(?:prumadas?|balanci[mn]s?|\bp)\s*\.?\s*(\d{1,2}(?:\s*(?:-|a|e|,)\s*\d{1,2})*)/);
  if (mpr) {
    r.prumadas = lerPrumadas(mpr[1]);
    t = t.replace(mpr[0], ' ');
  }

  // Percentual
  const mpc = t.match(/(\d{1,3}(?:[.,]\d+)?)\s*%/);
  if (mpc) {
    r.percentual = Math.min(100, Number(mpc[1].replace(',', '.')));
    t = t.replace(mpc[0], ' ');
  }

  // Quantidade com unidade (m, m², m³, ml, un, pç) ou "qtd 12"
  const mq =
    t.match(/(\d+(?:\.\d{3})*(?:,\d+)?|\d+(?:\.\d+)?)\s*(m²|m2|m³|m3|ml|m|un|und|unid|pc|pç|pcs|kg)(?![a-z0-9²³])/) ?? t.match(/(?:qtd|qtde|quantidade)\.?\s*:?\s*(\d+(?:[.,]\d+)?)/);
  if (mq) {
    const s = mq[1].includes(',') ? mq[1].replace(/\./g, '').replace(',', '.') : mq[1];
    r.quantidade = Number(s);
  }
  return r;
}

/* ------------------------------------------------------------------ */
/* Conversão para os registros do aplicativo                            */
/* ------------------------------------------------------------------ */

export interface LinhaPrevia {
  atividade: AtividadeRdo;
  item?: ItemOrcamento;
  apontamento?: Apontamento;
  explicacao: string;
  alerta: boolean;
}

export interface PreviaRdo {
  rdo: RdoMaisControle;
  dia: RegistroDia;
  linhas: LinhaPrevia[];
  avisos: string[];
}

const condicaoDoDia = (a: string, b: string): CondicaoDia => {
  const imp = [a, b].filter((x) => /impratic/i.test(norm(x))).length;
  return imp === 2 ? 'impraticavel' : imp === 1 ? 'parcial' : 'praticavel';
};

export function previaRdoMaisControle(obra: Obra, rdo: RdoMaisControle): PreviaRdo {
  const avisos: string[] = [];
  if (!rdo.data) avisos.push('Não encontrei a data do RDO.');
  if (rdo.obra && obra.nome && !norm(obra.nome).includes(norm(rdo.obra).slice(0, 12)) && !norm(rdo.obra).includes(norm(obra.nome).slice(0, 12))) {
    avisos.push(`O RDO é da obra "${rdo.obra}" e você está na obra "${obra.nome}". Confira antes de aplicar.`);
  }
  const terceiro = (n: string) => /\b(ltda|me|eireli|s\/?a|epp|servi[cç]os|engenharia|constru)\b/i.test(n);
  const efetivoTerc = rdo.maoDeObra.filter((m) => terceiro(m.nome)).reduce((s, m) => s + m.qtd, 0);
  const efetivoProprio = rdo.maoDeObra.reduce((s, m) => s + m.qtd, 0) - efetivoTerc;
  const dia: RegistroDia = {
    id: uid(),
    data: rdo.data,
    responsavel: rdo.criadoPor,
    climaManha: rdo.climaManha,
    climaTarde: rdo.climaTarde,
    condicao: condicaoDoDia(rdo.condManha, rdo.condTarde),
    efetivoProprio,
    efetivoTerceirizado: efetivoTerc,
    horasParadas: 0,
    motivoParalisacao: '',
    ocorrencias: [rdo.numero ? `RDO nº ${rdo.numero}.` : '', rdo.comentarios.join(' ')].filter(Boolean).join(' '),
  };

  let atual: Obra = { ...obra, apontamentos: [...(obra.apontamentos ?? [])] };
  const linhas: LinhaPrevia[] = rdo.atividades.map((at) => {
    const item = obra.itens.find((i) => i.codigo && norm(i.codigo) === norm(at.codigo));
    if (!item) return { atividade: at, explicacao: `Etapa ${at.codigo} não existe na planilha orçamentária desta obra.`, alerta: true };
    const it = interpretarComentario(at.comentario, obra, item);
    const finalizada = /finaliz|conclu/i.test(at.status);
    const fasesItem = fasesDoItem(item).filter((f) => f.nome);
    const faltaFase = fasesItem.length > 0 && !it.fase;
    const base = { id: uid(), data: rdo.data, itemId: item.id, localId: it.local?.id, fase: it.fase, observacao: at.comentario || undefined };
    const onde = [it.local?.nome, it.fase].filter(Boolean).join(' · ');
    let ap: Apontamento | undefined;
    let explicacao = '';

    if (it.local && ehFachada(it.local) && it.prumadas.length && it.pavDe) {
      const r = apontamentoDeTrecho(atual, item, it.local, rdo.data, it.prumadas, it.pavDe, it.pavAte ?? it.pavDe, { fase: it.fase, observacao: at.comentario });
      if (r.apontamento) {
        ap = r.apontamento;
        explicacao = `${onde}: prumada ${it.prumadas.join(', ')}, pav. ${it.pavDe}→${it.pavAte} = ${ap.panos!.length} pano(s) ≈ ${ap.quantidade.toFixed(1)} ${item.unidade}`;
      } else explicacao = r.repetidos ? 'Esses panos já estavam registrados.' : 'Trecho fora da grade cadastrada para essa fachada.';
    } else if (it.quantidade) {
      ap = { ...base, quantidade: it.quantidade };
      explicacao = `${onde || 'Etapa inteira'}: ${it.quantidade} ${item.unidade}`;
    } else if (it.percentual != null) {
      ap = { ...base, quantidade: 0, percentual: it.percentual };
      explicacao = `${onde || 'Etapa inteira'}: ${it.percentual}% concluído`;
    } else if (finalizada && !faltaFase) {
      ap = { ...base, quantidade: 0, percentual: 100 };
      explicacao = `Status "Finalizada" sem detalhes → ${it.local ? it.local.nome : 'ETAPA INTEIRA'} considerada 100% concluída. Confira!`;
    } else {
      explicacao = at.comentario
        ? `Não entendi o comentário "${at.comentario}". Falta local + prumada/pavimentos, quantidade ou %.`
        : 'Sem comentário: não diz onde nem quanto foi feito. Não será contabilizada.';
    }
    if (ap && faltaFase) {
      ap = undefined;
      explicacao = `A etapa tem fases (${fasesItem.map((f) => f.nome).join(', ')}) e o comentário não diz qual.`;
    }
    if (ap) atual = { ...atual, apontamentos: [...(atual.apontamentos ?? []), ap] };
    return { atividade: at, item, apontamento: ap, explicacao, alerta: !ap || /Confira/.test(explicacao) };
  });

  return { rdo, dia, linhas, avisos };
}
