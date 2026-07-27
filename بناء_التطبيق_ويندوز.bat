@echo off
title بناء تطبيق سطح المكتب - M-Mobile ERP
echo =========================================================
echo  جاري بناء ملف التطبيق التنفيذي M-Mobile-ERP.exe...
echo =========================================================
pip install pyinstaller pywebview requests
python -m PyInstaller --name="M-Mobile-ERP" --onefile --noconsole --clean desktop_app.py
echo =========================================================
echo  تم بناء التطبيق بنجاح! تجد الملف في مجلد dist
echo =========================================================
pause
