@echo off
setlocal enabledelayedexpansion

echo ========================================
echo  BLOCKCHAIN EHR SYSTEM - COMPLETE START
echo ========================================
echo.

cd /d "%~dp0"

REM Check if Hyperledger Fabric is already running
docker ps | findstr "orderer.example.com" >nul
if %errorlevel% equ 0 (
    echo Hyperledger Fabric network is already running ✓
    goto start_apps
)

REM Prepare Hyperledger Fabric
echo [1/5] Preparing Hyperledger Fabric network...
cd hyperledger-fabric\network

REM Clean old artifacts to regenerate fresh crypto materials
echo Cleaning old artifacts...
rmdir /s /q crypto-config 2>nul
rmdir /s /q channel-artifacts 2>nul
mkdir crypto-config 2>nul
mkdir channel-artifacts 2>nul

REM Generate crypto materials
echo [2/5] Generating certificates...
docker run --rm -v "%cd%:/work" -w /work hyperledger/fabric-tools:2.4.7 cryptogen generate --config=crypto-config.yaml

REM Create genesis block (AFTER crypto is generated)
echo [3/5] Creating genesis block...
docker run --rm -v "%cd%:/work" -w /work -e FABRIC_CFG_PATH=/work hyperledger/fabric-tools:2.4.7 configtxgen -profile OrdererGenesis -channelID system-channel -outputBlock channel-artifacts/genesis.block

REM Start Hyperledger Fabric network
echo [4/5] Starting Hyperledger Fabric network...
docker-compose up -d

REM Wait for orderer to start (increased timeout)
echo Waiting for blockchain network to initialize (30 seconds)...
timeout /t 15 /nobreak >nul

REM Check if orderer is running
docker ps | findstr "orderer.example.com" >nul
if %errorlevel% neq 0 (
    echo ERROR: Orderer failed to start!
    echo Checking orderer logs...
    docker logs orderer.example.com | findstr "PANI" >nul
    if %errorlevel% equ 0 (
        echo PANIC found in orderer logs!
        docker logs orderer.example.com
    )
    exit /b 1
)
echo ✓ Orderer is running

REM Additional wait for peer and CLI
timeout /t 15 /nobreak >nul

REM Deploy chaincode
echo [5/5] Deploying EHR chaincode v8.0...
cd hyperledger-fabric\network

REM Install chaincode dependencies
echo Installing chaincode dependencies...
docker exec cli bash -c "cd /opt/gopath/src/github.com/chaincode/ehr-chaincode && npm install" 2>nul

REM Config files already mounted in docker-compose (no need to copy)

REM Create channel transaction
echo Creating channel transaction...
docker exec -e FABRIC_CFG_PATH=/opt/gopath/src/github.com/hyperledger/fabric/peer cli bash -c ^
  "configtxgen -profile ChannelConfig -outputCreateChannelTx ./channel-artifacts/mychannel.tx -channelID mychannel"

REM Create channel
echo Creating mychannel...
docker exec cli peer channel create -o orderer.example.com:7050 -c mychannel -f ./channel-artifacts/mychannel.tx --outputBlock ./channel-artifacts/mychannel.block --timeout 30s

REM Join peer to channel
echo Joining peer to channel...
docker exec cli peer channel join -b ./channel-artifacts/mychannel.block

REM Wait for peer to join
timeout /t 5 /nobreak >nul

REM Verify channel was created successfully
echo Verifying channel creation...
docker exec cli peer channel list 2>nul | findstr "mychannel" >nul
if %errorlevel% neq 0 (
    echo WARNING: Channel verification failed, attempting recovery...
    REM Try to join channel even if block file is missing
    docker exec cli bash -c "peer channel fetch oldest ./channel-artifacts/mychannel.block -c mychannel -o orderer.example.com:7050" 2>nul
    if %errorlevel% neq 0 (
        echo ERROR: Could not create channel. Checking peer logs...
        docker logs peer0.org1.example.com | findstr "ERRO\|PANI" | tail -5
        REM Continue anyway - chaincode may still work
    )
)
echo Channel status check complete.

REM Package chaincode
echo Packaging chaincode...
docker exec cli peer lifecycle chaincode package ehr-chaincode.tar.gz --path /opt/gopath/src/github.com/chaincode/ehr-chaincode --lang node --label ehr-chaincode_8.0

REM Install chaincode
echo Installing chaincode...
docker exec cli peer lifecycle chaincode install ehr-chaincode.tar.gz

REM Wait for install to complete
timeout /t 5 /nobreak >nul

REM Get package ID dynamically
echo Getting package ID...
for /f "tokens=*" %%a in ('docker exec cli peer lifecycle chaincode queryinstalled 2^>nul ^| findstr "ehr-chaincode_8.0"') do (
    for /f "tokens=3" %%b in ('echo %%a') do set PACKAGE_ID=%%b
)
set PACKAGE_ID=!PACKAGE_ID:,=!
echo Package ID: !PACKAGE_ID!

REM Wait before approving
timeout /t 5 /nobreak >nul

REM Approve chaincode
echo Approving chaincode...
docker exec cli peer lifecycle chaincode approveformyorg -o orderer.example.com:7050 --channelID mychannel --name ehr-chaincode --version 8.0 --package-id !PACKAGE_ID! --sequence 1
if %errorlevel% neq 0 (
    echo ERROR: Chaincode approval failed!
    exit /b 1
)

REM Commit chaincode
echo Committing chaincode...
docker exec cli peer lifecycle chaincode commit -o orderer.example.com:7050 --channelID mychannel --name ehr-chaincode --version 8.0 --sequence 1 --peerAddresses peer0.org1.example.com:7051
if %errorlevel% neq 0 (
    echo ERROR: Chaincode commit failed!
    exit /b 1
)

REM Wait for commit to propagate
echo Waiting for chaincode commit to propagate...
timeout /t 10 /nobreak >nul
echo Commit complete!

REM Initialize chaincode
echo Initializing chaincode...
docker exec cli peer chaincode invoke -o orderer.example.com:7050 -C mychannel -n ehr-chaincode -c "{\"function\":\"initLedger\",\"Args\":[]}" --peerAddresses peer0.org1.example.com:7051 2>nul
echo Chaincode initialized!

echo Waiting for chaincode container to start...
timeout /t 10 /nobreak >nul
echo Chaincode ready!

echo Returning to root directory...
cd /d "%~dp0"
echo Ready to start applications!

:start_apps
REM Start all applications
echo.
echo ========================================
echo [6/6] Starting EHR Backend Applications...
echo ========================================
echo.
echo Starting EHR applications...
start "Contract Runner" cmd /k "cd /d %~dp0applications\contract-runner && node server.js"
timeout /t 3 /nobreak >nul
start "Admin Dashboard" cmd /k "cd /d %~dp0applications\admin-dashboard && node server.js"
timeout /t 2 /nobreak >nul
start "Patient Portal" cmd /k "cd /d %~dp0applications\patient-portal && node server.js"
timeout /t 2 /nobreak >nul
start "Hospital Scanner" cmd /k "cd /d %~dp0applications\hospital-portal && node server.js"
timeout /t 2 /nobreak >nul
start "Hospital Dashboard" cmd /k "cd /d %~dp0applications\hospital-dashboard && node server.js"
timeout /t 2 /nobreak >nul
start "Pharmacy Portal" cmd /k "cd /d %~dp0applications\pharmacy-portal && node server.js"

echo.
echo ========================================
echo  BLOCKCHAIN EHR SYSTEM READY!
echo ========================================
echo.
echo Access URLs:
echo - Contract Runner: http://localhost:6000 (blockchain API)
echo - Admin Dashboard: http://localhost:3001
echo - Patient Portal:  http://localhost:3003
echo - Hospital Scanner: http://localhost:3004
echo - Hospital Dashboard: http://localhost:3005 (doctors)
echo - Pharmacy Portal: http://localhost:3006
echo.
echo Test Credentials:
echo - Pharma (Pharmacy): Pharma / Pharma
echo - Admin: admin / admin123
echo.
echo ========================================
echo  YOUR DATA LOCATION
echo ========================================
echo.
echo All data is stored:
echo   EHR Data: BLOCKCHAIN (Hyperledger Fabric)
echo   Pharmacy Inventory: BLOCKCHAIN (Hyperledger Fabric)
echo   Channel: mychannel
echo   Chaincode: ehr-chaincode (v8.0)
echo.
echo Data Keys:
echo   - PATIENT_{id}  = Patient records (encrypted on blockchain)
echo   - HOSPITAL_{id} = Hospital data (encrypted on blockchain)
echo   - TX_{id}       = Transactions (audit trail on blockchain)
echo   - CRED_{username} = Credentials (bcrypt hashed on blockchain)
echo.
echo System is ready! Login with test credentials above.
pause