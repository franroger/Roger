import { describe, expect, it } from 'vitest';
import { analisarContrato, gerarParcelas, identificarDados } from './contrato';
import { obraExemplo } from './demo';
import { analisarObra } from './calc';

const TEXTO = `CONTRATO DE PRESTAÇÃO DE SERVIÇOS Nº 045/2026
CONTRATANTE: CONDOMÍNIO RESIDENCIAL SOLAR DAS PALMEIRAS, inscrito no CNPJ sob nº 00.000.000/0001-00, com sede na Rua das Flores, 100.
CONTRATADA: Empresa de Reformas Ltda.
CLÁUSULA PRIMEIRA – DO OBJETO: recuperação e pintura da fachada e impermeabilização da cobertura.
CLÁUSULA SEGUNDA – DO PREÇO: O valor global do presente contrato é de R$ 850.000,00 (oitocentos e cinquenta mil reais).
CLÁUSULA TERCEIRA – DO PRAZO: O prazo para execução dos serviços é de 180 (cento e oitenta) dias corridos, contados da ordem de serviço, com início previsto em 05/01/2027.
CLÁUSULA QUARTA – DO PAGAMENTO: A CONTRATANTE pagará 15% (quinze por cento) a título de adiantamento na assinatura. As medições serão mensais, e o pagamento ocorrerá em até 20 (vinte) dias após a aprovação da medição e emissão da nota fiscal. Será retido 5% de cada medição a título de retenção técnica.
CLÁUSULA QUINTA – DAS PENALIDADES: O atraso injustificado sujeitará a CONTRATADA à multa de 0,2% por dia de atraso, limitada a 10% do valor do contrato.
CLÁUSULA SEXTA – DO REAJUSTE: Os preços serão reajustados anualmente pelo INCC-DI.
CLÁUSULA SÉTIMA – DA GARANTIA: A CONTRATADA garante os serviços pelo prazo de 5 (cinco) anos.
São Paulo, 20 de dezembro de 2026.`;

describe('leitura do contrato', () => {
  it('identifica os principais dados', () => {
    const d = Object.fromEntries(identificarDados(TEXTO).map((a) => [a.campo, a.valor]));
    expect(d).toMatchObject({
      numeroContrato: '045/2026',
      valorContrato: 850000,
      prazoDias: 180,
      dataInicio: '2027-01-05',
      adiantamentoPct: 15,
      retencaoPct: 5,
      multaAtrasoPctDia: 0.2,
      multaLimitePct: 10,
      prazoPagamentoDias: 20,
      periodicidade: 'mensal',
      reajuste: 'INCC-DI',
      garantia: '5 anos',
      dataAssinatura: '2026-12-20',
    });
    expect(identificarDados(TEXTO).find((a) => a.campo === 'valorContrato')!.rotulo).toBe('Valor do contrato');
    expect(String(d.cliente)).toMatch(/^CONDOM[IÍ]NIO RESIDENCIAL SOLAR DAS PALMEIRAS$/);
  });
});

describe('parcelas', () => {
  it('soma das parcelas geradas confere com o contrato', () => {
    const o = obraExemplo();
    const total = gerarParcelas(o, o.contrato!).reduce((s, p) => s + p.valor, 0);
    expect(total).toBeCloseTo(o.valorContrato, 0);
  });
  it('quita parcelas pela ordem de vencimento', () => {
    const o = obraExemplo();
    const a = analisarObra(o);
    const ac = analisarContrato(o, a.data, a.diasAtrasoProjetado, a.medidoVenda);
    expect(ac.parcelas[0].situacao).toBe('recebida');
    expect(ac.recebido).toBeGreaterThan(0);
  });
});

describe('contrato com sinal e parcelas fixas', () => {
  const T = `CONTRATO DE PRESTAÇÃO DE SERVIÇOS
EMPRESA X LTDA, inscrita no CNPJ sob o nr. 00.000.000/0001-00, denominada CONTRATADA, e o CONDOMÍNIO DO EDIFÍCIO EXEMPLO, inscrito no CNPJ sob o nº
00.000.000/0001-00, localizado á Rua Y, 10 – Recife/PE, denominado como
CONTRATANTE, representado por sua Síndica.
4.1 - Conforme proposta Comercial apresentada , o prazo para execução dos serviços é estimado de 10 meses.
5.1 - O valor acordado para os presentes serviços importam no valor de R$ 533.000,00 (Quinhentos e Trinta e Três Mil Reais.)
5.2 – O Pagamento será seguinte forma:
Autorização : SINAL DE R$ 70.000,00 (Setenta Mil Reais) - Representando 13% do valor da Proposta
O Saldo será pago em 20 parcelas consecutivas de R$ 23.150,00(Vinte e Três mil , Cento e Cinquenta
Reais), a serem pagas dia 15 de cada mês, mediante apresentação da nota fiscal.
d) Pelo atraso na obra, sem justificativa técnica, por culpa do Contratado: multa de 2% (dois por cento) do valor do
contrato, acrescidos de 1% para cada mês de atraso.
7.2 -As multas estabelecidas podem ser aplicadas isoladas ou cumulativamente, ficando o seu total limitado a 10% (dez por cento) do valor contratado.
Recife , 30 de Março de 2026`;
  it('identifica sinal, parcelas, dia, multa fixa e mensal', () => {
    const d = Object.fromEntries(identificarDados(T).map((a) => [a.campo, a.valor]));
    expect(d).toMatchObject({
      cliente: 'CONDOMÍNIO DO EDIFÍCIO EXEMPLO',
      valorContrato: 533000,
      prazoDias: 300,
      sinalValor: 70000,
      adiantamentoPct: 13,
      parcelasQtd: 20,
      parcelaValor: 23150,
      diaPagamento: 15,
      periodicidade: 'parcelas_fixas',
      multaFixaPct: 2,
      multaLimitePct: 10,
      dataAssinatura: '2026-03-30',
    });
    expect(d.multaAtrasoPctDia).toBeCloseTo(1 / 30);
  });
  it('gera sinal + 20 parcelas no dia 15', () => {
    const o = obraExemplo();
    const ps = gerarParcelas({ ...o, dataInicio: '2026-05-01', valorContrato: 533000 }, {
      ...o.contrato!, periodicidade: 'parcelas_fixas', dataAssinatura: '2026-03-30', sinalValor: 70000, parcelasQtd: 20, parcelaValor: 23150, diaPagamento: 15,
    });
    expect(ps).toHaveLength(21);
    expect(ps[1].dataPrevista).toBe('2026-05-15');
    expect(ps[20].dataPrevista).toBe('2027-12-15');
    expect(ps.reduce((s, p) => s + p.valor, 0)).toBeCloseTo(533000);
  });
});
