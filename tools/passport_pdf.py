# -*- coding: utf-8 -*-
"""Паспорт проекта -> PDF (ReportLab, Arial с кириллицей)."""
import re
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib import colors
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (SimpleDocTemplate, Paragraph, Spacer, Table,
                                TableStyle, Preformatted, HRFlowable)
from reportlab.lib.styles import ParagraphStyle

FD = "/System/Library/Fonts/Supplemental/"
pdfmetrics.registerFont(TTFont("Arial", FD + "Arial.ttf"))
pdfmetrics.registerFont(TTFont("Arial-Bold", FD + "Arial Bold.ttf"))
pdfmetrics.registerFont(TTFont("Arial-Italic", FD + "Arial Italic.ttf"))
pdfmetrics.registerFont(TTFont("Courier", FD + "Courier New.ttf"))
pdfmetrics.registerFontFamily("Arial", normal="Arial", bold="Arial-Bold", italic="Arial-Italic", boldItalic="Arial-Bold")

INK = colors.HexColor("#182a44"); ACC = colors.HexColor("#0f9a8e"); MUT = colors.HexColor("#5d6f88")
LINE = colors.HexColor("#d4dfec"); BGHEAD = colors.HexColor("#eef4fa"); BGCODE = colors.HexColor("#f4f7fb")

def st(name, **kw):
    base = dict(fontName="Arial", fontSize=9.5, leading=13.5, textColor=INK, spaceAfter=4)
    base.update(kw); return ParagraphStyle(name, **base)

S = {
 "h1": st("h1", fontName="Arial-Bold", fontSize=17, leading=21, spaceAfter=2, textColor=INK),
 "sub": st("sub", fontSize=9, textColor=MUT, spaceAfter=8),
 "h2": st("h2", fontName="Arial-Bold", fontSize=12.5, leading=16, spaceBefore=10, spaceAfter=4, textColor=ACC),
 "p": st("p"),
 "li": st("li", leftIndent=10, bulletIndent=2),
 "code": st("code", fontName="Courier", fontSize=8, leading=10.5, backColor=BGCODE, borderPadding=6, spaceAfter=6),
}

def inline(t):
    t = t.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
    t = re.sub(r"\*\*(.+?)\*\*", r"<b>\1</b>", t)
    t = re.sub(r"`([^`]+)`", r'<font face="Courier" size="8.5">\1</font>', t)
    return t

src = open("/Users/alekseykhokhlov/Documents/Kimi/Workspaces/погода/ПАСПОРТ-ПРОЕКТА.md", encoding="utf-8").read()
out = "/Users/alekseykhokhlov/Documents/Kimi/Workspaces/погода/ПАСПОРТ-ПРОЕКТА.pdf"
doc = SimpleDocTemplate(out, pagesize=A4, leftMargin=16*mm, rightMargin=16*mm, topMargin=14*mm, bottomMargin=14*mm,
                        title="Паспорт проекта — Погода в горах, на море и дома", author="kp-weather")

flow, lines = [], src.split("\n")
i = 0
while i < len(lines):
    ln = lines[i]
    if not ln.strip() or ln.strip() == "---":
        if ln.strip() == "---": flow.append(HRFlowable(width="100%", thickness=.6, color=LINE, spaceBefore=4, spaceAfter=6))
        i += 1; continue
    if ln.startswith("# "):
        flow.append(Paragraph(inline(ln[2:]), S["h1"])); i += 1; continue
    if ln.startswith("## "):
        flow.append(Paragraph(inline(ln[3:]), S["h2"])); i += 1; continue
    if ln.startswith("Версия 1.0"):
        flow.append(Paragraph(inline(ln), S["sub"])); i += 1; continue
    if ln.startswith("```"):
        buf, i = [], i + 1
        while i < len(lines) and not lines[i].startswith("```"):
            buf.append(lines[i]); i += 1
        i += 1
        flow.append(Preformatted("\n".join(buf), S["code"])); continue
    if ln.startswith("|"):
        rows = []
        while i < len(lines) and lines[i].startswith("|"):
            cells = [c.strip() for c in lines[i].strip().strip("|").split("|")]
            if not all(set(c) <= set(":- ") for c in cells):
                rows.append([Paragraph(inline(c), st("tc", fontSize=8.3, leading=11)) for c in cells])
            i += 1
        if rows:
            ncol = len(rows[0]); pagew = A4[0] - 32*mm
            widths = [pagew*0.26, pagew*0.37, pagew*0.37] if ncol == 3 else [pagew/ncol]*ncol
            t = Table(rows, colWidths=widths, repeatRows=1)
            t.setStyle(TableStyle([
                ("BACKGROUND", (0,0), (-1,0), BGHEAD),
                ("GRID", (0,0), (-1,-1), .5, LINE),
                ("VALIGN", (0,0), (-1,-1), "TOP"),
                ("TOPPADDING", (0,0), (-1,-1), 3.5), ("BOTTOMPADDING", (0,0), (-1,-1), 3.5),
                ("LEFTPADDING", (0,0), (-1,-1), 5), ("RIGHTPADDING", (0,0), (-1,-1), 5),
            ]))
            flow.append(Spacer(1, 2)); flow.append(t); flow.append(Spacer(1, 5))
        continue
    m = re.match(r"^(\d+)\.\s+(.*)", ln)
    if ln.startswith("- ") or m:
        txt = ln[2:] if ln.startswith("- ") else m.group(2)
        bullet = "•" if ln.startswith("- ") else (m.group(1) + ".")
        flow.append(Paragraph(f"{bullet}&nbsp;&nbsp;{inline(txt)}", S["li"])); i += 1; continue
    if ln.startswith("*") and ln.endswith("*") and len(ln) > 2:
        flow.append(Paragraph(inline(ln.strip("*")), S["sub"])); i += 1; continue
    flow.append(Paragraph(inline(ln), S["p"])); i += 1

doc.build(flow)
print("OK", out)
