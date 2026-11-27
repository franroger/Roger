# Gera os modelos de RDO (Relatório Diário de Obra) compatíveis com o aplicativo.
# Uso: python3 scripts/gerar_rdo.py modelos/
#   -> modelos/RDO-fachada.xlsx  (recuperação de fachada: prumada × pavimento)
#   -> modelos/RDO-geral.xlsx    (impermeabilização, reformas e demais serviços)
import sys
from pathlib import Path
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.worksheet.datavalidation import DataValidation
from openpyxl.comments import Comment

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

N = 300           # linhas de lançamento
L0 = 5            # primeira linha de dados (cabeçalho na 4)
ETAPAS_MAX = 100
FASES_MAX = 150
LOCAIS_MAX = 40

# ------------------------------------------------------------------ exemplos
EXEMPLOS = {
    "fachada": {
        "obra": "Cond. Edifício Atlântico – fachada e impermeabilização",
        "etapas": [
            ("1.1", "Mobilização, canteiro e proteções", "vb"),
            ("1.2", "Locação e montagem de balancins/andaimes", "mês"),
            ("2.1", "Lavagem e remoção de revestimento solto", "m²"),
            ("2.2", "Tratamento de trincas e recuperação estrutural", "m"),
            ("3.1", "Impermeabilização da cobertura (manta asfáltica)", "m²"),
            ("3.2", "Impermeabilização de reservatórios", "m²"),
            ("4.1", "Reassentamento de pastilhas/cerâmica", "m²"),
            ("4.2", "Pintura de fachada (textura + acrílica)", "m²"),
            ("5.1", "Limpeza final e desmobilização", "vb"),
        ],
        "fases": [
            ("4.2", "Preparo / lixamento", 25),
            ("4.2", "Selador / massa", 25),
            ("4.2", "Acabamento (demãos)", 50),
        ],
        "locais": [
            ("Fachada frente", "Fachada", 10, 6),
            ("Fachada fundos", "Fachada", 10, 6),
            ("Lateral esquerda", "Fachada", 10, 4),
            ("Lateral direita", "Fachada", 10, 4),
            ("Cobertura", "Área / ambiente", None, None),
            ("Reservatórios", "Área / ambiente", None, None),
        ],
        "exemplo_producao": [
            ["02/12/2026", "2.1", "Fachada frente", "", "3", 12, 8, "", "Equipe João", "Lavagem concluída na prumada 3"],
            ["02/12/2026", "4.2", "Lateral esquerda", "Selador / massa", "1-2", 10, 7, "", "Equipe Marcos", "Selador nas prumadas 1 e 2"],
            ["02/12/2026", "3.1", "Cobertura", "", "", "", "", 85, "ImperTec", "85 m² de manta aplicada"],
        ],
    },
    "geral": {
        "obra": "Ed. Mirante – impermeabilização de subsolo e reforma da guarita",
        "etapas": [
            ("1", "Mobilização e preparo da superfície", "m²"),
            ("2", "Impermeabilização com manta asfáltica (lajes)", "m²"),
            ("3", "Cristalização de cortinas e poço de elevador", "m²"),
            ("4", "Proteção mecânica e regularização", "m²"),
            ("5", "Reforma da guarita", "vb"),
        ],
        "fases": [
            ("2", "Regularização / preparo", 20),
            ("2", "Primer", 10),
            ("2", "Manta", 60),
            ("2", "Teste de estanqueidade", 10),
            ("3", "Limpeza e apicoamento", 25),
            ("3", "Tratamento de fissuras", 20),
            ("3", "Aplicação (demãos)", 45),
            ("3", "Cura e teste", 10),
            ("5", "Demolição", 10),
            ("5", "Alvenaria / estrutura", 25),
            ("5", "Instalações elétricas e hidráulicas", 20),
            ("5", "Revestimentos e piso", 25),
            ("5", "Pintura e acabamentos", 20),
        ],
        "locais": [
            ("Laje garagem G1", "Área / ambiente", None, None),
            ("Laje garagem G2", "Área / ambiente", None, None),
            ("Rampa de acesso", "Área / ambiente", None, None),
            ("Cortinas de contenção", "Área / ambiente", None, None),
            ("Poço do elevador", "Área / ambiente", None, None),
            ("Guarita", "Área / ambiente", None, None),
        ],
        "exemplo_producao": [
            ["02/12/2026", "2", "Laje garagem G1", "Manta", "120", "", "ImperTec", "Manta aplicada na faixa norte"],
            ["02/12/2026", "2", "Laje garagem G1", "Teste de estanqueidade", "", "100", "ImperTec", "Teste de 72 h concluído sem vazamento"],
            ["02/12/2026", "5", "Guarita", "Alvenaria / estrutura", "", "60", "Equipe Paulo", "Paredes levantadas, falta verga"],
            ["02/12/2026", "3", "Poço do elevador", "Aplicação (demãos)", "", "30", "Equipe própria", "1ª demão"],
        ],
    },
}


def cabecalho(ws, titulo_txt, nota, colunas, larguras):
    ws.sheet_view.showGridLines = False
    ws["A1"] = titulo_txt
    ws["A1"].font = titulo
    ws["A2"] = nota
    ws["A2"].font = sub
    for j, (h, w) in enumerate(zip(colunas, larguras), 1):
        c = ws.cell(4, j, h)
        c.font = cab_font
        c.fill = cab_fill
        c.alignment = centro
        c.border = borda
        ws.column_dimensions[c.column_letter].width = w
    ws.row_dimensions[4].height = 42
    ws.freeze_panes = "B5"
    ws.page_setup.orientation = "landscape"
    ws.page_setup.fitToWidth = 1
    ws.page_setup.fitToHeight = 0
    ws.sheet_properties.pageSetUpPr.fitToPage = True
    ws.print_title_rows = "4:4"


def celula(ws, r, c, v=None, fill=preencher, fmt=None):
    cell = ws.cell(r, c)
    if v is not None:
        cell.value = v
    cell.font = fonte
    cell.border = borda
    cell.fill = fill
    if fmt:
        cell.number_format = fmt
    return cell


def gerar(tipo: str, saida: Path):
    ex = EXEMPLOS[tipo]
    fachada = tipo == "fachada"
    wb = Workbook()

    # ------------------------------------------------------------ Instruções
    ins = wb.active
    ins.title = "Instruções"
    ins.sheet_view.showGridLines = False
    ins["A1"] = "RDO – Relatório Diário de Obra · " + ("Fachada" if fachada else "Impermeabilização, reformas e serviços gerais")
    ins["A1"].font = titulo
    ins["A2"] = "Modelo compatível com o aplicativo Gestão de Obras (obra → aba Diário de obra → Importar RDO / diário)."
    ins["A2"].font = sub
    como_medir = (
        "Em FACHADA informe a prumada do balancim e a faixa de pavimentos (ex.: prumada 3, do 12º ao 8º). "
        "Fora da fachada (cobertura, reservatório) informe a quantidade feita no dia, na unidade da etapa."
        if fachada
        else "Informe UMA das duas: a QUANTIDADE feita no dia (m², m, un — na unidade da etapa) quando dá para medir, "
        "ou o % CONCLUÍDO ACUMULADO do serviço naquele local quando não dá (ex.: alvenaria da guarita 60%). "
        "O % é sempre o total até hoje, não o do dia."
    )
    passos = [
        ("1. Cadastro (uma vez por obra)",
         "Na aba Cadastro, copie do aplicativo os CÓDIGOS das etapas, as FASES de cada etapa (se houver) e os NOMES dos locais, exatamente como estão lá. "
         "Eles viram as listas de escolha das outras abas."),
        ("2. Dias (uma linha por dia)",
         "Data, responsável, clima de manhã e de tarde, condição do dia (Praticável / Parcialmente praticável / Impraticável), efetivo próprio e "
         "terceirizado, horas paradas, motivo e ocorrências (visitas, materiais recebidos, testes, pedidos do cliente)."),
        ("3. Produção (uma linha por serviço feito no dia)",
         "Data, etapa (código), local e — se a etapa tiver fases — a fase. " + como_medir + " Não é preciso calcular o percentual da etapa: o aplicativo faz a conta."),
        ("4. Importar",
         "No aplicativo: obra → Diário de obra → Importar RDO / diário. Pode importar o mesmo arquivo várias vezes ao longo da semana: "
         "cada dia é atualizado pela data" + (" e panos já registrados não são contados de novo." if fachada else ".")),
        ("Cores", "Amarelo = preencher. Cinza = preenchido automaticamente (não editar)."),
    ]
    r = 4
    for t, txt in passos:
        ins.cell(r, 1, t).font = negrito
        r += 1
        c = ins.cell(r, 1, txt)
        c.font = fonte
        c.alignment = quebra
        ins.merge_cells(start_row=r, start_column=1, end_row=r, end_column=10)
        ins.row_dimensions[r].height = 44
        r += 1
    r += 1
    ins.cell(r, 1, "Exemplo de preenchimento da aba Produção (apenas ilustração; esta aba não é importada)").font = negrito
    r += 1
    if fachada:
        ex_cab = ["Data", "Etapa (código)", "Local", "Fase", "Prumada", "Pavimento inicial", "Pavimento final", "Quantidade", "Equipe", "Observação"]
    else:
        ex_cab = ["Data", "Etapa (código)", "Local / ambiente", "Fase", "Quantidade executada no dia", "% concluído (acumulado)", "Equipe", "Observação"]
    for j, h in enumerate(ex_cab, 1):
        c = ins.cell(r, j, h)
        c.font = cab_font
        c.fill = cab_fill
        c.alignment = centro
        c.border = borda
    ins.row_dimensions[r].height = 30
    for linha in ex["exemplo_producao"]:
        r += 1
        for j, v in enumerate(linha, 1):
            c = ins.cell(r, j, v)
            c.font = fonte
            c.border = borda
    larg = [12, 13, 20, 24, 12, 13, 13, 12, 16, 36] if fachada else [12, 13, 22, 28, 15, 15, 16, 40, 4, 4]
    for k, w in enumerate(larg):
        ins.column_dimensions[chr(65 + k)].width = w
    ins.page_setup.orientation = "landscape"
    ins.page_setup.fitToWidth = 1
    ins.page_setup.fitToHeight = 0
    ins.sheet_properties.pageSetUpPr.fitToPage = True

    # ------------------------------------------------------------ Produção
    prod = wb.create_sheet("Produção")
    if fachada:
        col_p = ["Data", "Etapa (código)", "Descrição da etapa", "Unidade", "Local", "Fase", "Prumada", "Pavimento inicial", "Pavimento final",
                 "Quantidade", "Equipe", "Observação"]
        larg_p = [12, 11, 36, 9, 18, 20, 10, 11, 11, 12, 18, 40]
        nota = "Uma linha por serviço. Em fachada: Prumada + Pavimentos. Fora de fachada: Quantidade (na unidade da etapa). Fase só se a etapa tiver fases."
    else:
        col_p = ["Data", "Etapa (código)", "Descrição da etapa", "Unidade", "Local / ambiente", "Fase", "Quantidade executada no dia",
                 "% concluído (acumulado)", "Equipe", "Observação"]
        larg_p = [12, 11, 36, 9, 22, 26, 14, 13, 18, 45]
        nota = "Uma linha por serviço. Informe a Quantidade feita no dia OU o % concluído acumulado. Fase só se a etapa tiver fases."
    cabecalho(prod, "RDO – Produção do dia", nota, col_p, larg_p)
    ult_et = 5 + ETAPAS_MAX
    for rr in range(L0, L0 + N):
        for j in range(1, len(col_p) + 1):
            celula(prod, rr, j, fill=automatico if j in (3, 4) else preencher)
        prod.cell(rr, 1).number_format = "DD/MM/YYYY"
        prod.cell(rr, 2).number_format = "@"
        prod.cell(rr, 3).value = (f'=IF(B{rr}="","",IFERROR(INDEX(Cadastro!$B$6:$B${ult_et},MATCH(B{rr},Cadastro!$A$6:$A${ult_et},0)),'
                                  f'"código não cadastrado"))')
        prod.cell(rr, 4).value = f'=IF(B{rr}="","",IFERROR(INDEX(Cadastro!$C$6:$C${ult_et},MATCH(B{rr},Cadastro!$A$6:$A${ult_et},0)),""))'
        prod.cell(rr, len(col_p)).alignment = quebra
        if fachada:
            prod.cell(rr, 7).number_format = "@"
            prod.cell(rr, 10).number_format = "#,##0.00"
        else:
            prod.cell(rr, 7).number_format = "#,##0.00"
            prod.cell(rr, 8).number_format = "0"
    v = DataValidation(type="date", operator="greaterThan", formula1="36526", allow_blank=True, error="Informe uma data (dd/mm/aaaa).")
    v.add(f"A{L0}:A{L0+N-1}")
    prod.add_data_validation(v)
    v = DataValidation(type="list", formula1=f"=Cadastro!$A$6:$A${ult_et}", allow_blank=True, error="Use um código cadastrado na aba Cadastro.", errorTitle="Etapa")
    v.add(f"B{L0}:B{L0+N-1}")
    prod.add_data_validation(v)
    v = DataValidation(type="list", formula1=f"=Cadastro!$K$6:$K${5+LOCAIS_MAX}", allow_blank=True, error="Use um local cadastrado na aba Cadastro.", errorTitle="Local")
    v.add(f"E{L0}:E{L0+N-1}")
    prod.add_data_validation(v)
    v = DataValidation(type="list", formula1=f"=Cadastro!$G$6:$G${5+FASES_MAX}", allow_blank=True, error="Use uma fase cadastrada na aba Cadastro.", errorTitle="Fase")
    v.add(f"F{L0}:F{L0+N-1}")
    prod.add_data_validation(v)
    prod.cell(4, 6).comment = Comment("Só para etapas com fases (ver aba Cadastro). Deixe vazio se a etapa for um serviço único.", "RDO")
    if fachada:
        v = DataValidation(type="whole", operator="between", formula1="1", formula2="200", allow_blank=True, error="Informe o número do pavimento.")
        v.add(f"H{L0}:I{L0+N-1}")
        prod.add_data_validation(v)
        v = DataValidation(type="decimal", operator="greaterThanOrEqual", formula1="0", allow_blank=True, error="Informe a quantidade (número).")
        v.add(f"J{L0}:J{L0+N-1}")
        prod.add_data_validation(v)
        prod.cell(4, 7).comment = Comment("Número da prumada (descida do balancim): 3, ou 2,5 para várias, ou 1-4 para uma faixa.", "RDO")
        prod.cell(4, 10).comment = Comment("Use só quando NÃO houver prumada/pavimento (cobertura, reservatório, serviço medido em m ou m²).", "RDO")
    else:
        v = DataValidation(type="decimal", operator="greaterThanOrEqual", formula1="0", allow_blank=True, error="Informe a quantidade (número).")
        v.add(f"G{L0}:G{L0+N-1}")
        prod.add_data_validation(v)
        v = DataValidation(type="decimal", operator="between", formula1="0", formula2="100", allow_blank=True, error="Informe um percentual de 0 a 100.")
        v.add(f"H{L0}:H{L0+N-1}")
        prod.add_data_validation(v)
        prod.cell(4, 7).comment = Comment("Quanto foi feito HOJE, na unidade da etapa (coluna Unidade). Deixe vazio se usar o %.", "RDO")
        prod.cell(4, 8).comment = Comment("Quanto do serviço NAQUELE LOCAL (e fase) está pronto ATÉ HOJE, de 0 a 100. Use quando não dá para medir a quantidade.", "RDO")

    # ------------------------------------------------------------ Dias
    dias = wb.create_sheet("Dias")
    col_d = ["Data", "Responsável", "Clima manhã", "Clima tarde", "Condição", "Efetivo próprio", "Efetivo terceirizado", "Horas paradas",
             "Motivo da paralisação", "Ocorrências"]
    cabecalho(dias, "RDO – Condições do dia",
              "Uma linha por dia trabalhado (ou parado). Base para justificar prorrogação de prazo e medir produtividade.",
              col_d, [12, 20, 14, 14, 22, 11, 13, 11, 24, 60])
    for rr in range(L0, L0 + N):
        for j in range(1, len(col_d) + 1):
            celula(dias, rr, j)
        dias.cell(rr, 1).number_format = "DD/MM/YYYY"
        dias.cell(rr, 10).alignment = quebra
    for cfg, rng in [
        (dict(type="date", operator="greaterThan", formula1="36526", allow_blank=True, error="Informe uma data (dd/mm/aaaa)."), "A"),
        (dict(type="list", formula1='"Bom,Nublado,Chuva fraca,Chuva forte"', allow_blank=True), "C:D"),
        (dict(type="list", formula1='"Praticável,Parcialmente praticável,Impraticável"', allow_blank=True,
              error="Escolha Praticável, Parcialmente praticável ou Impraticável."), "E"),
        (dict(type="list", formula1='"Chuva,Falta de material,Falta de equipe,Liberação do cliente,Equipamento,Aguardando teste/cura,Outros"',
              allow_blank=True, showErrorMessage=False), "I"),
        (dict(type="decimal", operator="between", formula1="0", formula2="500", allow_blank=True, error="Informe um número."), "F:H"),
    ]:
        v = DataValidation(**cfg)
        a, b = (rng.split(":") + [rng])[:2]
        v.add(f"{a}{L0}:{b}{L0+N-1}")
        dias.add_data_validation(v)

    # ------------------------------------------------------------ Cadastro
    cad = wb.create_sheet("Cadastro")
    cad.sheet_view.showGridLines = False
    cad["A1"] = "Cadastro da obra"
    cad["A1"].font = titulo
    cad["A2"] = "Preencha uma vez por obra, com os mesmos códigos e nomes do aplicativo. Os dados abaixo são um EXEMPLO — substitua pelos da sua obra."
    cad["A2"].font = sub
    cad["A3"] = "Obra:"
    cad["A3"].font = negrito
    cad["B3"] = ex["obra"]
    cad["B3"].font = fonte
    cad["B3"].fill = preencher
    cad.merge_cells("B3:C3")
    blocos = [(1, ["Código", "Etapa (descrição)", "Unidade"]), (6, ["Etapa (código)", "Fase", "Peso (%)"]),
              (11, ["Local", "Tipo", "Pavimentos", "Prumadas"] if fachada else ["Local / ambiente", "Tipo"])]
    for c0, cols in blocos:
        for j, h in enumerate(cols):
            c = cad.cell(5, c0 + j, h)
            c.font = cab_font
            c.fill = cab_fill
            c.alignment = centro
            c.border = borda
    for i in range(ETAPAS_MAX):
        for j in range(1, 4):
            celula(cad, 6 + i, j)
        cad.cell(6 + i, 1).number_format = "@"
        if i < len(ex["etapas"]):
            for j, v in enumerate(ex["etapas"][i], 1):
                cad.cell(6 + i, j, v)
    for i in range(FASES_MAX):
        for j in range(6, 9):
            celula(cad, 6 + i, j)
        cad.cell(6 + i, 6).number_format = "@"
        if i < len(ex["fases"]):
            for j, v in enumerate(ex["fases"][i], 6):
                cad.cell(6 + i, j, v)
    ncol_loc = 4 if fachada else 2
    for i in range(LOCAIS_MAX):
        for j in range(11, 11 + ncol_loc):
            celula(cad, 6 + i, j)
        if i < len(ex["locais"]):
            for j, v in enumerate(ex["locais"][i][:ncol_loc], 11):
                if v is not None:
                    cad.cell(6 + i, j, v)
    v = DataValidation(type="list", formula1='"Fachada,Área / ambiente"', allow_blank=True)
    v.add(f"L6:L{5+LOCAIS_MAX}")
    cad.add_data_validation(v)
    v = DataValidation(type="list", formula1=f"=$A$6:$A${5+ETAPAS_MAX}", allow_blank=True, error="Use um código da tabela de etapas.")
    v.add(f"F6:F{5+FASES_MAX}")
    cad.add_data_validation(v)
    cad.cell(5, 1).comment = Comment("Código igual ao da planilha orçamentária no aplicativo (ex.: 2.1). Formato texto, para 1.10 não virar 1.1.", "RDO")
    cad.cell(5, 7).comment = Comment("Fases da etapa, iguais às cadastradas no aplicativo (aba Diário de obra → Fases). Os pesos de cada etapa devem somar 100.", "RDO")
    # Conferência: soma dos pesos por etapa
    cad.cell(4, 9, "Soma dos pesos da etapa").font = sub
    cad.cell(5, 9, "Soma da etapa").font = cab_font
    cad.cell(5, 9).fill = cab_fill
    cad.cell(5, 9).alignment = centro
    for i in range(FASES_MAX):
        rr = 6 + i
        c = celula(cad, rr, 9, fill=automatico, fmt="0")
        c.value = f'=IF(F{rr}="","",SUMIF($F$6:$F${5+FASES_MAX},F{rr},$H$6:$H${5+FASES_MAX}))'
    for col, w in zip("ABCDEFGHIJKLMN", [10, 44, 9, 2, 2, 12, 30, 9, 12, 2, 24, 16, 11, 11]):
        cad.column_dimensions[col].width = w
    cad.freeze_panes = "A6"

    wb.active = 0
    wb.save(saida)
    print("ok", saida)


if __name__ == "__main__":
    pasta = Path(sys.argv[1] if len(sys.argv) > 1 else "modelos")
    pasta.mkdir(parents=True, exist_ok=True)
    gerar("fachada", pasta / "RDO-fachada.xlsx")
    gerar("geral", pasta / "RDO-geral.xlsx")
