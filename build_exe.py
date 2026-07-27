# Build Desktop Executable for Windows/Mac using PyInstaller
import PyInstaller.__main__
import os

current_dir = os.path.dirname(os.path.abspath(__file__))

PyInstaller.__main__.run([
    'desktop_app.py',
    '--name=M-Mobile-ERP',
    '--onefile',
    '--noconsole',
    '--clean'
])
