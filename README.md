# Gestão de Obras

Aplicativo web para acompanhar, **obra por obra**, o planejamento, o andamento físico e o financeiro de serviços de reforma, fachada e impermeabilização.

## O que ele faz

**Por obra**
- **Cadastro da obra**: cliente, nº e valor do contrato, prazo (início/término) e situação.
- **Planilha orçamentária + cronograma**: cada etapa tem quantidade, preço de venda, custo previsto, **tipo de execução (equipe própria, terceirizado ou misto)**, responsável/empresa e período previsto. Telas de planilha, **Gantt** e **cronograma físico-financeiro mensal**.
- **Andamento**: lançamento do % acumulado por etapa ou **importação dos relatórios de campo** (Excel/CSV).
- **Financeiro**: despesas e receitas apropriadas às etapas, ou **importação da planilha de custos do Excel**. Inclui gasto x orçado por etapa e despesas por categoria.
- **Painel e recomendações**:
  - avanço previsto x executado (curva S), índice de prazo (IDP) e término projetado;
  - índice de custo (IDC), custo e margem projetados no término;
  - **encontro de contas** (recebido − gasto: deficitário ou superavitário) e valor executado ainda não recebido;
  - comparação entre equipe própria e terceirizados;
  - **recomendações automáticas** de planejamento e financeiro (etapas atrasadas, etapas que vão estourar o orçamento, medição a cobrar, despesas sem etapa etc.).

**Geral**: visão consolidada da carteira, backup e restauração dos dados.

## Como rodar

```bash
npm install
npm run dev      # abre em http://localhost:5173
npm test         # testes dos cálculos
npm run build    # gera a pasta dist/ (site estático, pode ser hospedado em qualquer servidor)
```

Na primeira abertura, clique em **"Carregar obra de exemplo"** para ver o aplicativo com dados.

## Importação de planilhas

Em cada aba há o botão **Baixar modelo** com as colunas esperadas. O importador reconhece variações de nome de coluna (com ou sem acento), números no formato brasileiro (`1.234,56`) e datas `dd/mm/aaaa`. As etapas são localizadas pelo **código** da planilha orçamentária (ou pela descrição).

| Importação | Colunas |
|---|---|
| Orçamento | Código, Descrição, Unidade, Quantidade, Preço unitário, Custo unitário, Execução, Responsável, Início, Fim |
| Andamento | Data, Código/Etapa, % Acumulado, Observação |
| Financeiro | Data, Tipo (Despesa/Receita) ou colunas Entrada/Saída, Etapa, Categoria, Descrição, Valor |

## Limitações desta versão

- Os dados ficam salvos **no navegador** (localStorage). Use *Backup e dados* para exportar e restaurar. Para vários usuários ao mesmo tempo é preciso um servidor/banco de dados (próximo passo sugerido).
- O previsto de cada etapa é distribuído de forma linear entre início e fim.

## Tecnologia

React + TypeScript + Vite, Recharts (gráficos), SheetJS (leitura de Excel), Vitest (testes).
