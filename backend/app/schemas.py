from pydantic import BaseModel, Field, model_validator, ConfigDict, BeforeValidator
from typing import List, Optional, Annotated
from datetime import datetime, timezone
from uuid import UUID
from decimal import Decimal
from .models import AccountType, EntryState, ProductType, InventoryStatus, PaymentMethod

# Custom datetime type to force timezone awareness (UTC) for naive datetimes from SQLite
def force_utc(v):
    if isinstance(v, datetime):
        if v.tzinfo is None:
            return v.replace(tzinfo=timezone.utc)
    elif isinstance(v, str):
        # In case it's parsed from string
        try:
            dt = datetime.fromisoformat(v)
            if dt.tzinfo is None:
                return dt.replace(tzinfo=timezone.utc)
            return dt
        except ValueError:
            pass
    return v

DateTimeUTC = Annotated[datetime, BeforeValidator(force_utc)]

# Account Schemas
class AccountBase(BaseModel):
    code: str = Field(..., description="Unique account code, e.g., 101001")
    name: str = Field(..., description="Name of the account")
    type: AccountType
    parent_id: Optional[UUID] = None

class AccountCreate(AccountBase):
    pass

class AccountResponse(AccountBase):
    id: UUID
    created_at: DateTimeUTC
    updated_at: DateTimeUTC

    model_config = ConfigDict(from_attributes=True)

# Journal Item Schemas
class JournalItemBase(BaseModel):
    account_id: UUID
    debit: Decimal = Field(default=Decimal("0.00"), ge=0, description="Debit amount")
    credit: Decimal = Field(default=Decimal("0.00"), ge=0, description="Credit amount")
    description: Optional[str] = None

    @model_validator(mode="before")
    @classmethod
    def check_debit_credit(cls, data):
        if isinstance(data, dict):
            debit = data.get("debit", 0)
            credit = data.get("credit", 0)
            if float(debit) > 0 and float(credit) > 0:
                raise ValueError("A line item cannot have both debit and credit greater than zero.")
            if float(debit) == 0 and float(credit) == 0:
                raise ValueError("A line item must have either debit or credit greater than zero.")
        return data

class JournalItemCreate(JournalItemBase):
    pass

class JournalItemResponse(JournalItemBase):
    id: UUID
    entry_id: UUID

    model_config = ConfigDict(from_attributes=True)

# Journal Entry Schemas
class JournalEntryBase(BaseModel):
    entry_date: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    reference: Optional[str] = None
    description: Optional[str] = None
    state: EntryState = EntryState.DRAFT

class JournalEntryCreate(JournalEntryBase):
    items: List[JournalItemCreate] = Field(..., min_length=2, description="At least two entry lines are required for double-entry.")

    @model_validator(mode="after")
    def check_balanced_entry(self) -> "JournalEntryCreate":
        items = self.items
        if items:
            total_debit = sum(item.debit for item in items)
            total_credit = sum(item.credit for item in items)
            if total_debit != total_credit:
                raise ValueError(f"Journal entry is not balanced. Total Debit: {total_debit}, Total Credit: {total_credit}")
        return self

class JournalEntryResponse(JournalEntryBase):
    id: UUID
    created_at: DateTimeUTC
    updated_at: DateTimeUTC
    items: List[JournalItemResponse]

    model_config = ConfigDict(from_attributes=True)

# Inventory / Product Schemas
class InventoryItemBase(BaseModel):
    imei: Optional[str] = None
    status: InventoryStatus = InventoryStatus.AVAILABLE
    battery_health: Optional[int] = None

class InventoryItemCreate(InventoryItemBase):
    pass

class InventoryItemResponse(InventoryItemBase):
    id: UUID
    product_id: UUID

    model_config = ConfigDict(from_attributes=True)

class ProductBase(BaseModel):
    name: str = Field(..., description="Product model name, e.g. iPhone 15 Pro")
    brand: str = Field(..., description="Brand of the product, e.g. Apple")
    type: ProductType
    purchase_price: Decimal = Field(default=Decimal("0.00"), ge=0)
    selling_price: Decimal = Field(default=Decimal("0.00"), ge=0)

class ProductCreate(ProductBase):
    imeis: Optional[List[str]] = Field(default=None, description="Optional list of serial numbers/IMEIs to generate stock automatically on creation.")
    quantity: Optional[int] = Field(default=1, ge=1, description="Quantity for non-serialised items.")
    battery_health: Optional[int] = Field(default=None, description="Optional battery health percentage for Apple devices.")


class ProductResponse(ProductBase):
    id: UUID
    created_at: DateTimeUTC
    updated_at: DateTimeUTC
    items: List[InventoryItemResponse] = []

    model_config = ConfigDict(from_attributes=True)

# Sales Schemas
class SaleItemBase(BaseModel):
    product_id: UUID
    inventory_item_id: Optional[UUID] = None
    price: Decimal = Field(..., ge=0)

class SaleItemCreate(SaleItemBase):
    pass

class SaleItemResponse(SaleItemBase):
    id: UUID
    sale_id: UUID
    product: Optional[ProductResponse] = None
    inventory_item: Optional[InventoryItemResponse] = None

    model_config = ConfigDict(from_attributes=True)

class SaleBase(BaseModel):
    customer_name: Optional[str] = None
    payment_method: PaymentMethod = PaymentMethod.CASH
    total_amount: Decimal = Field(default=Decimal("0.00"), ge=0)

class SaleCreate(SaleBase):
    items: List[SaleItemCreate] = Field(..., min_length=1)

class SaleResponse(SaleBase):
    id: UUID
    sale_date: DateTimeUTC
    items: List[SaleItemResponse]

    model_config = ConfigDict(from_attributes=True)


class MaintenanceJobBase(BaseModel):
    customer_name: str
    customer_phone: Optional[str] = None
    device_model: str
    imei: Optional[str] = None
    problem_description: Optional[str] = None
    cost: Decimal = Field(default=Decimal("0.00"), ge=0)
    status: str = "Under Inspection"
    warranty_days: Optional[int] = 30
    used_product_id: Optional[UUID] = None

class MaintenanceJobCreate(MaintenanceJobBase):
    pass

class MaintenanceJobResponse(MaintenanceJobBase):
    id: UUID
    created_at: DateTimeUTC
    updated_at: DateTimeUTC

    model_config = ConfigDict(from_attributes=True)
