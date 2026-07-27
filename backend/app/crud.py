from sqlalchemy.orm import Session
from . import models, schemas
from uuid import UUID
from fastapi import HTTPException, status

# Account Operations
def create_account(db: Session, account: schemas.AccountCreate):
    # Check if code already exists
    db_account = db.query(models.Account).filter(models.Account.code == account.code).first()
    if db_account:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Account code already exists"
        )
    
    # Check parent_id if provided
    if account.parent_id:
        parent = db.query(models.Account).filter(models.Account.id == account.parent_id).first()
        if not parent:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Parent account not found"
            )
            
    db_obj = models.Account(**account.model_dump())
    db.add(db_obj)
    db.commit()
    db.refresh(db_obj)
    return db_obj

def get_accounts(db: Session, skip: int = 0, limit: int = 100):
    return db.query(models.Account).offset(skip).limit(limit).all()

def get_account(db: Session, account_id: UUID):
    return db.query(models.Account).filter(models.Account.id == account_id).first()

# Journal Entry Operations
def create_journal_entry(db: Session, entry: schemas.JournalEntryCreate):
    # Verify all account_ids exist
    for item in entry.items:
        acc = db.query(models.Account).filter(models.Account.id == item.account_id).first()
        if not acc:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Account with ID {item.account_id} not found."
            )

    db_entry = models.JournalEntry(
        entry_date=entry.entry_date,
        reference=entry.reference,
        description=entry.description,
        state=entry.state
    )
    db.add(db_entry)
    db.flush()  # to get entry id

    for item in entry.items:
        db_item = models.JournalItem(
            entry_id=db_entry.id,
            account_id=item.account_id,
            debit=item.debit,
            credit=item.credit,
            description=item.description
        )
        db.add(db_item)
    
    db.commit()
    db.refresh(db_entry)
    return db_entry

def get_journal_entries(db: Session, skip: int = 0, limit: int = 100):
    return db.query(models.JournalEntry).offset(skip).limit(limit).all()

def get_journal_entry(db: Session, entry_id: UUID):
    return db.query(models.JournalEntry).filter(models.JournalEntry.id == entry_id).first()

# Helper to get or create account
def _get_or_create_account(db: Session, code: str, name: str, type: models.AccountType):
    acc = db.query(models.Account).filter(models.Account.code == code).first()
    if not acc:
        acc = models.Account(code=code, name=name, type=type)
        db.add(acc)
        db.commit()
        db.refresh(acc)
    return acc

# Product Operations
def create_product(db: Session, product_in: schemas.ProductCreate):
    # 1. Create Product
    db_product = models.Product(
        name=product_in.name,
        brand=product_in.brand,
        type=product_in.type,
        purchase_price=product_in.purchase_price,
        selling_price=product_in.selling_price
    )
    db.add(db_product)
    db.flush()

    # 2. Add inventory items if IMEIs are provided
    items_count = 0
    if product_in.imeis and product_in.type == models.ProductType.PHONE:
        for imei in product_in.imeis:
            # Check unique IMEI
            existing = db.query(models.InventoryItem).filter(models.InventoryItem.imei == imei).first()
            if existing:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"IMEI {imei} already exists in inventory."
                )
            db_item = models.InventoryItem(
                product_id=db_product.id,
                imei=imei,
                status=models.InventoryStatus.AVAILABLE,
                battery_health=product_in.battery_health
            )
            db.add(db_item)
        items_count = len(product_in.imeis)
    elif product_in.type in [models.ProductType.ACCESSORY, models.ProductType.MAINTENANCE]:
        # Create user-specified quantity of items in stock
        qty = product_in.quantity or 1
        for _ in range(qty):
            db_item = models.InventoryItem(
                product_id=db_product.id,
                imei=None,
                status=models.InventoryStatus.AVAILABLE
            )
            db.add(db_item)
        items_count = qty


    # 3. Automatic Accounting Integration
    # If there is a purchase cost, record a journal entry
    total_cost = db_product.purchase_price * items_count
    if total_cost > 0:
        # Ensure Accounts exist
        inv_account = _get_or_create_account(db, "1200", "Inventory (المخزون)", models.AccountType.ASSET)
        cash_account = _get_or_create_account(db, "1010", "Cash (الصندوق)", models.AccountType.ASSET)

        db_entry = models.JournalEntry(
            reference=f"PUR-{db_product.name[:10].upper()}",
            description=f"Auto Purchase: {items_count}x {db_product.brand} {db_product.name}",
            state=models.EntryState.POSTED
        )
        db.add(db_entry)
        db.flush()

        # Debit Inventory
        item_debit = models.JournalItem(
            entry_id=db_entry.id,
            account_id=inv_account.id,
            debit=total_cost,
            credit=0.00,
            description="Stock addition cost"
        )
        # Credit Cash
        item_credit = models.JournalItem(
            entry_id=db_entry.id,
            account_id=cash_account.id,
            debit=0.00,
            credit=total_cost,
            description="Cash paid for stock purchase"
        )
        db.add(item_debit)
        db.add(item_credit)

    db.commit()
    db.refresh(db_product)
    return db_product

def get_products(db: Session, skip: int = 0, limit: int = 100):
    return db.query(models.Product).offset(skip).limit(limit).all()

def get_inventory_items(db: Session, skip: int = 0, limit: int = 100):
    return db.query(models.InventoryItem).offset(skip).limit(limit).all()

# Sale Operations
def create_sale(db: Session, sale_in: schemas.SaleCreate):
    # 1. Create Sale
    db_sale = models.Sale(
        customer_name=sale_in.customer_name,
        payment_method=sale_in.payment_method,
        total_amount=sale_in.total_amount
    )
    db.add(db_sale)
    db.flush()

    total_revenue = 0
    total_cost = 0

    for item in sale_in.items:
        # Check product
        product = db.query(models.Product).filter(models.Product.id == item.product_id).first()
        if not product:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Product with ID {item.product_id} not found."
            )

        # Check Entishar Wallet balance first if it is a recharge card
        is_recharge_card = any(kw in product.name for kw in ["كارت", "بطاقة", "شدات", "رصيد", "آسيا سيل", "زين عراق", "كورك", "فري فاير", "Free Fire", "ببجي", "PUBG"])
        if is_recharge_card:
            from sqlalchemy import text
            res_bal = db.execute(text("SELECT value FROM system_settings WHERE key = 'entishar_balance'")).fetchone()
            current_bal = float(res_bal[0]) if (res_bal and res_bal[0]) else 0.0
            if current_bal < float(product.purchase_price):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"❌ رصيد محفظة انتشار غير كافي! الرصيد الحالي: {int(current_bal):,} د.ع، بينما سعر شراء الكارت: {int(product.purchase_price):,} د.ع."
                )

        # Handle IMEI / Serialised physical item if provided
        selected_inv_item_id = item.inventory_item_id
        if is_recharge_card:
            # Recharge cards do not have physical inventory items
            selected_inv_item_id = None
        elif item.inventory_item_id:
            inv_item = db.query(models.InventoryItem).filter(models.InventoryItem.id == item.inventory_item_id).first()
            if not inv_item or inv_item.status != models.InventoryStatus.AVAILABLE:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Inventory item {item.inventory_item_id} is not available for sale."
                )
            # Mark status as SOLD
            inv_item.status = models.InventoryStatus.SOLD
        else:
            # For non-serialized items (Accessories/Maintenance), find first available stock item and sell it
            inv_item = db.query(models.InventoryItem).filter(
                models.InventoryItem.product_id == item.product_id,
                models.InventoryItem.status == models.InventoryStatus.AVAILABLE
            ).first()
            if not inv_item:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"نفذت الكمية! لا يوجد مخزون كافي لـ {product.brand} - {product.name}."
                )
            inv_item.status = models.InventoryStatus.SOLD
            selected_inv_item_id = inv_item.id
        
        # Create SaleItem record
        db_item = models.SaleItem(
            sale_id=db_sale.id,
            product_id=item.product_id,
            inventory_item_id=selected_inv_item_id,
            price=item.price
        )
        db.add(db_item)

        total_revenue += item.price
        total_cost += product.purchase_price

        # Check if the product name indicates it is a virtual recharge/gaming card
        is_recharge_card = any(kw in product.name for kw in ["كارت", "بطاقة", "شدات", "رصيد"])
        if is_recharge_card:
            # Deduct card purchase_price from Entishar wallet balance key inside system_settings
            from sqlalchemy import text
            try:
                # Select balance
                res = db.execute(text("SELECT value FROM system_settings WHERE key = 'entishar_balance'")).fetchone()
                current_bal = float(res[0]) if (res and res[0]) else 0.0
                # Subtract purchase price of the card
                new_bal = max(0.0, current_bal - float(product.purchase_price))
                # Update settings
                db.execute(
                    text("UPDATE system_settings SET value = :value WHERE key = 'entishar_balance'"),
                    {"value": str(new_bal)}
                )
                # If we don't have entishar_balance key at all, create it
                if not res:
                    db.execute(
                        text("INSERT INTO system_settings (key, value) VALUES ('entishar_balance', :value)"),
                        {"value": str(new_bal)}
                    )

                # Check if balance fell below or equal to 100,000 IQD, then send warning
                if new_bal <= 100000.0:
                    alert_msg = (
                        f"⚠️ *تنبيه رصيد محفظة انتشار منخفض!*\n"
                        f"━━━━━━━━━━━━━━━━━━━━━\n"
                        f"📉 *الرصيد المتبقي:* {int(new_bal):,} د.ع\n"
                        f"يرجى شحن محفظة انتشار لتجنب توقف مبيعات الكروت السريعة."
                    )
                    # Send telegram warning
                    try:
                        token_setting = db.query(models.SystemSetting).filter_by(key='telegram_token').first()
                        if token_setting and token_setting.value:
                            token = token_setting.value.strip()
                            if token and token != "YOUR_TOKEN_HERE":
                                import os as _os
                                current_dir = _os.path.dirname(_os.path.realpath(__file__))
                                chats_file = _os.path.join(current_dir, "registered_chats.txt")
                                if _os.path.exists(chats_file):
                                    with open(chats_file, "r") as f:
                                        chat_ids = [line.strip() for line in f.readlines() if line.strip()]
                                    
                                    import requests as _req
                                    api_url = f"https://api.telegram.org/bot{token}/sendMessage"
                                    for chat_id in chat_ids:
                                        _req.post(api_url, json={
                                            "chat_id": chat_id,
                                            "text": alert_msg,
                                            "parse_mode": "Markdown"
                                        }, timeout=5)
                    except Exception as te:
                        print(f"Telegram low-balance warning error: {te}")

                    # Send WhatsApp warning to Owner
                    try:
                        settings = get_shop_settings(db)
                        if settings and settings.phone and settings.phone.strip():
                            import requests as _req
                            owner_phone = settings.phone.strip()
                            _req.post(
                                "http://127.0.0.1:8001/send",
                                json={"phone": owner_phone, "message": alert_msg},
                                timeout=5
                            )
                    except Exception as we:
                        print(f"WhatsApp low-balance warning error: {we}")
            except Exception as e:
                print(f"Error updating Entishar balance during sale: {e}")

    # Update total amount to match actual items sum
    db_sale.total_amount = total_revenue

    # 2. Automated Accounting
    if total_revenue > 0:
        # Get Accounts
        cash_account = _get_or_create_account(db, "1010", "Cash (الصندوق)", models.AccountType.ASSET)
        ar_account = _get_or_create_account(db, "1100", "Accounts Receivable (العملاء)", models.AccountType.ASSET)
        rev_account = _get_or_create_account(db, "4010", "Sales Revenue (إيراد المبيعات)", models.AccountType.REVENUE)
        cogs_account = _get_or_create_account(db, "5010", "Cost of Goods Sold (تكلفة المبيعات)", models.AccountType.EXPENSE)
        inv_account = _get_or_create_account(db, "1200", "Inventory (المخزون)", models.AccountType.ASSET)

        # --- Entry 1: Revenue & Cash Receipt ---
        db_entry_rev = models.JournalEntry(
            reference=f"SAL-{str(db_sale.id)[:8].upper()}",
            description=f"Sales Invoice for {sale_in.customer_name or 'Walk-in Customer'}",
            state=models.EntryState.POSTED
        )
        db.add(db_entry_rev)
        db.flush()

        # Debit Cash or Accounts Receivable
        recv_account_id = cash_account.id if sale_in.payment_method == models.PaymentMethod.CASH else ar_account.id
        db.add(models.JournalItem(
            entry_id=db_entry_rev.id,
            account_id=recv_account_id,
            debit=total_revenue,
            credit=0.00,
            description="Sales collection"
        ))
        # Credit Revenue
        db.add(models.JournalItem(
            entry_id=db_entry_rev.id,
            account_id=rev_account.id,
            debit=0.00,
            credit=total_revenue,
            description="Revenue recognition"
        ))

        # --- Entry 2: Cost of Goods Sold (COGS) ---
        if total_cost > 0:
            db_entry_cogs = models.JournalEntry(
                reference=f"COG-{str(db_sale.id)[:8].upper()}",
                description=f"COGS for Sale Invoice {str(db_sale.id)[:8].upper()}",
                state=models.EntryState.POSTED
            )
            db.add(db_entry_cogs)
            db.flush()

            # Debit COGS (Expense)
            db.add(models.JournalItem(
                entry_id=db_entry_cogs.id,
                account_id=cogs_account.id,
                debit=total_cost,
                credit=0.00,
                description="Cost of goods sold"
            ))
            # Credit Inventory (Asset)
            db.add(models.JournalItem(
                entry_id=db_entry_cogs.id,
                account_id=inv_account.id,
                debit=0.00,
                credit=total_cost,
                description="Inventory reduction"
            ))

    db.commit()
    db.refresh(db_sale)
    return db_sale

def get_sales(db: Session, skip: int = 0, limit: int = 100):
    return db.query(models.Sale).offset(skip).limit(limit).all()

def refund_sale(db: Session, sale_id: str):
    from uuid import UUID
    from fastapi import HTTPException, status
    sale_uuid = UUID(sale_id) if isinstance(sale_id, str) else sale_id
    sale = db.query(models.Sale).filter(models.Sale.id == sale_uuid).first()
    if not sale:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="فاتورة المبيعات غير موجودة.")
    
    # Check if already refunded (you can check if related entries contain a refund entry)
    # To keep it simple and robust, let's reverse items back to AVAILABLE and post a reversing journal entry.
    total_rev = float(sale.total_amount)
    total_cost = 0.0
    
    for item in sale.items:
        # Check if physical inventory item was sold, restore it to AVAILABLE
        if item.inventory_item_id:
            inv_item = db.query(models.InventoryItem).filter(models.InventoryItem.id == item.inventory_item_id).first()
            if inv_item:
                inv_item.status = models.InventoryStatus.AVAILABLE
                
        # Calculate cost for reversing COGS
        if item.product:
            total_cost += float(item.product.purchase_price)
            
            # Check if this item is a recharge card (restore Entishar Balance)
            is_recharge = any(kw in item.product.name for kw in ["كارت", "بطاقة", "شدات", "رصيد", "آسيا سيل", "زين عراق", "كورك", "فري فاير", "Free Fire", "ببجي", "PUBG"])
            if is_recharge:
                from sqlalchemy import text
                try:
                    res = db.execute(text("SELECT value FROM system_settings WHERE key = 'entishar_balance'")).fetchone()
                    current_bal = float(res[0]) if (res and res[0]) else 0.0
                    new_bal = current_bal + float(item.product.purchase_price)
                    db.execute(
                        text("UPDATE system_settings SET value = :value WHERE key = 'entishar_balance'"),
                        {"value": str(new_bal)}
                    )
                    if not res:
                        db.execute(
                            text("INSERT INTO system_settings (key, value) VALUES ('entishar_balance', :value)"),
                            {"value": str(new_bal)}
                        )
                except Exception as e:
                    print(f"Error restoring Entishar balance during refund: {e}")
                    
    # Generate reversing Accounting Entry
    if total_rev > 0:
        cash_account = _get_or_create_account(db, "1010", "Cash (الصندوق)", models.AccountType.ASSET)
        ar_account = _get_or_create_account(db, "1100", "Accounts Receivable (العملاء)", models.AccountType.ASSET)
        rev_account = _get_or_create_account(db, "4010", "Sales Revenue (إيراد المبيعات)", models.AccountType.REVENUE)
        cogs_account = _get_or_create_account(db, "5010", "Cost of Goods Sold (تكلفة المبيعات)", models.AccountType.EXPENSE)
        inv_account = _get_or_create_account(db, "1200", "Inventory (المخزون)", models.AccountType.ASSET)
        
        # Reverse Revenue (Debit Sales Revenue, Credit Cash/AR)
        db_entry_rev = models.JournalEntry(
            reference=f"REF-{str(sale.id)[:8].upper()}",
            description=f"Refund Invoice for {sale.customer_name or 'Walk-in Customer'}",
            state=models.EntryState.POSTED
        )
        db.add(db_entry_rev)
        db.flush()
        
        # Debit Revenue (reverses Credit Revenue)
        db.add(models.JournalItem(
            entry_id=db_entry_rev.id,
            account_id=rev_account.id,
            debit=total_rev,
            credit=0.00,
            description="Revenue refund"
        ))
        # Credit Cash or AR (reverses Debit Cash/AR)
        recv_account_id = cash_account.id if sale.payment_method == models.PaymentMethod.CASH else ar_account.id
        db.add(models.JournalItem(
            entry_id=db_entry_rev.id,
            account_id=recv_account_id,
            debit=0.00,
            credit=total_rev,
            description="Sales collection refund"
        ))
        
        # Reverse COGS (Debit Inventory, Credit COGS)
        if total_cost > 0:
            db_entry_cogs = models.JournalEntry(
                reference=f"RCO-{str(sale.id)[:8].upper()}",
                description=f"Reversing COGS for Refund Invoice {str(sale.id)[:8].upper()}",
                state=models.EntryState.POSTED
            )
            db.add(db_entry_cogs)
            db.flush()
            
            # Debit Inventory
            db.add(models.JournalItem(
                entry_id=db_entry_cogs.id,
                account_id=inv_account.id,
                debit=total_cost,
                credit=0.00,
                description="Inventory return"
            ))
            # Credit COGS
            db.add(models.JournalItem(
                entry_id=db_entry_cogs.id,
                account_id=cogs_account.id,
                debit=0.00,
                credit=total_cost,
                description="Cost of goods sold reversal"
            ))
            
    # Delete the sale record itself (to prevent double refunds and clear from sales lists)
    db.delete(sale)
    db.commit()
    return {"status": "success", "message": "تم استرجاع الفاتورة بالكامل وإعادة المواد والمال."}


def create_maintenance_job(db: Session, job: schemas.MaintenanceJobCreate):
    db_job = models.MaintenanceJob(
        customer_name=job.customer_name,
        customer_phone=job.customer_phone,
        device_model=job.device_model,
        imei=job.imei,
        problem_description=job.problem_description,
        cost=job.cost,
        status=job.status,
        warranty_days=job.warranty_days,
        used_product_id=job.used_product_id
    )
    db.add(db_job)
    db.flush() # get db_job.id

    # Handle multiple spare parts
    if job.used_part_ids:
        for p_id in job.used_part_ids:
            part = models.MaintenancePart(
                maintenance_job_id=db_job.id,
                product_id=p_id
            )
            db.add(part)
            
            # If starting as completed, consume immediately
            if job.status in ["Repaired", "Delivered"]:
                inv_item = db.query(models.InventoryItem).filter(
                    models.InventoryItem.product_id == p_id,
                    models.InventoryItem.status == models.InventoryStatus.AVAILABLE
                ).first()
                if inv_item:
                    inv_item.status = models.InventoryStatus.SOLD

    # Eagerly consume the legacy single used_product_id too if starting as completed
    if job.status in ["Repaired", "Delivered"] and job.used_product_id:
        inv_item = db.query(models.InventoryItem).filter(
            models.InventoryItem.product_id == job.used_product_id,
            models.InventoryItem.status == models.InventoryStatus.AVAILABLE
        ).first()
        if inv_item:
            inv_item.status = models.InventoryStatus.SOLD

    db.commit()
    db.refresh(db_job)
    return db_job


def get_maintenance_jobs(db: Session, skip: int = 0, limit: int = 100, tenant_id: str = "default"):
    return db.query(models.MaintenanceJob).filter(models.MaintenanceJob.tenant_id == tenant_id).order_by(models.MaintenanceJob.created_at.desc()).offset(skip).limit(limit).all()

def get_all_customers(db: Session, skip: int = 0, limit: int = 200, tenant_id: str = "default"):
    return db.query(models.Customer).filter(models.Customer.tenant_id == tenant_id).order_by(models.Customer.created_at.desc()).offset(skip).limit(limit).all()


def update_maintenance_job(
    db: Session, 
    job_id: str, 
    status: str, 
    cost: float = None, 
    used_product_id: str = None, 
    used_part_ids: list = None,
    customer_name: str = None,
    customer_phone: str = None,
    device_model: str = None,
    imei: str = None,
    problem_description: str = None,
    warranty_days: int = None
):
    from uuid import UUID
    job_uuid = UUID(job_id) if isinstance(job_id, str) else job_id
    db_job = db.query(models.MaintenanceJob).filter(models.MaintenanceJob.id == job_uuid).first()
    if db_job:
        already_delivered = db_job.status == "Delivered"
        was_completed = db_job.status in ["Repaired", "Delivered"]
        
        db_job.status = status
        if cost is not None:
            db_job.cost = cost
        if used_product_id is not None:
            db_job.used_product_id = UUID(used_product_id) if used_product_id else None
            
        if customer_name is not None:
            db_job.customer_name = customer_name
        if customer_phone is not None:
            db_job.customer_phone = customer_phone
        if device_model is not None:
            db_job.device_model = device_model
        if imei is not None:
            db_job.imei = imei
        if problem_description is not None:
            db_job.problem_description = problem_description
        if warranty_days is not None:
            db_job.warranty_days = warranty_days

        # Update multiple parts if provided
        if used_part_ids is not None:
            # Delete old parts associated with this job
            db.query(models.MaintenancePart).filter(models.MaintenancePart.maintenance_job_id == db_job.id).delete()
            # Create new ones
            for p_id in used_part_ids:
                part = models.MaintenancePart(
                    maintenance_job_id=db_job.id,
                    product_id=UUID(p_id) if isinstance(p_id, str) else p_id
                )
                db.add(part)

        # Eagerly consume if transitioning to a completed state
        is_completed = status in ["Repaired", "Delivered"]
        if is_completed and not was_completed:
            # Consume legacy single product
            if db_job.used_product_id:
                inv_item = db.query(models.InventoryItem).filter(
                    models.InventoryItem.product_id == db_job.used_product_id,
                    models.InventoryItem.status == models.InventoryStatus.AVAILABLE
                ).first()
                if inv_item:
                    inv_item.status = models.InventoryStatus.SOLD
            # Consume new multiple parts
            for part in db_job.parts:
                inv_item = db.query(models.InventoryItem).filter(
                    models.InventoryItem.product_id == part.product_id,
                    models.InventoryItem.status == models.InventoryStatus.AVAILABLE
                ).first()
                if inv_item:
                    inv_item.status = models.InventoryStatus.SOLD
        
        if status == "Delivered" and not already_delivered and db_job.cost > 0:
            cash_account = _get_or_create_account(db, "1010", "Cash (الصندوق)", models.AccountType.ASSET)
            rev_account = _get_or_create_account(db, "4010", "Sales Revenue (إيراد المبيعات)", models.AccountType.REVENUE)
            
            db_entry = models.JournalEntry(
                reference=f"MNT-{str(db_job.id)[:8].upper()}",
                description=f"Maintenance Delivery for {db_job.customer_name} ({db_job.device_model})",
                state=models.EntryState.POSTED
            )
            db.add(db_entry)
            db.flush()
            
            # Debit Cash
            db.add(models.JournalItem(
                entry_id=db_entry.id,
                account_id=cash_account.id,
                debit=db_job.cost,
                credit=0.00,
                description="Maintenance collection"
            ))
            # Credit Revenue
            db.add(models.JournalItem(
                entry_id=db_entry.id,
                account_id=rev_account.id,
                debit=0.00,
                credit=db_job.cost,
                description="Maintenance revenue recognition"
            ))
            
        db.commit()
        db.refresh(db_job)
    return db_job


def update_product(db: Session, product_id: str, name: str, brand: str, type: str, purchase_price: float, selling_price: float, quantity: int = None):
    from uuid import UUID
    prod_uuid = UUID(product_id) if isinstance(product_id, str) else product_id
    db_product = db.query(models.Product).filter(models.Product.id == prod_uuid).first()
    if db_product:
        db_product.name = name
        db_product.brand = brand
        db_product.type = type
        db_product.purchase_price = purchase_price
        db_product.selling_price = selling_price

        # Adjust quantity for Accessories and Maintenance parts
        product_type_str = db_product.type.value if hasattr(db_product.type, 'value') else str(db_product.type)
        if quantity is not None and product_type_str.upper() in ["ACCESSORY", "MAINTENANCE"]:
            available_items = []
            for i in db_product.items:
                item_status = i.status.value if hasattr(i.status, 'value') else str(i.status)
                if item_status.upper() == "AVAILABLE":
                    available_items.append(i)
            current_qty = len(available_items)
            if quantity > current_qty:
                # Add new items
                for _ in range(quantity - current_qty):
                    db_item = models.InventoryItem(
                        product_id=db_product.id,
                        imei=None,
                        status=models.InventoryStatus.AVAILABLE
                    )
                    db.add(db_item)
            elif quantity < current_qty:
                # Remove extra available items
                to_remove = current_qty - quantity
                for i in range(to_remove):
                    db.delete(available_items[i])

        db.commit()
        db.refresh(db_product)
        return db_product
    return None


# ─────────────────────────────────────────────────────────
# Customer CRUD
# ─────────────────────────────────────────────────────────

def create_customer_direct(db: Session, name: str, phone: str = None, notes: str = None, initial_debt: float = 0.0, installment_downpayment: float = 0.0, installment_monthly: float = 0.0, tenant_id: str = "default") -> models.Customer:
    clean_name = name.strip() if name else "زبون"
    clean_phone = phone.strip() if (phone and phone.strip()) else None
    
    # Check duplicate name in tenant
    existing = db.query(models.Customer).filter(
        models.Customer.tenant_id == tenant_id,
        models.Customer.name.ilike(clean_name)
    ).first()
    
    if existing:
        if clean_phone and not existing.phone:
            existing.phone = clean_phone
        if notes:
            existing.notes = notes
        existing.initial_debt = initial_debt
        existing.installment_downpayment = installment_downpayment
        existing.installment_monthly = installment_monthly
        return existing

    new_c = models.Customer(
        tenant_id=tenant_id,
        name=clean_name,
        phone=clean_phone,
        notes=notes,
        initial_debt=initial_debt,
        installment_downpayment=installment_downpayment,
        installment_monthly=installment_monthly
    )
    db.add(new_c)
    return new_c


def search_customers(db: Session, query: str, tenant_id: str = "default"):
    """Search customers by name or phone number within tenant."""
    pattern = f"%{query}%"
    return db.query(models.Customer).filter(
        models.Customer.tenant_id == tenant_id,
        (models.Customer.name.ilike(pattern) | models.Customer.phone.ilike(pattern))
    ).all()


def get_customer_history(db: Session, customer_id: str):
    """Get full history for a customer (sales + maintenance)."""
    from sqlalchemy.orm import joinedload
    import uuid

    target_id = uuid.UUID(customer_id) if isinstance(customer_id, str) else customer_id

    customer = db.query(models.Customer).filter(
        models.Customer.id == target_id
    ).first()
    if not customer:
        return None, [], []

    sales = db.query(models.Sale).options(
        joinedload(models.Sale.items).joinedload(models.SaleItem.product)
    ).filter(
        models.Sale.customer_name.ilike(f"%{customer.name}%")
    ).order_by(models.Sale.sale_date.desc()).all()

    maintenance = db.query(models.MaintenanceJob).filter(
        models.MaintenanceJob.customer_name.ilike(f"%{customer.name}%")
    ).order_by(models.MaintenanceJob.created_at.desc()).all()

    return customer, sales, maintenance


def get_all_customers(db: Session, skip: int = 0, limit: int = 200, tenant_id: str = "default"):
    return db.query(models.Customer).filter(
        models.Customer.tenant_id == tenant_id
    ).order_by(models.Customer.created_at.desc()).offset(skip).limit(limit).all()


def update_customer(db: Session, customer_id: str, data: schemas.CustomerUpdate):
    import uuid
    target_id = uuid.UUID(customer_id) if isinstance(customer_id, str) else customer_id
    customer = db.query(models.Customer).filter(models.Customer.id == target_id).first()
    if not customer:
        return None
    if data.name is not None:
        customer.name = data.name
    if data.phone is not None:
        customer.phone = data.phone
    if data.notes is not None:
        customer.notes = data.notes
    if data.initial_debt is not None:
        customer.initial_debt = data.initial_debt
    if data.installment_downpayment is not None:
        customer.installment_downpayment = data.installment_downpayment
    if data.installment_monthly is not None:
        customer.installment_monthly = data.installment_monthly
    db.commit()
    db.refresh(customer)
    return customer


def delete_customer(db: Session, customer_id: str):
    import uuid
    target_id = uuid.UUID(customer_id) if isinstance(customer_id, str) else customer_id
    customer = db.query(models.Customer).filter(models.Customer.id == target_id).first()
    if customer:
        db.delete(customer)
        db.commit()
        return True
    return False


def get_shop_settings(db: Session):
    settings = db.query(models.ShopSettings).filter(models.ShopSettings.id == 1).first()
    if not settings:
        settings = models.ShopSettings(
            id=1,
            shop_name="متجر الموبايل",
            currency="د.ع",
            phone="",
            email="",
            address="",
            footer_note="شكراً لتعاملكم معنا 🙏",
            system_password="123456"
        )
        db.add(settings)
        db.commit()
        db.refresh(settings)
    return settings


def update_shop_settings(db: Session, data: schemas.ShopSettingsBase):
    settings = get_shop_settings(db)
    settings.shop_name = data.shop_name
    settings.currency = data.currency
    settings.phone = data.phone
    settings.email = data.email
    settings.address = data.address
    settings.footer_note = data.footer_note
    settings.system_password = data.system_password
    db.commit()
    db.refresh(settings)
    return settings


# ─────────────────────────────────────────────────────────
# User Authentication CRUD
# ─────────────────────────────────────────────────────────

def hash_password(password: str) -> str:
    import hashlib
    import os
    salt = os.urandom(16)
    key = hashlib.pbkdf2_hmac('sha256', password.encode('utf-8'), salt, 100000)
    return salt.hex() + ":" + key.hex()

def verify_password(stored_password: str, provided_password: str) -> bool:
    import hashlib
    if stored_password == provided_password:
        return True
    try:
        salt_hex, key_hex = stored_password.split(":")
        salt = bytes.fromhex(salt_hex)
        key = bytes.fromhex(key_hex)
        new_key = hashlib.pbkdf2_hmac('sha256', provided_password.encode('utf-8'), salt, 100000)
        return key == new_key
    except Exception:
        return False

def get_user_by_username(db: Session, username: str):
    return db.query(models.User).filter(models.User.username == username.strip().lower()).first()

def create_user(db: Session, user_data: schemas.UserCreate):
    import uuid
    hashed_pwd = hash_password(user_data.password)
    tenant_code = getattr(user_data, 'tenant_id', None)
    if not tenant_code or tenant_code == "default":
        tenant_code = f"tenant_{str(uuid.uuid4())[:8]}"
    
    from datetime import datetime, timedelta
    now = datetime.now()
    trial_end = now + timedelta(days=7)

    clean_phone = user_data.phone.strip() if (user_data.phone and user_data.phone.strip()) else None
    clean_email = user_data.email.strip().lower() if (user_data.email and user_data.email.strip()) else None

    db_user = models.User(
        username=user_data.username.strip().lower(),
        hashed_password=hashed_pwd,
        role=user_data.role or "user",
        tenant_id=tenant_code,
        shop_name=getattr(user_data, 'shop_name', 'متجر الموبايل') or 'متجر الموبايل',
        is_super_admin=getattr(user_data, 'is_super_admin', 0),
        subscription_start=now,
        subscription_end=trial_end,
        is_active=1,
        phone=clean_phone,
        email=clean_email
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user


def calculate_customer_debt(db: Session, customer: models.Customer) -> float:
    # 1. Start with initial debt
    total_debt = float(customer.initial_debt or 0.0)

    # 2. Add all credit sales (exact match on stripped customer name)
    cust_name_clean = customer.name.strip().lower()
    credit_sales = db.query(models.Sale).filter(
        models.Sale.payment_method == models.PaymentMethod.CREDIT
    ).all()
    for sale in credit_sales:
        if sale.customer_name and sale.customer_name.strip().lower() == cust_name_clean:
            total_debt += float(sale.total_amount)

    # 3. Subtract all instalments/payments
    payments = db.query(models.CustomerPayment).filter(
        models.CustomerPayment.customer_id == customer.id
    ).all()
    for payment in payments:
        total_debt -= float(payment.amount)

    return total_debt


def get_customer_payments(db: Session, customer_id: str):
    import uuid
    target_id = uuid.UUID(customer_id) if isinstance(customer_id, str) else customer_id
    return db.query(models.CustomerPayment).filter(
        models.CustomerPayment.customer_id == target_id
    ).order_by(models.CustomerPayment.payment_date.desc()).all()


def create_customer_payment(db: Session, customer_id: str, amount: float, notes: str = None, payment_date = None):
    import uuid
    from datetime import datetime
    target_id = uuid.UUID(customer_id) if isinstance(customer_id, str) else customer_id
    db_payment = models.CustomerPayment(
        customer_id=target_id,
        amount=amount,
        notes=notes,
        payment_date=payment_date if payment_date else datetime.now()
    )
    db.add(db_payment)
    db.flush()

    # Create manual double-entry accounting record for payments (Debit Cash / Credit Accounts Receivable)
    # Cash account
    cash_account = _get_or_create_account(db, "1010", "Cash (الصندوق)", models.AccountType.ASSET)
    # Accounts Receivable account (ذمم مدينة)
    ar_account = _get_or_create_account(db, "1220", "Accounts Receivable (الذمم المدينة/الديون)", models.AccountType.ASSET)

    customer = db.query(models.Customer).filter(models.Customer.id == target_id).first()
    cust_name = customer.name if customer else "زبون"

    db_entry = models.JournalEntry(
        reference=f"PAY-{db_payment.id.hex[:6]}",
        description=f"دفعة تسديد دين من الزبون: {cust_name}",
        state=models.EntryState.POSTED
    )
    db.add(db_entry)
    db.flush()

    # Debit Cash (increase cash assets)
    db.add(models.JournalItem(
        entry_id=db_entry.id,
        account_id=cash_account.id,
        debit=amount,
        credit=0.00,
        description=f"تسديد دين - {cust_name}"
    ))

    # Credit Accounts Receivable (decrease receivable assets)
    db.add(models.JournalItem(
        entry_id=db_entry.id,
        account_id=ar_account.id,
        debit=0.00,
        credit=amount,
        description=f"تسديد دين - {cust_name}"
    ))

    db.commit()
    db.refresh(db_payment)

    # ─────────────────────────────────────────────────────────
    # Send payment notifications to Owner (Telegram & WhatsApp)
    # ─────────────────────────────────────────────────────────
    try:
        new_debt = calculate_customer_debt(db, customer)
        amount_fmt = f"{int(amount):,} د.ع"
        debt_fmt = f"{int(new_debt):,} د.ع"
        
        # Message content
        msg = (
            f"💸 *إشعار تسديد دفعة جديدة*\n"
            f"━━━━━━━━━━━━━━━━━━━━━\n"
            f"👤 *الزبون:* {cust_name}\n"
            f"💵 *المبلغ المسدد:* {amount_fmt}\n"
            f"📉 *الدين المتبقي للزبون:* {debt_fmt}\n"
            f"📝 *ملاحظات:* {notes or 'بدون'}\n"
            f"📅 *التاريخ:* {db_payment.payment_date.strftime('%Y-%m-%d %H:%M')}"
        )

        # 1. Telegram Dispatch
        try:
            token_setting = db.query(models.SystemSetting).filter_by(key='telegram_token').first()
            if token_setting and token_setting.value:
                token = token_setting.value.strip()
                if token and token != "YOUR_TOKEN_HERE":
                    import os as _os
                    current_dir = _os.path.dirname(_os.path.realpath(__file__))
                    chats_file = _os.path.join(current_dir, "registered_chats.txt")
                    if _os.path.exists(chats_file):
                        with open(chats_file, "r") as f:
                            chat_ids = [line.strip() for line in f.readlines() if line.strip()]
                        
                        import requests as _req
                        api_url = f"https://api.telegram.org/bot{token}/sendMessage"
                        for chat_id in chat_ids:
                            try:
                                _req.post(api_url, json={
                                    "chat_id": chat_id,
                                    "text": msg,
                                    "parse_mode": "Markdown"
                                }, timeout=5)
                            except Exception:
                                pass
        except Exception as te:
            print(f"Telegram notification error: {te}")

        # 2. WhatsApp Dispatch to Owner (reads shop_settings -> phone)
        try:
            settings = get_shop_settings(db)
            if settings and settings.phone and settings.phone.strip():
                import requests as _req
                owner_phone = settings.phone.strip()
                _req.post(
                    "http://127.0.0.1:8001/send",
                    json={"phone": owner_phone, "message": msg},
                    timeout=5
                )
        except Exception as we:
            print(f"WhatsApp notification to owner error: {we}")

        # 3. WhatsApp Dispatch to the CUSTOMER directly (Only if customer phone is different from owner phone)
        try:
            if customer and customer.phone and customer.phone.strip():
                import requests as _req
                cust_phone = customer.phone.strip()
                owner_phone = settings.phone.strip() if (settings and settings.phone) else ""
                
                import re as _re
                clean_cust = _re.sub(r'[^0-9]', '', cust_phone)
                clean_owner = _re.sub(r'[^0-9]', '', owner_phone)
                
                if clean_cust != clean_owner:
                    # Friendly message for the customer
                    cust_msg = (
                        f"🏪 *مركز M موبايل*\n"
                        f"━━━━━━━━━━━━━━━━━━━━━\n\n"
                        f"عزيزنا *{cust_name}*،\n"
                        f"تم استلام دفعة تسديد وحسابها بنجاح شكراً لك. 🙏\n\n"
                        f"💵 *المبلغ المسدد:* {amount_fmt}\n"
                        f"📉 *المتبقي من الدين:* {debt_fmt}\n"
                        f"📅 *التاريخ:* {db_payment.payment_date.strftime('%Y-%m-%d %H:%M')}"
                    )
                    _req.post(
                        "http://127.0.0.1:8001/send",
                        json={"phone": cust_phone, "message": cust_msg},
                        timeout=5
                    )
        except Exception as cwe:
            print(f"WhatsApp notification to customer error: {cwe}")
            
    except Exception as ne:
        print(f"Notification logic general error: {ne}")

    return db_payment


def seed_recharge_cards(db: Session):
    """Seed the standard recharge and gaming cards if they do not exist."""
    cards = [
        # General view
        {"name": "كارت شحن كورك Koryk", "brand": "كورك تليكوم"},
        {"name": "شدات ببجي PUBG UC", "brand": "شدات ببجي"},
        {"name": "كارت بلايستيشن PlayStation", "brand": "بلايستيشن"},
        {"name": "بطاقة شحن رايزر Razer Gold", "brand": "رايزر جولد"},
        {"name": "بطاقة شحن آيتونز iTunes", "brand": "آيتونز Apple"},
        {"name": "بطاقة شحن جوجل بلاي Google", "brand": "جوجل بلاي"},
        {"name": "بطاقات فري فاير Free Fire", "brand": "فري فاير"},

        # Asiacell view
        {"name": "كارت آسيا سيل فئة 5,000", "brand": "آسيا 5,000"},
        {"name": "كارت آسيا سيل فئة 10,000", "brand": "آسيا 10,000"},
        {"name": "كارت آسيا سيل فئة 15,000", "brand": "آسيا 15,000"},
        {"name": "كارت آسيا سيل فئة 25,000", "brand": "آسيا 25,000"},
        {"name": "كارت آسيا سيل فئة 35,000", "brand": "آسيا 35,000"},
        {"name": "كارت آسيا سيل فئة 50,000", "brand": "آسيا 50,000"},
        {"name": "كارت آسيا سيل فئة 100,000", "brand": "آسيا 100,000"},

        # Zain view
        {"name": "كارت زين فئة 5,000", "brand": "زين 5,000"},
        {"name": "كارت زين فئة 10,000", "brand": "زين 10,000"},
        {"name": "كارت زين فئة 15,000", "brand": "زين 15,000"},
        {"name": "كارت زين فئة 25,000", "brand": "زين 25,000"},
        {"name": "كارت زين فئة 35,000", "brand": "زين 35,000"},
        {"name": "كارت زين فئة 50,000", "brand": "زين 50,000"},
        {"name": "كارت زين فئة 100,000", "brand": "زين 100,000"},
    ]

    for c in cards:
        prod = db.query(models.Product).filter(models.Product.name == c["name"]).first()
        if not prod:
            prod = models.Product(
                name=c["name"],
                brand=c["brand"],
                type=models.ProductType.ACCESSORY,
                purchase_price=0.0,
                selling_price=0.0
            )
            db.add(prod)
            db.flush()
            print(f"Seeded recharge card product: {c['name']}")
    db.commit()



