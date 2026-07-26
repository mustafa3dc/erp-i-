import sys
import os
import subprocess
import time
import urllib.request

def main():
    current_dir = os.path.dirname(os.path.abspath(__file__))
    
    CLOUD_API_URL = "https://erp-i.onrender.com"
    
    # 1. Verify Cloud Backend Server status or launch local fallback
    server_ready = False
    try:
        with urllib.request.urlopen(f"{CLOUD_API_URL}/accounts/", timeout=2) as response:
            if response.status == 200:
                server_ready = True
    except Exception:
        server_ready = False

    if not server_ready:
        backend_cmd = [sys.executable, "-m", "uvicorn", "backend.app.main:app", "--host", "127.0.0.1", "--port", "8000"]
        
        # Hide console window on Windows
        startupinfo = None
        if sys.platform == "win32":
            startupinfo = subprocess.STARTUPINFO()
            startupinfo.dwFlags |= subprocess.STARTF_USESHOWWINDOW
            startupinfo.wShowWindow = 0
            
        subprocess.Popen(backend_cmd, cwd=current_dir, startupinfo=startupinfo)
        
        # Fast non-blocking polling loop with 50ms interval (0.05s)
        for _ in range(30):
            time.sleep(0.05)
            try:
                with urllib.request.urlopen("http://127.0.0.1:8000/", timeout=0.2) as response:
                    server_ready = True
                    break
            except Exception:
                pass

    url = CLOUD_API_URL
    
    # Fast launch in standalone application window mode (--app=)
    opened = False
    try:
        if sys.platform == "win32":
            chrome_paths = [
                r"C:\Program Files\Google\Chrome\Application\chrome.exe",
                r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
                os.path.expanduser(r"~\AppData\Local\Google\Chrome\Application\chrome.exe"),
                r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
                r"C:\Program Files\Microsoft\Edge\Application\msedge.exe"
            ]
            for path in chrome_paths:
                if os.path.exists(path):
                    subprocess.Popen([path, f"--app={url}"])
                    opened = True
                    break
        elif sys.platform == "darwin":
            chrome_app_exists = os.path.exists("/Applications/Google Chrome.app") or os.path.exists(os.path.expanduser("~/Applications/Google Chrome.app"))
            if chrome_app_exists:
                subprocess.Popen(f"open -a 'Google Chrome' --args --app={url}", shell=True)
                opened = True
    except Exception:
        pass

    if not opened:
        import webbrowser
        webbrowser.open(url)

    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        pass

if __name__ == "__main__":
    main()
