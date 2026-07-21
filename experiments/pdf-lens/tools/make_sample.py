"""Generate the demo PDF for the PDF-Lens prototype.

Each paragraph is written to exercise a different stat card type, plus one
purely narrative paragraph that carries no numbers — the lens should NOT mark
it as a hotspot, demonstrating that the tool never invents data.

Run:  python3 tools/make_sample.py
Out:  public/sample.pdf
"""
from pathlib import Path
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm
from reportlab.lib.enums import TA_LEFT
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer

OUT = Path(__file__).resolve().parent.parent / "public" / "sample.pdf"
OUT.parent.mkdir(parents=True, exist_ok=True)

styles = getSampleStyleSheet()
h = ParagraphStyle("h", parent=styles["Title"], fontSize=20, spaceAfter=6, alignment=TA_LEFT)
sub = ParagraphStyle("sub", parent=styles["Normal"], fontSize=10, textColor="#6B6580", spaceAfter=20)
body = ParagraphStyle("body", parent=styles["Normal"], fontSize=11.5, leading=17, spaceAfter=20)

paras = [
    Paragraph("The Weird State of Global Snacking", h),
    Paragraph("An annual report on how the world grazes · 2024 edition", sub),

    # KPI
    Paragraph(
        "In 2024 the average person ate roughly 27 kilograms of snacks, a striking "
        "34% increase compared with a decade earlier. Snacking now makes up nearly "
        "22% of total daily calories worldwide.", body),

    # Narrative — NO numbers, should not become a hotspot
    Paragraph(
        "The reasons behind this shift are cultural as much as economic. As lifestyles "
        "grew busier and traditional mealtimes quietly dissolved, people began to graze "
        "throughout the day, reaching for convenience over ceremony and comfort over custom.", body),

    # Ranking / table
    Paragraph(
        "By volume the category leaders were clear. Chips 4200, Chocolate 3850, "
        "Cookies 3100, Popcorn 2400, and Pretzels 1600 units sold per thousand people, "
        "with Chips extending its lead for the fifth straight year.", body),

    # Versus
    Paragraph(
        "Spending habits split sharply by drink. Coffee drinkers outspent tea drinkers "
        "by a wide margin — Coffee 780 versus Tea 410 dollars on snacks per year, the "
        "largest gap ever recorded between the two camps.", body),

    # Chart / series over time
    Paragraph(
        "Global snack revenue climbed relentlessly across the years: 2019 120, 2020 138, "
        "2021 155, 2022 171, 2023 190, and 2024 214 billion dollars, with no sign of the "
        "curve flattening.", body),

    # Map
    Paragraph(
        "Appetites varied by country on the global snacking index. USA 92, China 78, "
        "Germany 71, India 65, and Brazil 58 points, revealing a surprisingly wide spread "
        "across major markets.", body),
]

doc = SimpleDocTemplate(
    str(OUT), pagesize=A4,
    leftMargin=22 * mm, rightMargin=22 * mm, topMargin=20 * mm, bottomMargin=20 * mm,
    title="The Weird State of Global Snacking",
)
doc.build(paras)
print("wrote", OUT)
