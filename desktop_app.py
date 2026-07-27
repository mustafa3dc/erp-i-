import sys
import os
import subprocess
import time
import urllib.request
import webview

def main():
    current_dir = os.path.dirname(os.path.abspath(__file__))
    CLOUD_API_URL = "https://erp-i.onrender.com"

    # Try native pywebview application window
    try:
        window = webview.create_window(
            title="نظام إدارة المحلات والمبيعات - M-Mobile ERP",
            url=CLOUD_API_URL,
            width=1280,
            height=800,
            resizable=True,
            min_size=(900, 600)
        )
        webview.start()
    except Exception as e:
        # Fallback to browser app mode
        url = CLOUD_API_URL
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
                    return
        import webbrowser
        webbrowser.open(url)

if __name__ == "__main__":
    main()
