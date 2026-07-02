import os
import sys
import time
import requests

# Add the parent directory to sys.path to allow absolute imports of the 'app' package
current_dir = os.path.dirname(os.path.abspath(__file__))
parent_dir = os.path.dirname(current_dir)
if parent_dir not in sys.path:
    sys.path.insert(0, parent_dir)

from app.database import SessionLocal
from app import models
from sqlalchemy import func

def search_inventory(query_text):
    db = SessionLocal()
    try:
        search_pattern = f"%{query_text}%"
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
        ).filter(
            models.Product.name.ilike(search_pattern) | 
            models.Product.brand.ilike(search_pattern)
        ).group_by(
            models.Product.id,
            models.Product.brand,
            models.Product.name,
            models.Product.selling_price,
            models.Product.type
        ).all()
        return results
    except Exception as e:
        print(f"Database query error: {e}")
        return []
    finally:
        db.close()

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
    allowed_str = get_system_setting("allowed_users")
    if allowed_str:
        allowed = [u.strip().lower() for u in allowed_str.split(",") if u.strip()]
    else:
        filepath = os.path.join(os.path.dirname(os.path.abspath(__file__)), "allowed_users.txt")
        if not os.path.exists(filepath):
            return False
        with open(filepath, "r", encoding="utf-8") as f:
            allowed = [line.strip().lower() for line in f if line.strip()]
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

def send_daily_report_to_all_chats():
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
        generate_daily_report_pdf(pdf_path)
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

def daily_report_scheduler_loop():
    import datetime
    import time
    print("Daily PDF Report Scheduler started.")
    last_sent_date = None
    
    while True:
        try:
            now = datetime.datetime.now()
            # Send at 00:05 AM (midnight plus 5 minutes)
            if now.hour == 0 and now.minute == 5:
                current_date = now.date()
                if last_sent_date != current_date:
                    print(f"Time is {now.strftime('%H:%M')}. Generating and sending daily PDF report...")
                    send_daily_report_to_all_chats()
                    last_sent_date = current_date
        except Exception as e:
            print(f"Error in daily report scheduler: {e}")
            
        time.sleep(30)

def run_bot():
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
                offset = update["update_id"] + 1
                message = update.get("message", {})
                chat_id = message.get("chat", {}).get("id")
                text = message.get("text", "").strip()

                if not chat_id or not text:
                    continue

                if not is_user_allowed(message):
                    # Reply with unauthorized message
                    requests.post(f"{api_url}/sendMessage", json={
                        "chat_id": chat_id,
                        "text": "⚠️ عذراً، حسابك غير مصرح له باستخدام هذا البوت. يرجى الطلب من مسؤول النظام إضافة حسابك في الإعدادات."
                    })
                    continue

                register_chat_id(chat_id)

                if text.lower() == "/start":
                    welcome_msg = (
                        "👋 أهلاً بك في بوت إدارة متجر الموبايل!\n\n"
                        "🔍 للبحث: أرسل لي اسم أي جهاز، إكسسوار أو قطعة صيانة للبحث عنها.\n"
                        "📋 للجرد: أرسل كلمة *الكل* أو *شعندي ماعندي* لعرض جرد كامل للمخزن.\n"
                        "⚠️ للنواقص: أرسل كلمة *نواقص* أو *خلص* أو *تقرير* لعرض القطع التي أوشكت على النفاد."
                    )
                    requests.post(f"{api_url}/sendMessage", json={"chat_id": chat_id, "text": welcome_msg, "parse_mode": "Markdown"})
                    continue

                # Handle "What I have" command
                if text.lower() in ["/all", "الكل", "شعندي ماعندي", "مخزون"]:
                    items = get_all_inventory()
                    if not items:
                        reply_text = "📦 المخزن فارغ تماماً حالياً ولا توجد أي بضائع."
                    else:
                        reply_text = "📋 *تقرير جرد بضائع المخزن الحالي:*\n\n"
                        
                        # Group items by type
                        grouped = {}
                        for brand, name, qty, price, p_type in items:
                            type_title = type_mapping.get(p_type, "📦 أخرى")
                            if type_title not in grouped:
                                grouped[type_title] = []
                            grouped[type_title].append((brand, name, qty, price))
                        
                        for type_title, type_items in grouped.items():
                            reply_text += f"*{type_title}:*\n"
                            for brand, name, qty, price in type_items:
                                status_icon = "🟢" if qty > 0 else "🔴"
                                price_formatted = f"{float(price):,}" if price else "0"
                                reply_text += f"{status_icon} *{brand} - {name}* | المتوفر: {qty} | السعر: {price_formatted} د.ع\n"
                            reply_text += "\n"
                                
                    requests.post(f"{api_url}/sendMessage", json={
                        "chat_id": chat_id, 
                        "text": reply_text,
                        "parse_mode": "Markdown"
                    })
                    continue

                # Handle "Shortages/Low Stock" command
                if text.lower() in ["/shortages", "نواقص", "خلص"]:
                    items = get_all_inventory()
                    shortages = [item for item in items if item[2] <= 2 and item[4] != 'Maintenance']
                    
                    if not shortages:
                        reply_text = "🟢 كل البضائع في المخزن متوفرة بكميات كافية (أكثر من قطعتين)!"
                    else:
                        reply_text = "⚠️ *تقرير البضائع التي توشك على النفاد (قطعتين أو أقل):*\n\n"
                        for brand, name, qty, price, p_type in shortages:
                            type_label = type_mapping.get(p_type, "بضاعة")
                            status_desc = "🔴  نافذ تماماً" if qty == 0 else f"🟡 متبقي: {qty} قطع"
                            reply_text += f"• *{brand} - {name}* ({type_label})\n  👈 {status_desc}\n"
                            
                    requests.post(f"{api_url}/sendMessage", json={
                        "chat_id": chat_id, 
                        "text": reply_text,
                        "parse_mode": "Markdown"
                    })
                    continue

                # Handle "Daily PDF Report" command
                if text.lower() in ["/report", "تقرير", "ملخص", "اليومي", "الملخص"]:
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
                        requests.post(f"{api_url}/sendMessage", json={
                            "chat_id": chat_id, 
                            "text": f"❌ عذراً، حدث خطأ أثناء توليد تقرير الـ PDF اليومي:\n`{str(e)}`\n\n```\n{error_trace[:3000]}\n```",
                            "parse_mode": "Markdown"
                        })
                    finally:
                        if os.path.exists(pdf_path):
                            try:
                                os.remove(pdf_path)
                            except Exception:
                                pass
                    continue

                # Search query
                results = search_inventory(text)
                
                if not results:
                    reply_text = f"🔍 بحثت عن: *{text}*\n\n❌ عذراً، لم أجد أي بضاعة (موبايل، إكسسوار، أو قطعة) تطابق هذا البحث."
                else:
                    reply_text = f"🔍 نتائج البحث في المخزن لـ *{text}*:\n\n"
                    for brand, name, qty, price, p_type in results:
                        type_label = type_mapping.get(p_type, "بضاعة")
                        status_icon = "✅" if qty > 0 else "❌"
                        price_formatted = f"{float(price):,}" if price else "0"
                        reply_text += (
                            f"{status_icon} *{brand} - {name}* ({type_label})\n"
                            f"  🔹 المتوفر: {qty} قطع\n"
                            f"  🔹 السعر: {price_formatted} د.إ\n\n"
                        )
                
                requests.post(f"{api_url}/sendMessage", json={
                    "chat_id": chat_id, 
                    "text": reply_text,
                    "parse_mode": "Markdown"
                })

        except Exception as e:
            print(f"Error in bot loop: {e}")
            time.sleep(5)

if __name__ == "__main__":
    run_bot()
