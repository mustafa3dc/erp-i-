import os
import sys
import time
import sqlite3
import requests

def get_db_path():
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    return os.path.join(base_dir, "accounting.db")

def search_inventory(query_text):
    db_path = get_db_path()
    if not os.path.exists(db_path):
        return []
    
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        search_pattern = f"%{query_text}%"
        
        # Count available items for all matched products, returning their type
        cursor.execute("""
            SELECT p.brand, p.name, COUNT(i.id) as available_qty, p.selling_price, p.type
            FROM products p
            LEFT JOIN inventory_items i ON p.id = i.product_id AND UPPER(i.status) = 'AVAILABLE'
            WHERE (p.name LIKE ? OR p.brand LIKE ?)
            GROUP BY p.id
        """, (search_pattern, search_pattern))
        
        results = cursor.fetchall()
        conn.close()
        return results
    except Exception as e:
        print(f"Database query error: {e}")
        return []

def get_all_inventory():
    db_path = get_db_path()
    if not os.path.exists(db_path):
        return []
    
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # Get all products in the system with their available count
        cursor.execute("""
            SELECT p.brand, p.name, COUNT(i.id) as available_qty, p.selling_price, p.type
            FROM products p
            LEFT JOIN inventory_items i ON p.id = i.product_id AND UPPER(i.status) = 'AVAILABLE'
            GROUP BY p.id
            ORDER BY p.type ASC, available_qty DESC, p.brand ASC
        """)
        
        results = cursor.fetchall()
        conn.close()
        return results
    except Exception as e:
        print(f"Database query error: {e}")
        return []

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
