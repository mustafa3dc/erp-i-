#!/bin/bash
cd /Users/mustafa/Desktop/test/backend
echo "=== Starting backend at $(date) ===" >> /Users/mustafa/Desktop/test/backend/debug.log
export PYTHONPATH=/Users/mustafa/Desktop/test/backend
export PATH="/Users/mustafa/Desktop/test/venv/bin:/usr/local/bin:/usr/bin:/bin"
/Users/mustafa/Desktop/test/venv/bin/python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 >> /Users/mustafa/Desktop/test/backend/debug.log 2>&1
echo "=== Backend exited with status $? at $(date) ===" >> /Users/mustafa/Desktop/test/backend/debug.log
