# Gestão de Obras

Aplicativo web para acompanhar, **obra por obra**, o planejamento, o andamento físico e o financeiro de serviços de reforma, fachada e impermeabilização.

## O que ele faz

**Por obra**
- **Cadastro da obra**: cliente, nº e valor do contrato, prazo (início/término) e situação.
- **Contrato**: importação do contrato em **PDF, Word (.docx) ou texto**. O aplicativo identifica nº, contratante, valor, prazo, início, assinatura, adiantamento, retenção, multa por atraso e seu limite, prazo de pagamento, forma de medição, reajuste e garantia, e mostra o trecho de onde tirou cada informação para conferência. Inclui **cronograma de recebimentos (parcelas)**, gerado pelas condições de pagamento, com a situação de cada parcela (recebida, vencida, a vencer), e busca no texto do contrato. PDFs escaneados (imagem) não têm texto legível; nesse caso os dados são preenchidos à mão.
- **Planilha orçamentária + cronograma**: cada etapa tem quantidade, preço de venda, custo previsto, **tipo de execução (equipe própria, terceirizado ou misto)**, responsável/empresa e período previsto. Telas de planilha, **Gantt** e **cronograma físico-financeiro mensal**.
- **Diário de obra**: a obra é dividida em **locais** (cada fachada, cobertura, reservatório) e cada fachada em **panos** (prumada do balancim × pavimento). Cada etapa é ligada aos locais onde é executada e sua quantidade é distribuída pela área de cada local. A produção do dia é registrada clicando nos panos no **mapa da fachada**, informando o **trecho** ("prumada 3, do 12º ao 8º") ou a **quantidade** (m², m), ou importando o diário em Excel. O aplicativo converte em quantidade e % da etapa, sem contar o mesmo pano duas vezes.
- **Andamento**: lançamento do % acumulado por etapa ou **importação dos relatórios de campo** (Excel/CSV).
- **Financeiro**: despesas e receitas apropriadas às etapas, ou **importação da planilha de custos do Excel**. Inclui gasto x orçado por etapa e despesas por categoria.
- **Painel e recomendações**:
  - avanço previsto x executado (curva S), índice de prazo (IDP) e término projetado;
  - índice de custo (IDC), custo e margem projetados no término;
  - **encontro de contas** (recebido − gasto: deficitário ou superavitário) e valor executado ainda não recebido;
  - comparação entre equipe própria e terceirizados;
  - **recomendações automáticas** de planejamento e financeiro (etapas atrasadas, etapas que vão estourar o orçamento, medição a cobrar, despesas sem etapa etc.).

**Painel das obras (página inicial)**: visão de todas as obras juntas, com indicadores da carteira (valor dos contratos, avanço físico, encontro de contas, parcelas vencidas, margem prevista x projetada, risco de multas), alertas prioritários, recebimentos vencidos e dos próximos 45 dias, tabela de obras ordenável, gráficos de avanço e margem por obra e fluxo de caixa consolidado. Clicar em uma obra, alerta ou parcela abre a obra na aba correspondente.

**Backup e dados**: exportação e restauração dos dados.

## Como rodar

```bash
npm install
npm run dev      # abre em http://localhost:5173
npm test         # testes dos cálculos
npm run build    # gera a pasta dist/ (site estático, pode ser hospedado em qualquer servidor)
npm run build:pagina  # gera dist-pagina/gestao-obras.html (app inteiro em um arquivo)
```

Na primeira abertura, clique em **"Carregar obra de exemplo"** para ver o aplicativo com dados.

## Importação de planilhas

Em cada aba há o botão **Baixar modelo** com as colunas esperadas. O importador reconhece variações de nome de coluna (com ou sem acento), números no formato brasileiro (`1.234,56`) e datas `dd/mm/aaaa`. As etapas são localizadas pelo **código** da planilha orçamentária (ou pela descrição).

| Importação | Colunas |
|---|---|
| Orçamento | Código, Descrição, Unidade, Quantidade, Preço unitário, Custo unitário, Execução, Responsável, Início, Fim |
| Andamento | Data, Código/Etapa, % Acumulado, Observação |
| Diário de obra | Data, Etapa (código), Local, Prumada, Pavimento inicial, Pavimento final **ou** Quantidade, Equipe, Observação |
| Financeiro | Data, Tipo (Despesa/Receita) ou colunas Entrada/Saída, Etapa, Categoria, Descrição, Valor |

## Relatório Diário de Obra (RDO)

Há dois modelos em Excel para a equipe de campo, ambos lidos pelo aplicativo (obra → **Diário de obra → Importar RDO / diário**):

| Modelo | Para | Como a produção é informada |
|---|---|---|
| [`modelos/RDO-fachada.xlsx`](modelos/RDO-fachada.xlsx) | Recuperação e pintura de fachada | Prumada do balancim + faixa de pavimentos (ou quantidade, fora da fachada) |
| [`modelos/RDO-geral.xlsx`](modelos/RDO-geral.xlsx) | Impermeabilização, reformas (guarita, banheiros…) e demais serviços | Quantidade feita no dia **ou** % concluído acumulado do serviço naquele local |

Os dois têm as abas **Instruções**, **Produção** (uma linha por serviço: data, etapa, local, fase, medição, equipe, observação), **Dias** (clima, condição do dia, efetivo, horas paradas, motivo, ocorrências) e **Cadastro** (etapas, fases com peso e locais da obra, que viram listas de escolha).

No aplicativo, cada etapa pode ter **fases com peso** (ex.: impermeabilização = regularização 20%, primer 10%, manta 60%, teste de estanqueidade 10%) e os locais podem ser **fachadas** (com mapa de panos) ou **áreas/ambientes**. O **quadro de avanço por local e fase** mostra o andamento de cada etapa e permite lançar a produção com um clique. Os modelos são gerados por `python3 scripts/gerar_rdo.py modelos`.

### RDO do Mais Controle

Na aba **Diário de obra**, o botão **Importar RDO do Mais Controle** lê os relatórios salvos pelo navegador (`.mht`/`.html`, vários de uma vez): data, clima e condição de cada período, mão de obra, atividades (pelo código da planilha orçamentária), status e comentários. O **comentário de cada atividade** deve dizer onde e quanto foi feito, por exemplo `Fachada frente, P3, pav 12 ao 8`, `Cobertura 45 m²`, `Vigas pavimento superior 120 kg` ou `Guarita alvenaria 60%`. Antes de gravar, o aplicativo mostra como entendeu cada atividade; as que não dizem onde nem quanto ficam de fora do avanço.

## Limitações desta versão

- Os dados ficam salvos **no navegador** (localStorage). Use *Backup e dados* para exportar e restaurar. Para vários usuários ao mesmo tempo é preciso um servidor/banco de dados (próximo passo sugerido).
- O previsto de cada etapa é distribuído de forma linear entre início e fim.

## Tecnologia

React + TypeScript + Vite, Recharts (gráficos), SheetJS (leitura de Excel), Vitest (testes).
