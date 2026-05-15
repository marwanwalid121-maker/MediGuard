@echo off
REM Start Hyperledger Fabric Network for MediGuard EHR System

echo 🏥 ===============================================
echo 🚀 Starting MediGuard Hyperledger Fabric Network
echo 💰 Zero Gas Fees - Enterprise Blockchain
echo 🏥 ===============================================

echo.
echo 📋 Step 1: Stopping any existing network...
docker-compose down -v

echo.
echo 📋 Step 2: Starting Hyperledger Fabric network...
docker-compose up -d

echo.
echo ⏳ Waiting for network to initialize (15 seconds)...
timeout /t 15 /nobreak > nul

echo.
echo 📋 Step 3: Creating channel 'mychannel'...
docker exec cli peer channel create -o orderer.example.com:7050 -c mychannel -f ./channel-artifacts/mychannel.tx --tls --cafile /opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/ordererOrganizations/example.com/orderers/orderer.example.com/msp/tlscacerts/tlsca.example.com-cert.pem

echo.
echo 📋 Step 4: Joining peer to channel...
docker exec cli peer channel join -b mychannel.block

echo.
echo 📋 Step 5: Installing chaincode dependencies...
docker exec cli bash -c "cd /opt/gopath/src/github.com/chaincode/ehr-chaincode && npm install"

echo.
echo 📋 Step 6: Packaging chaincode...
docker exec cli peer lifecycle chaincode package ehr-chaincode.tar.gz --path /opt/gopath/src/github.com/chaincode/ehr-chaincode --lang node --label ehr-chaincode_1.0

echo.
echo 📋 Step 7: Installing chaincode...
docker exec cli peer lifecycle chaincode install ehr-chaincode.tar.gz

echo.
echo 📋 Step 8: Getting package ID...
for /f "tokens=3 delims= " %%i in ('docker exec cli peer lifecycle chaincode queryinstalled ^| findstr "ehr-chaincode_1.0"') do set PACKAGE_ID=%%i
set PACKAGE_ID=%PACKAGE_ID:,=%

echo Package ID: %PACKAGE_ID%

echo.
echo 📋 Step 9: Approving chaincode...
docker exec cli peer lifecycle chaincode approveformyorg -o orderer.example.com:7050 --channelID mychannel --name ehr-chaincode --version 1.0 --package-id %PACKAGE_ID% --sequence 1 --tls --cafile /opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/ordererOrganizations/example.com/orderers/orderer.example.com/msp/tlscacerts/tlsca.example.com-cert.pem

echo.
echo 📋 Step 10: Committing chaincode...
docker exec cli peer lifecycle chaincode commit -o orderer.example.com:7050 --channelID mychannel --name ehr-chaincode --version 1.0 --sequence 1 --tls --cafile /opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/ordererOrganizations/example.com/orderers/orderer.example.com/msp/tlscacerts/tlsca.example.com-cert.pem --peerAddresses peer0.org1.example.com:7051 --tlsRootCertFiles /opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/org1.example.com/peers/peer0.org1.example.com/tls/ca.crt

echo.
echo 🎉 ===============================================
echo ✅ MediGuard Fabric Network Running!
echo 🔗 Chaincode: ehr-chaincode v1.0
echo 📋 Channel: mychannel
echo 💰 Transaction cost: $0.00 (FREE!)
echo 🏥 ===============================================

echo.
echo 🔧 Network Status:
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

echo.
echo 📡 Available Services:
echo   - Peer: localhost:7051
echo   - Orderer: localhost:7050
echo   - CA: localhost:7054

echo.
echo 🚀 Network is ready! Start your applications now.

pause
