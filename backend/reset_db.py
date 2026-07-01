import os
import sys

# Add backend directory to sys.path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.database import engine, Base, SessionLocal
from app import models

def reset_database():
    paths_to_delete = [
        os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "accounting.db"),
        os.path.join(os.path.dirname(os.path.abspath(__file__)), "accounting.db")
    ]
    for db_path in paths_to_delete:
        if os.path.exists(db_path):
            os.remove(db_path)
            print(f"Deleted database at: {db_path}")

    # Recreate tables
    Base.metadata.create_all(bind=engine)
    print("Recreated database tables.")

    # Seed default accounts
    db = SessionLocal()
    try:
        default_accounts = [
            ("1010", "Cash (الصندوق)", models.AccountType.ASSET),
            ("1100", "Accounts Receivable (ديون العملاء)", models.AccountType.ASSET),
            ("1200", "Inventory (المخزون)", models.AccountType.ASSET),
            ("3000", "Owner's Equity (رأس المال)", models.AccountType.EQUITY),
            ("4000", "Revenue (المبيعات)", models.AccountType.REVENUE),
            ("5000", "Cost of Goods Sold (تكلفة البضاعة المباعة)", models.AccountType.EXPENSE),
        ]
        for code, name, acc_type in default_accounts:
            acc = models.Account(code=code, name=name, type=acc_type)
            db.add(acc)
        db.commit()
        print("Successfully seeded default accounts.")
    except Exception as e:
        db.rollback()
        print(f"Error seeding database: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    reset_database()
