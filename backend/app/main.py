from fastapi import FastAPI, Depends, HTTPException, status, File, UploadFile, BackgroundTasks
from fastapi.responses import HTMLResponse
from sqlalchemy.orm import Session
from typing import List, Optional
from uuid import UUID
from contextlib import asynccontextmanager
import os
import subprocess
import sys
import shutil

from .database import engine, Base, get_db, SessionLocal, default_db_path
from . import models, schemas, crud
import requests as py_requests

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
    # Kill ALL telegram_bot.py processes (including any orphaned ones)
    import subprocess as _sp
    try:
        _sp.run(["pkill", "-9", "-f", "telegram_bot.py"], capture_output=True)
    except Exception:
        pass
    # Also terminate tracked process
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
    # Remove lock file if exists
    import os as _os
    lock = _os.path.join(_os.path.dirname(_os.path.realpath(__file__)), "bot.lock")
    if _os.path.exists(lock):
        try:
            _os.remove(lock)
        except Exception:
            pass



whatsapp_process = None

def start_whatsapp_process():
    global whatsapp_process
    import urllib.request
    
    # Check if WhatsApp service is already running on port 8001
    try:
        with urllib.request.urlopen("http://127.0.0.1:8001/status", timeout=1) as r:
            print("WhatsApp service is already active on port 8001.")
            return
    except Exception:
        pass
        
    current_dir = os.path.dirname(os.path.realpath(__file__))
    wa_dir = os.path.join(current_dir, "whatsapp_service")
    wa_script = os.path.join(wa_dir, "server.js")
    
    if os.path.exists(wa_script):
        try:
            startupinfo = None
            if sys.platform == "win32":
                startupinfo = subprocess.STARTUPINFO()
                startupinfo.dwFlags |= subprocess.STARTF_USESHOWWINDOW
                startupinfo.wShowWindow = 0  # Hide node CMD window
                
            whatsapp_process = subprocess.Popen(
                ["node", wa_script],
                cwd=wa_dir,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
                startupinfo=startupinfo
            )
            print("WhatsApp service automatically launched on port 8001.")
        except Exception as e:
            print(f"Could not start WhatsApp process automatically: {e}")

def stop_whatsapp_process():
    global whatsapp_process
    if whatsapp_process:
        try:
            whatsapp_process.terminate()
        except Exception:
            pass
        whatsapp_process = None


# Create tables on startup if they don't exist
@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        Base.metadata.create_all(bind=engine)
        
        # SQLite migrations for new installment columns
        from sqlalchemy import text
        with engine.begin() as conn:
            try:
                conn.execute(text("ALTER TABLE customers ADD COLUMN installment_downpayment NUMERIC(12, 2) DEFAULT 0.00"))
            except Exception:
                pass
            try:
                conn.execute(text("ALTER TABLE customers ADD COLUMN installment_monthly NUMERIC(12, 2) DEFAULT 0.00"))
            except Exception:
                pass
            try:
                conn.execute(text("ALTER TABLE users ADD COLUMN tenant_id VARCHAR DEFAULT 'default'"))
            except Exception:
                pass
            try:
                conn.execute(text("ALTER TABLE users ADD COLUMN shop_name VARCHAR DEFAULT 'متجر الموبايل'"))
            except Exception:
                pass
            try:
                conn.execute(text("ALTER TABLE users ADD COLUMN is_active INTEGER DEFAULT 1"))
            except Exception:
                pass
            try:
                conn.execute(text("ALTER TABLE users ADD COLUMN is_super_admin INTEGER DEFAULT 0"))
            except Exception:
                pass
            try:
                conn.execute(text("ALTER TABLE maintenance_jobs ADD COLUMN tenant_id VARCHAR DEFAULT 'default'"))
            except Exception:
                pass
            try:
                conn.execute(text("ALTER TABLE customers ADD COLUMN tenant_id VARCHAR DEFAULT 'default'"))
            except Exception:
                pass
            try:
                conn.execute(text("ALTER TABLE customers ADD COLUMN installment_downpayment NUMERIC(12, 2) DEFAULT 0.00"))
            except Exception:
                pass
            try:
                conn.execute(text("ALTER TABLE customers ADD COLUMN installment_monthly NUMERIC(12, 2) DEFAULT 0.00"))
            except Exception:
                pass
            try:
                conn.execute(text("ALTER TABLE customer_payments ADD COLUMN tenant_id VARCHAR DEFAULT 'default'"))
            except Exception:
                pass
            try:
                conn.execute(text("ALTER TABLE shop_settings ADD COLUMN tenant_id VARCHAR DEFAULT 'default'"))
            except Exception:
                pass
            try:
                conn.execute(text("ALTER TABLE shop_settings ADD COLUMN telegram_token VARCHAR DEFAULT ''"))
            except Exception:
                pass
            try:
                conn.execute(text("ALTER TABLE shop_settings ADD COLUMN telegram_chat_id VARCHAR DEFAULT ''"))
            except Exception:
                pass
            try:
                conn.execute(text("ALTER TABLE shop_settings ADD COLUMN whatsapp_phone VARCHAR DEFAULT ''"))
            except Exception:
                pass
                
        perform_auto_backup()
        
        # Ensure all existing users have unique tenant_ids
        from .database import SessionLocal
        db_session = SessionLocal()
        try:
            import uuid
            from .models import User
            from .crud import create_user
            from .schemas import UserCreate
            user_count = db_session.query(User).count()
            if user_count == 0:
                admin_user = UserCreate(username="admin", password="admin", role="admin", is_super_admin=1)
                create_user(db_session, admin_user)
                print("Default admin user created successfully")
            else:
                all_users = db_session.query(User).all()
                for u in all_users:
                    if u.username == "admin":
                        u.is_super_admin = 1
                        if not u.tenant_id or u.tenant_id == "default":
                            u.tenant_id = "tenant_admin_master"
                    elif not u.tenant_id or u.tenant_id == "default":
                        u.tenant_id = f"tenant_{u.username}_{str(uuid.uuid4())[:6]}"
                db_session.commit()
        except Exception as ue:
            print(f"Error updating users tenant IDs: {ue}")
        finally:
            db_session.close()

        # Seed standard recharge cards
        db_session = SessionLocal()
        try:
            from .crud import seed_recharge_cards
            seed_recharge_cards(db_session)
            print("Successfully seeded standard recharge cards on startup.")
        except Exception as se:
            print(f"Error seeding standard recharge cards: {se}")
        finally:
            db_session.close()


        from sqlalchemy import text
        with engine.begin() as conn:
            try:
                conn.execute(text("ALTER TABLE maintenance_jobs ADD COLUMN used_product_id UUID"))
                print("Migration: Added used_product_id column to maintenance_jobs")
            except Exception:
                pass
            try:
                conn.execute(text("ALTER TABLE inventory_items ADD COLUMN created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP"))
            except Exception:
                pass
        start_bot_process()
        start_whatsapp_process()
    except Exception as e:
        print(f"Database startup failed: {e}.")
    yield
    stop_bot_process()
    stop_whatsapp_process()

app = FastAPI(
    title="Double-Entry Accounting System API",
    description="Core Accounting Module for ERP - Simple Double-entry bookkeeping",
    version="1.0.0",
    lifespan=lifespan
)

from fastapi import Request

@app.middleware("http")
async def tenant_middleware(request: Request, call_next):
    tenant_id = request.headers.get("X-Tenant-ID", "default")
    request.state.tenant_id = tenant_id
    response = await call_next(request)
    return response

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from fastapi.staticfiles import StaticFiles

# Mount static assets from frontend build directory
current_file_dir = os.path.dirname(os.path.abspath(__file__))
dist_dir = os.path.abspath(os.path.join(current_file_dir, "..", "..", "frontend", "dist"))
assets_dir = os.path.join(dist_dir, "assets")

if os.path.exists(assets_dir):
    app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")

@app.get("/", response_class=HTMLResponse)
def read_root():
    template_path = os.path.join(dist_dir, "index.html")
    if not os.path.exists(template_path):
        template_path = os.path.join(current_file_dir, "templates", "index.html")
    try:
        with open(template_path, "r", encoding="utf-8") as f:
            return HTMLResponse(content=f.read())
    except FileNotFoundError:
        return HTMLResponse(content="<h1>Frontend template not found</h1>", status_code=404)
@app.get("/test-pdf")
def test_pdf():
    import traceback
    try:
        from .report_generator import generate_daily_report_pdf
        pdf_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "test_report.pdf")
        generate_daily_report_pdf(pdf_path)
        if os.path.exists(pdf_path):
            os.remove(pdf_path)
        return {"status": "success", "message": "PDF generated successfully!"}
    except Exception as e:
        error_str = traceback.format_exc()
        return {"status": "error", "message": str(e), "traceback": error_str}


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
def create_sale(sale: schemas.SaleCreate, request: Request, db: Session = Depends(get_db)):
    tenant_id = getattr(request.state, "tenant_id", "default")
    # Auto-save customer
    customer = None
    if sale.customer_name and sale.customer_name.strip():
        try:
            customer = crud.create_customer_direct(
                db=db,
                name=sale.customer_name,
                phone=getattr(sale, 'customer_phone', None),
                tenant_id=tenant_id
            )
            if customer and sale.payment_method == schemas.PaymentMethod.CREDIT:
                if sale.installment_downpayment is not None:
                    customer.installment_downpayment = sale.installment_downpayment
                if sale.installment_monthly is not None:
                    customer.installment_monthly = sale.installment_monthly
                db.commit()
                db.refresh(customer)
        except Exception as e:
            print(f"Error auto-saving customer: {e}")
            
    # Create the sale
    created_sale = crud.create_sale(db=db, sale_in=sale)
    
    # If there is a downpayment on installments, auto-register customer payment
    if customer and sale.payment_method == schemas.PaymentMethod.CREDIT and sale.installment_downpayment and sale.installment_downpayment > 0:
        try:
            crud.create_customer_payment(
                db=db,
                customer_id=customer.id,
                amount=float(sale.installment_downpayment),
                notes=f"مقدمة القسط لفاتورة مبيعات رقم {str(created_sale.id)[:8]}",
                tenant_id=tenant_id
            )
            db.commit()
        except Exception as e:
            print(f"Error creating automatic downpayment payment: {e}")
            
    return created_sale

@app.get("/sales/", response_model=List[schemas.SaleResponse])
def read_sales(request: Request, skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return crud.get_sales(db=db, skip=skip, limit=limit)

@app.post("/sales/{sale_id}/refund/")
def refund_sale_endpoint(sale_id: str, db: Session = Depends(get_db)):
    return crud.refund_sale(db=db, sale_id=sale_id)


def get_system_setting(key: str) -> str:
    from sqlalchemy import text
    db = SessionLocal()
    try:
        res = db.execute(text("SELECT value FROM system_settings WHERE key = :key"), {"key": key}).fetchone()
        return res[0] if res else ""
    except Exception:
        return ""
    finally:
        db.close()

def set_system_setting(key: str, value: str):
    from sqlalchemy import text
    db = SessionLocal()
    try:
        res = db.execute(text("SELECT 1 FROM system_settings WHERE key = :key"), {"key": key}).fetchone()
        if res:
            db.execute(text("UPDATE system_settings SET value = :value WHERE key = :key"), {"key": key, "value": value})
        else:
            db.execute(text("INSERT INTO system_settings (key, value) VALUES (:key, :value)"), {"key": key, "value": value})
        db.commit()
    except Exception as e:
        print(f"Error setting setting {key}: {e}")
        db.rollback()
    finally:
        db.close()

# Telegram Bot Settings
@app.get("/telegram/settings/")
def get_telegram_settings():
    token = get_system_setting("telegram_token")
    allowed_users = get_system_setting("allowed_users")
    
    # Fallback to files if DB empty
    if not token:
        current_dir = os.path.dirname(os.path.realpath(__file__))
        token_path = os.path.join(current_dir, "telegram_token.txt")
        if os.path.exists(token_path):
            with open(token_path, "r", encoding="utf-8") as f:
                token = f.read().strip()
                
    if not allowed_users:
        current_dir = os.path.dirname(os.path.realpath(__file__))
        users_path = os.path.join(current_dir, "allowed_users.txt")
        if os.path.exists(users_path):
            with open(users_path, "r", encoding="utf-8") as f:
                allowed_users = ", ".join([line.strip() for line in f if line.strip()])
            
    is_running = bot_process is not None and bot_process.poll() is None
    return {"token": token, "allowed_users": allowed_users, "is_running": is_running}

from pydantic import BaseModel
class TelegramTokenSettings(BaseModel):
    token: str
    allowed_users: Optional[str] = ""

@app.post("/telegram/settings/")
def update_telegram_settings(settings: TelegramTokenSettings):
    set_system_setting("telegram_token", settings.token.strip())
    set_system_setting("allowed_users", settings.allowed_users.strip())
    
    # Backup to files
    current_dir = os.path.dirname(os.path.realpath(__file__))
    token_path = os.path.join(current_dir, "telegram_token.txt")
    users_path = os.path.join(current_dir, "allowed_users.txt")
    
    with open(token_path, "w", encoding="utf-8") as f:
        f.write(settings.token.strip())
        
    users_list = [u.strip() for u in settings.allowed_users.replace(",", "\n").split("\n") if u.strip()]
    with open(users_path, "w", encoding="utf-8") as f:
        for user in users_list:
            f.write(f"{user}\n")
        
    start_bot_process()
    is_running = bot_process is not None and bot_process.poll() is None
    return {"status": "success", "is_running": is_running}


# Entishar Wallet Balance Endpoints
class EntisharBalanceUpdate(BaseModel):
    balance: float

@app.get("/entishar/balance/")
def get_entishar_balance():
    val = get_system_setting("entishar_balance")
    try:
        balance_float = float(val) if val else 0.0
    except ValueError:
        balance_float = 0.0
    return {"balance": balance_float}

@app.post("/entishar/balance/")
def update_entishar_balance(req: EntisharBalanceUpdate):
    set_system_setting("entishar_balance", str(req.balance))
    return {"status": "success", "balance": req.balance}


# Maintenance Endpoints
@app.post("/maintenance/", response_model=schemas.MaintenanceJobResponse, status_code=status.HTTP_201_CREATED)
def create_maintenance_job(job: schemas.MaintenanceJobCreate, request: Request, db: Session = Depends(get_db)):
    tenant_id = getattr(request.state, "tenant_id", "default")
    # Auto-save customer
    if job.customer_name and job.customer_name.strip():
        try:
            crud.create_customer_direct(db=db, name=job.customer_name, phone=job.customer_phone, tenant_id=tenant_id)
        except Exception:
            pass
    return crud.create_maintenance_job(db=db, job=job, tenant_id=tenant_id)

@app.get("/maintenance/", response_model=List[schemas.MaintenanceJobResponse])
def read_maintenance_jobs(request: Request, skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    tenant_id = getattr(request.state, "tenant_id", "default")
    return crud.get_maintenance_jobs(db=db, skip=skip, limit=limit, tenant_id=tenant_id)

class UpdateMaintenanceJobRequest(BaseModel):
    status: str
    cost: Optional[float] = None
    used_product_id: Optional[str] = None
    used_part_ids: Optional[List[str]] = None
    customer_name: Optional[str] = None
    customer_phone: Optional[str] = None
    device_model: Optional[str] = None
    imei: Optional[str] = None
    problem_description: Optional[str] = None
    warranty_days: Optional[int] = None

def send_telegram_job_ready_notification(customer_name: str, customer_phone: str, device_model: str, cost: float):
    """Send a Telegram notification to the shop owner when a job is ready for delivery."""
    try:
        from .database import SessionLocal
        from . import models
        with SessionLocal() as session:
            token_setting = session.query(models.SystemSetting).filter_by(key='telegram_token').first()
            if not token_setting or not token_setting.value:
                return
            token = token_setting.value.strip()
        
        # Get all registered chat IDs
        current_dir = os.path.dirname(os.path.realpath(__file__))
        chats_file = os.path.join(current_dir, "registered_chats.txt")
        if not os.path.exists(chats_file):
            return
        
        with open(chats_file, "r") as f:
            chat_ids = [line.strip() for line in f.readlines() if line.strip()]
        
        if not chat_ids:
            return
        
        cost_formatted = f"{int(cost):,} د.ع" if cost else "محدد عند الاستلام"
        message = (
            f"🔔 *إشعار جهاز جاهز للتسليم*\n\n"
            f"👤 *الزبون:* {customer_name}\n"
            f"📞 *الهاتف:* {customer_phone or 'غير مسجل'}\n"
            f"📱 *الجهاز:* {device_model}\n"
            f"💵 *التكلفة:* {cost_formatted}\n\n"
            f"✅ الجهاز جاهز! يمكنك الاتصال بالزبون الآن لإبلاغه."
        )
        
        api_url = f"https://api.telegram.org/bot{token}/sendMessage"
        for chat_id in chat_ids:
            try:
                py_requests.post(api_url, json={
                    "chat_id": chat_id,
                    "text": message,
                    "parse_mode": "Markdown"
                }, timeout=10)
            except Exception as e:
                print(f"Failed to send Telegram notification to {chat_id}: {e}")
    except Exception as e:
        print(f"Failed to send Telegram job ready notification: {e}")

def send_whatsapp_job_ready_to_customer(customer_phone: str, customer_name: str, device_model: str, cost: float):
    """Send a premium WhatsApp message directly to the customer when their device is ready."""
    db_session = SessionLocal()
    try:
        from .crud import get_shop_settings
        settings_data = get_shop_settings(db_session)
        shop_title = settings_data.shop_name if settings_data and settings_data.shop_name else "M MOBILE CENTER"
        
        cost_formatted = f"{int(cost):,} د.ع" if cost else "سيتم تحديدها عند الاستلام"
        message = (
            f"🏪 *{shop_title}*\n"
            f"━━━━━━━━━━━━━━━━━━━━━\n\n"
            f"السلام عليكم ورحمة الله وبركاته\n"
            f"عزيزنا *{customer_name}*،\n\n"
            f"يسعدنا إعلامكم بأن جهازكم قد تمّ إصلاحه بنجاح وهو جاهز للاستلام في أي وقت يناسبكم.\n\n"
            f"📋 *تفاصيل الطلب:*\n"
            f"┌ 📱 الجهاز: {device_model}\n"
            f"├ ✅ الحالة: جاهز للاستلام\n"
            f"└ 💵 التكلفة: {cost_formatted}\n\n"
            f"نشكر ثقتكم بنا ونتطلع لخدمتكم دائماً. 🙏"
        )
        r = py_requests.post(
            "http://127.0.0.1:8001/send",
            json={"phone": customer_phone, "message": message},
            timeout=15
        )
        if r.status_code == 200:
            print(f"WhatsApp message sent successfully to {customer_phone}")
        else:
            print(f"WhatsApp service returned error: {r.text}")
    except Exception as e:
        print(f"Failed to send WhatsApp message to customer: {e}")
    finally:
        db_session.close()

@app.put("/maintenance/{job_id}/", response_model=schemas.MaintenanceJobResponse)
def update_maintenance_job(
    job_id: str, 
    request: UpdateMaintenanceJobRequest, 
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    db_job = crud.update_maintenance_job(
        db=db, 
        job_id=job_id, 
        status=request.status, 
        cost=request.cost,
        used_product_id=request.used_product_id,
        used_part_ids=request.used_part_ids,
        customer_name=request.customer_name,
        customer_phone=request.customer_phone,
        device_model=request.device_model,
        imei=request.imei,
        problem_description=request.problem_description,
        warranty_days=request.warranty_days
    )
    if not db_job:
        raise HTTPException(status_code=404, detail="Maintenance job not found")
        
    # When job becomes ready, send Telegram notification to owner + WhatsApp to customer
    if request.status == "Repaired":
        log_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        with open(os.path.join(log_dir, "trigger_test.log"), "a", encoding="utf-8") as f_log:
            f_log.write(f"Triggered for Job ID: {job_id}, Customer: {db_job.customer_name}, Phone: {db_job.customer_phone}\n")
            
        background_tasks.add_task(
            send_telegram_job_ready_notification,
            db_job.customer_name,
            db_job.customer_phone or "",
            db_job.device_model,
            db_job.cost
        )
        if db_job.customer_phone:
            background_tasks.add_task(
                send_whatsapp_job_ready_to_customer,
                db_job.customer_phone,
                db_job.customer_name or "عزيزي الزبون",
                db_job.device_model,
                db_job.cost
            )
        
    return db_job


import shutil
from fastapi.responses import FileResponse

def is_database_empty(db_path: str) -> bool:
    import sqlite3
    if not os.path.exists(db_path):
        return True
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        total_records = 0
        for table in ["sales", "products", "maintenance_jobs", "customers"]:
            cursor.execute(f"SELECT count(*) FROM sqlite_master WHERE type='table' AND name='{table}'")
            if cursor.fetchone()[0] > 0:
                cursor.execute(f"SELECT count(*) FROM {table}")
                total_records += cursor.fetchone()[0]
        conn.close()
        return total_records == 0
    except Exception:
        return True

def safe_copy_backup(src: str, dst: str):
    if os.path.exists(dst):
        if is_database_empty(src) and not is_database_empty(dst):
            print(f"Skipping backup overwrite: source database {src} is empty, but destination {dst} contains data!")
            return
    shutil.copy2(src, dst)

def perform_auto_backup():
    if not os.path.exists(default_db_path):
        return
    try:
        # 1. Local backup inside project
        project_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        backup_dir = os.path.join(project_dir, "backups")
        os.makedirs(backup_dir, exist_ok=True)
        local_backup_path = os.path.join(backup_dir, "accounting_backup.db")
        safe_copy_backup(default_db_path, local_backup_path)
        print(f"Local backup saved to {local_backup_path}")
        
        # 2. Local Documents backup
        documents_dir = os.path.expanduser("~/Documents")
        if os.path.exists(documents_dir):
            local_backup_dir = os.path.join(documents_dir, "MMobile_LocalBackup")
            os.makedirs(local_backup_dir, exist_ok=True)
            local_backup_path2 = os.path.join(local_backup_dir, "accounting.db")
            safe_copy_backup(default_db_path, local_backup_path2)
            print(f"Documents backup saved to {local_backup_path2}")
            
        # 3. Google Drive Backup
        selected_account = None
        config_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "gdrive_account.txt")
        if os.path.exists(config_path):
            with open(config_path, "r") as f:
                selected_account = f.read().strip()

        cloud_storage_dir = os.path.expanduser("~/Library/CloudStorage")
        if os.path.exists(cloud_storage_dir):
            for folder in os.listdir(cloud_storage_dir):
                is_match = False
                if selected_account:
                    is_match = folder == f"GoogleDrive-{selected_account}" or (selected_account == "الافتراضي (Default)" and folder.lower() == "googledrive")
                else:
                    is_match = folder.startswith("GoogleDrive-") or folder.lower() == "googledrive"

                if is_match:
                    # Check "My Drive" subfolder or root of sync folder
                    for sub in ["My Drive", ""]:
                        gdrive_path = os.path.join(cloud_storage_dir, folder, sub) if sub else os.path.join(cloud_storage_dir, folder)
                        if os.path.exists(gdrive_path) and os.path.isdir(gdrive_path):
                            gdrive_backup_dir = os.path.join(gdrive_path, "MMobileBackup")
                            os.makedirs(gdrive_backup_dir, exist_ok=True)
                            gdrive_backup_path = os.path.join(gdrive_backup_dir, "accounting.db")
                            safe_copy_backup(default_db_path, gdrive_backup_path)
                            print(f"Google Drive backup saved to {gdrive_backup_path}")
                            break
    except Exception as e:
        print(f"Auto backup failed: {e}")

@app.get("/backup-db/")
def download_database_backup():

    if os.path.exists(default_db_path):
        perform_auto_backup()
        return FileResponse(
            path=default_db_path, 
            filename="accounting_backup.db", 
            media_type="application/octet-stream"
        )
    raise HTTPException(status_code=404, detail="Database file not found")


class UpdateProductRequest(BaseModel):
    name: str
    brand: str
    type: str
    purchase_price: float
    selling_price: float
    quantity: Optional[int] = None

from uuid import UUID
@app.put("/products/{product_id}/", response_model=schemas.ProductResponse)
def update_product_endpoint(product_id: UUID, request: UpdateProductRequest, db: Session = Depends(get_db)):
    try:
        db_prod = crud.update_product(
            db=db,
            product_id=product_id,
            name=request.name,
            brand=request.brand,
            type=request.type,
            purchase_price=request.purchase_price,
            selling_price=request.selling_price,
            quantity=request.quantity
        )
        if not db_prod:
            raise HTTPException(status_code=404, detail="المنتج غير موجود.")
        return db_prod
    except Exception as e:
        import traceback
        with open("/Users/mustafa/Desktop/test/traceback.log", "w") as f:
            traceback.print_exc(file=f)
        traceback.print_exc()
        raise e


@app.delete("/products/{product_id}/")
def delete_product_endpoint(product_id: str, db: Session = Depends(get_db)):
    from uuid import UUID
    prod_uuid = UUID(product_id) if isinstance(product_id, str) else product_id
    db_prod = db.query(models.Product).filter(models.Product.id == prod_uuid).first()
    if not db_prod:
        raise HTTPException(status_code=404, detail="المنتج غير موجود.")
    db.delete(db_prod)
    db.commit()
    return {"status": "success"}


@app.get("/whatsapp/status")
def get_whatsapp_status():
    try:
        r = py_requests.get("http://127.0.0.1:8001/status", timeout=5)
        return r.json()
    except Exception as e:
        return {"status": "disconnected", "qr": "", "error": str(e)}

class SendWhatsAppMessageRequest(BaseModel):
    phone: str
    message: str

@app.post("/whatsapp/send")
def send_whatsapp_message(request: SendWhatsAppMessageRequest):
    try:
        r = py_requests.post(
            "http://127.0.0.1:8001/send",
            json={"phone": request.phone, "message": request.message},
            timeout=10
        )
        if r.status_code != 200:
            raise HTTPException(status_code=r.status_code, detail=r.json().get("error", "Failed to send"))
        return r.json()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/restore-db/")
def restore_database(file: UploadFile = File(...), db: Session = Depends(get_db)):

    try:
        # Save uploaded file content to temporary path
        temp_path = default_db_path + ".tmp"
        with open(temp_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
            
        # Test if the uploaded file is a valid sqlite db
        import sqlite3
        conn = None
        try:
            conn = sqlite3.connect(temp_path)
            conn.execute("SELECT name FROM sqlite_master LIMIT 1")
        except Exception:
            if os.path.exists(temp_path):
                os.remove(temp_path)
            raise HTTPException(status_code=400, detail="الملف المرفوع ليس قاعدة بيانات صالحة.")
        finally:
            if conn:
                conn.close()
                
        # Close database engine connections to release locks
        engine.dispose()
        
        # Overwrite database file
        shutil.move(temp_path, default_db_path)
        
        # Perform auto backup
        perform_auto_backup()
        
        return {"status": "success", "message": "Database restored successfully."}
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/reset-db/")
def reset_database(db: Session = Depends(get_db)):
    try:
        # Delete items in dependent order to respect foreign key constraints
        db.query(models.SaleItem).delete()
        db.query(models.Sale).delete()
        db.query(models.MaintenancePart).delete()
        db.query(models.MaintenanceJob).delete()
        db.query(models.InventoryItem).delete()
        db.query(models.Product).delete()
        db.query(models.JournalItem).delete()
        db.query(models.JournalEntry).delete()
        db.query(models.Account).delete()
        db.commit()

        # Re-seed standard recharge cards
        crud.seed_recharge_cards(db)

        return {"status": "success", "message": "Database reset successfully."}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/list-gdrive-accounts/")
def list_gdrive_accounts():
    accounts = []
    cloud_storage_dir = os.path.expanduser("~/Library/CloudStorage")
    if os.path.exists(cloud_storage_dir):
        for folder in os.listdir(cloud_storage_dir):
            if folder.startswith("GoogleDrive-"):
                email = folder.replace("GoogleDrive-", "")
                accounts.append(email)
            elif folder.lower() == "googledrive":
                accounts.append("الافتراضي (Default)")
    return accounts


@app.get("/get-gdrive-account/")
def get_gdrive_account():
    config_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "gdrive_account.txt")
    if os.path.exists(config_path):
        with open(config_path, "r") as f:
            return {"account": f.read().strip()}
    return {"account": ""}


class SetGDriveAccountRequest(BaseModel):
    account: str

@app.post("/set-gdrive-account/")
def set_gdrive_account(request: SetGDriveAccountRequest):
    config_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "gdrive_account.txt")
    with open(config_path, "w") as f:
        f.write(request.account)
    # Run backup immediately to new location
    perform_auto_backup()
    return {"status": "success"}

# ─────────────────────────────────────────────────────────
# Customer Endpoints
# ─────────────────────────────────────────────────────────

@app.get("/customers/")
def get_customers(request: Request, skip: int = 0, limit: int = 200, db: Session = Depends(get_db)):
    try:
        tenant_id = getattr(request.state, "tenant_id", "default")
        customers = db.query(models.Customer).filter(models.Customer.tenant_id == tenant_id).order_by(models.Customer.created_at.desc()).offset(skip).limit(limit).all()
        result = []
        for c in customers:
            result.append({
                "id": str(c.id),
                "name": str(c.name) if c.name else "",
                "phone": str(c.phone) if c.phone else "",
                "notes": str(c.notes) if c.notes else "",
                "initial_debt": float(c.initial_debt) if getattr(c, 'initial_debt', None) is not None else 0.0,
                "installment_downpayment": float(c.installment_downpayment) if getattr(c, 'installment_downpayment', None) is not None else 0.0,
                "installment_monthly": float(c.installment_monthly) if getattr(c, 'installment_monthly', None) is not None else 0.0,
                "created_at": c.created_at.isoformat() if getattr(c, 'created_at', None) else None,
                "updated_at": c.updated_at.isoformat() if getattr(c, 'updated_at', None) else None,
                "total_sales": 0,
                "total_maintenance": 0,
                "current_debt": float(c.initial_debt) if getattr(c, 'initial_debt', None) is not None else 0.0
            })
        return result
    except Exception as e:
        print(f"Customer fetch error: {e}")
        return []


@app.get("/customers/search/")
def search_customers(q: str, db: Session = Depends(get_db)):
    customers = crud.search_customers(db=db, query=q)
    return [{
        "id": str(c.id),
        "name": c.name,
        "phone": c.phone,
        "notes": c.notes,
        "initial_debt": float(c.initial_debt),
        "current_debt": crud.calculate_customer_debt(db, c)
    } for c in customers]


@app.get("/customers/{customer_id}/history/")
def customer_history(customer_id: str, db: Session = Depends(get_db)):
    customer, sales, maintenance = crud.get_customer_history(db=db, customer_id=customer_id)
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    # Construct sales details with item names
    sales_data = []
    for s in sales:
        items_desc = []
        for item in s.items:
            if item.product:
                items_desc.append(f"{item.product.brand} {item.product.name}" if item.product.brand else item.product.name)
        sales_data.append({
            "id": str(s.id),
            "date": str(s.sale_date),
            "total": float(s.total_amount),
            "payment": s.payment_method.value,
            "items": ", ".join(items_desc) if items_desc else "بضاعة عامة"
        })

    current_debt = crud.calculate_customer_debt(db, customer)

    return {
        "customer": {
            "id": str(customer.id),
            "name": customer.name,
            "phone": customer.phone,
            "notes": customer.notes,
            "initial_debt": float(customer.initial_debt),
            "current_debt": current_debt
        },
        "sales": sales_data,
        "maintenance": [{"id": str(m.id), "device": m.device_model, "status": m.status, "cost": float(m.cost), "date": str(m.created_at)} for m in maintenance],
    }


@app.post("/customers/", response_model=schemas.CustomerResponse, status_code=201)
def create_customer(customer: schemas.CustomerCreate, request: Request, db: Session = Depends(get_db)):
    try:
        tenant_id = getattr(request.state, "tenant_id", "default")
        c = crud.create_customer_direct(
            db=db,
            name=customer.name,
            phone=customer.phone,
            notes=customer.notes,
            initial_debt=float(customer.initial_debt or 0),
            installment_downpayment=float(customer.installment_downpayment or 0),
            installment_monthly=float(customer.installment_monthly or 0),
            tenant_id=tenant_id
        )
        db.commit()
        db.refresh(c)
        current_debt = crud.calculate_customer_debt(db, c)
        return schemas.CustomerResponse(
            id=c.id, name=c.name, phone=c.phone, notes=c.notes,
            initial_debt=c.initial_debt,
            installment_downpayment=c.installment_downpayment,
            installment_monthly=c.installment_monthly,
            created_at=c.created_at, updated_at=c.updated_at,
            total_sales=0, total_maintenance=0,
            current_debt=current_debt
        )
    except Exception as e:
        db.rollback()
        print(f"Error creating customer: {e}")
        raise HTTPException(status_code=400, detail=f"تعذر إضافة الزبون: {str(e)}")


@app.post("/customers/bulk/", status_code=201)
def create_customers_bulk(customers_list: List[schemas.CustomerCreate], db: Session = Depends(get_db)):
    added_count = 0
    for customer in customers_list:
        if not customer.name or not customer.name.strip():
            continue
        crud.create_customer_direct(
            db=db,
            name=customer.name,
            phone=customer.phone,
            notes=customer.notes,
            initial_debt=float(customer.initial_debt or 0),
            installment_downpayment=float(customer.installment_downpayment or 0),
            installment_monthly=float(customer.installment_monthly or 0)
        )
        added_count += 1
    db.commit()
    return {"status": "success", "added_count": added_count}


@app.put("/customers/{customer_id}/", response_model=schemas.CustomerResponse)
def update_customer(customer_id: str, data: schemas.CustomerUpdate, db: Session = Depends(get_db)):
    c = crud.update_customer(db=db, customer_id=customer_id, data=data)
    if not c:
        raise HTTPException(status_code=404, detail="Customer not found")
    current_debt = crud.calculate_customer_debt(db, c)
    return schemas.CustomerResponse(
        id=c.id, name=c.name, phone=c.phone, notes=c.notes,
        initial_debt=c.initial_debt,
        installment_downpayment=c.installment_downpayment,
        installment_monthly=c.installment_monthly,
        created_at=c.created_at, updated_at=c.updated_at,
        total_sales=0, total_maintenance=0,
        current_debt=current_debt
    )


@app.delete("/customers/{customer_id}/")
def delete_customer(customer_id: str, db: Session = Depends(get_db)):
    ok = crud.delete_customer(db=db, customer_id=customer_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Customer not found")
    return {"status": "deleted"}


@app.get("/customers/{customer_id}/report/")
def download_customer_report(customer_id: str, db: Session = Depends(get_db)):
    # Verify customer exists
    import uuid
    from fastapi.responses import FileResponse
    from .report_generator import generate_customer_statement_pdf
    
    target_id = uuid.UUID(customer_id) if isinstance(customer_id, str) else customer_id
    customer = db.query(models.Customer).filter(models.Customer.id == target_id).first()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
        
    pdf_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), f"customer_{customer_id}_statement.pdf")
    try:
        generate_customer_statement_pdf(customer_id, pdf_path)
        if os.path.exists(pdf_path):
            return FileResponse(
                pdf_path, 
                media_type="application/pdf", 
                filename=f"statement_{customer.name.replace(' ', '_')}.pdf"
            )
        else:
            raise HTTPException(status_code=500, detail="Failed to generate PDF report")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Report Generation Error: {str(e)}")


def send_whatsapp_payment_receipt_to_customer(customer_phone: str, customer_name: str, paid_amount: float, remaining_debt: float, notes: Optional[str] = None):
    """Send a premium WhatsApp payment receipt directly to the customer."""
    db_session = SessionLocal()
    try:
        from .crud import get_shop_settings
        settings_data = get_shop_settings(db_session)
        shop_title = settings_data.shop_name if settings_data and settings_data.shop_name else "M MOBILE CENTER"
        
        paid_formatted = f"{int(paid_amount):,} د.ع"
        remaining_formatted = f"{int(remaining_debt):,} د.ع" if remaining_debt > 0 else "0 د.ع (مسدد بالكامل 🎉)"
        
        message = (
            f"🏪 *{shop_title}*\n"
            f"━━━━━━━━━━━━━━━━━━━━━\n\n"
            f"السلام عليكم ورحمة الله وبركاته\n"
            f"عزيزنا الزبون *{customer_name}*،\n\n"
            f"تم استلام وتوثيق دفعتكم بنجاح وتم تنزيلها من الحساب.\n\n"
            f"🧾 *تفاصيل وصل الاستلام:*\n"
            f"┌ 💵 المبلغ الواصل: {paid_formatted}\n"
            f"├ 💰 المتبقي بذمتكم: {remaining_formatted}\n"
            f"└ 📝 ملاحظات: {notes or 'تنزيل من الحساب'}\n\n"
            f"نشكر التزامكم ونتطلع لخدمتكم دائماً. 🙏"
        )
        r = py_requests.post(
            "http://127.0.0.1:8001/send",
            json={"phone": customer_phone, "message": message},
            timeout=15
        )
        if r.status_code == 200:
            print(f"WhatsApp receipt sent successfully to {customer_phone}")
        else:
            print(f"WhatsApp service returned error: {r.text}")
    except Exception as e:
        print(f"Failed to send WhatsApp payment receipt to customer: {e}")
    finally:
        db_session.close()


@app.get("/customers/{customer_id}/payments/", response_model=List[schemas.CustomerPaymentResponse])
def get_customer_payments_endpoint(customer_id: str, db: Session = Depends(get_db)):
    return crud.get_customer_payments(db=db, customer_id=customer_id)


@app.post("/customers/{customer_id}/payments/", response_model=schemas.CustomerPaymentResponse, status_code=201)
def create_customer_payment_endpoint(
    customer_id: str, 
    request: schemas.CustomerPaymentCreate, 
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    payment = crud.create_customer_payment(
        db=db,
        customer_id=customer_id,
        amount=float(request.amount),
        notes=request.notes,
        payment_date=request.payment_date
    )
    if payment:
        # Fetch customer to get phone and name
        import uuid
        c_uuid = uuid.UUID(customer_id) if isinstance(customer_id, str) else customer_id
        customer = db.query(models.Customer).filter(models.Customer.id == c_uuid).first()
        if customer and customer.phone:
            # Calculate remaining debt
            remaining_debt = float(crud.calculate_customer_debt(db, customer))
            background_tasks.add_task(
                send_whatsapp_payment_receipt_to_customer,
                customer.phone,
                customer.name,
                float(payment.amount),
                remaining_debt,
                payment.notes
            )
    return payment


@app.get("/shop-settings/", response_model=schemas.ShopSettingsResponse)
def get_shop_settings(db: Session = Depends(get_db)):
    return crud.get_shop_settings(db)


@app.post("/shop-settings/", response_model=schemas.ShopSettingsResponse)
def update_shop_settings(settings: schemas.ShopSettingsBase, db: Session = Depends(get_db)):
    return crud.update_shop_settings(db, settings)


# ─────────────────────────────────────────────────────────
# User Authentication Endpoints
# ─────────────────────────────────────────────────────────

@app.post("/auth/register/", response_model=schemas.UserResponse, status_code=201)
def register_user(user: schemas.UserCreate, db: Session = Depends(get_db)):
    db_user = crud.get_user_by_username(db, user.username)
    if db_user:
        raise HTTPException(status_code=400, detail="اسم المستخدم مسجل بالفعل.")
    
    # Enforce first user registered is always admin
    user_count = db.query(models.User).count()
    if user_count == 0:
        user.role = "admin"
        
    return crud.create_user(db, user)


@app.post("/auth/login/")
def login(user: schemas.UserLogin, db: Session = Depends(get_db)):
    from datetime import datetime, timezone
    db_user = crud.get_user_by_username(db, user.username)
    if not db_user or not crud.verify_password(db_user.hashed_password, user.password):
        raise HTTPException(status_code=400, detail="اسم المستخدم أو رمز المرور غير صحيح.")
        
    # Check if account is active
    if getattr(db_user, 'is_active', 1) == 0:
        raise HTTPException(status_code=403, detail="هذا الحساب معطل حالياً. يرجى التواصل مع الإدارة للتفعيل.")
        
    # Check subscription expiration for non-superadmin users
    if getattr(db_user, 'is_super_admin', 0) == 0 and getattr(db_user, 'subscription_end', None):
        now_utc = datetime.now(timezone.utc)
        sub_end = db_user.subscription_end
        if sub_end.tzinfo is None:
            sub_end = sub_end.replace(tzinfo=timezone.utc)
        if now_utc > sub_end:
            raise HTTPException(status_code=403, detail="انتهت فترة اشتراكك في النظام! يرجى تجديد الاشتراك للمتابعة.")

    return {
        "status": "success",
        "user": {
            "id": str(db_user.id),
            "username": db_user.username,
            "role": db_user.role,
            "tenant_id": getattr(db_user, 'tenant_id', 'default'),
            "shop_name": getattr(db_user, 'shop_name', 'متجر الموبايل'),
            "is_super_admin": getattr(db_user, 'is_super_admin', 0),
            "subscription_end": db_user.subscription_end.isoformat() if getattr(db_user, 'subscription_end', None) else None
        }
    }


@app.get("/auth/users/")
def list_users(db: Session = Depends(get_db)):
    users = db.query(models.User).order_by(models.User.created_at.desc()).all()
    return [{
        "id": str(u.id), 
        "username": u.username, 
        "role": u.role, 
        "tenant_id": getattr(u, 'tenant_id', 'default'),
        "shop_name": getattr(u, 'shop_name', 'متجر الموبايل'),
        "is_active": getattr(u, 'is_active', 1),
        "is_super_admin": getattr(u, 'is_super_admin', 0),
        "subscription_end": u.subscription_end.isoformat() if getattr(u, 'subscription_end', None) else None,
        "created_at": u.created_at
    } for u in users]


class SuperAdminTenantCreate(BaseModel):
    username: str
    password: str
    shop_name: str
    subscription_days: int = 30


@app.post("/admin/tenants/", status_code=201)
def create_tenant_account(req: SuperAdminTenantCreate, db: Session = Depends(get_db)):
    from datetime import datetime, timedelta, timezone
    import uuid
    
    existing = crud.get_user_by_username(db, req.username)
    if existing:
        raise HTTPException(status_code=400, detail="اسم المستخدم موجود بالفعل.")
        
    start_date = datetime.now(timezone.utc)
    end_date = start_date + timedelta(days=req.subscription_days)
    tenant_code = f"shop_{str(uuid.uuid4())[:8]}"
    
    new_user = models.User(
        username=req.username,
        hashed_password=crud.get_password_hash(req.password),
        role="admin",
        tenant_id=tenant_code,
        shop_name=req.shop_name,
        is_active=1,
        is_super_admin=0,
        subscription_start=start_date,
        subscription_end=end_date
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    
    return {
        "status": "success",
        "message": f"تم إنشاء حساب المحل '{req.shop_name}' بنجاح لمدة {req.subscription_days} يوم.",
        "tenant_id": tenant_code,
        "username": req.username,
        "subscription_end": end_date.isoformat()
    }


class RenewSubscriptionRequest(BaseModel):
    user_id: str
    additional_days: int = 30


@app.post("/admin/tenants/renew/")
def renew_tenant_subscription(req: RenewSubscriptionRequest, db: Session = Depends(get_db)):
    from datetime import datetime, timedelta, timezone
    import uuid
    uid = uuid.UUID(req.user_id) if isinstance(req.user_id, str) else req.user_id
    u = db.query(models.User).filter(models.User.id == uid).first()
    if not u:
        raise HTTPException(status_code=404, detail="الحساب غير موجود.")
        
    now = datetime.now(timezone.utc)
    current_end = u.subscription_end if u.subscription_end else now
    if current_end.tzinfo is None:
        current_end = current_end.replace(tzinfo=timezone.utc)
        
    base_date = max(now, current_end)
    new_end = base_date + timedelta(days=req.additional_days)
    u.subscription_end = new_end
    u.is_active = 1
    db.commit()
    return {"status": "success", "new_subscription_end": new_end.isoformat()}


@app.post("/admin/tenants/toggle-status/")
def toggle_tenant_status(user_id: str, db: Session = Depends(get_db)):
    import uuid
    uid = uuid.UUID(user_id) if isinstance(user_id, str) else user_id
    u = db.query(models.User).filter(models.User.id == uid).first()
    if not u:
        raise HTTPException(status_code=404, detail="الحساب غير موجود.")
    u.is_active = 0 if u.is_active == 1 else 1
    db.commit()
    return {"status": "success", "is_active": u.is_active}


@app.delete("/auth/users/{user_id}/")
def delete_user(user_id: str, db: Session = Depends(get_db)):
    import uuid
    uid = uuid.UUID(user_id) if isinstance(user_id, str) else user_id
    db_user = db.query(models.User).filter(models.User.id == uid).first()
    if not db_user:
        raise HTTPException(status_code=404, detail="المستخدم غير موجود.")
    db.delete(db_user)
    db.commit()
    return {"status": "success"}

