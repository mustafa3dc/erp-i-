import os
import sys
import subprocess
import webbrowser
import time

def main():
    # Start the backend server as a subprocess
    print("جاري تشغيل خادم النظام في الخلفية...")
    current_dir = os.path.dirname(os.path.abspath(__file__))
    backend_dir = os.path.join(current_dir, "backend")
    
    # Run the main.py server
    process = subprocess.Popen([sys.executable, "main.py"], cwd=backend_dir)
    
    # Wait for the server to start
    time.sleep(2)
    
    url = "http://127.0.0.1:8000"
    print(f"جاري فتح واجهة التطبيق في نافذة مستقلة: {url}")
    
    # Try opening Google Chrome in App Mode (distraction-free window)
    opened = False
    try:
        if sys.platform == "darwin":  # macOS
            chrome_cmd = f"open -a 'Google Chrome' --args --app={url}"
            subprocess.Popen(chrome_cmd, shell=True)
            opened = True
        elif sys.platform == "win32":  # Windows
            chrome_paths = [
                r"C:\Program Files\Google\Chrome\Application\chrome.exe",
                r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"
            ]
            for path in chrome_paths:
                if os.path.exists(path):
                    subprocess.Popen([path, f"--app={url}"])
                    opened = True
                    break
    except Exception as e:
        print(f"حدث خطأ أثناء محاولة فتح الكروم بوضع التطبيق: {e}")
        
    if not opened:
        # Fallback to default system browser
        webbrowser.open(url)
        
    try:
        print("\n🟢 التطبيق يعمل الآن بنجاح! لإيقافه بالكامل، اضغط Ctrl+C في منفذ الأوامر.")
        process.wait()
    except KeyboardInterrupt:
        print("\n🔴 جاري إغلاق التطبيق وإيقاف خادم النظام...")
        process.terminate()
        process.wait()

if __name__ == "__main__":
    main()
