from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.responses import HTMLResponse
from sqlalchemy.orm import Session
from typing import List
from uuid import UUID
from contextlib import asynccontextmanager
import os
import subprocess
import sys

from .database import engine, Base, get_db
from . import models, schemas, crud

# Global reference for Telegram Bot subprocess
bot_process = None

def start_bot_process():
    global bot_process
    stop_bot_process()
    
    current_dir = os.path.dirname(os.path.realpath(__file__))
    token_path = os.path.join(current_dir, "telegram_token.txt")
    if os.path.exists(token_path):
        with open(token_path, "r", encoding="utf-8") as f:
            token = f.read().strip()
        if token and token != "YOUR_TOKEN_HERE":
            try:
                bot_process = subprocess.Popen(
                    [sys.executable, os.path.join(current_dir, "telegram_bot.py")],
                    stdout=subprocess.DEVNULL,
                    stderr=subprocess.DEVNULL
                )
                print("Telegram Bot process started.")
            except Exception as e:
                print(f"Failed to start Telegram Bot process: {e}")

def stop_bot_process():
    global bot_process
    if bot_process:
        try:
            bot_process.terminate()
            bot_process.wait(timeout=2)
            print("Telegram Bot process terminated.")
        except Exception:
            try:
                bot_process.kill()
            except Exception:
                pass
        bot_process = None

# Create tables on startup if they don't exist
@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        Base.metadata.create_all(bind=engine)
        start_bot_process()
    except Exception as e:
        print(f"Database connection failed: {e}. Skipping table creation.")
    yield
    stop_bot_process()

app = FastAPI(
    title="Double-Entry Accounting System API",
    description="Core Accounting Module for ERP - Simple Double-entry bookkeeping",
    version="1.0.0",
    lifespan=lifespan
)

@app.get("/", response_class=HTMLResponse)
def read_root():
    current_dir = os.path.dirname(os.path.realpath(__file__))
    template_path = os.path.join(current_dir, "templates", "index.html")
    try:
        with open(template_path, "r", encoding="utf-8") as f:
            return HTMLResponse(content=f.read())
    except FileNotFoundError:
        return HTMLResponse(content="<h1>Frontend template not found</h1>", status_code=404)


# Accounts
@app.post("/accounts/", response_model=schemas.AccountResponse, status_code=status.HTTP_201_CREATED)
def create_account(account: schemas.AccountCreate, db: Session = Depends(get_db)):
    return crud.create_account(db=db, account=account)

@app.get("/accounts/", response_model=List[schemas.AccountResponse])
def read_accounts(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return crud.get_accounts(db=db, skip=skip, limit=limit)

@app.get("/accounts/{account_id}", response_model=schemas.AccountResponse)
def read_account(account_id: UUID, db: Session = Depends(get_db)):
    db_account = crud.get_account(db, account_id=account_id)
    if db_account is None:
        raise HTTPException(status_code=404, detail="Account not found")
    return db_account

# Journal Entries
@app.post("/journal-entries/", response_model=schemas.JournalEntryResponse, status_code=status.HTTP_201_CREATED)
def create_journal_entry(entry: schemas.JournalEntryCreate, db: Session = Depends(get_db)):
    return crud.create_journal_entry(db=db, entry=entry)

@app.get("/journal-entries/", response_model=List[schemas.JournalEntryResponse])
def read_journal_entries(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return crud.get_journal_entries(db=db, skip=skip, limit=limit)

@app.get("/journal-entries/{entry_id}", response_model=schemas.JournalEntryResponse)
def read_journal_entry(entry_id: UUID, db: Session = Depends(get_db)):
    db_entry = crud.get_journal_entry(db, entry_id=entry_id)
    if db_entry is None:
        raise HTTPException(status_code=404, detail="Journal Entry not found")
    return db_entry

# Products
@app.post("/products/", response_model=schemas.ProductResponse, status_code=status.HTTP_201_CREATED)
def create_product(product: schemas.ProductCreate, db: Session = Depends(get_db)):
    return crud.create_product(db=db, product_in=product)


@app.get("/products/", response_model=List[schemas.ProductResponse])
def read_products(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return crud.get_products(db=db, skip=skip, limit=limit)

# Inventory Items
@app.get("/inventory/", response_model=List[schemas.InventoryItemResponse])
def read_inventory(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return crud.get_inventory_items(db=db, skip=skip, limit=limit)

# Sales
@app.post("/sales/", response_model=schemas.SaleResponse, status_code=status.HTTP_201_CREATED)
def create_sale(sale: schemas.SaleCreate, db: Session = Depends(get_db)):
    return crud.create_sale(db=db, sale_in=sale)

@app.get("/sales/", response_model=List[schemas.SaleResponse])
def read_sales(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return crud.get_sales(db=db, skip=skip, limit=limit)


# Telegram Bot Settings
@app.get("/telegram/settings/")
def get_telegram_settings():
    current_dir = os.path.dirname(os.path.realpath(__file__))
    token_path = os.path.join(current_dir, "telegram_token.txt")
    token = ""
    if os.path.exists(token_path):
        with open(token_path, "r", encoding="utf-8") as f:
            token = f.read().strip()
            
    is_running = bot_process is not None and bot_process.poll() is None
    return {"token": token, "is_running": is_running}

from pydantic import BaseModel
class TelegramTokenSettings(BaseModel):
    token: str

@app.post("/telegram/settings/")
def update_telegram_settings(settings: TelegramTokenSettings):
    current_dir = os.path.dirname(os.path.realpath(__file__))
    token_path = os.path.join(current_dir, "telegram_token.txt")
    with open(token_path, "w", encoding="utf-8") as f:
        f.write(settings.token.strip())
        
    start_bot_process()
    is_running = bot_process is not None and bot_process.poll() is None
    return {"status": "success", "is_running": is_running}


