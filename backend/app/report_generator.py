import os
import sys
import requests
import datetime
from decimal import Decimal

# Add current folder to path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.database import SessionLocal, engine, Base
from app.models import Sale, MaintenanceJob, Product, InventoryStatus, SaleItem, InventoryItem, MaintenancePart
from sqlalchemy.orm import joinedload

# Run simple migration queries to add new columns to existing databases safely
db_mig = SessionLocal()
try:
    Base.metadata.create_all(bind=engine)
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

def get_today_stats(target_date=None):
    db = SessionLocal()
    try:
        if target_date is None:
            target_date = datetime.datetime.now().date()
        # Convert to naive UTC datetimes for SQLite string compatibility
        local_start = datetime.datetime.combine(target_date, datetime.time.min).astimezone()
        local_end = datetime.datetime.combine(target_date, datetime.time.max).astimezone()
        start_dt = local_start.astimezone(datetime.timezone.utc).replace(tzinfo=None)
        end_dt = local_end.astimezone(datetime.timezone.utc).replace(tzinfo=None)
        
        sales = db.query(Sale).options(
            joinedload(Sale.items).joinedload(SaleItem.product)
        ).filter(Sale.sale_date >= start_dt, Sale.sale_date <= end_dt).all()
        
        maintenance = db.query(MaintenanceJob).options(
            joinedload(MaintenanceJob.used_product),
            joinedload(MaintenanceJob.parts).joinedload(MaintenancePart.product)
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

def get_range_stats(start_date, end_date):
    db = SessionLocal()
    try:
        # Convert range dates to UTC naive
        local_start = datetime.datetime.combine(start_date, datetime.time.min).astimezone()
        local_end = datetime.datetime.combine(end_date, datetime.time.max).astimezone()
        start_dt = local_start.astimezone(datetime.timezone.utc).replace(tzinfo=None)
        end_dt = local_end.astimezone(datetime.timezone.utc).replace(tzinfo=None)
        
        sales = db.query(Sale).options(
            joinedload(Sale.items).joinedload(SaleItem.product)
        ).filter(Sale.sale_date >= start_dt, Sale.sale_date <= end_dt).all()
        
        maintenance = db.query(MaintenanceJob).options(
            joinedload(MaintenanceJob.used_product),
            joinedload(MaintenanceJob.parts).joinedload(MaintenancePart.product)
        ).filter(
            MaintenanceJob.updated_at >= start_dt, 
            MaintenanceJob.updated_at <= end_dt,
            MaintenanceJob.status == "Delivered"
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

def generate_range_report_pdf(pdf_path, start_date, end_date, title_text):
    sales, maintenance, low_stock, added_items = get_range_stats(start_date, end_date)
    
    line_items = []
    
    # Sales
    for s in sales:
        for item in s.items:
            if item.product:
                name = f"{item.product.brand} {item.product.name}" if item.product.brand else item.product.name
                sell_price = Decimal(item.price or item.product.selling_price or 0)
                cost = Decimal(item.product.purchase_price or 0)
                qty = 1
                profit = sell_price - cost
                line_items.append((name, qty, sell_price, cost, profit))
                
    # Maintenance
    for m in maintenance:
        name = f"صيانة هاتف ({m.device_model or 'جهاز'})"
        sell_price = Decimal(m.cost or 0)
        parts_cost = Decimal(0)
        if m.used_product:
            parts_cost += Decimal(m.used_product.purchase_price or 0)
        for part in m.parts:
            if part.product:
                parts_cost += Decimal(part.product.purchase_price or 0)
        profit = sell_price - parts_cost
        line_items.append((name, 1, sell_price, parts_cost, profit))
        
    total_profit = sum(item[4] for item in line_items)
    total_cost = sum(item[3] for item in line_items)
    total_qty = sum(item[1] for item in line_items)
    
    doc = SimpleDocTemplate(pdf_path, pagesize=letter, rightMargin=40, leftMargin=40, topMargin=40, bottomMargin=40)
    story = []
    styles = getSampleStyleSheet()
    
    title_style = ParagraphStyle(
        'RangeTitle', parent=styles['Normal'], fontName='AmiriBold', fontSize=20, leading=26, textColor=colors.HexColor('#1a1a2e'), alignment=1
    )
    subtitle_style = ParagraphStyle(
        'RangeSub', parent=styles['Normal'], fontName='Amiri', fontSize=11, leading=16, textColor=colors.HexColor('#6b7280'), alignment=1
    )
    header_style = ParagraphStyle(
        'RangeHead', parent=styles['Normal'], fontName='AmiriBold', fontSize=10, leading=14, textColor=colors.HexColor('#374151'), alignment=1
    )
    cell_style = ParagraphStyle(
        'RangeCell', parent=styles['Normal'], fontName='Amiri', fontSize=10, leading=14, textColor=colors.HexColor('#1f2937'), alignment=1
    )
    cell_name_style = ParagraphStyle(
        'RangeCellName', parent=cell_style, alignment=2
    )
    cell_bold = ParagraphStyle(
        'RangeCellBold', parent=cell_style, fontName='AmiriBold', fontSize=11, textColor=colors.white
    )
    cell_bold_name = ParagraphStyle(
        'RangeCellBoldName', parent=cell_bold, alignment=2
    )
    
    story.append(Spacer(1, 20))
    story.append(Paragraph(shape(title_text), title_style))
    story.append(Spacer(1, 6))
    story.append(Paragraph(shape(f"الفترة: من {start_date.strftime('%d-%m-%Y')} إلى {end_date.strftime('%d-%m-%Y')}"), subtitle_style))
    story.append(Spacer(1, 25))
    
    headers = [
        Paragraph(shape("الربح"), header_style),
        Paragraph(shape("التكلفة"), header_style),
        Paragraph(shape("سعر البيع"), header_style),
        Paragraph(shape("الكمية"), header_style),
        Paragraph(shape("البيان (المنتج/الخدمة)"), header_style)
    ]
    table_data = [headers]
    
    for name, qty, sell, cost, profit in line_items:
        table_data.append([
            Paragraph(shape(f"{float(profit):,.0f} د.ع"), cell_style),
            Paragraph(shape(f"{float(cost):,.0f} د.ع"), cell_style),
            Paragraph(shape(f"{float(sell):,.0f} د.ع"), cell_style),
            Paragraph(shape(str(qty)), cell_style),
            Paragraph(shape(name), cell_name_style)
        ])
        
    table_data.append([
        Paragraph(shape(f"{float(total_profit):,.0f} د.ع"), cell_bold),
        Paragraph(shape(f"{float(total_cost):,.0f} د.ع"), cell_bold),
        Paragraph(shape(f"{float(total_profit + total_cost):,.0f} د.ع"), cell_bold),
        Paragraph(shape(str(total_qty)), cell_bold),
        Paragraph(shape("إجمالي الأداء العام للفترة"), cell_bold_name)
    ])
    
    main_table = Table(table_data, colWidths=[110, 110, 110, 50, 150])
    style_commands = [
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#f3f4f6')),
        ('BACKGROUND', (0, -1), (-1, -1), colors.HexColor('#4f46e5')),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#e5e7eb')),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
    ]
    
    for i in range(1, len(table_data) - 1):
        if i % 2 == 0:
            style_commands.append(('BACKGROUND', (0, i), (-1, i), colors.HexColor('#f9fafb')))
        else:
            style_commands.append(('BACKGROUND', (0, i), (-1, i), colors.white))
            
    main_table.setStyle(TableStyle(style_commands))
    story.append(main_table)
    doc.build(story)

def generate_daily_report_pdf(pdf_path, target_date=None):
    if target_date is None:
        target_date = datetime.datetime.now().date()
    sales, maintenance, low_stock, added_items = get_today_stats(target_date)
    
    # ──────────────────────────────────────────────
    # Build unified line items: sales + maintenance
    # ──────────────────────────────────────────────
    line_items = []  # each: (name, qty, sell_price, cost, profit)
    
    # Sales items
    for s in sales:
        for item in s.items:
            if item.product:
                name = f"{item.product.brand} {item.product.name}" if item.product.brand else item.product.name
                sell_price = Decimal(item.price or item.product.selling_price or 0)
                cost = Decimal(item.product.purchase_price or 0)
                qty = 1
                profit = sell_price - cost
                line_items.append((name, qty, sell_price, cost, profit))
    
    # Maintenance items
    for m in maintenance:
        name = f"صيانة هاتف ({m.device_model or 'جهاز'})"
        sell_price = Decimal(m.cost or 0)
        parts_cost = Decimal(0)
        if m.used_product:
            parts_cost += Decimal(m.used_product.purchase_price or 0)
        for part in m.parts:
            if part.product:
                parts_cost += Decimal(part.product.purchase_price or 0)
        profit = sell_price - parts_cost
        line_items.append((name, 1, sell_price, parts_cost, profit))
    
    # Totals
    total_profit = sum(item[4] for item in line_items)
    total_cost = sum(item[3] for item in line_items)
    total_qty = sum(item[1] for item in line_items)
    
    # ──────────────────────────────────────────────
    # PDF Document Setup
    # ──────────────────────────────────────────────
    doc = SimpleDocTemplate(pdf_path, pagesize=letter, rightMargin=40, leftMargin=40, topMargin=40, bottomMargin=40)
    story = []
    
    styles = getSampleStyleSheet()
    
    # Title style - bold centered
    title_style = ParagraphStyle(
        'Title',
        parent=styles['Normal'],
        fontName='AmiriBold',
        fontSize=22,
        leading=28,
        textColor=colors.HexColor('#1a1a2e'),
        alignment=1
    )
    
    # Subtitle style
    subtitle_style = ParagraphStyle(
        'Subtitle',
        parent=styles['Normal'],
        fontName='Amiri',
        fontSize=11,
        leading=16,
        textColor=colors.HexColor('#6b7280'),
        alignment=1
    )
    
    # Table header style - white text
    header_style = ParagraphStyle(
        'Header',
        parent=styles['Normal'],
        fontName='AmiriBold',
        fontSize=10,
        leading=14,
        textColor=colors.HexColor('#374151'),
        alignment=1
    )
    
    # Cell style - right aligned for Arabic
    cell_style = ParagraphStyle(
        'Cell',
        parent=styles['Normal'],
        fontName='Amiri',
        fontSize=10,
        leading=14,
        textColor=colors.HexColor('#1f2937'),
        alignment=1
    )
    
    # Cell style for name column - right aligned
    cell_name_style = ParagraphStyle(
        'CellName',
        parent=cell_style,
        alignment=2  # Right for Arabic names
    )
    
    # Bold cell for totals
    cell_bold = ParagraphStyle(
        'CellBold',
        parent=cell_style,
        fontName='AmiriBold',
        fontSize=11,
        textColor=colors.white
    )
    
    cell_bold_name = ParagraphStyle(
        'CellBoldName',
        parent=cell_bold,
        alignment=2
    )
    
    # ──────────────────────────────────────────────
    # Title Section
    # ──────────────────────────────────────────────
    story.append(Spacer(1, 20))
    story.append(Paragraph(shape("تقرير الأداء المالي اليومي"), title_style))
    story.append(Spacer(1, 6))
    
    report_date_str = target_date.strftime('%d-%m-%Y')
    story.append(Paragraph(shape(f"مشروع M MOBILE | تاريخ: {report_date_str}"), subtitle_style))
    story.append(Spacer(1, 25))
    
    # ──────────────────────────────────────────────
    # Main Performance Table
    # ──────────────────────────────────────────────
    # Headers: الربح | التكلفة | سعر البيع | الكمية | البيان (المنتج/الخدمة)
    headers = [
        Paragraph(shape("الربح"), header_style),
        Paragraph(shape("التكلفة"), header_style),
        Paragraph(shape("سعر البيع"), header_style),
        Paragraph(shape("الكمية"), header_style),
        Paragraph(shape("البيان (المنتج/الخدمة)"), header_style),
    ]
    
    table_data = [headers]
    
    for name, qty, sell_price, cost, profit in line_items:
        table_data.append([
            Paragraph(shape(f"{profit:,.0f}"), cell_style),
            Paragraph(shape(f"{cost:,.0f}"), cell_style),
            Paragraph(shape(f"{sell_price:,.0f}"), cell_style),
            Paragraph(shape(str(qty)), cell_style),
            Paragraph(shape(name), cell_name_style),
        ])
    
    # If no items, show empty row
    if not line_items:
        table_data.append([
            Paragraph(shape("0"), cell_style),
            Paragraph(shape("0"), cell_style),
            Paragraph(shape("0"), cell_style),
            Paragraph(shape("0"), cell_style),
            Paragraph(shape("لا توجد عمليات مسجلة"), cell_name_style),
        ])
    
    # Footer row: Total profit, Total cost, Total qty
    table_data.append([
        Paragraph(shape(f"{total_profit:,.0f}"), cell_bold),
        Paragraph(shape(f"{total_cost:,.0f}"), cell_bold),
        Paragraph("", cell_bold),
        Paragraph(shape(f"{total_qty}"), cell_bold),
        Paragraph(shape("إجمالي صافي الربح اليومي"), cell_bold_name),
    ])
    
    col_widths = [85, 85, 85, 55, 220]
    main_table = Table(table_data, colWidths=col_widths)
    
    num_rows = len(table_data)
    last_row = num_rows - 1
    
    style_commands = [
        # Header row - light gray background
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#f3f4f6')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.HexColor('#374151')),
        
        # All cells
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('FONTNAME', (0, 0), (-1, -1), 'Amiri'),
        ('FONTSIZE', (0, 0), (-1, -1), 10),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 10),
        ('TOPPADDING', (0, 0), (-1, -1), 10),
        ('LEFTPADDING', (0, 0), (-1, -1), 8),
        ('RIGHTPADDING', (0, 0), (-1, -1), 8),
        
        # Grid lines
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#e5e7eb')),
        
        # Alternating row colors for data rows
        # Footer row - blue background
        ('BACKGROUND', (0, last_row), (-1, last_row), colors.HexColor('#3b82f6')),
        ('TEXTCOLOR', (0, last_row), (-1, last_row), colors.white),
        
        # Span the label across columns 2-4 in footer
        ('SPAN', (2, last_row), (4, last_row)),
    ]
    
    # Alternating row backgrounds for data rows
    for i in range(1, last_row):
        if i % 2 == 0:
            style_commands.append(('BACKGROUND', (0, i), (-1, i), colors.HexColor('#f9fafb')))
        else:
            style_commands.append(('BACKGROUND', (0, i), (-1, i), colors.white))
    
    main_table.setStyle(TableStyle(style_commands))
    story.append(main_table)
    
    # Build PDF
    doc.build(story)


def generate_customer_report_pdf(pdf_path, customer_id):
    import uuid
    from app.database import SessionLocal
    from app import models, crud
    from sqlalchemy.orm import joinedload
    
    db = SessionLocal()
    try:
        target_id = uuid.UUID(customer_id) if isinstance(customer_id, str) else customer_id
        customer = db.query(models.Customer).filter(models.Customer.id == target_id).first()
        if not customer:
            raise Exception("Customer not found")
            
        sales = db.query(models.Sale).options(
            joinedload(models.Sale.items).joinedload(models.SaleItem.product)
        ).filter(
            models.Sale.customer_name.ilike(f"%{customer.name}%")
        ).order_by(models.Sale.sale_date.desc()).all()

        maintenance = db.query(models.MaintenanceJob).filter(
            models.MaintenanceJob.customer_name.ilike(f"%{customer.name}%")
        ).order_by(models.MaintenanceJob.created_at.desc()).all()
        
        payments = db.query(models.CustomerPayment).filter(
            models.CustomerPayment.customer_id == customer.id
        ).order_by(models.CustomerPayment.payment_date.desc()).all()
        
        current_debt = crud.calculate_customer_debt(db, customer)
        
        # ──────────────────────────────────────────────
        # PDF Document Setup
        # ──────────────────────────────────────────────
        doc = SimpleDocTemplate(pdf_path, pagesize=letter, rightMargin=40, leftMargin=40, topMargin=40, bottomMargin=40)
        story = []
        
        styles = getSampleStyleSheet()
        
        title_style = ParagraphStyle(
            'CustTitle',
            parent=styles['Normal'],
            fontName='AmiriBold',
            fontSize=20,
            leading=26,
            textColor=colors.HexColor('#1a1a2e'),
            alignment=1
        )
        
        subtitle_style = ParagraphStyle(
            'CustSubtitle',
            parent=styles['Normal'],
            fontName='Amiri',
            fontSize=11,
            leading=16,
            textColor=colors.HexColor('#4b5563'),
            alignment=1
        )
        
        section_style = ParagraphStyle(
            'CustSection',
            parent=styles['Normal'],
            fontName='AmiriBold',
            fontSize=13,
            leading=18,
            textColor=colors.HexColor('#111827'),
            alignment=2,
            spaceAfter=8,
            spaceBefore=15
        )
        
        header_style = ParagraphStyle(
            'CustHeader',
            parent=styles['Normal'],
            fontName='AmiriBold',
            fontSize=9,
            leading=13,
            textColor=colors.HexColor('#374151'),
            alignment=1
        )
        
        cell_style = ParagraphStyle(
            'CustCell',
            parent=styles['Normal'],
            fontName='Amiri',
            fontSize=9,
            leading=13,
            textColor=colors.HexColor('#1f2937'),
            alignment=1
        )
        
        cell_right_style = ParagraphStyle(
            'CustCellRight',
            parent=cell_style,
            alignment=2
        )
        
        story.append(Spacer(1, 10))
        story.append(Paragraph(shape(f"كشف حساب تفصيلي للزبون: {customer.name}"), title_style))
        story.append(Spacer(1, 4))
        story.append(Paragraph(shape(f"الهاتف: {customer.phone or 'غير مسجل'} | تاريخ التقرير: {datetime.datetime.now().strftime('%d-%m-%Y')}"), subtitle_style))
        story.append(Spacer(1, 15))
        
        # ──────────────────────────────────────────────
        # Summary Grid Table
        # ──────────────────────────────────────────────
        summary_headers = [
            Paragraph(shape("صافي الدين المتبقي"), header_style),
            Paragraph(shape("إجمالي المبالغ المسددة"), header_style),
            Paragraph(shape("المشتريات الآجلة الجديدة"), header_style),
            Paragraph(shape("الدين السابق (القديم)"), header_style)
        ]
        
        new_credit_purchases = sum(float(s.total_amount) for s in sales if s.payment_method == models.PaymentMethod.CREDIT)
        total_paid = sum(float(p.amount) for p in payments)
        
        summary_data = [
            summary_headers,
            [
                Paragraph(shape(f"{current_debt:,.0f} د.ع"), cell_style),
                Paragraph(shape(f"{total_paid:,.0f} د.ع"), cell_style),
                Paragraph(shape(f"{new_credit_purchases:,.0f} د.ع"), cell_style),
                Paragraph(shape(f"{float(customer.initial_debt or 0):,.0f} د.ع"), cell_style)
            ]
        ]
        
        summary_table = Table(summary_data, colWidths=[130, 130, 130, 130])
        summary_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#f3f4f6')),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#d1d5db')),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
            ('TOPPADDING', (0, 0), (-1, -1), 8),
        ]))
        story.append(summary_table)
        story.append(Spacer(1, 10))
        
        if customer.installment_monthly and customer.installment_monthly > 0:
            import math
            installment_headers = [
                Paragraph(shape("المتبقي التقريبي للأقساط"), header_style),
                Paragraph(shape("مبلغ القسط الشهري"), header_style),
                Paragraph(shape("مبلغ مقدمة القسط"), header_style)
            ]
            approx_months = f"{math.ceil(current_debt / customer.installment_monthly)} أشهر" if current_debt > 0 else "مسدد بالكامل"
            installment_row = [
                Paragraph(shape(approx_months), cell_style),
                Paragraph(shape(f"{float(customer.installment_monthly):,.0f} د.ع"), cell_style),
                Paragraph(shape(f"{float(customer.installment_downpayment or 0):,.0f} د.ع"), cell_style)
            ]
            
            installment_data = [installment_headers, installment_row]
            installment_table = Table(installment_data, colWidths=[173, 173, 173])
            installment_table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#eef2ff')),
                ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#c7d2fe')),
                ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
                ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
                ('TOPPADDING', (0, 0), (-1, -1), 6),
            ]))
            story.append(Paragraph(shape("📅 تفاصيل اتفاقية الأقساط والاتفاقية المالية:"), ParagraphStyle('InstTitle', parent=styles['Normal'], fontName='AmiriBold', fontSize=10, leading=14, spaceAfter=4)))
            story.append(installment_table)
            story.append(Spacer(1, 15))
            
        # ──────────────────────────────────────────────
        # 1. Sales & Purchases Section
        # ──────────────────────────────────────────────
        story.append(Paragraph(shape("📦 سجل المشتريات والفواتير"), section_style))
        sales_headers = [
            Paragraph(shape("المبلغ"), header_style),
            Paragraph(shape("طريقة الدفع"), header_style),
            Paragraph(shape("البضاعة المباعة"), header_style),
            Paragraph(shape("التاريخ"), header_style),
            Paragraph(shape("رقم الفاتورة"), header_style)
        ]
        sales_rows = [sales_headers]
        for s in sales:
            items_desc = []
            for item in s.items:
                if item.product:
                    items_desc.append(f"{item.product.brand} {item.product.name}" if item.product.brand else item.product.name)
            items_str = ", ".join(items_desc) if items_desc else "بضاعة عامة"
            
            sales_rows.append([
                Paragraph(shape(f"{float(s.total_amount):,.0f} د.ع"), cell_style),
                Paragraph(shape("نقدي 💵" if s.payment_method == models.PaymentMethod.CASH else "آجل 🕒"), cell_style),
                Paragraph(shape(items_str), cell_right_style),
                Paragraph(shape(s.sale_date.strftime('%Y-%m-%d')), cell_style),
                Paragraph(shape(s.id.hex[:8].upper()), cell_style),
            ])
            
        if not sales:
            sales_rows.append([Paragraph(shape("-"), cell_style)] * 5)
            
        sales_table = Table(sales_rows, colWidths=[90, 80, 210, 80, 60])
        sales_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#f9fafb')),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#e5e7eb')),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
            ('TOPPADDING', (0, 0), (-1, -1), 6),
        ]))
        story.append(sales_table)
        story.append(Spacer(1, 10))
        
        # ──────────────────────────────────────────────
        # 2. Payments / Instalments Section
        # ──────────────────────────────────────────────
        story.append(Paragraph(shape("💸 سجل أقساط ودفعات تسديد الديون"), section_style))
        pmt_headers = [
            Paragraph(shape("ملاحظات التسديد"), header_style),
            Paragraph(shape("المبلغ المسدد"), header_style),
            Paragraph(shape("تاريخ ووقت الدفعة"), header_style)
        ]
        pmt_rows = [pmt_headers]
        for p in payments:
            pmt_rows.append([
                Paragraph(shape(p.notes or "-"), cell_right_style),
                Paragraph(shape(f"+{float(p.amount):,.0f} د.ع"), cell_style),
                Paragraph(shape(p.payment_date.strftime('%Y-%m-%d %H:%M')), cell_style)
            ])
            
        if not payments:
            pmt_rows.append([Paragraph(shape("-"), cell_style)] * 3)
            
        pmt_table = Table(pmt_rows, colWidths=[240, 140, 140])
        pmt_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#f9fafb')),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#e5e7eb')),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
            ('TOPPADDING', (0, 0), (-1, -1), 6),
        ]))
        story.append(pmt_table)
        
        # Build PDF
        doc.build(story)
    finally:
        db.close()


def generate_inventory_report_pdf(pdf_path):
    from app.database import SessionLocal
    from app import models
    from sqlalchemy import func
    
    db = SessionLocal()
    try:
        results = db.query(
            models.Product.brand,
            models.Product.name,
            func.count(models.InventoryItem.id).label("available_qty"),
            models.Product.selling_price,
            models.Product.type
        ).outerjoin(
            models.InventoryItem,
            (models.Product.id == models.InventoryItem.product_id) & 
            (models.InventoryItem.status == models.InventoryStatus.AVAILABLE)
        ).group_by(
            models.Product.id,
            models.Product.brand,
            models.Product.name,
            models.Product.selling_price,
            models.Product.type
        ).order_by(
            models.Product.type.asc(),
            func.count(models.InventoryItem.id).desc(),
            models.Product.brand.asc()
        ).all()
        
        doc = SimpleDocTemplate(pdf_path, pagesize=letter, rightMargin=40, leftMargin=40, topMargin=40, bottomMargin=40)
        story = []
        
        styles = getSampleStyleSheet()
        title_style = ParagraphStyle(
            'InvTitle', parent=styles['Normal'], fontName='AmiriBold', fontSize=20, leading=26, alignment=1
        )
        subtitle_style = ParagraphStyle(
            'InvSub', parent=styles['Normal'], fontName='Amiri', fontSize=11, leading=16, alignment=1, textColor=colors.HexColor('#4b5563')
        )
        header_style = ParagraphStyle(
            'InvHead', parent=styles['Normal'], fontName='AmiriBold', fontSize=10, leading=14, alignment=1
        )
        cell_style = ParagraphStyle(
            'InvCell', parent=styles['Normal'], fontName='Amiri', fontSize=9, leading=13, alignment=1
        )
        cell_right = ParagraphStyle(
            'InvCellRight', parent=cell_style, alignment=2
        )
        
        story.append(Spacer(1, 10))
        story.append(Paragraph(shape("تقرير جرد المخزن العام للبضائع"), title_style))
        story.append(Spacer(1, 4))
        story.append(Paragraph(shape(f"تاريخ الجرد: {datetime.datetime.now().strftime('%Y-%m-%d %H:%M')}"), subtitle_style))
        story.append(Spacer(1, 20))
        
        headers = [
            Paragraph(shape("سعر البيع"), header_style),
            Paragraph(shape("الكمية"), header_style),
            Paragraph(shape("النوع"), header_style),
            Paragraph(shape("اسم البضاعة"), header_style),
            Paragraph(shape("الماركة"), header_style)
        ]
        
        table_data = [headers]
        type_labels = {
            models.ProductType.PHONE: "أجهزة الموبايل",
            models.ProductType.ACCESSORY: "الإكسسوارات",
            models.ProductType.MAINTENANCE: "قطع الصيانة"
        }

        # Filter and group results
        categorized_data = {
            models.ProductType.PHONE: [],
            models.ProductType.ACCESSORY: [],
            models.ProductType.MAINTENANCE: []
        }

        for brand, name, qty, price, p_type in results:
            # 1. Hide virtual recharge/gaming cards
            is_recharge = any(kw in name for kw in ["كارت", "بطاقة", "شدات", "رصيد", "آسيا سيل", "زين عراق", "كورك", "فري فاير", "Free Fire", "ببجي", "PUBG", "آيتونز", "رايزر", "PlayStation", "جوجل بلاي"])
            if is_recharge:
                continue
                
            # 2. Hide out-of-stock items
            if qty <= 0:
                continue

            if p_type in categorized_data:
                categorized_data[p_type].append((brand, name, qty, price))

        category_title_style = ParagraphStyle(
            'CategoryTitle', parent=styles['Normal'], fontName='AmiriBold', fontSize=12, leading=16, alignment=2, textColor=colors.HexColor('#1f2937')
        )

        for cat_type, items in categorized_data.items():
            if not items:
                continue
            
            # Subheading for Category
            story.append(Spacer(1, 15))
            story.append(Paragraph(shape(f"{type_labels[cat_type]} :"), category_title_style))
            story.append(Spacer(1, 6))

            # Headers: سعر البيع | الكمية | اسم البضاعة | الماركة
            headers = [
                Paragraph(shape("سعر البيع"), header_style),
                Paragraph(shape("الكمية"), header_style),
                Paragraph(shape("اسم المادة"), header_style),
                Paragraph(shape("الماركة"), header_style)
            ]
            
            table_data = [headers]
            for brand, name, qty, price in items:
                table_data.append([
                    Paragraph(shape(f"{float(price):,.0f} د.ع" if price else "0"), cell_style),
                    Paragraph(shape(str(qty)), cell_style),
                    Paragraph(shape(name), cell_right),
                    Paragraph(shape(brand or "-"), cell_right),
                ])
                
            inv_table = Table(table_data, colWidths=[120, 70, 220, 120])
            
            style_cmds = [
                ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#f3f4f6')),
                ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#d1d5db')),
                ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
                ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
                ('TOPPADDING', (0, 0), (-1, -1), 5),
            ]
            
            for i in range(1, len(table_data)):
                if i % 2 == 0:
                    style_cmds.append(('BACKGROUND', (0, i), (-1, i), colors.HexColor('#f9fafb')))
                    
            inv_table.setStyle(TableStyle(style_cmds))
            story.append(inv_table)
            story.append(Spacer(1, 10))
        doc.build(story)
    finally:
        db.close()


def generate_shortages_report_pdf(pdf_path):
    from app.database import SessionLocal
    from app import models
    from sqlalchemy import func
    
    db = SessionLocal()
    try:
        results = db.query(
            models.Product.brand,
            models.Product.name,
            func.count(models.InventoryItem.id).label("available_qty"),
            models.Product.type
        ).outerjoin(
            models.InventoryItem,
            (models.Product.id == models.InventoryItem.product_id) & 
            (models.InventoryItem.status == models.InventoryStatus.AVAILABLE)
        ).group_by(
            models.Product.id,
            models.Product.brand,
            models.Product.name,
            models.Product.type
        ).all()
        
        shortages = [item for item in results if item[2] <= 2 and item[3] != models.ProductType.MAINTENANCE]
        
        doc = SimpleDocTemplate(pdf_path, pagesize=letter, rightMargin=40, leftMargin=40, topMargin=40, bottomMargin=40)
        story = []
        
        styles = getSampleStyleSheet()
        title_style = ParagraphStyle(
            'ShortTitle', parent=styles['Normal'], fontName='AmiriBold', fontSize=20, leading=26, alignment=1
        )
        subtitle_style = ParagraphStyle(
            'ShortSub', parent=styles['Normal'], fontName='Amiri', fontSize=11, leading=16, alignment=1, textColor=colors.HexColor('#4b5563')
        )
        header_style = ParagraphStyle(
            'ShortHead', parent=styles['Normal'], fontName='AmiriBold', fontSize=10, leading=14, alignment=1
        )
        cell_style = ParagraphStyle(
            'ShortCell', parent=styles['Normal'], fontName='Amiri', fontSize=9, leading=13, alignment=1
        )
        cell_right = ParagraphStyle(
            'ShortCellRight', parent=cell_style, alignment=2
        )
        
        story.append(Spacer(1, 10))
        story.append(Paragraph(shape("تقرير نواقص المخزن والبضائع المنتهية"), title_style))
        story.append(Spacer(1, 4))
        story.append(Paragraph(shape(f"تاريخ التقرير: {datetime.datetime.now().strftime('%Y-%m-%d %H:%M')}"), subtitle_style))
        story.append(Spacer(1, 20))
        
        headers = [
            Paragraph(shape("حالة النقص"), header_style),
            Paragraph(shape("الكمية المتبقية"), header_style),
            Paragraph(shape("النوع"), header_style),
            Paragraph(shape("اسم البضاعة"), header_style),
            Paragraph(shape("الماركة"), header_style)
        ]
        
        table_data = [headers]
        type_labels = {
            models.ProductType.PHONE: "📱 هاتف",
            models.ProductType.ACCESSORY: "🔌 إكسسوار",
            models.ProductType.MAINTENANCE: "🔧 صيانة"
        }
        
        for brand, name, qty, p_type in shortages:
            status_desc = "🔴 نافذ تماماً" if qty == 0 else "🟡 متبقي قليل"
            table_data.append([
                Paragraph(shape(status_desc), cell_style),
                Paragraph(shape(str(qty)), cell_style),
                Paragraph(shape(type_labels.get(p_type, "بضاعة")), cell_style),
                Paragraph(shape(name), cell_right),
                Paragraph(shape(brand or "-"), cell_right),
            ])
            
        if len(table_data) == 1:
            table_data.append([Paragraph(shape("لا توجد نواقص في المخزن حالياً"), cell_style)] * 5)
            
        short_table = Table(table_data, colWidths=[100, 80, 80, 170, 100])
        style_cmds = [
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#f3f4f6')),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#d1d5db')),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
            ('TOPPADDING', (0, 0), (-1, -1), 6),
        ]
        for i in range(1, len(table_data)):
            if i % 2 == 0:
                style_cmds.append(('BACKGROUND', (0, i), (-1, i), colors.HexColor('#f9fafb')))
        short_table.setStyle(TableStyle(style_cmds))
        story.append(short_table)
        doc.build(story)
    finally:
        db.close()


def generate_maintenance_report_pdf(pdf_path):
    from app.database import SessionLocal
    from app import models
    
    db = SessionLocal()
    try:
        ready_jobs = db.query(models.MaintenanceJob).filter(
            models.MaintenanceJob.status == "Repaired"
        ).order_by(models.MaintenanceJob.created_at.desc()).all()
        
        doc = SimpleDocTemplate(pdf_path, pagesize=letter, rightMargin=40, leftMargin=40, topMargin=40, bottomMargin=40)
        story = []
        
        styles = getSampleStyleSheet()
        title_style = ParagraphStyle(
            'MaintTitle', parent=styles['Normal'], fontName='AmiriBold', fontSize=20, leading=26, alignment=1
        )
        subtitle_style = ParagraphStyle(
            'MaintSub', parent=styles['Normal'], fontName='Amiri', fontSize=11, leading=16, alignment=1, textColor=colors.HexColor('#4b5563')
        )
        header_style = ParagraphStyle(
            'MaintHead', parent=styles['Normal'], fontName='AmiriBold', fontSize=10, leading=14, alignment=1
        )
        cell_style = ParagraphStyle(
            'MaintCell', parent=styles['Normal'], fontName='Amiri', fontSize=9, leading=13, alignment=1
        )
        cell_right = ParagraphStyle(
            'MaintCellRight', parent=cell_style, alignment=2
        )
        
        story.append(Spacer(1, 10))
        story.append(Paragraph(shape("كشف أجهزة الصيانة الجاهزة للاستلام"), title_style))
        story.append(Spacer(1, 4))
        story.append(Paragraph(shape(f"تاريخ التقرير: {datetime.datetime.now().strftime('%Y-%m-%d %H:%M')}"), subtitle_style))
        story.append(Spacer(1, 20))
        
        headers = [
            Paragraph(shape("كلفة الصيانة"), header_style),
            Paragraph(shape("العطل / المشكلة"), header_style),
            Paragraph(shape("موديل الجهاز"), header_style),
            Paragraph(shape("رقم الهاتف"), header_style),
            Paragraph(shape("اسم الزبون"), header_style)
        ]
        
        table_data = [headers]
        for job in ready_jobs:
            cost_val = f"{float(job.cost):,.0f} د.ع" if job.cost else "غير محدد"
            table_data.append([
                Paragraph(shape(cost_val), cell_style),
                Paragraph(shape(job.problem_description or "-"), cell_right),
                Paragraph(shape(job.device_model or "-"), cell_right),
                Paragraph(shape(job.customer_phone or "-"), cell_style),
                Paragraph(shape(job.customer_name), cell_right),
            ])
            
        if len(table_data) == 1:
            table_data.append([Paragraph(shape("لا توجد أجهزة جاهزة للاستلام حالياً"), cell_style)] * 5)
            
        maint_table = Table(table_data, colWidths=[100, 130, 110, 90, 100])
        style_cmds = [
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#f3f4f6')),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#d1d5db')),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
            ('TOPPADDING', (0, 0), (-1, -1), 6),
        ]
        for i in range(1, len(table_data)):
            if i % 2 == 0:
                style_cmds.append(('BACKGROUND', (0, i), (-1, i), colors.HexColor('#f9fafb')))
        maint_table.setStyle(TableStyle(style_cmds))
        story.append(maint_table)
        doc.build(story)
    finally:
        db.close()


def generate_customer_statement_pdf(customer_id, pdf_path):
    from app.database import SessionLocal
    from app import models
    from app.crud import calculate_customer_debt, get_customer_history, get_customer_payments
    
    db = SessionLocal()
    try:
        import uuid
        target_id = uuid.UUID(customer_id) if isinstance(customer_id, str) else customer_id
        customer = db.query(models.Customer).filter(models.Customer.id == target_id).first()
        if not customer:
            raise Exception("Customer not found")
            
        current_debt = calculate_customer_debt(db, customer)
        _, sales, maintenance = get_customer_history(db, target_id)
        payments = get_customer_payments(db, target_id)
        
        # Combine all items into chronological list
        entries = []
        
        # Initial Debt Entry
        entries.append({
            "date": customer.created_at or datetime.datetime.now(),
            "desc": "الدين السابق المستحق (الرصيد الافتتاحي)",
            "debit": float(customer.initial_debt or 0),
            "credit": 0.0,
        })
        
        # Sales Entries
        cust_name_clean = customer.name.strip().lower()
        for sale in sales:
            if sale.payment_method == models.PaymentMethod.CREDIT:
                items_desc = []
                for item in sale.items:
                    if item.product:
                        items_desc.append(f"{item.product.brand} {item.product.name}" if item.product.brand else item.product.name)
                desc = f"فاتورة مبيعات بالآجل (تفاصيل: {', '.join(items_desc)})" if items_desc else "فاتورة مبيعات بالآجل"
                entries.append({
                    "date": sale.sale_date,
                    "desc": desc,
                    "debit": float(sale.total_amount),
                    "credit": 0.0
                })
                
        # Payments
        for pay in payments:
            desc = f"دفعة تسديد نقداً {f'({pay.notes})' if pay.notes else ''}"
            entries.append({
                "date": pay.payment_date,
                "desc": desc,
                "debit": 0.0,
                "credit": float(pay.amount)
            })
            
        # Sort chronologically
        entries.sort(key=lambda x: x["date"])
        
        # Calculate running balance
        running_bal = 0.0
        for entry in entries:
            running_bal += entry["debit"] - entry["credit"]
            entry["balance"] = running_bal
            
        # Build Document
        doc = SimpleDocTemplate(pdf_path, pagesize=letter, rightMargin=40, leftMargin=40, topMargin=40, bottomMargin=40)
        story = []
        
        styles = getSampleStyleSheet()
        title_style = ParagraphStyle(
            'CustTitle', parent=styles['Normal'], fontName='AmiriBold', fontSize=18, leading=24, alignment=1
        )
        subtitle_style = ParagraphStyle(
            'CustSub', parent=styles['Normal'], fontName='Amiri', fontSize=10, leading=15, alignment=1, textColor=colors.HexColor('#4b5563')
        )
        info_style = ParagraphStyle(
            'CustInfo', parent=styles['Normal'], fontName='Amiri', fontSize=10, leading=15, alignment=2
        )
        header_style = ParagraphStyle(
            'CustHead', parent=styles['Normal'], fontName='AmiriBold', fontSize=10, leading=14, alignment=1
        )
        cell_style = ParagraphStyle(
            'CustCell', parent=styles['Normal'], fontName='Amiri', fontSize=9, leading=13, alignment=1
        )
        cell_right = ParagraphStyle(
            'CustCellRight', parent=cell_style, alignment=2
        )
        
        # Header Info
        story.append(Spacer(1, 10))
        story.append(Paragraph(shape("كشف حساب الزبون تفصيلي"), title_style))
        story.append(Spacer(1, 4))
        story.append(Paragraph(shape(f"تاريخ الطباعة: {datetime.datetime.now().strftime('%Y-%m-%d %H:%M')}"), subtitle_style))
        story.append(Spacer(1, 15))
        
        # Customer metadata block
        meta_html = (
            f"👤 <b>الاسم:</b> {customer.name} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; "
            f"📞 <b>الهاتف:</b> {customer.phone or 'غير مسجل'} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; "
            f"💰 <b>الدين الحالي المتبقي:</b> {int(current_debt):,} د.ع"
        )
        story.append(Paragraph(shape(meta_html), info_style))
        story.append(Spacer(1, 15))
        
        # Statement Table Headers
        headers = [
            Paragraph(shape("الرصيد المتبقي"), header_style),
            Paragraph(shape("واصل (له)"), header_style),
            Paragraph(shape("مطلوب (عليه)"), header_style),
            Paragraph(shape("تفاصيل العملية"), header_style),
            Paragraph(shape("التاريخ"), header_style),
        ]
        
        table_data = [headers]
        for e in entries:
            date_str = e["date"].strftime("%Y-%m-%d") if isinstance(e["date"], datetime.datetime) else str(e["date"])[:10]
            table_data.append([
                Paragraph(shape(f"{int(e['balance']):,} د.ع"), cell_style),
                Paragraph(shape(f"{int(e['credit']):,} د.ع" if e["credit"] > 0 else "-"), cell_style),
                Paragraph(shape(f"{int(e['debit']):,} د.ع" if e["debit"] > 0 else "-"), cell_style),
                Paragraph(shape(e["desc"]), cell_right),
                Paragraph(shape(date_str), cell_style),
            ])
            
        statement_table = Table(table_data, colWidths=[100, 95, 95, 160, 80])
        style_cmds = [
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#f3f4f6')),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#d1d5db')),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
            ('TOPPADDING', (0, 0), (-1, -1), 6),
        ]
        for i in range(1, len(table_data)):
            if i % 2 == 0:
                style_cmds.append(('BACKGROUND', (0, i), (-1, i), colors.HexColor('#f9fafb')))
        statement_table.setStyle(TableStyle(style_cmds))
        story.append(statement_table)
        
        # Final Summary Footer
        story.append(Spacer(1, 20))
        sum_style = ParagraphStyle('CustSum', parent=info_style, fontName='AmiriBold', fontSize=11)
        story.append(Paragraph(shape(f"صافي الحساب المستحق بذمة الزبون النهائي: {int(current_debt):,} د.ع"), sum_style))
        
        doc.build(story)
    finally:
        db.close()

