#!/bin/bash
# Startup script for M Mobile ERP System and Tunnels on Boot

# Define environment variables
export PATH="/Users/mustafa/node-env/bin:/usr/local/bin:/usr/bin:/bin:$PATH"
export CWD="/Users/mustafa/Desktop/test"

cd "$CWD"

# 1. Start Main Backend Server & Telegram Bot Subprocess
# Kill any previous instance first to avoid port binding lock
pkill -9 -f "app.main:app"
./venv/bin/python3 -m uvicorn backend.app.main:app --host 0.0.0.0 --port 8000 > "$CWD/server.log" 2> "$CWD/server_error.log" &

# 2. Start LocalTunnel Proxy Server
pkill -9 -f "lt --port"
sleep 4
# Start localtunnel on port 8000
./node-env/bin/lt --port 8000 > "$CWD/localtunnel.log" 2>&1 &

echo "M Mobile ERP Backend and Tunnels started successfully."
