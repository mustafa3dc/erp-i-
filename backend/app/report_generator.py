import os
import sys
import requests
import datetime
from decimal import Decimal

# Add current folder to path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.database import SessionLocal
from app.models import Sale, MaintenanceJob, Product, InventoryStatus, SaleItem, InventoryItem
from sqlalchemy.orm import joinedload

# Run simple migration queries to add new columns to existing databases safely
db_mig = SessionLocal()
try:
    from sqlalchemy import text
    try:
        db_mig.execute(text("ALTER TABLE maintenance_jobs ADD COLUMN used_product_id UUID"))
        db_mig.commit()
    except Exception:
        db_mig.rollback()
    try:
        db_mig.execute(text("ALTER TABLE inventory_items ADD COLUMN created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP"))
        db_mig.commit()
    except Exception:
        db_mig.rollback()
finally:
    db_mig.close()

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

FONT_REGULAR_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "Amiri-Regular.ttf")
FONT_BOLD_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "Amiri-Bold.ttf")

try:
    if os.path.exists(FONT_REGULAR_PATH):
        pdfmetrics.registerFont(TTFont('Amiri', FONT_REGULAR_PATH))
    else:
        print("Downloading Amiri Arabic font...")
        FONT_URL = "https://github.com/google/fonts/raw/main/ofl/amiri/Amiri-Regular.ttf"
        r = requests.get(FONT_URL, timeout=15)
        with open(FONT_REGULAR_PATH, "wb") as f:
            f.write(r.content)
        pdfmetrics.registerFont(TTFont('Amiri', FONT_REGULAR_PATH))

    if os.path.exists(FONT_BOLD_PATH):
        pdfmetrics.registerFont(TTFont('AmiriBold', FONT_BOLD_PATH))
    else:
        print("Downloading Amiri Bold Arabic font...")
        FONT_URL = "https://github.com/google/fonts/raw/main/ofl/amiri/Amiri-Bold.ttf"
        r = requests.get(FONT_URL, timeout=15)
        with open(FONT_BOLD_PATH, "wb") as f:
            f.write(r.content)
        pdfmetrics.registerFont(TTFont('AmiriBold', FONT_BOLD_PATH))
except Exception as e:
    print(f"Error loading Amiri fonts: {e}")

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
        # Convert to timezone-aware datetimes (system local timezone)
        start_dt = datetime.datetime.combine(today, datetime.time.min).astimezone()
        end_dt = datetime.datetime.combine(today, datetime.time.max).astimezone()
        
        sales = db.query(Sale).options(
            joinedload(Sale.items).joinedload(SaleItem.product)
        ).filter(Sale.sale_date >= start_dt, Sale.sale_date <= end_dt).all()
        
        maintenance = db.query(MaintenanceJob).options(
            joinedload(MaintenanceJob.used_product)
        ).filter(
            MaintenanceJob.updated_at >= start_dt, 
            MaintenanceJob.updated_at <= end_dt,
            MaintenanceJob.status == "Delivered" # Completed & delivered today
        ).all()
        
        added_items = db.query(InventoryItem).options(
            joinedload(InventoryItem.product)
        ).filter(
            InventoryItem.created_at >= start_dt,
            InventoryItem.created_at <= end_dt
        ).all()
        
        products = db.query(Product).filter(Product.type != 'Maintenance').all()
        low_stock = []
        for p in products:
            avail_count = sum(1 for item in p.items if item.status == InventoryStatus.AVAILABLE)
            if avail_count <= 2:
                low_stock.append((p.brand, p.name, avail_count, p.type.name))
                
        return sales, maintenance, low_stock, added_items
    finally:
        db.close()

def generate_daily_report_pdf(pdf_path):
    sales, maintenance, low_stock, added_items = get_today_stats()
    
    # Calculate Summary Totals
    total_sales_amount = sum(Decimal(s.total_amount) for s in sales)
    total_cost_amount = Decimal("0.00")
    for s in sales:
        for item in s.items:
            # Get purchase price from associated product
            if item.product:
                total_cost_amount += Decimal(item.product.purchase_price or 0)
                
    net_sales_profit = total_sales_amount - total_cost_amount
    
    # Maintenance Revenue & Spare Parts Cost
    total_maintenance_revenue = sum(Decimal(m.cost) for m in maintenance)
    total_maintenance_parts_cost = Decimal("0.00")
    for m in maintenance:
        if m.used_product:
            total_maintenance_parts_cost += Decimal(m.used_product.purchase_price or 0)
            
    net_maintenance_profit = total_maintenance_revenue - total_maintenance_parts_cost
    
    # Total purchases/added items cost today
    total_purchases_cost = sum(Decimal(item.product.purchase_price or 0) for item in added_items if item.product)
    
    total_profit = net_sales_profit + net_maintenance_profit
    
    # Start document
    doc = SimpleDocTemplate(pdf_path, pagesize=letter, rightMargin=30, leftMargin=30, topMargin=30, bottomMargin=30)
    story = []
    
    # Setup styles
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        'ArabicTitle',
        parent=styles['Normal'],
        fontName='AmiriBold',
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
    
    cell_style_center = ParagraphStyle(
        'ArabicCellCenter',
        parent=cell_style,
        alignment=1 # Centered
    )
    
    cell_style_bold = ParagraphStyle(
        'ArabicCellBold',
        parent=cell_style,
        fontName='AmiriBold',
        fontSize=11,
        textColor=colors.HexColor('#0f172a')
    )
    
    header_style = ParagraphStyle(
        'ArabicHeader',
        parent=styles['Normal'],
        fontName='AmiriBold',
        fontSize=11,
        leading=15,
        textColor=colors.white,
        alignment=1 # Centered
    )
    
    header_style_dark = ParagraphStyle(
        'ArabicHeaderDark',
        parent=header_style,
        textColor=colors.HexColor('#0f172a')
    )
    
    # Title
    story.append(Paragraph(shape("التقرير اليومي لمتجر M MOBILE"), title_style))
    today_str = datetime.date.today().strftime('%d/%m/%Y')
    story.append(Paragraph(shape(f"تاريخ التقرير: {today_str}"), subtitle_style))
    story.append(Spacer(1, 15))
    
    # Financial Summary Section
    story.append(Paragraph(shape("الملخص المالي اليومي:"), cell_style_bold))
    story.append(Spacer(1, 5))
    
    summary_data = [
        [Paragraph(shape("إجمالي مبيعات البضائع:"), cell_style_bold), Paragraph(shape(f"{total_sales_amount:,.2f} د.ع"), cell_style)],
        [Paragraph(shape("إجمالي تكلفة المبيعات:"), cell_style_bold), Paragraph(shape(f"{total_cost_amount:,.2f} د.ع"), cell_style)],
        [Paragraph(shape("أرباح مبيعات البضائع:"), cell_style_bold), Paragraph(shape(f"{net_sales_profit:,.2f} د.ع"), cell_style)],
        [Paragraph(shape("إيرادات قسم الصيانة:"), cell_style_bold), Paragraph(shape(f"{total_maintenance_revenue:,.2f} د.ع"), cell_style)],
        [Paragraph(shape("تكلفة قطع الغيار المستخدمة:"), cell_style_bold), Paragraph(shape(f"{total_maintenance_parts_cost:,.2f} د.ع"), cell_style)],
        [Paragraph(shape("صافي أرباح قسم الصيانة:"), cell_style_bold), Paragraph(shape(f"{net_maintenance_profit:,.2f} د.ع"), cell_style)],
        [Paragraph(shape("تكلفة البضائع المضافة للمخازن اليوم:"), cell_style_bold), Paragraph(shape(f"{total_purchases_cost:,.2f} د.ع"), cell_style)],
        [Paragraph(shape("صافي الأرباح الكلي المنجز:"), cell_style_bold), Paragraph(shape(f"{total_profit:,.2f} د.ع"), cell_style)]
    ]
    
    summary_table = Table(summary_data, colWidths=[240, 260])
    summary_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor('#f8fafc')),
        ('ALIGN', (0,0), (-1,-1), 'RIGHT'),
        ('BOTTOMPADDING', (0,0), (-1,-1), 5),
        ('TOPPADDING', (0,0), (-1,-1), 5),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#e2e8f0')),
    ]))
    story.append(summary_table)
    story.append(Spacer(1, 20))
    
    # Sales details section
    story.append(Paragraph(shape("تفاصيل فواتير المبيعات اليوم:"), cell_style_bold))
    story.append(Spacer(1, 5))
    
    sales_headers = [
        Paragraph(shape("رقم الفاتورة"), header_style),
        Paragraph(shape("الزبون"), header_style),
        Paragraph(shape("المبيعات"), header_style),
        Paragraph(shape("طريقة الدفع"), header_style),
        Paragraph(shape("المبلغ"), header_style)
    ]
    sales_rows = [sales_headers]
    for s in sales:
        items_desc = ", ".join([f"{item.product.brand} {item.product.name}" for item in s.items if item.product])
        sales_rows.append([
            Paragraph(shape(f"INV-{str(s.id)[:8]}"), cell_style_center),
            Paragraph(shape(s.customer_name or "زبون نقدي"), cell_style),
            Paragraph(shape(items_desc), cell_style),
            Paragraph(shape("نقداً" if s.payment_method.value == 'Cash' else "آجل"), cell_style_center),
            Paragraph(shape(f"{s.total_amount:,.0f} د.ع"), cell_style)
        ])
        
    if len(sales) == 0:
        sales_rows.append([Paragraph(shape("لا توجد مبيعات مسجلة اليوم"), cell_style_center), "", "", "", ""])
        
    sales_table = Table(sales_rows, colWidths=[95, 95, 170, 70, 70])
    sales_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#0f172a')),
        ('ALIGN', (0,0), (-1,-1), 'CENTER'),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('BOTTOMPADDING', (0,0), (-1,-1), 6),
        ('TOPPADDING', (0,0), (-1,-1), 6),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#cbd5e1')),
    ]))
    story.append(sales_table)
    story.append(Spacer(1, 20))
    
    # Maintenance jobs completed
    story.append(Paragraph(shape("الصيانة المنجزة والمسلمة اليوم:"), cell_style_bold))
    story.append(Spacer(1, 5))
    
    mnt_headers = [
        Paragraph(shape("الزبون"), header_style),
        Paragraph(shape("الجهاز المصلح"), header_style),
        Paragraph(shape("قطع الغيار المستخدمة"), header_style),
        Paragraph(shape("التكلفة"), header_style)
    ]
    mnt_rows = [mnt_headers]
    for m in maintenance:
        part_name = f"{m.used_product.brand} {m.used_product.name}" if m.used_product else "لا يوجد"
        mnt_rows.append([
            Paragraph(shape(m.customer_name), cell_style),
            Paragraph(shape(m.device_model), cell_style),
            Paragraph(shape(part_name), cell_style),
            Paragraph(shape(f"{m.cost:,.0f} د.ع"), cell_style)
        ])
        
    if len(maintenance) == 0:
        mnt_rows.append([Paragraph(shape("لم يتم تسليم أي أجهزة صيانة اليوم"), cell_style_center), "", "", ""])
        
    mnt_table = Table(mnt_rows, colWidths=[120, 140, 130, 110])
    mnt_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#475569')),
        ('ALIGN', (0,0), (-1,-1), 'CENTER'),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('BOTTOMPADDING', (0,0), (-1,-1), 6),
        ('TOPPADDING', (0,0), (-1,-1), 6),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#cbd5e1')),
    ]))
    story.append(mnt_table)
    story.append(Spacer(1, 20))
    
    # Added items/purchases section
    story.append(Paragraph(shape("البضائع والمشتريات المضافة للمخازن اليوم:"), cell_style_bold))
    story.append(Spacer(1, 5))
    
    added_headers = [
        Paragraph(shape("الماركة"), header_style),
        Paragraph(shape("المنتج"), header_style),
        Paragraph(shape("الرقم التسلسلي / IMEI"), header_style),
        Paragraph(shape("تكلفة الشراء"), header_style)
    ]
    added_rows = [added_headers]
    for item in added_items:
        prod_brand = item.product.brand if item.product else "-"
        prod_name = item.product.name if item.product else "-"
        prod_cost = f"{item.product.purchase_price:,.0f} د.ع" if item.product else "0 د.ع"
        added_rows.append([
            Paragraph(shape(prod_brand), cell_style),
            Paragraph(shape(prod_name), cell_style),
            Paragraph(shape(item.imei or "بدون سيريال"), cell_style_center),
            Paragraph(shape(prod_cost), cell_style)
        ])
        
    if len(added_items) == 0:
        added_rows.append([Paragraph(shape("لم يتم إضافة أي بضائع جديدة للمخزن اليوم"), cell_style_center), "", "", ""])
        
    added_table = Table(added_rows, colWidths=[120, 140, 130, 110])
    added_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#1e293b')),
        ('ALIGN', (0,0), (-1,-1), 'CENTER'),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('BOTTOMPADDING', (0,0), (-1,-1), 6),
        ('TOPPADDING', (0,0), (-1,-1), 6),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#cbd5e1')),
    ]))
    story.append(added_table)
    story.append(Spacer(1, 20))
    
    # Low stock alerts section
    story.append(Paragraph(shape("نواقص البضائع بالمخزن (2 قطع أو أقل):"), cell_style_bold))
    story.append(Spacer(1, 5))
    
    stock_headers = [
        Paragraph(shape("الماركة"), header_style_dark),
        Paragraph(shape("المنتج"), header_style_dark),
        Paragraph(shape("الكمية المتبقية"), header_style_dark),
        Paragraph(shape("التصنيف"), header_style_dark)
    ]
    stock_rows = [stock_headers]
    for brand, name, qty, p_type in low_stock:
        stock_rows.append([
            Paragraph(shape(brand), cell_style),
            Paragraph(shape(name), cell_style),
            Paragraph(shape("نفد تماماً" if qty == 0 else f"متبقي: {qty} قطع"), cell_style_center),
            Paragraph(shape("موبايل" if p_type == 'Phone' else "إكسسوار"), cell_style_center)
        ])
        
    if len(low_stock) == 0:
        stock_rows.append([Paragraph(shape("جميع بضائع المخزن متوفرة بكميات ممتازة!"), cell_style_center), "", "", ""])
        
    stock_table = Table(stock_rows, colWidths=[125, 150, 115, 110])
    stock_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#e2e8f0')),
        ('ALIGN', (0,0), (-1,-1), 'CENTER'),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('BOTTOMPADDING', (0,0), (-1,-1), 6),
        ('TOPPADDING', (0,0), (-1,-1), 6),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#cbd5e1')),
    ]))
    story.append(stock_table)
    
    # Build document
    doc.build(story)
