@echo off
REM Complete Hyperledger Fabric Network Setup for Windows

echo 🚀 ===============================================
echo 🎉 Hyperledger Fabric Complete Network Setup
echo 🔗 Setting up REAL enterprise blockchain
echo 💰 Gas Fees: $0.00 (ZERO!)
echo 🚀 ===============================================

echo.
echo 📋 Step 1: Stopping any existing network...
docker-compose down -v
docker system prune -f

echo.
echo 📋 Step 2: Starting Hyperledger Fabric network...
docker-compose up -d

echo.
echo ⏳ Waiting for network to initialize...
timeout /t 10 /nobreak > nul

echo.
echo 📋 Step 3: Creating channel...
docker exec cli peer channel create -o orderer.example.com:7050 -c filetransfer-channel -f ./channel-artifacts/channel.tx

echo.
echo 📋 Step 4: Joining peer to channel...
docker exec cli peer channel join -b filetransfer-channel.block

echo.
echo 📋 Step 5: Installing chaincode dependencies...
docker exec cli bash -c "cd /opt/gopath/src/github.com/chaincode/secure-file-sharing && npm install"

echo.
echo 📋 Step 6: Packaging chaincode...
docker exec cli peer lifecycle chaincode package secure-file-sharing.tar.gz --path /opt/gopath/src/github.com/chaincode/secure-file-sharing --lang node --label secure-file-sharing_2.0

echo.
echo 📋 Step 7: Installing chaincode...
docker exec cli peer lifecycle chaincode install secure-file-sharing.tar.gz

echo.
echo 📋 Step 8: Getting package ID...
for /f "tokens=3 delims= " %%i in ('docker exec cli peer lifecycle chaincode queryinstalled ^| findstr "secure-file-sharing_2.0"') do set PACKAGE_ID=%%i
set PACKAGE_ID=%PACKAGE_ID:,=%

echo Package ID: %PACKAGE_ID%

echo.
echo 📋 Step 9: Approving chaincode...
docker exec cli peer lifecycle chaincode approveformyorg -o orderer.example.com:7050 --channelID filetransfer-channel --name secure-file-sharing --version 2.0 --package-id %PACKAGE_ID% --sequence 1

echo.
echo 📋 Step 10: Committing chaincode...
docker exec cli peer lifecycle chaincode commit -o orderer.example.com:7050 --channelID filetransfer-channel --name secure-file-sharing --version 2.0 --sequence 1 --peerAddresses peer0.org1.example.com:7051

echo.
echo 🎉 ===============================================
echo ✅ Network setup completed successfully!
echo 🔗 Hyperledger Fabric network is running
echo 📦 Chaincode deployed: secure-file-sharing v2.0
echo 📋 Channel: filetransfer-channel
echo 💰 Transaction cost: $0.00 (FREE!)
echo 🚀 ===============================================

echo.
echo 🔧 Network Status:
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

echo.
echo 📡 Available Services:
echo   - Peer: localhost:7051
echo   - Orderer: localhost:7050
echo   - CA: localhost:7054
echo   - CouchDB: localhost:5984

echo.
echo 🚀 Next Steps:
echo   1. Install dependencies: npm install
echo   2. Start wallet server: npm run start:wallet
echo   3. Test API: curl http://localhost:3004/health

pause