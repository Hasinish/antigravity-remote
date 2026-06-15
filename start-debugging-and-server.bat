@echo off
echo [+] Closing existing Antigravity IDE instances to free up ports...
taskkill /F /IM "Antigravity IDE.exe" 2>nul

echo [+] Starting Antigravity IDE with remote debugging port 9222...
start "" "C:\Users\Hasin\AppData\Local\Programs\Antigravity IDE\Antigravity IDE.exe" --remote-debugging-port=9222

echo [+] Installing Node.js Bridge Server dependencies...
cd /d "d:\antigravity-remote\server"
call npm install

echo [+] Starting the Node.js Bridge Server...
node index.js

pause
