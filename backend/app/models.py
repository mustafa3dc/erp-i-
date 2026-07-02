import uuid
import enum
from sqlalchemy import Column, String, DateTime, ForeignKey, Numeric, Enum, Text, Integer, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from .database import Base

class AccountType(str, enum.Enum):
    ASSET = "Asset"
    LIABILITY = "Liability"
    EQUITY = "Equity"
    REVENUE = "Revenue"
    EXPENSE = "Expense"

class EntryState(str, enum.Enum):
    DRAFT = "Draft"
    POSTED = "Posted"

class Account(Base):
    __tablename__ = "accounts"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    code = Column(String, unique=True, nullable=False, index=True)
    name = Column(String, nullable=False)
    type = Column(Enum(AccountType), nullable=False)
    parent_id = Column(UUID(as_uuid=True), ForeignKey("accounts.id", ondelete="SET NULL"), nullable=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    parent = relationship("Account", remote_side=[id], backref="sub_accounts")
    items = relationship("JournalItem", back_populates="account")

class JournalEntry(Base):
    __tablename__ = "journal_entries"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    entry_date = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    reference = Column(String, nullable=True)
    description = Column(Text, nullable=True)
    state = Column(Enum(EntryState), nullable=False, default=EntryState.DRAFT)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    items = relationship("JournalItem", back_populates="entry", cascade="all, delete-orphan")

class JournalItem(Base):
    __tablename__ = "journal_items"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    entry_id = Column(UUID(as_uuid=True), ForeignKey("journal_entries.id", ondelete="CASCADE"), nullable=False)
    account_id = Column(UUID(as_uuid=True), ForeignKey("accounts.id"), nullable=False)
    debit = Column(Numeric(12, 2), nullable=False, default=0.00)
    credit = Column(Numeric(12, 2), nullable=False, default=0.00)
    description = Column(Text, nullable=True)

    entry = relationship("JournalEntry", back_populates="items")
    account = relationship("Account", back_populates="items")

class ProductType(str, enum.Enum):
    PHONE = "Phone"
    ACCESSORY = "Accessory"
    MAINTENANCE = "Maintenance"


class InventoryStatus(str, enum.Enum):
    AVAILABLE = "Available"
    SOLD = "Sold"
    DEFECTIVE = "Defective"

class Product(Base):
    __tablename__ = "products"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String, nullable=False)
    brand = Column(String, nullable=False)
    type = Column(Enum(ProductType), nullable=False)
    purchase_price = Column(Numeric(12, 2), nullable=False, default=0.00)
    selling_price = Column(Numeric(12, 2), nullable=False, default=0.00)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    items = relationship("InventoryItem", back_populates="product", cascade="all, delete-orphan")

class InventoryItem(Base):
    __tablename__ = "inventory_items"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    product_id = Column(UUID(as_uuid=True), ForeignKey("products.id", ondelete="CASCADE"), nullable=False)
    imei = Column(String, unique=True, nullable=True, index=True)
    status = Column(Enum(InventoryStatus), nullable=False, default=InventoryStatus.AVAILABLE)
    battery_health = Column(Integer, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    product = relationship("Product", back_populates="items")

class PaymentMethod(str, enum.Enum):
    CASH = "Cash"
    CREDIT = "Credit"

class Sale(Base):
    __tablename__ = "sales"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    sale_date = Column(DateTime(timezone=True), server_default=func.now())
    customer_name = Column(String, nullable=True)
    total_amount = Column(Numeric(12, 2), nullable=False, default=0.00)
    payment_method = Column(Enum(PaymentMethod), nullable=False, default=PaymentMethod.CASH)

    items = relationship("SaleItem", back_populates="sale", cascade="all, delete-orphan")

class SaleItem(Base):
    __tablename__ = "sale_items"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    sale_id = Column(UUID(as_uuid=True), ForeignKey("sales.id", ondelete="CASCADE"), nullable=False)
    product_id = Column(UUID(as_uuid=True), ForeignKey("products.id"), nullable=False)
    inventory_item_id = Column(UUID(as_uuid=True), ForeignKey("inventory_items.id"), nullable=True)
    price = Column(Numeric(12, 2), nullable=False)

    sale = relationship("Sale", back_populates="items")
    product = relationship("Product")
    inventory_item = relationship("InventoryItem")


class MaintenanceJob(Base):
    __tablename__ = "maintenance_jobs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    customer_name = Column(String, nullable=False)
    customer_phone = Column(String, nullable=True)
    device_model = Column(String, nullable=False)
    imei = Column(String, nullable=True)
    problem_description = Column(Text, nullable=True)
    cost = Column(Numeric(12, 2), nullable=False, default=0.00)
    status = Column(String, nullable=False, default="Under Inspection") # "Under Inspection", "Repaired", "Delivered"
    warranty_days = Column(Integer, nullable=True, default=30)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    used_product_id = Column(UUID(as_uuid=True), ForeignKey("products.id"), nullable=True)
    used_product = relationship("Product")
    parts = relationship("MaintenancePart", back_populates="maintenance_job", cascade="all, delete-orphan")


class MaintenancePart(Base):
    __tablename__ = "maintenance_parts"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    maintenance_job_id = Column(UUID(as_uuid=True), ForeignKey("maintenance_jobs.id", ondelete="CASCADE"), nullable=False)
    product_id = Column(UUID(as_uuid=True), ForeignKey("products.id"), nullable=False)

    maintenance_job = relationship("MaintenanceJob", back_populates="parts")
    product = relationship("Product")


class SystemSetting(Base):
    __tablename__ = "system_settings"

    key = Column(String, primary_key=True)
    value = Column(Text, nullable=True)


