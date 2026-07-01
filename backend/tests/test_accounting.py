import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base, get_db
from app.main import app
from app.models import AccountType

# Setup SQLite in-memory database for testing
SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Override get_db dependency
def override_get_db():
    try:
        db = TestingSessionLocal()
        yield db
    finally:
        db.close()

app.dependency_overrides[get_db] = override_get_db

client = TestClient(app)

@pytest.fixture(autouse=True)
def setup_db():
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)

def test_create_accounts():
    # 1. Create Cash Account (Asset)
    response = client.post(
        "/accounts/",
        json={"code": "1010", "name": "Cash", "type": "Asset"}
    )
    assert response.status_code == 201
    cash_account = response.json()
    assert cash_account["code"] == "1010"

    # 2. Create Revenue Account (Revenue)
    response = client.post(
        "/accounts/",
        json={"code": "4010", "name": "Sales Revenue", "type": "Revenue"}
    )
    assert response.status_code == 201
    revenue_account = response.json()
    assert revenue_account["code"] == "4010"

def test_balanced_journal_entry():
    # Create accounts first
    acc1 = client.post("/accounts/", json={"code": "1010", "name": "Cash", "type": "Asset"}).json()
    acc2 = client.post("/accounts/", json={"code": "4010", "name": "Sales Revenue", "type": "Revenue"}).json()

    # Post balanced entry
    payload = {
        "reference": "INV-001",
        "description": "Sales payment received",
        "items": [
            {"account_id": acc1["id"], "debit": 100.00, "credit": 0.00},
            {"account_id": acc2["id"], "debit": 0.00, "credit": 100.00}
        ]
    }
    response = client.post("/journal-entries/", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert len(data["items"]) == 2

def test_unbalanced_journal_entry_fails():
    # Create accounts first
    acc1 = client.post("/accounts/", json={"code": "1010", "name": "Cash", "type": "Asset"}).json()
    acc2 = client.post("/accounts/", json={"code": "4010", "name": "Sales Revenue", "type": "Revenue"}).json()

    # Post unbalanced entry (debit: 100, credit: 90)
    payload = {
        "reference": "INV-002",
        "description": "Unbalanced entry",
        "items": [
            {"account_id": acc1["id"], "debit": 100.00, "credit": 0.00},
            {"account_id": acc2["id"], "debit": 0.00, "credit": 90.00}
        ]
    }
    response = client.post("/journal-entries/", json=payload)
    assert response.status_code == 422  # Unprocessable Entity (Pydantic validation error)
    assert "Journal entry is not balanced" in response.text

def test_entry_with_both_debit_and_credit_fails():
    acc1 = client.post("/accounts/", json={"code": "1010", "name": "Cash", "type": "Asset"}).json()
    acc2 = client.post("/accounts/", json={"code": "4010", "name": "Sales Revenue", "type": "Revenue"}).json()

    payload = {
        "reference": "INV-003",
        "items": [
            {"account_id": acc1["id"], "debit": 100.00, "credit": 100.00},  # Invalid
            {"account_id": acc2["id"], "debit": 0.00, "credit": 100.00}
        ]
    }
    response = client.post("/journal-entries/", json=payload)
    assert response.status_code == 422
    assert "A line item cannot have both debit and credit greater than zero" in response.text

def test_product_purchase_auto_accounting():
    # 1. Create a product with 2 IMEIs and a purchase price of 500
    payload = {
        "name": "Galaxy S24",
        "brand": "Samsung",
        "type": "Phone",
        "purchase_price": 500.00,
        "selling_price": 700.00,
        "imeis": ["IMEI8888", "IMEI9999"]
    }
    response = client.post("/products/", json=payload)
    assert response.status_code == 201
    product = response.json()
    assert len(product["items"]) == 2
    assert product["items"][0]["imei"] == "IMEI8888"

    # 2. Check if a Journal Entry was automatically created and posted
    je_response = client.get("/journal-entries/")
    assert je_response.status_code == 200
    entries = je_response.json()
    assert len(entries) == 1
    
    entry = entries[0]
    assert entry["reference"] == "PUR-GALAXY S24"
    # Total cost = 500 * 2 = 1000
    assert len(entry["items"]) == 2
    debits = [float(item["debit"]) for item in entry["items"] if float(item["debit"]) > 0]
    credits = [float(item["credit"]) for item in entry["items"] if float(item["credit"]) > 0]
    assert debits == [1000.00]
    assert credits == [1000.00]

def test_sale_creates_journal_entries():
    # 1. Create a product (Purchase cost 500, Selling price 700)
    p_payload = {
        "name": "iPhone 15",
        "brand": "Apple",
        "type": "Phone",
        "purchase_price": 500.00,
        "selling_price": 700.00,
        "imeis": ["IMEI12345"]
    }
    prod = client.post("/products/", json=p_payload).json()
    inventory_item_id = prod["items"][0]["id"]
    product_id = prod["id"]

    # At this point, one purchase journal entry exists (PUR-IPHONE 15)
    je_response1 = client.get("/journal-entries/")
    assert len(je_response1.json()) == 1

    # 2. Sell the product (price 700)
    s_payload = {
        "customer_name": "Mustafa",
        "payment_method": "Cash",
        "total_amount": 700.00,
        "items": [
            {
                "product_id": product_id,
                "inventory_item_id": inventory_item_id,
                "price": 700.00
            }
        ]
    }
    s_response = client.post("/sales/", json=s_payload)
    assert s_response.status_code == 201

    # 3. Check that two new entries are created (Revenue and COGS)
    je_response2 = client.get("/journal-entries/")
    entries = je_response2.json()
    # Total entries should now be 3 (1 purchase + 1 sales revenue + 1 COGS)
    assert len(entries) == 3

    # Check Revenue Journal Entry
    sales_entries = [e for e in entries if e["reference"].startswith("SAL-")]
    assert len(sales_entries) == 1
    se = sales_entries[0]
    assert len(se["items"]) == 2
    # Revenue = 700
    debits = [float(item["debit"]) for item in se["items"] if float(item["debit"]) > 0]
    assert debits == [700.00]

    # Check COGS Journal Entry
    cogs_entries = [e for e in entries if e["reference"].startswith("COG-")]
    assert len(cogs_entries) == 1
    ce = cogs_entries[0]
    assert len(ce["items"]) == 2
    # Cost = 500
    c_debits = [float(item["debit"]) for item in ce["items"] if float(item["debit"]) > 0]
    assert c_debits == [500.00]


