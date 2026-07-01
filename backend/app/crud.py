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

        # Handle IMEI / Serialised physical item if provided
        if item.inventory_item_id:
            inv_item = db.query(models.InventoryItem).filter(models.InventoryItem.id == item.inventory_item_id).first()
            if not inv_item or inv_item.status != models.InventoryStatus.AVAILABLE:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Inventory item {item.inventory_item_id} is not available for sale."
                )
            # Mark status as SOLD
            inv_item.status = models.InventoryStatus.SOLD
        
        # Create SaleItem record
        db_item = models.SaleItem(
            sale_id=db_sale.id,
            product_id=item.product_id,
            inventory_item_id=item.inventory_item_id,
            price=item.price
        )
        db.add(db_item)

        total_revenue += item.price
        total_cost += product.purchase_price

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


