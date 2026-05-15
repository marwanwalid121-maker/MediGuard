@echo off
echo 🚀 Deploying EHR Chaincode to mychannel...

REM Create channel transaction
echo 📡 Creating channel transaction...
docker run --rm -v "%cd%:/work" -w /work -e FABRIC_CFG_PATH=/work hyperledger/fabric-tools:2.4.7 configtxgen -profile ChannelConfig -outputCreateChannelTx channel-artifacts/mychannel.tx -channelID mychannel

REM Create channel
echo 📡 Creating channel mychannel...
docker exec cli peer channel create -o orderer.example.com:7050 -c mychannel -f /opt/gopath/src/github.com/hyperledger/fabric/peer/channel-artifacts/mychannel.tx --outputBlock mychannel.block

REM Join channel
echo 🔗 Joining channel...
docker exec cli peer channel join -b mychannel.block

REM Package chaincode
echo 📦 Packaging chaincode...
docker exec cli peer lifecycle chaincode package ehr-chaincode.tar.gz --path /opt/gopath/src/github.com/chaincode/ehr-chaincode --lang node --label ehr-chaincode_5.0

REM Install chaincode
echo 📥 Installing chaincode...
docker exec cli peer lifecycle chaincode install ehr-chaincode.tar.gz

REM Get package ID
echo 🔍 Getting package ID...
for /f "tokens=3" %%i in ('docker exec cli peer lifecycle chaincode queryinstalled ^| findstr "ehr-chaincode_5.0"') do set PACKAGE_ID=%%i
echo Package ID: %PACKAGE_ID%

REM Approve chaincode
echo ✅ Approving chaincode...
docker exec cli peer lifecycle chaincode approveformyorg -o orderer.example.com:7050 --channelID mychannel --name ehr-chaincode --version 5.0 --package-id %PACKAGE_ID% --sequence 7

REM Commit chaincode
echo 🎯 Committing chaincode...
docker exec cli peer lifecycle chaincode commit -o orderer.example.com:7050 --channelID mychannel --name ehr-chaincode --version 5.0 --sequence 7

echo ✅ Chaincode deployed successfully!
pause