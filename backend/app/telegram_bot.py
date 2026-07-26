import os
import sys
import time
import requests

STATES_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "bot_states.json")

def load_states():
    if not os.path.exists(STATES_FILE):
        return {}
    try:
        with open(STATES_FILE, "r", encoding="utf-8") as f:
            import json
            data = json.load(f)
            return {int(k): v for k, v in data.items()}
    except Exception:
        return {}

user_states = load_states()

def persist_states():
    try:
        with open(STATES_FILE, "w", encoding="utf-8") as f:
            import json
            data = {str(k): v for k, v in user_states.items()}
            json.dump(data, f, ensure_ascii=False, indent=2)
    except Exception as e:
        print(f"Error saving bot states: {e}")

def set_state(chat_id, state):
    user_states[chat_id] = state
    persist_states()

def clear_state(chat_id):
    user_states.pop(chat_id, None)
    persist_states()

def toEnglishDigits(s):
    if not isinstance(s, str):
        return s
    arabic_digits = "٠١٢٣٤٥٦٧٨٩"
    english_digits = "0123456789"
    translation_table = str.maketrans(arabic_digits, english_digits)
    return s.translate(translation_table)

# Add the parent directory to sys.path to allow absolute imports of the 'app' package
current_dir = os.path.dirname(os.path.abspath(__file__))
parent_dir = os.path.dirname(current_dir)
if parent_dir not in sys.path:
    sys.path.insert(0, parent_dir)

from app.database import SessionLocal
from app import models
from sqlalchemy import func


def get_all_inventory():
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
        return results
    except Exception as e:
        print(f"Database query error: {e}")
        return []
    finally:
        db.close()

def get_system_setting(key: str) -> str:
    try:
        from app.database import SessionLocal
        from sqlalchemy import text
        db = SessionLocal()
        try:
            res = db.execute(text("SELECT value FROM system_settings WHERE key = :key"), {"key": key}).fetchone()
            return res[0] if res else ""
        finally:
            db.close()
    except Exception:
        return ""

def set_system_setting(key: str, value: str):
    try:
        from app.database import SessionLocal
        from sqlalchemy import text
        db = SessionLocal()
        try:
            # Check if key exists
            res = db.execute(text("SELECT 1 FROM system_settings WHERE key = :key"), {"key": key}).fetchone()
            if res:
                db.execute(text("UPDATE system_settings SET value = :value WHERE key = :key"), {"key": key, "value": value})
            else:
                db.execute(text("INSERT INTO system_settings (key, value) VALUES (:key, :value)"), {"key": key, "value": value})
            db.commit()
        finally:
            db.close()
    except Exception as e:
        print(f"Error saving system setting {key}: {e}")

def get_telegram_token():
    token = get_system_setting("telegram_token")
    if token:
        return token
    token_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "telegram_token.txt")
    if not os.path.exists(token_path):
        return None
    with open(token_path, "r", encoding="utf-8") as f:
        return f.read().strip()

def is_user_allowed(message):
    allowed = []
    # 1. Load from DB settings
    allowed_str = get_system_setting("allowed_users")
    if allowed_str:
        allowed.extend([u.strip().lower() for u in allowed_str.split(",") if u.strip()])
    
    # 2. Load from text file
    filepath = os.path.join(os.path.dirname(os.path.abspath(__file__)), "allowed_users.txt")
    if os.path.exists(filepath):
        with open(filepath, "r", encoding="utf-8") as f:
            allowed.extend([line.strip().lower() for line in f if line.strip()])
            
    if not allowed:
        return False
        
    from_user = message.get("from", {})
    user_id = str(from_user.get("id", ""))
    username = from_user.get("username", "")
    username = username.lower() if username else ""
    
    if user_id in allowed:
        return True
    if username in allowed:
        return True
    if f"@{username}" in allowed:
        return True
    return False

def register_chat_id(chat_id):
    try:
        filepath = os.path.join(os.path.dirname(os.path.abspath(__file__)), "registered_chats.txt")
        existing = set()
        if os.path.exists(filepath):
            with open(filepath, "r") as f:
                existing = {line.strip() for line in f if line.strip()}
        
        if str(chat_id) not in existing:
            with open(filepath, "a") as f:
                f.write(f"{chat_id}\n")
    except Exception as e:
        print(f"Error registering chat: {e}")

def send_daily_report_to_all_chats(target_date=None):
    token = get_telegram_token()
    if not token or token == "YOUR_TOKEN_HERE":
        print("No Telegram token available for daily report.")
        return
        
    filepath = os.path.join(os.path.dirname(os.path.abspath(__file__)), "registered_chats.txt")
    if not os.path.exists(filepath):
        print("No registered chats for daily report.")
        return
        
    with open(filepath, "r") as f:
        chat_ids = [line.strip() for line in f if line.strip()]
        
    if not chat_ids:
        return
        
    pdf_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "daily_report.pdf")
    try:
        from report_generator import generate_daily_report_pdf
        generate_daily_report_pdf(pdf_path, target_date)
    except Exception as e:
        print(f"Error generating daily PDF report: {e}")
        return
        
    api_url = f"https://api.telegram.org/bot{token}"
    for cid in chat_ids:
        try:
            with open(pdf_path, "rb") as pdf:
                files = {'document': pdf}
                payload = {
                    'chat_id': cid,
                    'caption': "📊 التقرير المالي والتشغيلي اليومي المكتمل لمتجر M MOBILE",
                    'parse_mode': 'Markdown'
                }
                requests.post(f"{api_url}/sendDocument", data=payload, files=files)
        except Exception as e:
            print(f"Error sending document to {cid}: {e}")
            
    try:
        os.remove(pdf_path)
    except Exception:
        pass

def send_db_backup_to_all_chats():
    token = get_telegram_token()
    if not token or token == "YOUR_TOKEN_HERE":
        return
        
    filepath = os.path.join(os.path.dirname(os.path.abspath(__file__)), "registered_chats.txt")
    if not os.path.exists(filepath):
        return
        
    with open(filepath, "r") as f:
        chat_ids = [line.strip() for line in f if line.strip()]
        
    if not chat_ids:
        return
        
    import platform
    if platform.system() == "Darwin":      # macOS
        db_dir = os.path.expanduser("~/Library/Application Support/MMobile")
    elif platform.system() == "Windows":    # Windows
        db_dir = os.path.join(os.getenv("APPDATA", os.path.expanduser("~")), "MMobile")
    else:                                   # Linux/other
        db_dir = os.path.expanduser("~/.m_mobile")
    
    db_path = os.path.join(db_dir, "accounting.db")
    if not os.path.exists(db_path):
        return
        
    api_url = f"https://api.telegram.org/bot{token}"
    for cid in chat_ids:
        try:
            with open(db_path, "rb") as db_file:
                files = {'document': db_file}
                payload = {
                    'chat_id': cid,
                    'caption': f"📦 نسخة احتياطية تلقائية لقاعدة البيانات (Backup)\n📅 التاريخ: {time.strftime('%Y-%m-%d %H:%M')}",
                    'parse_mode': 'Markdown'
                }
                requests.post(f"{api_url}/sendDocument", data=payload, files=files)
        except Exception as e:
            print(f"Error sending backup to {cid}: {e}")

def daily_report_scheduler_loop():
    import datetime
    import time
    print("Daily PDF Report & Backup Scheduler started.")
    last_backup_time = time.time()  # Start counting from now - first backup after 12 hours, not immediately
    last_report_time = time.time()  # Start counting from now - first report after 12 hours
    
    while True:
        try:
            now = datetime.datetime.now()
            current_time = time.time()
            
            # 1. Send daily PDF report every 12 hours
            if current_time - last_report_time >= 12 * 3600:
                print(f"Time is {now.strftime('%H:%M')}. Generating and sending daily PDF report...")
                yesterday = now.date() - datetime.timedelta(days=1)
                send_daily_report_to_all_chats(target_date=yesterday)
                last_report_time = current_time
            
            # 2. Send database backup every 12 hours (wait full 12h from startup, never immediately)
            if current_time - last_backup_time >= 12 * 3600:
                print("Sending 12-hour database backup to all chats...")
                send_db_backup_to_all_chats()
                last_backup_time = current_time
                
        except Exception as e:
            print(f"Error in daily report scheduler: {e}")
            
        time.sleep(30)

def run_bot():
    # Single-instance lock — prevent duplicate bots
    import fcntl
    LOCK_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "bot.lock")
    lock_fp = open(LOCK_FILE, "w")
    try:
        fcntl.flock(lock_fp, fcntl.LOCK_EX | fcntl.LOCK_NB)
    except IOError:
        print("Another bot instance is already running. Exiting.")
        lock_fp.close()
        return

    from app.database import SessionLocal
    token = get_telegram_token()
    if not token or token == "YOUR_TOKEN_HERE":
        print("Telegram bot token is empty or missing. Please configure it.")
        return

    # Start daily report scheduler thread
    import threading
    scheduler_thread = threading.Thread(target=daily_report_scheduler_loop, daemon=True)
    scheduler_thread.start()

    print(f"Starting Telegram Bot with token: {token[:10]}...")
    api_url = f"https://api.telegram.org/bot{token}"
    
    # Clear previous updates
    requests.get(f"{api_url}/getUpdates?offset=-1")
    offset = 0

    type_mapping = {
        "Phone": "📱 أجهزة الموبايل",
        "Accessory": "🔌 الإكسسوارات",
        "Maintenance": "🔧 قطع الصيانة"
    }

    KEYBOARD_MARKUP = {
        "keyboard": [
            [{"text": "📊 التقرير اليومي"}, {"text": "📋 جرد المخزن كامل"}],
            [{"text": "📊 التقرير الأسبوعي"}, {"text": "📊 التقرير الشهري"}],
            [{"text": "🔧 الصيانة الجاهزة"}, {"text": "⚠️ النواقص"}],
            [{"text": "💸 تسديد دين لزبون"}, {"text": "📄 كشف حساب لزبون"}],
            [{"text": "📦 نسخ احتياطي"}, {"text": "⚙️ إدارة المسؤولين"}],
            [{"text": "ℹ️ تعليمات البوت"}]
        ],
        "resize_keyboard": True,
        "one_time_keyboard": False
    }

    def send_msg(chat_id, text, parse_mode="Markdown"):
        payload = {
            "chat_id": chat_id,
            "text": text,
            "parse_mode": parse_mode,
            "reply_markup": KEYBOARD_MARKUP
        }
        try:
            requests.post(f"{api_url}/sendMessage", json=payload)
        except Exception as e:
            print(f"Error sending message: {e}")

    while True:
        try:
            response = requests.get(f"{api_url}/getUpdates?offset={offset}&timeout=30", timeout=35)
            if response.status_code != 200:
                time.sleep(5)
                continue
                
            data = response.json()
            if not data.get("ok"):
                time.sleep(5)
                continue

            for update in data.get("result", []):
                print(f"BOT UPDATE RECEIVED: {update}")
                offset = update["update_id"] + 1
                
                # Handle callback query (inline button click)
                callback_query = update.get("callback_query", {})
                if callback_query:
                    chat_id = callback_query.get("message", {}).get("chat", {}).get("id")
                    data_payload = callback_query.get("data", "")
                    
                    if not is_user_allowed(callback_query):
                        requests.post(f"{api_url}/answerCallbackQuery", json={"callback_query_id": callback_query.get("id"), "text": "⚠️ غير مصرح لك"})
                        continue
                        
                    if data_payload.startswith("pay_cust_"):
                        cust_id = data_payload.replace("pay_cust_", "")
                        db = SessionLocal()
                        try:
                            import uuid
                            from app import crud
                            cust_uuid = uuid.UUID(cust_id)
                            cust = db.query(models.Customer).filter(models.Customer.id == cust_uuid).first()
                            if cust:
                                current_debt = crud.calculate_customer_debt(db, cust)
                                # Extract user details
                                from_user = callback_query.get("from", {})
                                operator_name = from_user.get("first_name", "مجهول")
                                operator_username = from_user.get("username", "")
                                operator_id = from_user.get("id", "")
                                
                                set_state(chat_id, {
                                    "action": "waiting_payment_amount",
                                    "customer_id": cust_id,
                                    "customer_name": cust.name,
                                    "operator_name": operator_name,
                                    "operator_username": f"@{operator_username}" if operator_username else "",
                                    "operator_id": str(operator_id)
                                })
                                requests.post(f"{api_url}/answerCallbackQuery", json={"callback_query_id": callback_query.get("id")})
                                send_msg(chat_id, f"👤 الزبون: *{cust.name}*\n💰 صافي الدين المتبقي: *{current_debt:,.0f} د.ع*\n\n👈 يرجى إرسال مبلغ التسديد الآن كرسالة نصية (أرقام فقط، مثال: 25000) أو أرسل إلغاء:")
                        except Exception as e:
                            print(f"Error handling callback: {e}")
                        finally:
                            db.close()
                    elif data_payload.startswith("pdf_cust_"):
                        cust_id = data_payload.replace("pdf_cust_", "")
                        db = SessionLocal()
                        try:
                            import uuid
                            from app.report_generator import generate_customer_statement_pdf
                            cust_uuid = uuid.UUID(cust_id)
                            cust = db.query(models.Customer).filter(models.Customer.id == cust_uuid).first()
                            if cust:
                                requests.post(f"{api_url}/answerCallbackQuery", json={"callback_query_id": callback_query.get("id"), "text": "⏳ جاري توليد الملف..."})
                                send_msg(chat_id, f"⏳ جاري توليد كشف حساب تفصيلي بصيغة PDF للزبون: *{cust.name}*...")
                                
                                pdf_path = os.path.join(current_dir, f"report_{cust.id.hex[:8]}.pdf")
                                try:
                                    generate_customer_statement_pdf(str(cust.id), pdf_path)
                                    with open(pdf_path, "rb") as pdf_file:
                                        requests.post(
                                            f"{api_url}/sendDocument",
                                            data={
                                                "chat_id": chat_id,
                                                "caption": f"📄 كشف حساب وتفاصيل ديون وأقساط الزبون: *{cust.name}*\n📞 رقم الهاتف: {cust.phone or 'غير مسجل'}",
                                                "parse_mode": "Markdown"
                                            },
                                            files={"document": pdf_file}
                                        )
                                finally:
                                    if os.path.exists(pdf_path):
                                        os.remove(pdf_path)
                            else:
                                requests.post(f"{api_url}/answerCallbackQuery", json={"callback_query_id": callback_query.get("id"), "text": "❌ لم يتم العثور على الزبون"})
                        except Exception as e:
                            send_msg(chat_id, f"❌ خطأ أثناء توليد ملف الكشف: {str(e)}")
                        finally:
                            db.close()
                    elif data_payload == "admin_add":
                        requests.post(f"{api_url}/answerCallbackQuery", json={"callback_query_id": callback_query.get("id")})
                        set_state(chat_id, {"action": "waiting_admin_username"})
                        send_msg(chat_id, "➕ *إضافة مسؤول جديد:*\n\nيرجى إرسال معرف التليجرام الخاص به (Username) أو الرقم التعريفي الخاص به (Chat ID) الآن:\n*(مثال: mustafa_ali أو 123456789)*")
                    elif data_payload == "admin_remove":
                        requests.post(f"{api_url}/answerCallbackQuery", json={"callback_query_id": callback_query.get("id")})
                        set_state(chat_id, {"action": "waiting_remove_admin"})
                        current_str = get_system_setting("allowed_users") or ""
                        current_list = [u.strip() for u in current_str.split(",") if u.strip()]
                        admins_text = "\n".join([f"• `{adm}`" for adm in current_list])
                        send_msg(chat_id, f"🗑️ *إزالة مسؤول:*\n\nالمسؤولين الحاليين:\n{admins_text}\n\nيرجى كتابة اسم المستخدم المراد إزالته بدقة:")
                    elif data_payload == "admin_list":
                        requests.post(f"{api_url}/answerCallbackQuery", json={"callback_query_id": callback_query.get("id")})
                        current_str = get_system_setting("allowed_users") or ""
                        current_list = [u.strip() for u in current_str.split(",") if u.strip()]
                        admins_text = "\n".join([f"• `{adm}`" for adm in current_list])
                        send_msg(chat_id, f"👥 *قائمة المسؤولين الحاليين:*\n\n{admins_text}")
                    elif data_payload == "admin_cancel":
                        requests.post(f"{api_url}/answerCallbackQuery", json={"callback_query_id": callback_query.get("id")})
                        clear_state(chat_id)
                        send_msg(chat_id, "❌ تم إلغاء العملية.")
                    continue

                message = update.get("message", {})
                chat_id = message.get("chat", {}).get("id")
                text = message.get("text", "").strip()
                
                # Dynamic debug log path relative to backend folder
                debug_log_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "bot_debug.log")
                with open(debug_log_path, "a", encoding="utf-8") as f_debug:
                    f_debug.write(f"Received text: '{text}' (chat_id: {chat_id}) (states: {str(user_states)})\n")

                if not chat_id or not text:
                    continue

                # Check if user is in a state
                state = user_states.get(chat_id)
                if state:
                    action = state.get("action")
                    if text in ["/cancel", "إلغاء", "تراجع"]:
                        clear_state(chat_id)
                        send_msg(chat_id, "❌ تم إلغاء العملية.")
                        continue

                    if action == "waiting_admin_username":
                        admin_to_add = text.replace("@", "").strip().lower()
                        if not admin_to_add:
                            send_msg(chat_id, "⚠️ يرجى إدخال اسم مستخدم صحيح أو أرسل إلغاء:")
                            continue
                            
                        # Load current allowed users
                        current_str = get_system_setting("allowed_users") or ""
                        current_list = [u.strip().lower() for u in current_str.split(",") if u.strip()]
                        
                        if admin_to_add in current_list:
                            send_msg(chat_id, f"ℹ️ المستخدم *{admin_to_add}* هو مسؤول بالفعل في النظام.")
                        else:
                            current_list.append(admin_to_add)
                            set_system_setting("allowed_users", ",".join(current_list))
                            send_msg(chat_id, f"✅ تم إضافة المسؤول *{admin_to_add}* بنجاح وتفعيل صلاحياته!")
                            
                        clear_state(chat_id)
                        continue

                    if action == "waiting_remove_admin":
                        admin_to_remove = text.replace("@", "").strip().lower()
                        current_str = get_system_setting("allowed_users") or ""
                        current_list = [u.strip().lower() for u in current_str.split(",") if u.strip()]
                        
                        if admin_to_remove not in current_list:
                            send_msg(chat_id, f"⚠️ لم يتم العثور على المسؤول *{admin_to_remove}* في قائمة الإدارة.")
                        elif admin_to_remove in ["muvtc", "1538485619", str(chat_id)]:
                            send_msg(chat_id, "❌ لا يمكن حذف المالك الأساسي أو حسابك الشخصي من الإدارة لضمان عدم قفل البوت.")
                        else:
                            current_list.remove(admin_to_remove)
                            set_system_setting("allowed_users", ",".join(current_list))
                            send_msg(chat_id, f"✅ تم إزالة المسؤول *{admin_to_remove}* بنجاح وسحب كافة الصلاحيات منه.")
                            
                        clear_state(chat_id)
                        continue

                    if action == "waiting_payment_amount":

                        cleaned_text = toEnglishDigits(text)
                        try:
                            amount = float(cleaned_text)
                            if amount <= 0:
                                raise ValueError()
                        except ValueError:
                            send_msg(chat_id, "⚠️ يرجى كتابة مبلغ صحيح بالأرقام فقط (مثال: 50000) أو أرسل إلغاء لتراجع عن العملية:")
                            continue

                        db = SessionLocal()
                        try:
                            from app import crud
                            import uuid
                            cust_uuid = uuid.UUID(state["customer_id"])
                            cust = db.query(models.Customer).filter(models.Customer.id == cust_uuid).first()
                            if not cust:
                                send_msg(chat_id, "❌ لم يتم العثور على الزبون.")
                                clear_state(chat_id)
                                continue
                                
                            # Construct operator info for notes
                            operator_info = f"بواسطة البوت: {state.get('operator_name', 'مجهول')}"
                            if state.get("operator_username"):
                                operator_info += f" ({state.get('operator_username')})"
                            operator_info += f" [ID: {state.get('operator_id', 'بدون')}]"

                            crud.create_customer_payment(
                                db=db,
                                customer_id=state["customer_id"],
                                amount=amount,
                                notes=f"تسديد عبر البوت ({operator_info})"
                            )
                            db.commit()
                            
                            new_debt = crud.calculate_customer_debt(db, cust)
                            send_msg(chat_id, f"✅ تم تسديد مبلغ *{amount:,.0f} د.ع* بنجاح للزبون *{cust.name}*!\n📉 صافي الدين المتبقي له الآن: *{new_debt:,.0f} د.ع*.\n👤 المسؤول عن الإدخال: *{state.get('operator_name')}*")
                            clear_state(chat_id)
                        except Exception as e:
                            send_msg(chat_id, f"❌ حدث خطأ أثناء تسجيل الدفعة: {str(e)}")
                            clear_state(chat_id)
                        finally:
                            db.close()
                        continue

                if not is_user_allowed(message):
                    # Reply with unauthorized message
                    send_msg(chat_id, "⚠️ عذراً، حسابك غير مصرح له باستخدام هذا البوت. يرجى الطلب من مسؤول النظام إضافة حسابك في الإعدادات.")
                    continue

                register_chat_id(chat_id)

                if text.lower() in ["/start", "ℹ️ تعليمات البوت", "تعليمات", "مساعدة"]:
                    welcome_msg = (
                        "👋 أهلاً بك في بوت إدارة مركز M MOBILE!\n\n"
                        "📊 *التقارير المالية والتشغيلية:*\n"
                        "• أرسل *تقرير* أو *اليومي* للتقرير اليومي.\n"
                        "• أرسل *اسبوعي* للتقرير الأسبوعي (آخر 7 أيام).\n"
                        "• أرسل *شهري* للتقرير الشهري (آخر 30 يوم).\n\n"
                        "📋 *الجرد والمخزن:*\n"
                        "• أرسل *الكل* أو *جرد* لتحميل ملف الجرد مقسماً لأقسام (هواتف، إكسسوارات، صيانة).\n"
                        "• أرسل *نواقص* للقطع التي أوشكت على النفاد.\n\n"
                        "💼 *الزبائن والديون:*\n"
                        "• أرسل *كشف [الاسم]* لتحميل كشف ديونه وأقساطه بصيغة PDF.\n"
                        "• استخدم زر *تسديد دين لزبون* لتنزيل دفعة لزبون.\n\n"
                        "📦 *أمان النظام:*\n"
                        "• أرسل *باك اب* لتحميل قاعدة البيانات الاحتياطية.\n\n"
                        "💡 *نصيحة:* استخدم الأزرار في الأسفل لتنفيذ هذه الأوامر بضغطة زر واحدة!"
                    )
                    send_msg(chat_id, welcome_msg)
                    continue

                if text.lower() in ["/pay", "تسديد", "💸 تسديد دين لزبون", "تسديد لزبون"]:
                    db = SessionLocal()
                    try:
                        from app import crud
                        customers = db.query(models.Customer).order_by(models.Customer.name.asc()).all()
                        debtors = []
                        for c in customers:
                            debt = crud.calculate_customer_debt(db, c)
                            if debt > 0:
                                debtors.append((c.id, c.name, debt))
                                
                        if not debtors:
                            send_msg(chat_id, "🟢 لا يوجد أي زبون مترتب عليه ديون حالياً!")
                        else:
                            inline_keyboard = []
                            for c_id, name, debt in debtors:
                                inline_keyboard.append([{
                                    "text": f"{name} (مطلوب: {int(debt):,} د.ع)",
                                    "callback_data": f"pay_cust_{c_id.hex}"
                                }])
                                
                            payload = {
                                "chat_id": chat_id,
                                "text": "👤 *اختر الزبون المراد تسديد دينه من القائمة أدناه (مرتبة أبجدياً أ-ي):*",
                                "parse_mode": "Markdown",
                                "reply_markup": {
                                    "inline_keyboard": inline_keyboard
                                }
                            }
                            requests.post(f"{api_url}/sendMessage", json=payload)
                    except Exception as e:
                        send_msg(chat_id, f"❌ خطأ أثناء جلب قائمة المدينين: {str(e)}")
                    finally:
                        db.close()
                    continue

                if text.lower() in ["كشف حساب لزبون", "📄 كشف حساب لزبون"]:
                    db = SessionLocal()
                    try:
                        customers = db.query(models.Customer).order_by(models.Customer.name.asc()).all()
                        if not customers:
                            send_msg(chat_id, "🟢 لا يوجد أي زبون مسجل في قاعدة البيانات حالياً!")
                        else:
                            inline_keyboard = []
                            for c in customers:
                                inline_keyboard.append([{
                                    "text": c.name,
                                    "callback_data": f"pdf_cust_{c.id.hex}"
                                }])
                                
                            payload = {
                                "chat_id": chat_id,
                                "text": "📄 *اختر الزبون أدناه لتحميل كشف حسابه PDF (مرتبة أبجدياً أ-ي):*",
                                "parse_mode": "Markdown",
                                "reply_markup": {
                                    "inline_keyboard": inline_keyboard
                                }
                            }
                            requests.post(f"{api_url}/sendMessage", json=payload)
                    except Exception as e:
                        send_msg(chat_id, f"❌ خطأ أثناء جلب قائمة الزبائن: {str(e)}")
                    finally:
                        db.close()
                    continue

                if text.lower() in ["/backup", "نسخ", "نسخة احتياطية", "نسخه احتياطيه", "باك اب", "باكاب", "قاعدة البيانات", "📦 نسخ احتياطي"]:
                    def is_database_empty(path: str) -> bool:
                        import sqlite3
                        if not os.path.exists(path):
                            return True
                        try:
                            conn = sqlite3.connect(path)
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

                    import platform
                    if platform.system() == "Darwin":      # macOS
                        db_dir = os.path.expanduser("~/Library/Application Support/MMobile")
                    elif platform.system() == "Windows":    # Windows
                        db_dir = os.path.join(os.getenv("APPDATA", os.path.expanduser("~")), "MMobile")
                    else:                                   # Linux/other
                        db_dir = os.path.expanduser("~/.m_mobile")
                    
                    db_path = os.path.join(db_dir, "accounting.db")
                    
                    is_empty = is_database_empty(db_path)
                    backup_to_send = db_path
                    warn_msg = ""
                    
                    if is_empty:
                        project_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
                        local_backup = os.path.join(project_dir, "backups", "accounting_backup.db")
                        doc_backup = os.path.expanduser("~/Documents/MMobile_LocalBackup/accounting.db")
                        
                        if os.path.exists(local_backup) and not is_database_empty(local_backup):
                            backup_to_send = local_backup
                            warn_msg = "⚠️ تنبيه: قاعدة البيانات النشطة فارغة! تم إرسال آخر نسخة احتياطية تحتوي على بيانات.\n\n"
                        elif os.path.exists(doc_backup) and not is_database_empty(doc_backup):
                            backup_to_send = doc_backup
                            warn_msg = "⚠️ تنبيه: قاعدة البيانات النشطة فارغة! تم إرسال آخر نسخة احتياطية من المستندات.\n\n"
                        else:
                            warn_msg = "⚠️ تنبيه: قاعدة البيانات والنسخ الاحتياطية فارغة تماماً.\n\n"
                    
                    if os.path.exists(backup_to_send):
                        try:
                            # Send db file directly as document
                            with open(backup_to_send, "rb") as db_file:
                                files = {'document': db_file}
                                payload = {
                                    'chat_id': chat_id,
                                    'caption': f"{warn_msg}📦 نسخة احتياطية لقاعدة البيانات بطلب منك\n📅 التاريخ: {time.strftime('%Y-%m-%d %H:%M:%S')}",
                                    'parse_mode': 'Markdown'
                                }
                                requests.post(f"{api_url}/sendDocument", data=payload, files=files)
                        except Exception as e:
                            send_msg(chat_id, f"❌ حدث خطأ أثناء إرسال النسخة الاحتياطية:\n`{str(e)}`")
                    else:
                        send_msg(chat_id, "❌ ملف قاعدة البيانات غير موجود على السيرفر.")
                    continue

                # Handle "What I have" command
                if text.lower() in ["/all", "الكل", "شعندي ماعندي", "مخزون", "📋 جرد المخزن كامل"]:
                    send_msg(chat_id, "⏳ جاري توليد تقرير جرد المخزن بصيغة PDF...")
                    pdf_path = os.path.join(current_dir, "inventory_report.pdf")
                    try:
                        from app.report_generator import generate_inventory_report_pdf
                        generate_inventory_report_pdf(pdf_path)
                        with open(pdf_path, "rb") as pdf_file:
                            requests.post(
                                f"{api_url}/sendDocument",
                                data={
                                    "chat_id": chat_id,
                                    "caption": "📋 تقرير جرد بضائع المخزن الحالي لمركز M MOBILE",
                                    "parse_mode": "Markdown"
                                },
                                files={"document": pdf_file}
                            )
                    except Exception as e:
                        send_msg(chat_id, f"❌ خطأ أثناء توليد ملف جرد المخزن: {str(e)}")
                    finally:
                        if os.path.exists(pdf_path):
                            os.remove(pdf_path)
                    continue

                # Handle "Shortages/Low Stock" command
                if text.lower() in ["/shortages", "نواقص", "خلص", "⚠️ النواقص"]:
                    send_msg(chat_id, "⏳ جاري توليد تقرير نواقص المخزن بصيغة PDF...")
                    pdf_path = os.path.join(current_dir, "shortages_report.pdf")
                    try:
                        from app.report_generator import generate_shortages_report_pdf
                        generate_shortages_report_pdf(pdf_path)
                        with open(pdf_path, "rb") as pdf_file:
                            requests.post(
                                f"{api_url}/sendDocument",
                                data={
                                    "chat_id": chat_id,
                                    "caption": "⚠️ تقرير البضائع والنواقص التي أوشكت على النفاد",
                                    "parse_mode": "Markdown"
                                },
                                files={"document": pdf_file}
                            )
                    except Exception as e:
                        send_msg(chat_id, f"❌ خطأ أثناء توليد ملف النواقص: {str(e)}")
                    finally:
                        if os.path.exists(pdf_path):
                            os.remove(pdf_path)
                    continue

                # Handle "Daily PDF Report" command
                if text.lower() in ["/report", "تقرير", "ملخص", "اليومي", "الملخص", "📊 التقرير اليومي"]:
                    pdf_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "requested_report.pdf")
                    try:
                        from app.report_generator import generate_daily_report_pdf
                        generate_daily_report_pdf(pdf_path)
                        
                        with open(pdf_path, "rb") as pdf:
                            files = {'document': pdf}
                            payload = {
                                'chat_id': chat_id,
                                'caption': "📊 التقرير المالي والتشغيلي اليومي لمتجر M MOBILE",
                                'parse_mode': 'Markdown'
                            }
                            requests.post(f"{api_url}/sendDocument", data=payload, files=files)
                    except Exception as e:
                        import traceback
                        error_trace = traceback.format_exc()
                        print(f"Error sending requested PDF report: {e}")
                        send_msg(chat_id, f"❌ عذراً، حدث خطأ أثناء توليد تقرير الـ PDF اليومي:\n`{str(e)}`\n\n```\n{error_trace[:3000]}\n```")
                    finally:
                        if os.path.exists(pdf_path):
                            try:
                                os.remove(pdf_path)
                            except Exception:
                                pass
                    continue

                # Handle "Weekly PDF Report" command (last 7 days)
                if text.lower() in ["/weekly", "اسبوعي", "أسبوعي", "📊 التقرير الأسبوعي"]:
                    send_msg(chat_id, "⏳ جاري حساب وتوليد التقرير المالي الأسبوعي...")
                    pdf_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "weekly_report.pdf")
                    try:
                        import datetime
                        end_date = datetime.datetime.now().date()
                        start_date = end_date - datetime.timedelta(days=7)
                        from app.report_generator import generate_range_report_pdf
                        generate_range_report_pdf(pdf_path, start_date, end_date, "تقرير الأداء المالي والتشغيلي الأسبوعي")
                        
                        with open(pdf_path, "rb") as pdf:
                            files = {'document': pdf}
                            payload = {
                                'chat_id': chat_id,
                                'caption': f"📊 *التقرير المالي الأسبوعي الموحد*\n📅 للفترة من {start_date.strftime('%Y-%m-%d')} إلى {end_date.strftime('%Y-%m-%d')}",
                                'parse_mode': 'Markdown'
                            }
                            requests.post(f"{api_url}/sendDocument", data=payload, files=files)
                    except Exception as e:
                        print(f"Error sending weekly PDF report: {e}")
                        send_msg(chat_id, f"❌ خطأ أثناء توليد التقرير الأسبوعي: {str(e)}")
                    finally:
                        if os.path.exists(pdf_path):
                            try:
                                os.remove(pdf_path)
                            except Exception:
                                pass
                    continue

                # Handle "Monthly PDF Report" command (last 30 days)
                if text.lower() in ["/monthly", "شهري", "📊 التقرير الشهري"]:
                    send_msg(chat_id, "⏳ جاري حساب وتوليد التقرير المالي الشهري...")
                    pdf_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "monthly_report.pdf")
                    try:
                        import datetime
                        end_date = datetime.datetime.now().date()
                        start_date = end_date - datetime.timedelta(days=30)
                        from app.report_generator import generate_range_report_pdf
                        generate_range_report_pdf(pdf_path, start_date, end_date, "تقرير الأداء المالي والتشغيلي الشهري")
                        
                        with open(pdf_path, "rb") as pdf:
                            files = {'document': pdf}
                            payload = {
                                'chat_id': chat_id,
                                'caption': f"📊 *التقرير المالي الشهري الموحد*\n📅 للفترة من {start_date.strftime('%Y-%m-%d')} إلى {end_date.strftime('%Y-%m-%d')}",
                                'parse_mode': 'Markdown'
                            }
                            requests.post(f"{api_url}/sendDocument", data=payload, files=files)
                    except Exception as e:
                        print(f"Error sending monthly PDF report: {e}")
                        send_msg(chat_id, f"❌ خطأ أثناء توليد التقرير الشهري: {str(e)}")
                    finally:
                        if os.path.exists(pdf_path):
                            try:
                                os.remove(pdf_path)
                            except Exception:
                                pass
                    continue

                # Handle "Ready Maintenance Jobs" command
                if text.lower() in ["/maintenance", "صيانة", "مصلوحة", "اجهزة جاهزة", "أجهزة جاهزة", "جاهزة", "🔧 الصيانة الجاهزة"]:
                    send_msg(chat_id, "⏳ جاري توليد تقرير أجهزة الصيانة الجاهزة بصيغة PDF...")
                    pdf_path = os.path.join(current_dir, "ready_maintenance_report.pdf")
                    try:
                        from app.report_generator import generate_maintenance_report_pdf
                        generate_maintenance_report_pdf(pdf_path)
                        with open(pdf_path, "rb") as pdf_file:
                            requests.post(
                                f"{api_url}/sendDocument",
                                data={
                                    "chat_id": chat_id,
                                    "caption": "🔧 كشف بأجهزة الصيانة الجاهزة للتسليم للزبائن",
                                    "parse_mode": "Markdown"
                                },
                                files={"document": pdf_file}
                            )
                    except Exception as e:
                        send_msg(chat_id, f"❌ خطأ أثناء توليد ملف الصيانة: {str(e)}")
                    finally:
                        if os.path.exists(pdf_path):
                            os.remove(pdf_path)
                    continue

                # Customer statement PDF report request
                is_statement_request = text.startswith("كشف") or text.startswith("تقرير زبون")
                if is_statement_request:
                    query = text.replace("كشف", "").replace("تقرير زبون", "").strip()
                    db = None
                    try:
                        from app.database import SessionLocal
                        from app import models as app_models
                        from app.report_generator import generate_customer_report_pdf
                        db = SessionLocal()
                        pattern = f"%{query}%"
                        customers = db.query(app_models.Customer).filter(
                            app_models.Customer.name.ilike(pattern) |
                            app_models.Customer.phone.ilike(pattern)
                        ).all()

                        if not customers:
                            send_msg(chat_id, f"🔍 بحثت عن كشف حساب للزبون: *{query}*\n\n❌ لم أجد أي زبون مسجل بهذا الاسم أو الرقم.")
                        elif len(customers) > 1:
                            reply_text = f"⚠️ وجدت أكثر من زبون يطابق الاسم *{query}*. يرجى تحديد الاسم بدقة أكبر:\n\n"
                            for cust in customers:
                                reply_text += f"• كشف *{cust.name}* (الهاتف: {cust.phone or 'بدون'})\n"
                            send_msg(chat_id, reply_text)
                        else:
                            cust = customers[0]
                            send_msg(chat_id, f"⏳ جاري توليد كشف حساب تفصيلي بصيغة PDF للزبون: *{cust.name}*...")
                            
                            pdf_path = os.path.join(current_dir, f"report_{cust.id.hex[:8]}.pdf")
                            try:
                                from app.report_generator import generate_customer_statement_pdf
                                generate_customer_statement_pdf(str(cust.id), pdf_path)
                                with open(pdf_path, "rb") as pdf_file:
                                    requests.post(
                                        f"{api_url}/sendDocument",
                                        data={
                                            "chat_id": chat_id,
                                            "caption": f"📄 كشف حساب وتفاصيل ديون وأقساط الزبون: *{cust.name}*\n📞 رقم الهاتف: {cust.phone or 'غير مسجل'}",
                                            "parse_mode": "Markdown"
                                        },
                                        files={"document": pdf_file}
                                    )
                            finally:
                                if os.path.exists(pdf_path):
                                    os.remove(pdf_path)
                    except Exception as e:
                        send_msg(chat_id, f"❌ خطأ أثناء توليد ملف الكشف: {str(e)}")
                    finally:
                        if db:
                            db.close()
                    continue

                # Handle "Admin Settings" command
                if text.lower() in ["/admin", "ادمن", "مسؤولين", "إدارة", "مسؤول", "⚙️ إدارة المسؤولين"]:
                    # Create Inline Keyboard for Admin actions
                    inline_keyboard = {
                        "inline_keyboard": [
                            [
                                {"text": "➕ إضافة مسؤول", "callback_data": "admin_add"},
                                {"text": "🗑️ حذف مسؤول", "callback_data": "admin_remove"}
                            ],
                            [
                                {"text": "👥 قائمة المسؤولين", "callback_data": "admin_list"},
                                {"text": "❌ إلغاء", "callback_data": "admin_cancel"}
                            ]
                        ]
                    }
                    payload = {
                        "chat_id": chat_id,
                        "text": "⚙️ *إعدادات المسؤولين والعمال (Admins):*\n\nتفضل باختيار الإجراء المطلوب من الأزرار أدناه للتحكم بصلاحيات الوصول للبوت:",
                        "parse_mode": "Markdown",
                        "reply_markup": inline_keyboard
                    }
                    try:
                        requests.post(f"{api_url}/sendMessage", json=payload)
                    except Exception as e:
                        print(f"Error sending admin menu: {e}")
                    continue

                # Fallback for unrecognized text
                send_msg(chat_id, "⚠️ لم أتعرف على هذا الأمر.\nℹ️ لعرض قائمة التعليمات أرسل: /start")

        except Exception as e:
            print(f"Error in bot loop: {e}")
            time.sleep(5)

if __name__ == "__main__":
    run_bot()
