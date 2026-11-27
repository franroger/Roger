# Gera modelos/RDO-modelo.xlsx. Uso: python3 scripts/gerar_rdo.py modelos/RDO-modelo.xlsx
import sys
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.worksheet.datavalidation import DataValidation
from openpyxl.comments import Comment

saida = sys.argv[1]
AZUL = "1F5F8B"
F = "Arial"
fonte = Font(name=F, size=10)
negrito = Font(name=F, size=10, bold=True)
titulo = Font(name=F, size=14, bold=True, color=AZUL)
sub = Font(name=F, size=9, italic=True, color="5F6B7A")
cab_font = Font(name=F, size=10, bold=True, color="FFFFFF")
cab_fill = PatternFill("solid", fgColor=AZUL)
preencher = PatternFill("solid", fgColor="FFF2CC")   # células para preencher
automatico = PatternFill("solid", fgColor="EEF1F4")  # calculado, não editar
fino = Side(style="thin", color="CDD5DE")
borda = Border(left=fino, right=fino, top=fino, bottom=fino)
centro = Alignment(horizontal="center", vertical="center", wrap_text=True)
quebra = Alignment(vertical="top", wrap_text=True)

N = 300          # linhas de lançamento
L0 = 5           # primeira linha de dados (cabeçalho na 4)
ETAPAS_MAX = 100
LOCAIS_MAX = 40

wb = Workbook()

# ---------------------------------------------------------------- Instruções
ins = wb.active
ins.title = "Instruções"
ins.sheet_view.showGridLines = False
ins["A1"] = "RDO – Relatório Diário de Obra"; ins["A1"].font = titulo
ins["A2"] = "Modelo compatível com o aplicativo Gestão de Obras (aba Diário de obra → Importar RDO / diário)."; ins["A2"].font = sub
passos = [
    ("1. Cadastro (uma vez por obra)", "Na aba Cadastro, escreva o nome da obra e copie do aplicativo os CÓDIGOS das etapas da planilha orçamentária e os NOMES dos locais (fachadas, cobertura...) exatamente como estão lá. Esses dados viram as listas de escolha das outras abas."),
    ("2. Dias (uma linha por dia)", "Data, responsável, clima de manhã e de tarde, condição do dia (Praticável / Parcialmente praticável / Impraticável), efetivo próprio e terceirizado, horas paradas, motivo e ocorrências (visitas, materiais recebidos, acidentes, pedidos do cliente)."),
    ("3. Produção (uma linha por serviço feito no dia)", "Data, etapa (código), local e O QUE FICOU PRONTO: em fachada, a prumada do balancim e a faixa de pavimentos (ex.: prumada 3, do 12º ao 8º); fora de fachada (cobertura, reservatório), a quantidade na unidade da etapa (m², m...). Não é preciso calcular percentual: o aplicativo faz a conta."),
    ("4. Importar", "No aplicativo, abra a obra → aba Diário de obra → Importar RDO / diário e escolha este arquivo. Pode importar o mesmo arquivo várias vezes ao longo da semana: panos já registrados não são contados duas vezes e cada dia é atualizado pela data."),
    ("Cores", "Amarelo = preencher. Cinza = preenchido automaticamente (não editar)."),
]
r = 4
for t, txt in passos:
    ins.cell(r, 1, t).font = negrito
    r += 1
    c = ins.cell(r, 1, txt); c.font = fonte; c.alignment = quebra
    ins.merge_cells(start_row=r, start_column=1, end_row=r, end_column=9)
    ins.row_dimensions[r].height = 44
    r += 1
r += 1
ins.cell(r, 1, "Exemplo de preenchimento da aba Produção (apenas ilustração; esta aba não é importada)").font = negrito
r += 1
ex_cab = ["Data", "Etapa (código)", "Local", "Prumada", "Pavimento inicial", "Pavimento final", "Quantidade", "Equipe", "Observação"]
ex = [
    ["02/12/2026", "2.1", "Fachada frente", "3", 12, 8, "", "Equipe João", "Lavagem concluída na prumada 3"],
    ["02/12/2026", "4.2", "Lateral esquerda", "1-2", 15, 13, "", "Equipe Marcos", "Textura aplicada nas prumadas 1 e 2"],
    ["02/12/2026", "3.1", "Cobertura", "", "", "", 85, "ImperTec", "85 m² de manta aplicada"],
]
for j, h in enumerate(ex_cab, 1):
    c = ins.cell(r, j, h); c.font = cab_font; c.fill = cab_fill; c.alignment = centro; c.border = borda
for linha in ex:
    r += 1
    for j, v in enumerate(linha, 1):
        c = ins.cell(r, j, v); c.font = fonte; c.border = borda
r += 2
c = ins.cell(r, 1, "Dica: em fachada, 'Prumada' aceita uma prumada (3), várias (2,5) ou uma faixa (1-4). Os pavimentos podem ser informados de cima para baixo (12 a 8) ou de baixo para cima."); c.font = sub; c.alignment = quebra
ins.merge_cells(start_row=r, start_column=1, end_row=r, end_column=9); ins.row_dimensions[r].height = 28
for col, w in zip("ABCDEFGHI", [12, 13, 18, 10, 13, 13, 12, 16, 38]):
    ins.column_dimensions[col].width = w
ins.page_setup.orientation = "landscape"
ins.page_setup.fitToWidth = 1
ins.page_setup.fitToHeight = 0
ins.sheet_properties.pageSetUpPr.fitToPage = True

# ---------------------------------------------------------------- Cadastro
cad = wb.create_sheet("Cadastro")
cad.sheet_view.showGridLines = False
cad["A1"] = "Cadastro da obra"; cad["A1"].font = titulo
cad["A2"] = "Preencha uma vez por obra, com os mesmos códigos e nomes do aplicativo. Os dados abaixo são um EXEMPLO — substitua pelos da sua obra."; cad["A2"].font = sub
cad["A3"] = "Obra:"; cad["A3"].font = negrito
cad["B3"] = "Cond. Edifício Atlântico – fachada e impermeabilização"; cad["B3"].font = fonte; cad["B3"].fill = preencher
cad.merge_cells("B3:D3")
for j, h in enumerate(["Código", "Etapa (descrição)", "Unidade"], 1):
    c = cad.cell(5, j, h); c.font = cab_font; c.fill = cab_fill; c.alignment = centro; c.border = borda
for j, h in enumerate(["Local", "Pavimentos", "Prumadas"], 6):
    c = cad.cell(5, j, h); c.font = cab_font; c.fill = cab_fill; c.alignment = centro; c.border = borda
etapas = [
    ("1.1", "Mobilização, canteiro e proteções", "vb"),
    ("1.2", "Locação e montagem de balancins/andaimes", "mês"),
    ("2.1", "Lavagem e remoção de revestimento solto", "m²"),
    ("2.2", "Tratamento de trincas e recuperação estrutural", "m"),
    ("3.1", "Impermeabilização da cobertura (manta asfáltica)", "m²"),
    ("3.2", "Impermeabilização de reservatórios", "m²"),
    ("4.1", "Reassentamento de pastilhas/cerâmica", "m²"),
    ("4.2", "Pintura de fachada (textura + acrílica)", "m²"),
    ("5.1", "Limpeza final e desmobilização", "vb"),
]
locais = [("Fachada frente", 10, 6), ("Fachada fundos", 10, 6), ("Lateral esquerda", 10, 4), ("Lateral direita", 10, 4), ("Cobertura", 1, 1), ("Reservatórios", 1, 1)]
for i in range(ETAPAS_MAX):
    rr = 6 + i
    for j in range(1, 4):
        c = cad.cell(rr, j); c.fill = preencher; c.border = borda; c.font = fonte
    cad.cell(rr, 1).number_format = "@"
    if i < len(etapas):
        for j, v in enumerate(etapas[i], 1):
            cad.cell(rr, j, v)
for i in range(LOCAIS_MAX):
    rr = 6 + i
    for j in range(6, 9):
        c = cad.cell(rr, j); c.fill = preencher; c.border = borda; c.font = fonte
    if i < len(locais):
        for j, v in enumerate(locais[i], 6):
            cad.cell(rr, j, v)
cad.cell(5, 1).comment = Comment("Código da etapa igual ao da planilha orçamentária no aplicativo (ex.: 2.1). Formato texto, para 1.10 não virar 1.1.", "RDO")
cad.cell(5, 7).comment = Comment("Pavimentos e prumadas só servem de consulta aqui; no aplicativo eles ficam no cadastro de Locais.", "RDO")
for col, w in zip("ABCDEFGH", [10, 48, 10, 3, 3, 22, 12, 12]):
    cad.column_dimensions[col].width = w
cad.freeze_panes = "A6"

lista_etapas = f"=Cadastro!$A$6:$A${5 + ETAPAS_MAX}"
lista_locais = f"=Cadastro!$F$6:$F${5 + LOCAIS_MAX}"

def cabecalho(ws, titulo_txt, nota, colunas, larguras):
    ws.sheet_view.showGridLines = False
    ws["A1"] = titulo_txt; ws["A1"].font = titulo
    ws["A2"] = nota; ws["A2"].font = sub
    for j, (h, w) in enumerate(zip(colunas, larguras), 1):
        c = ws.cell(4, j, h); c.font = cab_font; c.fill = cab_fill; c.alignment = centro; c.border = borda
        ws.column_dimensions[c.column_letter].width = w
    ws.row_dimensions[4].height = 30
    ws.freeze_panes = "B5"
    ws.page_setup.orientation = "landscape"
    ws.page_setup.fitToWidth = 1
    ws.page_setup.fitToHeight = 0
    ws.sheet_properties.pageSetUpPr.fitToPage = True
    ws.print_title_rows = "4:4"

# ---------------------------------------------------------------- Dias
dias = wb.create_sheet("Dias", 1)
col_d = ["Data", "Responsável", "Clima manhã", "Clima tarde", "Condição", "Efetivo próprio", "Efetivo terceirizado", "Horas paradas", "Motivo da paralisação", "Ocorrências"]
cabecalho(dias, "RDO – Condições do dia", "Uma linha por dia trabalhado (ou parado). Base para justificar prorrogação de prazo e medir produtividade.",
          col_d, [12, 20, 14, 14, 22, 11, 13, 11, 24, 60])
for rr in range(L0, L0 + N):
    for j in range(1, len(col_d) + 1):
        c = dias.cell(rr, j); c.fill = preencher; c.border = borda; c.font = fonte
    dias.cell(rr, 1).number_format = "DD/MM/YYYY"
    dias.cell(rr, 10).alignment = quebra
dv = DataValidation(type="date", operator="greaterThan", formula1="36526", allow_blank=True,
                    error="Informe uma data (dd/mm/aaaa).", errorTitle="Data inválida")
dv.add(f"A{L0}:A{L0+N-1}"); dias.add_data_validation(dv)
clima = DataValidation(type="list", formula1='"Bom,Nublado,Chuva fraca,Chuva forte"', allow_blank=True)
clima.add(f"C{L0}:D{L0+N-1}"); dias.add_data_validation(clima)
cond = DataValidation(type="list", formula1='"Praticável,Parcialmente praticável,Impraticável"', allow_blank=True,
                      error="Escolha Praticável, Parcialmente praticável ou Impraticável.")
cond.add(f"E{L0}:E{L0+N-1}"); dias.add_data_validation(cond)
mot = DataValidation(type="list", formula1='"Chuva,Falta de material,Falta de equipe,Liberação do cliente,Equipamento,Outros"', allow_blank=True, showErrorMessage=False)
mot.add(f"I{L0}:I{L0+N-1}"); dias.add_data_validation(mot)
num = DataValidation(type="decimal", operator="between", formula1="0", formula2="500", allow_blank=True, error="Informe um número.")
num.add(f"F{L0}:H{L0+N-1}"); dias.add_data_validation(num)

# ---------------------------------------------------------------- Produção
prod = wb.create_sheet("Produção", 1)
col_p = ["Data", "Etapa (código)", "Descrição da etapa", "Unidade", "Local", "Prumada", "Pavimento inicial", "Pavimento final", "Quantidade", "Equipe", "Observação"]
cabecalho(prod, "RDO – Produção do dia",
          "Uma linha por serviço. Em fachada informe Prumada + Pavimentos; fora de fachada informe a Quantidade (na unidade da etapa).",
          col_p, [12, 11, 40, 9, 20, 10, 11, 11, 12, 20, 45])
for rr in range(L0, L0 + N):
    for j in range(1, len(col_p) + 1):
        c = prod.cell(rr, j); c.border = borda; c.font = fonte
        c.fill = automatico if j in (3, 4) else preencher
    prod.cell(rr, 1).number_format = "DD/MM/YYYY"
    prod.cell(rr, 2).number_format = "@"
    prod.cell(rr, 6).number_format = "@"
    prod.cell(rr, 9).number_format = "#,##0.00"
    prod.cell(rr, 3).value = f'=IF(B{rr}="","",IFERROR(INDEX(Cadastro!$B$6:$B${5+ETAPAS_MAX},MATCH(B{rr},Cadastro!$A$6:$A${5+ETAPAS_MAX},0)),"código não cadastrado"))'
    prod.cell(rr, 4).value = f'=IF(B{rr}="","",IFERROR(INDEX(Cadastro!$C$6:$C${5+ETAPAS_MAX},MATCH(B{rr},Cadastro!$A$6:$A${5+ETAPAS_MAX},0)),""))'
    prod.cell(rr, 11).alignment = quebra
dvp = DataValidation(type="date", operator="greaterThan", formula1="36526", allow_blank=True, error="Informe uma data (dd/mm/aaaa).")
dvp.add(f"A{L0}:A{L0+N-1}"); prod.add_data_validation(dvp)
et = DataValidation(type="list", formula1=lista_etapas, allow_blank=True, error="Use um código cadastrado na aba Cadastro.", errorTitle="Etapa")
et.add(f"B{L0}:B{L0+N-1}"); prod.add_data_validation(et)
lo = DataValidation(type="list", formula1=lista_locais, allow_blank=True, error="Use um local cadastrado na aba Cadastro.", errorTitle="Local")
lo.add(f"E{L0}:E{L0+N-1}"); prod.add_data_validation(lo)
pav = DataValidation(type="whole", operator="between", formula1="1", formula2="200", allow_blank=True, error="Informe o número do pavimento.")
pav.add(f"G{L0}:H{L0+N-1}"); prod.add_data_validation(pav)
qt = DataValidation(type="decimal", operator="greaterThanOrEqual", formula1="0", allow_blank=True, error="Informe a quantidade (número).")
qt.add(f"I{L0}:I{L0+N-1}"); prod.add_data_validation(qt)
prod.cell(4, 6).comment = Comment("Número da prumada (descida do balancim): 3, ou 2,5 para várias, ou 1-4 para uma faixa.", "RDO")
prod.cell(4, 9).comment = Comment("Use só quando NÃO houver prumada/pavimento (cobertura, reservatório, serviço medido em m ou m²).", "RDO")

wb.active = 0
wb.save(saida)
print("ok", saida)
