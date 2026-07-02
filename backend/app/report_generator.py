import os
import sys
import requests
import datetime
from decimal import Decimal

# Add current folder to path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.database import SessionLocal
from app.models import Sale, MaintenanceJob, Product, InventoryStatus

# PDF Generation Libraries
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle

# Arabic Reshaper and Bidi
import arabic_reshaper
from bidi.algorithm import get_display

FONT_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "Amiri-Regular.ttf")

try:
    if os.path.exists(FONT_PATH):
        pdfmetrics.registerFont(TTFont('Amiri', FONT_PATH))
    else:
        print("Downloading Amiri Arabic font...")
        FONT_URL = "https://github.com/google/fonts/raw/main/ofl/amiri/Amiri-Regular.ttf"
        r = requests.get(FONT_URL, timeout=15)
        with open(FONT_PATH, "wb") as f:
            f.write(r.content)
        pdfmetrics.registerFont(TTFont('Amiri', FONT_PATH))
except Exception as e:
    print(f"Error loading or downloading font: {e}")

def shape(text):
    if not text:
        return ""
    # Shape Arabic letters and reverse for RTL display in PDF
    reshaped = arabic_reshaper.reshape(str(text))
    return get_display(reshaped)

def get_today_stats():
    db = SessionLocal()
    try:
        today = datetime.datetime.now().date()
        start_dt = datetime.datetime.combine(today, datetime.time.min).astimezone()
        end_dt = datetime.datetime.combine(today, datetime.time.max).astimezone()
        
        sales = db.query(Sale).filter(Sale.sale_date >= start_dt, Sale.sale_date <= end_dt).all()
        maintenance = db.query(MaintenanceJob).filter(
            MaintenanceJob.updated_at >= start_dt, 
            MaintenanceJob.updated_at <= end_dt,
            MaintenanceJob.status == "Delivered" # Completed & delivered today
        ).all()
        
        products = db.query(Product).filter(Product.type != 'Maintenance').all()
        low_stock = []
        for p in products:
            avail_count = sum(1 for item in p.items if item.status == InventoryStatus.AVAILABLE)
            if avail_count <= 2:
                low_stock.append((p.brand, p.name, avail_count, p.type.name))
                
        return sales, maintenance, low_stock
    finally:
        db.close()

def generate_daily_report_pdf(pdf_path):
    sales, maintenance, low_stock = get_today_stats()
    
    # Calculate Summary Totals
    total_sales_amount = sum(Decimal(s.total_amount) for s in sales)
    total_cost_amount = Decimal("0.00")
    for s in sales:
        for item in s.items:
            # Get purchase price from associated product
            if item.product:
                total_cost_amount += Decimal(item.product.purchase_price)
                
    net_sales_profit = total_sales_amount - total_cost_amount
    
    # Maintenance Profits
    total_maintenance_revenue = sum(Decimal(m.cost) for m in maintenance)
    
    total_profit = net_sales_profit + total_maintenance_revenue
    
    # Start document
    doc = SimpleDocTemplate(pdf_path, pagesize=letter, rightMargin=30, leftMargin=30, topMargin=30, bottomMargin=30)
    story = []
    
    # Setup styles
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        'ArabicTitle',
        parent=styles['Normal'],
        fontName='Amiri',
        fontSize=20,
        leading=24,
        textColor=colors.HexColor('#0f172a'),
        alignment=1 # Centered
    )
    
    subtitle_style = ParagraphStyle(
        'ArabicSubtitle',
        parent=styles['Normal'],
        fontName='Amiri',
        fontSize=12,
        leading=16,
        textColor=colors.HexColor('#64748b'),
        alignment=1 # Centered
    )
    
    cell_style = ParagraphStyle(
        'ArabicCell',
        parent=styles['Normal'],
        fontName='Amiri',
        fontSize=10,
        leading=14,
        textColor=colors.HexColor('#334155'),
        alignment=2 # Right-aligned
    )
    
    cell_style_bold = ParagraphStyle(
        'ArabicCellBold',
        parent=cell_style,
        fontName='Amiri',
        fontSize=10,
        textColor=colors.HexColor('#0f172a')
    )
    
    # Title
    story.append(Paragraph(shape("التقرير اليومي لمتجر M MOBILE"), title_style))
    today_str = datetime.date.today().strftime('%d/%m/%Y')
    story.append(Paragraph(shape(f"تاريخ التقرير: {today_str}"), subtitle_style))
    story.append(Spacer(1, 15))
    
    # Financial Summary Section
    story.append(Paragraph(shape("💰 الملخص المالي اليومي:"), cell_style_bold))
    story.append(Spacer(1, 5))
    
    summary_data = [
        [Paragraph(shape("إجمالي مبيعات البضائع:"), cell_style_bold), Paragraph(shape(f"{total_sales_amount:,.2f} د.ع"), cell_style)],
        [Paragraph(shape("إجمالي تكلفة المبيعات:"), cell_style_bold), Paragraph(shape(f"{total_cost_amount:,.2f} د.ع"), cell_style)],
        [Paragraph(shape("أرباح مبيعات البضائع:"), cell_style_bold), Paragraph(shape(f"{net_sales_profit:,.2f} د.ع"), cell_style)],
        [Paragraph(shape("إيرادات قسم الصيانة:"), cell_style_bold), Paragraph(shape(f"{total_maintenance_revenue:,.2f} د.ع"), cell_style)],
        [Paragraph(shape("صافي الأرباح الكلي المنجز:"), cell_style_bold), Paragraph(shape(f"{total_profit:,.2f} د.ع"), cell_style)]
    ]
    
    summary_table = Table(summary_data, colWidths=[200, 300])
    summary_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor('#f8fafc')),
        ('ALIGN', (0,0), (-1,-1), 'RIGHT'),
        ('BOTTOMPADDING', (0,0), (-1,-1), 6),
        ('TOPPADDING', (0,0), (-1,-1), 6),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#e2e8f0')),
    ]))
    story.append(summary_table)
    story.append(Spacer(1, 20))
    
    # Sales details section
    story.append(Paragraph(shape("📋 تفاصيل فواتير المبيعات اليوم:"), cell_style_bold))
    story.append(Spacer(1, 5))
    
    sales_headers = [shape("رقم الفاتورة"), shape("الزبون"), shape("المبيعات"), shape("طريقة الدفع"), shape("المبلغ")]
    sales_rows = [sales_headers]
    for s in sales:
        items_desc = ", ".join([f"{item.product.brand} {item.product.name}" for item in s.items if item.product])
        sales_rows.append([
            shape(f"INV-{str(s.id)[:8]}"),
            shape(s.customer_name or "زبون نقدي"),
            shape(items_desc),
            shape("نقداً" if s.payment_method.value == 'Cash' else "آجل"),
            shape(f"{s.total_amount:,.0f} د.ع")
        ])
        
    if len(sales) == 0:
        sales_rows.append([shape("لا توجد مبيعات مسجلة اليوم"), "", "", "", ""])
        
    sales_table = Table(sales_rows, colWidths=[90, 80, 190, 60, 80])
    sales_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#0f172a')),
        ('TEXTCOLOR', (0,0), (-1,0), colors.whitesmoke),
        ('ALIGN', (0,0), (-1,-1), 'RIGHT'),
        ('BOTTOMPADDING', (0,0), (-1,-1), 6),
        ('TOPPADDING', (0,0), (-1,-1), 6),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#cbd5e1')),
    ]))
    story.append(sales_table)
    story.append(Spacer(1, 20))
    
    # Maintenance jobs completed
    story.append(Paragraph(shape("🔧 الصيانة المنجزة والمسلمة اليوم:"), cell_style_bold))
    story.append(Spacer(1, 5))
    
    mnt_headers = [shape("الزبون"), shape("الجهاز المصلح"), shape("تاريخ التسليم"), shape("التكلفة")]
    mnt_rows = [mnt_headers]
    for m in maintenance:
        mnt_rows.append([
            shape(m.customer_name),
            shape(m.device_model),
            shape(m.updated_at.strftime('%d/%m/%Y')),
            shape(f"{m.cost:,.0f} د.ع")
        ])
        
    if len(maintenance) == 0:
        mnt_rows.append([shape("لم يتم تسليم أي أجهزة صيانة اليوم"), "", "", ""])
        
    mnt_table = Table(mnt_rows, colWidths=[120, 150, 110, 120])
    mnt_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#475569')),
        ('TEXTCOLOR', (0,0), (-1,0), colors.whitesmoke),
        ('ALIGN', (0,0), (-1,-1), 'RIGHT'),
        ('BOTTOMPADDING', (0,0), (-1,-1), 6),
        ('TOPPADDING', (0,0), (-1,-1), 6),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#cbd5e1')),
    ]))
    story.append(mnt_table)
    story.append(Spacer(1, 20))
    
    # Low stock alerts section
    story.append(Paragraph(shape("⚠️ نواقص البضائع بالمخزن (2 قطع أو أقل):"), cell_style_bold))
    story.append(Spacer(1, 5))
    
    stock_headers = [shape("الماركة"), shape("المنتج"), shape("الكمية المتبقية"), shape("التصنيف")]
    stock_rows = [stock_headers]
    for brand, name, qty, p_type in low_stock:
        stock_rows.append([
            shape(brand),
            shape(name),
            shape(f"خالي تماماً 🔴" if qty == 0 else f"{qty} قطع 🟡"),
            shape("موبايل" if p_type == 'Phone' else "إكسسوار")
        ])
        
    if len(low_stock) == 0:
        stock_rows.append([shape("جميع بضائع المخزن متوفرة بكميات ممتازة!"), "", "", ""])
        
    stock_table = Table(stock_rows, colWidths=[120, 150, 110, 120])
    stock_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#94a3b8')),
        ('TEXTCOLOR', (0,0), (-1,0), colors.HexColor('#0f172a')),
        ('ALIGN', (0,0), (-1,-1), 'RIGHT'),
        ('BOTTOMPADDING', (0,0), (-1,-1), 6),
        ('TOPPADDING', (0,0), (-1,-1), 6),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#cbd5e1')),
    ]))
    story.append(stock_table)
    
    # Build document
    doc.build(story)
