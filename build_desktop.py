import subprocess
import sys
import os

def main():
    print("جاري تثبيت أداة PyInstaller لتجميد الحزم...")
    subprocess.check_call([sys.executable, "-m", "pip", "install", "pyinstaller"])
    
    print("جاري بناء وتحويل المشروع إلى تطبيق سطح مكتب مستقل...")
    
    # بناء أمر التحزيم مع إضافة مجلد القوالب (Templates) المهم للواجهة
    cmd = [
        "pyinstaller",
        "--name=MMobile",
        "--onedir",      # وضع التطبيق في مجلد يحتوي على المشغل والملفات المساعدة
        "--windowed",    # إخفاء نافذة التيرمينال السوداء عند التشغيل
        "--add-data=backend/app/templates:backend/app/templates",
        "desktop_app.py"
    ]
    
    # في ويندوز الفاصل يكون نقطة ومنقوطة بدلاً من النقطتين
    if sys.platform == "win32":
        cmd[4] = "--add-data=backend/app/templates;backend/app/templates"
        
    subprocess.check_call(cmd)
    print("\n🎉 تم بناء التطبيق بنجاح! ستجد المجلد المكتمل داخل مجلد 'dist/MMobile'.")
    print("يمكنك نسخ هذا المجلد لصديقك وسيعمل لديه فوراً بمجرد الضغط على ملف تشغيل التطبيق.")

if __name__ == "__main__":
    main()
