import os
import platform
import shutil
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

# 1. Resolve a permanent, persistent path for the database file
if platform.system() == "Darwin":      # macOS
    db_dir = os.path.expanduser("~/Library/Application Support/MMobile")
elif platform.system() == "Windows":    # Windows
    db_dir = os.path.join(os.getenv("APPDATA", os.path.expanduser("~")), "MMobile")
else:                                   # Linux/other
    db_dir = os.path.expanduser("~/.m_mobile")

os.makedirs(db_dir, exist_ok=True)
default_db_path = os.path.join(db_dir, "accounting.db")

# 2. Migrate existing database file to the permanent location if it exists
old_paths = [
    os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "accounting.db"),  # backend/accounting.db
    os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "accounting.db"),  # project_root/accounting.db
    "accounting.db"
]
for old_path in old_paths:
    if os.path.exists(old_path) and os.path.isfile(old_path):
        if not os.path.exists(default_db_path):
            try:
                shutil.copy2(old_path, default_db_path)
                print(f"Migrated database from {old_path} to {default_db_path}")
            except Exception as e:
                print(f"Failed to migrate database: {e}")
            break

# 3. Initialize Database URL
DATABASE_URL = os.getenv("DATABASE_URL", f"sqlite:///{default_db_path}")

# SQLAlchemy requires postgresql:// instead of postgres://
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

connect_args = {}
# SQLite needs check_same_thread=False for multithreading in FastAPI
if DATABASE_URL.startswith("sqlite"):
    connect_args = {"check_same_thread": False}

engine = create_engine(DATABASE_URL, connect_args=connect_args)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
