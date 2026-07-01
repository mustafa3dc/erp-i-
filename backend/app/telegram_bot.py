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

def run_bot():
    token_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "telegram_token.txt")
    if not os.path.exists(token_path):
        print("Telegram bot token file not found. Put token in backend/app/telegram_token.txt")
        return

    with open(token_path, "r", encoding="utf-8") as f:
        token = f.read().strip()

    if not token or token == "YOUR_TOKEN_HERE":
        print("Telegram bot token is empty. Please configure it in settings.")
        return

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

                if text.lower() == "/start":
                    welcome_msg = (
                        "👋 أهلاً بك في بوت إدارة متجر الموبايل!\n\n"
                        "🔍 للبحث: أرسل لي اسم أي جهاز، إكسسوار أو قطعة صيانة للبحث عنها.\n"
                        "📋 للجرد: أرسل كلمة *الكل* أو *شعندي ماعندي* لعرض جرد كامل للمخزن."
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
                                reply_text += f"{status_icon} *{brand} - {name}* | المتوفر: {qty} | السعر: {price_formatted} د.إ\n"
                            reply_text += "\n"
                                
                    requests.post(f"{api_url}/sendMessage", json={
                        "chat_id": chat_id, 
                        "text": reply_text,
                        "parse_mode": "Markdown"
                    })
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
