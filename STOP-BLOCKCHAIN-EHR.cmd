@echo off
echo ========================================
echo  STOPPING BLOCKCHAIN EHR SYSTEM
echo ========================================
echo.

cd /d "%~dp0hyperledger-fabric\network"

echo Stopping Hyperledger Fabric network...
docker-compose down -v

echo.
echo ========================================
echo  BLOCKCHAIN NETWORK STOPPED
echo ========================================
echo.
echo All containers stopped and volumes removed.
echo Run START-BLOCKCHAIN-EHR.cmd to restart.
echo.
pause
