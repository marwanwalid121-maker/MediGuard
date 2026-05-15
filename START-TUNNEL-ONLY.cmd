@echo off
echo ========================================
echo STARTING TUNNEL KEEPER + MONITOR ONLY
echo ========================================
echo.

echo 🚇 Starting Tunnel Keeper (ngrok)...
start "Tunnel Keeper" cmd /k "cd /d "%~dp0" && tunnel-keeper.cmd"

echo ⏳ Waiting 10 seconds for ngrok tunnel to establish...
timeout /t 10 /nobreak > nul

echo 🔗 Starting Ngrok Monitor Service...
start "Ngrok Monitor" cmd /k "cd /d "%~dp0" && node ngrok-monitor.js"

echo.
echo ✅ Services started!
echo 🚇 Tunnel Keeper: Running (check tunnel window for ngrok URL)
echo 🔗 Ngrok Monitor: http://localhost:3007
echo.
echo 💡 The monitor will auto-detect ngrok URL changes
echo 💡 Use http://localhost:3007/api/ngrok-url to get current URL
echo.
pause