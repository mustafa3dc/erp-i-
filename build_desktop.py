import subprocess
import sys
import os

def main():
    print("Installing PyInstaller...")
    subprocess.check_call([sys.executable, "-m", "pip", "install", "pyinstaller", "pywebview", "python-multipart"])
    
    print("Building standalone Windows EXE application...")
    
    sep = ";" if sys.platform == "win32" else ":"
    
    cmd = [
        "pyinstaller",
        "--name=MMobileApp",
        "--noconsole",
        "--onefile",
        f"--add-data=backend{sep}backend",
        f"--add-data=frontend/dist{sep}frontend/dist",
        "run_desktop.py"
    ]
    
    subprocess.check_call(cmd)
    print("\n🎉 SUCCESS! Your standalone Windows app 'MMobileApp.exe' is built in the 'dist' folder.")

if __name__ == "__main__":
    main()
