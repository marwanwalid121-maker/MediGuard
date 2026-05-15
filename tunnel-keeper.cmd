@echo off
:restart
echo Starting ngrok tunnel on port 3004...
echo.
ngrok http 3004 --log=stdout
echo.
echo Tunnel crashed! Restarting in 5 seconds...
timeout /t 5 /nobreak >nul
goto restart
