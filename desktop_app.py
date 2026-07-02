import uvicorn
import multiprocessing
import sys
import os
import time
import webbrowser

# إضافة مجلد الباكيند للمسارات لكي يجد دالة التشغيل
current_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.append(os.path.join(current_dir, "backend", "app"))

from main import app

def start_server():
    uvicorn.run(app, host="127.0.0.1", port=8000, log_level="info")

if __name__ == "__main__":
    # دعم التجميد لـ PyInstaller لمنع التكرار اللانهائي للعمليات
    multiprocessing.freeze_support()
    
    # تشغيل السيرفر في عملية منفصلة بالخلفية
    p = multiprocessing.Process(target=start_server)
    p.daemon = True
    p.start()
    
    # انتظار بدء تشغيل السيرفر
    time.sleep(2)
    
    url = "http://127.0.0.1:8000"
    
    # فتح المتصفح بوضع نافذة التطبيق المستقلة
    opened = False
    try:
        if sys.platform == "darwin":  # macOS
            import subprocess
            subprocess.Popen(f"open -a 'Google Chrome' --args --app={url}", shell=True)
            opened = True
        elif sys.platform == "win32":  # Windows
            import subprocess
            chrome_paths = [
                r"C:\Program Files\Google\Chrome\Application\chrome.exe",
                r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"
            ]
            for path in chrome_paths:
                if os.path.exists(path):
                    subprocess.Popen([path, f"--app={url}"])
                    opened = True
                    break
    except Exception:
        pass
        
    if not opened:
        webbrowser.open(url)
        
    # إبقاء البرنامج الرئيسي يعمل
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        p.terminate()
